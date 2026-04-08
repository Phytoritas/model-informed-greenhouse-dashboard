"""Objective-term decomposition for actuator-first RTR optimization."""

from __future__ import annotations

from typing import Any, Mapping

from ..model_runtime.constraint_engine import evaluate_constraints
from .actuator_bridge import evaluate_actuator_candidate
from .controller_contract import RTROptimizationInputs, RtrControlCandidate
from .crop_bridge import evaluate_post_control_crop_state
from .labor_estimator import estimate_labor_projection
from .node_target_engine import build_node_target_summary


def _weighted_mean(day_value: float, night_value: float, day_hours: float, night_hours: float) -> float:
    return ((day_value * day_hours) + (night_value * night_hours)) / max(1.0, day_hours + night_hours)


def _safe_float(value: Any, default: float = 0.0) -> float:
    try:
        if value is None:
            return default
        return float(value)
    except (TypeError, ValueError):
        return default


def _control_effect_trace(actuator_eval: Mapping[str, Any]) -> dict[str, Any]:
    day = actuator_eval["phases"]["day"]
    night = actuator_eval["phases"]["night"]
    return {
        "day": day["control_effect_trace"],
        "night": night["control_effect_trace"],
        "env": {
            "Tin_post_C": day["env"]["T_air_C"],
            "Tleaf_post_C": day["env"]["T_leaf_C"],
            "RH_post_pct": day["env"]["RH_pct"],
            "VPD_post_kPa": day["env"]["VPD_kPa"],
            "CO2_post_ppm": day["env"]["CO2_ppm"],
            "air_exchange_post": day["env"]["air_exchange_post"],
            "H_post_W_m2": day["flux"]["H_post_W_m2"],
            "LE_post_W_m2": day["flux"]["LE_post_W_m2"],
            "transpiration_post_g_m2_s": day["flux"]["transpiration_post_g_m2_s"],
            "condensation_risk_post": day["risk"]["condensation_risk_post"],
        },
    }


