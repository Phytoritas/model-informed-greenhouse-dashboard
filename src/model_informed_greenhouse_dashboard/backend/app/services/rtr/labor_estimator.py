"""Labor-load proxy terms for RTR optimization.

The optimizer uses a dimensionless workload index for search stability, then
converts that index into grower-facing hours and KRW estimates for display.
The conversion defaults are intentionally explicit because the UI surfaces
workload, labor time, and labor cost as different concepts.
"""

from __future__ import annotations

from typing import Any, Mapping


REFERENCE_LABOR_HOURS_10A_YEAR = 782.0
REFERENCE_WORKLOAD_INDEX = 0.55
REFERENCE_LABOR_RATE_KRW_HOUR = 16800.0
M2_PER_10A = 1000.0
DAYS_PER_YEAR = 365.0
LABOR_REFERENCE_SOURCE = (
    "facility cucumber income/labor benchmarks from public agricultural income "
    "survey reporting; hourly rate defaults to daily agricultural wage / 8h"
)

DEFAULT_LABOR_BENCHMARKS: dict[str, dict[str, Any]] = {
    "tomato": {
        "source_key": "agricultural-income-reference",
        "source_label_ko": "농업소득자료 기준",
        "source_label_en": "Agricultural income benchmark",
        "source_note": (
            "Facility tomato hydroponic labor-time benchmark from public "
            "agricultural income reporting; adjust with house records."
        ),
        "reference_year": 2023,
        "reference_labor_hours_10a_year": 687.0,
        "reference_workload_index": REFERENCE_WORKLOAD_INDEX,
        "default_labor_rate_krw_hour": REFERENCE_LABOR_RATE_KRW_HOUR,
        "default_labor_rate_basis": "daily agricultural wage / 8h",
    },
    "cucumber": {
        "source_key": "agricultural-income-reference",
        "source_label_ko": "농업소득자료 기준",
        "source_label_en": "Agricultural income benchmark",
        "source_note": (
            "Facility cucumber labor-time benchmark from public agricultural "
            "income reporting; adjust with house records."
        ),
        "reference_year": 2023,
        "reference_labor_hours_10a_year": REFERENCE_LABOR_HOURS_10A_YEAR,
        "reference_workload_index": REFERENCE_WORKLOAD_INDEX,
        "default_labor_rate_krw_hour": REFERENCE_LABOR_RATE_KRW_HOUR,
        "default_labor_rate_basis": "daily agricultural wage / 8h",
    },
}


def _safe_float(value: Any, default: float = 0.0) -> float:
    try:
        if value is None:
            return default
        return float(value)
    except (TypeError, ValueError):
        return default


def _resolve_labor_benchmark(
    *,
    crop: str,
    labor_benchmark: Mapping[str, Any] | None = None,
) -> dict[str, Any]:
    fallback = DEFAULT_LABOR_BENCHMARKS.get(crop, DEFAULT_LABOR_BENCHMARKS["cucumber"])
    merged = {**fallback, **dict(labor_benchmark or {})}

    reference_hours = _safe_float(
        merged.get("reference_labor_hours_10a_year"),
        REFERENCE_LABOR_HOURS_10A_YEAR,
    )
    if reference_hours <= 0:
        reference_hours = REFERENCE_LABOR_HOURS_10A_YEAR

    reference_workload = _safe_float(
        merged.get("reference_workload_index"),
        REFERENCE_WORKLOAD_INDEX,
    )
    if reference_workload <= 0:
        reference_workload = REFERENCE_WORKLOAD_INDEX

    labor_rate = _safe_float(
        merged.get("default_labor_rate_krw_hour"),
        REFERENCE_LABOR_RATE_KRW_HOUR,
    )
    if labor_rate <= 0:
        labor_rate = REFERENCE_LABOR_RATE_KRW_HOUR

    reference_hours_m2_day = reference_hours / M2_PER_10A / DAYS_PER_YEAR
    return {
        **merged,
        "source_key": str(merged.get("source_key") or "agricultural-income-reference"),
        "reference_labor_hours_10a_year": reference_hours,
        "reference_workload_index": reference_workload,
        "default_labor_rate_krw_hour": labor_rate,
        "reference_labor_hours_m2_day": reference_hours_m2_day,
        "labor_hours_m2_day_per_index": reference_hours_m2_day / reference_workload,
    }


def estimate_labor_projection(
    *,
    crop: str,
    predicted_node_rate_day: float,
    observed_node_rate_day: float,
    fruit_load: float,
    lai: float,
    crop_specific: Mapping[str, Any],
    user_labor_cost_coefficient: float | None = None,
    labor_benchmark: Mapping[str, Any] | None = None,
) -> dict[str, Any]:
    benchmark = _resolve_labor_benchmark(crop=crop, labor_benchmark=labor_benchmark)
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
    labor_hours_m2_day = labor_index * float(benchmark["labor_hours_m2_day_per_index"])
    benchmark_rate = float(benchmark["default_labor_rate_krw_hour"])
    hourly_rate, rate_source = (
        (float(user_labor_cost_coefficient), "user")
        if user_labor_cost_coefficient is not None and user_labor_cost_coefficient > 0
        else (benchmark_rate, str(benchmark["source_key"]))
    )
    labor_cost_krw_m2_day = labor_hours_m2_day * hourly_rate

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
        "labor_rate_krw_hour": round(hourly_rate, 6),
        "labor_rate_source": rate_source,
        "labor_hours_basis": "crop_profile_labor_benchmark",
        "labor_benchmark_crop": crop,
        "labor_benchmark_source_label_ko": benchmark.get("source_label_ko"),
        "labor_benchmark_source_label_en": benchmark.get("source_label_en"),
        "labor_benchmark_source_note": benchmark.get("source_note"),
        "labor_benchmark_source_url": benchmark.get("source_url"),
        "reference_year": benchmark.get("reference_year"),
        "reference_labor_hours_10a_year": float(benchmark["reference_labor_hours_10a_year"]),
        "reference_workload_index": float(benchmark["reference_workload_index"]),
        "reference_labor_hours_m2_day": round(float(benchmark["reference_labor_hours_m2_day"]), 9),
        "reference_labor_cost_krw_10a_year": round(
            float(benchmark["reference_labor_hours_10a_year"]) * hourly_rate,
            6,
        ),
        "default_labor_rate_basis": benchmark.get("default_labor_rate_basis"),
        "labor_reference_source": str(benchmark.get("source_note") or LABOR_REFERENCE_SOURCE),
        "definition": (
            "labor_index is a relative workload pressure score composed from "
            "harvest, training, pruning, thinning, cluster/pollination, and canopy-management load; "
            "labor_hours_m2_day and labor_cost_krw_m2_day are display conversions."
        ),
    }
