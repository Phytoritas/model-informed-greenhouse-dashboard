"""RTR scenario and sensitivity surfaces over the internal optimizer."""

from __future__ import annotations

from typing import Any, Mapping

from .controller_contract import RTROptimizationInputs
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


def run_rtr_scenarios(
    *,
    context,
    optimization_inputs: RTROptimizationInputs,
) -> list[dict[str, Any]]:
    baseline_targets = {
        "day_min_temp_C": float(
            context.ops_config.get(
                "heating_set_C",
                context.canonical_state["baseline_rtr"]["baseline_target_C"],
            )
        ),
        "night_min_temp_C": float(
            context.ops_config.get(
                "heating_set_C",
                context.canonical_state["baseline_rtr"]["baseline_target_C"],
            )
        ),
    }
    scenarios: list[dict[str, Any]] = []
    for mode in ("balanced", "growth_priority", "energy_saving", "labor_saving"):
        candidate_inputs = RTROptimizationInputs(
            crop=optimization_inputs.crop,
            greenhouse_id=optimization_inputs.greenhouse_id,
            target_node_development_per_day=optimization_inputs.target_node_development_per_day,
            optimization_mode=mode,  # type: ignore[arg-type]
            include_energy_cost=optimization_inputs.include_energy_cost,
            include_labor_cost=optimization_inputs.include_labor_cost,
            target_horizon=optimization_inputs.target_horizon,
            actual_area_m2=optimization_inputs.actual_area_m2,
            actual_area_pyeong=optimization_inputs.actual_area_pyeong,
            custom_weights=optimization_inputs.custom_weights,
            guardrails=optimization_inputs.guardrails,
            user_labor_cost_coefficient=optimization_inputs.user_labor_cost_coefficient,
        )
        result = optimize_rtr_targets(
            context=context,
            optimization_inputs=candidate_inputs,
        )
        scenarios.append(
            {
                "label": mode,
                "mode": "optimizer",
                "mean_temp_C": result["controls"]["mean_temp_C"],
                "day_min_temp_C": result["controls"]["day_min_temp_C"],
                "night_min_temp_C": result["controls"]["night_min_temp_C"],
                "node_rate_day": result["node_summary"]["predicted_rate_day"],
                "net_carbon": result["flux_projection"]["carbon_margin"],
                "respiration": result["flux_projection"]["respiration_umol_m2_s"],
                "energy_kwh_m2_day": result["objective_breakdown"]["energy_cost"],
                "labor_index": result["objective_breakdown"]["labor_index"],
                "yield_proxy_basis_net_assim": result["flux_projection"]["net_assim_umol_m2_s"],
                "yield_trend": (
                    "up"
                    if result["flux_projection"]["carbon_margin"] >= 0 and result["node_summary"]["target_hit"]
                    else "guarded"
                ),
                "recommendation_badge": "recommended" if mode == optimization_inputs.optimization_mode else "compare",
                "confidence": _scenario_confidence(result),
                "risk_flags": result["feasibility"]["risk_flags"],
                "objective_breakdown": result["objective_breakdown"],
            }
        )

    baseline_eval = evaluate_rtr_candidate(
        context=context,
        optimization_inputs=optimization_inputs,
        weights={
            "temp": 1.0,
            "node": 0.0,
            "carbon": 0.0,
            "sink": 0.0,
            "resp": 0.0,
            "risk": 0.0,
            "energy": 0.0,
            "labor": 0.0,
        },
        day_min_temp_c=float(baseline_targets["day_min_temp_C"]),
        night_min_temp_c=float(baseline_targets["night_min_temp_C"]),
        co2_target_ppm=float(context.ops_config.get("co2_target_ppm", context.canonical_state["env"]["CO2_ppm"])),
        rh_target_pct=float(context.canonical_state["env"]["RH_pct"]),
    )
    scenarios.insert(
        0,
        {
            "label": "baseline",
            "mode": "baseline",
            "mean_temp_C": baseline_eval["controls"]["mean_temp_C"],
            "day_min_temp_C": baseline_eval["controls"]["day_min_temp_C"],
            "night_min_temp_C": baseline_eval["controls"]["night_min_temp_C"],
            "node_rate_day": baseline_eval["node_summary"]["predicted_rate_day"],
            "net_carbon": baseline_eval["flux_projection"]["carbon_margin"],
            "respiration": baseline_eval["flux_projection"]["respiration_umol_m2_s"],
            "energy_kwh_m2_day": baseline_eval["objective_breakdown"]["energy_cost"],
            "labor_index": baseline_eval["objective_breakdown"]["labor_index"],
            "yield_proxy_basis_net_assim": baseline_eval["flux_projection"]["net_assim_umol_m2_s"],
            "yield_trend": (
                "up"
                if baseline_eval["flux_projection"]["carbon_margin"] >= 0 and baseline_eval["node_summary"]["target_hit"]
                else "guarded"
            ),
            "recommendation_badge": "baseline",
            "confidence": _scenario_confidence(baseline_eval),
            "risk_flags": baseline_eval["feasibility"]["risk_flags"],
            "objective_breakdown": baseline_eval["objective_breakdown"],
        },
    )
    return scenarios


