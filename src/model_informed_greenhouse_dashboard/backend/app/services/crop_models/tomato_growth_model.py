"""Thin tomato model wrapper for normalized snapshots and fruit-thinning events."""

from __future__ import annotations

from datetime import UTC, date, datetime, time
from typing import Any

from ...adapters.tomato import TomatoAdapter
from .canopy_integration import (
    CanopyLayerDefinition,
    build_three_class_layers,
    integrate_canopy_layers,
)
from .gas_exchange_fvcb import solve_tomato_leaf_fvcb
from .stomatal_ball_berry import BallBerryParameters, solve_coupled_leaf_exchange


def _as_datetime(value: datetime | date | None) -> datetime:
    if isinstance(value, str):
        try:
            return datetime.fromisoformat(value)
        except ValueError:
            try:
                return datetime.combine(date.fromisoformat(value), time.min, tzinfo=UTC)
            except ValueError:
                return datetime.now(UTC)
    if isinstance(value, datetime):
        return value if value.tzinfo else value.replace(tzinfo=UTC)
    if isinstance(value, date):
        return datetime.combine(value, time.min, tzinfo=UTC)
    return datetime.now(UTC)


def _serialize_truss_cohorts(adapter: TomatoAdapter) -> list[dict[str, Any]]:
    cohorts = []
    for idx, cohort in enumerate(getattr(adapter.model, "truss_cohorts", []) or []):
        cohorts.append(
            {
                "cohort_id": idx,
                "tdvs": round(float(cohort.get("tdvs", 0.0)), 6),
                "n_fruits": int(cohort.get("n_fruits", getattr(adapter.model, "n_f", 0))),
                "fruit_dry_matter_g_m2": round(float(cohort.get("w_fr_cohort", 0.0)), 6),
                "active": bool(cohort.get("active", True)),
            }
        )
    return cohorts


def _build_tomato_gas_exchange(adapter: TomatoAdapter) -> dict[str, Any]:
    model = adapter.model
    layers = build_three_class_layers(float(getattr(model, "LAI", 0.0)))
    if not layers:
        return {
            "canopy_gross_assimilation_umol_m2_s": 0.0,
            "canopy_net_assimilation_umol_m2_s": 0.0,
            "canopy_stomatal_conductance_m_s": 0.0,
            "canopy_transpiration_proxy": 0.0,
            "limiting_layer": None,
            "limiting_factor": None,
            "layer_classes": [],
        }

    ball_berry = BallBerryParameters(g0=0.019, g1=26.85)

    def _solver(layer: CanopyLayerDefinition, ppfd_umol_m2_s: float):
        def _assimilation(c_i_ppm: float):
            return solve_tomato_leaf_fvcb(
                leaf_temperature_k=float(getattr(model, "T_c", 298.15)),
                ppfd_umol_m2_s=ppfd_umol_m2_s,
                c_i_ppm=c_i_ppm,
                joubert_params=model.joubert_params,
            )

        return solve_coupled_leaf_exchange(
            ambient_co2_ppm=float(getattr(model, "u_CO2", 0.0)),
            rh_fraction=float(getattr(model, "RH", 0.0)),
            assimilation_solver=_assimilation,
            ball_berry=ball_berry,
            leaf_temperature_k=float(getattr(model, "T_c", 298.15)),
            ci_initial=float(getattr(model, "Ci", max(1.0, getattr(model, "u_CO2", 0.0) * 0.7))),
        )

    profile = integrate_canopy_layers(
        top_ppfd_umol_m2_s=float(getattr(model, "u_PAR", 0.0)),
        extinction_coefficient=float(getattr(model, "k_ext", 0.72)),
        layers=layers,
        leaf_solver_factory=_solver,
        respiration_umol_m2_s=0.0,
    )
    return {
        "canopy_gross_assimilation_umol_m2_s": round(
            profile.canopy_gross_assimilation_umol_m2_s,
            6,
        ),
        "canopy_net_assimilation_umol_m2_s": round(
            profile.canopy_net_assimilation_umol_m2_s,
            6,
        ),
        "canopy_stomatal_conductance_m_s": round(
            profile.canopy_stomatal_conductance_m_s,
            6,
        ),
        "canopy_transpiration_proxy": round(
            profile.canopy_transpiration_proxy,
            6,
        ),
        "limiting_layer": profile.limiting_layer,
        "limiting_factor": profile.limiting_factor,
        "layer_classes": profile.layer_classes,
    }


