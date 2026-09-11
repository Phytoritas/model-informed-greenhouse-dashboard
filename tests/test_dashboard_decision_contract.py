"""Regressions for replay intervals, diagnostic gating, and forecast mass basis."""

import copy
import json
from datetime import datetime
from types import SimpleNamespace

import pandas as pd
import pytest

from model_informed_greenhouse_dashboard.backend.app.adapters.cucumber import CucumberAdapter
from model_informed_greenhouse_dashboard.backend.app.adapters.tomato import TomatoAdapter
from model_informed_greenhouse_dashboard.backend.app.services import forecast
from model_informed_greenhouse_dashboard.backend.app.services.decision import DecisionSupport
from model_informed_greenhouse_dashboard.backend.app.services.ingest import BatchIngestor, CSVIngestor
from model_informed_greenhouse_dashboard.backend.app.services.simulator import Simulator


def _row(timestamp: str, **overrides) -> dict:
    return {
        "datetime": timestamp,
        "T_air_C": 22.0,
        "PAR_umol": 500.0,
        "CO2_ppm": 450.0,
        "RH_percent": 70.0,
        "wind_speed_ms": 0.3,
        **overrides,
    }


def _state(timestamp: str, fruit_dm: float = 100.0, **overrides) -> dict:
    return {
        **_row(timestamp),
        "converged": 1,
        "LAI": 2.0,
        "T_canopy_C": 23.0,
        "dt_seconds": 600.0,
        "fruit_dry_weight_g_m2": fruit_dm,
        "harvested_fruit_g_m2": 0.0,
        "transpiration_g_m2": 60.0,
        "active_trusses": 4,
        "node_count": 20,
        **overrides,
    }


class _ConstantFluxModel:
    """Known latent heat gives exactly 0.1 g m-2 s-1 transpiration."""

    def __init__(self):
        self.durations = []
        self.lambda_v = 2.45e6
        self.LE = 245.0
        self.H = 20.0
        self.LAI = 2.0
        self.T_c = 295.15
        self.convergence_status_Tc = True
        self.W_fr = 100.0
        self.W_fr_harvested = 10.0
        self.fruit_dw = 100.0
        self.remaining_leaves = 15

    def run_timestep_calculations(self, duration, timestamp):
        self.dt_seconds = duration
        self.durations.append(duration)

    def calculate_canopy_photosynthesis(self, temperature):
        return 10.0, 0.0, 0.002


def _simulator(adapter_class, rows, **kwargs):
    adapter = adapter_class(area_m2=1000.0)
    adapter.model = _ConstantFluxModel()
    simulator = Simulator(
        adapter,
        lambda *_: None,
        pd.DataFrame(rows),
        dt_hours=1 / 6,
        step_sim_duration_seconds=600.0,
        **kwargs,
    )
    return simulator, adapter


@pytest.mark.parametrize("adapter_class", [TomatoAdapter, CucumberAdapter])
def test_transpiration_integrates_actual_intervals_once_across_midnight(adapter_class):
    rows = [
        _row("2026-04-03T23:40:00"),
        _row("2026-04-03T23:50:00"),
        _row("2026-04-04T00:10:00"),
    ]
    simulator, adapter = _simulator(adapter_class, rows)
    ticks = [simulator.step(row) for row in rows]

    assert adapter.model.durations == [600.0, 600.0, 1200.0]
    assert [tick["kpi"]["transpiration_mm_h"] for tick in ticks] == pytest.approx([0.36] * 3)
    expected_mm = sum(tick["flux"]["transpiration_mm"] for tick in ticks)
    assert expected_mm == pytest.approx(0.24)
    assert adapter._cumulative["total_transpiration_mm"] == pytest.approx(expected_mm)
    assert ticks[-1]["kpi"]["previous_day_transpiration_mm"] == pytest.approx(0.12)
    assert ticks[-1]["kpi"]["daily_transpiration_mm"] == pytest.approx(0.12)


@pytest.mark.parametrize("adapter_class", [TomatoAdapter, CucumberAdapter])
def test_failed_model_does_not_update_advisors_or_prescribe_crop_actions(adapter_class):
    row = _row("2026-04-03T12:00:00")
    calls = []
    simulator, adapter = _simulator(
        adapter_class, [row],
        irrigation_advisor=SimpleNamespace(update_step=lambda *args: calls.append("irrigation")),
        energy_estimator=SimpleNamespace(estimate_step=lambda **kwargs: calls.append("energy")),
        greenhouse_config={"operations": {}},
    )
    adapter.model.convergence_status_Tc = False
    payload = simulator.step(row)
    recommendations = DecisionSupport(adapter.name).get_recommendations(
        payload["kpi"], payload["state"], payload["irrigation"], payload["energy"], payload["env"]
    )

    assert calls == []
    assert payload["state"]["simulation_status"] == "unconverged"
    assert payload["kpi"] == {}
    assert [item["action"] for item in recommendations] == ["verify_inputs"]
    assert adapter._cumulative["total_transpiration_mm"] == 0


