import pytest
from fastapi.testclient import TestClient

from model_informed_greenhouse_dashboard import get_app
from model_informed_greenhouse_dashboard.backend.app import main as backend_main
from model_informed_greenhouse_dashboard.backend.app.config import (
    greenhouse_config,
    settings,
)
from model_informed_greenhouse_dashboard.backend.app.services.rtr_profiles import (
    DEFAULT_RTR_PROFILE_PAYLOAD,
)


@pytest.fixture(autouse=True)
def reset_runtime_state() -> None:
    for crop in ("tomato", "cucumber"):
        crop_state = backend_main.app_state[crop]
        crop_state["simulator"] = None
        crop_state["forecaster"] = None
        crop_state["adapter"] = None
        crop_state["df_env"] = None
        crop_state["sim_task"] = None
        crop_state["dt_hours"] = None
        crop_state["time_step"] = "auto"
        crop_state["decision"] = None
        crop_state["last_irrigation"] = None
        crop_state["last_energy"] = None
        crop_state["latest_forecast"] = None
        crop_state["ops_config"] = None
        crop_state["crop_config"] = None
        crop_state["pending_prune_reset"] = False


def test_backend_root_endpoint_smoke() -> None:
    client = TestClient(get_app())

    response = client.get("/")

    assert response.status_code == 200
    assert response.json()["docs"] == "/docs"


def test_status_endpoint_initializes_crop_slots() -> None:
    client = TestClient(get_app())

    response = client.get("/api/status")

    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "success"
    assert payload["greenhouses"]["tomato"]["status"] == "idle"
    assert payload["greenhouses"]["cucumber"]["status"] == "idle"


def test_status_marks_completed_replays_as_completed() -> None:
    class DummySimulator:
        def __init__(self) -> None:
            self.running = True
            self.idx = 9
            self.df_env = [object()] * 10

    backend_main.app_state["tomato"]["simulator"] = DummySimulator()
    client = TestClient(get_app())

    response = client.get("/api/status")

    assert response.status_code == 200
    payload = response.json()
    tomato = payload["greenhouses"]["tomato"]
    assert tomato["status"] == "completed"
    assert tomato["running"] is True
    assert tomato["at_end"] is True
    assert tomato["progress"] == 100.0


def test_config_contract_loads_from_repo_paths() -> None:
    assert settings.config_dir.endswith("configs")
    assert settings.data_dir.endswith("data")
    assert greenhouse_config["greenhouse"]["area_m2"] > 0


def test_crop_config_defaults_are_available_before_simulation_start() -> None:
    client = TestClient(get_app())

    response = client.get("/api/config/crop?crop=tomato")

    assert response.status_code == 200
    payload = response.json()
    assert payload["crop"] == "tomato"
    assert payload["n_fruits_per_truss"] == 4


