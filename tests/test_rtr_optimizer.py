from __future__ import annotations

import importlib
import sys
import types
from types import SimpleNamespace

import pandas as pd
from fastapi.testclient import TestClient

from model_informed_greenhouse_dashboard import get_app


def _backend_main():
    from model_informed_greenhouse_dashboard.backend.app import main as backend_main

    return backend_main


def _stub_adapter_modules() -> None:
    cucumber_module = (
        "model_informed_greenhouse_dashboard.backend.app.adapters.cucumber"
    )
    tomato_module = "model_informed_greenhouse_dashboard.backend.app.adapters.tomato"

    if cucumber_module not in sys.modules:
        stub = types.ModuleType(cucumber_module)

        class _StubCucumberAdapter:
            def __init__(self, *args, **kwargs):
                self._state = {}

            def load_state(self, state):
                self._state = dict(state)

            def dump_state(self):
                return dict(self._state)

        stub.CucumberAdapter = _StubCucumberAdapter
        sys.modules[cucumber_module] = stub

    if tomato_module not in sys.modules:
        stub = types.ModuleType(tomato_module)

        class _StubTomatoAdapter:
            def __init__(self, *args, **kwargs):
                self._state = {}

            def load_state(self, state):
                self._state = dict(state)

            def dump_state(self):
                return dict(self._state)

        stub.TomatoAdapter = _StubTomatoAdapter
        sys.modules[tomato_module] = stub


def _load_light_rtr_services():
    _stub_adapter_modules()
    return SimpleNamespace(
        controller_contract=importlib.import_module(
            "model_informed_greenhouse_dashboard.backend.app.services.rtr.controller_contract"
        ),
        unit_projection=importlib.import_module(
            "model_informed_greenhouse_dashboard.backend.app.services.rtr.unit_projection"
        ),
        rtr_deriver=importlib.import_module(
            "model_informed_greenhouse_dashboard.backend.app.services.rtr.rtr_deriver"
        ),
    )


def _load_optimizer_rtr_services():
    _stub_adapter_modules()
    scipy_package = sys.modules.get("scipy")
    if scipy_package is None:
        scipy_package = types.ModuleType("scipy")
        sys.modules["scipy"] = scipy_package

    fake_optimize = types.ModuleType("scipy.optimize")

    def _fake_minimize(fun, x0, bounds, method=None):
        midpoint = [float((low + high) / 2.0) for low, high in bounds]
        low_vector = [float(low) for low, _ in bounds]
        high_vector = [float(high) for _, high in bounds]
        candidates = [
            [float(value) for value in x0],
            midpoint,
            low_vector,
            high_vector,
        ]
        best_vector = candidates[0]
        best_value = float(fun(best_vector))
        for candidate in candidates[1:]:
            candidate_value = float(fun(candidate))
            if candidate_value < best_value:
                best_value = candidate_value
                best_vector = candidate
        return SimpleNamespace(
            x=SimpleNamespace(tolist=lambda: list(best_vector)),
            success=True,
            message="stub-minimize",
        )

    fake_optimize.minimize = _fake_minimize
    scipy_package.optimize = fake_optimize
    sys.modules["scipy.optimize"] = fake_optimize

    lagrangian_module_name = (
        "model_informed_greenhouse_dashboard.backend.app.services.rtr.lagrangian_optimizer"
    )
    if lagrangian_module_name in sys.modules:
        del sys.modules[lagrangian_module_name]
    return SimpleNamespace(
        controller_contract=importlib.import_module(
            "model_informed_greenhouse_dashboard.backend.app.services.rtr.controller_contract"
        ),
        control_effects=importlib.import_module(
            "model_informed_greenhouse_dashboard.backend.app.services.rtr.control_effects"
        ),
        objective_terms=importlib.import_module(
            "model_informed_greenhouse_dashboard.backend.app.services.rtr.objective_terms"
        ),
        lagrangian_optimizer=importlib.import_module(lagrangian_module_name),
        scenario_runner=importlib.import_module(
            "model_informed_greenhouse_dashboard.backend.app.services.rtr.scenario_runner"
        ),
    )


class FakeModel:
    def __init__(
        self,
        *,
        par_umol_m2_s: float,
        co2_ppm: float,
        base_assim_umol_m2_s: float,
        temp_opt_c: float = 23.5,
        heat_penalty: float = 0.45,
        resp_base_g_s: float = 0.00018,
        resp_temp_coeff_g_s: float = 0.00003,
    ) -> None:
        self.u_PAR = par_umol_m2_s
        self.u_CO2 = co2_ppm
        self.Ci = co2_ppm * 0.7
        self.RH = 0.78
        self.T_a = 293.15
        self.T_c = 294.15
        self._base_assim = base_assim_umol_m2_s
        self._temp_opt_c = temp_opt_c
        self._heat_penalty = heat_penalty
        self._resp_base_g_s = resp_base_g_s
        self._resp_temp_coeff_g_s = resp_temp_coeff_g_s

    def calculate_canopy_photosynthesis(self, temp_k: float):
        temp_c = temp_k - 273.15
        light_gain = max(0.0, (self.u_PAR - 180.0) * 0.0045)
        co2_gain = max(0.0, (self.u_CO2 - 380.0) * 0.0065)
        temp_gain = 0.22 * (temp_c - 18.0)
        heat_loss = self._heat_penalty * max(0.0, temp_c - self._temp_opt_c) ** 2
        gross = max(0.0, self._base_assim + light_gain + co2_gain + temp_gain - heat_loss)
        stomatal = max(
            0.06,
            0.18 + (self.u_PAR * 0.00008) + (self.u_CO2 * 0.00002) - max(0.0, temp_c - 29.0) * 0.01,
        )
        return gross, None, stomatal

    def calculate_instantaneous_respiration(self, temp_k: float) -> float:
        temp_c = temp_k - 273.15
        return max(
            0.0,
            self._resp_base_g_s
            + (self._resp_temp_coeff_g_s * max(0.0, temp_c - 18.0))
            + (0.00001 * max(0.0, temp_c - 24.0) ** 2),
        )


class FakeAdapter:
    def __init__(self, *, model: FakeModel, raw_state: dict[str, object]) -> None:
        self.model = model
        self._raw_state = raw_state

    def dump_state(self):
        return dict(self._raw_state)


class FakeEnergyEstimator:
    def estimate_target_hold(
        self,
        *,
        state: dict[str, float],
        target_air_c: float,
        outside_air_c: float,
        dt_hours: float,
    ) -> dict[str, float]:
        sensible_heat = float(state.get("H_W_m2", 0.0))
        temp_gap = max(0.0, target_air_c - outside_air_c)
        q_load_kw = max(0.0, (temp_gap * 0.85) + (sensible_heat / 1600.0))
        cop = max(2.2, 4.1 - (temp_gap * 0.05))
        daily_kwh = (q_load_kw / cop) * dt_hours
        return {
            "Q_load_kW": round(q_load_kw, 6),
            "P_elec_kW": round(q_load_kw / cop, 6),
            "COP_current": round(cop, 6),
            "daily_kWh": round(daily_kwh, 6),
        }


class FakeStore:
    def persist_sensitivity_outputs(self, *, sensitivities, **kwargs):
        rows = []
        for index, row in enumerate(sensitivities, start=1):
            rows.append({"sensitivity_id": f"sen-{index}", **row})
        return rows

    def list_work_events(self, *args, **kwargs):
        return []


