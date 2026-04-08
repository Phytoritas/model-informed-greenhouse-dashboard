"""Controller-side contracts and normalization helpers for RTR optimization."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Literal, Mapping


OptimizationMode = Literal[
    "growth_priority",
    "balanced",
    "energy_saving",
    "labor_saving",
    "custom_weights",
]

TargetHorizon = Literal["today", "next_24h", "day+night split"]


@dataclass(frozen=True)
class RTRGuardrails:
    """Optional user guardrails for bounded RTR optimization."""

    max_temp_delta_per_step: float | None = None
    max_rtr_ratio_delta: float | None = None
    humidity_risk_tolerance: float | None = None
    disease_risk_tolerance: float | None = None


@dataclass(frozen=True)
class RTROptimizationInputs:
    """Normalized service-layer optimization request."""

    crop: str
    greenhouse_id: str
    target_node_development_per_day: float
    optimization_mode: OptimizationMode = "balanced"
    include_energy_cost: bool = True
    include_labor_cost: bool = False
    target_horizon: TargetHorizon = "today"
    actual_area_m2: float | None = None
    actual_area_pyeong: float | None = None
    custom_weights: dict[str, float] = field(default_factory=dict)
    guardrails: RTRGuardrails = field(default_factory=RTRGuardrails)
    user_labor_cost_coefficient: float | None = None


MODE_WEIGHT_MULTIPLIERS: dict[str, dict[str, float]] = {
    "growth_priority": {
        "temp": 0.85,
        "node": 1.2,
        "carbon": 1.2,
        "sink": 1.1,
        "resp": 1.0,
        "risk": 1.0,
        "energy": 0.8,
        "labor": 0.85,
    },
    "balanced": {
        "temp": 1.0,
        "node": 1.0,
        "carbon": 1.0,
        "sink": 1.0,
        "resp": 1.0,
        "risk": 1.0,
        "energy": 1.0,
        "labor": 1.0,
    },
    "energy_saving": {
        "temp": 1.1,
        "node": 0.95,
        "carbon": 1.0,
        "sink": 1.0,
        "resp": 1.1,
        "risk": 1.0,
        "energy": 1.35,
        "labor": 0.95,
    },
    "labor_saving": {
        "temp": 1.0,
        "node": 0.95,
        "carbon": 1.0,
        "sink": 1.0,
        "resp": 1.0,
        "risk": 1.0,
        "energy": 1.0,
        "labor": 1.35,
    },
    "custom_weights": {
        "temp": 1.0,
        "node": 1.0,
        "carbon": 1.0,
        "sink": 1.0,
        "resp": 1.0,
        "risk": 1.0,
        "energy": 1.0,
        "labor": 1.0,
    },
}


def normalize_crop_name(crop: str) -> str:
    normalized = crop.strip().lower()
    if normalized not in {"cucumber", "tomato"}:
        raise ValueError(f"Unsupported RTR crop: {crop}")
    return normalized


def normalize_target_horizon(value: str | None) -> TargetHorizon:
    if value in (None, "", "today"):
        return "today"
    if value == "next_24h":
        return "next_24h"
    if value == "day+night split":
        return "day+night split"
    raise ValueError(f"Unsupported target_horizon: {value}")


def horizon_hours(target_horizon: TargetHorizon) -> tuple[float, float]:
    if target_horizon == "day+night split":
        return (12.0, 12.0)
    if target_horizon == "next_24h":
        return (14.0, 10.0)
    return (14.0, 10.0)


def build_weight_vector(
    optimizer_defaults: Mapping[str, Any],
    optimization_mode: OptimizationMode,
    *,
    include_energy_cost: bool,
    include_labor_cost: bool,
    custom_weights: Mapping[str, float] | None = None,
) -> dict[str, float]:
    base_weights = {
        key: float(value)
        for key, value in (optimizer_defaults.get("weights") or {}).items()
    }
    if not base_weights:
        base_weights = {
            "temp": 1.0,
            "node": 120.0,
            "carbon": 100.0,
            "sink": 80.0,
            "resp": 20.0,
            "risk": 120.0,
            "energy": 25.0,
            "labor": 20.0,
        }

    multipliers = MODE_WEIGHT_MULTIPLIERS.get(optimization_mode, MODE_WEIGHT_MULTIPLIERS["balanced"])
    weights = {
        key: round(float(base_weights.get(key, 1.0)) * float(multipliers.get(key, 1.0)), 6)
        for key in ("temp", "node", "carbon", "sink", "resp", "risk", "energy", "labor")
    }

    if not include_energy_cost:
        weights["energy"] = 0.0
    if not include_labor_cost:
        weights["labor"] = 0.0

    if optimization_mode == "custom_weights":
        for key, value in (custom_weights or {}).items():
            if key in weights:
                weights[key] = float(value)

    return weights


def resolve_guardrail(
    optimizer_defaults: Mapping[str, Any],
    guardrails: RTRGuardrails,
    field_name: str,
    fallback: float,
) -> float:
    requested = getattr(guardrails, field_name)
    if requested is not None:
        return float(requested)
    if field_name == "max_temp_delta_per_step":
        return float(optimizer_defaults.get("max_delta_temp_C", fallback))
    if field_name == "max_rtr_ratio_delta":
        return float(optimizer_defaults.get("max_rtr_ratio_delta", fallback))
    return float(fallback)


def build_service_inputs(
    payload: Mapping[str, Any],
    *,
    greenhouse_id: str,
) -> RTROptimizationInputs:
    custom_weights = payload.get("custom_weights") or {}
    guardrail_payload = payload.get("guardrails") or {}
    guardrails = RTRGuardrails(
        max_temp_delta_per_step=guardrail_payload.get("max_temp_delta_per_step"),
        max_rtr_ratio_delta=guardrail_payload.get("max_rtr_ratio_delta"),
        humidity_risk_tolerance=guardrail_payload.get("humidity_risk_tolerance"),
        disease_risk_tolerance=guardrail_payload.get("disease_risk_tolerance"),
    )
    return RTROptimizationInputs(
        crop=normalize_crop_name(str(payload.get("crop") or "")),
        greenhouse_id=greenhouse_id,
        target_node_development_per_day=float(payload.get("target_node_development_per_day") or 0.0),
        optimization_mode=str(payload.get("optimization_mode") or "balanced"),  # type: ignore[arg-type]
        include_energy_cost=bool(payload.get("include_energy_cost", True)),
        include_labor_cost=bool(payload.get("include_labor_cost", False)),
        target_horizon=normalize_target_horizon(payload.get("target_horizon")),
        actual_area_m2=(
            None if payload.get("user_actual_area_m2") is None else float(payload.get("user_actual_area_m2"))
        ),
        actual_area_pyeong=(
            None
            if payload.get("user_actual_area_pyeong") is None
            else float(payload.get("user_actual_area_pyeong"))
        ),
        custom_weights={str(key): float(value) for key, value in custom_weights.items()},
        guardrails=guardrails,
        user_labor_cost_coefficient=(
            None
            if payload.get("user_labor_cost_coefficient") is None
            else float(payload.get("user_labor_cost_coefficient"))
        ),
    )
