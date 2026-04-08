"""Build post-control microclimate state from actuator candidates."""

from __future__ import annotations

from typing import Any

from ...config import greenhouse_config
from .control_effects import (
    build_actuator_availability,
    build_default_control_candidate,
    compute_air_exchange_multiplier,
    compute_co2_post_ppm,
    compute_dewpoint_c,
    compute_screen_effects,
    compute_vpd_kpa,
    sanitize_control_candidate,
)
from .controller_contract import RtrControlCandidate


def _safe_float(value: Any, default: float = 0.0) -> float:
    try:
        if value is None:
            return default
        return float(value)
    except (TypeError, ValueError):
        return default


def _clamp(value: float, low: float, high: float) -> float:
    return max(low, min(high, value))


def _estimate_target_hold_compat(
    *,
    estimator,
    state: dict[str, float],
    target_air_c: float,
    outside_air_c: float,
    dt_hours: float,
    u_value_override: float,
    ach_override: float,
) -> dict[str, Any]:
    try:
        return estimator.estimate_target_hold(
            state=state,
            target_air_c=target_air_c,
            outside_air_c=outside_air_c,
            dt_hours=dt_hours,
            u_value_override=u_value_override,
            ach_override=ach_override,
        )
    except TypeError:
        return estimator.estimate_target_hold(
            state=state,
            target_air_c=target_air_c,
            outside_air_c=outside_air_c,
            dt_hours=dt_hours,
        )


