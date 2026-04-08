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
    
    def _estimate_step_core(self,
                            state: Dict[str, Any],
                            env: Dict[str, Any],
                            setpoints: Dict[str, float],
                            dt_hours: float = 1.0) -> Dict[str, Any]:
        """Pure energy-step calculation without touching the daily accumulator."""
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
        
        kWh_step = P_elec * dt_hours

        return {
            'Q_load_kW': round(Q_load, 2),
            'P_elec_kW': round(P_elec, 2),
            'COP_current': round(COP, 2),
            'kWh_step': round(kWh_step, 6),
            'mode': 'heating' if T_in < T_heat_set else ('cooling' if T_in > T_cool_set else 'off'),
        }

    def estimate_step(self,
                      state: Dict[str, Any],
                      env: Dict[str, Any],
                      setpoints: Dict[str, float],
                      dt: datetime,
                      dt_hours: float = 1.0) -> Dict[str, Any]:
        """Estimate energy for current timestep."""
        core = self._estimate_step_core(
            state=state,
            env=env,
            setpoints=setpoints,
            dt_hours=dt_hours,
        )

        # Accumulate daily kWh
        current_date = dt.date() if isinstance(dt, datetime) else dt
        if self._daily_cache['date'] != current_date:
            self._daily_cache = {'date': current_date, 'kWh_sum': 0.0}
            logger.info(f"EnergyEstimator: New day {current_date}, reset cache")
        
        self._daily_cache['kWh_sum'] += core['kWh_step']
        
        return {
            'Q_load_kW': core['Q_load_kW'],
            'P_elec_kW': core['P_elec_kW'],
            'COP_current': core['COP_current'],
            'daily_kWh': round(self._daily_cache['kWh_sum'], 2),
            'mode': core['mode'],
        }

    def estimate_step_stateless(self,
                                state: Dict[str, Any],
                                env: Dict[str, Any],
                                setpoints: Dict[str, float],
                                dt_hours: float = 1.0) -> Dict[str, Any]:
        """Estimate a step without mutating the daily cache."""
        core = self._estimate_step_core(
            state=state,
            env=env,
            setpoints=setpoints,
            dt_hours=dt_hours,
        )
        return {
            'Q_load_kW': core['Q_load_kW'],
            'P_elec_kW': core['P_elec_kW'],
            'COP_current': core['COP_current'],
            'daily_kWh': round(core['kWh_step'], 6),
            'mode': core['mode'],
        }

    def estimate_target_hold(self,
                             state: Dict[str, Any],
                             target_air_c: float,
                             outside_air_c: float,
                             dt_hours: float = 1.0,
                             u_value_override: float | None = None,
                             ach_override: float | None = None) -> Dict[str, Any]:
        """Estimate the HVAC load required to hold a target internal temperature.

        This keeps the physical contract inside the existing energy service so
        controller logic does not recreate transmission / ventilation / COP math
        elsewhere.
        """
        delta_t = float(target_air_c) - float(outside_air_c)
        u_value = float(self.u_value if u_value_override is None else u_value_override)
        ach = float(self.ach if ach_override is None else ach_override)
        q_trans_kw = u_value * self.area_m2 * abs(delta_t) / 1000.0
        q_vent_kw = (
            self.rho_a * self.c_p * ach * self.volume_m3 * abs(delta_t) / 3600.0
        ) / 1000.0
        h_crop_kw = float(state.get('H_W_m2', 0.0)) * self.area_m2 / 1000.0

        if delta_t > 0:
            q_load_kw = max(0.0, q_trans_kw + q_vent_kw - h_crop_kw)
            mode = 'heating' if q_load_kw > 0 else 'off'
            cop = self._get_cop_heating(float(outside_air_c)) if q_load_kw > 0 else 0.0
        elif delta_t < 0:
            q_load_kw = max(0.0, q_trans_kw + q_vent_kw + max(h_crop_kw, 0.0))
            mode = 'cooling' if q_load_kw > 0 else 'off'
            cop = self.cop_cooling if q_load_kw > 0 else 0.0
        else:
            q_load_kw = max(0.0, h_crop_kw)
            mode = 'cooling' if q_load_kw > 0 else 'off'
            cop = self.cop_cooling if q_load_kw > 0 else 0.0

        p_elec_kw = q_load_kw / cop if cop > 0 else 0.0
        kwh_step = p_elec_kw * dt_hours
        return {
            'Q_load_kW': round(q_load_kw, 2),
            'P_elec_kW': round(p_elec_kw, 2),
            'COP_current': round(cop, 2),
            'daily_kWh': round(kwh_step, 6),
            'mode': mode,
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

