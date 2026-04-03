"""Energy consumption estimation service for HVAC systems."""
import logging
from typing import Dict, Any
from datetime import datetime
import numpy as np

logger = logging.getLogger(__name__)


class EnergyEstimator:
    """Estimates heating/cooling energy consumption for greenhouse."""
    
    def __init__(self,
                 area_m2: float = 3305.8,
                 height_m: float = 6.0,
                 u_value: float = 5.0,
                 ach: float = 0.3,
                 cop_curve: Dict[float, float] = None,
                 cop_cooling: float = 3.2):
        """Initialize energy estimator.
        
        Args:
            area_m2: Greenhouse floor area
            height_m: Average effective height
            u_value: Envelope U-value (W/m²·K)
            ach: Air changes per hour
            cop_curve: Heating COP curve {T_out_C: COP}
            cop_cooling: Cooling COP/EER
        """
        self.area_m2 = area_m2
        self.volume_m3 = area_m2 * height_m
        self.u_value = u_value
        self.ach = ach
        self.cop_cooling = cop_cooling
        
        # Default COP curve
        if cop_curve is None:
            cop_curve = {-5: 2.6, 0: 3.0, 5: 3.2, 10: 3.6, 15: 3.8}
        self.cop_curve = cop_curve
        
        # Constants
        self.rho_a = 1.225  # kg/m³
        self.c_p = 1004  # J/kg·K
        
        self._daily_cache = {
            'date': None,
            'kWh_sum': 0.0,
        }
        
        logger.info(f"Initialized EnergyEstimator (area={area_m2}m², volume={self.volume_m3}m³)")
    
    def estimate_step(self,
                      state: Dict[str, Any],
                      env: Dict[str, Any],
                      setpoints: Dict[str, float],
                      dt: datetime,
                      dt_hours: float = 1.0) -> Dict[str, Any]:
        """Estimate energy for current timestep.
        
        Args:
            state: Simulation state with H (sensible heat flux)
            env: Environmental data with T_air_C
            setpoints: {'heating_set_C', 'cooling_set_C', 'T_out_C'}
            dt: Current datetime
            dt_hours: Timestep duration in hours
        
        Returns:
            Dict with Q_load_kW, P_elec_kW, COP_current, daily_kWh
        """
        T_in = env.get('T_air_C', 20)
        T_out = setpoints.get('T_out_C', T_in - 5)  # Assume outdoor is 5°C cooler (placeholder)
        T_heat_set = setpoints.get('heating_set_C', 18)
        T_cool_set = setpoints.get('cooling_set_C', 26)
        
        # Crop sensible heat (negative = heat removed by crop)
        H_crop = state.get('H_W_m2', 0) * self.area_m2 / 1000  # kW
        
        # Determine mode
        if T_in < T_heat_set:
            # Heating mode
            Q_trans = self.u_value * self.area_m2 * (T_heat_set - T_out) / 1000  # kW
            Q_vent = (self.rho_a * self.c_p * self.ach * self.volume_m3 * 
                     (T_heat_set - T_out) / 3600) / 1000  # kW
            Q_load = Q_trans + Q_vent - H_crop  # Crop reduces heating load
            Q_load = max(0, Q_load)
            
            COP = self._get_cop_heating(T_out)
            P_elec = Q_load / COP if COP > 0 else 0
            
        elif T_in > T_cool_set:
            # Cooling mode
            Q_load = abs(H_crop)  # Simplified: crop heat must be removed
            COP = self.cop_cooling
            P_elec = Q_load / COP if COP > 0 else 0
            
        else:
            # No HVAC operation
            Q_load = 0
            COP = 0
            P_elec = 0
        
        # Accumulate daily kWh
        current_date = dt.date() if isinstance(dt, datetime) else dt
        if self._daily_cache['date'] != current_date:
            self._daily_cache = {'date': current_date, 'kWh_sum': 0.0}
            logger.info(f"EnergyEstimator: New day {current_date}, reset cache")
        
        kWh_step = P_elec * dt_hours
        self._daily_cache['kWh_sum'] += kWh_step
        
        return {
            'Q_load_kW': round(Q_load, 2),
            'P_elec_kW': round(P_elec, 2),
            'COP_current': round(COP, 2),
            'daily_kWh': round(self._daily_cache['kWh_sum'], 2),
            'mode': 'heating' if T_in < T_heat_set else ('cooling' if T_in > T_cool_set else 'off'),
        }
    
    def _get_cop_heating(self, T_out: float) -> float:
        """Get heating COP from curve (linear interpolation).
        
        Args:
            T_out: Outdoor temperature (°C)
        
        Returns:
            COP value
        """
        temps = sorted(self.cop_curve.keys())
        cops = [self.cop_curve[t] for t in temps]
        
        # Clamp to curve range
        if T_out <= temps[0]:
            return cops[0]
        if T_out >= temps[-1]:
            return cops[-1]
        
        # Linear interpolation
        return float(np.interp(T_out, temps, cops))
    
    def reset_daily(self):
        """Reset daily accumulation."""
        self._daily_cache = {'date': None, 'kWh_sum': 0.0}
        logger.info("EnergyEstimator daily cache reset")

