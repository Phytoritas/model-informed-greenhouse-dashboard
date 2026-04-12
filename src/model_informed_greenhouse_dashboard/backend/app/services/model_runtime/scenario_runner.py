"""Bounded counterfactual scenario simulation for the SmartGrow runtime seam."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Mapping

from .constraint_engine import (
    CONTROL_SPECS,
    clamp_control_delta,
    evaluate_constraints,
    normalize_control_deltas,
)


DEFAULT_SCENARIO_HORIZONS_HOURS = (24, 72, 336)


@dataclass(frozen=True)
class RuntimeInputs:
    """Normalized snapshot-derived inputs used by phase-2 scenario logic."""

    crop: str
    greenhouse_id: str
    snapshot_id: str | None
    source_capacity: float
    sink_demand: float
    fruit_dry_matter_g_m2: float
    harvested_fruit_dry_matter_g_m2: float
    lai: float
    fruit_load: float
    canopy_assimilation: float
    transpiration_proxy: float
    respiration: float
    canopy_temperature_c: float
    rh_fraction: float
    ambient_co2_ppm: float
    upper_leaf_activity: float
    middle_leaf_activity: float
    bottom_leaf_activity: float
    limiting_factor: str
    source_sink_balance: float
    missing_inputs: tuple[str, ...]


def _clamp(value: float, low: float, high: float) -> float:
    return max(low, min(high, value))


def _safe_float(value: Any, default: float = 0.0) -> float:
    try:
        if value is None:
            return default
        return float(value)
    except (TypeError, ValueError):
        return default


def _rounded_output(payload: Mapping[str, Any]) -> dict[str, Any]:
    rounded: dict[str, Any] = {}
    for key, value in payload.items():
        if isinstance(value, float):
            rounded[key] = round(value, 6)
        else:
            rounded[key] = value
    return rounded


def extract_runtime_inputs(snapshot_record: Mapping[str, Any]) -> RuntimeInputs:
    normalized_snapshot = snapshot_record.get("normalized_snapshot", snapshot_record)
    state = normalized_snapshot.get("state", {})
    gas_exchange = normalized_snapshot.get("gas_exchange", {})
    live_observation = normalized_snapshot.get("live_observation", {})
    raw_adapter_state = snapshot_record.get("raw_adapter_state", {})

    missing_inputs: list[str] = []

    def _resolve(required_name: str, *candidates: Any, default: float = 0.0) -> float:
        for candidate in candidates:
            if candidate is None:
                continue
            try:
                return float(candidate)
            except (TypeError, ValueError):
                continue
        missing_inputs.append(required_name)
        return default

    crop = str(snapshot_record.get("crop") or normalized_snapshot.get("crop") or "")
    greenhouse_id = str(
        snapshot_record.get("greenhouse_id") or normalized_snapshot.get("greenhouse_id") or crop
    )
    snapshot_id = snapshot_record.get("snapshot_id")

    source_capacity = max(
        0.0,
        _resolve(
        "source_capacity",
        state.get("source_capacity"),
        gas_exchange.get("canopy_gross_assimilation_umol_m2_s"),
        default=0.0,
        ),
    )
    canopy_assimilation = _resolve(
        "canopy_assimilation",
        gas_exchange.get("canopy_net_assimilation_umol_m2_s"),
        source_capacity * 0.72,
        default=0.0,
    )
    sink_demand = max(0.0, _resolve("sink_demand", state.get("sink_demand"), default=0.0))
    fruit_dry_matter_g_m2 = _resolve("fruit_dry_matter", state.get("fruit_dry_matter_g_m2"), default=0.0)
    harvested_fruit_dry_matter_g_m2 = _resolve(
        "harvested_fruit_dry_matter",
        state.get("harvested_fruit_dry_matter_g_m2"),
        default=0.0,
    )
    lai = _resolve("lai", state.get("lai"), default=0.0)
    fruit_load = _resolve("fruit_load", state.get("fruit_load"), default=0.0)
    transpiration_proxy = _resolve(
        "transpiration_proxy",
        gas_exchange.get("canopy_transpiration_proxy"),
        live_observation.get("transpiration_g_m2"),
        default=0.0,
    )
    canopy_temperature_c = _resolve(
        "canopy_temperature_c",
        live_observation.get("canopy_temperature_c"),
        raw_adapter_state.get("T_c"),
        default=24.0,
    )
    if canopy_temperature_c > 100.0:
        canopy_temperature_c -= 273.15

    rh_fraction = _resolve("rh_fraction", raw_adapter_state.get("RH"), default=0.7)
    if rh_fraction > 1.0:
        rh_fraction /= 100.0
    ambient_co2_ppm = _resolve("ambient_co2_ppm", raw_adapter_state.get("u_CO2"), default=700.0)
    upper_leaf_activity = _resolve("upper_leaf_activity", state.get("upper_leaf_activity"), default=0.4)
    middle_leaf_activity = _resolve("middle_leaf_activity", state.get("middle_leaf_activity"), default=0.3)
    bottom_leaf_activity = _resolve("bottom_leaf_activity", state.get("bottom_leaf_activity"), default=0.2)
    limiting_factor = str(state.get("limiting_factor") or gas_exchange.get("limiting_factor") or "rubisco")

    respiration = max(0.0, source_capacity - canopy_assimilation)
    source_sink_balance = (
        (source_capacity - sink_demand) / max(1.0, source_capacity + sink_demand)
        if source_capacity > 0 or sink_demand > 0
        else 0.0
    )
    source_sink_balance = _clamp(source_sink_balance, -1.0, 1.0)

    return RuntimeInputs(
        crop=crop,
        greenhouse_id=greenhouse_id,
        snapshot_id=None if snapshot_id is None else str(snapshot_id),
        source_capacity=source_capacity,
        sink_demand=sink_demand,
        fruit_dry_matter_g_m2=fruit_dry_matter_g_m2,
        harvested_fruit_dry_matter_g_m2=harvested_fruit_dry_matter_g_m2,
        lai=lai,
        fruit_load=fruit_load,
        canopy_assimilation=canopy_assimilation,
        transpiration_proxy=transpiration_proxy,
        respiration=respiration,
        canopy_temperature_c=canopy_temperature_c,
        rh_fraction=rh_fraction,
        ambient_co2_ppm=ambient_co2_ppm,
        upper_leaf_activity=upper_leaf_activity,
        middle_leaf_activity=middle_leaf_activity,
        bottom_leaf_activity=bottom_leaf_activity,
        limiting_factor=limiting_factor,
        source_sink_balance=source_sink_balance,
        missing_inputs=tuple(dict.fromkeys(missing_inputs)),
    )


def _compute_effects(
    *,
    inputs: RuntimeInputs,
    controls: Mapping[str, float],
) -> dict[str, float]:
    co2_delta = _safe_float(controls.get("co2_setpoint_day"))
    temp_day_delta = _safe_float(controls.get("temperature_day"))
    temp_night_delta = _safe_float(controls.get("temperature_night"))
    rh_delta = _safe_float(controls.get("rh_target"))
    screen_delta = _safe_float(controls.get("screen_close"))

    co2_n = co2_delta / max(CONTROL_SPECS["co2_setpoint_day"].trust_region_high, 1e-9)
    temp_day_n = temp_day_delta / max(CONTROL_SPECS["temperature_day"].trust_region_high, 1e-9)
    temp_night_n = temp_night_delta / max(CONTROL_SPECS["temperature_night"].trust_region_high, 1e-9)
    rh_n = rh_delta / max(CONTROL_SPECS["rh_target"].trust_region_high, 1e-9)
    screen_n = screen_delta / max(CONTROL_SPECS["screen_close"].trust_region_high, 1e-9)

    crop_temperature_optimum = 24.5 if inputs.crop == "tomato" else 25.5
    temperature_gap = _clamp((crop_temperature_optimum - inputs.canopy_temperature_c) / 4.0, -1.0, 1.0)
    sink_pressure = _clamp(
        (inputs.sink_demand - inputs.source_capacity) / max(1.0, inputs.source_capacity),
        -1.0,
        1.0,
    )
    limiting_multiplier = 1.12 if inputs.limiting_factor == "rubisco" else 0.9
    rh_result = inputs.rh_fraction + (rh_delta / 100.0)
    rh_distance_before = abs(inputs.rh_fraction - 0.72)
    rh_distance_after = abs(rh_result - 0.72)
    rh_recovery = _clamp((rh_distance_before - rh_distance_after) / 0.18, -1.0, 1.0)
    heat_relief = _clamp((inputs.canopy_temperature_c - 28.0) / 6.0, 0.0, 1.0)
    co2_target_ppm = max(300.0, inputs.ambient_co2_ppm + co2_delta)
    co2_saturation = _clamp((co2_target_ppm - 700.0) / 300.0, 0.0, 1.0)
    co2_effective_n = co2_n * (1.0 - (0.55 * co2_saturation))
    co2_high_risk_threshold = 900.0 if inputs.crop == "tomato" else 950.0
    co2_high_risk = _clamp((co2_target_ppm - co2_high_risk_threshold) / 180.0, 0.0, 1.0)

    canopy_a_delta = 0.0
    yield_rate_delta = 0.0
    balance_delta = 0.0
    transpiration_delta = 0.0
    respiration_delta = 0.0
    energy_rate_delta = 0.0
    rtr_delta = 0.0

    canopy_a_delta += inputs.source_capacity * 0.12 * co2_effective_n * limiting_multiplier * (
        0.7 + (0.3 * inputs.upper_leaf_activity)
    )
    yield_rate_delta += inputs.fruit_load * 0.18 * co2_effective_n * (0.55 + max(0.0, sink_pressure))
    balance_delta += 0.14 * co2_effective_n
    transpiration_delta -= inputs.transpiration_proxy * 0.05 * co2_effective_n
    energy_rate_delta += abs(co2_n) * 0.12
    energy_rate_delta += 0.1 * co2_high_risk
    canopy_a_delta -= inputs.source_capacity * 0.06 * co2_high_risk
    yield_rate_delta -= inputs.fruit_load * 0.08 * co2_high_risk
    balance_delta -= 0.08 * co2_high_risk
    rtr_delta += 0.01 * co2_effective_n

    canopy_a_delta += inputs.source_capacity * 0.08 * temp_day_n * temperature_gap * (
        0.6 + (0.4 * inputs.middle_leaf_activity)
    )
    yield_rate_delta += inputs.fruit_load * 0.14 * temp_day_n * temperature_gap
    balance_delta += 0.08 * temp_day_n * (0.5 + max(0.0, sink_pressure))
    transpiration_delta += inputs.transpiration_proxy * 0.1 * temp_day_n
    respiration_delta += inputs.respiration * 0.03 * temp_day_n
    energy_rate_delta += 0.32 * max(0.0, temp_day_n) - (0.12 * max(0.0, -temp_day_n))
    rtr_delta += 0.035 * temp_day_n

    canopy_a_delta += inputs.source_capacity * 0.03 * temp_night_n * max(0.0, sink_pressure)
    yield_rate_delta += inputs.fruit_load * (
        (0.16 * temp_night_n * max(0.0, sink_pressure))
        - (0.08 * temp_night_n * max(0.0, -sink_pressure))
    )
    balance_delta += (0.12 * temp_night_n * max(0.0, sink_pressure)) - (
        0.07 * temp_night_n * max(0.0, -sink_pressure)
    )
    respiration_delta += inputs.respiration * 0.08 * temp_night_n
    energy_rate_delta += 0.28 * max(0.0, temp_night_n)
    rtr_delta += 0.05 * temp_night_n

    canopy_a_delta += inputs.source_capacity * 0.05 * rh_recovery
    yield_rate_delta += inputs.fruit_load * 0.1 * rh_recovery
    balance_delta += 0.06 * rh_recovery
    transpiration_delta -= inputs.transpiration_proxy * 0.18 * rh_n
    energy_rate_delta += 0.04 * abs(rh_n)
    rtr_delta += 0.012 * rh_recovery

    screen_factor = (-0.11 * (0.65 + (0.35 * inputs.upper_leaf_activity))) + (0.06 * heat_relief)
    canopy_a_delta += inputs.source_capacity * screen_factor * screen_n
    yield_rate_delta += inputs.fruit_load * 0.12 * screen_factor * screen_n
    balance_delta += 0.05 * screen_factor * screen_n
    transpiration_delta -= inputs.transpiration_proxy * 0.12 * screen_n
    energy_rate_delta -= 0.18 * max(0.0, screen_n)
    rtr_delta -= 0.015 * screen_n

    return {
        "canopy_a_delta": canopy_a_delta,
        "yield_rate_delta": yield_rate_delta,
        "balance_delta": balance_delta,
        "transpiration_delta": transpiration_delta,
        "respiration_delta": respiration_delta,
        "energy_rate_delta": energy_rate_delta,
        "rtr_delta": rtr_delta,
    }


def _project_output_row(
    *,
    inputs: RuntimeInputs,
    effects: Mapping[str, float],
    horizon_hours: int,
    constraint_violations: list[dict[str, str]],
    confidence_score: float,
) -> dict[str, Any]:
    horizon_days = horizon_hours / 24.0
    base_yield_rate = max(
        0.0,
        (0.06 * inputs.canopy_assimilation)
        + (0.21 * inputs.fruit_load)
        + (0.003 * inputs.fruit_dry_matter_g_m2)
        + (0.9 * max(0.0, inputs.source_sink_balance)),
    )
    canopy_a_pred = max(0.0, inputs.canopy_assimilation + effects["canopy_a_delta"])
    respiration_pred = max(0.0, inputs.respiration + effects["respiration_delta"])
    transpiration_pred = max(0.0, inputs.transpiration_proxy + effects["transpiration_delta"])
    source_sink_balance_score = _clamp(
        inputs.source_sink_balance + effects["balance_delta"],
        -1.0,
        1.0,
    )
    yield_rate_pred = max(
        0.0,
        base_yield_rate
        + effects["yield_rate_delta"]
        + (0.035 * canopy_a_pred)
        + (0.55 * max(0.0, source_sink_balance_score)),
    )
    yield_pred = max(0.0, yield_rate_pred * horizon_days)
    fruit_dm_pred = max(
        0.0,
        inputs.fruit_dry_matter_g_m2 + ((0.52 * yield_rate_pred) + (0.08 * canopy_a_pred)) * horizon_days,
    )
    lai_pred = max(
        0.1,
        inputs.lai
        + horizon_days
        * (
            (0.018 * max(0.0, source_sink_balance_score))
            + (0.01 * inputs.upper_leaf_activity)
            - (0.008 * max(0.0, -source_sink_balance_score))
        ),
    )
    energy_cost_pred = max(
        0.0,
        horizon_days * (0.75 + max(0.0, effects["energy_rate_delta"])),
    )
    rtr_pred = _clamp(
        0.18 + (0.16 * inputs.source_sink_balance) + effects["rtr_delta"],
        -1.0,
        1.0,
    )

    return _rounded_output(
        {
            "horizon_hours": int(horizon_hours),
            "yield_pred": yield_pred,
            "fruit_dm_pred": fruit_dm_pred,
            "lai_pred": lai_pred,
            "transpiration_pred": transpiration_pred,
            "canopy_A_pred": canopy_a_pred,
            "respiration_pred": respiration_pred,
            "energy_cost_pred": energy_cost_pred,
            "rtr_pred": rtr_pred,
            "source_sink_balance_score": source_sink_balance_score,
            "constraint_violations": constraint_violations,
            "confidence_score": confidence_score,
        }
    )


def run_bounded_scenario(
    snapshot_record: Mapping[str, Any],
    *,
    controls: Mapping[str, Any] | None = None,
    horizons_hours: list[int] | tuple[int, ...] | None = None,
) -> dict[str, Any]:
    """Run a bounded counterfactual scenario over a stored or live snapshot record."""
    normalized_controls = normalize_control_deltas(controls)
    inputs = extract_runtime_inputs(snapshot_record)
    horizons = [
        int(horizon)
        for horizon in (horizons_hours or DEFAULT_SCENARIO_HORIZONS_HOURS)
        if int(horizon) > 0
    ]
    if not horizons:
        raise ValueError("At least one positive scenario horizon is required.")

    constraint_eval = evaluate_constraints(
        runtime_inputs={
            "canopy_temperature_c": inputs.canopy_temperature_c,
            "rh_fraction": inputs.rh_fraction,
            "source_sink_balance": inputs.source_sink_balance,
            "ambient_co2_ppm": inputs.ambient_co2_ppm,
            "upper_leaf_activity": inputs.upper_leaf_activity,
            "bottom_leaf_activity": inputs.bottom_leaf_activity,
            "missing_inputs": list(inputs.missing_inputs),
        },
        controls=normalized_controls,
    )
    effects = _compute_effects(inputs=inputs, controls=normalized_controls)
    confidence_score = _clamp(
        0.86
        - constraint_eval.disease_risk_penalty * 0.28
        - constraint_eval.stress_penalty * 0.26
        - constraint_eval.confidence_penalty,
        0.05,
        0.95,
    )

    baseline_outputs = {
        int(horizon): _project_output_row(
            inputs=inputs,
            effects={
                "canopy_a_delta": 0.0,
                "yield_rate_delta": 0.0,
                "balance_delta": 0.0,
                "transpiration_delta": 0.0,
                "respiration_delta": 0.0,
                "energy_rate_delta": 0.0,
                "rtr_delta": 0.0,
            },
            horizon_hours=int(horizon),
            constraint_violations=[],
            confidence_score=_clamp(0.9 - (len(inputs.missing_inputs) * 0.03), 0.2, 0.95),
        )
        for horizon in horizons
    }

    scenario_outputs: list[dict[str, Any]] = []
    violation_payload = [violation.as_dict() for violation in constraint_eval.violations]
    for horizon in horizons:
        row = _project_output_row(
            inputs=inputs,
            effects=effects,
            horizon_hours=int(horizon),
            constraint_violations=violation_payload,
            confidence_score=round(confidence_score, 6),
        )
        baseline_row = baseline_outputs[int(horizon)]
        row["yield_delta_vs_baseline"] = round(row["yield_pred"] - baseline_row["yield_pred"], 6)
        row["energy_delta_vs_baseline"] = round(
            row["energy_cost_pred"] - baseline_row["energy_cost_pred"],
            6,
        )
        row["source_sink_balance_delta"] = round(
            row["source_sink_balance_score"] - baseline_row["source_sink_balance_score"],
            6,
        )
        scenario_outputs.append(row)

    return {
        "crop": inputs.crop,
        "greenhouse_id": inputs.greenhouse_id,
        "snapshot_id": inputs.snapshot_id,
        "controls": normalized_controls,
        "baseline_outputs": [baseline_outputs[int(horizon)] for horizon in horizons],
        "outputs": scenario_outputs,
        "violated_constraints": violation_payload,
        "confidence": round(confidence_score, 6),
        "penalties": constraint_eval.as_dict(),
        "runtime_inputs": {
            "source_capacity": round(inputs.source_capacity, 6),
            "sink_demand": round(inputs.sink_demand, 6),
            "source_sink_balance": round(inputs.source_sink_balance, 6),
            "limiting_factor": inputs.limiting_factor,
            "missing_inputs": list(inputs.missing_inputs),
        },
    }


def run_precision_ladder_scenarios(
    snapshot_record: Mapping[str, Any],
    control_name: str,
    step_values: list[float] | tuple[float, ...],
    *,
    horizons_hours: list[int] | tuple[int, ...] | None = None,
) -> dict[str, Any]:
    if control_name not in CONTROL_SPECS:
        raise ValueError(f"Unknown control variable: {control_name}")

    spec = CONTROL_SPECS[control_name]
    requested_steps = [
        round(float(step_value), 6)
        for step_value in step_values
        if abs(float(step_value)) > 0
    ]
    if not requested_steps:
        raise ValueError("At least one non-zero precision ladder step is required.")

    horizons = list(horizons_hours or DEFAULT_SCENARIO_HORIZONS_HOURS)
    baseline_payload = run_bounded_scenario(
        snapshot_record,
        controls={},
        horizons_hours=horizons,
    )
    baseline_by_horizon = {
        int(row["horizon_hours"]): row
        for row in baseline_payload.get("baseline_outputs", [])
    }

    comparisons: list[dict[str, Any]] = []
    for requested_delta in requested_steps:
        applied_delta = clamp_control_delta(control_name, requested_delta)
        scenario_payload = run_bounded_scenario(
            snapshot_record,
            controls={control_name: applied_delta},
            horizons_hours=horizons,
        )
        outputs_by_horizon = {
            int(row["horizon_hours"]): row
            for row in scenario_payload.get("outputs", [])
        }
        comparisons.append(
            {
                "control": control_name,
                "label": spec.ui_label,
                "unit": spec.unit,
                "requested_delta": requested_delta,
                "applied_delta": applied_delta,
                "bounded_delta": applied_delta,
                "is_clamped": abs(applied_delta - requested_delta) > 1e-9,
                "confidence": float(scenario_payload.get("confidence", 0.0)),
                "violated_constraints": list(scenario_payload.get("violated_constraints", [])),
                "penalties": dict(scenario_payload.get("penalties", {})),
                "outputs_by_horizon": outputs_by_horizon,
                "baseline_by_horizon": baseline_by_horizon,
                "scenario": scenario_payload,
            }
        )

    return {
        "control": control_name,
        "label": spec.ui_label,
        "unit": spec.unit,
        "baseline": baseline_payload,
        "baseline_by_horizon": baseline_by_horizon,
        "comparisons": comparisons,
    }
