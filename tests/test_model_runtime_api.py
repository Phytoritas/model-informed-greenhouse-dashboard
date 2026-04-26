from __future__ import annotations

from datetime import UTC, datetime, timedelta
from pathlib import Path

from fastapi.testclient import TestClient
import pandas as pd

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


def test_model_state_store_created_since_limit_prefers_latest_snapshots(
    monkeypatch,
    tmp_path: Path,
) -> None:
    store_module = _model_store_module()
    store = store_module.ModelStateStore(tmp_path / "model_runtime.sqlite3")

    base_created_at = datetime(2026, 4, 12, 8, 0, tzinfo=UTC)
    created_ticks = [base_created_at + timedelta(seconds=idx) for idx in range(6)]
    tick_iter = iter(created_ticks)
    monkeypatch.setattr(store_module, "_utcnow", lambda: next(tick_iter))

    snapshot_ids: list[str] = []
    for hour in range(5):
        record = store.persist_snapshot(
            greenhouse_id="cucumber",
            crop="cucumber",
            snapshot_time=datetime(2021, 2, 23, hour, 0, tzinfo=UTC),
            adapter_name="cucumber",
            adapter_version="1.0.0",
            normalized_snapshot={"state": {"source_capacity": 10.0 + hour, "sink_demand": 7.0}},
            raw_adapter_state={"RH": 0.7, "u_CO2": 700.0 + hour},
            source="simulation_run",
        )
        snapshot_ids.append(record["snapshot_id"])

    records = store.list_snapshots_created_since(
        "cucumber",
        "cucumber",
        since=base_created_at - timedelta(minutes=1),
        limit=2,
        sources=("simulation_run",),
    )

    # latest 2 by created_at should be selected, but returned in chronological order
    assert [record["snapshot_id"] for record in records] == snapshot_ids[-2:]


def test_overview_signal_endpoint_returns_internal_irradiance_and_model_history(
    monkeypatch,
    tmp_path: Path,
) -> None:
    backend_main = _backend_main()
    backend_main.app_state["cucumber"]["adapter"] = None
    backend_main.app_state["cucumber"]["simulator"] = None
    backend_main.app_state["cucumber"]["dt_hours"] = 1 / 6
    backend_main.app_state["cucumber"]["df_env"] = pd.DataFrame(
        {
            "datetime": [
                "2026-04-12T09:00:00+09:00",
                "2026-04-12T09:10:00+09:00",
                "2026-04-12T09:20:00+09:00",
            ],
            "PAR_umol": [410.0, 822.6, 1188.2],
        }
    )
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

    client = TestClient(get_app())

    response = client.get("/api/overview/signals", params={"crop": " Cucumber "})

    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "success"
    assert payload["irradiance"]["source"]["provider"] == "Greenhouse internal PAR"
    assert payload["irradiance"]["points"][-1]["shortwave_radiation_w_m2"] == 260.0
    assert payload["source_sink"]["status"] == "ready"
    assert len(payload["source_sink"]["points"]) == 2
    assert payload["source_sink"]["points"][0]["source_sink_balance"] > 0.0


def test_overview_signal_endpoint_uses_simulation_snapshot_time_axis(
    monkeypatch,
    tmp_path: Path,
) -> None:
    backend_main = _backend_main()
    backend_main.app_state["cucumber"]["adapter"] = None
    backend_main.app_state["cucumber"]["simulator"] = None
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
    client = TestClient(get_app())

    response = client.get("/api/overview/signals?crop=cucumber")

    assert response.status_code == 200
    payload = response.json()
    assert payload["source_sink"]["status"] == "ready"
    assert len(payload["source_sink"]["points"]) == 1
    point_time = datetime.fromisoformat(payload["source_sink"]["points"][0]["time"])
    assert point_time.year == 2021


def test_overview_signal_endpoint_uses_internal_irradiance_history(
    monkeypatch,
    tmp_path: Path,
) -> None:
    backend_main = _backend_main()
    backend_main.app_state["cucumber"]["adapter"] = None
    backend_main.app_state["cucumber"]["simulator"] = None
    backend_main.app_state["cucumber"]["dt_hours"] = 1 / 6
    backend_main.app_state["cucumber"]["df_env"] = pd.DataFrame(
        {
            "datetime": [
                "2026-04-12T09:00:00+09:00",
                "2026-04-12T09:10:00+09:00",
                "2026-04-12T09:20:00+09:00",
            ],
            "PAR_umol": [410.0, 520.0, 610.0],
        }
    )

    store_module = _model_store_module()
    monkeypatch.setattr(
        store_module,
        "DEFAULT_MODEL_RUNTIME_DB_PATH",
        tmp_path / "model_runtime.sqlite3",
    )
    client = TestClient(get_app())

    response = client.get("/api/overview/signals?crop=cucumber")

    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "success"
    assert payload["irradiance"]["source"]["provider"] == "Greenhouse internal PAR"
    assert len(payload["irradiance"]["points"]) >= 1
    assert payload["irradiance"]["points"][-1]["shortwave_radiation_w_m2"] > 0


