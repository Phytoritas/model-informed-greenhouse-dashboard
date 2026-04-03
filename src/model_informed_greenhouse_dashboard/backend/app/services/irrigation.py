"""Irrigation advisory service based on crop transpiration."""
import logging
from datetime import datetime
from typing import Any, Dict

logger = logging.getLogger(__name__)


class IrrigationAdvisor:
    """Provides irrigation recommendations based on ETc and drainage targets."""
    
    def __init__(self,
                 area_m2: float = 3305.8,
                 drain_target_fraction: float = 0.25,
                 irrigation_efficiency: float = 0.9):
        """Initialize irrigation advisor.
        
        Args:
            area_m2: Greenhouse area
            drain_target_fraction: Target drainage fraction (0.2-0.3 typical)
            irrigation_efficiency: Irrigation system efficiency
        """
        self.area_m2 = area_m2
        self.drain_target = drain_target_fraction
        self.efficiency = irrigation_efficiency
        
        self._daily_cache = {
            'date': None,
            'ETc_sum_mm': 0.0,
        }
        
        logger.info(f"Initialized IrrigationAdvisor (drain_target={drain_target_fraction}, "
                   f"efficiency={irrigation_efficiency})")
    
    def update_step(self, state: Dict[str, Any], dt: datetime) -> Dict[str, Any]:
        """Update with current timestep state.
        
        Args:
            state: Current simulation state with transpiration_g_m2
            dt: Current datetime
        
        Returns:
            Current recommendation (may be partial for within-day)
        """
        current_date = dt.date() if isinstance(dt, datetime) else dt
        
        # Reset cache on new day
        if self._daily_cache['date'] != current_date:
            prev_sum = self._daily_cache['ETc_sum_mm']
            self._daily_cache = {
                'date': current_date,
                'ETc_sum_mm': 0.0,
            }
            logger.info(f"IrrigationAdvisor: New day {current_date}, previous day ETc={prev_sum:.2f} mm")
        
        # Accumulate transpiration (g/m² → mm, where 1 mm = 1 L/m²)
        transp_g_m2 = state.get('transpiration_g_m2', 0)
        transp_mm = transp_g_m2 / 1000.0
        self._daily_cache['ETc_sum_mm'] += transp_mm
        
        return self.get_recommendation()
    
    def get_recommendation(self) -> Dict[str, Any]:
        """Get current irrigation recommendation.
        
        Returns:
            Dict with ETc_mm_day, recommended_irrigation_L_m2, etc.
        """
        ETc_mm = self._daily_cache['ETc_sum_mm']
        
        # Irrigation formula: I = ETc / efficiency * (1 + drain_fraction)
        # This ensures: ETc + Drain = I * efficiency
        recommended_L_m2 = (ETc_mm / self.efficiency) * (1 + self.drain_target)
        drain_target_L_m2 = recommended_L_m2 * self.drain_target
        
        # Total for greenhouse
        recommended_L_total = recommended_L_m2 * self.area_m2
        
        return {
            'ETc_mm_day': round(ETc_mm, 2),
            'recommended_irrigation_L_m2': round(recommended_L_m2, 2),
            'recommended_irrigation_L_total': round(recommended_L_total, 1),
            'drain_target_L_m2': round(drain_target_L_m2, 2),
            'efficiency': self.efficiency,
            'drain_target_fraction': self.drain_target,
        }
    
    def reset_daily(self):
        """Reset daily accumulation."""
        self._daily_cache = {
            'date': None,
            'ETc_sum_mm': 0.0,
        }
        logger.info("IrrigationAdvisor daily cache reset")