def _fake_context(
    *,
    crop: str,
    par_umol_m2_s: float,
    co2_ppm: float,
    t_air_c: float,
    outside_t_c: float,
    source_capacity: float,
    sink_demand: float,
    fruit_load: float,
    source_sink_balance: float,
    remaining_leaves: int = 18,
    active_trusses: int = 3,
    fruit_partition_ratio: float = 0.58,
    recent_leaf_removal_count: int = 0,
    recent_fruit_thinning_count: int = 0,
) -> SimpleNamespace:
    net_assim = max(0.1, 5.0 + (par_umol_m2_s / 200.0) + ((co2_ppm - 380.0) / 120.0))
    resp_proxy = max(0.1, 2.8 + max(0.0, t_air_c - 20.0) * 0.7)
    gross_assim = net_assim + resp_proxy
    raw_state = {
        "nodes": 18 if crop == "cucumber" else 0,
        "threshold_before": 26.3,
        "threshold_after": 15.6,
        "reproductive_node_threshold": 15.0,
        "fr_clamp_to_valid": crop == "tomato",
        "fr_T_max_valid": 23.0,
    }
    model = FakeModel(
        par_umol_m2_s=par_umol_m2_s,
        co2_ppm=co2_ppm,
        base_assim_umol_m2_s=source_capacity * 4.6,
        temp_opt_c=23.0 if crop == "cucumber" else 22.0,
        heat_penalty=0.42 if crop == "cucumber" else 0.5,
        resp_base_g_s=0.00018 if crop == "cucumber" else 0.00021,
        resp_temp_coeff_g_s=0.000025 if crop == "cucumber" else 0.00003,
    )
    cucumber_specific = {
        "leaf_area_by_rank": [0.08] * remaining_leaves,
        "upper_leaf_activity": 0.92,
        "middle_leaf_activity": 0.66,
        "bottom_leaf_activity": 0.28,
        "remaining_leaves": remaining_leaves,
    }
    tomato_specific = {
        "truss_cohorts": [
            {"n_fruits": max(1.0, fruit_load / max(active_trusses, 1)), "w_fr_cohort": 11.0},
            {"n_fruits": max(1.0, fruit_load / max(active_trusses, 1)), "w_fr_cohort": 8.0},
        ],
        "active_trusses": active_trusses,
        "fruit_partition_ratio": fruit_partition_ratio,
        "upper_leaf_activity": 0.86,
        "middle_leaf_activity": 0.61,
        "bottom_leaf_activity": 0.24,
    }
    canonical_state = {
        "timestamp": "2026-04-08T00:00:00+09:00",
        "crop": crop,
        "greenhouse_id": "house-a",
        "env": {
            "T_air_C": t_air_c,
            "T_canopy_C": t_air_c + 0.8,
            "RH_pct": 78.0,
            "VPD_kPa": 0.72,
            "CO2_ppm": co2_ppm,
            "PAR_umol_m2_s": par_umol_m2_s,
            "outside_T_C": outside_t_c,
        },
        "flux": {
            "gross_assim_umol_m2_s": gross_assim,
            "net_assim_umol_m2_s": net_assim,
            "respiration_proxy_umol_m2_s": resp_proxy,
            "transpiration_g_m2_s": 0.12,
            "latent_heat_W_m2": 62.0,
            "sensible_heat_W_m2": 48.0,
            "stomatal_conductance_m_s": 0.22,
        },
        "growth": {
            "LAI": 2.1 if crop == "tomato" else 2.8,
            "node_count": 18,
            "predicted_node_rate_day": 0.56 if crop == "cucumber" else 0.49,
            "fruit_load": fruit_load,
            "sink_demand": sink_demand,
            "source_capacity": source_capacity,
            "source_sink_balance": source_sink_balance,
            "vegetative_dry_matter_g_m2": 78.0,
            "fruit_dry_matter_g_m2": 24.0,
            "harvested_fruit_dry_matter_g_m2": 7.0,
        },
        "crop_specific": {
            "cucumber": cucumber_specific,
            "tomato": tomato_specific,
        },
        "events": {
            "recent_leaf_removal": [{}] * recent_leaf_removal_count,
            "recent_fruit_thinning": [{}] * recent_fruit_thinning_count,
            "recent_harvest": [],
            "recent_setpoint_changes": [],
        },
        "baseline_rtr": {
            "baseTempC": 18.132 if crop == "cucumber" else 18.553,
            "slopeCPerMjM2": 0.3099 if crop == "cucumber" else 0.7913,
            "baseline_target_C": 19.1 if crop == "cucumber" else 19.4,
        },
        "optimizer": {
            "enabled": True,
            "default_mode": "balanced",
            "max_delta_temp_C": 1.2 if crop == "cucumber" else 1.5,
            "max_rtr_ratio_delta": 0.03 if crop == "cucumber" else 0.04,
            "weights": {
                "temp": 1.0,
                "node": 150.0 if crop == "cucumber" else 130.0,
                "carbon": 120.0 if crop == "cucumber" else 110.0,
                "sink": 80.0 if crop == "cucumber" else 90.0,
                "resp": 20.0 if crop == "cucumber" else 25.0,
                "risk": 120.0,
                "energy": 25.0,
                "labor": 20.0 if crop == "cucumber" else 18.0,
            },
        },
    }
    return SimpleNamespace(
        canonical_state=canonical_state,
        adapter=FakeAdapter(model=model, raw_state=raw_state),
        greenhouse_area_m2=3305.8,
        actual_area_m2=3305.8,
        ops_config={"heating_set_C": 19.0, "co2_target_ppm": co2_ppm},
        crop_profile={"optimizer": canonical_state["optimizer"]},
        recent_events=[],
        cost_per_kwh=135.0,
        energy_estimator=FakeEnergyEstimator(),
    )


def _build_calibration_env_df() -> pd.DataFrame:
    rows: list[dict[str, object]] = []
    base_date = pd.Timestamp("2026-04-01 00:00:00")
    temperatures = [19.5, 20.1, 20.7, 21.3, 21.9, 22.5]
    radiations = [8.0, 10.0, 12.0, 14.0, 16.0, 18.0]
    midday_par = [(value * 1_000_000.0) / (12 * 3600) for value in radiations]

    for day_index, (average_temp, midday_light) in enumerate(zip(temperatures, midday_par)):
        day_start = base_date + pd.Timedelta(days=day_index)
        rows.append(
            {
                "datetime": day_start,
                "T_air_C": average_temp - 1.0,
                "PAR_umol": 0.0,
                "RH_percent": 70.0,
            }
        )
        rows.append(
            {
                "datetime": day_start + pd.Timedelta(hours=12),
                "T_air_C": average_temp + 1.0,
                "PAR_umol": midday_light,
                "RH_percent": 70.0,
            }
        )

    rows.append(
        {
            "datetime": base_date + pd.Timedelta(days=len(temperatures)),
            "T_air_C": temperatures[-1] - 1.0,
            "PAR_umol": 0.0,
            "RH_percent": 70.0,
        }
    )

    return pd.DataFrame(rows)


