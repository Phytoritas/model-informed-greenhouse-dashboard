"""Paired temporal comparison for greenhouse telemetry.

The advisor's canonical diagnostic question is not answered by a generic recent
trend. This module compares the current window with the same local-time window on
the preceding day, then produces bounded hypotheses and explicitly lists missing
discriminators.
"""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from statistics import fmean
from typing import Any
from zoneinfo import ZoneInfo


SEOUL = ZoneInfo("Asia/Seoul")
_VARIABLES: dict[str, tuple[str, float]] = {
    "temperature": ("°C", 2.0),
    "canopyTemp": ("°C", 2.0),
    "humidity": ("%", 10.0),
    "co2": ("ppm", 150.0),
    "light": ("µmol m⁻² s⁻¹", 250.0),
    "vpd": ("kPa", 0.4),
    "soilMoisture": ("index", 0.12),
    "transpiration": ("mm h⁻¹", 0.08),
    "stomatalConductance": ("mol m⁻² s⁻¹", 0.12),
    "photosynthesis": ("µmol m⁻² s⁻¹", 5.0),
}
_ENVIRONMENT_KEYS = ("temperature", "humidity", "co2", "light", "vpd")
_TARGET_TO_TELEMETRY = {
    "photosynthesis": "photosynthesis",
    "stomatal_conductance": "stomatalConductance",
    "transpiration": "transpiration",
    "canopy_temperature": "canopyTemp",
    "vpd": "vpd",
    "root_zone_water": "soilMoisture",
}


def _dict(value: Any) -> dict[str, Any]:
    return value if isinstance(value, dict) else {}


def _float(value: Any) -> float | None:
    try:
        number = float(value)
    except (TypeError, ValueError):
        return None
    if number != number:
        return None
    return number


def _parse_datetime(value: Any) -> datetime | None:
    if isinstance(value, datetime):
        return value if value.tzinfo else value.replace(tzinfo=UTC)
    if isinstance(value, (int, float)):
        number = float(value)
        if number > 1e12:
            number /= 1000.0
        try:
            return datetime.fromtimestamp(number, tz=UTC)
        except (OverflowError, OSError, ValueError):
            return None
    if not isinstance(value, str) or not value.strip():
        return None
    normalized = value.strip().replace("Z", "+00:00")
    try:
        parsed = datetime.fromisoformat(normalized)
    except ValueError:
        return None
    return parsed if parsed.tzinfo else parsed.replace(tzinfo=UTC)


def _timestamp(row: dict[str, Any]) -> datetime | None:
    for key in ("datetime", "timestamp", "t", "time"):
        parsed = _parse_datetime(row.get(key))
        if parsed is not None:
            return parsed.astimezone(UTC)
    return None


def _window_rows(
    rows: list[dict[str, Any]],
    *,
    start: datetime,
    end: datetime,
) -> list[dict[str, Any]]:
    selected: list[dict[str, Any]] = []
    for row in rows:
        timestamp = _timestamp(row)
        if timestamp is not None and start <= timestamp <= end:
            selected.append(row)
    return selected


def _mean(rows: list[dict[str, Any]], key: str) -> float | None:
    values = [number for row in rows if (number := _float(row.get(key))) is not None]
    return fmean(values) if values else None


def _summarize_window(rows: list[dict[str, Any]]) -> dict[str, Any]:
    return {
        key: round(value, 6)
        for key in _VARIABLES
        if (value := _mean(rows, key)) is not None
    }


def _similarity(current: dict[str, Any], baseline: dict[str, Any]) -> float:
    distances: list[float] = []
    for key in _ENVIRONMENT_KEYS:
        current_value = _float(current.get(key))
        baseline_value = _float(baseline.get(key))
        if current_value is None or baseline_value is None:
            continue
        scale = _VARIABLES[key][1]
        distances.append(min(abs(current_value - baseline_value) / max(scale, 1e-9), 1.0))
    if not distances:
        return 0.0
    return round(max(0.0, 1.0 - fmean(distances)), 4)


