"""RTR scenario and sensitivity surfaces over the actuator-first optimizer."""

from __future__ import annotations

from dataclasses import replace
from typing import Any, Callable, Mapping

from .control_effects import build_baseline_control_candidate
from .controller_contract import (
    RTROptimizationInputs,
    RtrControlCandidate,
    build_weight_vector,
)
from .lagrangian_optimizer import optimize_rtr_targets
from .objective_terms import evaluate_rtr_candidate


def _scenario_confidence(candidate: Mapping[str, Any]) -> float:
    risk_flags = candidate["feasibility"]["risk_flags"]
    confidence_penalty = float(candidate["constraint_checks"]["confidence_penalty"])
    return round(
        max(
            0.2,
            min(
                0.98,
                1.0 - confidence_penalty - (0.05 * len(risk_flags)),
            ),
        ),
        6,
    )


def _candidate_from_result(result: Mapping[str, Any]) -> RtrControlCandidate:
    controls = result["controls"]
    return RtrControlCandidate(
        day_heating_min_temp_C=float(controls["day_heating_min_temp_C"]),
        night_heating_min_temp_C=float(controls["night_heating_min_temp_C"]),
        day_cooling_target_C=float(controls["day_cooling_target_C"]),
        night_cooling_target_C=float(controls["night_cooling_target_C"]),
        vent_bias_C=float(controls.get("vent_bias_C", 0.0)),
        screen_bias_pct=float(controls.get("screen_bias_pct", 0.0)),
        circulation_fan_pct=float(controls.get("circulation_fan_pct", 0.0)),
        co2_target_ppm=float(controls.get("co2_target_ppm", 0.0)),
        dehumidification_bias=float(controls.get("dehumidification_bias", 0.0)),
        fogging_or_evap_cooling_intensity=float(controls.get("fogging_or_evap_cooling_intensity", 0.0)),
    )


def _serialize_candidate_scenario(
    *,
    label: str,
    mode: str,
    candidate: Mapping[str, Any],
    recommendation_badge: str,
    group: str,
) -> dict[str, Any]:
    yield_summary = candidate.get("yield_projection", {}) or {}
    energy_summary = candidate.get("energy_summary", {}) or {}
    labor_summary = candidate.get("labor_projection", {}) or {}
    return {
        "label": label,
        "mode": mode,
        "group": group,
        "mean_temp_C": candidate["controls"]["mean_temp_C"],
        "day_min_temp_C": candidate["controls"]["day_min_temp_C"],
        "night_min_temp_C": candidate["controls"]["night_min_temp_C"],
        "day_heating_min_temp_C": candidate["controls"]["day_heating_min_temp_C"],
        "night_heating_min_temp_C": candidate["controls"]["night_heating_min_temp_C"],
        "day_cooling_target_C": candidate["controls"]["day_cooling_target_C"],
        "night_cooling_target_C": candidate["controls"]["night_cooling_target_C"],
        "vent_bias_C": candidate["controls"].get("vent_bias_C", 0.0),
        "screen_bias_pct": candidate["controls"].get("screen_bias_pct", 0.0),
        "circulation_fan_pct": candidate["controls"].get("circulation_fan_pct", 0.0),
        "co2_target_ppm": candidate["controls"].get("co2_target_ppm", 0.0),
        "node_rate_day": candidate["node_summary"]["predicted_rate_day"],
        "net_carbon": candidate["flux_projection"]["carbon_margin"],
        "net_assimilation": candidate["flux_projection"]["net_assim_umol_m2_s"],
        "respiration": candidate["flux_projection"]["respiration_umol_m2_s"],
        "humidity_penalty": candidate["objective_breakdown"]["humidity_risk_penalty"],
        "disease_penalty": candidate["objective_breakdown"]["disease_penalty"],
        "energy_kwh_m2_day": candidate["objective_breakdown"]["energy_cost"],
        "heating_energy_kwh_m2_day": energy_summary.get("heating_energy_kWh_m2_day", 0.0),
        "cooling_energy_kwh_m2_day": energy_summary.get("cooling_energy_kWh_m2_day", 0.0),
        "total_energy_cost_krw_m2_day": energy_summary.get("total_energy_cost_krw_m2_day", 0.0),
        "labor_index": candidate["objective_breakdown"]["labor_index"],
        "labor_hours_m2_day": labor_summary.get("labor_hours_m2_day", 0.0),
        "labor_cost_krw_m2_day": labor_summary.get("labor_cost_krw_m2_day", 0.0),
        "labor_summary": labor_summary,
        "yield_kg_m2_day": yield_summary.get("predicted_yield_kg_m2_day", 0.0),
        "yield_kg_m2_week": yield_summary.get("predicted_yield_kg_m2_week", 0.0),
        "harvest_trend_delta_pct": yield_summary.get("harvest_trend_delta_pct", 0.0),
        "yield_trend": (
            "up"
            if candidate["flux_projection"]["carbon_margin"] >= 0 and candidate["node_summary"]["target_hit"]
            else "guarded"
        ),
        "recommendation_badge": recommendation_badge,
        "confidence": _scenario_confidence(candidate),
        "risk_flags": candidate["feasibility"]["risk_flags"],
        "objective_breakdown": candidate["objective_breakdown"],
        "energy_summary": energy_summary,
        "yield_summary": yield_summary,
        "control_effect_trace": candidate.get("control_effect_trace", {}),
    }


