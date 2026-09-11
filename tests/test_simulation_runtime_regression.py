"""Replay timeline and environmental-input regressions."""

import json

import pandas as pd
import pytest

from model_informed_greenhouse_dashboard.backend.app.adapters.cucumber import CucumberAdapter
from model_informed_greenhouse_dashboard.backend.app.adapters.tomato import TomatoAdapter
from model_informed_greenhouse_dashboard.backend.app.services.ingest import (
    BatchIngestor,
    CSVIngestor,
    EnvironmentInputError,
    normalize_environment_frame,
)
from model_informed_greenhouse_dashboard.backend.app.services.simulator import Simulator


def _row(timestamp="2026-04-03T12:00:00", **overrides):
    return {
        "datetime": timestamp,
        "T_air_C": 22.0,
        "PAR_umol": 500.0,
        "CO2_ppm": 450.0,
        "RH_percent": 70.0,
        "wind_speed_ms": 0.3,
        **overrides,
    }


def _simulator(adapter_class=TomatoAdapter, rows=None):
    return Simulator(
        adapter_class(),
        lambda *_: None,
        pd.DataFrame(rows if rows is not None else [_row()]),
        dt_hours=1 / 60,
        step_sim_duration_seconds=60.0,
    )


@pytest.mark.parametrize("quality_check", [True, False])
def test_batch_ingestion_deduplicates_before_replay_and_preserves_csv(tmp_path, quality_check):
    earlier = _row()
    later = _row("2026-04-03T12:01:00", T_air_C=23.0)
    path = tmp_path / "environment.csv"
    pd.DataFrame([later, earlier, earlier, later]).to_csv(path, index=False)
    original = path.read_bytes()

    frame = BatchIngestor(str(path), quality_check=quality_check).load()

    assert frame["datetime"].tolist() == [
        pd.Timestamp(earlier["datetime"]), pd.Timestamp(later["datetime"])
    ]
    assert frame["T_air_C"].tolist() == [22.0, 23.0]
    assert frame.attrs["deduplicated_rows"] == 2
    pd.testing.assert_frame_equal(normalize_environment_frame(frame), frame)
    assert normalize_environment_frame(frame).attrs["deduplicated_rows"] == 2
    assert path.read_bytes() == original


@pytest.mark.parametrize("streaming", [False, True])
def test_callback_ingestion_emits_each_unique_timestamp_once(tmp_path, streaming):
    path = tmp_path / "environment.csv"
    first = _row()
    second = _row("2026-04-03T12:01:00")
    pd.DataFrame([second, first, first]).to_csv(path, index=False)
    emitted = []
    ingestor = CSVIngestor(str(path), emitted.append)

    if streaming:
        ingestor.start_streaming(interval_ms=0)
    else:
        ingestor.start()

    assert [row["datetime"] for row in emitted] == [
        pd.Timestamp(first["datetime"]), pd.Timestamp(second["datetime"])
    ]


@pytest.mark.parametrize(
    ("first_overrides", "second_overrides"),
    [
        ({"T_air_C": 22.0}, {"T_air_C": 23.0}),
        # Cleaning would clip both values to the same PAR: they still conflict.
        ({"PAR_umol": 4000.0}, {"PAR_umol": 4500.0}),
        ({"CO2_ppm": None}, {"CO2_ppm": 400.0}),
        ({"n_fruits_per_truss": 4}, {"n_fruits_per_truss": 5}),
    ],
)
def test_conflicting_duplicates_are_input_errors_before_cleaning(
    tmp_path, first_overrides, second_overrides,
):
    rows = [_row(**first_overrides), _row(**second_overrides)]
    path = tmp_path / "environment.csv"
    pd.DataFrame(rows).to_csv(path, index=False)
    original = path.read_bytes()
    emitted = []

    with pytest.raises(EnvironmentInputError, match="duplicate timestamp 2026-04-03T12:00:00"):
        BatchIngestor(str(path)).load()
    with pytest.raises(EnvironmentInputError, match="duplicate timestamp"):
        CSVIngestor(str(path), emitted.append).start()
    with pytest.raises(EnvironmentInputError, match="duplicate timestamp"):
        _simulator(rows=rows)

    assert emitted == []
    assert path.read_bytes() == original


def test_duplicate_quality_provenance_is_preserved_and_conflicts_are_rejected():
    good = {"status": "ok", "source": "csv_replay", "issues": []}
    invalid = {
        "status": "invalid", "source": "csv_replay",
        "issues": [{"field": "CO2_ppm", "reason": "missing"}],
    }
    same = _row(data_quality=invalid)
    simulator = _simulator(rows=[same, same.copy()])
    assert len(simulator.df_env) == 1
    assert simulator.df_env.iloc[0]["data_quality"] == invalid
    with pytest.raises(EnvironmentInputError, match="duplicate timestamp"):
        _simulator(rows=[same, _row(data_quality=good)])


@pytest.mark.parametrize("timestamp", [None, "not-a-date"])
def test_invalid_timestamps_are_explicit_input_errors(timestamp):
    with pytest.raises(EnvironmentInputError, match="datetime"):
        _simulator(rows=[_row(timestamp)])