def _optimization_inputs(services, crop: str, **overrides):
    payload = {
        "crop": crop,
        "greenhouse_id": "house-a",
        "target_node_development_per_day": 0.72 if crop == "cucumber" else 0.64,
        "optimization_mode": "balanced",
        "include_energy_cost": True,
        "include_labor_cost": False,
        "target_horizon": "today",
    }
    payload.update(overrides)
    return services.controller_contract.build_service_inputs(
        payload,
        greenhouse_id="house-a",
    )


def _baseline_candidate(services, context, optimization_inputs):
    target_c = float(context.canonical_state["baseline_rtr"]["baseline_target_C"])
    return services.objective_terms.evaluate_rtr_candidate(
        context=context,
        optimization_inputs=optimization_inputs,
        weights={key: 1.0 for key in ("temp", "node", "carbon", "sink", "resp", "risk", "energy", "labor")},
        day_min_temp_c=target_c,
        night_min_temp_c=target_c - 0.6,
        co2_target_ppm=float(context.canonical_state["env"]["CO2_ppm"]),
        rh_target_pct=float(context.canonical_state["env"]["RH_pct"]),
    )


def _full_test_weights(value: float = 1.0) -> dict[str, float]:
    return {
        "temp": value,
        "node": value,
        "carbon": value,
        "sink": value,
        "resp": value,
        "risk": value,
        "energy": value,
        "labor": value,
        "assim": value,
        "yield": value,
        "heating": value,
        "cooling": value,
        "ventilation": value,
        "humidity": value,
        "disease": value,
        "stress": value,
    }


def test_unit_projection_keeps_canonical_m2_and_projects_actual_area() -> None:
    services = _load_light_rtr_services()

    area_meta = services.unit_projection.canonicalize_area(
        greenhouse_area_m2=3305.8,
        user_actual_area_pyeong=850,
    )
    projection = services.unit_projection.build_actual_area_projection(
        area_meta=area_meta,
        yield_kg_m2_day=0.42,
        yield_kg_m2_week=2.94,
        energy_kwh_m2_day=0.19,
        energy_krw_m2_day=25.65,
        labor_index_m2_day=0.08,
    )

    assert area_meta["greenhouse_area_m2"] == 3305.8
    assert round(float(area_meta["actual_area_m2"]), 3) == 2809.917
    assert projection["actual_area_pyeong"] == 850
    assert projection["yield_kg_day"] > 0
    assert projection["energy_krw_day"] > 0


def test_cucumber_leaf_removal_pushes_optimizer_to_guard_or_warmer_solution() -> None:
    services = _load_optimizer_rtr_services()
    before_context = _fake_context(
        crop="cucumber",
        par_umol_m2_s=920.0,
        co2_ppm=720.0,
        t_air_c=19.0,
        outside_t_c=8.0,
        source_capacity=1.05,
        sink_demand=0.82,
        fruit_load=14.0,
        source_sink_balance=0.18,
        remaining_leaves=18,
        recent_leaf_removal_count=0,
    )
    after_context = _fake_context(
        crop="cucumber",
        par_umol_m2_s=920.0,
        co2_ppm=720.0,
        t_air_c=19.0,
        outside_t_c=8.0,
        source_capacity=0.72,
        sink_demand=0.86,
        fruit_load=14.0,
        source_sink_balance=-0.04,
        remaining_leaves=14,
        recent_leaf_removal_count=1,
    )
    optimization_inputs = _optimization_inputs(services, "cucumber")

    before_result = services.lagrangian_optimizer.optimize_rtr_targets(
        context=before_context,
        optimization_inputs=optimization_inputs,
    )
    after_result = services.lagrangian_optimizer.optimize_rtr_targets(
        context=after_context,
        optimization_inputs=optimization_inputs,
    )

    assert (
        after_context.canonical_state["growth"]["source_capacity"]
        < before_context.canonical_state["growth"]["source_capacity"]
    )
    assert (
        after_result["controls"]["mean_temp_C"] >= before_result["controls"]["mean_temp_C"]
        or not after_result["feasibility"]["carbon_margin_positive"]
    )


def test_tomato_fruit_thinning_relaxes_temperature_pressure() -> None:
    services = _load_optimizer_rtr_services()
    before_context = _fake_context(
        crop="tomato",
        par_umol_m2_s=980.0,
        co2_ppm=760.0,
        t_air_c=19.3,
        outside_t_c=7.0,
        source_capacity=0.94,
        sink_demand=1.08,
        fruit_load=12.0,
        source_sink_balance=-0.08,
        active_trusses=3,
        recent_fruit_thinning_count=0,
    )
    after_context = _fake_context(
        crop="tomato",
        par_umol_m2_s=980.0,
        co2_ppm=760.0,
        t_air_c=19.3,
        outside_t_c=7.0,
        source_capacity=0.94,
        sink_demand=0.74,
        fruit_load=9.0,
        source_sink_balance=0.06,
        active_trusses=3,
        recent_fruit_thinning_count=1,
    )
    optimization_inputs = _optimization_inputs(services, "tomato")

    before_result = services.lagrangian_optimizer.optimize_rtr_targets(
        context=before_context,
        optimization_inputs=optimization_inputs,
    )
    after_result = services.lagrangian_optimizer.optimize_rtr_targets(
        context=after_context,
        optimization_inputs=optimization_inputs,
    )

    assert (
        after_context.canonical_state["growth"]["sink_demand"]
        < before_context.canonical_state["growth"]["sink_demand"]
    )
    assert (
        after_result["objective_breakdown"]["carbon_margin_penalty"]
        <= before_result["objective_breakdown"]["carbon_margin_penalty"] + 1e-6
    )
    assert (
        after_result["objective_breakdown"]["sink_overload_penalty"]
        <= before_result["objective_breakdown"]["sink_overload_penalty"] + 1e-6
    )


def test_rtr_optimizer_balances_high_par_vs_low_par_high_temp() -> None:
    services = _load_optimizer_rtr_services()
    high_context = _fake_context(
        crop="cucumber",
        par_umol_m2_s=1350.0,
        co2_ppm=900.0,
        t_air_c=19.2,
        outside_t_c=8.0,
        source_capacity=1.04,
        sink_demand=0.84,
        fruit_load=13.0,
        source_sink_balance=0.14,
    )
    low_context = _fake_context(
        crop="cucumber",
        par_umol_m2_s=180.0,
        co2_ppm=420.0,
        t_air_c=26.4,
        outside_t_c=14.0,
        source_capacity=0.78,
        sink_demand=0.88,
        fruit_load=13.0,
        source_sink_balance=-0.03,
    )
    optimization_inputs = _optimization_inputs(services, "cucumber")

    high_result = services.lagrangian_optimizer.optimize_rtr_targets(
        context=high_context,
        optimization_inputs=optimization_inputs,
    )
    low_result = services.lagrangian_optimizer.optimize_rtr_targets(
        context=low_context,
        optimization_inputs=optimization_inputs,
    )

    assert (
        high_result["flux_projection"]["net_assim_umol_m2_s"]
        > low_result["flux_projection"]["net_assim_umol_m2_s"]
    )
    assert (
        low_context.canonical_state["flux"]["respiration_proxy_umol_m2_s"]
        > high_context.canonical_state["flux"]["respiration_proxy_umol_m2_s"]
    )
    assert (
        low_result["rtr_equivalent"]["delta_temp_C"]
        if "rtr_equivalent" in low_result
        else low_result["controls"]["mean_temp_C"]
    ) <= high_result["controls"]["mean_temp_C"] + 0.2