def evaluate_rtr_candidate(
    *,
    context,
    optimization_inputs: RTROptimizationInputs,
    weights: Mapping[str, float],
    day_min_temp_c: float | None = None,
    night_min_temp_c: float | None = None,
    day_cooling_target_c: float | None = None,
    night_cooling_target_c: float | None = None,
    vent_bias_c: float = 0.0,
    screen_bias_pct: float = 0.0,
    circulation_fan_pct: float = 35.0,
    co2_target_ppm: float | None = None,
    rh_target_pct: float | None = None,  # kept for API compatibility
    dehumidification_bias: float = 0.0,
    fogging_or_evap_cooling_intensity: float = 0.0,
) -> dict[str, Any]:
    state = context.canonical_state
    env = state["env"]
    growth = state["growth"]

    candidate = RtrControlCandidate(
        day_heating_min_temp_C=float(day_min_temp_c if day_min_temp_c is not None else context.ops_config.get("heating_set_C", env["T_air_C"])),
        night_heating_min_temp_C=float(night_min_temp_c if night_min_temp_c is not None else context.ops_config.get("heating_set_C", env["T_air_C"])),
        day_cooling_target_C=float(day_cooling_target_c if day_cooling_target_c is not None else context.ops_config.get("cooling_set_C", env["T_air_C"] + 7.0)),
        night_cooling_target_C=float(night_cooling_target_c if night_cooling_target_c is not None else max(float(context.ops_config.get("cooling_set_C", env["T_air_C"] + 7.0)) - 1.0, float(context.ops_config.get("heating_set_C", env["T_air_C"])) + 1.0)),
        vent_bias_C=float(vent_bias_c),
        screen_bias_pct=float(screen_bias_pct),
        circulation_fan_pct=float(circulation_fan_pct),
        co2_target_ppm=float(co2_target_ppm if co2_target_ppm is not None else context.ops_config.get("co2_target_ppm", env["CO2_ppm"])),
        dehumidification_bias=float(dehumidification_bias),
        fogging_or_evap_cooling_intensity=float(fogging_or_evap_cooling_intensity),
    )

    actuator_eval = evaluate_actuator_candidate(
        context=context,
        optimization_inputs=optimization_inputs,
        candidate=candidate,
    )
    day_hours = float(actuator_eval["phase_hours"]["day"])
    night_hours = float(actuator_eval["phase_hours"]["night"])
    day_crop = evaluate_post_control_crop_state(
        context=context,
        phase="day",
        post_control_state=actuator_eval["phases"]["day"],
    )
    night_crop = evaluate_post_control_crop_state(
        context=context,
        phase="night",
        post_control_state=actuator_eval["phases"]["night"],
    )

    mean_air_temp_c = _weighted_mean(day_crop["env"]["T_air_C"], night_crop["env"]["T_air_C"], day_hours, night_hours)
    mean_leaf_temp_c = _weighted_mean(day_crop["env"]["T_leaf_C"], night_crop["env"]["T_leaf_C"], day_hours, night_hours)
    mean_rh_pct = _weighted_mean(day_crop["env"]["RH_pct"], night_crop["env"]["RH_pct"], day_hours, night_hours)
    mean_vpd_kpa = _weighted_mean(day_crop["env"]["VPD_kPa"], night_crop["env"]["VPD_kPa"], day_hours, night_hours)
    mean_co2_ppm = _weighted_mean(day_crop["env"]["CO2_ppm"], night_crop["env"]["CO2_ppm"], day_hours, night_hours)

    weighted_gross = _weighted_mean(day_crop["gross_assim_umol_m2_s"], night_crop["gross_assim_umol_m2_s"], day_hours, night_hours)
    weighted_net = _weighted_mean(day_crop["net_assim_umol_m2_s"], night_crop["net_assim_umol_m2_s"], day_hours, night_hours)
    weighted_resp = _weighted_mean(day_crop["respiration_umol_m2_s"], night_crop["respiration_umol_m2_s"], day_hours, night_hours)
    weighted_stomatal = _weighted_mean(day_crop["stomatal_conductance_m_s"], night_crop["stomatal_conductance_m_s"], day_hours, night_hours)
    weighted_source_capacity = _weighted_mean(day_crop["source_capacity"], night_crop["source_capacity"], day_hours, night_hours)

    node_summary = build_node_target_summary(
        optimization_inputs=optimization_inputs,
        raw_adapter_state=context.adapter.dump_state(),
        current_mean_air_temp_c=float(env["T_air_C"]),
        candidate_mean_air_temp_c=mean_air_temp_c,
    )
    observed_rate_day = float(node_summary["observed_rate_day"])
    target_rate_day = float(node_summary["target_rate_day"])
    growth_multiplier = max(1.0, target_rate_day / max(observed_rate_day, 0.05))
    required_assimilate_for_growth = float(growth["sink_demand"]) * growth_multiplier
    carbon_margin_proxy = weighted_source_capacity - required_assimilate_for_growth

    day_energy = actuator_eval["phases"]["day"]["energy"]
    night_energy = actuator_eval["phases"]["night"]["energy"]
    heating_energy_kwh_m2_day = float(day_energy["heating_energy_kWh_m2_day"]) + float(night_energy["heating_energy_kWh_m2_day"])
    cooling_energy_kwh_m2_day = float(day_energy["cooling_energy_kWh_m2_day"]) + float(night_energy["cooling_energy_kWh_m2_day"])
    ventilation_energy_kwh_m2_day = float(day_energy["ventilation_energy_kWh_m2_day"]) + float(night_energy["ventilation_energy_kWh_m2_day"])
    total_energy_kwh_m2_day = float(day_energy["total_energy_kWh_m2_day"]) + float(night_energy["total_energy_kWh_m2_day"])

    heating_energy_cost_krw = heating_energy_kwh_m2_day * float(context.cost_per_kwh)
    cooling_energy_cost_krw = cooling_energy_kwh_m2_day * float(context.cost_per_kwh)
    ventilation_energy_cost_krw = ventilation_energy_kwh_m2_day * float(context.cost_per_kwh)
    total_energy_cost_krw = total_energy_kwh_m2_day * float(context.cost_per_kwh)

    labor_summary = estimate_labor_projection(
        crop=context.canonical_state["crop"],
        predicted_node_rate_day=float(node_summary["predicted_rate_day"]),
        observed_node_rate_day=observed_rate_day,
        fruit_load=float(growth["fruit_load"]),
        lai=float(growth["LAI"]),
        crop_specific=(
            state["crop_specific"]["cucumber"]
            if state["crop"] == "cucumber"
            else state["crop_specific"]["tomato"]
        ),
        user_labor_cost_coefficient=optimization_inputs.user_labor_cost_coefficient,
    )

    base_yield_kg_m2_day = max(0.0, float(growth["harvested_fruit_dry_matter_g_m2"]) / 1000.0)
    yield_proxy_kg_m2_day = max(
        0.0,
        base_yield_kg_m2_day * (weighted_net / max(float(state["flux"]["net_assim_umol_m2_s"]), 1e-6)),
    )
    yield_proxy_kg_m2_week = yield_proxy_kg_m2_day * 7.0
    harvest_trend_delta_pct = (
        ((yield_proxy_kg_m2_day - base_yield_kg_m2_day) / max(base_yield_kg_m2_day, 1e-6)) * 100.0
    ) if base_yield_kg_m2_day > 0 else 0.0
    yield_penalty = max(0.0, -harvest_trend_delta_pct / 100.0)
    gross_margin_proxy_krw_m2_day = (yield_proxy_kg_m2_day * 3200.0) - total_energy_cost_krw - float(labor_summary["labor_cost_krw_m2_day"])

    phase_humidity_penalty = _weighted_mean(
        float(actuator_eval["phases"]["day"]["risk"]["humidity_penalty"]),
        float(actuator_eval["phases"]["night"]["risk"]["humidity_penalty"]),
        day_hours,
        night_hours,
    )
    phase_disease_penalty = _weighted_mean(
        float(actuator_eval["phases"]["day"]["risk"]["disease_penalty"]),
        float(actuator_eval["phases"]["night"]["risk"]["disease_penalty"]),
        day_hours,
        night_hours,
    )
    phase_stress_penalty = _weighted_mean(
        float(actuator_eval["phases"]["day"]["risk"]["stress_penalty"]),
        float(actuator_eval["phases"]["night"]["risk"]["stress_penalty"]),
        day_hours,
        night_hours,
    )

    controls_for_constraints = {
        "temperature_day": candidate.day_heating_min_temp_C - float(env["T_air_C"]),
        "temperature_night": candidate.night_heating_min_temp_C - float(env["T_air_C"]),
        "co2_setpoint_day": float(candidate.co2_target_ppm or env["CO2_ppm"]) - float(env["CO2_ppm"]),
        "rh_target": (mean_rh_pct - float(env["RH_pct"])) if rh_target_pct is None else float(rh_target_pct) - float(env["RH_pct"]),
        "screen_close": candidate.screen_bias_pct,
    }
    active_surface = (
        state["crop_specific"]["cucumber"]
        if state["crop"] == "cucumber"
        else state["crop_specific"]["tomato"]
    ) or {}
    constraint_eval = evaluate_constraints(
        runtime_inputs={
            "canopy_temperature_c": mean_leaf_temp_c,
            "rh_fraction": mean_rh_pct / 100.0,
            "source_sink_balance": carbon_margin_proxy,
            "upper_leaf_activity": float(active_surface.get("upper_leaf_activity", 0.5)),
            "bottom_leaf_activity": float(active_surface.get("bottom_leaf_activity", 0.2)),
            "missing_inputs": [],
        },
        controls=controls_for_constraints,
    )

    humidity_penalty = phase_humidity_penalty + float(constraint_eval.disease_risk_penalty)
    disease_penalty = phase_disease_penalty + float(constraint_eval.disease_risk_penalty)
    stress_penalty = phase_stress_penalty + float(constraint_eval.stress_penalty)
    assimilation_gain = weighted_net - float(state["flux"]["net_assim_umol_m2_s"])
    respiration_cost = weighted_resp - float(state["flux"]["respiration_proxy_umol_m2_s"])
    sink_overload_penalty = max(0.0, (float(growth["fruit_load"]) * 0.08) + required_assimilate_for_growth - weighted_source_capacity)
    node_penalty = max(0.0, float(node_summary["gap_rate_day"])) ** 2
    carbon_penalty = max(0.0, -carbon_margin_proxy) ** 2

    def weight(name: str, default: float = 1.0) -> float:
        return float(weights.get(name, default))

    objective_value = (
        (weight("temp") * mean_air_temp_c)
        - (weight("assim") * max(0.0, assimilation_gain))
        + (weight("resp") * max(0.0, respiration_cost))
        + (weight("node") * node_penalty)
        + (weight("carbon") * carbon_penalty)
        + (weight("sink") * sink_overload_penalty)
        + (weight("heating") * heating_energy_kwh_m2_day)
        + (weight("cooling") * cooling_energy_kwh_m2_day)
        + (weight("ventilation") * ventilation_energy_kwh_m2_day)
        + (weight("labor") * float(labor_summary["labor_cost_krw_m2_day"]))
        + (weight("yield") * yield_penalty)
        + (weight("humidity") * humidity_penalty)
        + (weight("disease") * disease_penalty)
        + (weight("stress") * stress_penalty)
    )

    controls_payload = candidate.as_dict()

    return {
        "controls": controls_payload,
        "actuator_availability": actuator_eval["availability"],
        "node_summary": node_summary,
        "objective_breakdown": {
            "assimilation_gain": round(assimilation_gain, 6),
            "respiration_cost": round(respiration_cost, 6),
            "node_target_penalty": round(node_penalty, 6),
            "carbon_margin_penalty": round(carbon_penalty, 6),
            "sink_overload_penalty": round(sink_overload_penalty, 6),
            "humidity_risk_penalty": round(humidity_penalty, 6),
            "disease_penalty": round(disease_penalty, 6),
            "stress_penalty": round(stress_penalty, 6),
            "heating_energy_cost": round(heating_energy_kwh_m2_day, 6),
            "cooling_energy_cost": round(cooling_energy_kwh_m2_day, 6),
            "ventilation_energy_cost": round(ventilation_energy_kwh_m2_day, 6),
            "energy_cost": round(total_energy_kwh_m2_day, 6),
            "energy_cost_krw": round(total_energy_cost_krw, 6),
            "heating_energy_cost_krw": round(heating_energy_cost_krw, 6),
            "cooling_energy_cost_krw": round(cooling_energy_cost_krw, 6),
            "ventilation_energy_cost_krw": round(ventilation_energy_cost_krw, 6),
            "labor_cost": round(float(labor_summary["labor_cost_krw_m2_day"]), 6),
            "labor_index": round(float(labor_summary["labor_index"]), 6),
            "labor_hours_m2_day": round(float(labor_summary["labor_hours_m2_day"]), 6),
            "yield_penalty": round(yield_penalty, 6),
            "gross_margin_proxy_krw_m2_day": round(gross_margin_proxy_krw_m2_day, 6),
        },
        "flux_projection": {
            "gross_assim_umol_m2_s": round(weighted_gross, 6),
            "net_assim_umol_m2_s": round(weighted_net, 6),
            "respiration_umol_m2_s": round(weighted_resp, 6),
            "carbon_margin": round(carbon_margin_proxy, 6),
            "day_Q_load_kW": round(float(actuator_eval["phases"]["day"]["energy"]["total_energy_kWh_m2_day"]) * context.greenhouse_area_m2 / max(day_hours, 1.0), 6),
            "night_Q_load_kW": round(float(actuator_eval["phases"]["night"]["energy"]["total_energy_kWh_m2_day"]) * context.greenhouse_area_m2 / max(night_hours, 1.0), 6),
            "stomatal_conductance_m_s": round(weighted_stomatal, 6),
            "transpiration_g_m2_s": round(_weighted_mean(
                float(actuator_eval["phases"]["day"]["flux"]["transpiration_post_g_m2_s"]),
                float(actuator_eval["phases"]["night"]["flux"]["transpiration_post_g_m2_s"]),
                day_hours,
                night_hours,
            ), 6),
            "latent_heat_W_m2": round(_weighted_mean(
                float(actuator_eval["phases"]["day"]["flux"]["LE_post_W_m2"]),
                float(actuator_eval["phases"]["night"]["flux"]["LE_post_W_m2"]),
                day_hours,
                night_hours,
            ), 6),
            "sensible_heat_W_m2": round(_weighted_mean(
                float(actuator_eval["phases"]["day"]["flux"]["H_post_W_m2"]),
                float(actuator_eval["phases"]["night"]["flux"]["H_post_W_m2"]),
                day_hours,
                night_hours,
            ), 6),
            "T_air_C": round(mean_air_temp_c, 6),
            "T_leaf_C": round(mean_leaf_temp_c, 6),
            "RH_pct": round(mean_rh_pct, 6),
            "VPD_kPa": round(mean_vpd_kpa, 6),
            "CO2_ppm": round(mean_co2_ppm, 6),
        },
        "labor_projection": {
            **labor_summary,
            "predicted_harvest_frequency_increase": round(float(labor_summary["harvest_load_index"]), 6),
            "predicted_pruning_thinning_demand_increase": round(
                float(labor_summary["pruning_load_index"]) + float(labor_summary["thinning_load_index"]),
                6,
            ),
        },
        "yield_projection": {
            "predicted_yield_kg_m2_day": round(yield_proxy_kg_m2_day, 6),
            "predicted_yield_kg_m2_week": round(yield_proxy_kg_m2_week, 6),
            "harvest_trend_delta_pct": round(harvest_trend_delta_pct, 6),
            "gross_margin_proxy_krw_m2_day": round(gross_margin_proxy_krw_m2_day, 6),
        },
        "energy_summary": {
            "heating_energy_kWh_m2_day": round(heating_energy_kwh_m2_day, 6),
            "cooling_energy_kWh_m2_day": round(cooling_energy_kwh_m2_day, 6),
            "ventilation_energy_kWh_m2_day": round(ventilation_energy_kwh_m2_day, 6),
            "total_energy_kWh_m2_day": round(total_energy_kwh_m2_day, 6),
            "heating_cost_krw_m2_day": round(heating_energy_cost_krw, 6),
            "cooling_cost_krw_m2_day": round(cooling_energy_cost_krw, 6),
            "ventilation_cost_krw_m2_day": round(ventilation_energy_cost_krw, 6),
            "total_energy_cost_krw_m2_day": round(total_energy_cost_krw, 6),
        },
        "control_effect_trace": _control_effect_trace(actuator_eval),
        "crop_phase_trace": {
            "day": day_crop,
            "night": night_crop,
        },
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
