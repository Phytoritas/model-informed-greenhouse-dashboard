"""Two-stage bounded RTR optimization with actuator-first post-control semantics."""

from __future__ import annotations

from dataclasses import replace
from typing import Any, Mapping

from model_informed_greenhouse_dashboard.numerics import bounded_coordinate_minimize

from .control_effects import (
    build_actuator_availability,
    build_baseline_control_candidate,
)
from .controller_contract import (
    RTROptimizationInputs,
    RtrControlCandidate,
    build_weight_vector,
    resolve_guardrail,
)
from .objective_terms import evaluate_rtr_candidate


def _candidate_from_vector(
    *,
    vector: list[float] | tuple[float, ...],
    context,
    base_candidate: RtrControlCandidate,
) -> RtrControlCandidate:
    return replace(
        base_candidate,
        day_heating_min_temp_C=float(vector[0]),
        night_heating_min_temp_C=float(vector[1]),
        day_cooling_target_C=float(vector[2]),
        night_cooling_target_C=float(vector[3]),
    )


def _evaluate_control_candidate(
    *,
    candidate: RtrControlCandidate,
    context,
    optimization_inputs: RTROptimizationInputs,
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


def _coordination_grid(
    *,
    context,
    base_candidate: RtrControlCandidate,
    optimization_inputs: RTROptimizationInputs,
    weights: Mapping[str, float],
) -> tuple[RtrControlCandidate, dict[str, Any]]:
    availability = build_actuator_availability(context.ops_config)
    current_env = context.canonical_state["env"]
    ops_co2 = float(context.ops_config.get("co2_target_ppm", current_env["CO2_ppm"]))
    control_axes: list[tuple[str, list[float]]] = []
    if availability.ventilation:
        control_axes.append(("vent_bias_C", [-0.6, 0.0, 0.6]))
    if availability.thermal_screen:
        control_axes.append(("screen_bias_pct", [-12.0, 0.0, 12.0]))
    if availability.circulation_fan:
        control_axes.append(("circulation_fan_pct", [0.0, 35.0, 70.0]))
    if availability.co2:
        control_axes.append(("co2_target_ppm", [float(current_env["CO2_ppm"]), ops_co2, max(ops_co2, float(current_env["CO2_ppm"])) + 150.0]))
    if availability.dehumidification:
        control_axes.append(("dehumidification_bias", [0.0, 0.35, 0.7]))
    if availability.fogging_or_evap_cooling:
        control_axes.append(("fogging_or_evap_cooling_intensity", [0.0, 0.35, 0.7]))

    best_candidate = base_candidate
    best_eval = _evaluate_control_candidate(
        candidate=best_candidate,
        context=context,
        optimization_inputs=optimization_inputs,
        weights=weights,
    )
    for field_name, values in control_axes:
        candidate_for_axis = best_candidate
        eval_for_axis = best_eval
        for value in values:
            trial_candidate = replace(candidate_for_axis, **{field_name: float(value)})
            trial_eval = _evaluate_control_candidate(
                candidate=trial_candidate,
                context=context,
                optimization_inputs=optimization_inputs,
                weights=weights,
            )
            if float(trial_eval["objective_value"]) < float(eval_for_axis["objective_value"]):
                candidate_for_axis = trial_candidate
                eval_for_axis = trial_eval
        best_candidate = candidate_for_axis
        best_eval = eval_for_axis
    return best_candidate, best_eval


def _prefer_minimum_sufficient(
    trial_eval: Mapping[str, Any],
    best_eval: Mapping[str, Any],
) -> bool:
    trial_objective = float(trial_eval["objective_value"])
    best_objective = float(best_eval["objective_value"])
    if trial_objective < best_objective - 1e-9:
        return True

    trial_mean = float(trial_eval["controls"]["mean_temp_C"])
    best_mean = float(best_eval["controls"]["mean_temp_C"])
    if trial_mean >= best_mean - 0.15:
        return False

    trial_breakdown = trial_eval["objective_breakdown"]
    best_breakdown = best_eval["objective_breakdown"]
    same_or_better_growth_pressure = (
        float(trial_breakdown["node_target_penalty"])
        <= float(best_breakdown["node_target_penalty"]) + 1e-6
        and float(trial_breakdown["carbon_margin_penalty"])
        <= float(best_breakdown["carbon_margin_penalty"]) + 1e-6
        and float(trial_breakdown.get("disease_penalty", 0.0))
        <= float(best_breakdown.get("disease_penalty", 0.0)) + 0.2
    )
    if not same_or_better_growth_pressure:
        return False
    return trial_objective <= best_objective * 1.15


def _minimum_sufficient_refinement(
    *,
    context,
    base_candidate: RtrControlCandidate,
    best_eval: dict[str, Any],
    optimization_inputs: RTROptimizationInputs,
    weights: Mapping[str, float],
    thermal_bounds: list[tuple[float, float]],
) -> tuple[RtrControlCandidate, dict[str, Any]]:
    best_candidate = base_candidate
    refined_eval = best_eval
    lower_steps = (0.2, 0.4, 0.6)
    day_heat_bounds, night_heat_bounds, day_cool_bounds, night_cool_bounds = thermal_bounds

    for delta in lower_steps:
        day_heat = min(
            max(best_candidate.day_heating_min_temp_C - delta, day_heat_bounds[0]),
            day_heat_bounds[1],
        )
        night_heat = min(
            max(best_candidate.night_heating_min_temp_C - delta, night_heat_bounds[0]),
            night_heat_bounds[1],
        )
        day_cool = min(
            max(best_candidate.day_cooling_target_C - delta, max(day_cool_bounds[0], day_heat + 0.8)),
            day_cool_bounds[1],
        )
        night_cool = min(
            max(best_candidate.night_cooling_target_C - delta, max(night_cool_bounds[0], night_heat + 0.8)),
            night_cool_bounds[1],
        )
        trial_thermal = replace(
            best_candidate,
            day_heating_min_temp_C=day_heat,
            night_heating_min_temp_C=night_heat,
            day_cooling_target_C=day_cool,
            night_cooling_target_C=night_cool,
        )
        trial_candidate, trial_eval = _coordination_grid(
            context=context,
            base_candidate=trial_thermal,
            optimization_inputs=optimization_inputs,
            weights=weights,
        )
        if _prefer_minimum_sufficient(trial_eval, refined_eval):
            best_candidate = trial_candidate
            refined_eval = trial_eval

    return best_candidate, refined_eval


def optimize_rtr_targets(
    *,
    context,
    optimization_inputs: RTROptimizationInputs,
) -> dict[str, Any]:
    optimizer_defaults = (
        context.canonical_state.get("optimizer")
        or context.crop_profile.get("optimizer")
        or {}
    )
    max_delta_temp_c = resolve_guardrail(
        optimizer_defaults,
        optimization_inputs.guardrails,
        "max_temp_delta_per_step",
        1.2 if optimization_inputs.crop == "cucumber" else 1.5,
    )
    env = context.canonical_state["env"]
    baseline_candidate = build_baseline_control_candidate(
        env=env,
        ops_config=context.ops_config,
        baseline_target_c=float(context.canonical_state["baseline_rtr"]["baseline_target_C"]),
    )
    feasible_weights = build_weight_vector(
        optimizer_defaults,
        "balanced",
        include_energy_cost=False,
        include_labor_cost=False,
        include_cooling_cost=False,
    )
    final_weights = build_weight_vector(
        optimizer_defaults,
        optimization_inputs.optimization_mode,
        include_energy_cost=optimization_inputs.include_energy_cost,
        include_labor_cost=optimization_inputs.include_labor_cost,
        include_cooling_cost=optimization_inputs.include_cooling_cost,
        custom_weights=optimization_inputs.custom_weights,
    )
    day_heat_low = baseline_candidate.day_heating_min_temp_C - max_delta_temp_c
    day_heat_high = baseline_candidate.day_heating_min_temp_C + max_delta_temp_c
    night_heat_low = baseline_candidate.night_heating_min_temp_C - max_delta_temp_c
    night_heat_high = baseline_candidate.night_heating_min_temp_C + max_delta_temp_c
    day_cool_low = day_heat_low + 0.8
    night_cool_low = night_heat_low + 0.8
    day_cool_high = max(
        baseline_candidate.day_cooling_target_C + max_delta_temp_c,
        day_heat_high + 0.8,
    )
    night_cool_high = max(
        baseline_candidate.night_cooling_target_C + max_delta_temp_c,
        night_heat_high + 0.8,
    )
    bounds = [
        (day_heat_low, day_heat_high),
        (night_heat_low, night_heat_high),
        (day_cool_low, day_cool_high),
        (night_cool_low, night_cool_high),
    ]
    start = [
        baseline_candidate.day_heating_min_temp_C,
        baseline_candidate.night_heating_min_temp_C,
        baseline_candidate.day_cooling_target_C,
        baseline_candidate.night_cooling_target_C,
    ]

    def _feasibility_objective(vector):
        candidate = _evaluate_control_candidate(
            candidate=_candidate_from_vector(
                vector=vector,
                context=context,
                base_candidate=baseline_candidate,
            ),
            context=context,
            optimization_inputs=optimization_inputs,
            weights=feasible_weights,
        )
        feasibility = candidate["feasibility"]
        objective = float(candidate["controls"]["mean_temp_C"])
        if not feasibility["target_node_hit"]:
            objective += 250.0 * float(candidate["objective_breakdown"]["node_target_penalty"])
        if not feasibility["carbon_margin_positive"]:
            objective += 220.0 * float(candidate["objective_breakdown"]["carbon_margin_penalty"])
        objective += 120.0 * (
            float(candidate["objective_breakdown"].get("disease_penalty", 0.0))
            + float(candidate["objective_breakdown"].get("stress_penalty", 0.0))
        )
        return objective

    stage1 = bounded_coordinate_minimize(
        _feasibility_objective,
        x0=start,
        bounds=bounds,
    )
    feasible_seed = list(stage1.x) if stage1.success else list(start)

    def _final_objective(vector):
        candidate = _evaluate_control_candidate(
            candidate=_candidate_from_vector(
                vector=vector,
                context=context,
                base_candidate=baseline_candidate,
            ),
            context=context,
            optimization_inputs=optimization_inputs,
            weights=final_weights,
        )
        return float(candidate["objective_value"])

    stage2 = bounded_coordinate_minimize(
        _final_objective,
        x0=feasible_seed,
        bounds=bounds,
    )
    thermal_seed = list(stage2.x) if stage2.success else feasible_seed
    thermal_candidate = _candidate_from_vector(
        vector=thermal_seed,
        context=context,
        base_candidate=baseline_candidate,
    )
    coordinated_candidate, best_candidate = _coordination_grid(
        context=context,
        base_candidate=thermal_candidate,
        optimization_inputs=optimization_inputs,
        weights=final_weights,
    )
    coordinated_candidate, best_candidate = _minimum_sufficient_refinement(
        context=context,
        base_candidate=coordinated_candidate,
        best_eval=best_candidate,
        optimization_inputs=optimization_inputs,
        weights=final_weights,
        thermal_bounds=bounds,
    )
    best_candidate["baseline_targets"] = {
        "day_min_temp_C": round(baseline_candidate.day_heating_min_temp_C, 6),
        "night_min_temp_C": round(baseline_candidate.night_heating_min_temp_C, 6),
        "day_cooling_target_C": round(baseline_candidate.day_cooling_target_C, 6),
        "night_cooling_target_C": round(baseline_candidate.night_cooling_target_C, 6),
        "mean_temp_C": round(((baseline_candidate.day_heating_min_temp_C * 14.0) + (baseline_candidate.night_heating_min_temp_C * 10.0)) / 24.0, 6),
    }
    best_candidate["solver"] = {
        "stage1_success": bool(stage1.success),
        "stage2_success": bool(stage2.success),
        "stage1_message": str(stage1.message),
        "stage2_message": str(stage2.message),
        "stage2_coordination": "coordinate-descent-grid",
        "coordinated_candidate": coordinated_candidate.as_dict(),
    }
    return best_candidate