def test_rtr_optimizer_modes_apply_energy_and_labor_penalties() -> None:
    services = _load_optimizer_rtr_services()
    context = _fake_context(
        crop="tomato",
        par_umol_m2_s=1000.0,
        co2_ppm=780.0,
        t_air_c=19.4,
        outside_t_c=6.0,
        source_capacity=0.98,
        sink_demand=0.96,
        fruit_load=11.0,
        source_sink_balance=0.04,
    )
    growth_inputs = _optimization_inputs(
        services,
        "tomato",
        optimization_mode="growth_priority",
        include_energy_cost=True,
        include_labor_cost=True,
        user_labor_cost_coefficient=2.0,
    )
    energy_inputs = _optimization_inputs(
        services,
        "tomato",
        optimization_mode="energy_saving",
        include_energy_cost=True,
    )
    labor_inputs = _optimization_inputs(
        services,
        "tomato",
        optimization_mode="labor_saving",
        include_energy_cost=True,
        include_labor_cost=True,
        user_labor_cost_coefficient=2.0,
    )

    growth_result = services.lagrangian_optimizer.optimize_rtr_targets(
        context=context,
        optimization_inputs=growth_inputs,
    )
    energy_result = services.lagrangian_optimizer.optimize_rtr_targets(
        context=context,
        optimization_inputs=energy_inputs,
    )
    labor_result = services.lagrangian_optimizer.optimize_rtr_targets(
        context=context,
        optimization_inputs=labor_inputs,
    )

    assert (
        energy_result["objective_breakdown"]["energy_cost"]
        <= growth_result["objective_breakdown"]["energy_cost"] + 1e-6
    )
    assert (
        labor_result["objective_breakdown"]["labor_index"]
        <= growth_result["objective_breakdown"]["labor_index"] + 1e-6
    )


def test_ventilation_energy_decomposition_does_not_double_count_total_energy() -> None:
    services = _load_optimizer_rtr_services()
    context = _fake_context(
        crop="cucumber",
        par_umol_m2_s=840.0,
        co2_ppm=760.0,
        t_air_c=21.2,
        outside_t_c=4.0,
        source_capacity=0.96,
        sink_demand=0.84,
        fruit_load=12.0,
        source_sink_balance=0.08,
    )
    optimization_inputs = _optimization_inputs(services, "cucumber")

    result = services.objective_terms.evaluate_rtr_candidate(
        context=context,
        optimization_inputs=optimization_inputs,
        weights=_full_test_weights(),
        day_min_temp_c=20.8,
        night_min_temp_c=19.0,
        day_cooling_target_c=28.0,
        night_cooling_target_c=24.0,
        vent_bias_c=0.8,
        screen_bias_pct=0.0,
        circulation_fan_pct=35.0,
        co2_target_ppm=760.0,
    )

    energy_summary = result["energy_summary"]
    thermal_plus_vent = (
        float(energy_summary["heating_energy_kWh_m2_day"])
        + float(energy_summary["cooling_energy_kWh_m2_day"])
        + float(energy_summary["ventilation_energy_kWh_m2_day"])
    )
    assert abs(thermal_plus_vent - float(energy_summary["total_energy_kWh_m2_day"])) < 1e-6


def test_scenario_runner_uses_same_baseline_reference_as_optimize_baseline() -> None:
    services = _load_optimizer_rtr_services()
    backend_main = _backend_main()
    context = _fake_context(
        crop="tomato",
        par_umol_m2_s=960.0,
        co2_ppm=780.0,
        t_air_c=19.3,
        outside_t_c=6.0,
        source_capacity=0.95,
        sink_demand=0.87,
        fruit_load=11.0,
        source_sink_balance=0.06,
    )
    optimization_inputs = _optimization_inputs(services, "tomato")

    baseline_eval = backend_main._build_rtr_baseline_candidate(context, optimization_inputs)
    scenarios = services.scenario_runner.run_rtr_scenarios(
        context=context,
        optimization_inputs=optimization_inputs,
    )
    baseline_row = next(row for row in scenarios if row["label"] == "baseline")

    assert baseline_row["day_heating_min_temp_C"] == baseline_eval["controls"]["day_heating_min_temp_C"]
    assert baseline_row["night_heating_min_temp_C"] == baseline_eval["controls"]["night_heating_min_temp_C"]
    assert baseline_row["day_cooling_target_C"] == baseline_eval["controls"]["day_cooling_target_C"]
    assert baseline_row["night_cooling_target_C"] == baseline_eval["controls"]["night_cooling_target_C"]


def test_sensitivity_objective_derivative_respects_energy_option(monkeypatch) -> None:
    services = _load_optimizer_rtr_services()
    context = _fake_context(
        crop="tomato",
        par_umol_m2_s=820.0,
        co2_ppm=720.0,
        t_air_c=19.1,
        outside_t_c=2.5,
        source_capacity=0.93,
        sink_demand=0.88,
        fruit_load=10.5,
        source_sink_balance=0.04,
    )
    with_energy = _optimization_inputs(
        services,
        "tomato",
        optimization_mode="custom_weights",
        include_energy_cost=True,
        custom_weights={
            "temp": 0.0,
            "node": 0.0,
            "carbon": 0.0,
            "sink": 0.0,
            "resp": 0.0,
            "risk": 0.0,
            "energy": 0.0,
            "labor": 0.0,
            "assim": 0.0,
            "yield": 0.0,
            "heating": 10.0,
            "cooling": 0.0,
            "ventilation": 0.0,
            "humidity": 0.0,
            "disease": 0.0,
            "stress": 0.0,
        },
    )
    without_energy = _optimization_inputs(
        services,
        "tomato",
        optimization_mode="custom_weights",
        include_energy_cost=False,
        custom_weights={
            "temp": 0.0,
            "node": 0.0,
            "carbon": 0.0,
            "sink": 0.0,
            "resp": 0.0,
            "risk": 0.0,
            "energy": 0.0,
            "labor": 0.0,
            "assim": 0.0,
            "yield": 0.0,
            "heating": 10.0,
            "cooling": 0.0,
            "ventilation": 0.0,
            "humidity": 0.0,
            "disease": 0.0,
            "stress": 0.0,
        },
    )
    optimized_candidate = {
        "controls": {
            "day_heating_min_temp_C": 19.6,
            "night_heating_min_temp_C": 18.8,
            "day_cooling_target_C": 26.0,
            "night_cooling_target_C": 24.8,
            "vent_bias_C": 0.0,
            "screen_bias_pct": 0.0,
            "circulation_fan_pct": 35.0,
            "co2_target_ppm": 720.0,
            "dehumidification_bias": 0.0,
            "fogging_or_evap_cooling_intensity": 0.0,
        }
    }
    captured_weights: list[dict[str, float]] = []

    def _fake_eval(**kwargs):
        captured_weights.append(dict(kwargs["weights"]))
        heating_weight = float(kwargs["weights"].get("heating", 0.0))
        return {
            "objective_value": heating_weight,
            "flux_projection": {"carbon_margin": 1.0},
            "objective_breakdown": {
                "humidity_risk_penalty": 0.0,
                "disease_penalty": 0.0,
                "heating_energy_cost": 0.0,
                "cooling_energy_cost": 0.0,
                "labor_cost": 0.0,
            },
        }

    monkeypatch.setattr(services.scenario_runner, "evaluate_rtr_candidate", _fake_eval)

    services.scenario_runner.compute_rtr_temperature_sensitivity(
        context=context,
        optimization_inputs=with_energy,
        optimized_candidate=optimized_candidate,
    )
    with_energy_weights = list(captured_weights)
    captured_weights.clear()

    services.scenario_runner.compute_rtr_temperature_sensitivity(
        context=context,
        optimization_inputs=without_energy,
        optimized_candidate=optimized_candidate,
    )
    without_energy_weights = list(captured_weights)

    assert any(weight_row["heating"] > 0.0 for weight_row in with_energy_weights)
    assert all(weight_row["heating"] == 0.0 for weight_row in without_energy_weights)
    assert all(weight_row["ventilation"] == 0.0 for weight_row in without_energy_weights)