def _resolve_active_weights(context, optimization_inputs: RTROptimizationInputs) -> dict[str, float]:
    optimizer_defaults = (
        context.canonical_state.get("optimizer")
        or context.crop_profile.get("optimizer")
        or {}
    )
    return build_weight_vector(
        optimizer_defaults,
        optimization_inputs.optimization_mode,
        include_energy_cost=optimization_inputs.include_energy_cost,
        include_labor_cost=optimization_inputs.include_labor_cost,
        include_cooling_cost=optimization_inputs.include_cooling_cost,
        custom_weights=optimization_inputs.custom_weights,
    )


def _evaluate_candidate(
    context,
    optimization_inputs,
    candidate: RtrControlCandidate,
    *,
    weights: Mapping[str, float],
) -> dict[str, Any]:
    return evaluate_rtr_candidate(
        context=context,
        optimization_inputs=optimization_inputs,
        weights=weights,
        day_min_temp_c=candidate.day_heating_min_temp_C,
        night_min_temp_c=candidate.night_heating_min_temp_C,
        day_cooling_target_c=candidate.day_cooling_target_C,
        night_cooling_target_c=candidate.night_cooling_target_C,
        vent_bias_c=candidate.vent_bias_C,
        screen_bias_pct=candidate.screen_bias_pct,
        circulation_fan_pct=candidate.circulation_fan_pct,
        co2_target_ppm=candidate.co2_target_ppm,
        dehumidification_bias=candidate.dehumidification_bias,
        fogging_or_evap_cooling_intensity=candidate.fogging_or_evap_cooling_intensity,
    )


