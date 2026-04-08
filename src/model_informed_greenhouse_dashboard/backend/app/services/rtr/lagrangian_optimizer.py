"""Two-stage bounded RTR optimization built on internal crop and energy models."""

from __future__ import annotations

from typing import Any, Mapping

from scipy.optimize import minimize

from .controller_contract import (
    RTROptimizationInputs,
    build_weight_vector,
    resolve_guardrail,
)
from .internal_model_bridge import InternalModelContext
from .objective_terms import evaluate_rtr_candidate


def _bounded(value: float, low: float, high: float) -> float:
    return max(low, min(high, value))


def _derive_aux_controls(
    *,
    context: InternalModelContext,
    day_min_temp_c: float,
    night_min_temp_c: float,
) -> dict[str, float]:
    env = context.canonical_state["env"]
    baseline = context.canonical_state["baseline_rtr"]
    day_delta = day_min_temp_c - float(baseline["baseline_target_C"])
    humidity_gap = max(0.0, float(env["RH_pct"]) - 82.0)
    vent_bias_c = _bounded((0.4 * max(0.0, day_delta)) + (0.02 * humidity_gap), -0.3, 1.2)
    screen_bias_pct = _bounded(
        (-3.5 * max(0.0, day_delta)) + (0.25 * max(0.0, 70.0 - float(env["RH_pct"]))),
        -10.0,
        12.0,
    )
    return {
        "vent_bias_C": round(vent_bias_c, 6),
        "screen_bias_pct": round(screen_bias_pct, 6),
    }


def _candidate_from_vector(
    *,
    vector: list[float] | tuple[float, ...],
    context: InternalModelContext,
    optimization_inputs: RTROptimizationInputs,
    weights: Mapping[str, float],
) -> dict[str, Any]:
    day_min_temp_c = float(vector[0])
    night_min_temp_c = float(vector[1])
    aux = _derive_aux_controls(
        context=context,
        day_min_temp_c=day_min_temp_c,
        night_min_temp_c=night_min_temp_c,
    )
    return evaluate_rtr_candidate(
        context=context,
        optimization_inputs=optimization_inputs,
        weights=weights,
        day_min_temp_c=day_min_temp_c,
        night_min_temp_c=night_min_temp_c,
        vent_bias_c=aux["vent_bias_C"],
        screen_bias_pct=aux["screen_bias_pct"],
        co2_target_ppm=float(context.ops_config.get("co2_target_ppm", context.canonical_state["env"]["CO2_ppm"])),
        rh_target_pct=float(context.canonical_state["env"]["RH_pct"]),
    )


def optimize_rtr_targets(
    *,
    context: InternalModelContext,
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
    baseline_target_c = float(context.canonical_state["baseline_rtr"]["baseline_target_C"])
    baseline_day_c = max(
        float(context.ops_config.get("heating_set_C", baseline_target_c)),
        baseline_target_c,
    )
    baseline_night_c = float(context.ops_config.get("heating_set_C", baseline_target_c))

    feasible_weights = build_weight_vector(
        optimizer_defaults,
        "balanced",
        include_energy_cost=False,
        include_labor_cost=False,
    )
    final_weights = build_weight_vector(
        optimizer_defaults,
        optimization_inputs.optimization_mode,
        include_energy_cost=optimization_inputs.include_energy_cost,
        include_labor_cost=optimization_inputs.include_labor_cost,
        custom_weights=optimization_inputs.custom_weights,
    )
    bounds = [
        (baseline_day_c - max_delta_temp_c, baseline_day_c + max_delta_temp_c),
        (baseline_night_c - max_delta_temp_c, baseline_night_c + max_delta_temp_c),
    ]
    start = [baseline_day_c, baseline_night_c]

    def _feasibility_objective(vector):
        candidate = _candidate_from_vector(
            vector=vector,
            context=context,
            optimization_inputs=optimization_inputs,
            weights=feasible_weights,
        )
        feasibility = candidate["feasibility"]
        penalty = 0.0
        if not feasibility["target_node_hit"]:
            penalty += 250.0 * candidate["objective_breakdown"]["node_target_penalty"]
        if not feasibility["carbon_margin_positive"]:
            penalty += 220.0 * candidate["objective_breakdown"]["carbon_margin_penalty"]
        penalty += 120.0 * (
            candidate["constraint_checks"]["disease_risk_penalty"]
            + candidate["constraint_checks"]["stress_penalty"]
        )
        return float(candidate["controls"]["mean_temp_C"]) + penalty

    stage1 = minimize(
        _feasibility_objective,
        x0=start,
        bounds=bounds,
        method="L-BFGS-B",
    )
    feasible_seed = stage1.x.tolist() if stage1.success else list(start)

    def _final_objective(vector):
        candidate = _candidate_from_vector(
            vector=vector,
            context=context,
            optimization_inputs=optimization_inputs,
            weights=final_weights,
        )
        return float(candidate["objective_value"])

    stage2 = minimize(
        _final_objective,
        x0=feasible_seed,
        bounds=bounds,
        method="L-BFGS-B",
    )
    chosen_vector = stage2.x.tolist() if stage2.success else feasible_seed
    best_candidate = _candidate_from_vector(
        vector=chosen_vector,
        context=context,
        optimization_inputs=optimization_inputs,
        weights=final_weights,
    )
    best_candidate["baseline_targets"] = {
        "day_min_temp_C": round(baseline_day_c, 6),
        "night_min_temp_C": round(baseline_night_c, 6),
        "mean_temp_C": round((baseline_day_c * 14.0 + baseline_night_c * 10.0) / 24.0, 6),
    }
    best_candidate["solver"] = {
        "stage1_success": bool(stage1.success),
        "stage2_success": bool(stage2.success),
        "stage1_message": str(stage1.message),
        "stage2_message": str(stage2.message),
    }
    return best_candidate
