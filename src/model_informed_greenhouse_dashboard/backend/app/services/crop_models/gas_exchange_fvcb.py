"""Reusable leaf-scale FvCB helpers for SmartGrow physiology services."""

from __future__ import annotations

from dataclasses import dataclass
import math
from typing import Mapping


@dataclass(frozen=True)
class FvCBResult:
    """Leaf-scale FvCB outputs."""

    a_n: float
    a_c: float
    a_j: float
    r_d: float
    limiting_factor: str
    v_cmax: float
    j_max: float
    electron_transport_rate: float
    guardrail_state: str | None = None


def _finite_or(default: float, value: float) -> float:
    if math.isfinite(value):
        return value
    return default


def solve_cucumber_leaf_fvcb(
    *,
    leaf_temperature_k: float,
    ppfd_umol_m2_s: float,
    c_i_ppm: float,
    rank_params: Mapping[str, float],
    fvcb_params: Mapping[str, float],
) -> FvCBResult:
    """Replicate the bounded cucumber rank-specific FvCB calculation."""
    if leaf_temperature_k <= 0 or ppfd_umol_m2_s < 0 or c_i_ppm <= 0:
        return FvCBResult(
            a_n=0.0,
            a_c=0.0,
            a_j=0.0,
            r_d=0.0,
            limiting_factor="guardrail",
            v_cmax=0.0,
            j_max=0.0,
            electron_transport_rate=0.0,
            guardrail_state="invalid_input",
        )

    gas_constant = float(fvcb_params["R"])
    temperature_c = leaf_temperature_k - 273.15
    ambient_o2 = float(fvcb_params["O"])
    alpha = float(fvcb_params["a"])
    theta = float(rank_params["theta"])

    gamma_star = 42.75 * math.exp(
        37830 * (leaf_temperature_k - 298.0) / (298.0 * gas_constant * leaf_temperature_k)
    )
    k_c = 404.9 * math.exp(
        79430 * (leaf_temperature_k - 298.0) / (298.0 * gas_constant * leaf_temperature_k)
    )
    k_o = 278.4 * math.exp(
        36380 * (leaf_temperature_k - 298.0) / (298.0 * gas_constant * leaf_temperature_k)
    )
    r_d = float(rank_params["Rd_25"]) * 2.0 ** ((temperature_c - 25.0) / 10.0)

    par_dependency = (31.0 + (69.0 / (1.0 + math.exp(-0.005 * (ppfd_umol_m2_s - 350.0))))) / 100.0
    vc_temp_factor = math.exp(
        float(fvcb_params["V_Ha"]) * (temperature_c - 25.0)
        / ((25.0 + 237.15) * gas_constant * leaf_temperature_k)
    )
    vc_deactivation_num = 1.0 + math.exp(
        (float(fvcb_params["V_S"]) - float(fvcb_params["V_Hd"]))
        / (298.15 * gas_constant)
    )
    vc_deactivation_den = 1.0 + math.exp(
        (float(fvcb_params["V_S"]) - float(fvcb_params["V_Hd"]))
        / (leaf_temperature_k * gas_constant)
    )
    v_cmax = float(rank_params["Vcmax_25"]) * par_dependency * vc_temp_factor * (
        vc_deactivation_num / max(1e-9, vc_deactivation_den)
    )

    j_temp_factor = math.exp(
        float(fvcb_params["J_Ha"]) * (temperature_c - 25.0)
        / ((25.0 + 237.15) * gas_constant * leaf_temperature_k)
    )
    j_deactivation_num = 1.0 + math.exp(
        (float(fvcb_params["J_S"]) - float(fvcb_params["J_Hd"]))
        / (298.15 * gas_constant)
    )
    j_deactivation_den = 1.0 + math.exp(
        (float(fvcb_params["J_S"]) - float(fvcb_params["J_Hd"]))
        / (leaf_temperature_k * gas_constant)
    )
    j_max = float(rank_params["Jmax_25"]) * j_temp_factor * (
        j_deactivation_num / max(1e-9, j_deactivation_den)
    )

    j_term = (alpha * ppfd_umol_m2_s + j_max) ** 2 - 4.0 * theta * alpha * ppfd_umol_m2_s * j_max
    electron_transport_rate = (
        alpha * ppfd_umol_m2_s + j_max - math.sqrt(max(0.0, j_term))
    ) / max(1e-9, 2.0 * theta)

    a_c = (
        v_cmax * (c_i_ppm - gamma_star) / max(1e-9, c_i_ppm + k_c * (1.0 + ambient_o2 / max(1e-9, k_o)))
    ) - r_d
    a_j = (
        electron_transport_rate * (c_i_ppm - gamma_star) / max(1e-9, 4.0 * c_i_ppm + 8.0 * gamma_star)
    ) - r_d
    limiting_factor = "rubisco" if a_c <= a_j else "electron_transport"
    a_n = max(0.0, min(a_c, a_j))

    return FvCBResult(
        a_n=_finite_or(0.0, a_n),
        a_c=_finite_or(0.0, a_c),
        a_j=_finite_or(0.0, a_j),
        r_d=_finite_or(0.0, r_d),
        limiting_factor=limiting_factor,
        v_cmax=_finite_or(0.0, v_cmax),
        j_max=_finite_or(0.0, j_max),
        electron_transport_rate=_finite_or(0.0, electron_transport_rate),
    )


