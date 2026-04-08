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
    "yield_priority",
    "energy_priority",
    "labor_priority",
    "cooling_saving",
    "heating_saving",
]

CanonicalOptimizationMode = Literal[
    "growth_priority",
    "balanced",
    "energy_saving",
    "labor_saving",
    "custom_weights",
    "cooling_saving",
    "heating_saving",
]

TargetHorizon = Literal["today", "next_24h", "day+night split"]


MODE_ALIASES: dict[str, CanonicalOptimizationMode] = {
    "yield_priority": "growth_priority",
    "energy_priority": "energy_saving",
    "labor_priority": "labor_saving",
}


@dataclass(frozen=True)
class RTRGuardrails:
    """Optional user guardrails for bounded RTR optimization."""

    max_temp_delta_per_step: float | None = None
    max_rtr_ratio_delta: float | None = None
    humidity_risk_tolerance: float | None = None
    disease_risk_tolerance: float | None = None


@dataclass(frozen=True)
class RtrActuatorAvailability:
    """Configuration-driven actuator availability."""

    heating: bool = True
    cooling: bool = True
    ventilation: bool = True
    thermal_screen: bool = True
    circulation_fan: bool = True
    co2: bool = True
    dehumidification: bool = False
    fogging_or_evap_cooling: bool = False
    cooling_modes: tuple[str, ...] = ()

    def as_dict(self) -> dict[str, Any]:
        return {
            "heating": self.heating,
            "cooling": self.cooling,
            "ventilation": self.ventilation,
            "thermal_screen": self.thermal_screen,
            "circulation_fan": self.circulation_fan,
            "co2": self.co2,
            "dehumidification": self.dehumidification,
            "fogging_or_evap_cooling": self.fogging_or_evap_cooling,
            "cooling_modes": list(self.cooling_modes),
        }


@dataclass(frozen=True)
class RtrControlCandidate:
    """Single actuator candidate evaluated through the RTR control seam."""

    day_heating_min_temp_C: float
    night_heating_min_temp_C: float
    day_cooling_target_C: float
    night_cooling_target_C: float
    vent_bias_C: float = 0.0
    screen_bias_pct: float = 0.0
    circulation_fan_pct: float = 0.0
    co2_target_ppm: float | None = None
    dehumidification_bias: float = 0.0
    fogging_or_evap_cooling_intensity: float = 0.0

    def as_dict(self) -> dict[str, float | None]:
        mean_temp_c = (
            (self.day_heating_min_temp_C * 14.0) + (self.night_heating_min_temp_C * 10.0)
        ) / 24.0
        return {
            "day_min_temp_C": round(self.day_heating_min_temp_C, 6),
            "night_min_temp_C": round(self.night_heating_min_temp_C, 6),
            "mean_temp_C": round(mean_temp_c, 6),
            "day_heating_min_temp_C": round(self.day_heating_min_temp_C, 6),
            "night_heating_min_temp_C": round(self.night_heating_min_temp_C, 6),
            "day_cooling_target_C": round(self.day_cooling_target_C, 6),
            "night_cooling_target_C": round(self.night_cooling_target_C, 6),
            "vent_bias_C": round(self.vent_bias_C, 6),
            "screen_bias_pct": round(self.screen_bias_pct, 6),
            "circulation_fan_pct": round(self.circulation_fan_pct, 6),
            "co2_target_ppm": None if self.co2_target_ppm is None else round(self.co2_target_ppm, 6),
            "dehumidification_bias": round(self.dehumidification_bias, 6),
            "fogging_or_evap_cooling_intensity": round(self.fogging_or_evap_cooling_intensity, 6),
        }


@dataclass(frozen=True)
class RTROptimizationInputs:
    """Normalized service-layer optimization request."""

    crop: str
    greenhouse_id: str
    target_node_development_per_day: float
    optimization_mode: CanonicalOptimizationMode = "balanced"
    include_energy_cost: bool = True
    include_labor_cost: bool = False
    include_cooling_cost: bool = True
    target_horizon: TargetHorizon = "today"
    actual_area_m2: float | None = None
    actual_area_pyeong: float | None = None
    custom_weights: dict[str, float] = field(default_factory=dict)
    guardrails: RTRGuardrails = field(default_factory=RTRGuardrails)
    user_labor_cost_coefficient: float | None = None


