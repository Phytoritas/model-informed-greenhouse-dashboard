"""Canonical RTR state built strictly from the internal crop and energy models."""

from __future__ import annotations

import copy
from dataclasses import dataclass
from typing import Any, Mapping

from ...adapters.cucumber import CucumberAdapter
from ...adapters.tomato import TomatoAdapter
from ...config import greenhouse_config
from ..energy import EnergyEstimator
from .node_target_engine import predict_development_rate_day


def _safe_float(value: Any, default: float = 0.0) -> float:
    try:
        if value is None:
            return default
        return float(value)
    except (TypeError, ValueError):
        return default


def _compute_vpd_kpa(temp_c: float, rh_pct: float) -> float:
    rh_fraction = max(0.0, min(1.0, rh_pct / 100.0))
    saturation = 0.6108 * (2.718281828 ** ((17.27 * temp_c) / (temp_c + 237.3)))
    return max(0.0, saturation * (1.0 - rh_fraction))


def _clone_adapter(crop: str, raw_adapter_state: Mapping[str, Any]):
    crop_cfg = greenhouse_config["crops"][crop]
    meta = raw_adapter_state.get("_adapter_meta", {}) if isinstance(raw_adapter_state, Mapping) else {}
    area_m2 = _safe_float(meta.get("area_m2"), greenhouse_config["greenhouse"]["area_m2"])
    plant_density = _safe_float(meta.get("plant_density"), crop_cfg["plant_density_per_m2"])
    if crop == "tomato":
        adapter = TomatoAdapter(area_m2=area_m2, plant_density=plant_density)
    else:
        adapter = CucumberAdapter(area_m2=area_m2, plant_density=plant_density)
    adapter.load_state(copy.deepcopy(dict(raw_adapter_state)))
    return adapter


def _estimate_energy(
    *,
    estimator: EnergyEstimator | None,
    state: Mapping[str, Any],
    env: Mapping[str, float],
    setpoints: Mapping[str, float],
) -> dict[str, Any]:
    resolved = estimator or EnergyEstimator(
        area_m2=greenhouse_config["greenhouse"]["area_m2"],
        height_m=greenhouse_config["greenhouse"]["height_m"],
        u_value=greenhouse_config["greenhouse"]["envelope"]["u_value_W_m2K"],
        ach=greenhouse_config["greenhouse"]["envelope"]["ach_h"],
        cop_curve={
            float(key): value
            for key, value in greenhouse_config["greenhouse"]["hvac"]["cop_heating_curve"].items()
        },
        cop_cooling=greenhouse_config["greenhouse"]["hvac"]["cop_cooling"],
    )
    if hasattr(resolved, "estimate_step_stateless"):
        return resolved.estimate_step_stateless(
            state=dict(state),
            env=dict(env),
            setpoints=dict(setpoints),
        )
    return resolved.estimate_step(
        state=dict(state),
        env=dict(env),
        setpoints=dict(setpoints),
        dt=env.get("timestamp"),  # type: ignore[arg-type]
        dt_hours=1.0,
    )


@dataclass
class InternalModelContext:
    """Canonical RTR state plus the reconstructed adapter/model seam."""

    canonical_state: dict[str, Any]
    adapter: Any
    greenhouse_area_m2: float
    actual_area_m2: float
    ops_config: dict[str, float]
    crop_profile: dict[str, Any]
    recent_events: list[dict[str, Any]]
    cost_per_kwh: float
    energy_estimator: EnergyEstimator


