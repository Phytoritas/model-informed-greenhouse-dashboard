"""Objective-term decomposition for internal-model-driven RTR optimization."""

from __future__ import annotations

import copy
from typing import Any, Mapping

from ..model_runtime.constraint_engine import evaluate_constraints
from .controller_contract import RTROptimizationInputs, horizon_hours
from .internal_model_bridge import InternalModelContext
from .node_target_engine import build_node_target_summary


def _respiration_to_umol(respiration_g_ch2o_s: float) -> float:
    return max(0.0, respiration_g_ch2o_s) / 30.03 * 1_000_000.0


def _evaluate_leaf_exchange(
    *,
    context: InternalModelContext,
    air_temp_c: float,
    canopy_temp_c: float,
    co2_ppm: float,
    rh_fraction: float,
) -> dict[str, float]:
    model = copy.deepcopy(context.adapter.model)
    model.T_a = air_temp_c + 273.15
    model.T_c = canopy_temp_c + 273.15
    model.u_CO2 = co2_ppm
    model.Ci = co2_ppm * 0.7
    model.RH = rh_fraction

    gross_assim, _, stomatal_conductance = model.calculate_canopy_photosynthesis(model.T_c)
    respiration_g_s = model.calculate_instantaneous_respiration(model.T_c)
    respiration_umol = _respiration_to_umol(respiration_g_s)
    net_assim = max(0.0, gross_assim - respiration_umol)
    return {
        "gross_assim_umol_m2_s": float(gross_assim),
        "net_assim_umol_m2_s": float(net_assim),
        "respiration_umol_m2_s": float(respiration_umol),
        "stomatal_conductance_m_s": float(max(0.0, stomatal_conductance)),
    }


def _sink_overload_penalty(context: InternalModelContext, carbon_margin_proxy: float) -> float:
    growth = context.canonical_state["growth"]
    crop_specific = context.canonical_state["crop_specific"]
    if context.canonical_state["crop"] == "cucumber":
        remaining_leaves = max(
            1.0,
            float(crop_specific["cucumber"].get("remaining_leaves") or 1.0),
        )
        fruit_pressure = float(growth.get("fruit_load") or 0.0) / remaining_leaves
        return max(0.0, fruit_pressure - max(0.0, carbon_margin_proxy))

    active_trusses = max(
        1.0,
        float(crop_specific["tomato"].get("active_trusses") or 1.0),
    )
    fruit_pressure = float(growth.get("fruit_load") or 0.0) / active_trusses
    partition_ratio = float(crop_specific["tomato"].get("fruit_partition_ratio") or 0.0)
    return max(0.0, fruit_pressure * (0.5 + partition_ratio) - max(0.0, carbon_margin_proxy))


def _labor_pressure(
    *,
    context: InternalModelContext,
    predicted_rate_day: float,
    observed_rate_day: float,
) -> dict[str, float]:
    growth = context.canonical_state["growth"]
    crop_specific = context.canonical_state["crop_specific"]
    node_gain = max(0.0, predicted_rate_day - observed_rate_day)
    fruit_load = float(growth.get("fruit_load") or 0.0)
    if context.canonical_state["crop"] == "cucumber":
        remaining_leaves = max(
            1.0,
            float(crop_specific["cucumber"].get("remaining_leaves") or 1.0),
        )
        pruning_pressure = node_gain * (fruit_load / remaining_leaves)
        harvest_pressure = node_gain * max(0.2, fruit_load / 20.0)
    else:
        active_trusses = max(
            1.0,
            float(crop_specific["tomato"].get("active_trusses") or 1.0),
        )
        pruning_pressure = node_gain * (fruit_load / active_trusses)
        harvest_pressure = node_gain * max(0.2, active_trusses / 6.0)
    labor_index = max(0.0, (0.6 * node_gain) + (0.25 * pruning_pressure) + (0.15 * harvest_pressure))
    return {
        "predicted_harvest_frequency_increase": round(harvest_pressure, 6),
        "predicted_pruning_thinning_demand_increase": round(pruning_pressure, 6),
        "labor_index": round(labor_index, 6),
    }


