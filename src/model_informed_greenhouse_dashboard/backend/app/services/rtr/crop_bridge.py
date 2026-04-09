"""Crop-model bridge for post-control RTR evaluation."""

from __future__ import annotations

import copy
from typing import Any, Mapping

from .node_target_engine import predict_development_rate_day


def _safe_float(value: Any, default: float = 0.0) -> float:
    try:
        if value is None:
            return default
        return float(value)
    except (TypeError, ValueError):
        return default


def _respiration_to_umol(respiration_g_ch2o_s: float) -> float:
    return max(0.0, respiration_g_ch2o_s) / 30.03 * 1_000_000.0


def _normalize_leaf_area_by_rank(leaf_area_by_rank: list[Any] | None) -> list[float]:
    normalized: list[float] = []
    for entry in list(leaf_area_by_rank or []):
        if isinstance(entry, Mapping):
            normalized.append(
                round(
                    _safe_float(
                        entry.get("leaf_area_index", entry.get("area_m2_m2", entry.get("value"))),
                        0.0,
                    ),
                    6,
                )
            )
        else:
            normalized.append(round(_safe_float(entry, 0.0), 6))
    return normalized


def _layer_contribution_summary(
    *,
    total_net_assim_umol_m2_s: float,
    post_par_umol_m2_s: float,
    layer_activity: Mapping[str, float],
    leaf_area_by_rank: list[Any] | None = None,
) -> dict[str, Any]:
    leaf_area_by_rank = _normalize_leaf_area_by_rank(leaf_area_by_rank)
    total_leaf_area = max(sum(leaf_area_by_rank), 1e-6)
    weights = {
        "upper": max(0.0, float(layer_activity.get("upper", 0.0))) * 1.15,
        "middle": max(0.0, float(layer_activity.get("middle", 0.0))) * 1.0,
        "bottom": max(0.0, float(layer_activity.get("bottom", 0.0))) * 0.85,
    }
    weight_sum = max(sum(weights.values()), 1e-6)
    layer_net_assim = {
        key: round(total_net_assim_umol_m2_s * (value / weight_sum), 6)
        for key, value in weights.items()
    }
    layer_absorbed_radiation = {
        key: round(post_par_umol_m2_s * (value / weight_sum), 6)
        for key, value in weights.items()
    }
    return {
        "layer_activity": {
            key: round(value, 6)
            for key, value in layer_activity.items()
        },
        "layer_net_assim_umol_m2_s": layer_net_assim,
        "layer_absorbed_radiation_umol_m2_s": layer_absorbed_radiation,
        "leaf_area_by_rank": [round(area, 6) for area in leaf_area_by_rank],
        "leaf_area_total_m2_m2": round(total_leaf_area, 6),
    }


def evaluate_post_control_crop_state(
    *,
    context,
    phase: str,
    post_control_state: Mapping[str, Any],
) -> dict[str, Any]:
    model = copy.deepcopy(context.adapter.model)
    env = post_control_state["env"]
    crop = context.canonical_state["crop"]

    model.T_a = float(env["T_air_C"]) + 273.15
    model.T_c = float(env["T_leaf_C"]) + 273.15
    model.u_CO2 = float(env["CO2_ppm"])
    model.Ci = float(env["CO2_ppm"]) * 0.7
    model.RH = max(0.0, min(1.0, float(env["RH_pct"]) / 100.0))
    if hasattr(model, "u_PAR"):
        model.u_PAR = float(env["PAR_umol_m2_s"])

    gross_assim, _, stomatal_conductance = model.calculate_canopy_photosynthesis(model.T_c)
    respiration_g_s = model.calculate_instantaneous_respiration(model.T_c)
    respiration_umol = _respiration_to_umol(respiration_g_s)
    net_assim = max(0.0, gross_assim - respiration_umol)

    raw_adapter_state = context.adapter.dump_state()
    predicted_node_rate_day = predict_development_rate_day(
        crop=crop,
        raw_adapter_state=raw_adapter_state,
        mean_air_temp_c=float(env["T_air_C"]),
    )

    growth = context.canonical_state["growth"]
    source_scale = net_assim / max(float(context.canonical_state["flux"]["net_assim_umol_m2_s"]), 1e-6)
    source_capacity = max(0.0, float(growth["source_capacity"]) * source_scale)
    sink_demand = max(0.0, float(growth["sink_demand"]))
    fruit_load = max(0.0, float(growth["fruit_load"]))
    carbon_margin = source_capacity - sink_demand

    crop_specific_summary: dict[str, Any]
    if crop == "cucumber":
        cucumber = context.canonical_state["crop_specific"]["cucumber"]
        crop_specific_summary = {
            "cucumber": _layer_contribution_summary(
                total_net_assim_umol_m2_s=float(net_assim),
                post_par_umol_m2_s=float(env["PAR_umol_m2_s"]),
                layer_activity={
                    "upper": _safe_float(cucumber.get("upper_leaf_activity"), 0.0),
                    "middle": _safe_float(cucumber.get("middle_leaf_activity"), 0.0),
                    "bottom": _safe_float(cucumber.get("bottom_leaf_activity"), 0.0),
                },
                leaf_area_by_rank=list(cucumber.get("leaf_area_by_rank") or []),
            )
        }
    else:
        tomato = context.canonical_state["crop_specific"]["tomato"]
        crop_specific_summary = {
            "tomato": {
                "active_trusses": int(tomato.get("active_trusses", 0)),
                "fruit_partition_ratio": round(_safe_float(tomato.get("fruit_partition_ratio"), 0.0), 6),
                "truss_cohorts": copy.deepcopy(tomato.get("truss_cohorts") or []),
            }
        }

    return {
        "phase": phase,
        "env": copy.deepcopy(dict(env)),
        "gross_assim_umol_m2_s": round(float(gross_assim), 6),
        "net_assim_umol_m2_s": round(float(net_assim), 6),
        "respiration_umol_m2_s": round(float(respiration_umol), 6),
        "stomatal_conductance_m_s": round(float(max(0.0, stomatal_conductance)), 6),
        "predicted_node_rate_day": round(float(predicted_node_rate_day), 6),
        "source_capacity": round(float(source_capacity), 6),
        "sink_demand": round(float(sink_demand), 6),
        "fruit_load": round(float(fruit_load), 6),
        "carbon_margin": round(float(carbon_margin), 6),
        "crop_specific": crop_specific_summary,
    }
