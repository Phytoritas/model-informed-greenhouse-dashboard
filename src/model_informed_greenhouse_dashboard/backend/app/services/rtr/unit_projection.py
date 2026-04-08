"""Canonical m² handling plus actual-area projections for RTR outputs."""

from __future__ import annotations

from typing import Any, Mapping


PYEONG_TO_M2 = 3.305785


def canonicalize_area(
    *,
    greenhouse_area_m2: float,
    user_actual_area_m2: float | None = None,
    user_actual_area_pyeong: float | None = None,
) -> dict[str, float | None]:
    actual_area_m2 = float(greenhouse_area_m2)
    actual_area_pyeong = actual_area_m2 / PYEONG_TO_M2

    if user_actual_area_m2 is not None and user_actual_area_m2 > 0:
        actual_area_m2 = float(user_actual_area_m2)
        actual_area_pyeong = actual_area_m2 / PYEONG_TO_M2
    elif user_actual_area_pyeong is not None and user_actual_area_pyeong > 0:
        actual_area_pyeong = float(user_actual_area_pyeong)
        actual_area_m2 = actual_area_pyeong * PYEONG_TO_M2

    return {
        "greenhouse_area_m2": round(float(greenhouse_area_m2), 6),
        "actual_area_m2": round(actual_area_m2, 6),
        "actual_area_pyeong": round(actual_area_pyeong, 6),
    }


def project_per_m2_value(value_per_m2: float, area_m2: float) -> float:
    return float(value_per_m2) * float(area_m2)


def build_actual_area_projection(
    *,
    area_meta: Mapping[str, float | None],
    yield_kg_m2_day: float = 0.0,
    yield_kg_m2_week: float = 0.0,
    energy_kwh_m2_day: float = 0.0,
    energy_krw_m2_day: float = 0.0,
    labor_index_m2_day: float = 0.0,
) -> dict[str, Any]:
    actual_area_m2 = float(area_meta.get("actual_area_m2") or 0.0)
    return {
        "actual_area_m2": round(actual_area_m2, 6),
        "actual_area_pyeong": round(float(area_meta.get("actual_area_pyeong") or 0.0), 6),
        "yield_kg_day": round(project_per_m2_value(yield_kg_m2_day, actual_area_m2), 6),
        "yield_kg_week": round(project_per_m2_value(yield_kg_m2_week, actual_area_m2), 6),
        "energy_kwh_day": round(project_per_m2_value(energy_kwh_m2_day, actual_area_m2), 6),
        "energy_krw_day": round(project_per_m2_value(energy_krw_m2_day, actual_area_m2), 6),
        "labor_index_day": round(project_per_m2_value(labor_index_m2_day, actual_area_m2), 6),
    }
