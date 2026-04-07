"""Finite-difference sensitivity helpers for the SmartGrow model-runtime seam."""

from __future__ import annotations

from typing import Any, Mapping

from .constraint_engine import CONTROL_SPECS, trust_region_for
from .scenario_runner import DEFAULT_SCENARIO_HORIZONS_HOURS, run_bounded_scenario


SUPPORTED_DERIVATIVE_TARGETS = {
    "predicted_yield_24h": ("yield_pred", 24),
    "predicted_yield_72h": ("yield_pred", 72),
    "predicted_yield_7d": ("yield_pred", 168),
    "predicted_yield_14d": ("yield_pred", 336),
    "canopy_A_24h": ("canopy_A_pred", 24),
    "canopy_A_72h": ("canopy_A_pred", 72),
    "transpiration_72h": ("transpiration_pred", 72),
    "energy_cost_72h": ("energy_cost_pred", 72),
    "source_sink_balance_72h": ("source_sink_balance_score", 72),
}


def _resolve_target_value(
    scenario_payload: Mapping[str, Any],
    derivative_target: str,
) -> float:
    if derivative_target not in SUPPORTED_DERIVATIVE_TARGETS:
        raise ValueError(f"Unsupported derivative target: {derivative_target}")

    field_name, horizon_hours = SUPPORTED_DERIVATIVE_TARGETS[derivative_target]
    for row in scenario_payload["outputs"]:
        if int(row["horizon_hours"]) == horizon_hours:
            return float(row[field_name])
    for row in scenario_payload["baseline_outputs"]:
        if int(row["horizon_hours"]) == horizon_hours:
            return float(row[field_name])

    raise ValueError(
        f"Scenario payload does not contain the required horizon {horizon_hours} for {derivative_target}."
    )


def _scenario_alignment(
    *,
    baseline_value: float,
    derivative_value: float,
    positive_value: float,
    negative_value: float,
) -> bool:
    if derivative_value > 0:
        return positive_value >= baseline_value and baseline_value >= negative_value
    if derivative_value < 0:
        return positive_value <= baseline_value and baseline_value <= negative_value
    return abs(positive_value - negative_value) <= 1e-9


def compute_local_sensitivities(
    snapshot_record: Mapping[str, Any],
    *,
    derivative_target: str = "predicted_yield_14d",
    horizon_hours: int = 72,
    controls: list[str] | None = None,
    step_overrides: Mapping[str, Any] | None = None,
) -> dict[str, Any]:
    """Compute bounded finite-difference sensitivities around the current snapshot."""
    del horizon_hours  # The derivative target controls which horizon is consumed today.

    selected_controls = controls or list(CONTROL_SPECS)
    unknown_controls = sorted(control for control in selected_controls if control not in CONTROL_SPECS)
    if unknown_controls:
        raise ValueError(f"Unknown control variables: {', '.join(unknown_controls)}")

    target_field, target_horizon = SUPPORTED_DERIVATIVE_TARGETS[derivative_target]
    horizons = sorted(set((*DEFAULT_SCENARIO_HORIZONS_HOURS, target_horizon)))
    baseline = run_bounded_scenario(snapshot_record, controls={}, horizons_hours=horizons)
    baseline_value = _resolve_target_value(baseline, derivative_target)

    sensitivities: list[dict[str, Any]] = []
    valid_count = 0
    alignment_count = 0

    for control_name in selected_controls:
        spec = CONTROL_SPECS[control_name]
        requested_step = float(step_overrides.get(control_name, spec.default_step)) if step_overrides else spec.default_step
        trust_region = trust_region_for(control_name)

        if requested_step <= 0:
            sensitivities.append(
                {
                    "control": control_name,
                    "target": derivative_target,
                    "derivative": 0.0,
                    "elasticity": 0.0,
                    "direction": "neutral",
                    "trust_region": trust_region,
                    "valid": False,
                    "method": "finite_difference",
                    "perturbation_size": requested_step,
                    "scenario_alignment": False,
                }
            )
            continue

        max_allowed_step = min(abs(trust_region["low"]), abs(trust_region["high"]))
        if requested_step > max_allowed_step:
            sensitivities.append(
                {
                    "control": control_name,
                    "target": derivative_target,
                    "derivative": 0.0,
                    "elasticity": 0.0,
                    "direction": "neutral",
                    "trust_region": trust_region,
                    "valid": False,
                    "method": "finite_difference",
                    "perturbation_size": requested_step,
                    "scenario_alignment": False,
                }
            )
            continue

        positive = run_bounded_scenario(
            snapshot_record,
            controls={control_name: requested_step},
            horizons_hours=horizons,
        )
        negative = run_bounded_scenario(
            snapshot_record,
            controls={control_name: -requested_step},
            horizons_hours=horizons,
        )
        positive_value = _resolve_target_value(positive, derivative_target)
        negative_value = _resolve_target_value(negative, derivative_target)
        derivative_value = (positive_value - negative_value) / (2.0 * requested_step)
        elasticity = 0.0 if abs(baseline_value) <= 1e-9 else derivative_value * requested_step / baseline_value
        direction = "neutral"
        if derivative_value > 1e-9:
            direction = "increase"
        elif derivative_value < -1e-9:
            direction = "decrease"
        alignment = _scenario_alignment(
            baseline_value=baseline_value,
            derivative_value=derivative_value,
            positive_value=positive_value,
            negative_value=negative_value,
        )

        valid_count += 1
        if alignment:
            alignment_count += 1

        sensitivities.append(
            {
                "control": control_name,
                "target": derivative_target,
                "derivative": round(derivative_value, 6),
                "elasticity": round(elasticity, 6),
                "direction": direction,
                "trust_region": trust_region,
                "valid": True,
                "method": "finite_difference",
                "perturbation_size": requested_step,
                "scenario_alignment": alignment,
                "bounded_delta": round(positive_value - baseline_value, 6),
            }
        )

    confidence = 0.0
    if sensitivities:
        confidence = max(
            0.0,
            min(
                0.95,
                0.82
                * (valid_count / len(sensitivities))
                * (alignment_count / max(valid_count, 1)),
            ),
        )

    return {
        "snapshot_id": snapshot_record.get("snapshot_id"),
        "crop": snapshot_record.get("crop") or snapshot_record.get("normalized_snapshot", {}).get("crop"),
        "greenhouse_id": snapshot_record.get("greenhouse_id")
        or snapshot_record.get("normalized_snapshot", {}).get("greenhouse_id"),
        "horizon_hours": target_horizon,
        "target_field": target_field,
        "derivative_target": derivative_target,
        "sensitivities": sensitivities,
        "confidence": round(confidence, 6),
    }
