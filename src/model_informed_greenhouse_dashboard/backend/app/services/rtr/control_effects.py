"""Actuator-level microclimate effects for the RTR optimizer."""

from __future__ import annotations

import math
from typing import Any, Mapping

from ...config import greenhouse_config
from .controller_contract import RtrActuatorAvailability, RtrControlCandidate


def _safe_float(value: Any, default: float = 0.0) -> float:
    try:
        if value is None:
            return default
        return float(value)
    except (TypeError, ValueError):
        return default


def _clamp(value: float, low: float, high: float) -> float:
    return max(low, min(high, value))


def compute_vpd_kpa(temp_c: float, rh_pct: float) -> float:
    rh_fraction = _clamp(rh_pct / 100.0, 0.0, 1.0)
    saturation = 0.6108 * (2.718281828 ** ((17.27 * temp_c) / (temp_c + 237.3)))
    return max(0.0, saturation * (1.0 - rh_fraction))


def compute_dewpoint_c(temp_c: float, rh_pct: float) -> float:
    rh_fraction = _clamp(rh_pct / 100.0, 1e-6, 1.0)
    alpha = ((17.27 * temp_c) / (237.3 + temp_c)) + math.log(rh_fraction)
    return (237.3 * alpha) / (17.27 - alpha)


def build_actuator_availability(ops_config: Mapping[str, Any]) -> RtrActuatorAvailability:
    hvac_cfg = greenhouse_config.get("greenhouse", {}).get("hvac", {}) or {}
    control_cfg = hvac_cfg.get("control_capabilities") or {}
    cooling_modes = tuple(
        control_cfg.get("cooling_modes")
        or ["heat-pump-cooling", "ventilation-assisted-cooling"]
    )
    return RtrActuatorAvailability(
        heating=bool(control_cfg.get("heating", True)),
        cooling=bool(control_cfg.get("cooling", hvac_cfg.get("cop_cooling", 0.0) > 0)),
        ventilation=bool(control_cfg.get("ventilation", "vent_start_C" in ops_config)),
        thermal_screen=bool(control_cfg.get("thermal_screen", True)),
        circulation_fan=bool(control_cfg.get("circulation_fan", True)),
        co2=bool(control_cfg.get("co2", "co2_target_ppm" in ops_config)),
        dehumidification=bool(control_cfg.get("dehumidification", False)),
        fogging_or_evap_cooling=bool(control_cfg.get("fogging_or_evap_cooling", False)),
        cooling_modes=cooling_modes,
    )


def build_default_control_candidate(
    *,
    env: Mapping[str, Any],
    ops_config: Mapping[str, Any],
) -> RtrControlCandidate:
    baseline_heating = _safe_float(ops_config.get("heating_set_C"), _safe_float(env.get("T_air_C"), 18.0))
    baseline_cooling = _safe_float(ops_config.get("cooling_set_C"), baseline_heating + 7.0)
    return RtrControlCandidate(
        day_heating_min_temp_C=baseline_heating,
        night_heating_min_temp_C=baseline_heating,
        day_cooling_target_C=max(baseline_cooling, baseline_heating + 1.0),
        night_cooling_target_C=max(baseline_cooling - 1.0, baseline_heating + 1.0),
        vent_bias_C=0.0,
        screen_bias_pct=0.0,
        circulation_fan_pct=35.0,
        co2_target_ppm=_safe_float(ops_config.get("co2_target_ppm"), _safe_float(env.get("CO2_ppm"), 800.0)),
        dehumidification_bias=0.0,
        fogging_or_evap_cooling_intensity=0.0,
    )


def build_baseline_control_candidate(
    *,
    env: Mapping[str, Any],
    ops_config: Mapping[str, Any],
    baseline_target_c: float,
) -> RtrControlCandidate:
    baseline_heating = _safe_float(ops_config.get("heating_set_C"), baseline_target_c)
    baseline_day_heating = max(baseline_heating, baseline_target_c)
    baseline_night_heating = baseline_heating
    baseline_cooling = _safe_float(ops_config.get("cooling_set_C"), baseline_day_heating + 7.0)
    return RtrControlCandidate(
        day_heating_min_temp_C=baseline_day_heating,
        night_heating_min_temp_C=baseline_night_heating,
        day_cooling_target_C=max(baseline_cooling, baseline_day_heating + 1.0),
        night_cooling_target_C=max(baseline_cooling - 1.0, baseline_night_heating + 1.0),
        vent_bias_C=0.0,
        screen_bias_pct=0.0,
        circulation_fan_pct=35.0,
        co2_target_ppm=_safe_float(
            ops_config.get("co2_target_ppm"),
            _safe_float(env.get("CO2_ppm"), 800.0),
        ),
        dehumidification_bias=0.0,
        fogging_or_evap_cooling_intensity=0.0,
    )