@pytest.mark.parametrize("adapter_class", [TomatoAdapter, CucumberAdapter])
def test_stop_resume_and_end_of_replay_consume_each_row_once(adapter_class, monkeypatch):
    rows = [
        _row("2026-04-03T23:59:00", PAR_umol=0.0),
        _row("2026-04-04T00:00:00", PAR_umol=0.0),
        _row("2026-04-04T00:02:00", PAR_umol=0.0),
    ]
    simulator = _simulator(adapter_class, rows)
    original_step = simulator.adapter.step
    states = []

    def stop_after_first(row):
        state = original_step(row)
        states.append(state)
        if len(states) == 1:
            simulator.stop()
        return state

    monkeypatch.setattr(simulator.adapter, "step", stop_after_first)
    simulator.start()
    simulator.run_all()
    assert simulator.idx == 1
    assert [row["datetime"] for row in simulator.get_future_rows(1)] == [
        pd.Timestamp(row["datetime"]) for row in rows[1:]
    ]

    simulator.start()
    simulator.run_all()
    assert simulator.idx == len(rows)
    assert [state["datetime"] for state in states] == [row["datetime"] for row in rows]
    assert [state["dt_seconds"] for state in states] == [60.0, 60.0, 120.0]
    assert all(state["simulation_status"] == "ok" for state in states)
    assert simulator.get_future_rows(1) == []
    assert simulator.step_from_index(simulator.idx) == {}

    simulator.reset()
    assert simulator.idx == 0
    assert simulator.adapter._last_datetime is None
    assert simulator.step_from_index(-1) == {}
    assert simulator.idx == 0
    assert simulator.step_from_index(simulator.idx)["state"]["dt_seconds"] == 60.0
    assert simulator.idx == 1


def test_manual_step_during_pause_does_not_replay_the_same_row(monkeypatch):
    rows = [_row(), _row("2026-04-03T12:01:00")]
    simulator = _simulator(rows=rows)
    original_step = simulator.adapter.step
    states = []

    def record_step(row):
        state = original_step(row)
        states.append(state)
        return state

    def step_and_resume(_seconds):
        simulator.step_from_index(simulator.idx)
        simulator.resume()

    monkeypatch.setattr(simulator.adapter, "step", record_step)
    monkeypatch.setattr("time.sleep", step_and_resume)
    simulator.start()
    simulator.pause()
    simulator.run_all()

    assert simulator.idx == 2
    assert [state["datetime"] for state in states] == [row["datetime"] for row in rows]
    assert [state["dt_seconds"] for state in states] == [60.0, 60.0]


def test_stop_while_paused_consumes_no_rows(monkeypatch):
    simulator = _simulator()
    monkeypatch.setattr("time.sleep", lambda _: simulator.stop())
    simulator.start()
    simulator.pause()
    simulator.run_all()

    assert simulator.idx == 0
    assert simulator.adapter._last_datetime is None


@pytest.mark.parametrize("adapter_class", [TomatoAdapter, CucumberAdapter])
@pytest.mark.parametrize("co2_ppm", [158.0, 216.0])
def test_depleted_positive_co2_reaches_native_model_without_clipping(
    tmp_path, adapter_class, co2_ppm,
):
    path = tmp_path / "environment.csv"
    pd.DataFrame([_row(CO2_ppm=co2_ppm)]).to_csv(path, index=False)
    frame = BatchIngestor(str(path)).load()
    simulator = _simulator(adapter_class, frame.to_dict("records"))

    payload = simulator.step_from_index(simulator.idx)

    assert frame.iloc[0]["CO2_ppm"] == co2_ppm
    assert payload["env"]["CO2_ppm"] == co2_ppm
    assert simulator.adapter.model.u_CO2 == co2_ppm
    assert payload["data_quality"]["status"] == "ok"
    assert payload["state"]["simulation_status"] == "ok"
    assert payload["state"]["dt_seconds"] == 60.0
    json.dumps(payload, allow_nan=False)


@pytest.mark.parametrize(
    "overrides",
    [
        {"CO2_ppm": 0.0}, {"CO2_ppm": -1.0}, {"CO2_ppm": float("nan")},
        {"CO2_ppm": float("inf")}, {"CO2_ppm": 2001.0}, {"PAR_umol": 3001.0},
    ],
)
def test_invalid_co2_and_unverified_high_par_remain_diagnostics(tmp_path, overrides):
    path = tmp_path / "environment.csv"
    pd.DataFrame([_row(**overrides)]).to_csv(path, index=False)
    frame = BatchIngestor(str(path)).load()
    simulator = _simulator(rows=frame.to_dict("records"))

    payload = simulator.step_from_index(simulator.idx)

    assert payload["data_quality"]["status"] == "invalid"
    assert payload["state"]["simulation_status"] == "invalid_input"
    assert payload["kpi"] == {}
    assert payload["irrigation"] == {}
    assert payload["energy"] == {}
    assert simulator.idx == 1
