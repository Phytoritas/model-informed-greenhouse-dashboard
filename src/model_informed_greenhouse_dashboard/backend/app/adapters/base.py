"""Base adapter interface for crop models."""
from abc import ABC, abstractmethod
import math
from typing import Dict, Any, List


# Replay input bounds, not crop-management targets. Positive depleted CO2 is
# valid input; zero is rejected below because these models do not support it.
ENVIRONMENT_RANGES = {
    "T_air_C": (-20, 50, 20),
    "PAR_umol": (0, 3000, 0),
    "CO2_ppm": (0, 2000, 400),
    "RH_percent": (0, 100, 50),
    "wind_speed_ms": (0, 10, 0.3),
}


def finite_number(value: Any) -> float | None:
    """Return a finite number without treating a missing value as zero."""
    try:
        number = float(value)
    except (TypeError, ValueError, OverflowError):
        return None
    return number if math.isfinite(number) else None


def environment_quality(row: Dict[str, Any]) -> Dict[str, Any]:
    """Keep input defects visible even after ingestion replaces a value."""
    previous = row.get("data_quality")
    previous = previous if isinstance(previous, dict) else {}
    issues = [dict(issue) for issue in previous.get("issues", []) if isinstance(issue, dict)]
    if previous.get("status") == "invalid" and not issues:
        issues.append({"field": "environment", "reason": "upstream_invalid"})
    for key, (minimum, maximum, _) in ENVIRONMENT_RANGES.items():
        value = finite_number(row.get(key))
        reason = None
        if key not in row or row[key] is None:
            reason = "missing"
        elif value is None:
            reason = "non_finite_or_non_numeric"
        elif not minimum <= value <= maximum or (key == "CO2_ppm" and value == 0):
            reason = "out_of_range"
        issue = {"field": key, "reason": reason}
        if reason and issue not in issues:
            issues.append(issue)
    return {
        "status": "invalid" if issues else "ok",
        "source": "csv_replay",
        "issues": issues,
    }


def model_output_is_valid(state: Dict[str, Any]) -> bool:
    """Failed or non-finite model outputs cannot support a recommendation."""
    quality = state.get("data_quality") or {}
    return (
        finite_number(state.get("converged")) == 1
        and state.get("simulation_status", "ok") == "ok"
        and quality.get("status", "ok") == "ok"
        and all(
            finite_number(value) is not None
            for value in state.values()
            if isinstance(value, (int, float))
        )
    )


class ModelAdapter(ABC):
    """Abstract base class for crop model adapters.
    
    Provides a unified interface for different crop models (tomato, cucumber)
    to enable consistent simulation orchestration and forecasting.
    """
    
    name: str
    version: str

    def _step_duration_seconds(self, dt, row: Dict[str, Any]) -> float:
        """Use elapsed timestamps, with the caller's interval for the first row."""
        previous = getattr(self, "_last_datetime", None)
        duration = (
            (dt - previous).total_seconds()
            if previous is not None
            else row.get("dt_seconds", 3600.0)
        )
        duration = finite_number(duration)
        if duration is None or duration <= 0:
            raise ValueError("Simulation timestamps must advance by a positive interval")
        return duration
    
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
                - dt_seconds: optional first interval; later intervals use timestamps
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

