"""Constraint and trust-region helpers for bounded SmartGrow runtime controls."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Mapping


@dataclass(frozen=True)
class ControlSpec:
    """Single control axis metadata used by scenarios and sensitivities."""

    name: str
    trust_region_low: float
    trust_region_high: float
    default_step: float
    unit: str
    micro_step: float
    macro_step: float
    reference_step: float | None
    ui_label: str
    display_precision: int
    family_name: str


@dataclass(frozen=True)
class ConstraintViolation:
    """Structured scenario or sensitivity violation."""

    code: str
    severity: str
    message: str
    control: str | None = None

    def as_dict(self) -> dict[str, str]:
        payload = {
            "code": self.code,
            "severity": self.severity,
            "message": self.message,
        }
        if self.control:
            payload["control"] = self.control
        return payload


@dataclass(frozen=True)
class ConstraintEvaluation:
    """Normalized constraint checks and penalties."""

    violations: list[ConstraintViolation]
    energy_cost_penalty: float
    humidity_penalty: float
    disease_risk_penalty: float
    stress_penalty: float
    confidence_penalty: float

    def as_dict(self) -> dict[str, Any]:
        return {
            "violations": [violation.as_dict() for violation in self.violations],
            "energy_cost_penalty": self.energy_cost_penalty,
            "humidity_penalty": self.humidity_penalty,
            "disease_risk_penalty": self.disease_risk_penalty,
            "stress_penalty": self.stress_penalty,
            "confidence_penalty": self.confidence_penalty,
        }


CONTROL_SPECS: dict[str, ControlSpec] = {
    "temperature_day": ControlSpec(
        name="temperature_day",
        trust_region_low=-1.5,
        trust_region_high=1.5,
        default_step=0.5,
        unit="C",
        micro_step=0.3,
        macro_step=0.6,
        reference_step=0.9,
        ui_label="주간 온도",
        display_precision=1,
        family_name="temperature_day_precision",
    ),
    "temperature_night": ControlSpec(
        name="temperature_night",
        trust_region_low=-1.5,
        trust_region_high=1.5,
        default_step=0.5,
        unit="C",
        micro_step=0.3,
        macro_step=0.6,
        reference_step=0.9,
        ui_label="야간 온도",
        display_precision=1,
        family_name="temperature_night_precision",
    ),
    "co2_setpoint_day": ControlSpec(
        name="co2_setpoint_day",
        trust_region_low=-150.0,
        trust_region_high=150.0,
        default_step=50.0,
        unit="ppm",
        micro_step=50.0,
        macro_step=100.0,
        reference_step=150.0,
        ui_label="주간 CO2",
        display_precision=0,
        family_name="co2_precision",
    ),
    "rh_target": ControlSpec(
        name="rh_target",
        trust_region_low=-8.0,
        trust_region_high=8.0,
        default_step=2.0,
        unit="pct",
        micro_step=3.0,
        macro_step=5.0,
        reference_step=None,
        ui_label="습도",
        display_precision=0,
        family_name="rh_precision",
    ),
    "screen_close": ControlSpec(
        name="screen_close",
        trust_region_low=-15.0,
        trust_region_high=15.0,
        default_step=5.0,
        unit="pct",
        micro_step=5.0,
        macro_step=10.0,
        reference_step=None,
        ui_label="스크린",
        display_precision=0,
        family_name="screen_precision",
    ),
}


def _clamp(value: float, low: float, high: float) -> float:
    return max(low, min(high, value))


def _safe_float(value: Any, default: float = 0.0) -> float:
    try:
        if value is None:
            return default
        return float(value)
    except (TypeError, ValueError):
        return default


def normalize_control_deltas(controls: Mapping[str, Any] | None) -> dict[str, float]:
    """Normalize additive control deltas against the known SmartGrow axes."""
    controls = controls or {}
    unknown_controls = sorted(key for key in controls if key not in CONTROL_SPECS)
    if unknown_controls:
        raise ValueError(f"Unknown control variables: {', '.join(unknown_controls)}")

    return {
        name: _safe_float(controls.get(name), 0.0)
        for name in CONTROL_SPECS
    }


def trust_region_for(control: str) -> dict[str, float]:
    if control not in CONTROL_SPECS:
        raise ValueError(f"Unknown control variable: {control}")

    spec = CONTROL_SPECS[control]
    return {
        "low": spec.trust_region_low,
        "high": spec.trust_region_high,
    }


def clamp_control_delta(control: str, value: Any) -> float:
    if control not in CONTROL_SPECS:
        raise ValueError(f"Unknown control variable: {control}")

    spec = CONTROL_SPECS[control]
    return round(
        _clamp(_safe_float(value), spec.trust_region_low, spec.trust_region_high),
        6,
    )


def evaluate_constraints(
    *,
    runtime_inputs: Mapping[str, Any],
    controls: Mapping[str, float],
) -> ConstraintEvaluation:
    """Evaluate trust-region, disease, and stress constraints for a scenario."""
    normalized_controls = normalize_control_deltas(controls)
    violations: list[ConstraintViolation] = []

    canopy_temperature_c = _safe_float(runtime_inputs.get("canopy_temperature_c"), 24.0)
    rh_fraction = _safe_float(runtime_inputs.get("rh_fraction"), 0.7)
    source_sink_balance = _safe_float(runtime_inputs.get("source_sink_balance"), 0.0)
    upper_leaf_activity = _safe_float(runtime_inputs.get("upper_leaf_activity"), 0.5)
    bottom_leaf_activity = _safe_float(runtime_inputs.get("bottom_leaf_activity"), 0.2)

    energy_cost_penalty = 0.0
    humidity_penalty = 0.0
    disease_risk_penalty = 0.0
    stress_penalty = 0.0
    confidence_penalty = 0.0

    for control_name, delta_value in normalized_controls.items():
        spec = CONTROL_SPECS[control_name]
        if delta_value < spec.trust_region_low or delta_value > spec.trust_region_high:
            violations.append(
                ConstraintViolation(
                    code="trust_region_exceeded",
                    severity="high",
                    message=(
                        f"{control_name} delta {delta_value:.3f}{spec.unit} exceeds "
                        f"[{spec.trust_region_low:.3f}, {spec.trust_region_high:.3f}]."
                    ),
                    control=control_name,
                )
            )
            confidence_penalty += 0.2

    resulting_day_temperature = canopy_temperature_c + normalized_controls["temperature_day"]
    resulting_night_temperature = canopy_temperature_c + normalized_controls["temperature_night"]
    resulting_rh_fraction = rh_fraction + (normalized_controls["rh_target"] / 100.0)
    screen_close_delta = normalized_controls["screen_close"]
    ambient_co2_ppm = _safe_float(runtime_inputs.get("ambient_co2_ppm"), 700.0)
    resulting_co2_ppm = ambient_co2_ppm + normalized_controls["co2_setpoint_day"]

    if resulting_rh_fraction >= 0.87:
        violations.append(
            ConstraintViolation(
                code="disease_risk_high",
                severity="high",
                message="Resulting RH exceeds the bounded disease-risk ceiling.",
                control="rh_target",
            )
        )
        humidity_penalty += 0.28
        disease_risk_penalty += 0.35
        confidence_penalty += 0.08
    elif resulting_rh_fraction >= 0.82:
        humidity_penalty += 0.12
        disease_risk_penalty += 0.18
    elif resulting_rh_fraction <= 0.58:
        violations.append(
            ConstraintViolation(
                code="humidity_floor_risk",
                severity="medium",
                message="Resulting RH falls below the bounded recovery floor.",
                control="rh_target",
            )
        )
        humidity_penalty += 0.16
        stress_penalty += 0.1

    if screen_close_delta > 10.0 and resulting_rh_fraction >= 0.8:
        violations.append(
            ConstraintViolation(
                code="screen_humidity_coupling",
                severity="medium",
                message="Screen closure and RH increase compound lower-canopy humidity risk.",
                control="screen_close",
            )
        )
        humidity_penalty += 0.08
        disease_risk_penalty += 0.12

    if resulting_day_temperature >= 31.0:
        violations.append(
            ConstraintViolation(
                code="heat_stress_risk",
                severity="high",
                message="Resulting day temperature crosses the bounded heat-stress threshold.",
                control="temperature_day",
            )
        )
        stress_penalty += 0.3
        confidence_penalty += 0.06
    elif resulting_day_temperature <= 17.0:
        violations.append(
            ConstraintViolation(
                code="cold_stress_risk",
                severity="medium",
                message="Resulting day temperature falls below the bounded recovery band.",
                control="temperature_day",
            )
        )
        stress_penalty += 0.18

    if resulting_night_temperature >= 28.0:
        stress_penalty += 0.14
    elif resulting_night_temperature <= 15.0:
        violations.append(
            ConstraintViolation(
                code="night_cold_risk",
                severity="medium",
                message="Resulting night temperature falls below the bounded nighttime floor.",
                control="temperature_night",
            )
        )
        stress_penalty += 0.16

    if resulting_co2_ppm >= 1050.0:
        violations.append(
            ConstraintViolation(
                code="co2_overdose_risk",
                severity="medium",
                message="Resulting CO2 exceeds the bounded high-response band.",
                control="co2_setpoint_day",
            )
        )
        disease_risk_penalty += 0.14
        stress_penalty += 0.12
        confidence_penalty += 0.04
    elif resulting_co2_ppm >= 920.0:
        disease_risk_penalty += 0.08
        stress_penalty += 0.05
    elif resulting_co2_ppm <= 380.0 and normalized_controls["co2_setpoint_day"] < 0.0:
        stress_penalty += 0.06

    if source_sink_balance <= -0.25 and normalized_controls["screen_close"] > 5.0:
        violations.append(
            ConstraintViolation(
                code="source_loss_risk",
                severity="medium",
                message="Additional screen closure amplifies source limitation under current sink pressure.",
                control="screen_close",
            )
        )
        stress_penalty += 0.12

    energy_cost_penalty += 0.14 * max(0.0, normalized_controls["temperature_day"] / 1.5)
    energy_cost_penalty += 0.18 * max(0.0, normalized_controls["temperature_night"] / 1.5)
    co2_ratio = normalized_controls["co2_setpoint_day"] / 150.0
    positive_co2_ratio = max(0.0, co2_ratio)
    energy_cost_penalty += 0.08 * abs(co2_ratio)
    energy_cost_penalty += 0.06 * (positive_co2_ratio**2)
    energy_cost_penalty += 0.04 * max(0.0, (resulting_co2_ppm - 900.0) / 200.0)
    energy_cost_penalty -= 0.06 * max(0.0, normalized_controls["screen_close"] / 15.0)
    energy_cost_penalty = _clamp(energy_cost_penalty, 0.0, 1.0)

    if bottom_leaf_activity <= 0.15 and resulting_rh_fraction >= 0.82:
        humidity_penalty += 0.05
        disease_risk_penalty += 0.08
    if upper_leaf_activity >= 0.85 and screen_close_delta > 10.0:
        stress_penalty += 0.06

    missing_inputs = runtime_inputs.get("missing_inputs", [])
    confidence_penalty += min(len(missing_inputs) * 0.03, 0.15)

    return ConstraintEvaluation(
        violations=violations,
        energy_cost_penalty=round(_clamp(energy_cost_penalty, 0.0, 1.0), 6),
        humidity_penalty=round(_clamp(humidity_penalty, 0.0, 1.0), 6),
        disease_risk_penalty=round(_clamp(disease_risk_penalty, 0.0, 1.0), 6),
        stress_penalty=round(_clamp(stress_penalty, 0.0, 1.0), 6),
        confidence_penalty=round(_clamp(confidence_penalty, 0.0, 1.0), 6),
    )
