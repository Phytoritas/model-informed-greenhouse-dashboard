import asyncio

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
