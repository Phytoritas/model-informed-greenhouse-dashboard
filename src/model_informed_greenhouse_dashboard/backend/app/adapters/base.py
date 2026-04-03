"""Base adapter interface for crop models."""
from abc import ABC, abstractmethod
from typing import Dict, Any, List


class ModelAdapter(ABC):
    """Abstract base class for crop model adapters.
    
    Provides a unified interface for different crop models (tomato, cucumber)
    to enable consistent simulation orchestration and forecasting.
    """
    
    name: str
    version: str
    
    @abstractmethod
    def reset(self) -> None:
        """Reset model to initial state."""
        pass
    
    @abstractmethod
    def step(self, row: Dict[str, Any]) -> Dict[str, Any]:
        """Execute one simulation step with environmental input.
        
        Args:
            row: Environmental data dict with keys:
                - datetime: timestamp
                - T_air_C, PAR_umol, CO2_ppm, RH_percent, wind_speed_ms
                - crop-specific optional parameters
        
        Returns:
            Dict containing common keys:
                - LAI, T_canopy_C, H_W_m2, LE_W_m2, transpiration_g_m2
                - converged (0/1)
                - crop-specific state variables
        """
        pass
    
    @abstractmethod
    def kpis(self, last_state: Dict[str, Any]) -> Dict[str, Any]:
        """Calculate KPI metrics for UI display.
        
        Args:
            last_state: Output from most recent step()
        
        Returns:
            Dict of KPI values (crop-specific)
        """
        pass
    
    # ===== Branching / Forecasting Support =====
    
    @abstractmethod
    def dump_state(self) -> Dict[str, Any]:
        """Serialize current internal state for snapshot/restore.
        
        Returns:
            Dict containing all internal state variables (serializable)
        """
        pass
    
    @abstractmethod
    def load_state(self, state: Dict[str, Any]) -> None:
        """Restore internal state from snapshot.
        
        Args:
            state: State dict from dump_state()
        """
        pass
    
    @abstractmethod
    def run_batch(self, rows: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Run simulation for multiple timesteps (for forecasting).
        
        Args:
            rows: List of environmental data dicts
        
        Returns:
            List of state dicts (one per timestep)
        """
        pass
    
    # ===== Optional: Model-specific configuration =====
    
    def configure(self, config: Dict[str, Any]) -> None:
        """Update model parameters from configuration dict.
        
        Args:
            config: Configuration parameters
        """
        pass

