import asyncio
from datetime import datetime

import pytest


def _weather_service():
    from model_informed_greenhouse_dashboard.backend.app.services import weather as weather_service

    return weather_service


def test_shortwave_history_cache_refreshes_on_history_ttl(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    weather_service = _weather_service()
    clock = {"now": 1_000.0}
    request_count = {"value": 0}

    class FakeResponse:
        def __init__(self, irradiance: float) -> None:
            self._irradiance = irradiance

        def raise_for_status(self) -> None:
            return None

        def json(self) -> dict:
            return {
                "hourly": {
                    "time": ["2026-04-12T09:00:00+09:00"],
                    "shortwave_radiation": [self._irradiance],
                }
            }

    class FakeAsyncClient:
        def __init__(self, *args, **kwargs) -> None:
            return None

        async def __aenter__(self):
            return self

        async def __aexit__(self, exc_type, exc, tb) -> bool:
            return False

        async def get(self, url: str, params: dict) -> FakeResponse:
            del url, params
            request_count["value"] += 1
            return FakeResponse(100.0 + request_count["value"])

    monkeypatch.setattr(weather_service.time, "time", lambda: clock["now"])
    monkeypatch.setattr(weather_service.httpx, "AsyncClient", FakeAsyncClient)
    monkeypatch.setattr(
        weather_service,
        "_weather_history_cache",
        {"expires_at": 0.0, "payload": None},
    )

    first_payload = asyncio.run(weather_service.fetch_daegu_shortwave_history(hours=72))
    assert request_count["value"] == 1
    assert first_payload["points"][0]["shortwave_radiation_w_m2"] == pytest.approx(101.0)

    clock["now"] += weather_service.WEATHER_HISTORY_CACHE_TTL_SECONDS - 10
    second_payload = asyncio.run(weather_service.fetch_daegu_shortwave_history(hours=72))
    assert request_count["value"] == 1
    assert second_payload["points"][0]["shortwave_radiation_w_m2"] == pytest.approx(101.0)

    clock["now"] += 11
    third_payload = asyncio.run(weather_service.fetch_daegu_shortwave_history(hours=72))
    assert request_count["value"] == 2
    assert third_payload["points"][0]["shortwave_radiation_w_m2"] == pytest.approx(102.0)


def test_shortwave_history_appends_current_point(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    weather_service = _weather_service()

    class FakeResponse:
        def raise_for_status(self) -> None:
            return None

        def json(self) -> dict:
            return {
                "current": {
                    "time": "2026-04-12T09:15:00+09:00",
                    "shortwave_radiation": 359.0,
                },
                "hourly": {
                    "time": ["2026-04-12T09:00:00+09:00"],
                    "shortwave_radiation": [102.0],
                },
            }

    class FakeAsyncClient:
        def __init__(self, *args, **kwargs) -> None:
            return None

        async def __aenter__(self):
            return self

        async def __aexit__(self, exc_type, exc, tb) -> bool:
            return False

        async def get(self, url: str, params: dict) -> FakeResponse:
            del url, params
            return FakeResponse()

    monkeypatch.setattr(weather_service.httpx, "AsyncClient", FakeAsyncClient)
    monkeypatch.setattr(
        weather_service,
        "_weather_history_cache",
        {"expires_at": 0.0, "payload": None},
    )

    payload = asyncio.run(weather_service.fetch_daegu_shortwave_history(hours=72))
    assert payload["source"]["fetched_at"] == "2026-04-12T09:15:00+09:00"
    assert payload["points"][-2:] == [
        {
            "time": "2026-04-12T09:00:00+09:00",
            "shortwave_radiation_w_m2": pytest.approx(102.0),
        },
        {
            "time": "2026-04-12T09:15:00+09:00",
            "shortwave_radiation_w_m2": pytest.approx(359.0),
        },
    ]


def test_shortwave_history_reuses_cached_payload_on_upstream_error(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    weather_service = _weather_service()
    clock = {"now": 10_000.0}
    request_count = {"value": 0}

    class FakeResponse:
        def raise_for_status(self) -> None:
            return None

        def json(self) -> dict:
            return {
                "current": {
                    "time": "2026-04-12T09:10:00+09:00",
                    "shortwave_radiation": 212.0,
                },
                "hourly": {
                    "time": ["2026-04-12T09:00:00+09:00"],
                    "shortwave_radiation": [200.0],
                },
            }

    class FlakyAsyncClient:
        def __init__(self, *args, **kwargs) -> None:
            return None

        async def __aenter__(self):
            return self

        async def __aexit__(self, exc_type, exc, tb) -> bool:
            return False

        async def get(self, url: str, params: dict):
            del url, params
            request_count["value"] += 1
            if request_count["value"] == 1:
                return FakeResponse()
            raise weather_service.httpx.ReadTimeout("Open-Meteo shortwave timed out")

    monkeypatch.setattr(weather_service.time, "time", lambda: clock["now"])
    monkeypatch.setattr(weather_service.httpx, "AsyncClient", FlakyAsyncClient)
    monkeypatch.setattr(
        weather_service,
        "_weather_history_cache",
        {"expires_at": 0.0, "payload": None},
    )

    first_payload = asyncio.run(weather_service.fetch_daegu_shortwave_history(hours=72))
    assert first_payload["source"]["provider"] == "Open-Meteo"
    assert first_payload["points"][-1]["shortwave_radiation_w_m2"] == pytest.approx(212.0)

    # Expire cache TTL so the next call attempts an upstream fetch and falls back.
    clock["now"] += weather_service.WEATHER_HISTORY_CACHE_TTL_SECONDS + 1
    second_payload = asyncio.run(weather_service.fetch_daegu_shortwave_history(hours=72))

    assert second_payload["source"]["provider"] == "Open-Meteo cached"
    assert second_payload["points"][-1]["shortwave_radiation_w_m2"] == pytest.approx(212.0)


def test_shortwave_history_reuses_cached_payload_when_upstream_returns_sparse_points(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    weather_service = _weather_service()
    clock = {"now": 20_000.0}
    request_count = {"value": 0}

    class FakeResponse:
        def __init__(self, payload: dict) -> None:
            self._payload = payload

        def raise_for_status(self) -> None:
            return None

        def json(self) -> dict:
            return self._payload

    class SparseAsyncClient:
        def __init__(self, *args, **kwargs) -> None:
            return None

        async def __aenter__(self):
            return self

        async def __aexit__(self, exc_type, exc, tb) -> bool:
            return False

        async def get(self, url: str, params: dict):
            del url, params
            request_count["value"] += 1
            if request_count["value"] == 1:
                return FakeResponse(
                    {
                        "current": {
                            "time": "2026-04-12T09:15:00+09:00",
                            "shortwave_radiation": 333.0,
                        },
                        "hourly": {
                            "time": ["2026-04-12T09:00:00+09:00"],
                            "shortwave_radiation": [210.0],
                        },
                    }
                )
            return FakeResponse(
                {
                    "current": {
                        "time": "2026-04-12T09:30:00+09:00",
                        "shortwave_radiation": 280.0,
                    },
                    "hourly": {
                        "time": [],
                        "shortwave_radiation": [],
                    },
                }
            )

    monkeypatch.setattr(weather_service.time, "time", lambda: clock["now"])
    monkeypatch.setattr(weather_service.httpx, "AsyncClient", SparseAsyncClient)
    monkeypatch.setattr(
        weather_service,
        "_weather_history_cache",
        {"expires_at": 0.0, "payload": None},
    )

    first_payload = asyncio.run(weather_service.fetch_daegu_shortwave_history(hours=72))
    assert first_payload["source"]["provider"] == "Open-Meteo"
    assert len(first_payload["points"]) >= 2

    clock["now"] += weather_service.WEATHER_HISTORY_CACHE_TTL_SECONDS + 1
    second_payload = asyncio.run(weather_service.fetch_daegu_shortwave_history(hours=72))

    assert second_payload["source"]["provider"] == "Open-Meteo cached"
    assert second_payload["points"] == first_payload["points"]


def test_shortwave_history_uses_archive_endpoint_for_past_reference_time(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    weather_service = _weather_service()
    captured = {"url": None}

    class FakeResponse:
        def raise_for_status(self) -> None:
            return None

        def json(self) -> dict:
            return {
                "hourly": {
                    "time": [
                        "2021-02-22T00:00",
                        "2021-02-22T01:00",
                        "2021-02-23T00:00",
                    ],
                    "shortwave_radiation": [50.0, 75.0, 120.0],
                }
            }

    class FakeAsyncClient:
        def __init__(self, *args, **kwargs) -> None:
            return None

        async def __aenter__(self):
            return self

        async def __aexit__(self, exc_type, exc, tb) -> bool:
            return False

        async def get(self, url: str, params: dict):
            del params
            captured["url"] = url
            return FakeResponse()

    monkeypatch.setattr(weather_service.httpx, "AsyncClient", FakeAsyncClient)
    monkeypatch.setattr(
        weather_service,
        "_weather_history_cache",
        {"expires_at": 0.0, "payload": None, "cache_key": None},
    )

    payload = asyncio.run(
        weather_service.fetch_daegu_shortwave_history(
            hours=24,
            reference_end=datetime.fromisoformat("2021-02-23T00:00:00+09:00"),
        )
    )

    assert captured["url"] == weather_service.OPEN_METEO_ARCHIVE_URL
    assert payload["source"]["endpoint"] == weather_service.OPEN_METEO_ARCHIVE_URL
    assert len(payload["points"]) >= 2
