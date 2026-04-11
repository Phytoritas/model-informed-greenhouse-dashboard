from __future__ import annotations

from datetime import UTC, datetime, timedelta
from pathlib import Path

from fastapi.testclient import TestClient

from model_informed_greenhouse_dashboard import get_app
from model_informed_greenhouse_dashboard.backend.app.adapters.cucumber import (
    CucumberAdapter,
)
from model_informed_greenhouse_dashboard.backend.app.adapters.tomato import TomatoAdapter


def _backend_main():
    from model_informed_greenhouse_dashboard.backend.app import main as backend_main

    return backend_main


def _model_store_module():
    from model_informed_greenhouse_dashboard.backend.app.services.model_runtime import (
        model_state_store,
    )

    return model_state_store


def _seed_cucumber_adapter() -> CucumberAdapter:
    adapter = CucumberAdapter()
    model = adapter.model
    model.nodes = 18
    model.remaining_leaves = 18
    model.cumulative_thermal_time = 640.0
    model.vegetative_dw = 82.0
    model.fruit_dw = 24.0
    model.reproductive_node_threshold = 15
    model.leaves_info = [
        {
            "Leaf Number": rank,
            "Date": model.start_date.date(),
            "Thermal Time": float((rank - 1) * 18),
        }
        for rank in range(1, 19)
    ]
    model.LAI = float(model.calculate_current_lai())
    adapter._last_state = {
        "LAI": model.LAI,
        "leaf_count": model.remaining_leaves,
        "fruit_dry_weight_g_m2": model.fruit_dw,
        "vegetative_dry_weight_g_m2": model.vegetative_dw,
        "gross_photosynthesis_umol_m2_s": 13.2,
        "net_assimilation_umol_m2_s": 8.4,
        "T_canopy_C": 23.5,
    }
    adapter._last_datetime = datetime(2026, 4, 7, 9, 0, tzinfo=UTC)
    return adapter


def _seed_tomato_adapter() -> TomatoAdapter:
    adapter = TomatoAdapter()
    model = adapter.model
    model.truss_count = 3
    model.n_f = 4
    model.truss_cohorts = [
        {"tdvs": 0.55, "n_fruits": 4, "w_fr_cohort": 14.0, "active": True, "mult": 1.0},
        {"tdvs": 0.43, "n_fruits": 4, "w_fr_cohort": 11.0, "active": True, "mult": 1.0},
        {"tdvs": 0.21, "n_fruits": 4, "w_fr_cohort": 6.0, "active": True, "mult": 1.0},
    ]
    model.W_lv = 78.0
    model.W_st = 36.0
    model.W_rt = 18.0
    model.W_fr = sum(cohort["w_fr_cohort"] for cohort in model.truss_cohorts)
    model.W_fr_harvested = 9.0
    model.LAI = 2.35
    adapter._last_state = {
        "crop_efficiency": 1.18,
        "gross_photosynthesis_umol_m2_s": 12.4,
        "T_canopy_C": 24.1,
    }
    adapter._last_datetime = datetime(2026, 4, 7, 10, 0, tzinfo=UTC)
    return adapter


def test_model_state_store_round_trip_snapshot(tmp_path: Path) -> None:
    store_module = _model_store_module()
    store = store_module.ModelStateStore(tmp_path / "model_runtime.sqlite3")

    record = store.persist_snapshot(
        greenhouse_id="cucumber",
        crop="cucumber",
        snapshot_time=datetime(2026, 4, 7, 11, 0, tzinfo=UTC),
        adapter_name="cucumber",
        adapter_version="1.0.0",
        normalized_snapshot={"state": {"leaf_count": 15}},
        raw_adapter_state={"remaining_leaves": 15},
        source="test",
        metadata={"seed": True},
    )

    loaded = store.load_snapshot(record["snapshot_id"])

    assert loaded is not None
    assert loaded["snapshot_id"] == record["snapshot_id"]
    assert loaded["normalized_snapshot"]["state"]["leaf_count"] == 15
    assert loaded["raw_adapter_state"]["remaining_leaves"] == 15