def test_start_simulation_skips_restart_when_same_crop_run_is_already_active() -> None:
    backend_main = _backend_main()

    class DummyTask:
        @staticmethod
        def done() -> bool:
            return False

    class DummySimulator:
        def __init__(self) -> None:
            self.running = True
            self.paused = False
            self.idx = 5
            self.df_env = pd.DataFrame(
                {
                    "datetime": pd.date_range(
                        "2026-04-12T00:00:00+09:00",
                        periods=12,
                        freq="10min",
                    )
                }
            )

    dummy_simulator = DummySimulator()
    backend_main.app_state["cucumber"]["simulator"] = dummy_simulator
    backend_main.app_state["cucumber"]["sim_task"] = DummyTask()
    backend_main.app_state["cucumber"]["csv_filename"] = "Cucumber_Env.CSV"
    backend_main.app_state["cucumber"]["time_step"] = "10min"
    backend_main.app_state["cucumber"]["dt_hours"] = 1 / 6
    backend_main.app_state["cucumber"]["last_runtime_tick_at"] = None

    client = TestClient(get_app())
    response = client.post(
        "/api/start",
        json={
            "crop": "cucumber",
            "csv_filename": "Cucumber_Env.CSV",
            "time_step": "10min",
        },
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "already_running"
    assert payload["crop"] == "cucumber"
    assert backend_main.app_state["cucumber"]["simulator"] is dummy_simulator


def test_overview_signal_endpoint_uses_active_simulation_datetime_for_internal_irradiance(
    monkeypatch,
    tmp_path: Path,
) -> None:
    backend_main = _backend_main()
    backend_main.app_state["cucumber"]["adapter"] = None

    class DummySimulator:
        def __init__(self) -> None:
            self.idx = 1
            self.df_env = pd.DataFrame(
                {
                    "datetime": [
                        "2021-02-23T00:00:00+09:00",
                        "2021-02-23T00:10:00+09:00",
                        "2021-02-23T00:20:00+09:00",
                    ],
                    "PAR_umol": [120.0, 180.0, 260.0],
                }
            )

    backend_main.app_state["cucumber"]["simulator"] = DummySimulator()

    store_module = _model_store_module()
    monkeypatch.setattr(
        store_module,
        "DEFAULT_MODEL_RUNTIME_DB_PATH",
        tmp_path / "model_runtime.sqlite3",
    )
    backend_main.app_state["cucumber"]["dt_hours"] = 1 / 6
    client = TestClient(get_app())

    response = client.get("/api/overview/signals?crop=cucumber")
    assert response.status_code == 200
    payload = response.json()
    points = payload["irradiance"]["points"]
    assert len(points) == 2
    assert points[-1]["time"].startswith("2021-02-23T00:10:00")
    assert all(not point["time"].startswith("2021-02-23T00:20:00") for point in points)


def test_overview_signal_endpoint_filters_source_sink_to_reference_window_and_sorts(
    monkeypatch,
    tmp_path: Path,
) -> None:
    backend_main = _backend_main()
    backend_main.app_state["cucumber"]["adapter"] = None

    class DummySimulator:
        def __init__(self) -> None:
            self.idx = 2
            self.df_env = pd.DataFrame(
                {
                    "datetime": [
                        "2021-02-23T04:00:00+00:00",
                        "2021-02-23T05:00:00+00:00",
                        "2021-02-23T06:00:00+00:00",
                    ]
                }
            )

    backend_main.app_state["cucumber"]["simulator"] = DummySimulator()
    backend_main.app_state["cucumber"]["last_runtime_snapshot_at"] = None

    store_module = _model_store_module()
    monkeypatch.setattr(
        store_module,
        "DEFAULT_MODEL_RUNTIME_DB_PATH",
        tmp_path / "model_runtime.sqlite3",
    )
    store = store_module.ModelStateStore(tmp_path / "model_runtime.sqlite3")

    def _persist(snapshot_time: datetime, source_capacity: float) -> None:
        store.persist_snapshot(
            greenhouse_id="cucumber",
            crop="cucumber",
            snapshot_time=snapshot_time,
            adapter_name="cucumber",
            adapter_version="1.0.0",
            normalized_snapshot={
                "state": {
                    "source_capacity": source_capacity,
                    "sink_demand": 7.0,
                    "lai": 3.0,
                }
            },
            raw_adapter_state={"RH": 0.7, "u_CO2": 700.0},
            source="simulation_run",
        )

    # In-window, intentionally inserted out of chronological order.
    _persist(datetime(2021, 2, 23, 6, 0, tzinfo=UTC), 16.0)
    _persist(datetime(2021, 2, 23, 4, 0, tzinfo=UTC), 14.0)
    # Out-of-window future point that should be excluded.
    _persist(datetime(2021, 3, 26, 1, 0, tzinfo=UTC), 30.0)
    client = TestClient(get_app())
    response = client.get("/api/overview/signals?crop=cucumber")

    assert response.status_code == 200
    payload = response.json()
    points = payload["source_sink"]["points"]
    assert len(points) == 2
    assert points[0]["source_capacity"] == 14.0
    assert points[1]["source_capacity"] == 16.0