def test_rtr_deriver_bounds_ratio_delta() -> None:
    services = _load_light_rtr_services()

    payload = services.rtr_deriver.derive_rtr_equivalent(
        baseline_targets={
            "day_min_temp_C": 19.2,
            "night_min_temp_C": 18.6,
            "mean_temp_C": 18.95,
        },
        optimized_targets={
            "day_min_temp_C": 21.0,
            "night_min_temp_C": 20.4,
            "mean_temp_C": 20.75,
        },
        max_ratio_delta=0.03,
    )

    assert payload["baseline_ratio"] == 1.0
    assert payload["optimized_ratio"] == 1.03
    assert payload["delta_ratio"] == 0.03
    assert payload["delta_temp_C"] == 1.8


def test_rtr_state_route_returns_canonical_shape(
    monkeypatch,
) -> None:
    backend_main = _backend_main()
    context = _fake_context(
        crop="cucumber",
        par_umol_m2_s=920.0,
        co2_ppm=720.0,
        t_air_c=19.0,
        outside_t_c=8.0,
        source_capacity=1.05,
        sink_demand=0.82,
        fruit_load=14.0,
        source_sink_balance=0.18,
    )

    class _Store:
        def list_work_events(self, *args, **kwargs):
            return []

    fake_internal_bridge = types.ModuleType(
        "model_informed_greenhouse_dashboard.backend.app.services.rtr.internal_model_bridge"
    )
    fake_internal_bridge.build_internal_model_context = lambda **kwargs: context
    model_state_store = importlib.import_module(
        "model_informed_greenhouse_dashboard.backend.app.services.model_runtime.model_state_store"
    )
    monkeypatch.setattr(model_state_store, "ModelStateStore", lambda: _Store())
    monkeypatch.setattr(
        backend_main,
        "_resolve_runtime_snapshot_record",
        lambda **kwargs: ("house-a", {"snapshot_id": "snap-rtr", "crop": "cucumber"}),
    )
    monkeypatch.setitem(
        sys.modules,
        "model_informed_greenhouse_dashboard.backend.app.services.rtr.internal_model_bridge",
        fake_internal_bridge,
    )

    client = TestClient(get_app())
    response = client.get("/api/rtr/state", params={"crop": "cucumber"})

    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "success"
    assert payload["snapshot_id"] == "snap-rtr"
    assert payload["canonical_state"]["crop"] == "cucumber"
    assert payload["optimizer_enabled"] is True