def test_ingestion_preserves_raw_csv_and_missing_value_quality(tmp_path):
    path = tmp_path / "environment.csv"
    raw = (
        "datetime,T_air_C,PAR_umol,CO2_ppm,RH_percent\n"
        "2026-04-03T12:00:00,not-a-number,500,450,140\n"
    ).encode("utf-8")
    path.write_bytes(raw)
    row = BatchIngestor(str(path)).load().iloc[0].to_dict()
    ingestor = CSVIngestor(str(path), lambda _: None)
    second_clean = ingestor._validate_and_clean(row)

    assert path.read_bytes() == raw
    assert row["T_air_C"] == 20
    assert row["RH_percent"] == 100
    assert row["wind_speed_ms"] == 0.3
    assert row["data_quality"] == second_clean["data_quality"]
    assert {issue["field"] for issue in row["data_quality"]["issues"]} == {
        "T_air_C", "RH_percent", "wind_speed_ms"
    }
    simulator, adapter = _simulator(TomatoAdapter, [row])
    payload = simulator.step(row)
    assert adapter.model.durations == []
    assert payload["state"]["simulation_status"] == "invalid_input"
    assert payload["data_quality"]["status"] == "invalid"
    recommendations = DecisionSupport("tomato").get_recommendations(
        payload["kpi"], payload["state"], {}, {}, payload["env"]
    )
    assert [item["action"] for item in recommendations] == ["verify_inputs"]
    json.dumps(payload, allow_nan=False, default=str)


@pytest.mark.parametrize("defect", ["failed", "missing", "non_finite"])
def test_invalid_data_never_becomes_a_zero_based_crop_prescription(defect):
    state = _state("2026-04-03T12:00:00")
    inputs = _row(state["datetime"])
    if defect == "failed":
        state["converged"] = 0
    elif defect == "missing":
        inputs["RH_percent"] = None
    else:
        inputs["T_air_C"] = float("nan")
    decision = DecisionSupport("tomato")
    decision._start_dt = datetime(2026, 3, 1)
    recs = decision.get_recommendations(
        {"epsilon": 0.0, "active_trusses": 8, "daily_harvest_kg": 10.0},
        state, {}, {}, inputs,
    )
    assert [item["action"] for item in recs] == ["verify_inputs"]
    assert all(recs[0][key] for key in ("reason", "check_after", "expected_response", "source"))


def test_valid_demo_signals_produce_prioritized_review_without_dry_mass_revenue():
    state = _state("2026-04-03T12:00:00")
    decision = DecisionSupport("tomato")
    decision._start_dt = datetime(2026, 3, 1)
    recs = decision.get_recommendations(
        {"epsilon": 0.1, "active_trusses": 10, "daily_harvest_kg": 100, "harvest_basis": "dry_matter"},
        state, {"ETc_mm_day": 6.0}, {"daily_kWh": 200.0},
        _row(state["datetime"], T_air_C=35.0, RH_percent=20.0),
    )
    assert len(recs) == 3
    assert all(item["category"] not in {"data_quality", "financial", "harvest"} for item in recs)
    assert not {item["action"] for item in recs} & {"decrease_fruits", "increase_fruits", "harvest_now"}
    assert all(item[key] for item in recs for key in ("reason", "check_after", "expected_response", "source"))


@pytest.mark.parametrize("outside", [7.0, None])
def test_energy_uses_actual_interval_and_labels_outdoor_temperature_assumption(outside):
    rows = [_row("2026-04-03T12:00:00"), _row("2026-04-03T12:20:00")]
    if outside is not None:
        rows = [{**row, "T_out_C": outside} for row in rows]
    estimates = []

    def estimate_step(**kwargs):
        estimates.append(kwargs)
        return {"daily_kWh": 2.0}

    simulator, _ = _simulator(
        TomatoAdapter, rows,
        energy_estimator=SimpleNamespace(estimate_step=estimate_step),
        greenhouse_config={"operations": {}},
    )
    ticks = [simulator.step(row) for row in rows]
    assert [call["dt_hours"] for call in estimates] == pytest.approx([1 / 6, 1 / 3])
    assert estimates[-1]["setpoints"]["T_out_C"] == (7.0 if outside is not None else 17.0)
    energy = ticks[-1]["energy"]
    assert energy["T_out_C_source"] == ("csv_replay" if outside is not None else "assumed_indoor_minus_5C")
    assert bool(energy["assumptions"]) is (outside is None)


def _forecast_from_outputs(monkeypatch, crop, initial, outputs, *, input_rows=None, interval=1):
    seen = []

    class StubAdapter:
        def __init__(self, area_m2):
            pass

        def load_state(self, state):
            pass

        def configure(self, config):
            pass

        def run_batch(self, rows):
            seen.extend(rows)
            return outputs

    monkeypatch.setattr(forecast, "TomatoAdapter" if crop == "tomato" else "CucumberAdapter", StubAdapter)
    snapshot = {
        "_adapter_meta": {"last_datetime": initial["datetime"], "last_state": initial},
    }
    rows = input_rows if input_rows is not None else [_row(state["datetime"]) for state in outputs]
    result = forecast._branch_worker(crop, snapshot, {}, rows, 1000.0, interval)
    return result, seen