MODE_WEIGHT_MULTIPLIERS: dict[str, dict[str, float]] = {
    "growth_priority": {
        "temp": 0.9,
        "node": 1.2,
        "carbon": 1.2,
        "sink": 1.1,
        "resp": 1.0,
        "risk": 1.0,
        "energy": 0.85,
        "labor": 0.9,
        "assim": 1.2,
        "yield": 1.15,
        "heating": 0.85,
        "cooling": 0.85,
        "ventilation": 0.9,
        "humidity": 1.0,
        "disease": 1.0,
        "stress": 1.0,
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
        "assim": 1.0,
        "yield": 1.0,
        "heating": 1.0,
        "cooling": 1.0,
        "ventilation": 1.0,
        "humidity": 1.0,
        "disease": 1.0,
        "stress": 1.0,
    },
    "energy_saving": {
        "temp": 1.05,
        "node": 0.95,
        "carbon": 1.0,
        "sink": 1.0,
        "resp": 1.1,
        "risk": 1.0,
        "energy": 1.35,
        "labor": 0.95,
        "assim": 0.95,
        "yield": 0.95,
        "heating": 1.35,
        "cooling": 1.2,
        "ventilation": 1.15,
        "humidity": 1.0,
        "disease": 1.0,
        "stress": 1.0,
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
        "assim": 0.95,
        "yield": 0.95,
        "heating": 1.0,
        "cooling": 1.0,
        "ventilation": 1.0,
        "humidity": 1.0,
        "disease": 1.0,
        "stress": 1.0,
    },
    "cooling_saving": {
        "temp": 1.0,
        "node": 1.0,
        "carbon": 1.0,
        "sink": 1.0,
        "resp": 1.05,
        "risk": 1.0,
        "energy": 1.15,
        "labor": 1.0,
        "assim": 0.95,
        "yield": 0.95,
        "heating": 1.0,
        "cooling": 1.45,
        "ventilation": 1.15,
        "humidity": 1.0,
        "disease": 1.0,
        "stress": 1.0,
    },
    "heating_saving": {
        "temp": 1.1,
        "node": 0.95,
        "carbon": 1.0,
        "sink": 1.0,
        "resp": 1.05,
        "risk": 1.0,
        "energy": 1.2,
        "labor": 1.0,
        "assim": 0.95,
        "yield": 0.95,
        "heating": 1.5,
        "cooling": 1.0,
        "ventilation": 1.1,
        "humidity": 1.0,
        "disease": 1.0,
        "stress": 1.0,
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
        "assim": 1.0,
        "yield": 1.0,
        "heating": 1.0,
        "cooling": 1.0,
        "ventilation": 1.0,
        "humidity": 1.0,
        "disease": 1.0,
        "stress": 1.0,
    },
}


def normalize_crop_name(crop: str) -> str:
    normalized = crop.strip().lower()
    if normalized not in {"cucumber", "tomato"}:
        raise ValueError(f"Unsupported RTR crop: {crop}")
    return normalized


def normalize_optimization_mode(value: str | None) -> CanonicalOptimizationMode:
    normalized = str(value or "balanced").strip().lower()
    normalized = MODE_ALIASES.get(normalized, normalized)  # type: ignore[assignment]
    if normalized not in MODE_WEIGHT_MULTIPLIERS:
        raise ValueError(f"Unsupported optimization_mode: {value}")
    return normalized  # type: ignore[return-value]


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
    optimization_mode: CanonicalOptimizationMode,
    *,
    include_energy_cost: bool,
    include_labor_cost: bool,
    include_cooling_cost: bool = True,
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

    expanded_base = {
        "temp": float(base_weights.get("temp", 1.0)),
        "node": float(base_weights.get("node", 120.0)),
        "carbon": float(base_weights.get("carbon", 100.0)),
        "sink": float(base_weights.get("sink", 80.0)),
        "resp": float(base_weights.get("resp", 20.0)),
        "risk": float(base_weights.get("risk", 120.0)),
        "energy": float(base_weights.get("energy", 25.0)),
        "labor": float(base_weights.get("labor", 20.0)),
        "assim": float(base_weights.get("assim", base_weights.get("carbon", 100.0) / 4.0)),
        "yield": float(base_weights.get("yield", base_weights.get("node", 120.0) / 3.0)),
        "heating": float(base_weights.get("heating", base_weights.get("energy", 25.0))),
        "cooling": float(base_weights.get("cooling", base_weights.get("energy", 25.0))),
        "ventilation": float(base_weights.get("ventilation", base_weights.get("energy", 25.0) * 0.8)),
        "humidity": float(base_weights.get("humidity", base_weights.get("risk", 120.0))),
        "disease": float(base_weights.get("disease", base_weights.get("risk", 120.0))),
        "stress": float(base_weights.get("stress", base_weights.get("risk", 120.0))),
    }

    multipliers = MODE_WEIGHT_MULTIPLIERS.get(optimization_mode, MODE_WEIGHT_MULTIPLIERS["balanced"])
    weights = {
        key: round(float(expanded_base.get(key, 1.0)) * float(multipliers.get(key, 1.0)), 6)
        for key in (
            "temp",
            "node",
            "carbon",
            "sink",
            "resp",
            "risk",
            "energy",
            "labor",
            "assim",
            "yield",
            "heating",
            "cooling",
            "ventilation",
            "humidity",
            "disease",
            "stress",
        )
    }

    if optimization_mode == "custom_weights":
        for key, value in (custom_weights or {}).items():
            if key in weights:
                weights[key] = float(value)

    if not include_energy_cost:
        weights["energy"] = 0.0
        weights["heating"] = 0.0
        weights["cooling"] = 0.0
        weights["ventilation"] = 0.0
    elif not include_cooling_cost:
        weights["cooling"] = 0.0

    if not include_labor_cost:
        weights["labor"] = 0.0

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
        optimization_mode=normalize_optimization_mode(str(payload.get("optimization_mode") or "balanced")),
        include_energy_cost=bool(payload.get("include_energy_cost", True)),
        include_labor_cost=bool(payload.get("include_labor_cost", False)),
        include_cooling_cost=bool(payload.get("include_cooling_cost", True)),
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