def test_rtr_optimize_scenario_and_sensitivity_routes_return_optimizer_surfaces(
    monkeypatch,
) -> None:
    services = _load_light_rtr_services()
    backend_main = _backend_main()
    context = _fake_context(
        crop="tomato",
        par_umol_m2_s=980.0,
        co2_ppm=760.0,
        t_air_c=19.3,
        outside_t_c=7.0,
        source_capacity=0.94,
        sink_demand=0.9,
        fruit_load=11.0,
        source_sink_balance=0.02,
    )
    optimization_inputs = _optimization_inputs(
        services,
        "tomato",
        include_energy_cost=True,
        include_labor_cost=True,
        user_actual_area_m2=1200,
        user_labor_cost_coefficient=1.5,
    )
    fake_store = FakeStore()
    fake_bundle = (
        "tomato",
        fake_store,
        "house-a",
        {"snapshot_id": "snap-rtr", "crop": "tomato"},
        {"version": 2},
        {
            "greenhouse_area_m2": 3305.8,
            "actual_area_m2": 1200.0,
            "actual_area_pyeong": 362.998651,
        },
        optimization_inputs,
        context,
    )

    fake_optimizer_module = types.ModuleType(
        "model_informed_greenhouse_dashboard.backend.app.services.rtr.lagrangian_optimizer"
    )
    fake_optimizer_module.optimize_rtr_targets = lambda **kwargs: {
        "controls": {
            "day_min_temp_C": 20.0,
            "night_min_temp_C": 18.8,
            "mean_temp_C": 19.5,
            "vent_bias_C": 0.2,
            "screen_bias_pct": -1.5,
            "co2_target_ppm": 760.0,
        },
        "node_summary": {
            "target_rate_day": 0.64,
            "observed_rate_day": 0.49,
            "predicted_rate_day": 0.65,
            "gap_rate_day": -0.01,
            "target_hit": True,
        },
        "objective_breakdown": {
            "assimilation_gain": 1.8,
            "respiration_cost": 0.4,
            "node_target_penalty": 0.0,
            "carbon_margin_penalty": 0.0,
            "sink_overload_penalty": 0.0,
            "humidity_risk_penalty": 0.0,
            "disease_penalty": 0.0,
            "energy_cost": 0.18,
            "energy_cost_krw": 24.3,
            "labor_cost": 0.09,
            "labor_index": 0.06,
        },
        "flux_projection": {
            "gross_assim_umol_m2_s": 12.2,
            "net_assim_umol_m2_s": 8.4,
            "respiration_umol_m2_s": 3.8,
            "carbon_margin": 0.14,
            "day_Q_load_kW": 8.5,
            "night_Q_load_kW": 6.2,
            "stomatal_conductance_m_s": 0.23,
        },
        "constraint_checks": {
            "risk_flags": [],
            "energy_cost_penalty": 0.0,
            "disease_risk_penalty": 0.0,
            "stress_penalty": 0.0,
            "confidence_penalty": 0.08,
        },
        "feasibility": {
            "target_node_hit": True,
            "carbon_margin_positive": True,
            "risk_flags": [],
        },
        "baseline_targets": {
            "day_min_temp_C": 19.4,
            "night_min_temp_C": 18.8,
            "mean_temp_C": 19.15,
        },
        "solver": {
            "stage1_success": True,
            "stage2_success": True,
            "stage1_message": "ok",
            "stage2_message": "ok",
        },
    }
    fake_deriver_module = types.ModuleType(
        "model_informed_greenhouse_dashboard.backend.app.services.rtr.rtr_deriver"
    )
    fake_deriver_module.derive_rtr_equivalent = lambda **kwargs: {
        "baseline_ratio": 1.0,
        "optimized_ratio": 1.02,
        "delta_ratio": 0.02,
        "delta_temp_C": 0.35,
    }
    fake_scenario_module = types.ModuleType(
        "model_informed_greenhouse_dashboard.backend.app.services.rtr.scenario_runner"
    )
    fake_scenario_module.run_rtr_scenarios = lambda **kwargs: [
        {
            "label": "baseline",
            "mode": "baseline",
            "mean_temp_C": 19.1,
            "node_rate_day": 0.49,
            "net_carbon": 0.02,
            "respiration": 3.4,
            "energy_kwh_m2_day": 0.16,
            "labor_index": 0.05,
            "yield_proxy_basis_net_assim": 7.5,
            "yield_trend": "guarded",
            "recommendation_badge": "baseline",
            "confidence": 0.72,
            "risk_flags": [],
            "objective_breakdown": {
                "energy_cost_krw": 22.4,
            },
        },
        {
            "label": "offset_minus_0_3c",
            "mode": "offset",
            "mean_temp_C": 18.8,
            "node_rate_day": 0.45,
            "net_carbon": 0.03,
            "respiration": 3.2,
            "energy_kwh_m2_day": 0.14,
            "labor_index": 0.04,
            "yield_proxy_basis_net_assim": 7.2,
            "yield_trend": "guarded",
            "recommendation_badge": "compare",
            "confidence": 0.7,
            "risk_flags": [],
            "objective_breakdown": {
                "energy_cost_krw": 20.2,
            },
        },
        {
            "label": "offset_plus_0_3c",
            "mode": "offset",
            "mean_temp_C": 19.4,
            "node_rate_day": 0.62,
            "net_carbon": 0.11,
            "respiration": 3.7,
            "energy_kwh_m2_day": 0.17,
            "labor_index": 0.06,
            "yield_proxy_basis_net_assim": 8.2,
            "yield_trend": "up",
            "recommendation_badge": "compare",
            "confidence": 0.82,
            "risk_flags": [],
            "objective_breakdown": {
                "energy_cost_krw": 23.5,
            },
        },
        {
            "label": "offset_plus_0_6c",
            "mode": "offset",
            "mean_temp_C": 19.7,
            "node_rate_day": 0.66,
            "net_carbon": 0.12,
            "respiration": 3.9,
            "energy_kwh_m2_day": 0.19,
            "labor_index": 0.07,
            "yield_proxy_basis_net_assim": 8.3,
            "yield_trend": "up",
            "recommendation_badge": "compare",
            "confidence": 0.8,
            "risk_flags": [{"code": "respiration_watch"}],
            "objective_breakdown": {
                "energy_cost_krw": 25.6,
            },
        },
        {
            "label": "balanced",
            "mode": "optimizer",
            "mean_temp_C": 19.5,
            "node_rate_day": 0.65,
            "net_carbon": 0.14,
            "respiration": 3.8,
            "energy_kwh_m2_day": 0.18,
            "labor_index": 0.06,
            "yield_proxy_basis_net_assim": 8.4,
            "yield_trend": "up",
            "recommendation_badge": "recommended",
            "confidence": 0.91,
            "risk_flags": [],
            "objective_breakdown": {
                "energy_cost_krw": 24.3,
            },
        },
        {
            "label": "growth_priority",
            "mode": "optimizer",
            "mean_temp_C": 19.7,
            "node_rate_day": 0.68,
            "net_carbon": 0.13,
            "respiration": 4.0,
            "energy_kwh_m2_day": 0.21,
            "labor_index": 0.08,
            "yield_proxy_basis_net_assim": 8.1,
            "yield_trend": "up",
            "recommendation_badge": "compare",
            "confidence": 0.84,
            "risk_flags": [{"code": "respiration_watch"}],
            "objective_breakdown": {
                "energy_cost_krw": 27.6,
            },
        },
        {
            "label": "energy_saving",
            "mode": "optimizer",
            "mean_temp_C": 19.2,
            "node_rate_day": 0.61,
            "net_carbon": 0.11,
            "respiration": 3.6,
            "energy_kwh_m2_day": 0.14,
            "labor_index": 0.05,
            "yield_proxy_basis_net_assim": 7.9,
            "yield_trend": "up",
            "recommendation_badge": "compare",
            "confidence": 0.88,
            "risk_flags": [],
            "objective_breakdown": {
                "energy_cost_krw": 19.5,
            },
        },
        {
            "label": "labor_saving",
            "mode": "optimizer",
            "mean_temp_C": 19.3,
            "node_rate_day": 0.6,
            "net_carbon": 0.12,
            "respiration": 3.7,
            "energy_kwh_m2_day": 0.15,
            "labor_index": 0.04,
            "yield_proxy_basis_net_assim": 8.0,
            "yield_trend": "up",
            "recommendation_badge": "compare",
            "confidence": 0.87,
            "risk_flags": [],
            "objective_breakdown": {
                "energy_cost_krw": 21.1,
            },
        },
    ]
    fake_scenario_module.compute_rtr_temperature_sensitivity = lambda **kwargs: {
        "sensitivities": [
            {
                "control": "temperature_day",
                "target": "predicted_node_rate_day",
                "derivative": 0.12,
                "elasticity": 0.18,
                "direction": "increase",
                "trust_region": {"low": -0.4, "high": 0.4},
                "method": "finite_difference",
                "perturbation_size": 0.4,
                "valid": True,
            },
            {
                "control": "temperature_night",
                "target": "carbon_margin",
                "derivative": -0.02,
                "elasticity": -0.05,
                "direction": "decrease",
                "trust_region": {"low": -0.4, "high": 0.4},
                "method": "finite_difference",
                "perturbation_size": 0.4,
                "valid": True,
            },
            {
                "control": "temperature_mean",
                "target": "energy_cost",
                "derivative": 0.08,
                "elasticity": 0.12,
                "direction": "increase",
                "trust_region": {"low": -0.4, "high": 0.4},
                "method": "finite_difference",
                "perturbation_size": 0.4,
                "valid": True,
            },
            {
                "control": "screen_bias",
                "target": "humidity_risk_penalty",
                "derivative": -0.03,
                "elasticity": -0.08,
                "direction": "decrease",
                "trust_region": {"low": -4.0, "high": 4.0},
                "method": "finite_difference",
                "perturbation_size": 4.0,
                "valid": True,
            },
            {
                "control": "screen_bias",
                "target": "disease_penalty",
                "derivative": -0.02,
                "elasticity": -0.05,
                "direction": "decrease",
                "trust_region": {"low": -4.0, "high": 4.0},
                "method": "finite_difference",
                "perturbation_size": 4.0,
                "valid": True,
            },
        ]
    }
    fake_objective_terms = types.ModuleType(
        "model_informed_greenhouse_dashboard.backend.app.services.rtr.objective_terms"
    )
    fake_objective_terms.evaluate_rtr_candidate = lambda **kwargs: {
        "controls": {
            "day_min_temp_C": 20.1,
            "night_min_temp_C": 18.7,
            "mean_temp_C": 19.52,
            "vent_bias_C": 0.3,
            "screen_bias_pct": 0.0,
            "co2_target_ppm": 760.0,
        },
        "node_summary": {
            "predicted_rate_day": 0.66,
            "target_hit": True,
        },
        "flux_projection": {
            "carbon_margin": 0.12,
            "respiration_umol_m2_s": 3.9,
            "net_assim_umol_m2_s": 8.2,
        },
        "objective_breakdown": {
            "energy_cost": 0.19,
            "energy_cost_krw": 25.7,
            "labor_index": 0.07,
        },
        "constraint_checks": {
            "confidence_penalty": 0.1,
        },
        "feasibility": {
            "carbon_margin_positive": True,
            "risk_flags": [],
        },
    }

    monkeypatch.setattr(
        backend_main,
        "_build_rtr_request_bundle",
        lambda req_payload: fake_bundle,
    )
    monkeypatch.setattr(
        backend_main,
        "_build_rtr_baseline_candidate",
        lambda context, optimization_inputs: {
            "controls": {
                "day_min_temp_C": 19.4,
                "night_min_temp_C": 18.8,
                "mean_temp_C": 19.15,
            },
            "objective_breakdown": {
                "respiration_cost": 0.32,
                "energy_cost": 0.16,
                "labor_index": 0.05,
            },
            "feasibility": {
                "target_node_hit": False,
                "carbon_margin_positive": True,
                "risk_flags": [],
            },
        },
    )
    monkeypatch.setattr(
        backend_main,
        "_estimate_rtr_yield_proxy_kg_m2_day",
        lambda context: 0.44,
    )
    monkeypatch.setattr(
        backend_main,
        "_build_rtr_crop_specific_insight",
        lambda context: {
            "crop": "tomato",
            "active_trusses": 3,
            "fruit_partition_ratio": 0.58,
        },
    )
    monkeypatch.setattr(
        backend_main,
        "_build_rtr_explanation_payload",
        lambda **kwargs: {"summary": "목표 마디 전개를 위한 최소 충분 온도입니다."},
    )
    monkeypatch.setattr(
        backend_main,
        "_build_rtr_warning_badges",
        lambda *args, **kwargs: ["large_rtr_deviation_reason_required"],
    )
    monkeypatch.setitem(
        sys.modules,
        "model_informed_greenhouse_dashboard.backend.app.services.rtr.lagrangian_optimizer",
        fake_optimizer_module,
    )
    monkeypatch.setitem(
        sys.modules,
        "model_informed_greenhouse_dashboard.backend.app.services.rtr.rtr_deriver",
        fake_deriver_module,
    )
    monkeypatch.setitem(
        sys.modules,
        "model_informed_greenhouse_dashboard.backend.app.services.rtr.scenario_runner",
        fake_scenario_module,
    )
    monkeypatch.setitem(
        sys.modules,
        "model_informed_greenhouse_dashboard.backend.app.services.rtr.objective_terms",
        fake_objective_terms,
    )

    client = TestClient(get_app())
    optimize_response = client.post(
        "/api/rtr/optimize",
        json={
            "crop": "tomato",
            "target_node_development_per_day": 0.64,
            "optimization_mode": "balanced",
            "include_energy_cost": True,
            "include_labor_cost": True,
            "user_actual_area_m2": 1200,
        },
    )
    scenario_response = client.post(
        "/api/rtr/scenario",
        json={
            "crop": "tomato",
            "target_node_development_per_day": 0.64,
            "optimization_mode": "balanced",
            "include_energy_cost": True,
            "include_labor_cost": True,
            "user_actual_area_m2": 1200,
            "custom_scenario": {
                "label": "custom",
                "day_min_temp_C": 20.1,
                "night_min_temp_C": 18.7,
                "vent_bias_C": 0.3,
            },
        },
    )
    sensitivity_response = client.post(
        "/api/rtr/sensitivity",
        json={
            "crop": "tomato",
            "target_node_development_per_day": 0.64,
            "optimization_mode": "balanced",
            "include_energy_cost": True,
            "step_c": 0.4,
        },
    )

    assert optimize_response.status_code == 200
    optimize_payload = optimize_response.json()
    assert optimize_payload["status"] == "success"
    assert optimize_payload["mode"] == "optimizer"
    assert optimize_payload["baseline"]["mode"] == "baseline"
    assert optimize_payload["actual_area_projection"]["actual_area_m2"] == 1200.0
    assert optimize_payload["flux_projection"]["carbon_margin"] == 0.14
    assert optimize_payload["warning_badges"] == ["large_rtr_deviation_reason_required"]
    assert optimize_payload["control_guidance"]["target_horizon"] == "today"
    assert optimize_payload["control_guidance"]["day_hold_hours"] == 14.0
    assert optimize_payload["control_guidance"]["night_hold_hours"] == 10.0
    assert optimize_payload["control_guidance"]["change_limit_C_per_step"] == 0.12

    assert scenario_response.status_code == 200
    scenario_payload = scenario_response.json()
    assert scenario_payload["status"] == "success"
    assert len(scenario_payload["scenarios"]) == 9
    assert scenario_payload["scenarios"][0]["label"] == "baseline"
    assert scenario_payload["scenarios"][1]["label"] == "offset_minus_0_3c"
    assert scenario_payload["scenarios"][2]["label"] == "offset_plus_0_3c"
    assert scenario_payload["scenarios"][0]["confidence"] >= 0.2
    assert "risk_flags" in scenario_payload["scenarios"][0]
    assert scenario_payload["scenarios"][0]["yield_kg_m2_day"] >= 0.0
    assert scenario_payload["scenarios"][0]["actual_area_projection"]["yield_kg_day"] >= 0.0
    assert scenario_payload["scenarios"][0]["actual_area_projection"]["energy_krw_day"] >= 0.0
    assert scenario_payload["scenarios"][-1]["label"] == "custom"
    assert scenario_payload["scenarios"][0]["actual_area_projection"]["energy_kwh_day"] >= 0

    assert sensitivity_response.status_code == 200
    sensitivity_payload = sensitivity_response.json()
    assert sensitivity_payload["status"] == "success"
    assert sensitivity_payload["mode"] == "optimizer"
    assert len(sensitivity_payload["sensitivities"]) == 5
    assert sensitivity_payload["sensitivities"][0]["method"] == "finite_difference"
    assert any(
        row["control"] == "screen_bias" and row["target"] == "humidity_risk_penalty"
        for row in sensitivity_payload["sensitivities"]
    )