def _evaluate_energy_hold(
    *,
    context: InternalModelContext,
    day_min_temp_c: float,
    night_min_temp_c: float,
    day_hours: float,
    night_hours: float,
) -> dict[str, float]:
    env = context.canonical_state["env"]
    sensible_heat = float(context.canonical_state["flux"]["sensible_heat_W_m2"])
    day_result = context.energy_estimator.estimate_target_hold(
        state={"H_W_m2": sensible_heat},
        target_air_c=day_min_temp_c,
        outside_air_c=float(env["outside_T_C"]),
        dt_hours=day_hours,
    )
    night_result = context.energy_estimator.estimate_target_hold(
        state={"H_W_m2": sensible_heat},
        target_air_c=night_min_temp_c,
        outside_air_c=float(env["outside_T_C"]) - 1.0,
        dt_hours=night_hours,
    )
    total_daily_kwh = float(day_result["daily_kWh"]) + float(night_result["daily_kWh"])
    energy_kwh_m2_day = total_daily_kwh / max(context.greenhouse_area_m2, 1.0)
    return {
        "energy_kwh_m2_day": round(energy_kwh_m2_day, 6),
        "energy_krw_m2_day": round(energy_kwh_m2_day * context.cost_per_kwh, 6),
        "day_Q_load_kW": float(day_result["Q_load_kW"]),
        "night_Q_load_kW": float(night_result["Q_load_kW"]),
    }