def solve_tomato_leaf_fvcb(
    *,
    leaf_temperature_k: float,
    ppfd_umol_m2_s: float,
    c_i_ppm: float,
    joubert_params: Mapping[str, float],
) -> FvCBResult:
    """Replicate the bounded tomato Joubert-style FvCB calculation."""
    if leaf_temperature_k <= 0 or ppfd_umol_m2_s < 0 or c_i_ppm <= 0:
        return FvCBResult(
            a_n=0.0,
            a_c=0.0,
            a_j=0.0,
            r_d=0.0,
            limiting_factor="guardrail",
            v_cmax=0.0,
            j_max=0.0,
            electron_transport_rate=0.0,
            guardrail_state="invalid_input",
        )

    v_cmax = float(joubert_params["Vcmax"])
    j_max = float(joubert_params["Jmax"])
    r_d = float(joubert_params["Rd"])
    theta_j = float(joubert_params["theta_J"])
    gamma_j = float(joubert_params["gamma_J"])
    gamma_star = math.exp(
        float(joubert_params["c1"])
        - (
            float(joubert_params["dHa1_kJ"])
            / (float(joubert_params["R1_kJ"]) * leaf_temperature_k)
        )
    )
    k_o = math.exp(
        float(joubert_params["c2"])
        - (
            float(joubert_params["dHa2_kJ"])
            / (float(joubert_params["R1_kJ"]) * leaf_temperature_k)
        )
    )
    k_c = math.exp(
        float(joubert_params["c3"])
        - (
            float(joubert_params["dHa3_kJ"])
            / (float(joubert_params["R1_kJ"]) * leaf_temperature_k)
        )
    )
    oxygen_kpa = float(joubert_params["O_i_kPa"])

    j_arg = j_max + theta_j * ppfd_umol_m2_s
    disc = j_arg * j_arg - 4.0 * j_max * gamma_j * theta_j * ppfd_umol_m2_s
    electron_transport_rate = (j_arg - math.sqrt(max(0.0, disc))) / max(1e-9, 2.0 * gamma_j)

    w_c = v_cmax * (
        c_i_ppm / max(1e-9, c_i_ppm + k_c * (1.0 + oxygen_kpa / max(1e-9, k_o)))
    )
    w_j = electron_transport_rate / max(1e-9, 4.0 + 8.0 * (gamma_star / max(1e-9, c_i_ppm)))

    a_c = max(0.0, w_c * (1.0 - (gamma_star / max(1e-9, c_i_ppm))) - r_d)
    a_j = max(0.0, w_j * (1.0 - (gamma_star / max(1e-9, c_i_ppm))) - r_d)
    limiting_factor = "rubisco" if a_c <= a_j else "electron_transport"
    a_n = min(a_c, a_j)

    return FvCBResult(
        a_n=_finite_or(0.0, a_n),
        a_c=_finite_or(0.0, a_c),
        a_j=_finite_or(0.0, a_j),
        r_d=_finite_or(0.0, r_d),
        limiting_factor=limiting_factor,
        v_cmax=_finite_or(0.0, v_cmax),
        j_max=_finite_or(0.0, j_max),
        electron_transport_rate=_finite_or(0.0, electron_transport_rate),
    )
