"""Cucumber model adapter wrapping CucumberModel."""

import copy
import logging
from typing import Any, Dict, List
from datetime import datetime

from model_informed_greenhouse_dashboard.models.legacy.CucumberModel import (
    CucumberModel,
)
from .base import ModelAdapter

logger = logging.getLogger(__name__)


class CucumberAdapter(ModelAdapter):
    """Adapter for CucumberModel (node-based growth)."""

    name = "cucumber"
    version = "1.0.0"

    def __init__(self, area_m2: float = 3305.8, plant_density: float = 1.72):
        """Initialize cucumber model adapter.

        Args:
            area_m2: Greenhouse area in square meters
            plant_density: Plants per square meter
        """
        self.area_m2 = area_m2
        self.plant_density = plant_density
        self.model = CucumberModel()
        self._last_state = None
        self._last_datetime = None
        self._init_statistics()
        logger.info(
            f"Initialized CucumberAdapter (area={area_m2} m², density={plant_density} plants/m²)"
        )

    def reset(self) -> None:
        """Reset model to initial state."""
        self.model = CucumberModel()
        self._last_state = None
        self._last_datetime = None
        self._init_statistics()
        logger.info("CucumberAdapter reset")

    def _init_statistics(self) -> None:
        """Initialize/reset daily statistics."""
        self._daily_cache = {
            "date": None,
            "transpiration_sum": 0.0,
            "fruit_dw_start_g_m2": 0.0,
            "daily_fruit_dw_g_m2": 0.0,
        }
        self._previous_day = {
            "fruit_growth_g_m2": 0.0,
            "transpiration_mm": 0.0,
        }
        self._cumulative = {
            "total_transpiration_mm": 0.0,
        }
        # Leaf pruning baseline for manual tracking
        self._leaf_prune_baseline = float(getattr(self.model, "remaining_leaves", 0))

    def step(self, row: Dict[str, Any]) -> Dict[str, Any]:
        """Execute one simulation timestep.

        Args:
            row: Environmental data with datetime, T_air_C, PAR_umol, etc.

        Returns:
            State dict with common + cucumber-specific variables
        """
        try:
            # Parse datetime
            if isinstance(row["datetime"], str):
                dt = datetime.fromisoformat(row["datetime"].replace("Z", "+00:00"))
            else:
                dt = row["datetime"]

            # Calculate timestep (default 3600s for hourly data)
            if self._last_datetime is not None:
                delta_s = (dt - self._last_datetime).total_seconds()
            else:
                delta_s = 3600.0  # Assume 1 hour for first step

            # Update model inputs from row (CucumberModel expects specific names)
            self.model.T_a = row["T_air_C"] + 273.15  # Convert to Kelvin
            self.model.u_PAR = row["PAR_umol"]
            self.model.u_CO2 = row["CO2_ppm"]
            self.model.RH = row["RH_percent"] / 100.0  # Convert to 0-1 range
            self.model.u = row["wind_speed_ms"]

            # Calculate intercellular CO2 (70% of ambient)
            self.model.Ci = self.model.u_CO2 * 0.7

            # Cucumber-specific: pruning threshold, target leaf count
            if "pruning_threshold" in row:
                self.model.pruning_threshold = row["pruning_threshold"]
            if "target_leaf_count" in row:
                self.model.target_leaf_count = row["target_leaf_count"]

            # Run timestep calculation
            self.model.run_timestep_calculations(delta_s, dt)

            # Extract output state
            state = self._extract_state(dt, row, delta_s)

            # Update daily cache
            self._update_daily_cache(state, dt)

            self._last_state = state
            self._last_datetime = dt

            return state

        except Exception as e:
            logger.error(f"CucumberAdapter.step() error: {e}", exc_info=True)
            # Return safe fallback state
            return self._fallback_state(row)

    def _extract_state(
        self, dt: datetime, row: Dict[str, Any], dt_seconds: float
    ) -> Dict[str, Any]:
        """Extract state from model into standardized dict, including env inputs."""
        m = self.model

        # Calculate transpiration from LE (latent heat)
        # LE (W/m²) / lambda_v (J/kg) * 1000 (g/kg) = transpiration rate (g/m²/s)
        lambda_v = getattr(m, "lambda_v", 2.45e6)  # J/kg
        transpiration_rate_g_s_m2 = (m.LE / lambda_v * 1000) if lambda_v > 0 else 0.0
        model_dt = getattr(m, "dt_seconds", 0)
        # Use provided dt_seconds if model_dt is missing
        if model_dt is None or model_dt <= 0:
            model_dt = dt_seconds if dt_seconds > 0 else 3600.0
        transpiration_g_m2 = transpiration_rate_g_s_m2 * model_dt
        transpiration_mm = transpiration_g_m2 / 1000.0

        co2_flux_g_m2_s = float(getattr(m, "co2_flux_g_m2_s", 0))
        net_assim_umol_m2_s = co2_flux_g_m2_s / 44.01 * 1e6

        gross_photosynthesis_umol_m2_s = 0.0
        gsw_from_calc = None
        try:
            gross_photosynthesis_umol_m2_s, _, gsw_from_calc = (
                m.calculate_canopy_photosynthesis(m.T_c)
            )
        except Exception:
            gross_photosynthesis_umol_m2_s = 0.0
            gsw_from_calc = None

        # Common variables
        state = {
            "datetime": dt.isoformat(),
            "LAI": float(m.LAI),
            "T_canopy_C": float(m.T_c - 273.15),  # Convert from Kelvin
            "H_W_m2": float(m.H),
            "LE_W_m2": float(m.LE),
            "transpiration_g_m2": float(transpiration_g_m2),
            "transpiration_mm": float(transpiration_mm),
            "co2_flux_g_m2_s": co2_flux_g_m2_s,
            "net_assimilation_umol_m2_s": float(net_assim_umol_m2_s),
            "gross_photosynthesis_umol_m2_s": float(gross_photosynthesis_umol_m2_s),
            "fractional_cover": float(
                m.f_c if hasattr(m, "f_c") else min(1.0, m.LAI / 3.0)
            ),
            "converged": int(
                getattr(
                    m,
                    "convergence_status_Tc",
                    getattr(m, "energy_balance_converged", 1),
                )
            ),
            # Echo environmental inputs for downstream aggregation/forecast
            "T_air_C": float(row.get("T_air_C", m.T_a - 273.15)),
            "PAR_umol": float(row.get("PAR_umol", getattr(m, "u_PAR", 0))),
            "CO2_ppm": float(row.get("CO2_ppm", getattr(m, "u_CO2", 0))),
            "RH_percent": float(row.get("RH_percent", getattr(m, "RH", 0) * 100)),
            "wind_speed_ms": float(row.get("wind_speed_ms", getattr(m, "u", 0))),
            "dt_seconds": float(model_dt),
            # Cucumber-specific
            "node_count": int(getattr(m, "nodes", getattr(m, "node_count", 0))),
            "fruit_dry_weight_g_m2": float(
                getattr(m, "fruit_dw", getattr(m, "fruit_dry_weight_g_m2", 0))
            ),
            "vegetative_dry_weight_g_m2": float(
                getattr(m, "vegetative_dw", getattr(m, "vegetative_dry_weight_g_m2", 0))
            ),
            "total_dry_weight_g_m2": float(
                getattr(
                    m,
                    "total_dry_weight_g_m2",
                    getattr(m, "fruit_dw", 0) + getattr(m, "vegetative_dw", 0),
                )
            ),
            "leaf_count": int(
                getattr(m, "remaining_leaves", getattr(m, "leaf_count", 0))
            ),
            "pruning_threshold": int(getattr(m, "pruning_threshold", 18)),
            "target_leaf_count": int(getattr(m, "target_leaf_count", 15)),
            "leaf_since_prune": int(
                max(
                    0,
                    getattr(m, "remaining_leaves", getattr(m, "leaf_count", 0))
                    - int(round(self._leaf_prune_baseline)),
                )
            ),
        }

        # Derive canopy stomatal conductance (m/s) for charting
        gsw_canopy = float(getattr(m, "last_gsw_canopy", 0.0))
        if gsw_canopy <= 0:
            if gsw_from_calc is not None:
                gsw_canopy = gsw_from_calc
            else:
                try:
                    _, _, gsw_canopy = m.calculate_canopy_photosynthesis(m.T_c)
                except Exception:
                    gsw_canopy = 0.0
        state["stomatal_conductance_m_s"] = float(max(0.0, gsw_canopy))

        return state

    def _fallback_state(self, row: Dict[str, Any]) -> Dict[str, Any]:
        """Return safe fallback state on error."""
        return {
            "datetime": row["datetime"],
            "T_air_C": row.get("T_air_C", 0.0),
            "PAR_umol": row.get("PAR_umol", 0.0),
            "CO2_ppm": row.get("CO2_ppm", 0.0),
            "RH_percent": row.get("RH_percent", 0.0),
            "wind_speed_ms": row.get("wind_speed_ms", 0.0),
            "LAI": 0.0,
            "T_canopy_C": row["T_air_C"],
            "H_W_m2": 0.0,
            "LE_W_m2": 0.0,
            "transpiration_g_m2": 0.0,
            "transpiration_mm": 0.0,
            "co2_flux_g_m2_s": 0.0,
            "net_assimilation_umol_m2_s": 0.0,
            "gross_photosynthesis_umol_m2_s": 0.0,
            "dt_seconds": 0.0,
            "fractional_cover": 0.0,
            "converged": 0,
            "node_count": 0,
            "fruit_dry_weight_g_m2": 0.0,
            "vegetative_dry_weight_g_m2": 0.0,
            "total_dry_weight_g_m2": 0.0,
        }

    def _update_daily_cache(self, state: Dict[str, Any], dt: datetime) -> None:
        """Update daily accumulation cache."""
        current_date = dt.date()

        # Reset cache on new day
        if self._daily_cache["date"] != current_date:
            # Save previous day's data before resetting
            if self._daily_cache["date"] is not None:
                prev_growth_g_m2 = self._daily_cache.get("daily_fruit_dw_g_m2", 0)
                prev_transp_mm = self._daily_cache.get("transpiration_sum", 0) / 1000
                self._previous_day["fruit_growth_g_m2"] = prev_growth_g_m2
                self._previous_day["transpiration_mm"] = prev_transp_mm
                # Update cumulative
                self._cumulative["total_transpiration_mm"] += prev_transp_mm
                logger.info(
                    f"CucumberAdapter: End of day, fruit growth={prev_growth_g_m2:.2f} g/m², transp={prev_transp_mm:.2f} mm"
                )

            prev_state_fruit_dw = 0.0
            if self._last_state and "fruit_dry_weight_g_m2" in self._last_state:
                prev_state_fruit_dw = self._last_state["fruit_dry_weight_g_m2"]
            else:
                prev_state_fruit_dw = 0.0

            logger.info(
                f"CucumberAdapter: New day {current_date}, previous fruit DW={prev_state_fruit_dw:.2f} g/m²"
            )
            self._daily_cache = {
                "date": current_date,
                "transpiration_sum": 0.0,
                "fruit_dw_start_g_m2": prev_state_fruit_dw,  # Starting point for daily delta
                "daily_fruit_dw_g_m2": 0.0,
            }

        # Accumulate
        self._daily_cache["transpiration_sum"] += state["transpiration_g_m2"]
        # Also update cumulative transpiration continuously (mm)
        self._cumulative["total_transpiration_mm"] += (
            state["transpiration_g_m2"] / 1000.0
        )

        # Calculate daily growth increment
        fruit_dw_start = self._daily_cache.get("fruit_dw_start_g_m2", 0)
        self._daily_cache["daily_fruit_dw_g_m2"] = (
            state["fruit_dry_weight_g_m2"] - fruit_dw_start
        )

    def kpis(self, last_state: Dict[str, Any]) -> Dict[str, Any]:
        """Calculate KPIs for UI display.

        Returns:
            Dict with keys: node_count, LAI, daily_transpiration_mm,
                            fruit_dry_weight_g_m2, daily_fruit_growth_g_m2,
                            vegetative_dry_weight_g_m2
        """
        if last_state is None:
            last_state = self._last_state or {}

        # Daily transpiration (mm)
        daily_transp_mm = self._daily_cache.get("transpiration_sum", 0) / 1000

        # Daily fruit growth increment
        daily_fruit_dw_g_m2 = self._daily_cache.get("daily_fruit_dw_g_m2", 0)

        kpi = {
            "node_count": int(last_state.get("node_count", 0)),
            "LAI": round(last_state.get("LAI", 0), 2),
            "daily_transpiration_mm": round(daily_transp_mm, 2),
            "fruit_dry_weight_g_m2": round(
                last_state.get("fruit_dry_weight_g_m2", 0), 2
            ),
            "daily_fruit_growth_g_m2": round(
                daily_fruit_dw_g_m2, 3
            ),  # Today's fruit growth
            "vegetative_dry_weight_g_m2": round(
                last_state.get("vegetative_dry_weight_g_m2", 0), 2
            ),
            # Previous day data
            "previous_day_fruit_growth_g_m2": round(
                self._previous_day.get("fruit_growth_g_m2", 0), 3
            ),
            "previous_day_transpiration_mm": round(
                self._previous_day.get("transpiration_mm", 0), 2
            ),
            # Cumulative data
            "cumulative_transpiration_mm": round(
                self._cumulative.get("total_transpiration_mm", 0), 2
            ),
            # Leaf management data
            "leaf_count": int(last_state.get("leaf_count", 0)),
            "pruning_threshold": int(last_state.get("pruning_threshold", 18)),
            "target_leaf_count": int(last_state.get("target_leaf_count", 15)),
            "leaf_since_prune": int(last_state.get("leaf_since_prune", 0)),
        }

        return kpi

    def mark_pruned(self) -> None:
        """Mark a manual pruning event to reset leaf baseline."""
        if self._last_state:
            current_leaves = int(
                self._last_state.get(
                    "leaf_count", getattr(self.model, "remaining_leaves", 0)
                )
            )
        else:
            current_leaves = int(getattr(self.model, "remaining_leaves", 0))

        self._leaf_prune_baseline = float(current_leaves)
        logger.info(
            f"CucumberAdapter: Manual pruning recorded at {self._leaf_prune_baseline} leaves"
        )

    # ===== Snapshot / Restore for Branch Forecasting =====

    def dump_state(self) -> Dict[str, Any]:
        """Serialize model state."""
        try:
            state = copy.deepcopy(self.model.__dict__)
            # Remove non-serializable objects
            state.pop("logger", None)

            # Add adapter metadata
            adapter_meta = {
                "_adapter_meta": {
                    "last_datetime": (
                        self._last_datetime.isoformat() if self._last_datetime else None
                    ),
                    "last_state": copy.deepcopy(self._last_state),
                    "daily_cache": copy.deepcopy(self._daily_cache),
                    "previous_day": copy.deepcopy(self._previous_day),
                    "cumulative": copy.deepcopy(self._cumulative),
                    "leaf_prune_baseline": self._leaf_prune_baseline,
                    "area_m2": self.area_m2,
                    "plant_density": self.plant_density,
                }
            }
            state.update(adapter_meta)

            return state
        except Exception as e:
            logger.error(f"CucumberAdapter.dump_state() error: {e}")
            return {}

    def load_state(self, state: Dict[str, Any]) -> None:
        """Restore model state from snapshot."""
        try:
            # Extract adapter metadata
            meta = state.pop("_adapter_meta", {})
            if meta.get("last_datetime"):
                self._last_datetime = datetime.fromisoformat(meta["last_datetime"])
            self._last_state = meta.get("last_state")
            self._daily_cache = meta.get("daily_cache", {})
            self._previous_day = meta.get("previous_day", {})
            self._cumulative = meta.get("cumulative", {})
            self._leaf_prune_baseline = float(
                meta.get("leaf_prune_baseline", getattr(self.model, "remaining_leaves", 0))
            )
            self.area_m2 = meta.get("area_m2", self.area_m2)
            self.plant_density = meta.get("plant_density", self.plant_density)

            # Restore model state
            self.model.__dict__.update(copy.deepcopy(state))

            logger.info("CucumberAdapter state restored")
        except Exception as e:
            logger.error(f"CucumberAdapter.load_state() error: {e}")

    def run_batch(self, rows: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Run simulation for multiple timesteps."""
        results = []
        for row in rows:
            state = self.step(row)
            results.append(state)
        return results

    def configure(self, config: Dict[str, Any]) -> None:
        """Update model configuration."""
        if "area_m2" in config:
            self.area_m2 = config["area_m2"]
        if "plant_density" in config:
            self.plant_density = config["plant_density"]
        if "pruning_threshold" in config:
            self.model.pruning_threshold = config["pruning_threshold"]
        if "target_leaf_count" in config:
            self.model.target_leaf_count = config["target_leaf_count"]

        logger.info(f"CucumberAdapter configured: {config}")
