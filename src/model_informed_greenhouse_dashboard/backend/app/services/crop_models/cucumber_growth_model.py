"""Thin cucumber model wrapper for normalized snapshots and leaf-removal events."""

from __future__ import annotations

from datetime import UTC, date, datetime, time
import math
from typing import Any

from ...adapters.cucumber import CucumberAdapter
from model_informed_greenhouse_dashboard.models.legacy.CucumberModel import gompertz_growth
from .canopy_integration import CanopyLayerDefinition, integrate_canopy_layers
from .gas_exchange_fvcb import solve_cucumber_leaf_fvcb
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


def _leaf_area_by_rank(adapter: CucumberAdapter) -> list[dict[str, float | int]]:
    model = adapter.model
    cumulative_thermal_time = float(getattr(model, "cumulative_thermal_time", 0.0))
    remaining_leaves = int(getattr(model, "remaining_leaves", 0))
    leaves = list(getattr(model, "leaves_info", []) or [])
    active_leaves = leaves[-remaining_leaves:] if remaining_leaves > 0 else []
    ranked_areas: list[dict[str, float | int]] = []

    for leaf in active_leaves:
        emergence_thermal_time = float(leaf.get("Thermal Time", 0.0))
        thermal_age = max(0.0, cumulative_thermal_time - emergence_thermal_time)
        area_cm2 = float(
            gompertz_growth(
                thermal_age,
                getattr(model, "gompertz_a"),
                getattr(model, "gompertz_b"),
                getattr(model, "gompertz_c"),
            )
        )
        ranked_areas.append(
            {
                "rank": int(leaf.get("Leaf Number", 0)),
                "area_cm2": round(area_cm2, 3),
                "leaf_area_index": round(
                    area_cm2 * float(getattr(model, "leaf_area_conversion_factor", 0.0)),
                    6,
                ),
                "thermal_age": round(thermal_age, 3),
            }
        )

    return ranked_areas


def _leaf_class_for_position(position: int, total_layers: int) -> str:
    if total_layers <= 1:
        return "upper"
    upper_cutoff = max(1, math.ceil(total_layers / 3))
    middle_cutoff = max(upper_cutoff + 1, math.ceil((2 * total_layers) / 3))
    if position < upper_cutoff:
        return "upper"
    if position < middle_cutoff:
        return "middle"
    return "bottom"


