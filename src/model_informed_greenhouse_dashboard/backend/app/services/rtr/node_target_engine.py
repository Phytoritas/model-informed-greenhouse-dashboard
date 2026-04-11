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


def _tomato_fr_rate_day(
    *,
    raw_adapter_state: Mapping[str, Any],
    mean_air_temp_c: float,
) -> float:
    t_for_fr = max(1.0, mean_air_temp_c)
    if bool(raw_adapter_state.get("fr_clamp_to_valid", False)):
        t_for_fr = min(
            t_for_fr,
            _safe_float(raw_adapter_state.get("fr_T_max_valid"), 23.0),
        )
    return max(0.0, -0.2903 + (0.1454 * math.log(max(1.0, t_for_fr))))


def _tomato_fdvr_rate_day(
    *,
    tdvs: float,
    mean_air_temp_c: float,
) -> float:
    t_ratio = max(mean_air_temp_c, 0.1) / 20.0
    ln_term = math.log(t_ratio)
    fdvr = 0.0181 + ln_term * (
        0.0392 - 0.213 * tdvs + 0.451 * tdvs * tdvs - 0.240 * tdvs * tdvs * tdvs
    )
    return max(0.0, fdvr)


def _tomato_active_truss_progress_day(
    *,
    raw_adapter_state: Mapping[str, Any],
    mean_air_temp_c: float,
) -> float | None:
    truss_cohorts = raw_adapter_state.get("truss_cohorts") or []
    if not isinstance(truss_cohorts, list):
        return None

    weighted_progress = 0.0
    total_weight = 0.0
    active_count = 0
    for cohort in truss_cohorts:
        if not isinstance(cohort, Mapping):
            continue
        is_active = bool(cohort.get("active", True))
        tdvs = _safe_float(cohort.get("tdvs"), 0.0)
        if (not is_active) or tdvs >= 1.0:
            continue
        weight = _safe_float(cohort.get("n_fruits"), 0.0)
        if weight <= 0.0:
            weight = 1.0
        weighted_progress += _tomato_fdvr_rate_day(
            tdvs=tdvs,
            mean_air_temp_c=mean_air_temp_c,
        ) * weight
        total_weight += weight
        active_count += 1

    if active_count == 0 or total_weight <= 1e-9:
        return None
    # Keep the canonical contract in node-equivalent/day for solver compatibility.
    return (weighted_progress / total_weight) * 3.0


def predict_development_rate_day(
    *,
    crop: str,
    raw_adapter_state: Mapping[str, Any],
    mean_air_temp_c: float,
) -> float:
    if crop == "cucumber":
        nodes = _safe_float(
            raw_adapter_state.get("nodes"),
            _safe_float(raw_adapter_state.get("node_count"), 0.0),
        )
        threshold_before = _safe_float(raw_adapter_state.get("threshold_before"), 26.3)
        threshold_after = _safe_float(raw_adapter_state.get("threshold_after"), 15.6)
        reproductive_threshold = _safe_float(raw_adapter_state.get("reproductive_node_threshold"), 15.0)
        threshold = threshold_before if nodes < reproductive_threshold else threshold_after
        growing_temp = max(0.0, mean_air_temp_c - 10.0)
        return 0.0 if threshold <= 1e-9 else growing_temp / threshold

    active_truss_progress = _tomato_active_truss_progress_day(
        raw_adapter_state=raw_adapter_state,
        mean_air_temp_c=mean_air_temp_c,
    )
    if active_truss_progress is not None:
        return active_truss_progress
    return _tomato_fr_rate_day(
        raw_adapter_state=raw_adapter_state,
        mean_air_temp_c=mean_air_temp_c,
    ) * 3.0


def build_development_curve_rows(
    *,
    crop: str,
    raw_adapter_state: Mapping[str, Any],
    min_temp_c: float = 15.0,
    max_temp_c: float = 30.0,
    step_c: float = 0.5,
    development_scale: float = 1.0,
) -> list[dict[str, float]]:
    safe_min = min(float(min_temp_c), float(max_temp_c))
    safe_max = max(float(min_temp_c), float(max_temp_c))
    safe_step = max(0.1, float(step_c))
    safe_scale = max(1e-9, float(development_scale))

    rows: list[dict[str, float]] = []
    temp_cursor = safe_min
    while temp_cursor <= safe_max + 1e-6:
        mean_temp_c = round(temp_cursor, 1)
        node_rate_day = predict_development_rate_day(
            crop=crop,
            raw_adapter_state=raw_adapter_state,
            mean_air_temp_c=mean_temp_c,
        )
        rows.append(
            {
                "mean_temp_C": mean_temp_c,
                "development_rate_day": round(max(0.0, node_rate_day / safe_scale), 3),
            }
        )
        temp_cursor += safe_step
    return rows


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