def _delta_rows(current: dict[str, Any], baseline: dict[str, Any]) -> list[dict[str, Any]]:
    result: list[dict[str, Any]] = []
    for key, (unit, _scale) in _VARIABLES.items():
        current_value = _float(current.get(key))
        baseline_value = _float(baseline.get(key))
        if current_value is None or baseline_value is None:
            continue
        delta = current_value - baseline_value
        relative = delta / max(abs(baseline_value), 1e-9)
        result.append({
            "variable": key,
            "unit": unit,
            "current_mean": round(current_value, 6),
            "baseline_mean": round(baseline_value, 6),
            "delta": round(delta, 6),
            "relative_delta": round(relative, 6),
        })
    return result


def _delta_map(deltas: list[dict[str, Any]]) -> dict[str, float]:
    return {str(row["variable"]): float(row["delta"]) for row in deltas}


def _hypotheses(
    *,
    target: str,
    deltas: list[dict[str, Any]],
    environment_similarity: float,
) -> list[dict[str, Any]]:
    change = _delta_map(deltas)
    target_delta = change.get(target)
    if target_delta is None or target_delta >= 0:
        return []

    hypotheses: list[dict[str, Any]] = []

    def add(code: str, label_ko: str, label_en: str, support: float, observations: list[str]) -> None:
        hypotheses.append({
            "code": code,
            "label_ko": label_ko,
            "label_en": label_en,
            "support": round(max(0.0, min(1.0, support)), 4),
            "observations": observations,
        })

    gsw_delta = change.get("stomatalConductance")
    if gsw_delta is not None and gsw_delta < 0:
        add(
            "stomatal_limitation",
            "기공 제한 가능성",
            "Possible stomatal limitation",
            min(1.0, abs(gsw_delta) / 0.12 + 0.25),
            [f"stomatalConductance delta={gsw_delta:+.4f}"],
        )

    vpd_delta = change.get("vpd")
    canopy_delta = change.get("canopyTemp")
    if (vpd_delta is not None and vpd_delta > 0.1) or (canopy_delta is not None and canopy_delta > 0.7):
        observations = []
        if vpd_delta is not None:
            observations.append(f"vpd delta={vpd_delta:+.3f} kPa")
        if canopy_delta is not None:
            observations.append(f"canopyTemp delta={canopy_delta:+.3f} °C")
        add(
            "heat_vpd_load",
            "잎 온도·VPD 부하",
            "Leaf-temperature/VPD load",
            0.55 + min(0.4, max(vpd_delta or 0.0, 0.0) / 0.5),
            observations,
        )

    light_delta = change.get("light")
    if light_delta is not None and light_delta < -80:
        add(
            "light_input",
            "실제 유효광 감소",
            "Reduced effective light",
            min(0.95, abs(light_delta) / 300.0 + 0.35),
            [f"light delta={light_delta:+.1f} µmol m⁻² s⁻¹"],
        )

    co2_delta = change.get("co2")
    if co2_delta is not None and co2_delta < -60:
        add(
            "co2_supply",
            "CO₂ 공급 차이",
            "CO₂ supply difference",
            min(0.9, abs(co2_delta) / 180.0 + 0.3),
            [f"co2 delta={co2_delta:+.1f} ppm"],
        )

    soil_delta = change.get("soilMoisture")
    if soil_delta is not None and soil_delta < -0.03:
        add(
            "root_zone_water",
            "근권 수분 저하",
            "Lower root-zone water status",
            min(0.9, abs(soil_delta) / 0.12 + 0.25),
            [f"soilMoisture delta={soil_delta:+.4f}"],
        )

    if environment_similarity >= 0.75 and not hypotheses:
        add(
            "state_memory_or_unmeasured_factor",
            "동일 순간값 밖의 상태 기억 또는 미계측 요인",
            "State memory or an unmeasured driver",
            0.55,
            [f"environment similarity={environment_similarity:.2f}"],
        )

    return sorted(hypotheses, key=lambda item: float(item["support"]), reverse=True)