def _build_cucumber_gas_exchange(adapter: CucumberAdapter) -> dict[str, Any]:
    model = adapter.model
    leaves_by_rank = list(reversed(_leaf_area_by_rank(adapter)))
    if not leaves_by_rank:
        return {
            "canopy_gross_assimilation_umol_m2_s": 0.0,
            "canopy_net_assimilation_umol_m2_s": 0.0,
            "canopy_stomatal_conductance_m_s": 0.0,
            "canopy_transpiration_proxy": 0.0,
            "limiting_layer": None,
            "limiting_factor": None,
            "layer_classes": [],
        }

    layer_params: dict[str, dict[str, float]] = {}
    layers: list[CanopyLayerDefinition] = []
    for position, leaf in enumerate(leaves_by_rank):
        layer_label = f"rank-{int(leaf['rank'])}"
        if position < 5:
            rank_params = dict(model.rank_params["rank_5"])
        elif position < 10:
            rank_params = dict(model.rank_params["rank_10"])
        else:
            rank_params = dict(model.rank_params["rank_else"])
        layer_params[layer_label] = rank_params
        layers.append(
            CanopyLayerDefinition(
                label=layer_label,
                leaf_class=_leaf_class_for_position(position, len(leaves_by_rank)),
                leaf_area_index=float(leaf["leaf_area_index"]),
            )
        )

    ball_berry = BallBerryParameters(g0=0.045, g1=8.376)

    def _solver(layer: CanopyLayerDefinition, ppfd_umol_m2_s: float):
        def _assimilation(c_i_ppm: float):
            return solve_cucumber_leaf_fvcb(
                leaf_temperature_k=float(getattr(model, "T_c", 298.15)),
                ppfd_umol_m2_s=ppfd_umol_m2_s,
                c_i_ppm=c_i_ppm,
                rank_params=layer_params[layer.label],
                fvcb_params=model.fcvb_params,
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
        extinction_coefficient=0.8,
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


def build_cucumber_snapshot(
    adapter: CucumberAdapter,
    *,
    greenhouse_id: str,
    snapshot_time: datetime | None = None,
) -> dict[str, Any]:
    """Build a versioned normalized cucumber snapshot on top of the adapter seam."""
    model = adapter.model
    last_state = adapter._last_state or {}
    snapshot_dt = snapshot_time or _as_datetime(getattr(adapter, "_last_datetime", None))
    start_dt = _as_datetime(getattr(model, "start_date", snapshot_dt))
    leaves_by_rank = _leaf_area_by_rank(adapter)
    gas_exchange = _build_cucumber_gas_exchange(adapter)
    total_leaf_area_cm2 = sum(entry["area_cm2"] for entry in leaves_by_rank)
    fruit_load = max(
        0,
        int(getattr(model, "nodes", 0)) - int(getattr(model, "reproductive_node_threshold", 15)),
    )

    lai = float(getattr(model, "LAI", 0.0))
    source_capacity = float(gas_exchange["canopy_gross_assimilation_umol_m2_s"])
    sink_demand = round(float(getattr(model, "part_fruit", 0.0)) * max(float(getattr(model, "fruit_dw", 0.0)), 0.0), 6)
    layer_activity = {
        entry["leaf_class"]: entry["relative_activity"]
        for entry in gas_exchange["layer_classes"]
    }

    return {
        "snapshot_version": "cucumber-runtime-v1",
        "greenhouse_id": greenhouse_id,
        "crop": "cucumber",
        "captured_at": snapshot_dt.isoformat(),
        "state": {
            "stage": "reproductive" if fruit_load > 0 else "vegetative",
            "days_after_transplant": max(0, (snapshot_dt.date() - start_dt.date()).days),
            "cumulative_thermal_time": round(float(getattr(model, "cumulative_thermal_time", 0.0)), 6),
            "node_count": int(getattr(model, "nodes", 0)),
            "leaf_count": int(getattr(model, "remaining_leaves", 0)),
            "leaf_area_by_rank": leaves_by_rank,
            "leaf_area_total_cm2": round(total_leaf_area_cm2, 3),
            "lai": round(lai, 6),
            "vegetative_dry_matter_g_m2": round(float(getattr(model, "vegetative_dw", 0.0)), 6),
            "fruit_dry_matter_g_m2": round(float(getattr(model, "fruit_dw", 0.0)), 6),
            "harvested_fruit_dry_matter_g_m2": round(float(last_state.get("harvested_fruit_dry_weight_g_m2", 0.0)), 6),
            "fruit_load": fruit_load,
            "crop_growth_efficiency": round(float(last_state.get("net_assimilation_umol_m2_s", 0.0)), 6),
            "source_capacity": round(source_capacity, 6),
            "sink_demand": sink_demand,
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
        "supported_work_events": ["leaf_removal"],
    }


def apply_cucumber_work_event(
    adapter: CucumberAdapter,
    event: dict[str, Any],
) -> dict[str, Any]:
    """Apply a canonical cucumber leaf-removal event to the adapter state."""
    event_type = event.get("event_type")
    if event_type != "leaf_removal":
        raise ValueError(f"Unsupported cucumber work event: {event_type}")

    model = adapter.model
    current_leaf_count = int(getattr(model, "remaining_leaves", 0))
    requested_target = event.get("target_leaf_count")
    requested_removed = int(event.get("leaves_removed_count") or 0)
    target_leaf_count = int(requested_target) if requested_target is not None else max(0, current_leaf_count - requested_removed)
    target_leaf_count = max(0, min(current_leaf_count, target_leaf_count))
    prior_lai = float(getattr(model, "LAI", 0.0))

    if target_leaf_count >= current_leaf_count:
        return {
            "event_type": event_type,
            "applied": False,
            "previous_leaf_count": current_leaf_count,
            "target_leaf_count": target_leaf_count,
            "removed_leaf_count": 0,
            "lai_before": round(prior_lai, 6),
            "lai_after": round(prior_lai, 6),
        }

    model.pruning_threshold = target_leaf_count
    model.target_leaf_count = target_leaf_count
    removed_veg_dw = float(model.perform_leaf_pruning())
    model.vegetative_dw = max(0.0, float(getattr(model, "vegetative_dw", 0.0)) - removed_veg_dw)
    model.LAI = float(model.calculate_current_lai())
    model.f_c = min(1.0, model.LAI / 3.0)
    adapter._leaf_prune_baseline = float(getattr(model, "remaining_leaves", target_leaf_count))
    if adapter._last_state is not None:
        adapter._last_state.update(
            {
                "leaf_count": int(getattr(model, "remaining_leaves", target_leaf_count)),
                "LAI": float(model.LAI),
                "vegetative_dry_weight_g_m2": float(model.vegetative_dw),
                "target_leaf_count": int(model.target_leaf_count),
                "pruning_threshold": int(model.pruning_threshold),
            }
        )

    return {
        "event_type": event_type,
        "applied": True,
        "previous_leaf_count": current_leaf_count,
        "target_leaf_count": int(getattr(model, "remaining_leaves", target_leaf_count)),
        "removed_leaf_count": current_leaf_count - int(getattr(model, "remaining_leaves", target_leaf_count)),
        "removed_vegetative_dry_weight_g_m2": round(removed_veg_dw, 6),
        "lai_before": round(prior_lai, 6),
        "lai_after": round(float(getattr(model, "LAI", prior_lai)), 6),
    }
