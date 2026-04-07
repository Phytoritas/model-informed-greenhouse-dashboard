from __future__ import annotations

import math

from model_informed_greenhouse_dashboard.backend.app.adapters.cucumber import (
    CucumberAdapter,
)
from model_informed_greenhouse_dashboard.backend.app.adapters.tomato import TomatoAdapter
from model_informed_greenhouse_dashboard.backend.app.services.crop_models.canopy_integration import (
    build_three_class_layers,
    integrate_canopy_layers,
)
from model_informed_greenhouse_dashboard.backend.app.services.crop_models.cucumber_growth_model import (
    build_cucumber_snapshot,
)
from model_informed_greenhouse_dashboard.backend.app.services.crop_models.gas_exchange_fvcb import (
    FvCBResult,
    solve_cucumber_leaf_fvcb,
    solve_tomato_leaf_fvcb,
)
from model_informed_greenhouse_dashboard.backend.app.services.crop_models.stomatal_ball_berry import (
    BallBerryParameters,
    CoupledGasExchangeResult,
    solve_coupled_leaf_exchange,
)
from model_informed_greenhouse_dashboard.backend.app.services.crop_models.tomato_growth_model import (
    build_tomato_snapshot,
)


def _seed_cucumber_adapter() -> CucumberAdapter:
    adapter = CucumberAdapter()
    model = adapter.model
    model.nodes = 18
    model.remaining_leaves = 18
    model.cumulative_thermal_time = 640.0
    model.vegetative_dw = 82.0
    model.fruit_dw = 24.0
    model.reproductive_node_threshold = 15
    model.u_PAR = 950.0
    model.u_CO2 = 720.0
    model.RH = 0.68
    model.Ci = model.u_CO2 * 0.7
    model.leaves_info = [
        {
            "Leaf Number": rank,
            "Date": model.start_date.date(),
            "Thermal Time": float((rank - 1) * 18),
        }
        for rank in range(1, 19)
    ]
    model.LAI = float(model.calculate_current_lai())
    return adapter


def _seed_tomato_adapter() -> TomatoAdapter:
    adapter = TomatoAdapter()
    model = adapter.model
    model.u_PAR = 1100.0
    model.u_CO2 = 760.0
    model.RH = 0.72
    model.Ci = model.u_CO2 * 0.7
    model.truss_count = 3
    model.n_f = 4
    model.truss_cohorts = [
        {"tdvs": 0.55, "n_fruits": 4, "w_fr_cohort": 14.0, "active": True, "mult": 1.0},
        {"tdvs": 0.43, "n_fruits": 4, "w_fr_cohort": 11.0, "active": True, "mult": 1.0},
        {"tdvs": 0.21, "n_fruits": 4, "w_fr_cohort": 6.0, "active": True, "mult": 1.0},
    ]
    model.W_lv = 78.0
    model.W_st = 36.0
    model.W_rt = 18.0
    model.W_fr = sum(cohort["w_fr_cohort"] for cohort in model.truss_cohorts)
    model.W_fr_harvested = 9.0
    model.LAI = 2.35
    return adapter


def test_cucumber_snapshot_exposes_layer_activity() -> None:
    snapshot = build_cucumber_snapshot(_seed_cucumber_adapter(), greenhouse_id="cucumber")

    assert snapshot["gas_exchange"]["layer_classes"]
    assert snapshot["state"]["upper_leaf_activity"] >= 0
    assert snapshot["state"]["middle_leaf_activity"] >= 0
    assert snapshot["state"]["bottom_leaf_activity"] >= 0
    assert snapshot["gas_exchange"]["limiting_factor"] in {"rubisco", "electron_transport", None}


def test_tomato_snapshot_exposes_layer_activity() -> None:
    snapshot = build_tomato_snapshot(_seed_tomato_adapter(), greenhouse_id="tomato")

    assert [entry["leaf_class"] for entry in snapshot["gas_exchange"]["layer_classes"]] == [
        "upper",
        "middle",
        "bottom",
    ]
    assert snapshot["state"]["upper_leaf_activity"] >= 0
    assert snapshot["gas_exchange"]["canopy_gross_assimilation_umol_m2_s"] >= 0


def test_coupled_leaf_exchange_guardrails_invalid_ambient_co2() -> None:
    result = solve_coupled_leaf_exchange(
        ambient_co2_ppm=0.0,
        rh_fraction=0.3,
        assimilation_solver=lambda _: solve_tomato_leaf_fvcb(
            leaf_temperature_k=303.15,
            ppfd_umol_m2_s=200.0,
            c_i_ppm=200.0,
            joubert_params=TomatoAdapter().model.joubert_params,
        ),
        ball_berry=BallBerryParameters(g0=0.019, g1=26.85),
    )

    assert result.converged is False
    assert result.guardrail_state == "invalid_ambient_co2"
    assert result.g_sw >= 0


def test_tomato_leaf_solver_remains_finite_in_hot_low_light_case() -> None:
    adapter = TomatoAdapter()

    result = solve_coupled_leaf_exchange(
        ambient_co2_ppm=330.0,
        rh_fraction=0.2,
        assimilation_solver=lambda c_i: solve_tomato_leaf_fvcb(
            leaf_temperature_k=315.15,
            ppfd_umol_m2_s=15.0,
            c_i_ppm=c_i,
            joubert_params=adapter.model.joubert_params,
        ),
        ball_berry=BallBerryParameters(g0=0.019, g1=26.85),
        leaf_temperature_k=315.15,
    )

    assert math.isfinite(result.a_n)
    assert math.isfinite(result.g_sw)
    assert result.g_sw >= 0
    assert math.isfinite(result.c_i)