def build_post_control_phase_state(
    *,
    context,
    candidate: RtrControlCandidate,
    phase: str,
    phase_hours: float,
) -> dict[str, Any]:
    env = context.canonical_state["env"]
    flux = context.canonical_state["flux"]
    base_ach = float(greenhouse_config["greenhouse"]["envelope"]["ach_h"])
    base_u_value = float(greenhouse_config["greenhouse"]["envelope"]["u_value_W_m2K"])
    availability = build_actuator_availability(context.ops_config)
    default_candidate = build_default_control_candidate(env=env, ops_config=context.ops_config)
    safe_candidate = sanitize_control_candidate(
        candidate=candidate,
        availability=availability,
        ops_config=context.ops_config,
    )

    base_air_temp_c = float(env["T_air_C"])
    base_leaf_temp_c = float(env["T_canopy_C"])
    base_rh_pct = float(env["RH_pct"])
    base_vpd_kpa = float(env["VPD_kPa"])
    base_par_umol_m2_s = float(env["PAR_umol_m2_s"]) if phase == "day" else max(5.0, float(env["PAR_umol_m2_s"]) * 0.05)
    base_co2_ppm = float(env["CO2_ppm"]) if phase == "day" else max(420.0, float(env["CO2_ppm"]) * 0.75)
    outside_temp_c = float(env["outside_T_C"]) if phase == "day" else float(env["outside_T_C"]) - 1.0

    heating_target_c = (
        safe_candidate.day_heating_min_temp_C if phase == "day" else safe_candidate.night_heating_min_temp_C
    )
    cooling_target_c = (
        safe_candidate.day_cooling_target_C if phase == "day" else safe_candidate.night_cooling_target_C
    )

    screen_effects = compute_screen_effects(
        screen_bias_pct=safe_candidate.screen_bias_pct,
        phase=phase,
    )
    air_exchange_multiplier = compute_air_exchange_multiplier(
        base_air_temp_c=base_air_temp_c,
        cooling_target_c=cooling_target_c,
        vent_bias_c=safe_candidate.vent_bias_C,
        vent_start_c=_safe_float(context.ops_config.get("vent_start_C"), 22.0),
    ) if availability.ventilation else 1.0
    effective_ach = base_ach * air_exchange_multiplier * float(screen_effects["ach_factor"])
    effective_u_value = base_u_value * float(screen_effects["u_value_factor"])

    heating_delta_c = max(0.0, heating_target_c - base_air_temp_c) if availability.heating else 0.0
    cooling_delta_c = max(0.0, base_air_temp_c - cooling_target_c) if availability.cooling else 0.0
    fan_fraction = _clamp(safe_candidate.circulation_fan_pct / 100.0, 0.0, 1.0)
    fog_fraction = _clamp(safe_candidate.fogging_or_evap_cooling_intensity, 0.0, 1.0)
    dehumidification_bias = _clamp(safe_candidate.dehumidification_bias, 0.0, 1.0)
    vent_relief_c = max(0.0, air_exchange_multiplier - 1.0) * (0.45 if phase == "day" else 0.25)
    night_screen_retention_c = float(screen_effects["screen_close_fraction"]) * (0.45 if phase == "night" else 0.0)
    fog_relief_c = fog_fraction * 0.9

    post_air_temp_c = (
        base_air_temp_c
        + heating_delta_c
        - cooling_delta_c
        - vent_relief_c
        - fog_relief_c
        + night_screen_retention_c
    )
    post_air_temp_c = max(post_air_temp_c, heating_target_c) if heating_delta_c > 0 else post_air_temp_c
    post_air_temp_c = min(post_air_temp_c, cooling_target_c) if cooling_delta_c > 0 else post_air_temp_c

    base_leaf_delta_c = base_leaf_temp_c - base_air_temp_c
    post_leaf_delta_c = (
        base_leaf_delta_c * (1.0 - (0.5 * fan_fraction))
        + (0.16 * heating_delta_c)
        - (0.12 * cooling_delta_c)
        - (0.18 * fog_fraction)
    )
    post_leaf_temp_c = post_air_temp_c + post_leaf_delta_c

    rh_shift = (
        (float(screen_effects["screen_close_fraction"]) * (5.0 if phase == "night" else 2.5))
        + (cooling_delta_c * 1.2)
        + (fog_fraction * 9.0)
        - (heating_delta_c * 1.8)
        - (max(0.0, air_exchange_multiplier - 1.0) * 4.5)
        - (dehumidification_bias * 7.0)
    )
    post_rh_pct = _clamp(base_rh_pct + rh_shift, 45.0, 98.0)
    post_vpd_kpa = compute_vpd_kpa(post_air_temp_c, post_rh_pct)
    co2_post_ppm = compute_co2_post_ppm(
        base_co2_ppm=base_co2_ppm,
        target_co2_ppm=float(safe_candidate.co2_target_ppm or default_candidate.co2_target_ppm or base_co2_ppm),
        air_exchange_multiplier=air_exchange_multiplier,
    )
    post_par_umol_m2_s = base_par_umol_m2_s * float(screen_effects["shortwave_factor"])

    transpiration_factor = _clamp(
        1.0
        + ((post_vpd_kpa - base_vpd_kpa) * 0.22)
        + (fan_fraction * 0.15)
        - (fog_fraction * 0.12),
        0.45,
        1.9,
    )
    transpiration_post = float(flux["transpiration_g_m2_s"]) * transpiration_factor
    latent_heat_post = float(flux["latent_heat_W_m2"]) * _clamp(transpiration_factor, 0.5, 1.8)
    sensible_heat_post = (
        float(flux["sensible_heat_W_m2"])
        + (heating_delta_c * 7.5)
        - (cooling_delta_c * 6.5)
        - ((latent_heat_post - float(flux["latent_heat_W_m2"])) * 0.3)
    )
    dewpoint_c = compute_dewpoint_c(post_air_temp_c, post_rh_pct)
    condensation_risk_post = max(0.0, dewpoint_c - post_leaf_temp_c + 0.4)

    baseline_energy = _estimate_target_hold_compat(
        estimator=context.energy_estimator,
        state={"H_W_m2": float(flux["sensible_heat_W_m2"])},
        target_air_c=base_air_temp_c,
        outside_air_c=outside_temp_c,
        dt_hours=phase_hours,
        u_value_override=base_u_value,
        ach_override=base_ach,
    )
    post_energy = _estimate_target_hold_compat(
        estimator=context.energy_estimator,
        state={"H_W_m2": sensible_heat_post},
        target_air_c=post_air_temp_c,
        outside_air_c=outside_temp_c,
        dt_hours=phase_hours,
        u_value_override=effective_u_value,
        ach_override=effective_ach,
    )
    vent_neutral_energy = _estimate_target_hold_compat(
        estimator=context.energy_estimator,
        state={"H_W_m2": sensible_heat_post},
        target_air_c=post_air_temp_c,
        outside_air_c=outside_temp_c,
        dt_hours=phase_hours,
        u_value_override=effective_u_value,
        ach_override=base_ach * float(screen_effects["ach_factor"]),
    )
    total_energy_kwh_m2_day = float(post_energy["daily_kWh"]) / max(context.greenhouse_area_m2, 1.0)
    baseline_energy_kwh_m2_day = float(baseline_energy["daily_kWh"]) / max(context.greenhouse_area_m2, 1.0)
    vent_neutral_energy_kwh_m2_day = float(vent_neutral_energy["daily_kWh"]) / max(context.greenhouse_area_m2, 1.0)
    ventilation_energy_kwh_m2_day = max(0.0, total_energy_kwh_m2_day - vent_neutral_energy_kwh_m2_day)
    mode = str(post_energy.get("mode") or "").strip().lower()
    if mode not in {"heating", "cooling", "off"}:
        if total_energy_kwh_m2_day <= 1e-9:
            mode = "off"
        elif cooling_delta_c > 0:
            mode = "cooling"
        else:
            mode = "heating"
    thermal_energy_kwh_m2_day = max(0.0, total_energy_kwh_m2_day - ventilation_energy_kwh_m2_day)
    heating_energy_kwh_m2_day = thermal_energy_kwh_m2_day if mode == "heating" else 0.0
    cooling_energy_kwh_m2_day = thermal_energy_kwh_m2_day if mode == "cooling" else 0.0
    total_energy_cost_krw_m2_day = total_energy_kwh_m2_day * float(context.cost_per_kwh)

    humidity_risk_penalty = max(0.0, (post_rh_pct - 84.0) / 12.0) + max(0.0, 0.45 - post_vpd_kpa)
    disease_penalty = humidity_risk_penalty + (0.5 * max(0.0, condensation_risk_post))
    stress_penalty = (
        max(0.0, post_air_temp_c - 31.0)
        + max(0.0, 16.0 - post_air_temp_c)
        + max(0.0, post_vpd_kpa - 2.2)
        + max(0.0, 0.25 - post_vpd_kpa)
    )

    return {
        "phase": phase,
        "availability": availability.as_dict(),
        "candidate": safe_candidate.as_dict(),
        "env": {
            "T_air_C": round(post_air_temp_c, 6),
            "T_leaf_C": round(post_leaf_temp_c, 6),
            "RH_pct": round(post_rh_pct, 6),
            "VPD_kPa": round(post_vpd_kpa, 6),
            "CO2_ppm": round(co2_post_ppm, 6),
            "PAR_umol_m2_s": round(post_par_umol_m2_s, 6),
            "outside_T_C": round(outside_temp_c, 6),
            "air_exchange_post": round(effective_ach, 6),
        },
        "flux": {
            "H_post_W_m2": round(sensible_heat_post, 6),
            "LE_post_W_m2": round(latent_heat_post, 6),
            "transpiration_post_g_m2_s": round(transpiration_post, 6),
        },
        "risk": {
            "condensation_risk_post": round(condensation_risk_post, 6),
            "humidity_penalty": round(humidity_risk_penalty, 6),
            "disease_penalty": round(disease_penalty, 6),
            "stress_penalty": round(stress_penalty, 6),
        },
        "energy": {
            "heating_energy_kWh_m2_day": round(heating_energy_kwh_m2_day, 6),
            "cooling_energy_kWh_m2_day": round(cooling_energy_kwh_m2_day, 6),
            "ventilation_energy_kWh_m2_day": round(ventilation_energy_kwh_m2_day, 6),
            "total_energy_kWh_m2_day": round(total_energy_kwh_m2_day, 6),
            "baseline_energy_kWh_m2_day": round(baseline_energy_kwh_m2_day, 6),
            "vent_neutral_energy_kWh_m2_day": round(vent_neutral_energy_kwh_m2_day, 6),
            "total_energy_cost_krw_m2_day": round(total_energy_cost_krw_m2_day, 6),
            "mode": mode,
        },
        "control_effect_trace": {
            "heating_delta_C": round(heating_delta_c, 6),
            "cooling_delta_C": round(cooling_delta_c, 6),
            "ventilation_multiplier": round(air_exchange_multiplier, 6),
            "screen_close_fraction": round(float(screen_effects["screen_close_fraction"]), 6),
            "circulation_fan_pct": round(safe_candidate.circulation_fan_pct, 6),
            "co2_target_ppm": round(float(safe_candidate.co2_target_ppm or 0.0), 6),
            "fogging_or_evap_cooling_intensity": round(safe_candidate.fogging_or_evap_cooling_intensity, 6),
            "dehumidification_bias": round(safe_candidate.dehumidification_bias, 6),
        },
    }