def compare_temporal_windows(
    dashboard: dict[str, Any],
    facets: dict[str, Any],
    *,
    window_minutes: int = 60,
    baseline_offset_hours: int = 24,
) -> dict[str, Any]:
    history = dashboard.get("history") or dashboard.get("recentHistory") or []
    rows = [row for row in history if isinstance(row, dict)]
    current_data = _dict(dashboard.get("currentData") or dashboard.get("data"))
    reference = _timestamp(current_data)
    if reference is None:
        timestamps = [timestamp for row in rows if (timestamp := _timestamp(row)) is not None]
        reference = max(timestamps) if timestamps else None

    target_signals = [str(item) for item in facets.get("target_signals", [])]
    semantic_target = target_signals[0] if target_signals else "photosynthesis"
    target = _TARGET_TO_TELEMETRY.get(semantic_target)
    recent_summary = _dict(dashboard.get("recentSummary"))

    if reference is None or not rows:
        return {
            "status": "history_unavailable",
            "comparison_mode": facets.get("comparison_mode", "NONE"),
            "target_signal": semantic_target,
            "telemetry_target": target,
            "summary": "No timestamped history is available for a paired comparison.",
            "recent_summary": recent_summary,
            "hypotheses": [],
            "missing_discriminators": ["same_time_previous_day_history"],
            "quality": {"temporal_alignment": 0.0, "diagnostic_depth": 0.15},
        }

    reference = reference.astimezone(UTC)
    current_start = reference - timedelta(minutes=max(15, window_minutes))
    baseline_center = reference - timedelta(hours=baseline_offset_hours)
    half_window = timedelta(minutes=max(30, window_minutes // 2))
    current_rows = _window_rows(rows, start=current_start, end=reference)
    baseline_rows = _window_rows(rows, start=baseline_center - half_window, end=baseline_center + half_window)

    if not current_rows or not baseline_rows:
        return {
            "status": "baseline_unavailable",
            "comparison_mode": facets.get("comparison_mode", "NONE"),
            "target_signal": semantic_target,
            "telemetry_target": target,
            "reference_time": reference.isoformat(),
            "current_point_count": len(current_rows),
            "baseline_point_count": len(baseline_rows),
            "summary": "Current data exist, but the preceding-day same-time baseline is missing.",
            "recent_summary": recent_summary,
            "hypotheses": [],
            "missing_discriminators": ["same_time_previous_day_history"],
            "quality": {"temporal_alignment": 0.25, "diagnostic_depth": 0.25},
        }

    current = _summarize_window(current_rows)
    baseline = _summarize_window(baseline_rows)
    deltas = _delta_rows(current, baseline)
    similarity = _similarity(current, baseline)
    hypotheses = (
        _hypotheses(target=target, deltas=deltas, environment_similarity=similarity)
        if target is not None
        else []
    )
    missing: list[str] = []
    for key in ("stomatalConductance", "canopyTemp", "soilMoisture"):
        if key not in current or key not in baseline:
            missing.append(key)
    if "soilMoisture" in missing:
        missing.append("root_zone_water_status")

    target_delta = _delta_map(deltas).get(target) if target is not None else None
    status = "ready" if target_delta is not None else "target_unavailable"
    if target is None:
        missing.append(f"telemetry_target_for:{semantic_target}")
    summary = (
        f"Compared {len(current_rows)} current-window points with {len(baseline_rows)} points "
        f"from the same local-time window on the preceding day."
    )
    return {
        "status": status,
        "comparison_mode": "SAME_TIME_PREVIOUS_DAY",
        "timezone": str(SEOUL),
        "target_signal": semantic_target,
        "telemetry_target": target,
        "reference_time": reference.isoformat(),
        "current_window": {
            "start": current_start.isoformat(),
            "end": reference.isoformat(),
            "point_count": len(current_rows),
            "means": current,
        },
        "baseline_window": {
            "start": (baseline_center - half_window).isoformat(),
            "end": (baseline_center + half_window).isoformat(),
            "point_count": len(baseline_rows),
            "means": baseline,
        },
        "environment_similarity": similarity,
        "matched_environment": similarity >= 0.75,
        "deltas": deltas,
        "target_delta": target_delta,
        "hypotheses": hypotheses,
        "missing_discriminators": sorted(set(missing)),
        "summary": summary,
        "quality": {
            "temporal_alignment": 1.0,
            "diagnostic_depth": min(1.0, 0.45 + (0.15 * len(hypotheses)) + (0.15 if target_delta is not None else 0.0)),
        },
    }
