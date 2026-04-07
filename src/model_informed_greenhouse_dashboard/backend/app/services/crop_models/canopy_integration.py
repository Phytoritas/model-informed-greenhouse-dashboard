"""Reusable canopy integration helpers for SmartGrow physiology services."""

from __future__ import annotations

from collections import defaultdict
from collections.abc import Callable
from dataclasses import dataclass
import math

from .stomatal_ball_berry import CoupledGasExchangeResult


@dataclass(frozen=True)
class CanopyLayerDefinition:
    """A single canopy layer to integrate."""

    label: str
    leaf_class: str
    leaf_area_index: float


@dataclass(frozen=True)
class CanopyLayerResult:
    """Integrated layer output."""

    label: str
    leaf_class: str
    leaf_area_index: float
    cumulative_lai_above: float
    ppfd_umol_m2_s: float
    net_assimilation_umol_m2_s: float
    gross_assimilation_umol_m2_s: float
    stomatal_conductance_m_s: float
    intercellular_co2_ppm: float
    transpiration_proxy: float
    limiting_factor: str
    converged: bool
    guardrail_state: str | None


@dataclass(frozen=True)
class CanopyIntegrationResult:
    """Canopy-scale integration summary."""

    canopy_gross_assimilation_umol_m2_s: float
    canopy_net_assimilation_umol_m2_s: float
    canopy_stomatal_conductance_m_s: float
    canopy_transpiration_proxy: float
    respiration_umol_m2_s: float
    layers: list[CanopyLayerResult]
    layer_classes: list[dict[str, float | str]]
    limiting_layer: str | None
    limiting_factor: str | None


def build_three_class_layers(total_lai: float) -> list[CanopyLayerDefinition]:
    """Split canopy LAI into upper/middle/bottom classes."""
    if total_lai <= 1e-9:
        return []
    lai_per_layer = total_lai / 3.0
    return [
        CanopyLayerDefinition(label="upper", leaf_class="upper", leaf_area_index=lai_per_layer),
        CanopyLayerDefinition(label="middle", leaf_class="middle", leaf_area_index=lai_per_layer),
        CanopyLayerDefinition(label="bottom", leaf_class="bottom", leaf_area_index=lai_per_layer),
    ]


def integrate_canopy_layers(
    *,
    top_ppfd_umol_m2_s: float,
    extinction_coefficient: float,
    layers: list[CanopyLayerDefinition],
    leaf_solver_factory: Callable[[CanopyLayerDefinition, float], CoupledGasExchangeResult],
    respiration_umol_m2_s: float = 0.0,
) -> CanopyIntegrationResult:
    """Integrate layer-wise gas exchange using Beer-Lambert light attenuation."""
    results: list[CanopyLayerResult] = []
    lai_above = 0.0
    canopy_gross = 0.0
    canopy_net = 0.0
    canopy_gsw = 0.0
    canopy_transpiration = 0.0

    for layer in layers:
        if layer.leaf_area_index <= 1e-9:
            continue
        ppfd_at_layer = top_ppfd_umol_m2_s * math.exp(
            -extinction_coefficient * (lai_above + 0.5 * layer.leaf_area_index)
        )
        leaf_state = leaf_solver_factory(layer, ppfd_at_layer)
        layer_net = leaf_state.a_n * layer.leaf_area_index
        layer_gross = (leaf_state.a_n + leaf_state.r_d) * layer.leaf_area_index
        layer_gsw = leaf_state.g_sw * layer.leaf_area_index
        layer_transpiration = leaf_state.transpiration_proxy * layer.leaf_area_index

        canopy_gross += layer_gross
        canopy_net += layer_net
        canopy_gsw += layer_gsw
        canopy_transpiration += layer_transpiration
        results.append(
            CanopyLayerResult(
                label=layer.label,
                leaf_class=layer.leaf_class,
                leaf_area_index=layer.leaf_area_index,
                cumulative_lai_above=lai_above,
                ppfd_umol_m2_s=ppfd_at_layer,
                net_assimilation_umol_m2_s=layer_net,
                gross_assimilation_umol_m2_s=layer_gross,
                stomatal_conductance_m_s=layer_gsw,
                intercellular_co2_ppm=leaf_state.c_i,
                transpiration_proxy=layer_transpiration,
                limiting_factor=leaf_state.limiting_factor,
                converged=leaf_state.converged,
                guardrail_state=leaf_state.guardrail_state,
            )
        )
        lai_above += layer.leaf_area_index

    canopy_net_after_respiration = max(0.0, canopy_net - respiration_umol_m2_s)
    layer_classes = summarize_layer_classes(results)
    limiting_layer = None
    limiting_factor = None
    if layer_classes:
        bottleneck = min(layer_classes, key=lambda item: float(item["net_assimilation_umol_m2_s"]))
        limiting_layer = str(bottleneck["leaf_class"])
        limiting_factor = str(bottleneck["limiting_factor"])

    return CanopyIntegrationResult(
        canopy_gross_assimilation_umol_m2_s=canopy_gross,
        canopy_net_assimilation_umol_m2_s=canopy_net_after_respiration,
        canopy_stomatal_conductance_m_s=canopy_gsw,
        canopy_transpiration_proxy=canopy_transpiration,
        respiration_umol_m2_s=respiration_umol_m2_s,
        layers=results,
        layer_classes=layer_classes,
        limiting_layer=limiting_layer,
        limiting_factor=limiting_factor,
    )


def summarize_layer_classes(layers: list[CanopyLayerResult]) -> list[dict[str, float | str]]:
    """Aggregate rank or equal-fraction layers into upper/middle/bottom summaries."""
    grouped: dict[str, list[CanopyLayerResult]] = defaultdict(list)
    for layer in layers:
        grouped[layer.leaf_class].append(layer)

    if not grouped:
        return []

    total_net_by_class = {
        leaf_class: sum(layer.net_assimilation_umol_m2_s for layer in group_layers)
        for leaf_class, group_layers in grouped.items()
    }
    max_net = max(total_net_by_class.values(), default=0.0)
    summaries: list[dict[str, float | str]] = []
    for leaf_class in ("upper", "middle", "bottom"):
        group_layers = grouped.get(leaf_class, [])
        if not group_layers:
            continue
        total_net = sum(layer.net_assimilation_umol_m2_s for layer in group_layers)
        total_gsw = sum(layer.stomatal_conductance_m_s for layer in group_layers)
        total_transp = sum(layer.transpiration_proxy for layer in group_layers)
        mean_ppfd = sum(layer.ppfd_umol_m2_s for layer in group_layers) / len(group_layers)
        limiting_counts = defaultdict(int)
        for layer in group_layers:
            limiting_counts[layer.limiting_factor] += 1
        dominant_limiting_factor = max(
            limiting_counts.items(),
            key=lambda item: item[1],
        )[0]
        summaries.append(
            {
                "leaf_class": leaf_class,
                "net_assimilation_umol_m2_s": round(total_net, 6),
                "stomatal_conductance_m_s": round(total_gsw, 6),
                "transpiration_proxy": round(total_transp, 6),
                "mean_ppfd_umol_m2_s": round(mean_ppfd, 6),
                "relative_activity": round(0.0 if max_net <= 1e-9 else total_net / max_net, 6),
                "limiting_factor": dominant_limiting_factor,
            }
        )
    return summaries