def build_internal_model_context(
    *,
    snapshot_record: Mapping[str, Any],
    crop_state: Mapping[str, Any] | None,
    greenhouse_id: str,
    profiles_payload: Mapping[str, Any],
    recent_events: list[dict[str, Any]] | None = None,
    actual_area_m2: float | None = None,
    cost_per_kwh: float = 120.0,
) -> InternalModelContext:
    normalized_snapshot = snapshot_record.get("normalized_snapshot", snapshot_record)
    state = normalized_snapshot.get("state", {})
    gas_exchange = normalized_snapshot.get("gas_exchange", {})
    live_observation = normalized_snapshot.get("live_observation", {})
    raw_adapter_state = snapshot_record.get("raw_adapter_state", {})
    raw_last_state = (
        raw_adapter_state.get("_adapter_meta", {}).get("last_state", {})
        if isinstance(raw_adapter_state, Mapping)
        else {}
    )
    crop = str(snapshot_record.get("crop") or normalized_snapshot.get("crop") or "").lower()
    adapter = _clone_adapter(crop, raw_adapter_state)

    greenhouse_area_m2 = _safe_float(
        raw_adapter_state.get("_adapter_meta", {}).get("area_m2"),
        greenhouse_config["greenhouse"]["area_m2"],
    )
    resolved_actual_area_m2 = float(actual_area_m2 or greenhouse_area_m2)
    ops_config = dict((crop_state or {}).get("ops_config") or {})
    if not ops_config:
        ops_config = {
            "heating_set_C": float(greenhouse_config["operations"]["heating_set_C"]),
            "cooling_set_C": float(greenhouse_config["operations"]["cooling_set_C"]),
            "p_band_C": float(greenhouse_config["operations"]["p_band_C"]),
            "co2_target_ppm": float(greenhouse_config["operations"]["co2_target_ppm"]),
            "vent_start_C": float(greenhouse_config["operations"]["vent_start_C"]),
        }

    t_air_c = _safe_float(raw_last_state.get("T_air_C"), _safe_float(adapter.model.T_a, 293.15) - 273.15)
    t_canopy_c = _safe_float(
        live_observation.get("canopy_temperature_c"),
        _safe_float(raw_last_state.get("T_canopy_C"), _safe_float(adapter.model.T_c, 293.15) - 273.15),
    )
    rh_pct = _safe_float(raw_last_state.get("RH_percent"), _safe_float(adapter.model.RH, 0.7) * 100.0)
    co2_ppm = _safe_float(raw_last_state.get("CO2_ppm"), _safe_float(adapter.model.u_CO2, 800.0))
    par_umol_m2_s = _safe_float(raw_last_state.get("PAR_umol"), _safe_float(adapter.model.u_PAR, 0.0))
    outside_t_c = _safe_float(raw_last_state.get("T_out_C"), t_air_c - 5.0)
    dt_seconds = max(1.0, _safe_float(raw_last_state.get("dt_seconds"), 3600.0))
    transpiration_g_m2_s = _safe_float(
        raw_last_state.get("transpiration_g_m2"),
        _safe_float(live_observation.get("transpiration_g_m2"), 0.0),
    ) / dt_seconds

    gross_assim = _safe_float(
        gas_exchange.get("canopy_gross_assimilation_umol_m2_s"),
        raw_last_state.get("gross_photosynthesis_umol_m2_s"),
    )
    net_assim = _safe_float(
        gas_exchange.get("canopy_net_assimilation_umol_m2_s"),
        raw_last_state.get("net_assimilation_umol_m2_s"),
    )
    respiration_proxy = max(0.0, gross_assim - net_assim)
    stomatal_conductance = _safe_float(
        live_observation.get("stomatal_conductance_m_s"),
        raw_last_state.get("stomatal_conductance_m_s"),
    )
    sensible_heat = _safe_float(raw_last_state.get("H_W_m2"), 0.0)
    latent_heat = _safe_float(raw_last_state.get("LE_W_m2"), 0.0)
    vpd_kpa = _compute_vpd_kpa(t_air_c, rh_pct)

    profile_key = "Tomato" if crop == "tomato" else "Cucumber"
    crop_profile = dict((profiles_payload.get("profiles") or {}).get(profile_key) or {})
    baseline_block = crop_profile.get("baseline") or {}
    baseline_target_c = _safe_float(
        baseline_block.get("baseline_target_C"),
        _safe_float(crop_profile.get("baseTempC"), float(ops_config.get("heating_set_C", 18.0))),
    )

    resolved_energy_estimator = (crop_state or {}).get("energy") or EnergyEstimator(
        area_m2=greenhouse_area_m2,
        height_m=greenhouse_config["greenhouse"]["height_m"],
        u_value=greenhouse_config["greenhouse"]["envelope"]["u_value_W_m2K"],
        ach=greenhouse_config["greenhouse"]["envelope"]["ach_h"],
        cop_curve={
            float(key): value
            for key, value in greenhouse_config["greenhouse"]["hvac"]["cop_heating_curve"].items()
        },
        cop_cooling=greenhouse_config["greenhouse"]["hvac"]["cop_cooling"],
    )
    energy_payload = _estimate_energy(
        estimator=resolved_energy_estimator,
        state=raw_last_state or {"H_W_m2": sensible_heat},
        env={"T_air_C": t_air_c},
        setpoints={
            "heating_set_C": float(ops_config.get("heating_set_C", baseline_target_c)),
            "cooling_set_C": float(ops_config.get("cooling_set_C", baseline_target_c + 8.0)),
            "T_out_C": outside_t_c,
        },
    )

    if crop == "cucumber":
        node_count = int(state.get("node_count") or 0)
        vegetative_dm = _safe_float(
            state.get("vegetative_dry_matter_g_m2"),
            raw_last_state.get("vegetative_dry_weight_g_m2"),
        )
        fruit_dm = _safe_float(
            state.get("fruit_dry_matter_g_m2"),
            raw_last_state.get("fruit_dry_weight_g_m2"),
        )
        harvested_dm = _safe_float(state.get("harvested_fruit_dry_matter_g_m2"), 0.0)
        crop_specific = {
            "cucumber": {
                "leaf_area_by_rank": state.get("leaf_area_by_rank") or [],
                "upper_leaf_activity": _safe_float(state.get("upper_leaf_activity"), 0.0),
                "middle_leaf_activity": _safe_float(state.get("middle_leaf_activity"), 0.0),
                "bottom_leaf_activity": _safe_float(state.get("bottom_leaf_activity"), 0.0),
                "remaining_leaves": int(state.get("leaf_count") or 0),
            },
            "tomato": {},
        }
    else:
        node_count = int(state.get("truss_count") or 0)
        vegetative_dm = _safe_float(state.get("vegetative_dry_matter_g_m2"), 0.0)
        fruit_dm = _safe_float(
            state.get("fruit_dry_matter_g_m2"),
            raw_last_state.get("fruit_dry_weight_g_m2"),
        )
        harvested_dm = _safe_float(
            state.get("harvested_fruit_dry_matter_g_m2"),
            raw_last_state.get("harvested_fruit_g_m2"),
        )
        crop_specific = {
            "cucumber": {},
            "tomato": {
                "truss_cohorts": state.get("truss_cohorts") or [],
                "active_trusses": int(
                    state.get("active_trusses") or raw_last_state.get("active_trusses") or 0
                ),
                "fruit_partition_ratio": _safe_float(
                    state.get("current_fruit_partition_ratio"),
                    0.0,
                ),
                "upper_leaf_activity": _safe_float(state.get("upper_leaf_activity"), 0.0),
                "middle_leaf_activity": _safe_float(state.get("middle_leaf_activity"), 0.0),
                "bottom_leaf_activity": _safe_float(state.get("bottom_leaf_activity"), 0.0),
            },
        }

    predicted_node_rate_day = predict_development_rate_day(
        crop=crop,
        raw_adapter_state=raw_adapter_state,
        mean_air_temp_c=float(ops_config.get("heating_set_C", t_air_c)),
    )

    source_capacity = _safe_float(state.get("source_capacity"), gross_assim)
    sink_demand = _safe_float(state.get("sink_demand"), 0.0)
    source_sink_balance = (
        (source_capacity - sink_demand) / max(1.0, abs(source_capacity) + abs(sink_demand))
        if (source_capacity or sink_demand)
        else 0.0
    )

    canonical_state = {
        "timestamp": normalized_snapshot.get("captured_at") or snapshot_record.get("snapshot_time"),
        "crop": crop,
        "greenhouse_id": greenhouse_id,
        "env": {
            "T_air_C": round(t_air_c, 6),
            "T_canopy_C": round(t_canopy_c, 6),
            "RH_pct": round(rh_pct, 6),
            "VPD_kPa": round(vpd_kpa, 6),
            "CO2_ppm": round(co2_ppm, 6),
            "PAR_umol_m2_s": round(par_umol_m2_s, 6),
            "outside_T_C": round(outside_t_c, 6),
        },
        "flux": {
            "gross_assim_umol_m2_s": round(gross_assim, 6),
            "net_assim_umol_m2_s": round(net_assim, 6),
            "respiration_proxy_umol_m2_s": round(respiration_proxy, 6),
            "transpiration_g_m2_s": round(transpiration_g_m2_s, 6),
            "latent_heat_W_m2": round(latent_heat, 6),
            "sensible_heat_W_m2": round(sensible_heat, 6),
            "stomatal_conductance_m_s": round(stomatal_conductance, 6),
        },
        "growth": {
            "LAI": round(_safe_float(state.get("lai"), state.get("LAI")), 6),
            "node_count": int(node_count),
            "predicted_node_rate_day": round(predicted_node_rate_day, 6),
            "fruit_load": round(_safe_float(state.get("fruit_load"), 0.0), 6),
            "sink_demand": round(sink_demand, 6),
            "source_capacity": round(source_capacity, 6),
            "source_sink_balance": round(source_sink_balance, 6),
            "vegetative_dry_matter_g_m2": round(vegetative_dm, 6),
            "fruit_dry_matter_g_m2": round(fruit_dm, 6),
            "harvested_fruit_dry_matter_g_m2": round(harvested_dm, 6),
        },
        "crop_specific": crop_specific,
        "energy": {
            "Q_load_kW": round(_safe_float(energy_payload.get("Q_load_kW"), 0.0), 6),
            "P_elec_kW": round(_safe_float(energy_payload.get("P_elec_kW"), 0.0), 6),
            "COP_current": round(_safe_float(energy_payload.get("COP_current"), 0.0), 6),
            "daily_kWh": round(_safe_float(energy_payload.get("daily_kWh"), 0.0), 6),
        },
        "events": {
            "recent_leaf_removal": [
                event for event in (recent_events or []) if event.get("event_type") == "leaf_removal"
            ],
            "recent_fruit_thinning": [
                event for event in (recent_events or []) if event.get("event_type") == "fruit_thinning"
            ],
            "recent_harvest": [
                event for event in (recent_events or []) if event.get("event_type") == "harvest"
            ],
            "recent_setpoint_changes": [
                event
                for event in (recent_events or [])
                if str(event.get("event_type") or "").endswith("_setpoint_change")
            ],
        },
        "baseline_rtr": {
            "baseTempC": round(_safe_float(crop_profile.get("baseTempC"), baseline_target_c), 6),
            "slopeCPerMjM2": round(_safe_float(crop_profile.get("slopeCPerMjM2"), 0.0), 6),
            "baseline_target_C": round(baseline_target_c, 6),
        },
        "optimizer": crop_profile.get("optimizer") or {},
    }

    return InternalModelContext(
        canonical_state=canonical_state,
        adapter=adapter,
        greenhouse_area_m2=greenhouse_area_m2,
        actual_area_m2=resolved_actual_area_m2,
        ops_config=ops_config,
        crop_profile=crop_profile,
        recent_events=recent_events or [],
        cost_per_kwh=float(cost_per_kwh),
        energy_estimator=resolved_energy_estimator,
    )
