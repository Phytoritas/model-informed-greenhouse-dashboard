from __future__ import annotations

from datetime import UTC, datetime
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from model_informed_greenhouse_dashboard import get_app
from model_informed_greenhouse_dashboard.backend.app.adapters.cucumber import (
    CucumberAdapter,
)
from model_informed_greenhouse_dashboard.backend.app.adapters.tomato import TomatoAdapter
from model_informed_greenhouse_dashboard.backend.app.services.crop_models.cucumber_growth_model import (
    build_cucumber_snapshot,
)
from model_informed_greenhouse_dashboard.backend.app.services.crop_models.tomato_growth_model import (
    build_tomato_snapshot,
)
from model_informed_greenhouse_dashboard.backend.app.services.model_runtime.scenario_runner import (
    run_bounded_scenario,
    run_precision_ladder_scenarios,
)
from model_informed_greenhouse_dashboard.backend.app.services.model_runtime.sensitivity_engine import (
    compute_local_sensitivities,
)


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
    model.u_PAR = 920.0
    model.u_CO2 = 720.0
    model.RH = 0.81
    model.Ci = model.u_CO2 * 0.7
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
        "T_canopy_C": 24.6,
    }
    adapter._last_datetime = datetime(2026, 4, 7, 9, 0, tzinfo=UTC)
    return adapter


def _seed_tomato_adapter() -> TomatoAdapter:
    adapter = TomatoAdapter()
    model = adapter.model
    model.u_PAR = 1080.0
    model.u_CO2 = 760.0
    model.RH = 0.72
    model.Ci = model.u_CO2 * 0.7
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


def _build_snapshot_record(adapter, crop: str) -> dict:
    snapshot = (
        build_tomato_snapshot(adapter, greenhouse_id=crop)
        if crop == "tomato"
        else build_cucumber_snapshot(adapter, greenhouse_id=crop)
    )
    return {
        "snapshot_id": f"snap-{crop}",
        "greenhouse_id": crop,
        "crop": crop,
        "normalized_snapshot": snapshot,
        "raw_adapter_state": adapter.dump_state(),
        "metadata": {},
    }


def test_run_bounded_scenario_positive_co2_improves_tomato_yield() -> None:
    snapshot_record = _build_snapshot_record(_seed_tomato_adapter(), "tomato")

    baseline = run_bounded_scenario(snapshot_record, controls={}, horizons_hours=[336])
    elevated_co2 = run_bounded_scenario(
        snapshot_record,
        controls={"co2_setpoint_day": 100.0},
        horizons_hours=[336],
    )

    assert elevated_co2["outputs"][0]["yield_pred"] > baseline["outputs"][0]["yield_pred"]
    assert elevated_co2["outputs"][0]["yield_delta_vs_baseline"] > 0
    assert not any(
        violation["code"] == "trust_region_exceeded"
        for violation in elevated_co2["violated_constraints"]
    )


def test_compute_local_sensitivities_rejects_step_outside_trust_region() -> None:
    snapshot_record = _build_snapshot_record(_seed_tomato_adapter(), "tomato")

    payload = compute_local_sensitivities(
        snapshot_record,
        derivative_target="predicted_yield_14d",
        controls=["co2_setpoint_day"],
        step_overrides={"co2_setpoint_day": 200.0},
    )

    assert payload["sensitivities"][0]["valid"] is False
    assert payload["sensitivities"][0]["trust_region"]["high"] == 150.0


def test_run_precision_ladder_scenarios_tracks_requested_and_bounded_steps() -> None:
    snapshot_record = _build_snapshot_record(_seed_tomato_adapter(), "tomato")

    payload = run_precision_ladder_scenarios(
        snapshot_record,
        "co2_setpoint_day",
        [100.0, 200.0, -100.0],
        horizons_hours=[72, 336],
    )

    requested_deltas = [row["requested_delta"] for row in payload["comparisons"]]
    assert requested_deltas == [100.0, 200.0, -100.0]
    assert payload["comparisons"][0]["applied_delta"] == pytest.approx(100.0)
    assert payload["comparisons"][1]["applied_delta"] == pytest.approx(150.0)
    assert payload["comparisons"][1]["is_clamped"] is True
    assert 336 in payload["comparisons"][0]["outputs_by_horizon"]


def test_compute_local_sensitivities_exposes_precision_metadata() -> None:
    snapshot_record = _build_snapshot_record(_seed_tomato_adapter(), "tomato")

    payload = compute_local_sensitivities(
        snapshot_record,
        derivative_target="predicted_yield_14d",
        controls=["co2_setpoint_day"],
    )

    row = payload["sensitivities"][0]
    assert row["valid"] is True
    assert row["local_confidence"] > 0
    assert row["recommended_sign"] == "increase"
    assert row["nonlinearity_hint"] in {"symmetric", "mild_nonlinear", "nonlinear"}
    assert row["positive_response"] > 0


def test_model_scenario_endpoint_persists_outputs_and_violations(
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
        "/api/models/scenario",
        json={
            "crop": "cucumber",
            "controls": {
                "rh_target": 10.0,
                "screen_close": 12.0,
            },
        },
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "success"
    assert payload["scenario_id"].startswith("scn-")
    assert len(payload["outputs"]) == 3
    assert payload["outputs"][0]["output_id"].startswith("scnout-")
    assert any(
        violation["code"] == "trust_region_exceeded"
        for violation in payload["violated_constraints"]
    )


def test_model_sensitivity_endpoint_reports_positive_co2_derivative(
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
        "/api/models/sensitivity",
        json={
            "crop": "tomato",
            "target": "predicted_yield_14d",
            "controls": ["co2_setpoint_day"],
        },
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "success"
    assert len(payload["sensitivities"]) == 1
    assert payload["sensitivities"][0]["control"] == "co2_setpoint_day"
    assert payload["sensitivities"][0]["valid"] is True
    assert payload["sensitivities"][0]["direction"] == "increase"
    assert payload["sensitivities"][0]["derivative"] > 0
    assert payload["sensitivities"][0]["scenario_alignment"] is True