def run_rtr_scenarios(
    *,
    context,
    optimization_inputs: RTROptimizationInputs,
) -> list[dict[str, Any]]:
    weights = _resolve_active_weights(context, optimization_inputs)
    baseline_candidate = build_baseline_control_candidate(
        env=context.canonical_state["env"],
        ops_config=context.ops_config,
        baseline_target_c=float(context.canonical_state["baseline_rtr"]["baseline_target_C"]),
    )
    optimized = optimize_rtr_targets(
        context=context,
        optimization_inputs=optimization_inputs,
    )
    optimizer_candidate = _candidate_from_result(optimized)

    scenarios: list[dict[str, Any]] = []
    baseline_eval = _evaluate_candidate(
        context,
        optimization_inputs,
        baseline_candidate,
        weights=weights,
    )
    scenarios.append(
        _serialize_candidate_scenario(
            label="baseline",
            mode="baseline",
            candidate=baseline_eval,
            recommendation_badge="baseline",
            group="baseline",
        )
    )

    offset_specs = (
        ("offset_minus_0_3c", replace(baseline_candidate, day_heating_min_temp_C=baseline_candidate.day_heating_min_temp_C - 0.3, night_heating_min_temp_C=baseline_candidate.night_heating_min_temp_C - 0.3), "baseline"),
        ("offset_plus_0_3c", replace(baseline_candidate, day_heating_min_temp_C=baseline_candidate.day_heating_min_temp_C + 0.3, night_heating_min_temp_C=baseline_candidate.night_heating_min_temp_C + 0.3), "baseline"),
        ("offset_plus_0_6c", replace(baseline_candidate, day_heating_min_temp_C=baseline_candidate.day_heating_min_temp_C + 0.6, night_heating_min_temp_C=baseline_candidate.night_heating_min_temp_C + 0.6), "baseline"),
        ("heating_weaker", replace(optimizer_candidate, day_heating_min_temp_C=optimizer_candidate.day_heating_min_temp_C - 0.4, night_heating_min_temp_C=optimizer_candidate.night_heating_min_temp_C - 0.4), "hvac"),
        ("heating_stronger", replace(optimizer_candidate, day_heating_min_temp_C=optimizer_candidate.day_heating_min_temp_C + 0.4, night_heating_min_temp_C=optimizer_candidate.night_heating_min_temp_C + 0.4), "hvac"),
        ("cooling_weaker", replace(optimizer_candidate, day_cooling_target_C=optimizer_candidate.day_cooling_target_C + 0.5, night_cooling_target_C=optimizer_candidate.night_cooling_target_C + 0.5), "hvac"),
        ("cooling_stronger", replace(optimizer_candidate, day_cooling_target_C=optimizer_candidate.day_cooling_target_C - 0.5, night_cooling_target_C=optimizer_candidate.night_cooling_target_C - 0.5), "hvac"),
        ("vent_more_open", replace(optimizer_candidate, vent_bias_C=optimizer_candidate.vent_bias_C + 0.6), "vent-screen"),
        ("vent_more_closed", replace(optimizer_candidate, vent_bias_C=optimizer_candidate.vent_bias_C - 0.6), "vent-screen"),
        ("screen_more_open", replace(optimizer_candidate, screen_bias_pct=optimizer_candidate.screen_bias_pct - 10.0), "vent-screen"),
        ("screen_more_closed", replace(optimizer_candidate, screen_bias_pct=optimizer_candidate.screen_bias_pct + 10.0), "vent-screen"),
        ("coordinated_hvac", optimizer_candidate, "optimizer"),
    )
    for label, candidate, group in offset_specs:
        scenarios.append(
            _serialize_candidate_scenario(
                label=label,
                mode="offset" if group == "baseline" else "optimizer",
                candidate=_evaluate_candidate(
                    context,
                    optimization_inputs,
                    candidate,
                    weights=weights,
                ),
                recommendation_badge="compare",
                group=group,
            )
        )

    scenarios.append(
        _serialize_candidate_scenario(
            label="optimizer_chosen",
            mode="optimizer",
            candidate=optimized,
            recommendation_badge="recommended",
            group="optimizer",
        )
    )
    return scenarios


