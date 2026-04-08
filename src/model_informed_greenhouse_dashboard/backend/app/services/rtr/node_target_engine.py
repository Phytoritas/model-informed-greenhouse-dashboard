"""Crop-specific node or development-rate targeting for RTR optimization."""

from __future__ import annotations

import math
from typing import Any, Mapping

from .controller_contract import RTROptimizationInputs, horizon_hours


def _safe_float(value: Any, default: float = 0.0) -> float:
    try:
        if value is None:
            return default
        return float(value)
    except (TypeError, ValueError):
        return default


def predict_development_rate_day(
    *,
    crop: str,
    raw_adapter_state: Mapping[str, Any],
    mean_air_temp_c: float,
) -> float:
    if crop == "cucumber":
        nodes = _safe_float(raw_adapter_state.get("nodes"), 0.0)
        threshold_before = _safe_float(raw_adapter_state.get("threshold_before"), 26.3)
        threshold_after = _safe_float(raw_adapter_state.get("threshold_after"), 15.6)
        reproductive_threshold = _safe_float(raw_adapter_state.get("reproductive_node_threshold"), 15.0)
        threshold = threshold_before if nodes < reproductive_threshold else threshold_after
        growing_temp = max(0.0, mean_air_temp_c - 10.0)
        return 0.0 if threshold <= 1e-9 else growing_temp / threshold

    t_for_fr = max(1.0, mean_air_temp_c)
    if bool(raw_adapter_state.get("fr_clamp_to_valid", False)):
        t_for_fr = min(
            t_for_fr,
            _safe_float(raw_adapter_state.get("fr_T_max_valid"), 23.0),
        )
    return max(0.0, -0.2903 + (0.1454 * math.log(max(1.0, t_for_fr))))


def build_node_target_summary(
    *,
    optimization_inputs: RTROptimizationInputs,
    raw_adapter_state: Mapping[str, Any],
    current_mean_air_temp_c: float,
    candidate_mean_air_temp_c: float,
) -> dict[str, float | bool]:
    current_rate = predict_development_rate_day(
        crop=optimization_inputs.crop,
        raw_adapter_state=raw_adapter_state,
        mean_air_temp_c=current_mean_air_temp_c,
    )
    predicted_rate = predict_development_rate_day(
        crop=optimization_inputs.crop,
        raw_adapter_state=raw_adapter_state,
        mean_air_temp_c=candidate_mean_air_temp_c,
    )
    day_hours, night_hours = horizon_hours(optimization_inputs.target_horizon)
    horizon_fraction = (day_hours + night_hours) / 24.0
    target_rate = max(0.0, optimization_inputs.target_node_development_per_day) * horizon_fraction
    gap = target_rate - predicted_rate
    return {
        "target_rate_day": round(target_rate, 6),
        "observed_rate_day": round(current_rate, 6),
        "predicted_rate_day": round(predicted_rate, 6),
        "gap_rate_day": round(gap, 6),
        "target_hit": bool(gap <= 0.0),
    }