def compute_rtr_temperature_sensitivity(
    *,
    context,
    optimization_inputs: RTROptimizationInputs,
    optimized_candidate: Mapping[str, Any],
    step_c: float = 0.3,
) -> dict[str, Any]:
    base_day = float(optimized_candidate["controls"]["day_min_temp_C"])
    base_night = float(optimized_candidate["controls"]["night_min_temp_C"])
    base_node = float(optimized_candidate["node_summary"]["predicted_rate_day"])
    base_energy = float(optimized_candidate["objective_breakdown"]["energy_cost"])
    base_carbon = float(optimized_candidate["flux_projection"]["carbon_margin"])

    def _eval(day_c: float, night_c: float):
        return evaluate_rtr_candidate(
            context=context,
            optimization_inputs=optimization_inputs,
            weights={
                "temp": 1.0,
                "node": 1.0,
                "carbon": 1.0,
                "sink": 1.0,
                "resp": 1.0,
                "risk": 1.0,
                "energy": 1.0,
                "labor": 1.0,
            },
            day_min_temp_c=day_c,
            night_min_temp_c=night_c,
            co2_target_ppm=float(context.ops_config.get("co2_target_ppm", context.canonical_state["env"]["CO2_ppm"])),
            rh_target_pct=float(context.canonical_state["env"]["RH_pct"]),
        )

    warmer = _eval(base_day + step_c, base_night + step_c)
    cooler = _eval(base_day - step_c, base_night - step_c)
    return {
        "crop": optimization_inputs.crop,
        "step_c": step_c,
        "sensitivities": [
            {
                "control": "temperature_day",
                "target": "predicted_node_rate_day",
                "derivative": round(
                    (
                        float(warmer["node_summary"]["predicted_rate_day"])
                        - float(cooler["node_summary"]["predicted_rate_day"])
                    ) / (2 * step_c),
                    6,
                ),
                "elasticity": round(
                    (
                        (
                            (
                                float(warmer["node_summary"]["predicted_rate_day"])
                                - float(cooler["node_summary"]["predicted_rate_day"])
                            ) / max(abs(base_node), 1e-9)
                        ) / (2 * step_c / max(abs(base_day), 1.0))
                    ),
                    6,
                ),
                "direction": "increase"
                if warmer["node_summary"]["predicted_rate_day"] >= cooler["node_summary"]["predicted_rate_day"]
                else "decrease",
                "trust_region": {"low": -step_c, "high": step_c},
                "method": "finite_difference",
                "perturbation_size": step_c,
                "valid": True,
                "scenario_alignment": warmer["node_summary"]["predicted_rate_day"] >= cooler["node_summary"]["predicted_rate_day"],
            },
            {
                "control": "temperature_night",
                "target": "carbon_margin",
                "derivative": round(
                    (
                        float(warmer["flux_projection"]["carbon_margin"])
                        - float(cooler["flux_projection"]["carbon_margin"])
                    ) / (2 * step_c),
                    6,
                ),
                "elasticity": round(
                    (
                        (
                            (
                                float(warmer["flux_projection"]["carbon_margin"])
                                - float(cooler["flux_projection"]["carbon_margin"])
                            ) / max(abs(base_carbon), 1e-9)
                        ) / (2 * step_c / max(abs(base_night), 1.0))
                    ),
                    6,
                ),
                "direction": "increase"
                if warmer["flux_projection"]["carbon_margin"] >= cooler["flux_projection"]["carbon_margin"]
                else "decrease",
                "trust_region": {"low": -step_c, "high": step_c},
                "method": "finite_difference",
                "perturbation_size": step_c,
                "valid": True,
                "scenario_alignment": warmer["flux_projection"]["carbon_margin"] >= cooler["flux_projection"]["carbon_margin"],
            },
            {
                "control": "temperature_mean",
                "target": "energy_cost",
                "derivative": round(
                    (
                        float(warmer["objective_breakdown"]["energy_cost"])
                        - float(cooler["objective_breakdown"]["energy_cost"])
                    ) / (2 * step_c),
                    6,
                ),
                "elasticity": round(
                    (
                        (
                            (
                                float(warmer["objective_breakdown"]["energy_cost"])
                                - float(cooler["objective_breakdown"]["energy_cost"])
                            ) / max(abs(base_energy), 1e-9)
                        )
                        / (2 * step_c / max(abs((base_day + base_night) / 2.0), 1.0))
                    ),
                    6,
                ),
                "direction": "increase"
                if warmer["objective_breakdown"]["energy_cost"] >= cooler["objective_breakdown"]["energy_cost"]
                else "decrease",
                "trust_region": {"low": -step_c, "high": step_c},
                "method": "finite_difference",
                "perturbation_size": step_c,
                "valid": True,
                "scenario_alignment": warmer["objective_breakdown"]["energy_cost"] >= cooler["objective_breakdown"]["energy_cost"],
            },
        ],
        "base": {
            "node_rate_day": base_node,
            "carbon_margin": base_carbon,
            "energy_cost": base_energy,
        },
    }