def test_rtr_scenario_route_preserves_explicit_zero_circulation_fan_override(
    monkeypatch,
) -> None:
    services = _load_light_rtr_services()
    backend_main = _backend_main()
    context = _fake_context(
        crop="tomato",
        par_umol_m2_s=960.0,
        co2_ppm=760.0,
        t_air_c=19.3,
        outside_t_c=7.0,
        source_capacity=0.94,
        sink_demand=0.9,
        fruit_load=11.0,
        source_sink_balance=0.02,
    )
    optimization_inputs = _optimization_inputs(
        services,
        "tomato",
        include_energy_cost=True,
        include_labor_cost=True,
        user_actual_area_m2=1200,
    )
    fake_store = FakeStore()
    fake_bundle = (
        "tomato",
        fake_store,
        "house-a",
        {"snapshot_id": "snap-rtr", "crop": "tomato"},
        {"version": 2},
        {
            "greenhouse_area_m2": 3305.8,
            "actual_area_m2": 1200.0,
            "actual_area_pyeong": 362.998651,
        },
        optimization_inputs,
        context,
    )
    captured: dict[str, float] = {}

    fake_scenario_module = types.ModuleType(
        "model_informed_greenhouse_dashboard.backend.app.services.rtr.scenario_runner"
    )
    fake_scenario_module.run_rtr_scenarios = lambda **kwargs: []

    fake_objective_terms = types.ModuleType(
        "model_informed_greenhouse_dashboard.backend.app.services.rtr.objective_terms"
    )

    def _capture_candidate(**kwargs):
        captured["circulation_fan_pct"] = kwargs["circulation_fan_pct"]
        return {
            "controls": {
                "day_min_temp_C": kwargs["day_min_temp_c"],
                "night_min_temp_C": kwargs["night_min_temp_c"],
                "mean_temp_C": 19.2,
                "day_heating_min_temp_C": kwargs["day_min_temp_c"],
                "night_heating_min_temp_C": kwargs["night_min_temp_c"],
                "day_cooling_target_C": kwargs["day_cooling_target_c"],
                "night_cooling_target_C": kwargs["night_cooling_target_c"],
                "vent_bias_C": kwargs["vent_bias_c"],
                "screen_bias_pct": kwargs["screen_bias_pct"],
                "circulation_fan_pct": kwargs["circulation_fan_pct"],
                "co2_target_ppm": kwargs["co2_target_ppm"],
            },
            "node_summary": {
                "predicted_rate_day": 0.66,
                "target_hit": True,
            },
            "flux_projection": {
                "carbon_margin": 0.12,
                "respiration_umol_m2_s": 3.9,
                "net_assim_umol_m2_s": 8.2,
            },
            "objective_breakdown": {
                "energy_cost": 0.19,
                "energy_cost_krw": 25.7,
                "labor_index": 0.07,
            },
            "constraint_checks": {
                "confidence_penalty": 0.1,
            },
            "feasibility": {
                "carbon_margin_positive": True,
                "risk_flags": [],
            },
            "energy_summary": {
                "total_energy_cost_krw_m2_day": 25.7,
            },
            "yield_projection": {
                "predicted_yield_kg_m2_day": 0.04,
                "predicted_yield_kg_m2_week": 0.28,
                "harvest_trend_delta_pct": 3.0,
            },
            "control_effect_trace": {},
        }

    fake_objective_terms.evaluate_rtr_candidate = _capture_candidate

    monkeypatch.setattr(
        backend_main,
        "_build_rtr_request_bundle",
        lambda req_payload: fake_bundle,
    )
    monkeypatch.setitem(
        sys.modules,
        "model_informed_greenhouse_dashboard.backend.app.services.rtr.scenario_runner",
        fake_scenario_module,
    )
    monkeypatch.setitem(
        sys.modules,
        "model_informed_greenhouse_dashboard.backend.app.services.rtr.objective_terms",
        fake_objective_terms,
    )

    client = TestClient(get_app())
    response = client.post(
        "/api/rtr/scenario",
        json={
            "crop": "tomato",
            "target_node_development_per_day": 0.64,
            "optimization_mode": "balanced",
            "include_energy_cost": True,
            "include_labor_cost": True,
            "user_actual_area_m2": 1200,
            "custom_scenario": {
                "label": "fan-off",
                "day_heating_min_temp_C": 20.1,
                "night_heating_min_temp_C": 18.7,
                "circulation_fan_pct": 0,
            },
        },
    )

    assert response.status_code == 200
    payload = response.json()
    assert captured["circulation_fan_pct"] == 0.0
    assert payload["scenarios"][-1]["label"] == "fan-off"
    assert payload["scenarios"][-1]["circulation_fan_pct"] == 0.0


