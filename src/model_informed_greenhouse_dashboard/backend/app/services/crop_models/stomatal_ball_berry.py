"""Reusable Ball-Berry coupling helpers for SmartGrow physiology services."""

from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass
import math

from .gas_exchange_fvcb import FvCBResult


IDEAL_GAS_CONSTANT = 8.314462618
STANDARD_AIR_PRESSURE_PA = 101325.0


@dataclass(frozen=True)
class BallBerryParameters:
    """Ball-Berry parameterization and iteration settings."""

    g0: float
    g1: float
    gsw_to_gsc_ratio: float = 1.6
    min_conductance: float = 1e-9
    tolerance: float = 1e-3
    max_iter: int = 60
    relaxation: float = 0.5


@dataclass(frozen=True)
class CoupledGasExchangeResult:
    """Coupled FvCB + Ball-Berry leaf outputs."""

    a_n: float
    a_c: float
    a_j: float
    r_d: float
    g_sw: float
    g_sc: float
    c_i: float
    transpiration_proxy: float
    limiting_factor: str
    iterations: int
    converged: bool
    guardrail_state: str | None = None


def solve_coupled_leaf_exchange(
    *,
    ambient_co2_ppm: float,
    rh_fraction: float,
    assimilation_solver: Callable[[float], FvCBResult],
    ball_berry: BallBerryParameters,
    leaf_temperature_k: float = 298.15,
    ci_initial: float | None = None,
) -> CoupledGasExchangeResult:
    """Solve the nested FvCB + Ball-Berry coupling with bounded guardrails."""
    leaf_temperature_k = leaf_temperature_k if leaf_temperature_k > 0 else 298.15
    conductance_scale = (IDEAL_GAS_CONSTANT * leaf_temperature_k) / STANDARD_AIR_PRESSURE_PA
    if ambient_co2_ppm <= 0 or not math.isfinite(ambient_co2_ppm):
        return CoupledGasExchangeResult(
            a_n=0.0,
            a_c=0.0,
            a_j=0.0,
            r_d=0.0,
            g_sw=ball_berry.g0 * conductance_scale,
            g_sc=(ball_berry.g0 / ball_berry.gsw_to_gsc_ratio) * conductance_scale,
            c_i=0.0,
            transpiration_proxy=0.0,
            limiting_factor="guardrail",
            iterations=0,
            converged=False,
            guardrail_state="invalid_ambient_co2",
        )

    rh_eff = min(1.0, max(0.05, rh_fraction))
    c_i = max(1e-6, min(ambient_co2_ppm, ci_initial if ci_initial is not None else ambient_co2_ppm * 0.7))
    last_state: FvCBResult | None = None
    last_gsw_mol = max(ball_berry.g0, ball_berry.min_conductance)
    last_gsc_mol = last_gsw_mol / ball_berry.gsw_to_gsc_ratio

    for iteration in range(1, ball_berry.max_iter + 1):
        state = assimilation_solver(c_i)
        last_state = state
        a_n = max(0.0, state.a_n)
        g_sw_mol = max(
            ball_berry.min_conductance,
            ball_berry.g0 + ((a_n * ball_berry.g1 * rh_eff) / max(1e-9, ambient_co2_ppm)),
        )
        g_sc_mol = g_sw_mol / ball_berry.gsw_to_gsc_ratio
        c_i_candidate = ambient_co2_ppm - (a_n / max(g_sc_mol, ball_berry.min_conductance))
        c_i_candidate = max(1e-6, min(ambient_co2_ppm, c_i_candidate))
        c_i_next = (ball_berry.relaxation * c_i_candidate) + ((1.0 - ball_berry.relaxation) * c_i)
        last_gsw_mol = g_sw_mol
        last_gsc_mol = g_sc_mol

        if not math.isfinite(c_i_next):
            break
        if abs(c_i_next - c_i) < ball_berry.tolerance:
            return CoupledGasExchangeResult(
                a_n=a_n,
                a_c=state.a_c,
                a_j=state.a_j,
                r_d=state.r_d,
                g_sw=g_sw_mol * conductance_scale,
                g_sc=g_sc_mol * conductance_scale,
                c_i=c_i_next,
                transpiration_proxy=max(0.0, (g_sw_mol * conductance_scale) * (1.0 - rh_eff)),
                limiting_factor=state.limiting_factor,
                iterations=iteration,
                converged=True,
                guardrail_state=state.guardrail_state,
            )
        c_i = c_i_next

    if last_state is None:
        last_state = assimilation_solver(c_i)

    return CoupledGasExchangeResult(
        a_n=max(0.0, last_state.a_n),
        a_c=last_state.a_c,
        a_j=last_state.a_j,
        r_d=last_state.r_d,
        g_sw=last_gsw_mol * conductance_scale,
        g_sc=last_gsc_mol * conductance_scale,
        c_i=c_i,
        transpiration_proxy=max(0.0, (last_gsw_mol * conductance_scale) * (1.0 - rh_eff)),
        limiting_factor=last_state.limiting_factor,
        iterations=ball_berry.max_iter,
        converged=False,
        guardrail_state=last_state.guardrail_state or "max_iter_reached",
    )