def test_model_snapshot_endpoint_persists_live_cucumber_state(
    monkeypatch,
    tmp_path: Path,
) -> None:
    backend_main = _backend_main()
    backend_main.app_state["cucumber"]["adapter"] = _seed_cucumber_adapter()
    store_module = _model_store_module()
    monkeypatch.setattr(
        store_module,
        "DEFAULT_MODEL_RUNTIME_DB_PATH",
        tmp_path / "model_runtime.sqlite3",
    )

    client = TestClient(get_app())
    response = client.post("/api/models/snapshot", json={"crop": "cucumber"})

    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "success"
    assert payload["crop"] == "cucumber"
    assert payload["snapshot"]["state"]["leaf_count"] == 18
    assert payload["snapshot"]["state"]["lai"] > 0


def test_model_replay_endpoint_applies_cucumber_leaf_removal(
    monkeypatch,
    tmp_path: Path,
) -> None:
    backend_main = _backend_main()
    backend_main.app_state["cucumber"]["adapter"] = _seed_cucumber_adapter()
    store_module = _model_store_module()
    monkeypatch.setattr(
        store_module,
        "DEFAULT_MODEL_RUNTIME_DB_PATH",
        tmp_path / "model_runtime.sqlite3",
    )

    client = TestClient(get_app())
    response = client.post(
        "/api/models/replay",
        json={
            "crop": "cucumber",
            "events": [
                {
                    "event_type": "leaf_removal",
                    "event_time": "2026-04-07T12:00:00+00:00",
                    "leaves_removed_count": 3,
                    "target_leaf_count": 15,
                    "reason_code": "shade_reduction",
                    "operator": "tester",
                }
            ],
        },
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "success"
    assert payload["events"][0]["removed_leaf_count"] == 3
    assert payload["snapshot"]["state"]["leaf_count"] == 15
    assert payload["snapshot"]["state"]["lai"] < 4


def test_model_replay_endpoint_applies_tomato_fruit_thinning(
    monkeypatch,
    tmp_path: Path,
) -> None:
    backend_main = _backend_main()
    backend_main.app_state["tomato"]["adapter"] = _seed_tomato_adapter()
    store_module = _model_store_module()
    monkeypatch.setattr(
        store_module,
        "DEFAULT_MODEL_RUNTIME_DB_PATH",
        tmp_path / "model_runtime.sqlite3",
    )

    client = TestClient(get_app())
    response = client.post(
        "/api/models/replay",
        json={
            "crop": "tomato",
            "events": [
                {
                    "event_type": "fruit_thinning",
                    "event_time": "2026-04-07T13:00:00+00:00",
                    "cohort_id": 0,
                    "target_fruits_per_truss": 3,
                    "fruits_removed_count": 1,
                    "reason_code": "sink_balance",
                    "operator": "tester",
                }
            ],
        },
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "success"
    assert payload["events"][0]["fruits_removed_count"] == 1
    assert payload["snapshot"]["state"]["truss_cohorts"][0]["n_fruits"] == 3
    assert (
        payload["events"][0]["sink_demand_after"]
        <= payload["events"][0]["sink_demand_before"]
    )


def test_model_state_store_lists_snapshots_since(tmp_path: Path) -> None:
    store_module = _model_store_module()
    store = store_module.ModelStateStore(tmp_path / "model_runtime.sqlite3")

    early = store.persist_snapshot(
        greenhouse_id="cucumber",
        crop="cucumber",
        snapshot_time=datetime(2026, 4, 7, 6, 0, tzinfo=UTC),
        adapter_name="cucumber",
        adapter_version="1.0.0",
        normalized_snapshot={"state": {"source_capacity": 10.0, "sink_demand": 6.0}},
        raw_adapter_state={"RH": 0.72, "u_CO2": 700.0},
        source="test",
    )
    late = store.persist_snapshot(
        greenhouse_id="cucumber",
        crop="cucumber",
        snapshot_time=datetime(2026, 4, 7, 9, 0, tzinfo=UTC),
        adapter_name="cucumber",
        adapter_version="1.0.0",
        normalized_snapshot={"state": {"source_capacity": 11.0, "sink_demand": 7.0}},
        raw_adapter_state={"RH": 0.71, "u_CO2": 710.0},
        source="test",
    )

    records = store.list_snapshots_since(
        "cucumber",
        "cucumber",
        since=datetime(2026, 4, 7, 8, 0, tzinfo=UTC),
    )

    assert [record["snapshot_id"] for record in records] == [late["snapshot_id"]]
    assert early["snapshot_id"] not in [record["snapshot_id"] for record in records]


def test_model_state_store_lists_snapshots_by_created_at_and_source(
    tmp_path: Path,
) -> None:
    store_module = _model_store_module()
    store = store_module.ModelStateStore(tmp_path / "model_runtime.sqlite3")

    store.persist_snapshot(
        greenhouse_id="cucumber",
        crop="cucumber",
        snapshot_time=datetime(2021, 2, 23, 6, 0, tzinfo=UTC),
        adapter_name="cucumber",
        adapter_version="1.0.0",
        normalized_snapshot={"state": {"source_capacity": 0.0, "sink_demand": 0.0}},
        raw_adapter_state={"RH": 0.72, "u_CO2": 700.0},
        source="rtr_state_baseline",
    )
    live = store.persist_snapshot(
        greenhouse_id="cucumber",
        crop="cucumber",
        snapshot_time=datetime(2021, 2, 23, 7, 0, tzinfo=UTC),
        adapter_name="cucumber",
        adapter_version="1.0.0",
        normalized_snapshot={"state": {"source_capacity": 12.0, "sink_demand": 7.5}},
        raw_adapter_state={"RH": 0.71, "u_CO2": 715.0},
        source="simulation_run",
    )

    records = store.list_snapshots_created_since(
        "cucumber",
        "cucumber",
        since=datetime.now(UTC) - timedelta(minutes=5),
        sources=("simulation_run", "overview_signals"),
    )

    assert [record["snapshot_id"] for record in records] == [live["snapshot_id"]]


def test_overview_signal_endpoint_returns_live_weather_and_model_history(
    monkeypatch,
    tmp_path: Path,
) -> None:
    backend_main = _backend_main()
    backend_main.app_state["cucumber"]["adapter"] = None
    backend_main.app_state["cucumber"]["last_runtime_snapshot_at"] = None
    store_module = _model_store_module()
    monkeypatch.setattr(
        store_module,
        "DEFAULT_MODEL_RUNTIME_DB_PATH",
        tmp_path / "model_runtime.sqlite3",
    )

    store = store_module.ModelStateStore(tmp_path / "model_runtime.sqlite3")
    store.persist_snapshot(
        greenhouse_id="cucumber",
        crop="cucumber",
        snapshot_time=datetime.now(UTC) - timedelta(hours=3),
        adapter_name="cucumber",
        adapter_version="1.0.0",
        normalized_snapshot={
            "state": {
                "source_capacity": 12.4,
                "sink_demand": 8.1,
                "lai": 3.1,
            },
            "gas_exchange": {
                "canopy_net_assimilation_umol_m2_s": 9.2,
            },
            "live_observation": {
                "canopy_temperature_c": 23.4,
            },
        },
        raw_adapter_state={"RH": 0.72, "u_CO2": 720.0},
        source="simulation_run",
    )
    store.persist_snapshot(
        greenhouse_id="cucumber",
        crop="cucumber",
        snapshot_time=datetime.now(UTC) - timedelta(hours=1),
        adapter_name="cucumber",
        adapter_version="1.0.0",
        normalized_snapshot={
            "state": {
                "source_capacity": 13.0,
                "sink_demand": 7.8,
                "lai": 3.2,
            },
            "gas_exchange": {
                "canopy_net_assimilation_umol_m2_s": 9.7,
            },
            "live_observation": {
                "canopy_temperature_c": 23.8,
            },
        },
        raw_adapter_state={"RH": 0.70, "u_CO2": 735.0},
        source="simulation_run",
    )

    async def fake_shortwave_history(*, hours: int = 72, force_refresh: bool = False):
        assert hours == 72
        assert force_refresh is False
        return {
            "location": {"name": "Daegu", "country": "South Korea"},
            "source": {"provider": "Open-Meteo", "docs_url": "https://open-meteo.com/en/docs"},
            "window_hours": 72,
            "unit": "W/m²",
            "points": [
                {"time": "2026-04-07T09:00:00+09:00", "shortwave_radiation_w_m2": 180.0},
                {"time": "2026-04-07T10:00:00+09:00", "shortwave_radiation_w_m2": 260.0},
            ],
        }

    monkeypatch.setattr(backend_main, "fetch_daegu_shortwave_history", fake_shortwave_history)
    client = TestClient(get_app())

    response = client.get("/api/overview/signals?crop=cucumber")

    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "success"
    assert payload["irradiance"]["points"][1]["shortwave_radiation_w_m2"] == 260.0
    assert payload["source_sink"]["status"] == "ready"
    assert len(payload["source_sink"]["points"]) == 2
    assert payload["source_sink"]["points"][0]["source_sink_balance"] > 0.0


def test_overview_signal_endpoint_uses_recent_live_snapshot_creation_time(
    monkeypatch,
    tmp_path: Path,
) -> None:
    backend_main = _backend_main()
    backend_main.app_state["cucumber"]["adapter"] = None
    backend_main.app_state["cucumber"]["last_runtime_snapshot_at"] = None
    store_module = _model_store_module()
    monkeypatch.setattr(
        store_module,
        "DEFAULT_MODEL_RUNTIME_DB_PATH",
        tmp_path / "model_runtime.sqlite3",
    )

    store = store_module.ModelStateStore(tmp_path / "model_runtime.sqlite3")
    store.persist_snapshot(
        greenhouse_id="cucumber",
        crop="cucumber",
        snapshot_time=datetime(2021, 2, 23, 8, 0, tzinfo=UTC),
        adapter_name="cucumber",
        adapter_version="1.0.0",
        normalized_snapshot={
            "state": {
                "source_capacity": 12.4,
                "sink_demand": 8.1,
                "lai": 3.1,
            },
            "gas_exchange": {
                "canopy_net_assimilation_umol_m2_s": 9.2,
            },
            "live_observation": {
                "canopy_temperature_c": 23.4,
            },
        },
        raw_adapter_state={"RH": 0.72, "u_CO2": 720.0},
        source="simulation_run",
    )
    store.persist_snapshot(
        greenhouse_id="cucumber",
        crop="cucumber",
        snapshot_time=datetime(2021, 2, 23, 8, 0, tzinfo=UTC),
        adapter_name="cucumber",
        adapter_version="1.0.0",
        normalized_snapshot={
            "state": {
                "source_capacity": 0.0,
                "sink_demand": 0.0,
                "lai": 0.1,
            },
        },
        raw_adapter_state={"RH": 0.72, "u_CO2": 700.0},
        source="rtr_state_baseline",
    )

    async def fake_shortwave_history(*, hours: int = 72, force_refresh: bool = False):
        assert hours == 72
        assert force_refresh is False
        return {
            "location": {"name": "Daegu", "country": "South Korea"},
            "source": {"provider": "Open-Meteo", "docs_url": "https://open-meteo.com/en/docs"},
            "window_hours": 72,
            "unit": "W/m짼",
            "points": [
                {"time": "2026-04-07T09:00:00+09:00", "shortwave_radiation_w_m2": 180.0},
                {"time": "2026-04-07T10:00:00+09:00", "shortwave_radiation_w_m2": 260.0},
            ],
        }

    monkeypatch.setattr(backend_main, "fetch_daegu_shortwave_history", fake_shortwave_history)
    client = TestClient(get_app())

    response = client.get("/api/overview/signals?crop=cucumber")

    assert response.status_code == 200
    payload = response.json()
    assert payload["source_sink"]["status"] == "ready"
    assert len(payload["source_sink"]["points"]) == 1
    point_time = datetime.fromisoformat(payload["source_sink"]["points"][0]["time"])
    assert point_time.year != 2021