def sanitize_control_candidate(
    *,
    candidate: RtrControlCandidate,
    availability: RtrActuatorAvailability,
    ops_config: Mapping[str, Any],
) -> RtrControlCandidate:
    baseline = build_default_control_candidate(env={"T_air_C": 18.0, "CO2_ppm": 800.0}, ops_config=ops_config)
    day_heat = candidate.day_heating_min_temp_C if availability.heating else baseline.day_heating_min_temp_C
    night_heat = candidate.night_heating_min_temp_C if availability.heating else baseline.night_heating_min_temp_C
    day_cool = candidate.day_cooling_target_C if availability.cooling else baseline.day_cooling_target_C
    night_cool = candidate.night_cooling_target_C if availability.cooling else baseline.night_cooling_target_C
    day_cool = max(day_cool, day_heat + 0.8)
    night_cool = max(night_cool, night_heat + 0.8)
    return RtrControlCandidate(
        day_heating_min_temp_C=round(day_heat, 6),
        night_heating_min_temp_C=round(night_heat, 6),
        day_cooling_target_C=round(day_cool, 6),
        night_cooling_target_C=round(night_cool, 6),
        vent_bias_C=round(candidate.vent_bias_C if availability.ventilation else 0.0, 6),
        screen_bias_pct=round(candidate.screen_bias_pct if availability.thermal_screen else 0.0, 6),
        circulation_fan_pct=round(
            _clamp(candidate.circulation_fan_pct if availability.circulation_fan else 0.0, 0.0, 100.0),
            6,
        ),
        co2_target_ppm=round(
            candidate.co2_target_ppm if availability.co2 and candidate.co2_target_ppm is not None else baseline.co2_target_ppm,
            6,
        ),
        dehumidification_bias=round(
            _clamp(candidate.dehumidification_bias if availability.dehumidification else 0.0, 0.0, 1.0),
            6,
        ),
        fogging_or_evap_cooling_intensity=round(
            _clamp(
                candidate.fogging_or_evap_cooling_intensity if availability.fogging_or_evap_cooling else 0.0,
                0.0,
                1.0,
            ),
            6,
        ),
    )


def compute_air_exchange_multiplier(
    *,
    base_air_temp_c: float,
    cooling_target_c: float,
    vent_bias_c: float,
    vent_start_c: float,
) -> float:
    thermal_push = max(0.0, base_air_temp_c - vent_start_c)
    cooling_push = max(0.0, base_air_temp_c - cooling_target_c)
    vent_score = (thermal_push / 5.0) + (cooling_push / 4.0) + (vent_bias_c / 0.8)
    return _clamp(1.0 + max(0.0, vent_score) * 0.65, 0.7, 2.4)


def compute_screen_effects(
    *,
    screen_bias_pct: float,
    phase: str,
) -> dict[str, float]:
    close_fraction = _clamp((50.0 + screen_bias_pct) / 100.0, 0.0, 1.0)
    if phase == "day":
        shortwave_factor = 1.0 - (0.18 * close_fraction)
        u_value_factor = 1.0
        ach_factor = 1.0 + (0.05 * close_fraction)
    else:
        shortwave_factor = 1.0
        u_value_factor = 1.0 - (0.22 * close_fraction)
        ach_factor = 1.0 - (0.14 * close_fraction)
    return {
        "screen_close_fraction": round(close_fraction, 6),
        "shortwave_factor": round(_clamp(shortwave_factor, 0.7, 1.0), 6),
        "u_value_factor": round(_clamp(u_value_factor, 0.65, 1.2), 6),
        "ach_factor": round(_clamp(ach_factor, 0.6, 1.2), 6),
    }


def compute_co2_post_ppm(
    *,
    base_co2_ppm: float,
    target_co2_ppm: float,
    air_exchange_multiplier: float,
) -> float:
    outside_reference_ppm = 420.0
    retention_factor = _clamp(1.15 - (0.18 * max(0.0, air_exchange_multiplier - 1.0)), 0.45, 1.0)
    lifted = base_co2_ppm + ((target_co2_ppm - base_co2_ppm) * retention_factor)
    leaked = lifted - ((lifted - outside_reference_ppm) * max(0.0, air_exchange_multiplier - 1.0) * 0.22)
    return round(max(outside_reference_ppm, leaked), 6)