def test_rtr_calibration_state_and_preview_routes_return_house_scoped_windows(
    monkeypatch,
) -> None:
    backend_main = _backend_main()
    original_df_env = backend_main.app_state["tomato"].get("df_env")
    backend_main.app_state["tomato"]["df_env"] = _build_calibration_env_df()
    try:
        client = TestClient(get_app())
        state_response = client.get(
            "/api/rtr/calibration-state",
            params={"crop": "tomato", "greenhouse_id": "house-a"},
        )
        preview_response = client.post(
            "/api/rtr/calibration-preview",
            json={
                "crop": "tomato",
                "greenhouse_id": "house-a",
                "selection_mode": "windows-only",
                "windows": [
                    {
                        "label": "house-a-april-window",
                        "startDate": "2026-04-01",
                        "endDate": "2026-04-06",
                        "enabled": True,
                        "approvalStatus": "grower-approved",
                        "approvalSource": "lead-grower",
                        "approvalReason": "stable harvest and internode rhythm",
                        "evidenceNotes": "quality and vigor were both acceptable",
                    }
                ],
            },
        )

        assert state_response.status_code == 200
        state_payload = state_response.json()
        assert state_payload["status"] == "success"
        assert state_payload["crop"] == "Tomato"
        assert state_payload["environment_summary"]["has_environment_history"] is True
        assert state_payload["environment_summary"]["total_days"] == 7

        assert preview_response.status_code == 200
        preview_payload = preview_response.json()
        assert preview_payload["status"] == "success"
        assert preview_payload["preview_profile"]["calibration"]["mode"] == "fitted"
        assert preview_payload["selection_summary"]["selection_source"] == "curated-windows"
        assert preview_payload["selection_summary"]["window_count"] == 1
        assert preview_payload["windows"][0]["houseId"] == "house-a"
    finally:
        backend_main.app_state["tomato"]["df_env"] = original_df_env


def test_rtr_calibration_save_route_persists_windows_and_refreshes_profile(
    monkeypatch,
    tmp_path,
) -> None:
    from model_informed_greenhouse_dashboard.backend.app.services import rtr_profiles

    backend_main = _backend_main()
    original_df_env = backend_main.app_state["cucumber"].get("df_env")
    backend_main.app_state["cucumber"]["df_env"] = _build_calibration_env_df()
    windows_path = tmp_path / "rtr_good_windows.yaml"
    profiles_path = tmp_path / "rtr_profiles.json"
    monkeypatch.setattr(rtr_profiles, "rtr_good_windows_path", lambda config_path=None: windows_path)
    monkeypatch.setattr(rtr_profiles, "rtr_profiles_path", lambda config_path=None: profiles_path)
    try:
        client = TestClient(get_app())
        save_response = client.post(
            "/api/rtr/calibration-save",
            json={
                "crop": "cucumber",
                "greenhouse_id": "house-a",
                "selection_mode": "windows-only",
                "windows": [
                    {
                        "label": "house-a-spring-window",
                        "startDate": "2026-04-01",
                        "endDate": "2026-04-06",
                        "enabled": True,
                        "approvalStatus": "grower-approved",
                        "approvalSource": "grower-team",
                        "approvalReason": "balanced source sink with stable harvest",
                        "evidenceNotes": "leaf area and harvest both stayed in range",
                    }
                ],
            },
        )
        profiles_response = client.get("/api/rtr/profiles")

        assert save_response.status_code == 200
        save_payload = save_response.json()
        assert save_payload["saved"] is True
        assert save_payload["current_profile"]["calibration"]["mode"] == "fitted"
        assert save_payload["windows"][0]["houseId"] == "house-a"
        assert windows_path.exists()
        assert profiles_path.exists()

        persisted_windows = rtr_profiles.load_rtr_good_windows(windows_path)
        house_windows = rtr_profiles.filter_rtr_good_windows_for_house(
            persisted_windows,
            "cucumber",
            "house-a",
        )
        persisted_profiles = rtr_profiles.load_rtr_profiles(profiles_path)

        assert [window["label"] for window in house_windows] == ["house-a-spring-window"]
        assert persisted_profiles["profiles"]["Cucumber"]["calibration"]["mode"] == "fitted"
        assert profiles_response.status_code == 200
        assert profiles_response.json()["profiles"]["Cucumber"]["calibration"]["mode"] == "fitted"
    finally:
        backend_main.app_state["cucumber"]["df_env"] = original_df_env