def test_crop_config_update_is_queued_when_adapter_is_inactive() -> None:
    client = TestClient(get_app())

    response = client.post(
        "/api/config/crop?crop=cucumber",
        json={"pruning_threshold": 21, "target_leaf_count": 17},
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["adapter_active"] is False
    assert "will apply" in payload["message"]
    assert payload["config"]["pruning_threshold"] == 21
    assert payload["config"]["target_leaf_count"] == 17


def test_prune_endpoint_queues_reset_before_cucumber_simulation_start() -> None:
    client = TestClient(get_app())

    response = client.post("/api/crop/prune?crop=cucumber")

    assert response.status_code == 200
    payload = response.json()
    assert payload["adapter_active"] is False
    assert backend_main.app_state["cucumber"]["pending_prune_reset"] is True


def test_ops_config_update_can_target_single_crop() -> None:
    client = TestClient(get_app())

    response = client.post(
        "/api/config/ops?crop=tomato",
        json={
            "heating_set_C": 20,
            "cooling_set_C": 28,
            "p_band_C": 3.0,
            "co2_target_ppm": 900,
            "drain_target_fraction": 0.25,
        },
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["crops"] == ["tomato"]
    assert backend_main.app_state["tomato"]["ops_config"]["heating_set_C"] == 20
    assert backend_main._get_ops_config("cucumber")["heating_set_C"] == 18


def test_ai_consult_degrades_gracefully_without_openai_key(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)
    client = TestClient(get_app())

    response = client.post(
        "/api/ai/consult",
        json={
            "crop": "tomato",
            "dashboard": {"data": {}, "metrics": {}},
            "language": "en",
        },
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "degraded"
    assert "Missing OpenAI API key" in payload["text"]


def test_ai_chat_degrades_gracefully_without_openai_key(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)
    client = TestClient(get_app())

    response = client.post(
        "/api/ai/chat",
        json={
            "crop": "cucumber",
            "messages": [{"role": "user", "content": "How is the crop doing?"}],
            "dashboard": {"currentData": {}, "metrics": {}},
            "language": "en",
        },
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "degraded"
    assert "Missing OpenAI API key" in payload["text"]


def test_daegu_weather_endpoint_returns_live_shape(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    async def fake_fetch() -> dict:
        return {
            "location": {
                "name": "Daegu",
                "country": "South Korea",
                "latitude": 35.8714,
                "longitude": 128.6014,
                "timezone": "Asia/Seoul",
            },
            "source": {
                "provider": "Open-Meteo",
                "docs_url": "https://open-meteo.com/en/docs",
                "fetched_at": "2026-04-03T09:00",
            },
            "summary": "Daegu is currently clear at 16.5C.",
            "current": {
                "time": "2026-04-03T09:00",
                "weather_code": 0,
                "weather_label": "Clear sky",
                "temperature_c": 16.5,
                "apparent_temperature_c": 16.1,
                "relative_humidity_pct": 55.0,
                "precipitation_mm": 0.0,
                "cloud_cover_pct": 5.0,
                "wind_speed_kmh": 8.4,
                "wind_direction_deg": 180.0,
                "is_day": True,
            },
            "daily": [
                {
                    "date": "2026-04-03",
                    "weather_code": 1,
                    "weather_label": "Mainly clear",
                    "temperature_max_c": 20.0,
                    "temperature_min_c": 9.0,
                    "shortwave_radiation_sum_mj_m2": 14.2,
                    "precipitation_probability_max_pct": 10.0,
                    "precipitation_sum_mm": 0.0,
                    "wind_speed_max_kmh": 16.0,
                    "sunshine_duration_h": 8.5,
                }
            ],
        }

    monkeypatch.setattr(backend_main, "fetch_daegu_weather_outlook", fake_fetch)
    client = TestClient(get_app())

    response = client.get("/api/weather/daegu")

    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "success"
    assert payload["location"]["name"] == "Daegu"
    assert payload["current"]["temperature_c"] == 16.5
    assert payload["daily"][0]["date"] == "2026-04-03"
    assert payload["daily"][0]["shortwave_radiation_sum_mj_m2"] == 14.2


def test_live_produce_prices_endpoint_returns_shape(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    async def fake_fetch() -> dict:
        return {
            "source": {
                "provider": "KAMIS",
                "docs_url": "https://www.kamis.or.kr/customer/reference/openapi_list.do",
                "endpoint": "dailySalesList + periodRetailProductList",
                "auth_mode": "sample",
                "fetched_at": "2026-04-03T09:00:00Z",
                "latest_day": "2026-04-03",
            },
            "summary": "KAMIS latest retail survey (2026-04-03) shows mixed moves.",
            "items": [
                {
                    "key": "321",
                    "display_name": "Tomato",
                    "source_name": "\ud1a0\ub9c8\ud1a0/\ud1a0\ub9c8\ud1a0",
                    "category_name": "\ucc44\uc18c\ub958",
                    "market_label": "\uc18c\ub9e4",
                    "unit": "1kg",
                    "latest_day": "2026-04-03",
                    "current_price_krw": 5196,
                    "previous_day_price_krw": 5234,
                    "month_ago_price_krw": 5219,
                    "year_ago_price_krw": 5663,
                    "direction": "down",
                    "day_over_day_pct": -0.7,
                    "raw_day_over_day_pct": 0.7,
                }
            ],
            "trend": {
                "reference_date": "2026-04-03",
                "history_days": 14,
                "forecast_days": 14,
                "normal_year_windows": [3, 5, 10],
                "series": [
                    {
                        "key": "321",
                        "display_name": "Tomato",
                        "source_name": "\ud1a0\ub9c8\ud1a0/\ud1a0\ub9c8\ud1a0",
                        "unit": "1kg",
                        "reference_date": "2026-04-03",
                        "history_days": 14,
                        "forecast_days": 14,
                        "points": [
                            {
                                "date": "2026-03-21",
                                "segment": "history",
                                "actual_price_krw": 5000,
                                "normal_3y_price_krw": None,
                                "normal_5y_price_krw": None,
                                "normal_10y_price_krw": None,
                                "normal_3y_sample_count": 0,
                                "normal_5y_sample_count": 0,
                                "normal_10y_sample_count": 0,
                            },
                            {
                                "date": "2026-04-03",
                                "segment": "history",
                                "actual_price_krw": 4932,
                                "normal_3y_price_krw": None,
                                "normal_5y_price_krw": None,
                                "normal_10y_price_krw": None,
                                "normal_3y_sample_count": 0,
                                "normal_5y_sample_count": 0,
                                "normal_10y_sample_count": 0,
                            },
                            {
                                "date": "2026-04-04",
                                "segment": "forecast",
                                "actual_price_krw": None,
                                "normal_3y_price_krw": 6400,
                                "normal_5y_price_krw": 6100,
                                "normal_10y_price_krw": 5900,
                                "normal_3y_sample_count": 3,
                                "normal_5y_sample_count": 5,
                                "normal_10y_sample_count": 10,
                            },
                        ],
                    }
                ],
                "unavailable_series": [],
            },
        }

    monkeypatch.setattr(backend_main, "fetch_featured_produce_prices", fake_fetch)
    client = TestClient(get_app())

    response = client.get("/api/market/produce")

    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "success"
    assert payload["source"]["provider"] == "KAMIS"
    assert payload["source"]["latest_day"] == "2026-04-03"
    assert payload["items"][0]["display_name"] == "Tomato"
    assert payload["items"][0]["current_price_krw"] == 5196
    assert payload["items"][0]["day_over_day_pct"] == -0.7
    assert payload["trend"]["series"][0]["display_name"] == "Tomato"
    assert payload["trend"]["series"][0]["points"][1]["actual_price_krw"] == 4932
    assert payload["trend"]["series"][0]["points"][2]["normal_10y_price_krw"] == 5900
    assert payload["trend"]["unavailable_series"] == []


def test_rtr_profiles_endpoint_returns_payload_shape(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(
        backend_main,
        "load_rtr_profiles",
        lambda: DEFAULT_RTR_PROFILE_PAYLOAD,
    )
    client = TestClient(get_app())

    response = client.get("/api/rtr/profiles")

    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "success"
    assert payload["version"] == 1
    assert payload["profiles"]["Tomato"]["baseTempC"] == 18.3
    assert payload["profiles"]["Cucumber"]["calibration"]["mode"] == "baseline"
    assert (
        payload["profiles"]["Tomato"]["calibration"]["selectionSource"]
        == "heuristic-fallback"
    )
    assert payload["profiles"]["Cucumber"]["calibration"]["windowCount"] == 0
