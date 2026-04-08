"""Derived RTR-equivalent metrics from optimized minimum temperature targets."""

from __future__ import annotations

from typing import Any, Mapping


def derive_rtr_equivalent(
    *,
    baseline_targets: Mapping[str, Any],
    optimized_targets: Mapping[str, Any],
    max_ratio_delta: float,
) -> dict[str, float]:
    baseline_mean = float(baseline_targets["mean_temp_C"])
    optimized_mean = float(optimized_targets["mean_temp_C"])
    delta_temp_c = optimized_mean - baseline_mean
    baseline_ratio = 1.0
    normalized_delta = 0.0 if abs(baseline_mean) <= 1e-9 else delta_temp_c / baseline_mean
    delta_ratio = max(-max_ratio_delta, min(max_ratio_delta, normalized_delta))
    optimized_ratio = baseline_ratio + delta_ratio
    return {
        "baseline_ratio": round(baseline_ratio, 6),
        "optimized_ratio": round(optimized_ratio, 6),
        "delta_ratio": round(delta_ratio, 6),
        "delta_temp_C": round(delta_temp_c, 6),
    }
