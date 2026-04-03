"""Simulation orchestrator managing model execution and state."""

import logging
from datetime import datetime
from typing import Any, Callable, Dict, List

import pandas as pd

from ..adapters.base import ModelAdapter

logger = logging.getLogger(__name__)


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
        """
        self.adapter = adapter
        self.broadcast = broadcaster
        self.df_env = df_env.sort_values("datetime").reset_index(drop=True)
        self.irrigation_advisor = irrigation_advisor
        self.energy_estimator = energy_estimator
        self.greenhouse_config = greenhouse_config
        self.operations_config = operations_config or {}
        self.dt_hours = dt_hours

        self.idx = 0
        self.running = False
        self.paused = False
        self.speed = 1.0  # Speed multiplier (1.0 = real-time, 10.0 = 10x)

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

    def set_speed(self, speed: float):
        """Set simulation speed multiplier.

        Args:
            speed: Speed multiplier (1.0 = real-time, 10.0 = 10x)
        """
        self.speed = max(0.1, min(100.0, speed))
        logger.info(f"Simulator speed set to {self.speed}x")

    def step(self, row: Dict[str, Any]) -> Dict[str, Any]:
        """Execute one simulation step.

        Args:
            row: Environmental data dict

        Returns:
            Full payload including state, fluxes, KPIs, irrigation, energy
        """
        try:
            # Run model step
            result = self.adapter.step(row)

            # Calculate KPIs
            kpi = self.adapter.kpis(result)

            # Parse datetime from row
            dt = (
                datetime.fromisoformat(row["datetime"])
                if isinstance(row["datetime"], str)
                else row["datetime"]
            )

            # Calculate VPD
            T_air = row.get("T_air_C", 20)
            RH = row.get("RH_percent", 50)
            svp = 0.61078 * 2.71828 ** ((17.27 * T_air) / (T_air + 237.3))
            vpd = svp * (1 - RH / 100.0)

            # Build base payload
            payload = {
                "t": result["datetime"],
                "crop": self.adapter.name,
                "kpi": kpi,
                "env": {
                    "T_air_C": T_air,
                    "PAR_umol": row.get("PAR_umol", 0),
                    "CO2_ppm": row.get("CO2_ppm", 400),
                    "RH_percent": RH,
                    "VPD_kPa": float(vpd),
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
                trans_mm_h = trans_mm / max(1e-6, self.dt_hours)
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
                payload["energy"] = self.energy_estimator.estimate_step(
                    state=result,
                    env=payload["env"],
                    setpoints={
                        "heating_set_C": ops_config.get("heating_set_C", 18),
                        "cooling_set_C": ops_config.get("cooling_set_C", 25),
                        "T_out_C": payload["env"]["T_air_C"] - 5,  # Placeholder
                    },
                    dt=dt,
                    dt_hours=self.dt_hours,
                )
            else:
                payload["energy"] = {}

            return payload

        except Exception as e:
            logger.error(f"Simulator.step() error: {e}", exc_info=True)
            return self._fallback_payload(row)

    def step_from_index(self, i: int) -> Dict[str, Any]:
        """Execute step using row at index i.

        Args:
            i: Row index in df_env

        Returns:
            Simulation payload
        """
        if i >= len(self.df_env):
            logger.warning(f"Index {i} out of bounds (max {len(self.df_env)-1})")
            return {}

        row = self.df_env.iloc[i].to_dict()
        payload = self.step(row)
        self.idx = i

        return payload

    def run_all(self):
        """Run simulation for all rows in sequence."""
        logger.info(f"Running simulation for {len(self.df_env)} rows...")

        for i in range(len(self.df_env)):
            if not self.running:
                logger.info("Simulation stopped by user")
                break

            while self.paused:
                # Wait while paused
                import time

                time.sleep(0.1)

            self.step_from_index(i)

            if (i + 1) % 100 == 0:
                logger.info(f"Processed {i+1}/{len(self.df_env)} rows...")

        logger.info("Simulation run completed")

    def _fallback_payload(self, row: Dict[str, Any]) -> Dict[str, Any]:
        """Return safe fallback payload on error."""
        return {
            "t": row.get("datetime", datetime.now().isoformat()),
            "crop": self.adapter.name,
            "kpi": {},
            "env": {
                "T_air_C": row.get("T_air_C", 20),
                "PAR_umol": row.get("PAR_umol", 0),
                "CO2_ppm": row.get("CO2_ppm", 400),
                "RH_percent": row.get("RH_percent", 50),
            },
            "flux": {
                "H_W_m2": 0,
                "LE_W_m2": 0,
                "transpiration_g_m2": 0,
                "co2_flux_g_m2_s": 0,
            },
            "state": {
                "LAI": 0,
                "T_canopy_C": row.get("T_air_C", 20),
                "fractional_cover": 0,
                "converged": 0,
            },
        }

    def get_future_rows(self, hours: int = 168) -> List[Dict[str, Any]]:
        """Get future environment rows for forecasting.

        Args:
            hours: Number of hours to look ahead (default 7 days)

        Returns:
            List of environment data rows
        """
        if self.idx >= len(self.df_env):
            return []

        # Calculate number of steps (assuming 10-min intervals in CSV)
        # This is an approximation; ideally we check timestamps
        steps = hours * 6

        start_idx = self.idx
        end_idx = min(start_idx + steps, len(self.df_env))

        if start_idx >= end_idx:
            return []

        # Return list of dicts
        return self.df_env.iloc[start_idx:end_idx].to_dict("records")

    def reset(self):
        """Reset simulation to beginning."""
        self.idx = 0
        self.adapter.reset()
        logger.info("Simulator reset")