def compute_rtr_temperature_sensitivity(
    *,
    context,
    optimization_inputs: RTROptimizationInputs,
    optimized_candidate: Mapping[str, Any],
    step_c: float = 0.3,
) -> dict[str, Any]:
    base_candidate = _candidate_from_result(optimized_candidate)
    weights = _resolve_active_weights(context, optimization_inputs)

    def _finite_difference(
        *,
        target_name: str,
        perturbation_size: float,
        low_candidate: RtrControlCandidate | None = None,
        high_candidate: RtrControlCandidate | None = None,
        low_inputs: RTROptimizationInputs | None = None,
        high_inputs: RTROptimizationInputs | None = None,
        extractor: Callable[[Mapping[str, Any]], float],
        control_name: str,
    ) -> dict[str, Any]:
        low_eval = _evaluate_candidate(
            context,
            low_inputs or optimization_inputs,
            low_candidate or base_candidate,
            weights=weights,
        )
        high_eval = _evaluate_candidate(
            context,
            high_inputs or optimization_inputs,
            high_candidate or base_candidate,
            weights=weights,
        )
        base_eval = _evaluate_candidate(
            context,
            optimization_inputs,
            base_candidate,
            weights=weights,
        )
        low_value = extractor(low_eval)
        high_value = extractor(high_eval)
        base_value = max(abs(extractor(base_eval)), 1e-9)
        derivative = (high_value - low_value) / (2 * perturbation_size)
        elasticity = (derivative / base_value) * perturbation_size
        return {
            "control": control_name,
            "target": target_name,
            "derivative": round(derivative, 6),
            "elasticity": round(elasticity, 6),
            "direction": "increase" if high_value >= low_value else "decrease",
            "trust_region": {"low": -perturbation_size, "high": perturbation_size},
            "method": "finite_difference",
            "perturbation_size": perturbation_size,
            "valid": True,
            "scenario_alignment": high_value >= low_value,
        }

    screen_step = 5.0
    fan_step = 15.0
    co2_step = 80.0
    target_step = 0.05

    sensitivities = [
        _finite_difference(
            control_name="day_heating_min_temp_C",
            target_name="objective",
            perturbation_size=step_c,
            low_candidate=replace(base_candidate, day_heating_min_temp_C=base_candidate.day_heating_min_temp_C - step_c),
            high_candidate=replace(base_candidate, day_heating_min_temp_C=base_candidate.day_heating_min_temp_C + step_c),
            extractor=lambda payload: float(payload["objective_value"]),
        ),
        _finite_difference(
            control_name="night_heating_min_temp_C",
            target_name="objective",
            perturbation_size=step_c,
            low_candidate=replace(base_candidate, night_heating_min_temp_C=base_candidate.night_heating_min_temp_C - step_c),
            high_candidate=replace(base_candidate, night_heating_min_temp_C=base_candidate.night_heating_min_temp_C + step_c),
            extractor=lambda payload: float(payload["objective_value"]),
        ),
        _finite_difference(
            control_name="day_cooling_target_C",
            target_name="objective",
            perturbation_size=step_c,
            low_candidate=replace(base_candidate, day_cooling_target_C=base_candidate.day_cooling_target_C - step_c),
            high_candidate=replace(base_candidate, day_cooling_target_C=base_candidate.day_cooling_target_C + step_c),
            extractor=lambda payload: float(payload["objective_value"]),
        ),
        _finite_difference(
            control_name="night_cooling_target_C",
            target_name="objective",
            perturbation_size=step_c,
            low_candidate=replace(base_candidate, night_cooling_target_C=base_candidate.night_cooling_target_C - step_c),
            high_candidate=replace(base_candidate, night_cooling_target_C=base_candidate.night_cooling_target_C + step_c),
            extractor=lambda payload: float(payload["objective_value"]),
        ),
        _finite_difference(
            control_name="vent_bias_C",
            target_name="objective",
            perturbation_size=step_c,
            low_candidate=replace(base_candidate, vent_bias_C=base_candidate.vent_bias_C - step_c),
            high_candidate=replace(base_candidate, vent_bias_C=base_candidate.vent_bias_C + step_c),
            extractor=lambda payload: float(payload["objective_value"]),
        ),
        _finite_difference(
            control_name="screen_bias_pct",
            target_name="objective",
            perturbation_size=screen_step,
            low_candidate=replace(base_candidate, screen_bias_pct=base_candidate.screen_bias_pct - screen_step),
            high_candidate=replace(base_candidate, screen_bias_pct=base_candidate.screen_bias_pct + screen_step),
            extractor=lambda payload: float(payload["objective_value"]),
        ),
        _finite_difference(
            control_name="circulation_fan_pct",
            target_name="objective",
            perturbation_size=fan_step,
            low_candidate=replace(base_candidate, circulation_fan_pct=base_candidate.circulation_fan_pct - fan_step),
            high_candidate=replace(base_candidate, circulation_fan_pct=base_candidate.circulation_fan_pct + fan_step),
            extractor=lambda payload: float(payload["objective_value"]),
        ),
        _finite_difference(
            control_name="co2_target_ppm",
            target_name="objective",
            perturbation_size=co2_step,
            low_candidate=replace(base_candidate, co2_target_ppm=float(base_candidate.co2_target_ppm or 0.0) - co2_step),
            high_candidate=replace(base_candidate, co2_target_ppm=float(base_candidate.co2_target_ppm or 0.0) + co2_step),
            extractor=lambda payload: float(payload["objective_value"]),
        ),
        _finite_difference(
            control_name="vent_bias_C",
            target_name="carbon_margin",
            perturbation_size=step_c,
            low_candidate=replace(base_candidate, vent_bias_C=base_candidate.vent_bias_C - step_c),
            high_candidate=replace(base_candidate, vent_bias_C=base_candidate.vent_bias_C + step_c),
            extractor=lambda payload: float(payload["flux_projection"]["carbon_margin"]),
        ),
        _finite_difference(
            control_name="screen_bias_pct",
            target_name="humidity_penalty",
            perturbation_size=screen_step,
            low_candidate=replace(base_candidate, screen_bias_pct=base_candidate.screen_bias_pct - screen_step),
            high_candidate=replace(base_candidate, screen_bias_pct=base_candidate.screen_bias_pct + screen_step),
            extractor=lambda payload: float(payload["objective_breakdown"]["humidity_risk_penalty"]),
        ),
        _finite_difference(
            control_name="screen_bias_pct",
            target_name="disease_penalty",
            perturbation_size=screen_step,
            low_candidate=replace(base_candidate, screen_bias_pct=base_candidate.screen_bias_pct - screen_step),
            high_candidate=replace(base_candidate, screen_bias_pct=base_candidate.screen_bias_pct + screen_step),
            extractor=lambda payload: float(payload["objective_breakdown"]["disease_penalty"]),
        ),
        _finite_difference(
            control_name="day_heating_min_temp_C",
            target_name="heating_energy_cost",
            perturbation_size=step_c,
            low_candidate=replace(base_candidate, day_heating_min_temp_C=base_candidate.day_heating_min_temp_C - step_c),
            high_candidate=replace(base_candidate, day_heating_min_temp_C=base_candidate.day_heating_min_temp_C + step_c),
            extractor=lambda payload: float(payload["objective_breakdown"]["heating_energy_cost"]),
        ),
        _finite_difference(
            control_name="day_cooling_target_C",
            target_name="cooling_energy_cost",
            perturbation_size=step_c,
            low_candidate=replace(base_candidate, day_cooling_target_C=base_candidate.day_cooling_target_C - step_c),
            high_candidate=replace(base_candidate, day_cooling_target_C=base_candidate.day_cooling_target_C + step_c),
            extractor=lambda payload: float(payload["objective_breakdown"]["cooling_energy_cost"]),
        ),
        _finite_difference(
            control_name="target_node_rate_day",
            target_name="labor_penalty",
            perturbation_size=target_step,
            low_inputs=replace(
                optimization_inputs,
                target_node_development_per_day=max(0.05, optimization_inputs.target_node_development_per_day - target_step),
            ),
            high_inputs=replace(
                optimization_inputs,
                target_node_development_per_day=optimization_inputs.target_node_development_per_day + target_step,
            ),
            extractor=lambda payload: float(
                payload["objective_breakdown"].get(
                    "labor_objective_penalty",
                    payload["objective_breakdown"].get(
                        "labor_index",
                        payload["objective_breakdown"].get("labor_cost", 0.0),
                    ),
                )
            ),
        ),
    ]

    return {
        "crop": optimization_inputs.crop,
        "step_c": step_c,
        "sensitivities": sensitivities,
    }