def evaluate_rtr_candidate(
    *,
    context: InternalModelContext,
    optimization_inputs: RTROptimizationInputs,
    weights: Mapping[str, float],
    day_min_temp_c: float,
    night_min_temp_c: float,
    vent_bias_c: float = 0.0,
    screen_bias_pct: float = 0.0,
    co2_target_ppm: float | None = None,
    rh_target_pct: float | None = None,
) -> dict[str, Any]:
    state = context.canonical_state
    env = state["env"]
    flux = state["flux"]
    growth = state["growth"]
    day_hours, night_hours = horizon_hours(optimization_inputs.target_horizon)
    mean_temp_c = ((day_min_temp_c * day_hours) + (night_min_temp_c * night_hours)) / max(1.0, day_hours + night_hours)
    canopy_air_delta = float(env["T_canopy_C"]) - float(env["T_air_C"])
    co2_ppm = float(co2_target_ppm if co2_target_ppm is not None else context.ops_config.get("co2_target_ppm", env["CO2_ppm"]))
    rh_pct = float(rh_target_pct if rh_target_pct is not None else env["RH_pct"])
    rh_fraction = max(0.0, min(1.0, rh_pct / 100.0))

    day_eval = _evaluate_leaf_exchange(
        context=context,
        air_temp_c=day_min_temp_c,
        canopy_temp_c=day_min_temp_c + canopy_air_delta,
        co2_ppm=co2_ppm,
        rh_fraction=rh_fraction,
    )
    night_eval = _evaluate_leaf_exchange(
        context=context,
        air_temp_c=night_min_temp_c,
        canopy_temp_c=night_min_temp_c + canopy_air_delta,
        co2_ppm=max(400.0, co2_ppm * 0.7),
        rh_fraction=rh_fraction,
    )

    weighted_gross = (
        (day_eval["gross_assim_umol_m2_s"] * day_hours)
        + (night_eval["gross_assim_umol_m2_s"] * night_hours)
    ) / max(1.0, day_hours + night_hours)
    weighted_net = (
        (day_eval["net_assim_umol_m2_s"] * day_hours)
        + (night_eval["net_assim_umol_m2_s"] * night_hours)
    ) / max(1.0, day_hours + night_hours)
    weighted_resp = (
        (day_eval["respiration_umol_m2_s"] * day_hours)
        + (night_eval["respiration_umol_m2_s"] * night_hours)
    ) / max(1.0, day_hours + night_hours)

    node_summary = build_node_target_summary(
        optimization_inputs=optimization_inputs,
        raw_adapter_state=context.adapter.dump_state(),
        current_mean_air_temp_c=float(env["T_air_C"]),
        candidate_mean_air_temp_c=mean_temp_c,
    )
    assimilation_gain = weighted_net - float(flux["net_assim_umol_m2_s"])
    respiration_cost = weighted_resp - float(flux["respiration_proxy_umol_m2_s"])
    carbon_margin_proxy = float(growth["source_sink_balance"]) + (
        (weighted_net - float(flux["net_assim_umol_m2_s"]))
        / max(1.0, abs(float(growth["source_capacity"])) or 1.0)
    )
    sink_overload_penalty = _sink_overload_penalty(context, carbon_margin_proxy)

    controls = {
        "temperature_day": day_min_temp_c - float(env["T_air_C"]),
        "temperature_night": night_min_temp_c - float(env["T_air_C"]),
        "co2_setpoint_day": co2_ppm - float(env["CO2_ppm"]),
        "rh_target": rh_pct - float(env["RH_pct"]),
        "screen_close": screen_bias_pct,
    }
    crop_specific = state["crop_specific"]
    active_surface = (
        crop_specific.get("cucumber")
        if state["crop"] == "cucumber"
        else crop_specific.get("tomato")
    ) or {}
    constraint_eval = evaluate_constraints(
        runtime_inputs={
            "canopy_temperature_c": float(env["T_canopy_C"]),
            "rh_fraction": rh_fraction,
            "source_sink_balance": carbon_margin_proxy,
            "upper_leaf_activity": float(active_surface.get("upper_leaf_activity", 0.5)),
            "bottom_leaf_activity": float(active_surface.get("bottom_leaf_activity", 0.2)),
            "missing_inputs": [],
        },
        controls=controls,
    )
    energy_eval = _evaluate_energy_hold(
        context=context,
        day_min_temp_c=day_min_temp_c,
        night_min_temp_c=night_min_temp_c,
        day_hours=day_hours,
        night_hours=night_hours,
    )
    energy_rate_kwh_m2_day = float(energy_eval["energy_kwh_m2_day"])
    energy_cost_krw_m2_day = float(energy_eval["energy_krw_m2_day"])

    labor_terms = _labor_pressure(
        context=context,
        predicted_rate_day=float(node_summary["predicted_rate_day"]),
        observed_rate_day=float(node_summary["observed_rate_day"]),
    )
    labor_cost = labor_terms["labor_index"] * float(optimization_inputs.user_labor_cost_coefficient or 1.0)

    node_penalty = max(0.0, float(node_summary["gap_rate_day"])) ** 2
    carbon_penalty = max(0.0, -carbon_margin_proxy) ** 2
    objective_value = (
        float(weights["temp"]) * mean_temp_c
        + float(weights["node"]) * node_penalty
        + float(weights["carbon"]) * carbon_penalty
        + float(weights["sink"]) * sink_overload_penalty
        + float(weights["resp"]) * max(0.0, respiration_cost)
        + float(weights["risk"]) * (
            float(constraint_eval.disease_risk_penalty) + float(constraint_eval.stress_penalty)
        )
        + float(weights["energy"]) * energy_rate_kwh_m2_day
        + float(weights["labor"]) * labor_cost
    )

    return {
        "controls": {
            "day_min_temp_C": round(day_min_temp_c, 6),
            "night_min_temp_C": round(night_min_temp_c, 6),
            "mean_temp_C": round(mean_temp_c, 6),
            "vent_bias_C": round(vent_bias_c, 6),
            "screen_bias_pct": round(screen_bias_pct, 6),
            "co2_target_ppm": round(co2_ppm, 6),
        },
        "node_summary": node_summary,
        "objective_breakdown": {
            "assimilation_gain": round(assimilation_gain, 6),
            "respiration_cost": round(respiration_cost, 6),
            "node_target_penalty": round(node_penalty, 6),
            "carbon_margin_penalty": round(carbon_penalty, 6),
            "sink_overload_penalty": round(sink_overload_penalty, 6),
            "humidity_risk_penalty": round(float(constraint_eval.disease_risk_penalty), 6),
            "disease_penalty": round(float(constraint_eval.stress_penalty), 6),
            "energy_cost": round(energy_rate_kwh_m2_day, 6),
            "energy_cost_krw": round(energy_cost_krw_m2_day, 6),
            "labor_cost": round(labor_cost, 6),
            "labor_index": round(labor_terms["labor_index"], 6),
        },
        "flux_projection": {
            "gross_assim_umol_m2_s": round(weighted_gross, 6),
            "net_assim_umol_m2_s": round(weighted_net, 6),
            "respiration_umol_m2_s": round(weighted_resp, 6),
            "carbon_margin": round(carbon_margin_proxy, 6),
            "day_Q_load_kW": round(float(energy_eval["day_Q_load_kW"]), 6),
            "night_Q_load_kW": round(float(energy_eval["night_Q_load_kW"]), 6),
            "stomatal_conductance_m_s": round(
                (
                    (day_eval["stomatal_conductance_m_s"] * day_hours)
                    + (night_eval["stomatal_conductance_m_s"] * night_hours)
                )
                / max(1.0, day_hours + night_hours),
                6,
            ),
        },
        "labor_projection": labor_terms,
        "constraint_checks": {
            "risk_flags": [item.as_dict() for item in constraint_eval.violations],
            "energy_cost_penalty": round(float(constraint_eval.energy_cost_penalty), 6),
            "disease_risk_penalty": round(float(constraint_eval.disease_risk_penalty), 6),
            "stress_penalty": round(float(constraint_eval.stress_penalty), 6),
            "confidence_penalty": round(float(constraint_eval.confidence_penalty), 6),
        },
        "objective_value": round(objective_value, 6),
        "feasibility": {
            "target_node_hit": bool(node_summary["target_hit"]),
            "carbon_margin_positive": bool(carbon_margin_proxy >= 0.0),
            "risk_flags": [item.as_dict() for item in constraint_eval.violations],
        },
    }
