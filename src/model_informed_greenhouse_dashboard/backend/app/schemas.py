"""Pydantic schemas for data validation and API contracts."""
from datetime import datetime
from typing import Dict, Any, Optional, List, Literal
from pydantic import BaseModel, Field


# ===== Input Schemas =====

class EnvRow(BaseModel):
    """Single row of environmental data from CSV."""
    datetime: datetime
    T_air_C: float = Field(ge=-20, le=50)
    PAR_umol: float = Field(ge=0, le=3000)
    CO2_ppm: float = Field(ge=300, le=2000)
    RH_percent: float = Field(ge=0, le=100)
    wind_speed_ms: float = Field(ge=0, le=10)
    
    # Crop-specific optional fields
    n_fruits_per_truss: Optional[int] = Field(default=4, ge=1, le=10)
    pruning_threshold: Optional[int] = Field(default=18, ge=10, le=30)
    target_leaf_count: Optional[int] = Field(default=15, ge=10, le=30)


# ===== Output Schemas =====

class FluxData(BaseModel):
    """Energy and mass flux outputs."""
    H_W_m2: float = Field(description="Sensible heat flux")
    LE_W_m2: float = Field(description="Latent heat flux")
    transpiration_g_m2: float = Field(description="Transpiration rate")
    co2_flux_g_m2_s: Optional[float] = Field(default=0, description="CO2 flux")


class StateData(BaseModel):
    """Canopy state variables."""
    LAI: float = Field(ge=0)
    T_canopy_C: float
    fractional_cover: float = Field(ge=0, le=1)
    converged: int = Field(description="Energy balance convergence flag (0/1)")


class TomatoKPI(BaseModel):
    """Tomato-specific KPIs."""
    harvest_kg_ha: float = Field(description="Harvested fruit per hectare (kg/ha)")
    harvest_kg_total: float = Field(description="Total harvested fruit (kg)")
    epsilon: float = Field(description="Crop efficiency (gDM/MJ)")
    active_trusses: int = Field(description="Number of active trusses")
    daily_transpiration_mm: float = Field(description="Daily transpiration (mm)")
    truss_count: int = Field(description="Total truss count")


class CucumberKPI(BaseModel):
    """Cucumber-specific KPIs."""
    node_count: int = Field(description="Total node count")
    LAI: float = Field(description="Leaf Area Index")
    daily_transpiration_mm: float = Field(description="Daily transpiration (mm)")
    fruit_dry_weight_g_m2: float = Field(description="Fruit dry matter (g/m²)")
    vegetative_dry_weight_g_m2: float = Field(description="Vegetative dry matter (g/m²)")


class SimTickPayload(BaseModel):
    """Real-time simulation tick payload (WebSocket)."""
    t: datetime
    crop: str = Field(description="'tomato' or 'cucumber'")
    kpi: Dict[str, Any]
    env: Dict[str, float]
    flux: FluxData
    state: StateData


class ForecastSnapshot(BaseModel):
    """7-day forecast snapshot (WebSocket)."""
    type: str = Field(default="forecast.snapshot")
    daily: List[Dict[str, Any]] = Field(description="Daily aggregated forecast")
    last: Dict[str, Any] = Field(description="Final state of forecast period")
    total_harvest_kg: float
    total_energy_kWh: float
    total_ETc_mm: float


# ===== Configuration Schemas =====

class OpsConfig(BaseModel):
    """Operational strategy configuration."""
    heating_set_C: float = Field(ge=10, le=30)
    cooling_set_C: float = Field(ge=20, le=35)
    p_band_C: float = Field(ge=0.5, le=5)
    co2_target_ppm: float = Field(ge=400, le=1500)
    drain_target_fraction: float = Field(ge=0.1, le=0.5)


class ControlStateUpdate(BaseModel):
    """Manual actuator state update from the UI control lane."""

    ventilation: Optional[bool] = None
    irrigation: Optional[bool] = None
    heating: Optional[bool] = None
    shading: Optional[bool] = None
    source: Optional[str] = Field(default="frontend", max_length=80)


class AlertHistoryEvent(BaseModel):
    """Alert event persisted by the backend history lane."""

    id: str = Field(min_length=1, max_length=160)
    severity: Literal["critical", "warning", "info", "resolved"]
    title: str = Field(min_length=1, max_length=240)
    body: str = Field(default="", max_length=1200)
    source: Optional[str] = Field(default="frontend", max_length=80)
    observed_at: Optional[datetime] = None


class AlertHistoryRequest(BaseModel):
    """Batch of alert events observed by the frontend."""

    events: List[AlertHistoryEvent] = Field(default_factory=list, max_length=40)


class CropConfig(BaseModel):
    """Crop-specific configuration."""
    # Tomato parameters
    n_fruits_per_truss: Optional[int] = Field(default=None, ge=1, le=10, description="Number of fruits per truss (tomato)")
    
    # Cucumber parameters
    pruning_threshold: Optional[int] = Field(default=None, ge=10, le=30, description="Pruning threshold (cucumber)")
    target_leaf_count: Optional[int] = Field(default=None, ge=10, le=30, description="Target leaf count (cucumber)")


class IrrigationAdvice(BaseModel):
    """Irrigation recommendation."""
    ETc_mm_day: float = Field(description="Daily crop evapotranspiration (mm)")
    recommended_irrigation_L_m2: float = Field(description="Recommended irrigation (L/m²)")
    recommended_irrigation_L_total: float = Field(description="Total irrigation for greenhouse (L)")
    drain_target_L_m2: float = Field(description="Target drainage (L/m²)")


class EnergyEstimate(BaseModel):
    """Energy consumption estimate."""
    Q_load_kW: float = Field(description="Current thermal load (kW)")
    P_elec_kW: float = Field(description="Current electric power (kW)")
    daily_kWh: float = Field(description="Daily energy consumption (kWh)")
    COP_current: float = Field(description="Current COP value")