def build_tomato_snapshot(
    adapter: TomatoAdapter,
    *,
    greenhouse_id: str,
    snapshot_time: datetime | None = None,
) -> dict[str, Any]:
    """Build a versioned normalized tomato snapshot on top of the adapter seam."""
    model = adapter.model
    last_state = adapter._last_state or {}
    snapshot_dt = snapshot_time or _as_datetime(getattr(adapter, "_last_datetime", None))
    start_dt = _as_datetime(getattr(model, "start_date", snapshot_dt))
    truss_cohorts = _serialize_truss_cohorts(adapter)
    gas_exchange = _build_tomato_gas_exchange(adapter)
    sink_demand = float(getattr(model, "_compute_generative_sink_absolute_gd", lambda: 0.0)())
    fruit_load = sum(cohort["n_fruits"] for cohort in truss_cohorts if cohort["active"])
    layer_activity = {
        entry["leaf_class"]: entry["relative_activity"]
        for entry in gas_exchange["layer_classes"]
    }

    return {
        "snapshot_version": "tomato-runtime-v1",
        "greenhouse_id": greenhouse_id,
        "crop": "tomato",
        "captured_at": snapshot_dt.isoformat(),
        "state": {
            "stage": "reproductive" if truss_cohorts else "vegetative",
            "days_after_transplant": max(0, (snapshot_dt.date() - start_dt.date()).days),
            "lai": round(float(getattr(model, "LAI", 0.0)), 6),
            "truss_count": int(getattr(model, "truss_count", 0)),
            "active_trusses": int(getattr(model, "_count_active_trusses", lambda: 0)()),
            "truss_cohorts": truss_cohorts,
            "vegetative_dry_matter_g_m2": round(float(getattr(model, "W_lv", 0.0) + getattr(model, "W_st", 0.0) + getattr(model, "W_rt", 0.0)), 6),
            "fruit_dry_matter_g_m2": round(float(getattr(model, "W_fr", 0.0)), 6),
            "harvested_fruit_dry_matter_g_m2": round(float(getattr(model, "W_fr_harvested", 0.0)), 6),
            "fruit_load": int(fruit_load),
            "crop_growth_efficiency": round(float(last_state.get("crop_efficiency", getattr(model, "_calculate_current_epsilon", lambda: 0.0)())), 6),
            "source_capacity": round(float(gas_exchange["canopy_gross_assimilation_umol_m2_s"]), 6),
            "sink_demand": round(sink_demand, 6),
            "current_fruit_partition_ratio": round(
                float(getattr(model, "W_fr", 0.0))
                / max(
                    1e-9,
                    float(getattr(model, "W_fr", 0.0))
                    + float(getattr(model, "W_lv", 0.0))
                    + float(getattr(model, "W_st", 0.0))
                    + float(getattr(model, "W_rt", 0.0)),
                ),
                6,
            ),
            "upper_leaf_activity": round(float(layer_activity.get("upper", 0.0)), 6),
            "middle_leaf_activity": round(float(layer_activity.get("middle", 0.0)), 6),
            "bottom_leaf_activity": round(float(layer_activity.get("bottom", 0.0)), 6),
            "limiting_factor": gas_exchange["limiting_factor"],
        },
        "live_observation": {
            "canopy_temperature_c": round(float(last_state.get("T_canopy_C", getattr(model, "T_c", 273.15) - 273.15)), 6),
            "transpiration_g_m2": round(float(last_state.get("transpiration_g_m2", 0.0)), 6),
            "stomatal_conductance_m_s": round(float(gas_exchange["canopy_stomatal_conductance_m_s"]), 6),
        },
        "gas_exchange": gas_exchange,
        "supported_work_events": ["fruit_thinning"],
    }


def apply_tomato_work_event(
    adapter: TomatoAdapter,
    event: dict[str, Any],
) -> dict[str, Any]:
    """Apply a canonical tomato fruit-thinning event to the adapter state."""
    event_type = event.get("event_type")
    if event_type != "fruit_thinning":
        raise ValueError(f"Unsupported tomato work event: {event_type}")

    model = adapter.model
    cohort_id = event.get("cohort_id")
    if cohort_id is None:
        cohort_id = event.get("truss_id")

    sink_before = float(getattr(model, "_compute_generative_sink_absolute_gd", lambda: 0.0)())
    fruits_removed = int(event.get("fruits_removed_count") or 0)

    if cohort_id is None:
        previous_value = int(getattr(model, "n_f", 0))
        target_value = int(event.get("target_fruits_per_truss") or max(0, previous_value - fruits_removed))
        target_value = max(0, min(previous_value, target_value))
        model.n_f = target_value
        if getattr(model, "truss_cohorts", None):
            model.bulk_set_truss_n_f([target_value] * len(model.truss_cohorts))
    else:
        cohort_index = int(cohort_id)
        cohorts = getattr(model, "truss_cohorts", []) or []
        if cohort_index < 0 or cohort_index >= len(cohorts):
            raise ValueError(f"Unknown tomato cohort index: {cohort_index}")
        previous_value = int(cohorts[cohort_index].get("n_fruits", getattr(model, "n_f", 0)))
        target_value = int(event.get("target_fruits_per_truss") or max(0, previous_value - fruits_removed))
        target_value = max(0, min(previous_value, target_value))
        model.set_truss_n_f(cohort_index, target_value)

    sink_after = float(getattr(model, "_compute_generative_sink_absolute_gd", lambda: 0.0)())
    if adapter._last_state is not None:
        adapter._last_state.update(
            {
                "n_fruits_per_truss": int(getattr(model, "n_f", 0)),
                "active_trusses": int(getattr(model, "_count_active_trusses", lambda: 0)()),
                "truss_count": int(getattr(model, "truss_count", 0)),
            }
        )

    return {
        "event_type": event_type,
        "applied": True,
        "cohort_id": None if cohort_id is None else int(cohort_id),
        "previous_fruits_per_truss": previous_value,
        "target_fruits_per_truss": target_value,
        "fruits_removed_count": previous_value - target_value,
        "sink_demand_before": round(sink_before, 6),
        "sink_demand_after": round(sink_after, 6),
    }