def test_coupled_leaf_exchange_marks_max_iter_guardrail() -> None:
    result = solve_coupled_leaf_exchange(
        ambient_co2_ppm=400.0,
        rh_fraction=0.7,
        assimilation_solver=lambda _: FvCBResult(
            a_n=12.0,
            a_c=12.0,
            a_j=14.0,
            r_d=1.0,
            limiting_factor="rubisco",
            v_cmax=85.0,
            j_max=145.0,
            electron_transport_rate=90.0,
        ),
        ball_berry=BallBerryParameters(
            g0=0.01,
            g1=1.0,
            tolerance=1e-12,
            max_iter=1,
            relaxation=1.0,
        ),
        ci_initial=50.0,
    )

    assert result.converged is False
    assert result.guardrail_state == "max_iter_reached"
    assert result.g_sw > 0


def test_canopy_integration_bounds_relative_activity() -> None:
    layers = build_three_class_layers(2.4)

    def _leaf_solver(layer, ppfd_umol_m2_s):
        activity = {
            "upper": 16.0,
            "middle": 9.0,
            "bottom": 4.0,
        }[layer.leaf_class]
        return CoupledGasExchangeResult(
            a_n=activity,
            a_c=activity,
            a_j=activity + 2.0,
            r_d=1.0,
            g_sw=0.18,
            g_sc=0.1125,
            c_i=280.0,
            transpiration_proxy=max(0.0, ppfd_umol_m2_s / 10000.0),
            limiting_factor="light" if layer.leaf_class == "bottom" else "rubisco",
            iterations=3,
            converged=True,
            guardrail_state=None,
        )

    result = integrate_canopy_layers(
        top_ppfd_umol_m2_s=900.0,
        extinction_coefficient=0.75,
        layers=layers,
        leaf_solver_factory=_leaf_solver,
        respiration_umol_m2_s=0.0,
    )

    assert [entry["leaf_class"] for entry in result.layer_classes] == ["upper", "middle", "bottom"]
    assert all(0.0 <= float(entry["relative_activity"]) <= 1.0 for entry in result.layer_classes)
    assert float(result.layer_classes[0]["relative_activity"]) == 1.0
    assert result.limiting_layer == "bottom"
    assert result.limiting_factor == "light"


def test_cucumber_coupled_leaf_exchange_matches_legacy_units() -> None:
    adapter = _seed_cucumber_adapter()
    model = adapter.model
    leaf_temperature_k = float(getattr(model, "T_c", 298.15))
    ppfd_umol_m2_s = 420.0
    rank_params = dict(model.rank_params["rank_5"])

    legacy_a_n, _, legacy_g_sw = model.calculate_leaf_fvcb(
        leaf_temperature_k,
        ppfd_umol_m2_s,
        rank_params,
        model.Ci,
    )
    helper = solve_coupled_leaf_exchange(
        ambient_co2_ppm=float(model.u_CO2),
        rh_fraction=float(model.RH),
        assimilation_solver=lambda c_i: solve_cucumber_leaf_fvcb(
            leaf_temperature_k=leaf_temperature_k,
            ppfd_umol_m2_s=ppfd_umol_m2_s,
            c_i_ppm=c_i,
            rank_params=rank_params,
            fvcb_params=model.fcvb_params,
        ),
        ball_berry=BallBerryParameters(g0=0.045, g1=8.376),
        leaf_temperature_k=leaf_temperature_k,
        ci_initial=float(model.Ci),
    )

    assert math.isclose(helper.a_n, legacy_a_n, rel_tol=1e-4)
    assert math.isclose(helper.g_sw, legacy_g_sw, rel_tol=1e-4)


def test_tomato_coupled_leaf_exchange_matches_legacy_units() -> None:
    adapter = _seed_tomato_adapter()
    model = adapter.model
    leaf_temperature_k = float(getattr(model, "T_c", 298.15))
    ppfd_umol_m2_s = 480.0

    legacy_a_n, _, legacy_g_sw = model.calculate_leaf_fvcb(
        leaf_temperature_k,
        ppfd_umol_m2_s,
        model.Ci,
    )
    helper = solve_coupled_leaf_exchange(
        ambient_co2_ppm=float(model.u_CO2),
        rh_fraction=float(model.RH),
        assimilation_solver=lambda c_i: solve_tomato_leaf_fvcb(
            leaf_temperature_k=leaf_temperature_k,
            ppfd_umol_m2_s=ppfd_umol_m2_s,
            c_i_ppm=c_i,
            joubert_params=model.joubert_params,
        ),
        ball_berry=BallBerryParameters(g0=0.019, g1=26.85),
        leaf_temperature_k=leaf_temperature_k,
        ci_initial=float(model.Ci),
    )

    assert math.isclose(helper.a_n, legacy_a_n, rel_tol=1e-4)
    assert math.isclose(helper.g_sw, legacy_g_sw, rel_tol=1e-4)
