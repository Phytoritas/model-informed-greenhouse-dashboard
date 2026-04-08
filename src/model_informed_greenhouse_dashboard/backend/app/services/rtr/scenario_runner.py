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


def _serialize_candidate_scenario(
    *,
    label: str,
    mode: str,
    candidate: Mapping[str, Any],
    recommendation_badge: str,
) -> dict[str, Any]:
    return {
        "label": label,
        "mode": mode,
        "mean_temp_C": candidate["controls"]["mean_temp_C"],
        "day_min_temp_C": candidate["controls"]["day_min_temp_C"],
        "night_min_temp_C": candidate["controls"]["night_min_temp_C"],
        "node_rate_day": candidate["node_summary"]["predicted_rate_day"],
        "net_carbon": candidate["flux_projection"]["carbon_margin"],
        "respiration": candidate["flux_projection"]["respiration_umol_m2_s"],
        "energy_kwh_m2_day": candidate["objective_breakdown"]["energy_cost"],
        "labor_index": candidate["objective_breakdown"]["labor_index"],
        "yield_proxy_basis_net_assim": candidate["flux_projection"]["net_assim_umol_m2_s"],
        "yield_trend": (
            "up"
            if candidate["flux_projection"]["carbon_margin"] >= 0 and candidate["node_summary"]["target_hit"]
            else "guarded"
        ),
        "recommendation_badge": recommendation_badge,
        "confidence": _scenario_confidence(candidate),
        "risk_flags": candidate["feasibility"]["risk_flags"],
        "objective_breakdown": candidate["objective_breakdown"],
    }


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
            _serialize_candidate_scenario(
                label=mode,
                mode="optimizer",
                candidate=result,
                recommendation_badge="recommended" if mode == optimization_inputs.optimization_mode else "compare",
            )
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
        _serialize_candidate_scenario(
            label="baseline",
            mode="baseline",
            candidate=baseline_eval,
            recommendation_badge="baseline",
        ),
    )

    baseline_compare_weights = {
        "temp": 1.0,
        "node": 1.0,
        "carbon": 1.0,
        "sink": 1.0,
        "resp": 1.0,
        "risk": 1.0,
        "energy": 1.0,
        "labor": 1.0,
    }
    offset_specs = (
        ("offset_minus_0_3c", -0.3),
        ("offset_plus_0_3c", 0.3),
        ("offset_plus_0_6c", 0.6),
    )
    offset_rows: list[dict[str, Any]] = []
    for label, offset_c in offset_specs:
        offset_candidate = evaluate_rtr_candidate(
            context=context,
            optimization_inputs=optimization_inputs,
            weights=baseline_compare_weights,
            day_min_temp_c=float(baseline_targets["day_min_temp_C"]) + offset_c,
            night_min_temp_c=float(baseline_targets["night_min_temp_C"]) + offset_c,
            co2_target_ppm=float(context.ops_config.get("co2_target_ppm", context.canonical_state["env"]["CO2_ppm"])),
            rh_target_pct=float(context.canonical_state["env"]["RH_pct"]),
        )
        offset_rows.append(
            _serialize_candidate_scenario(
                label=label,
                mode="offset",
                candidate=offset_candidate,
                recommendation_badge="compare",
            )
        )

    scenarios[1:1] = offset_rows
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
    base_humidity_risk = float(optimized_candidate["objective_breakdown"]["humidity_risk_penalty"])
    base_disease_penalty = float(optimized_candidate["objective_breakdown"]["disease_penalty"])
    base_screen = float(optimized_candidate["controls"].get("screen_bias_pct", 0.0))

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

    def _eval_screen(screen_bias_pct: float):
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
            day_min_temp_c=base_day,
            night_min_temp_c=base_night,
            vent_bias_c=float(optimized_candidate["controls"].get("vent_bias_C", 0.0)),
            screen_bias_pct=screen_bias_pct,
            co2_target_ppm=float(context.ops_config.get("co2_target_ppm", context.canonical_state["env"]["CO2_ppm"])),
            rh_target_pct=float(context.canonical_state["env"]["RH_pct"]),
        )

    warmer = _eval(base_day + step_c, base_night + step_c)
    cooler = _eval(base_day - step_c, base_night - step_c)
    screen_step_pct = max(1.0, step_c * 10.0)
    screen_opener = _eval_screen(base_screen + screen_step_pct)
    screen_closer = _eval_screen(base_screen - screen_step_pct)
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
            {
                "control": "screen_bias",
                "target": "humidity_risk_penalty",
                "derivative": round(
                    (
                        float(screen_opener["objective_breakdown"]["humidity_risk_penalty"])
                        - float(screen_closer["objective_breakdown"]["humidity_risk_penalty"])
                    ) / (2 * screen_step_pct),
                    6,
                ),
                "elasticity": round(
                    (
                        (
                            (
                                float(screen_opener["objective_breakdown"]["humidity_risk_penalty"])
                                - float(screen_closer["objective_breakdown"]["humidity_risk_penalty"])
                            ) / max(abs(base_humidity_risk), 1e-9)
                        ) / (2 * screen_step_pct / max(abs(base_screen), 1.0))
                    ),
                    6,
                ),
                "direction": "increase"
                if screen_opener["objective_breakdown"]["humidity_risk_penalty"]
                >= screen_closer["objective_breakdown"]["humidity_risk_penalty"]
                else "decrease",
                "trust_region": {"low": -screen_step_pct, "high": screen_step_pct},
                "method": "finite_difference",
                "perturbation_size": screen_step_pct,
                "valid": True,
                "scenario_alignment": screen_opener["objective_breakdown"]["humidity_risk_penalty"]
                >= screen_closer["objective_breakdown"]["humidity_risk_penalty"],
            },
            {
                "control": "screen_bias",
                "target": "disease_penalty",
                "derivative": round(
                    (
                        float(screen_opener["objective_breakdown"]["disease_penalty"])
                        - float(screen_closer["objective_breakdown"]["disease_penalty"])
                    ) / (2 * screen_step_pct),
                    6,
                ),
                "elasticity": round(
                    (
                        (
                            (
                                float(screen_opener["objective_breakdown"]["disease_penalty"])
                                - float(screen_closer["objective_breakdown"]["disease_penalty"])
                            ) / max(abs(base_disease_penalty), 1e-9)
                        ) / (2 * screen_step_pct / max(abs(base_screen), 1.0))
                    ),
                    6,
                ),
                "direction": "increase"
                if screen_opener["objective_breakdown"]["disease_penalty"]
                >= screen_closer["objective_breakdown"]["disease_penalty"]
                else "decrease",
                "trust_region": {"low": -screen_step_pct, "high": screen_step_pct},
                "method": "finite_difference",
                "perturbation_size": screen_step_pct,
                "valid": True,
                "scenario_alignment": screen_opener["objective_breakdown"]["disease_penalty"]
                >= screen_closer["objective_breakdown"]["disease_penalty"],
            },
        ],
        "base": {
            "node_rate_day": base_node,
            "carbon_margin": base_carbon,
            "energy_cost": base_energy,
        },
    }