@pytest.mark.parametrize("crop", ["tomato", "cucumber"])
def test_forecast_keeps_fruit_dry_growth_distinct_from_unknown_fresh_harvest_and_energy(monkeypatch, crop):
    initial = _state("2026-04-03T11:50:00", 100.0)
    outputs = [_state("2026-04-03T12:00:00", 110.0), _state("2026-04-03T12:10:00", 200.0)]
    result, _ = _forecast_from_outputs(monkeypatch, crop, initial, outputs)

    assert result["total_fruit_growth_dry_kg"] == pytest.approx(100.0)
    assert result["daily"][0]["fruit_growth_dry_kg"] == pytest.approx(100.0)
    assert result["total_harvest_kg"] is None
    assert result["daily"][0]["harvest_kg"] is None
    assert result["total_energy_kWh"] is None
    assert result["daily"][0]["energy_kWh"] is None
    assert result["harvest_basis"] == "fresh_mass_unavailable"
    assert result["fruit_growth_basis"] == "dry_matter"
    assert result["energy_basis"] == "not_estimated"
    assert result["total_ETc_mm"] == pytest.approx(0.12)


def test_tomato_forecast_accounts_for_harvest_transfer_without_counting_it_as_new_growth(monkeypatch):
    initial = _state("2026-04-03T23:50:00", 100.0, harvested_fruit_g_m2=20.0)
    outputs = [
        _state("2026-04-04T00:00:00", 110.0, harvested_fruit_g_m2=20.0),
        _state("2026-04-04T00:10:00", 50.0, harvested_fruit_g_m2=90.0),
        _state("2026-04-05T00:00:00", 80.0, harvested_fruit_g_m2=90.0),
    ]
    result, _ = _forecast_from_outputs(monkeypatch, "tomato", initial, outputs)
    assert [day["fruit_growth_dry_kg"] for day in result["daily"]] == pytest.approx([20.0, 30.0])
    assert result["total_fruit_growth_dry_kg"] == pytest.approx(50.0)
    assert result["total_harvested_fruit_dry_kg"] == pytest.approx(70.0)
    assert result["total_harvest_kg"] is None


def test_forecast_does_not_hide_invalid_rows_when_sampling(monkeypatch):
    initial = _state("2026-04-03T11:50:00")
    rows = [
        _row("2026-04-03T12:00:00"),
        _row("2026-04-03T12:10:00", RH_percent=None),
        _row("2026-04-03T12:20:00"),
    ]
    outputs = [_state(rows[0]["datetime"], 110.0), _state(rows[-1]["datetime"], 120.0)]
    result, _ = _forecast_from_outputs(monkeypatch, "cucumber", initial, outputs, input_rows=rows, interval=2)
    assert result["data_quality"]["status"] == "invalid"
    assert result["total_fruit_growth_dry_kg"] is None
    assert result["total_ETc_mm"] is None
    assert result["daily"][0]["fruit_growth_dry_kg"] is None


def test_empty_forecast_keeps_unestimated_metrics_unknown(monkeypatch):
    result, _ = _forecast_from_outputs(monkeypatch, "cucumber", _state("2026-04-03T12:00:00"), [])
    assert result["daily"] == []
    assert result["total_harvest_kg"] is None
    assert result["total_energy_kWh"] is None
    assert result["total_fruit_growth_dry_kg"] is None


def test_future_rows_use_timestamps_and_exclude_the_already_consumed_row():
    rows = [_row(stamp.isoformat()) for stamp in pd.date_range("2026-04-03T12:00:00", periods=9, freq="20min")]
    frame = pd.DataFrame(rows)
    frame["datetime"] = pd.to_datetime(frame["datetime"])
    adapter = SimpleNamespace(_last_datetime=frame.iloc[0]["datetime"])
    simulator = Simulator(adapter, lambda *_: None, frame, dt_hours=1 / 3)
    future = simulator.get_future_rows(hours=1)
    assert [row["datetime"] for row in future] == list(frame.iloc[1:4]["datetime"])


@pytest.mark.parametrize("adapter_class", [TomatoAdapter, CucumberAdapter])
def test_loading_forecast_snapshot_does_not_consume_the_callers_metadata(adapter_class):
    adapter = adapter_class(area_m2=1000.0)
    snapshot = adapter.dump_state()
    metadata = copy.deepcopy(snapshot["_adapter_meta"])
    adapter.load_state(snapshot)
    assert snapshot["_adapter_meta"] == metadata


def test_nullable_forecast_snapshot_is_broadcast_without_numeric_formatting_failure():
    future = forecast.Future()
    future.set_result({
        "daily": [], "total_harvest_kg": None, "total_energy_kWh": None,
        "total_ETc_mm": None, "total_fruit_growth_dry_kg": None,
    })
    broadcasts = []
    forecaster = forecast.BranchForecaster(lambda path, payload: broadcasts.append(payload))
    forecaster._on_done(future)
    assert broadcasts[0]["type"] == "forecast.snapshot"
    assert broadcasts[0]["total_harvest_kg"] is None
