"""Simulation orchestrator managing model execution and state."""

import logging
import math
from datetime import datetime
from typing import Any, Callable, Dict, List

import pandas as pd

from ..adapters.base import (
    ModelAdapter,
    environment_quality,
    finite_number,
    model_output_is_valid,
)
from .ingest import normalize_environment_frame

logger = logging.getLogger(__name__)

MIN_SIM_SECONDS_PER_REAL_SECOND = 1.0
MAX_SIM_SECONDS_PER_REAL_SECOND = 86400.0
LEGACY_REAL_SECONDS_PER_STEP = 0.1


class Simulator:
    """Orchestrates model execution with replay and speed control."""

    def __init__(
        self,
        adapter: ModelAdapter,
        broadcaster: Callable[[str, Dict[str, Any]], None],
        df_env: pd.DataFrame,
        irrigation_advisor=None,
        energy_estimator=None,
        greenhouse_config=None,
        operations_config=None,
        dt_hours: float = 1.0,
        step_sim_duration_seconds: float | None = None,
        sim_seconds_per_real_second: float | None = None,
    ):
        """Initialize simulator.

        Args:
            adapter: Crop model adapter (tomato/cucumber)
            broadcaster: Function to broadcast results (path, payload)
            df_env: Full environment DataFrame for replay
            irrigation_advisor: Optional IrrigationAdvisor instance
            energy_estimator: Optional EnergyEstimator instance
            greenhouse_config: Optional greenhouse configuration dict
            operations_config: Optional crop-scoped operational settings
            dt_hours: Timestep duration in hours
            step_sim_duration_seconds: Simulated seconds advanced by one stream step
            sim_seconds_per_real_second: Simulated seconds advanced per real second
        """
        self.adapter = adapter
        self.broadcast = broadcaster
        self.df_env = normalize_environment_frame(df_env)
        self.irrigation_advisor = irrigation_advisor
        self.energy_estimator = energy_estimator
        self.greenhouse_config = greenhouse_config
        self.operations_config = operations_config or {}
        self.dt_hours = dt_hours
        self.step_sim_duration_seconds = max(
            1.0,
            float(
                step_sim_duration_seconds
                if step_sim_duration_seconds is not None
                else dt_hours * 3600.0
            ),
        )

        self.idx = 0  # Next unprocessed environment row.
        self.running = False
        self.paused = False
        self.speed = 1.0  # Speed multiplier (1.0 = real-time, 10.0 = 10x)
        self.sim_seconds_per_real_second = self._clamp_sim_seconds_per_real_second(
            sim_seconds_per_real_second
            if sim_seconds_per_real_second is not None
            else self._legacy_speed_to_sim_seconds_per_real_second(self.speed)
        )

        logger.info(f"Initialized Simulator with {len(self.df_env)} rows")

    def start(self):
        """Start simulation."""
        self.running = True
        self.paused = False
        logger.info("Simulator started")

    def stop(self):
        """Stop simulation."""
        self.running = False
        logger.info("Simulator stopped")

    def pause(self):
        """Pause simulation."""
        self.paused = True
        logger.info("Simulator paused")

    def resume(self):
        """Resume simulation."""
        self.paused = False
        logger.info("Simulator resumed")

    @staticmethod
    def _clamp_sim_seconds_per_real_second(value: float) -> float:
        return max(
            MIN_SIM_SECONDS_PER_REAL_SECOND,
            min(MAX_SIM_SECONDS_PER_REAL_SECOND, float(value)),
        )

    def _legacy_speed_to_sim_seconds_per_real_second(self, speed: float) -> float:
        return self._clamp_sim_seconds_per_real_second(
            self.step_sim_duration_seconds * float(speed) / LEGACY_REAL_SECONDS_PER_STEP
        )

    def set_speed(self, speed: float) -> float:
        """Set simulation speed multiplier.

        Args:
            speed: Speed multiplier (1.0 = real-time, 10.0 = 10x)
        """
        speed_value = float(speed)
        if not math.isfinite(speed_value):
            speed_value = 1.0

        self.speed = max(0.1, min(100.0, speed_value))
        self.sim_seconds_per_real_second = (
            self._legacy_speed_to_sim_seconds_per_real_second(self.speed)
        )
        logger.info(
            "Simulator speed set to %sx (%s sim seconds per real second)",
            self.speed,
            self.sim_seconds_per_real_second,
        )
        return self.sim_seconds_per_real_second

    def set_sim_seconds_per_real_second(self, value: float) -> float:
        """Set absolute simulation pacing in simulated seconds per real second."""
        pace = float(value)
        if not math.isfinite(pace) or pace <= 0:
            raise ValueError("sim_seconds_per_real_second must be finite and positive")

        self.sim_seconds_per_real_second = self._clamp_sim_seconds_per_real_second(pace)
        equivalent_speed = (
            self.sim_seconds_per_real_second
            * LEGACY_REAL_SECONDS_PER_STEP
            / max(self.step_sim_duration_seconds, 1e-9)
        )
        self.speed = max(0.1, min(100.0, equivalent_speed))
        logger.info(
            "Simulator pace set to %s sim seconds per real second",
            self.sim_seconds_per_real_second,
        )
        return self.sim_seconds_per_real_second

    def step(self, row: Dict[str, Any]) -> Dict[str, Any]:
        """Execute one simulation step.

        Args:
            row: Environmental data dict

        Returns:
            Full payload including state, fluxes, KPIs, irrigation, energy
        """
        try:
            # The adapter uses this interval only until a previous timestamp exists.
            model_row = {**row, "dt_seconds": self.step_sim_duration_seconds}
            result = self.adapter.step(model_row)
            quality = environment_quality(row)
            result["data_quality"] = quality
            result.setdefault("source", "model_prediction")
            valid = model_output_is_valid(result)
            duration_seconds = finite_number(result.get("dt_seconds"))
            valid = valid and duration_seconds is not None and duration_seconds > 0
            if quality["status"] == "invalid":
                result["simulation_status"] = "invalid_input"
            elif not valid and result.get("simulation_status", "ok") == "ok":
                result["simulation_status"] = "failed"
            else:
                result.setdefault("simulation_status", "ok")

            # Calculate KPIs
            kpi = self.adapter.kpis(result) if valid else {}

            # Parse datetime from row
            dt = (
                datetime.fromisoformat(row["datetime"])
                if isinstance(row["datetime"], str)
                else row["datetime"]
            )

            # Calculate VPD
            T_air = finite_number(row.get("T_air_C"))
            RH = finite_number(row.get("RH_percent"))
            vpd = None
            if T_air is not None and RH is not None and quality["status"] == "ok":
                svp = 0.61078 * math.exp((17.27 * T_air) / (T_air + 237.3))
                vpd = svp * (1 - RH / 100.0)

            # Build base payload
            payload = {
                "t": result["datetime"],
                "crop": self.adapter.name,
                "kpi": kpi,
                "data_quality": quality,
                "env": {
                    "T_air_C": T_air,
                    "PAR_umol": finite_number(row.get("PAR_umol")),
                    "CO2_ppm": finite_number(row.get("CO2_ppm")),
                    "RH_percent": RH,
                    "wind_speed_ms": finite_number(row.get("wind_speed_ms")),
                    "VPD_kPa": vpd,
                },
                "flux": {
                    "H_W_m2": result.get("H_W_m2", 0),
                    "LE_W_m2": result.get("LE_W_m2", 0),
                    "transpiration_g_m2": result.get("transpiration_g_m2", 0),
                    "transpiration_mm": result.get(
                        "transpiration_mm", result.get("transpiration_g_m2", 0) / 1000
                    ),
                    "co2_flux_g_m2_s": result.get("co2_flux_g_m2_s", 0),
                    "net_assimilation_umol_m2_s": result.get(
                        "net_assimilation_umol_m2_s", 0
                    ),
                    "gross_photosynthesis_umol_m2_s": result.get(
                        "gross_photosynthesis_umol_m2_s", 0
                    ),
                    "stomatal_conductance_m_s": result.get(
                        "stomatal_conductance_m_s", 0
                    ),
                },
                "state": result,
            }
            outside_temperature = finite_number(row.get("T_out_C"))
            if outside_temperature is not None:
                payload["env"]["T_out_C"] = outside_temperature

            # Failed states remain visible as diagnostics, without derived advice.
            if not valid:
                payload["irrigation"] = {}
                payload["energy"] = {}
                return payload

            # Calculate Stomatal Conductance in mmol m^-2 s^-1
            try:
                P_AIR = 101325.0  # Pa
                R_GAS = 8.314  # J mol^-1 K^-1
                canopy_T_C = float(result.get("T_canopy_C", T_air))
                T_K = canopy_T_C + 273.15
                sc_ms = float(result.get("stomatal_conductance_m_s", 0.0))
                sc_mol = sc_ms * P_AIR / max(1e-9, (R_GAS * T_K))  # mol m^-2 s^-1
                payload["flux"]["stomatal_conductance_mol_m2_s"] = sc_mol

                # Add to KPI for frontend compatibility
                payload["kpi"]["stomatal_conductance"] = sc_mol
            except Exception:
                payload["flux"]["stomatal_conductance_mol_m2_s"] = 0.0
                payload["kpi"]["stomatal_conductance"] = 0.0

            # Calculate Transpiration in mm/h
            try:
                trans_g_m2 = float(result.get("transpiration_g_m2", 0.0))
                # g/m2 = mL/m2. 1 mL/m2 = 0.001 L/m2 = 0.001 mm.
                trans_mm = trans_g_m2 / 1000.0
                # Convert to hourly rate
                trans_mm_h = trans_mm / (duration_seconds / 3600.0)
                payload["kpi"]["transpiration_mm_h"] = trans_mm_h
            except Exception:
                payload["kpi"]["transpiration_mm_h"] = 0.0

            # Add irrigation advice if available
            if self.irrigation_advisor:
                payload["irrigation"] = self.irrigation_advisor.update_step(result, dt)
            else:
                payload["irrigation"] = {}

            # Add energy estimate if available
            if self.energy_estimator and self.greenhouse_config:
                ops_config = self.operations_config or self.greenhouse_config.get(
                    "operations", {}
                )
                outside_assumed = outside_temperature is None
                if outside_assumed:
                    outside_temperature = T_air - 5.0
                payload["energy"] = self.energy_estimator.estimate_step(
                    state=result,
                    env=payload["env"],
                    setpoints={
                        "heating_set_C": ops_config.get("heating_set_C", 18),
                        "cooling_set_C": ops_config.get("cooling_set_C", 25),
                        "T_out_C": outside_temperature,
                    },
                    dt=dt,
                    dt_hours=duration_seconds / 3600.0,
                )
                payload["energy"].update({
                    "source": "model_estimate",
                    "T_out_C": outside_temperature,
                    "T_out_C_source": (
                        "assumed_indoor_minus_5C" if outside_assumed else "csv_replay"
                    ),
                    "assumptions": (
                        ["외기온 자료가 없어 실내 기온보다 5°C 낮다고 가정했습니다."]
                        if outside_assumed else []
                    ),
                })
            else:
                payload["energy"] = {}

            return payload

        except Exception as e:
            logger.error(f"Simulator.step() error: {e}", exc_info=True)
            return self._fallback_payload(row)

    def step_from_index(self, i: int) -> Dict[str, Any]:
        """Execute row i and advance idx to the next unprocessed row.

        Args:
            i: Row index in df_env

        Returns:
            Simulation payload
        """
        if i < 0 or i >= len(self.df_env):
            logger.warning(f"Index {i} out of bounds (max {len(self.df_env)-1})")
            return {}

        row = self.df_env.iloc[i].to_dict()
        payload = self.step(row)
        self.idx = i + 1

        return payload

    def run_all(self):
        """Continue simulation from the next unprocessed row."""
        logger.info(f"Running simulation for {len(self.df_env)} rows...")

        while self.running and self.idx < len(self.df_env):
            while self.paused and self.running:
                # Wait while paused
                import time

                time.sleep(0.1)

            if not self.running or self.idx >= len(self.df_env):
                break

            self.step_from_index(self.idx)

            if self.idx % 100 == 0:
                logger.info(f"Processed {self.idx}/{len(self.df_env)} rows...")

        logger.info("Simulation run completed")

    def _fallback_payload(self, row: Dict[str, Any]) -> Dict[str, Any]:
        """Return safe fallback payload on error."""
        quality = environment_quality(row)
        return {
            "t": row.get("datetime", datetime.now().isoformat()),
            "crop": self.adapter.name,
            "kpi": {},
            "data_quality": quality,
            "env": {
                "T_air_C": finite_number(row.get("T_air_C")),
                "PAR_umol": finite_number(row.get("PAR_umol")),
                "CO2_ppm": finite_number(row.get("CO2_ppm")),
                "RH_percent": finite_number(row.get("RH_percent")),
                "wind_speed_ms": finite_number(row.get("wind_speed_ms")),
            },
            "flux": {
                "H_W_m2": 0,
                "LE_W_m2": 0,
                "transpiration_g_m2": 0,
                "co2_flux_g_m2_s": 0,
            },
            "state": {
                "datetime": row.get("datetime"),
                "LAI": 0,
                "T_canopy_C": finite_number(row.get("T_air_C")),
                "fractional_cover": 0,
                "converged": 0,
                "dt_seconds": 0,
                "simulation_status": "failed",
                "source": "model_prediction",
                "data_quality": quality,
            },
            "irrigation": {},
            "energy": {},
        }

    def get_future_rows(self, hours: int = 168) -> List[Dict[str, Any]]:
        """Get future environment rows for forecasting.

        Args:
            hours: Number of hours to look ahead (default 7 days)

        Returns:
            List of environment data rows
        """
        if self.idx >= len(self.df_env) or hours <= 0:
            return []

        future = self.df_env.iloc[self.idx:]
        last_datetime = getattr(self.adapter, "_last_datetime", None)
        if last_datetime is not None:
            future = future[future["datetime"] > last_datetime]
        if future.empty:
            return []
        start = pd.Timestamp(last_datetime or future.iloc[0]["datetime"])
        end = start + pd.Timedelta(hours=hours)
        return future[future["datetime"] <= end].to_dict("records")

    def reset(self):
        """Reset simulation to beginning."""
        self.idx = 0
        self.adapter.reset()
        logger.info("Simulator reset")
