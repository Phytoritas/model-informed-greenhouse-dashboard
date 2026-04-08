"""Labor-load proxy terms for RTR optimization."""

from __future__ import annotations

from typing import Any, Mapping


def _safe_float(value: Any, default: float = 0.0) -> float:
    try:
        if value is None:
            return default
        return float(value)
    except (TypeError, ValueError):
        return default


def estimate_labor_projection(
    *,
    crop: str,
    predicted_node_rate_day: float,
    observed_node_rate_day: float,
    fruit_load: float,
    lai: float,
    crop_specific: Mapping[str, Any],
    user_labor_cost_coefficient: float | None = None,
) -> dict[str, float]:
    node_gain = max(0.0, predicted_node_rate_day - observed_node_rate_day)
    harvest_load_index = max(0.0, fruit_load) * (0.018 + (0.15 * node_gain))
    training_load_index = max(0.0, node_gain) * (1.15 if crop == "cucumber" else 0.85)
    pruning_load_index = max(0.0, lai - 2.0) * 0.45 + (node_gain * 0.85)
    thinning_load_index = 0.0
    pollination_or_cluster_management_index = 0.0
    canopy_management_load_index = max(0.0, lai - 2.5) * 0.4

    if crop == "cucumber":
        remaining_leaves = max(1.0, _safe_float(crop_specific.get("remaining_leaves"), 15.0))
        pruning_load_index += max(0.0, fruit_load / remaining_leaves) * 0.35
        thinning_load_index = max(0.0, fruit_load / remaining_leaves) * 0.18
        canopy_management_load_index += max(0.0, (remaining_leaves - 16.0) / 8.0)
    else:
        active_trusses = max(1.0, _safe_float(crop_specific.get("active_trusses"), 4.0))
        partition_ratio = max(0.0, _safe_float(crop_specific.get("fruit_partition_ratio"), 0.55))
        thinning_load_index = max(0.0, fruit_load / active_trusses) * (0.22 + (0.15 * partition_ratio))
        pollination_or_cluster_management_index = active_trusses * (0.04 + (0.08 * node_gain))
        canopy_management_load_index += active_trusses * 0.05

    labor_index = (
        harvest_load_index
        + training_load_index
        + pruning_load_index
        + thinning_load_index
        + pollination_or_cluster_management_index
        + canopy_management_load_index
    )
    labor_hours_m2_day = labor_index * 0.035
    hourly_rate = float(user_labor_cost_coefficient or 0.0)
    labor_cost_krw_m2_day = labor_hours_m2_day * hourly_rate if hourly_rate > 0 else labor_index

    return {
        "harvest_load_index": round(harvest_load_index, 6),
        "training_load_index": round(training_load_index, 6),
        "pruning_load_index": round(pruning_load_index, 6),
        "thinning_load_index": round(thinning_load_index, 6),
        "pollination_or_cluster_management_index": round(pollination_or_cluster_management_index, 6),
        "canopy_management_load_index": round(canopy_management_load_index, 6),
        "labor_index": round(labor_index, 6),
        "labor_hours_m2_day": round(labor_hours_m2_day, 6),
        "labor_cost_krw_m2_day": round(labor_cost_krw_m2_day, 6),
    }
