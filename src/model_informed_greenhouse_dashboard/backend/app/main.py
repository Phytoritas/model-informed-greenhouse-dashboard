"""Main FastAPI application entry point."""

import copy
import logging
from contextlib import asynccontextmanager
from datetime import UTC, datetime
from pathlib import Path
import httpx
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import Dict, Any, Optional, Literal

from .config import settings, greenhouse_config
from .ws import manager
from .services.advisory_api import (
    build_nutrient_correction_response,
    build_nutrient_recommendation_response,
    build_pesticide_recommendation_response,
)
from .services.advisor_orchestration import (
    build_advisor_chat_response,
    build_environment_advisor_response,
    build_environment_recommendation_response,
    build_harvest_advisor_response,
    build_physiology_advisor_response,
    build_advisor_summary_response,
    build_advisor_tab_response,
    build_work_tradeoff_advisor_response,
    build_work_recommendation_response,
)
from .services.openai_service import generate_consulting, generate_chat_reply
from .services.knowledge_catalog import (
    build_crop_knowledge_context,
    build_knowledge_catalog,
    rebuild_knowledge_catalog,
)
from .services.knowledge_database import query_knowledge_database
from .services.produce_prices import fetch_featured_produce_prices
from .services.rtr_profiles import load_rtr_profiles
from .services.weather import fetch_daegu_weather_outlook
from .schemas import OpsConfig, CropConfig

class Settings(BaseModel):
    price_per_kg: float
    cost_per_kwh: float

class Feedback(BaseModel):
    recommendation_id: str  # Just title or hash for now
    feedback: Literal["up", "down"]
    crop: str


class AiConsultRequest(BaseModel):
    crop: str  # 'tomato' or 'cucumber'
    dashboard: Dict[str, Any]
    language: Optional[str] = "ko"


class AiChatRequest(BaseModel):
    crop: str  # 'tomato' or 'cucumber'
    messages: list[Dict[str, str]]
    dashboard: Optional[Dict[str, Any]] = None
    language: Optional[str] = "ko"


class AdvisorSummaryRequest(BaseModel):
    crop: str
    dashboard: Optional[Dict[str, Any]] = None
    language: Optional[str] = "ko"


class AdvisorChatRequest(BaseModel):
    crop: str
    messages: list[Dict[str, str]]
    dashboard: Optional[Dict[str, Any]] = None
    language: Optional[str] = "ko"


class AdvisorTabRequest(BaseModel):
    crop: str
    greenhouse_id: Optional[str] = None
    target: Optional[str] = None
    limit: int = 5
    stage: Optional[str] = None
    medium: Optional[str] = None
    dashboard: Optional[Dict[str, Any]] = None
    source_water_mmol_l: Optional[Dict[str, float]] = None
    drain_water_mmol_l: Optional[Dict[str, float]] = None
    working_solution_volume_l: Optional[float] = None
    stock_ratio: Optional[float] = None


class AdvisorSurfaceRequest(BaseModel):
    crop: str
    greenhouse_id: Optional[str] = None
    dashboard: Optional[Dict[str, Any]] = None


class EnvironmentRecommendationRequest(BaseModel):
    crop: str
    dashboard: Optional[Dict[str, Any]] = None


class WorkRecommendationRequest(BaseModel):
    crop: str
    dashboard: Optional[Dict[str, Any]] = None


class PesticideRecommendationRequest(BaseModel):
    crop: str
    target: str
    limit: int = 5


class NutrientRecommendationRequest(BaseModel):
    crop: str
    stage: Optional[str] = None
    medium: Optional[str] = None


class NutrientCorrectionRequest(BaseModel):
    crop: str
    stage: Optional[str] = None
    medium: Optional[str] = None
    source_water_mmol_l: Optional[Dict[str, float]] = None
    drain_water_mmol_l: Optional[Dict[str, float]] = None
    working_solution_volume_l: Optional[float] = None
    stock_ratio: Optional[float] = None


class KnowledgeQueryFilters(BaseModel):
    source_types: Optional[list[str]] = None
    asset_families: Optional[list[str]] = None
    topic_major: Optional[str] = None
    topic_minor: Optional[str] = None


class KnowledgeQueryRequest(BaseModel):
    crop: Optional[str] = None
    query: str
    limit: int = 5
    filters: Optional[KnowledgeQueryFilters] = None


ModelWorkEventType = Literal[
    "leaf_removal",
    "fruit_thinning",
    "pruning",
    "training",
    "harvest",
    "pollination",
    "pesticide_application",
    "irrigation_change",
    "nutrient_recipe_change",
    "heating_setpoint_change",
    "ventilation_strategy_change",
    "screen_strategy_change",
    "CO2_strategy_change",
]


class ModelSnapshotRequest(BaseModel):
    crop: str
    greenhouse_id: Optional[str] = None
    source: Optional[str] = "live_app_state"


class ModelReplayEventRequest(BaseModel):
    event_time: Optional[datetime] = None
    event_type: ModelWorkEventType
    leaf_rank_range: Optional[list[int]] = None
    leaves_removed_count: Optional[int] = None
    target_leaf_count: Optional[int] = None
    truss_id: Optional[int] = None
    cohort_id: Optional[int] = None
    fruits_removed_count: Optional[int] = None
    target_fruits_per_truss: Optional[int] = None
    reason_code: Optional[str] = None
    operator: Optional[str] = None
    confidence: Optional[float] = 0.7
    source: Optional[str] = "api"


class ModelReplayRequest(BaseModel):
    crop: str
    greenhouse_id: Optional[str] = None
    snapshot_id: Optional[str] = None
    events: list[ModelReplayEventRequest]


class ModelControlDeltaRequest(BaseModel):
    temperature_day: Optional[float] = 0.0
    temperature_night: Optional[float] = 0.0
    co2_setpoint_day: Optional[float] = 0.0
    rh_target: Optional[float] = 0.0
    screen_close: Optional[float] = 0.0


class ModelScenarioRequest(BaseModel):
    crop: str
    greenhouse_id: Optional[str] = None
    snapshot_id: Optional[str] = None
    horizon_hours: list[int] = Field(default_factory=lambda: [24, 72, 336])
    scenario_label: Optional[str] = None
    controls: Optional[ModelControlDeltaRequest] = None


class ModelSensitivityRequest(BaseModel):
    crop: str
    greenhouse_id: Optional[str] = None
    snapshot_id: Optional[str] = None
    target: str = "predicted_yield_14d"
    horizon_hours: int = 72
    controls: Optional[list[str]] = None
    step_overrides: Optional[Dict[str, float]] = None

# Setup logging
logging.basicConfig(
    level=getattr(logging, settings.log_level),
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)

# Global state - separate state for each crop (dual greenhouse scenario)
app_state = {
    "tomato": {
        "simulator": None,
        "forecaster": None,
        "irrigation": None,
        "energy": None,
        "adapter": None,
        "df_env": None,
        "sim_task": None,
        "dt_hours": None,
        "time_step": "auto",
        "decision": None,
        "last_irrigation": None,
        "last_energy": None,
        "latest_forecast": None,
        "ops_config": None,
        "crop_config": None,
        "pending_prune_reset": False,
    },
    "cucumber": {
        "simulator": None,
        "forecaster": None,
        "irrigation": None,
        "energy": None,
        "adapter": None,
        "df_env": None,
        "sim_task": None,
        "dt_hours": None,
        "time_step": "auto",
        "decision": None,
        "last_irrigation": None,
        "last_energy": None,
        "latest_forecast": None,
        "ops_config": None,
        "crop_config": None,
        "pending_prune_reset": False,
    },
}

STEP_FREQUENCIES: Dict[str, Optional[str]] = {
    "auto": None,
    "1s": "1S",
    "1min": "1min",
    "10min": "10min",
    "1h": "1H",
}

CROPS = ("tomato", "cucumber")


def _default_ops_config() -> Dict[str, float]:
    return {
        "heating_set_C": greenhouse_config["operations"]["heating_set_C"],
        "cooling_set_C": greenhouse_config["operations"]["cooling_set_C"],
        "p_band_C": greenhouse_config["operations"]["p_band_C"],
        "co2_target_ppm": greenhouse_config["operations"]["co2_target_ppm"],
        "drain_target_fraction": greenhouse_config["substrate"]["drain_target_fraction"],
    }


def _default_crop_config(crop: str) -> Dict[str, int]:
    if crop == "tomato":
        return {"n_fruits_per_truss": 4}

    return {
        "pruning_threshold": 18,
        "target_leaf_count": 15,
        "current_leaf_count": 0,
    }


def _validate_crop(crop: str) -> str:
    if crop not in CROPS:
        raise HTTPException(status_code=400, detail="crop must be 'tomato' or 'cucumber'")

    return crop


def _target_crops(crop: Optional[str] = None) -> list[str]:
    if crop is None:
        return list(CROPS)

    return [_validate_crop(crop)]


def _normalize_catalog_crop(crop: Optional[str] = None) -> Optional[str]:
    if crop in (None, "", "all"):
        return None

    return _validate_crop(crop)


def _augment_dashboard_with_knowledge_context(
    crop: str,
    dashboard: Optional[Dict[str, Any]],
) -> Dict[str, Any]:
    payload = dict(dashboard or {})
    existing_knowledge = payload.get("knowledge")
    knowledge_context = build_crop_knowledge_context(crop)

    if existing_knowledge:
        knowledge_context["client_context"] = existing_knowledge

    payload["knowledge"] = knowledge_context
    return payload


def _resolve_greenhouse_id(crop: str, greenhouse_id: Optional[str] = None) -> str:
    return greenhouse_id or crop


def _build_live_model_metadata(crop: str) -> Dict[str, Any]:
    crop_state = app_state[crop]
    return {
        "ops_config": dict(_get_ops_config(crop)),
        "crop_config": _serialize_crop_config(crop),
        "latest_forecast": copy.deepcopy(crop_state.get("latest_forecast")),
    }


def _clone_adapter_from_raw_state(crop: str, raw_state: Dict[str, Any]):
    from .adapters.cucumber import CucumberAdapter
    from .adapters.tomato import TomatoAdapter

    area_m2 = greenhouse_config["greenhouse"]["area_m2"]
    crop_config = greenhouse_config["crops"][crop]

    if crop == "tomato":
        adapter = TomatoAdapter(
            area_m2=area_m2,
            plant_density=crop_config["plant_density_per_m2"],
        )
    else:
        adapter = CucumberAdapter(
            area_m2=area_m2,
            plant_density=crop_config["plant_density_per_m2"],
        )

    adapter.load_state(copy.deepcopy(raw_state))
    return adapter


def _build_normalized_model_snapshot(
    crop: str,
    greenhouse_id: str,
    adapter,
    *,
    snapshot_time: Optional[datetime] = None,
) -> Dict[str, Any]:
    if crop == "tomato":
        from .services.crop_models.tomato_growth_model import build_tomato_snapshot

        return build_tomato_snapshot(
            adapter,
            greenhouse_id=greenhouse_id,
            snapshot_time=snapshot_time,
        )

    from .services.crop_models.cucumber_growth_model import build_cucumber_snapshot

    return build_cucumber_snapshot(
        adapter,
        greenhouse_id=greenhouse_id,
        snapshot_time=snapshot_time,
    )


def _persist_model_snapshot(
    *,
    store,
    crop: str,
    greenhouse_id: str,
    adapter,
    source: str,
    metadata: Optional[Dict[str, Any]] = None,
    snapshot_time: Optional[datetime] = None,
) -> Dict[str, Any]:
    snapshot_dt = (
        snapshot_time
        or getattr(adapter, "_last_datetime", None)
        or datetime.now(UTC)
    )
    normalized_snapshot = _build_normalized_model_snapshot(
        crop,
        greenhouse_id,
        adapter,
        snapshot_time=snapshot_dt,
    )
    return store.persist_snapshot(
        greenhouse_id=greenhouse_id,
        crop=crop,
        snapshot_time=snapshot_dt,
        adapter_name=adapter.name,
        adapter_version=adapter.version,
        normalized_snapshot=normalized_snapshot,
        raw_adapter_state=adapter.dump_state(),
        source=source,
        metadata=metadata,
    )


def _resolve_runtime_snapshot_record(
    *,
    store,
    crop: str,
    greenhouse_id: Optional[str] = None,
    snapshot_id: Optional[str] = None,
    source: str = "live_app_state",
):
    if snapshot_id:
        snapshot_record = store.load_snapshot(snapshot_id)
        if snapshot_record is None:
            raise HTTPException(status_code=404, detail=f"Unknown snapshot_id: {snapshot_id}")
        if snapshot_record["crop"] != crop:
            raise HTTPException(
                status_code=400,
                detail="snapshot_id crop does not match requested crop.",
            )
        return _resolve_greenhouse_id(crop, greenhouse_id or snapshot_record["greenhouse_id"]), snapshot_record

    crop_state = app_state[crop]
    if crop_state["adapter"] is None:
        raise HTTPException(
            status_code=400,
            detail="Model runtime is inactive. Call /api/start first or provide snapshot_id.",
        )

    resolved_greenhouse_id = _resolve_greenhouse_id(crop, greenhouse_id)
    adapter = _clone_adapter_from_raw_state(crop, crop_state["adapter"].dump_state())
    snapshot_record = _persist_model_snapshot(
        store=store,
        crop=crop,
        greenhouse_id=resolved_greenhouse_id,
        adapter=adapter,
        source=source,
        metadata=_build_live_model_metadata(crop),
    )
    store.upsert_current_state(
        greenhouse_id=resolved_greenhouse_id,
        crop=crop,
        latest_snapshot_id=snapshot_record["snapshot_id"],
    )
    return resolved_greenhouse_id, snapshot_record


def _apply_model_replay_event(crop: str, adapter, event_payload: Dict[str, Any]) -> Dict[str, Any]:
    if crop == "tomato":
        from .services.crop_models.tomato_growth_model import apply_tomato_work_event

        return apply_tomato_work_event(adapter, event_payload)

    from .services.crop_models.cucumber_growth_model import apply_cucumber_work_event

    return apply_cucumber_work_event(adapter, event_payload)


def _get_ops_config(crop: str) -> Dict[str, float]:
    crop_state = app_state[crop]
    ops_config = crop_state.get("ops_config")
    if ops_config is None:
        ops_config = _default_ops_config()
        crop_state["ops_config"] = ops_config

    return ops_config


def _get_crop_config_store(crop: str) -> Dict[str, int]:
    crop_state = app_state[crop]
    crop_config = crop_state.get("crop_config")
    if crop_config is None:
        crop_config = _default_crop_config(crop)
        crop_state["crop_config"] = crop_config

    return crop_config


def _apply_crop_config_to_adapter(crop: str) -> bool:
    crop_state = app_state[crop]
    adapter = crop_state.get("adapter")
    if adapter is None:
        return False

    crop_config = _get_crop_config_store(crop)
    if crop == "tomato":
        adapter.model.n_f = crop_config["n_fruits_per_truss"]
    else:
        adapter.model.pruning_threshold = crop_config["pruning_threshold"]
        adapter.model.target_leaf_count = crop_config["target_leaf_count"]

    return True


def _serialize_crop_config(crop: str) -> Dict[str, Any]:
    crop_config = dict(_get_crop_config_store(crop))
    crop_state = app_state[crop]
    adapter = crop_state.get("adapter")

    if crop == "tomato":
        if adapter is not None:
            crop_config["n_fruits_per_truss"] = getattr(adapter.model, "n_f", crop_config["n_fruits_per_truss"])
        return {"crop": crop, **crop_config}

    if adapter is not None:
        crop_config["pruning_threshold"] = getattr(adapter.model, "pruning_threshold", crop_config["pruning_threshold"])
        crop_config["target_leaf_count"] = getattr(adapter.model, "target_leaf_count", crop_config["target_leaf_count"])
        crop_config["current_leaf_count"] = getattr(adapter.model, "remaining_leaves", crop_config["current_leaf_count"])

    return {"crop": crop, **crop_config}


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan manager."""
    logger.info("Starting up greenhouse dashboard backend...")
    from .services.energy import EnergyEstimator
    from .services.irrigation import IrrigationAdvisor

    # Initialize greenhouse area (each greenhouse has same area)
    area_m2 = greenhouse_config["greenhouse"]["area_m2"]
    height_m = greenhouse_config["greenhouse"]["height_m"]

    # Initialize services for each crop (separate greenhouses)
    for crop in CROPS:
        ops_config = _get_ops_config(crop)
        _get_crop_config_store(crop)
        app_state[crop]["irrigation"] = IrrigationAdvisor(
            area_m2=area_m2,
            drain_target_fraction=ops_config["drain_target_fraction"],
            irrigation_efficiency=greenhouse_config["substrate"]["irrigation_efficiency"],
        )

        app_state[crop]["energy"] = EnergyEstimator(
            area_m2=area_m2,
            height_m=height_m,
            u_value=greenhouse_config["greenhouse"]["envelope"]["u_value_W_m2K"],
            ach=greenhouse_config["greenhouse"]["envelope"]["ach_h"],
            cop_curve={
                float(k): v
                for k, v in greenhouse_config["greenhouse"]["hvac"][
                    "cop_heating_curve"
                ].items()
            },
            cop_cooling=greenhouse_config["greenhouse"]["hvac"]["cop_cooling"],
        )
        
        logger.info(f"Initialized services for {crop} greenhouse")

    logger.info("Backend startup complete - ready for dual greenhouse operation")

    yield

    # Cleanup
    logger.info("Shutting down backend...")


app = FastAPI(
    title="1000-pyeong Greenhouse Dashboard API", version="1.0.0", lifespan=lifespan
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=[],
    allow_origin_regex=r"https?://(localhost|127\.0\.0\.1)(:\d+)?$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ===== REST Endpoints =====


class StartRequest(BaseModel):
    """Request to start simulation."""

    crop: str  # 'tomato' or 'cucumber'
    csv_filename: str  # Filename in data directory
    time_step: Literal["auto", "1s", "1min", "10min", "1h"] = "auto"


@app.post("/api/start")
async def start_simulation(req: StartRequest):
    """Start simulation for specified crop (independent per greenhouse)."""
    logger.info(f"Starting simulation for {req.crop} greenhouse with {req.csv_filename}")
    from .adapters.cucumber import CucumberAdapter
    from .adapters.tomato import TomatoAdapter
    from .services.decision import DecisionSupport
    from .services.forecast import BranchForecaster
    from .services.ingest import BatchIngestor
    from .services.simulator import Simulator

    # Validate crop type
    _validate_crop(req.crop)

    crop_state = app_state[req.crop]
    ops_config = _get_ops_config(req.crop)
    _get_crop_config_store(req.crop)

    # Stop any running simulation for THIS crop first
    if crop_state["simulator"] is not None:
        import asyncio

        logger.info(f"Stopping previous {req.crop} simulation...")
        crop_state["simulator"].stop()
        
        # Cancel running simulation task
        if crop_state["sim_task"] and not crop_state["sim_task"].done():
            logger.info(f"Cancelling previous {req.crop} simulation task...")
            crop_state["sim_task"].cancel()
            try:
                await crop_state["sim_task"]
            except asyncio.CancelledError:
                logger.info(f"Previous {req.crop} simulation task cancelled cleanly")
            except Exception as exc:
                logger.warning(
                    "Previous %s simulation task raised during cancellation: %s",
                    req.crop,
                    exc,
                )
            finally:
                crop_state["sim_task"] = None
        
        # Small delay to allow cleanup
        await asyncio.sleep(0.2)

    # Load CSV data
    import os

    csv_path = os.path.join(settings.data_dir, req.csv_filename)

    try:
        ingestor = BatchIngestor(csv_path, quality_check=True)
        df_env = ingestor.load()
    except FileNotFoundError:
        raise HTTPException(
            status_code=404, detail=f"CSV file not found: {req.csv_filename}"
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to load CSV: {str(e)}")

    import pandas as pd
    df_env["datetime"] = pd.to_datetime(df_env["datetime"])
    df_env = df_env.sort_values("datetime").reset_index(drop=True)

    # Apply time-step resampling if requested
    if req.time_step != "auto":
        freq = STEP_FREQUENCIES.get(req.time_step)
        if freq is None:
            raise HTTPException(status_code=400, detail=f"Unsupported time_step: {req.time_step}")

        def _resample_environment(df: pd.DataFrame, frequency: str) -> pd.DataFrame:
            df = df.sort_values("datetime").set_index("datetime")
            numeric_cols = df.select_dtypes(include=["number"]).columns
            non_numeric_cols = df.columns.difference(numeric_cols)

            numeric_resampled = df[numeric_cols].resample(frequency).mean()
            numeric_resampled = numeric_resampled.interpolate(method="time").ffill().bfill()

            resampled = numeric_resampled.copy()
            for col in non_numeric_cols:
                resampled[col] = df[col].resample(frequency).ffill().bfill()

            resampled = resampled.reset_index()
            return resampled

        df_env = _resample_environment(df_env, freq)
        logger.info(
            f"Resampled environment data to {req.time_step} ({freq}) -> {len(df_env)} rows"
        )

    crop_state["df_env"] = df_env
    crop_state["time_step"] = req.time_step

    # Calculate timestep duration from data
    if len(df_env) > 1:
        delta_seconds = max(
            1.0,
            (df_env.iloc[1]["datetime"] - df_env.iloc[0]["datetime"]).total_seconds(),
        )
        dt_hours = delta_seconds / 3600.0
        logger.info(
            f"Calculated timestep duration: {dt_hours:.4f} hours ({dt_hours*60:.1f} minutes)"
        )
    else:
        delta_seconds = 3600.0
        dt_hours = 1.0
        logger.warning("Only one row in data, using default dt_hours=1.0")

    crop_state["dt_hours"] = dt_hours
    # Forecast sampling tuned to be FASTER than the simulation's 1-hour scale:
    # - base_interval: number of rows per hour (e.g., 10-min data => 6)
    # - Use half-hour equivalent by default (base_interval // 2, but at least 1)
    base_interval = max(1, int(round(3600 / delta_seconds)))  # rows per hour
    forecast_step_interval = max(1, base_interval // 2)       # ≈ 30 minutes for 10-min data
    logger.info(
        f"Derived forecast sampling interval: every {forecast_step_interval} steps (~{max(dt_hours/2, dt_hours):.2f} h per sample) for faster prediction"
    )
 
    # Initialize adapter
    area_m2 = greenhouse_config["greenhouse"]["area_m2"]
    crop_config = greenhouse_config["crops"][req.crop]

    if req.crop == "tomato":
        adapter = TomatoAdapter(
            area_m2=area_m2, plant_density=crop_config["plant_density_per_m2"]
        )
    else:
        adapter = CucumberAdapter(
            area_m2=area_m2, plant_density=crop_config["plant_density_per_m2"]
        )

    crop_state["adapter"] = adapter
    _apply_crop_config_to_adapter(req.crop)
    if req.crop == "cucumber" and crop_state.get("pending_prune_reset"):
        adapter.mark_pruned()
        crop_state["pending_prune_reset"] = False

    # Initialize decision support system
    decision_support = DecisionSupport(crop_type=req.crop)
    crop_state["decision"] = decision_support

    # Initialize simulator with irrigation and energy services
    simulator = Simulator(
        adapter=adapter,
        broadcaster=lambda path, payload: manager.broadcast_sync(f"{path}/{req.crop}", payload),
        df_env=df_env,
        irrigation_advisor=crop_state["irrigation"],
        energy_estimator=crop_state["energy"],
        greenhouse_config=greenhouse_config,
        operations_config=ops_config,
        dt_hours=dt_hours
    )
    crop_state["simulator"] = simulator
    if crop_state["irrigation"] is not None:
        crop_state["irrigation"].drain_target = ops_config["drain_target_fraction"]

    # Initialize forecaster
    def _handle_forecast_broadcast(path: str, payload: Dict[str, Any]):
        # Intercept forecast result to store in state
        if payload.get("type") == "forecast.snapshot":
            crop_state["latest_forecast"] = payload
        # Broadcast to WebSocket
        manager.broadcast_sync(f"{path}/{req.crop}", payload)

    forecaster = BranchForecaster(
        broadcaster=_handle_forecast_broadcast,
        area_m2=area_m2,
        window_days=settings.forecast_window_days,
        forecast_step_interval=forecast_step_interval,
        crop_name=req.crop,
    )
    crop_state["forecaster"] = forecaster

    # Reset services
    crop_state["irrigation"].reset_daily()
    crop_state["energy"].reset_daily()

    logger.info(f"{req.crop} simulation initialized with {len(df_env)} rows")

    # Auto-start simulation for real-time streaming
    simulator.start()
    import asyncio

    crop_state["sim_task"] = asyncio.create_task(_run_simulation_task(req.crop))
    logger.info(f"{req.crop} real-time simulation started")
    
    # Schedule initial forecast almost immediately to show results quickly
    async def _initial_forecast():
        await asyncio.sleep(0.2)  # tiny delay to ensure simulator has started
        _schedule_forecast(req.crop)
        logger.info(f"{req.crop} initial forecast scheduled")
    
    asyncio.create_task(_initial_forecast())

    return {
        "status": "success",
        "crop": req.crop,
        "rows": len(df_env),
        "date_range": {
            "start": str(df_env["datetime"].min()),
            "end": str(df_env["datetime"].max()),
        },
        "time_step": req.time_step,
        "dt_minutes": round(dt_hours * 60, 3),
    }


@app.post("/api/step")
async def step_simulation(crop: str = "tomato"):
    """Execute one simulation step."""
    _validate_crop(crop)
    crop_state = app_state[crop]
    if crop_state["simulator"] is None:
        raise HTTPException(
            status_code=400, detail="Simulation not started. Call /api/start first."
        )

    simulator = crop_state["simulator"]

    # Check if at end
    if simulator.idx >= len(simulator.df_env):
        return {"status": "end", "message": "Reached end of data"}

    # Execute step
    payload = simulator.step_from_index(simulator.idx)

    # Update irrigation
    dt = simulator.df_env.iloc[simulator.idx]["datetime"]
    irr_advice = crop_state["irrigation"].update_step(
        payload["state"], dt
    )

    # Update energy
    dt_hours = crop_state.get("dt_hours", 1.0)
    ops_config = _get_ops_config(crop)
    energy_est = crop_state["energy"].estimate_step(
        state=payload["state"],
        env=payload["env"],
        setpoints={
            "heating_set_C": ops_config["heating_set_C"],
            "cooling_set_C": ops_config["cooling_set_C"],
            "T_out_C": payload["env"]["T_air_C"] - 5,  # Placeholder
        },
        dt=dt,
        dt_hours=dt_hours,
    )

    # Merge into payload and store last recommendations inputs
    payload["irrigation"] = irr_advice
    payload["energy"] = energy_est
    crop_state["last_irrigation"] = irr_advice
    crop_state["last_energy"] = energy_est
    # Real-time recommendations
    if crop_state.get("decision"):
        try:
            recs = crop_state["decision"].get_recommendations(
                payload["kpi"], payload["state"], irr_advice, energy_est, payload["env"]
            )
            payload["recommendations"] = recs
        except Exception as e:
            logger.error(f"Failed to compute recommendations: {e}")

    await manager.broadcast(f"/ws/sim/{crop}", payload)

    # Advance index
    simulator.idx += 1

    # Schedule forecast every N steps
    if simulator.idx % 60 == 0:  # Every 60 steps (hourly if minute data)
        _schedule_forecast(crop)

    return {"status": "success", "crop": crop, "idx": simulator.idx, "payload": payload}


@app.post("/api/run")
async def run_all():
    """Run entire simulation for all active crops."""
    started_crops = []
    
    for crop in CROPS:
        if app_state.get(crop) and app_state[crop].get("simulator"):
            simulator = app_state[crop]["simulator"]
            if not simulator.running:
                simulator.start()
                import asyncio
                # Cancel existing task if any
                if app_state[crop].get("sim_task") and not app_state[crop]["sim_task"].done():
                     app_state[crop]["sim_task"].cancel()
                
                app_state[crop]["sim_task"] = asyncio.create_task(_run_simulation_task(crop))
                started_crops.append(crop)
    
    if not started_crops:
        raise HTTPException(status_code=400, detail="No active simulations found. Please call /api/start first.")

    return {"status": "running", "crops": started_crops}


async def _run_simulation_task(crop: str):
    """Background task to run simulation for specific crop."""
    import asyncio

    crop_state = app_state[crop]
    simulator = crop_state["simulator"]
    logger.info(f"Running full {crop} simulation...")

    try:
        for i in range(simulator.idx, len(simulator.df_env)):
            if not simulator.running:
                logger.info(f"{crop} simulation stopped by user")
                break

            # Handle pause
            while simulator.paused:
                await asyncio.sleep(0.1)

            payload = simulator.step_from_index(i)

            # Store last values for recommendations
            crop_state["last_irrigation"] = payload.get("irrigation", {})
            crop_state["last_energy"] = payload.get("energy", {})

            # Real-time recommendations
            if crop_state.get("decision"):
                try:
                    recs = crop_state["decision"].get_recommendations(
                        payload["kpi"], payload["state"], 
                        crop_state["last_irrigation"], 
                        crop_state["last_energy"], 
                        payload["env"],
                        crop_state.get("latest_forecast")
                    )
                    payload["recommendations"] = recs
                except Exception as e:
                    logger.error(f"Failed to compute {crop} recommendations: {e}")

            # Broadcast full payload (already includes /tomato or /cucumber path)
            await manager.broadcast(f"/ws/sim/{crop}", payload)

            # Schedule forecast periodically (default: every settings.forecast_reschedule_interval_h hours)
            try:
                steps_per_hour = max(1, int(round(1.0 / max(simulator.dt_hours, 1e-6))))
                resched_steps = max(1, int(round(steps_per_hour * settings.forecast_reschedule_interval_h)))
            except Exception:
                resched_steps = 6  # sensible fallback for 10-min data
            if i % resched_steps == 0 and i > 0:
                _schedule_forecast(crop)
                logger.info(f"{crop} forecast scheduled at step {i} (every {resched_steps} steps)")

            # Speed-controlled delay (adjustable via simulator.speed)
            # Default: 0.1s per step (10 steps/sec) for smooth visualization
            delay = 0.1 / simulator.speed
            await asyncio.sleep(delay)

        if simulator.running and simulator.idx >= len(simulator.df_env) - 1:
            simulator.stop()
            logger.info("%s simulation reached end of data", crop)

        logger.info(f"{crop} simulation run completed")
    
    except asyncio.CancelledError:
        logger.info(f"{crop} simulation task was cancelled")
        raise
    except Exception as e:
        logger.error(f"{crop} simulation task error: {e}", exc_info=True)


def _schedule_forecast(crop: str):
    """Schedule a forecast run for specific crop."""
    crop_state = app_state[crop]
    
    if crop_state["simulator"] is None or crop_state["forecaster"] is None:
        logger.warning(f"{crop} forecast skipped - no simulator/forecaster")
        return

    simulator = crop_state["simulator"]
    forecaster = crop_state["forecaster"]
    adapter = crop_state["adapter"]

    # Get future rows (7 days)
    from datetime import timedelta
    import pandas as pd

    current_idx = simulator.idx
    if current_idx >= len(simulator.df_env):
        logger.warning(f"{crop} forecast skipped - at end of data")
        return

    current_dt = pd.to_datetime(simulator.df_env.iloc[current_idx]["datetime"])
    future_end = current_dt + timedelta(days=settings.forecast_window_days)

    mask = (simulator.df_env["datetime"] > current_dt) & (
        simulator.df_env["datetime"] <= future_end
    )
    future_df = simulator.df_env.loc[mask]

    if len(future_df) == 0:
        logger.warning(f"{crop} forecast skipped - no future data")
        return

    future_rows = future_df.to_dict(orient="records")

    logger.info(f"Scheduling {crop} forecast for {len(future_rows)} rows")
    forecaster.schedule(adapter, future_rows)


@app.post("/api/pause")
async def pause_simulation(crop: Optional[str] = None):
    """Pause simulation."""
    paused_crops = []
    for crop_name in _target_crops(crop):
        simulator = app_state[crop_name]["simulator"]
        if simulator is None:
            continue

        simulator.pause()
        paused_crops.append(crop_name)

    if not paused_crops:
        raise HTTPException(status_code=400, detail="Simulation not started")

    return {"status": "paused", "crops": paused_crops}


@app.post("/api/resume")
async def resume_simulation(crop: Optional[str] = None):
    """Resume simulation."""
    resumed_crops = []
    for crop_name in _target_crops(crop):
        simulator = app_state[crop_name]["simulator"]
        if simulator is None:
            continue

        simulator.resume()
        resumed_crops.append(crop_name)

    if not resumed_crops:
        raise HTTPException(status_code=400, detail="Simulation not started")

    return {"status": "resumed", "crops": resumed_crops}


@app.post("/api/stop")
async def stop_simulation(crop: Optional[str] = None):
    """Stop simulation."""
    stopped_crops = []
    for crop_name in _target_crops(crop):
        crop_state = app_state[crop_name]
        simulator = crop_state["simulator"]
        if simulator is None:
            continue

        simulator.stop()
        if crop_state["sim_task"] and not crop_state["sim_task"].done():
            logger.info(f"Cancelling {crop_name} simulation task...")
            crop_state["sim_task"].cancel()

        stopped_crops.append(crop_name)

    if not stopped_crops:
        raise HTTPException(status_code=400, detail="Simulation not started")

    return {"status": "stopped", "crops": stopped_crops}


class SpeedRequest(BaseModel):
    """Request to change simulation speed."""

    speed: float  # Speed multiplier (0.1 to 100)


@app.post("/api/speed")
async def set_speed(req: SpeedRequest, crop: Optional[str] = None):
    """Set simulation speed."""
    updated_crops = []
    for crop_name in _target_crops(crop):
        simulator = app_state[crop_name]["simulator"]
        if simulator is None:
            continue

        simulator.set_speed(req.speed)
        updated_crops.append(crop_name)

    if not updated_crops:
        raise HTTPException(status_code=400, detail="Simulation not started")

    return {"status": "success", "crops": updated_crops, "speed": req.speed}


@app.post("/api/config/ops")
async def update_ops_config(config: OpsConfig, crop: Optional[str] = None):
    """Update operational configuration."""
    target_crops = _target_crops(crop)
    config_payload = config.model_dump()

    if crop is None:
        greenhouse_config["operations"]["heating_set_C"] = config.heating_set_C
        greenhouse_config["operations"]["cooling_set_C"] = config.cooling_set_C
        greenhouse_config["operations"]["p_band_C"] = config.p_band_C
        greenhouse_config["operations"]["co2_target_ppm"] = config.co2_target_ppm
        greenhouse_config["substrate"]["drain_target_fraction"] = config.drain_target_fraction

    for crop_name in target_crops:
        ops_config = _get_ops_config(crop_name)
        ops_config.update(config_payload)
        if app_state[crop_name]["irrigation"]:
            app_state[crop_name]["irrigation"].drain_target = config.drain_target_fraction
        if app_state[crop_name]["simulator"] is not None:
            app_state[crop_name]["simulator"].operations_config = ops_config

    logger.info(f"Operations config updated for {target_crops}: {config_payload}")

    return {"status": "success", "crops": target_crops, "config": config_payload}


@app.post("/api/config/crop")
async def update_crop_config(config: CropConfig, crop: str):
    """Update crop-specific configuration."""
    _validate_crop(crop)

    crop_config = _get_crop_config_store(crop)
    config_payload = config.model_dump(exclude_none=True)
    crop_config.update(config_payload)
    applied = _apply_crop_config_to_adapter(crop)
    if applied:
        logger.info(f"Applied {crop} crop config update: {config_payload}")
        _schedule_forecast(crop)
    else:
        logger.info(f"Queued {crop} crop config update until simulator start: {config_payload}")

    return {
        "status": "success",
        "crop": crop,
        "config": _serialize_crop_config(crop),
        "adapter_active": applied,
        "message": "Crop configuration updated."
        if applied
        else "Crop configuration saved and will apply when the simulator starts.",
    }


@app.post("/api/settings")
async def update_settings(settings: Settings, crop: str = "tomato"):
    """Update financial settings for a crop."""
    if crop not in ["tomato", "cucumber"]:
        raise HTTPException(status_code=400, detail="Invalid crop")
    
    crop_state = app_state[crop]
    if crop_state["decision"]:
        crop_state["decision"].update_settings(settings.dict())
        logger.info(f"Updated settings for {crop}: {settings}")
        return {"status": "success", "settings": settings}
    
    return {"status": "error", "message": "Decision service not active"}

@app.get("/api/settings")
async def get_settings(crop: str = "tomato"):
    """Get current financial settings."""
    if crop not in ["tomato", "cucumber"]:
        raise HTTPException(status_code=400, detail="Invalid crop")
    
    crop_state = app_state[crop]
    if crop_state["decision"]:
        return crop_state["decision"].settings
    
    return {"price_per_kg": 3000, "cost_per_kwh": 120} # Defaults

@app.post("/api/feedback")
async def submit_feedback(feedback: Feedback):
    """Submit user feedback on recommendations."""
    logger.info(f"📝 USER FEEDBACK [{feedback.crop}]: {feedback.feedback.upper()} for '{feedback.recommendation_id}'")
    # In a real app, save to DB. Here just log it.
    return {"status": "received"}


@app.get("/api/knowledge/status")
async def get_knowledge_status(crop: Optional[str] = None):
    """Return the phase-1 SmartGrow corpus catalog."""
    try:
        crop_scope = _normalize_catalog_crop(crop)
        return {"status": "success", **build_knowledge_catalog(crop_scope)}
    except Exception as exc:
        logger.error("Knowledge status failed: %s", exc, exc_info=True)
        raise HTTPException(
            status_code=500,
            detail="Knowledge status failed.",
        ) from exc


@app.post("/api/knowledge/reindex")
async def reindex_knowledge(crop: Optional[str] = None):
    """Rebuild and persist the phase-1 SmartGrow corpus catalog."""
    try:
        crop_scope = _normalize_catalog_crop(crop)
        return {"status": "success", **rebuild_knowledge_catalog(crop_scope)}
    except Exception as exc:
        logger.error("Knowledge reindex failed: %s", exc, exc_info=True)
        raise HTTPException(
            status_code=500,
            detail="Knowledge reindex failed.",
        ) from exc


@app.post("/api/knowledge/query")
async def query_knowledge(req: KnowledgeQueryRequest):
    """Query persisted SmartGrow knowledge chunks from the SQLite knowledge DB."""
    try:
        crop_scope = _normalize_catalog_crop(req.crop)
        return {
            "status": "success",
            **query_knowledge_database(
                crop=crop_scope,
                query=req.query,
                limit=req.limit,
                filters=req.filters.model_dump(exclude_none=True) if req.filters else None,
            ),
        }
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.post("/api/models/snapshot")
async def create_model_snapshot(req: ModelSnapshotRequest):
    """Persist a normalized model snapshot from the active adapter state."""
    from .services.model_runtime.model_state_store import ModelStateStore

    crop = _validate_crop(req.crop)
    crop_state = app_state[crop]
    if crop_state["adapter"] is None:
        raise HTTPException(
            status_code=400,
            detail="Model runtime is inactive. Call /api/start first.",
        )

    greenhouse_id = _resolve_greenhouse_id(crop, req.greenhouse_id)
    store = ModelStateStore()
    adapter = _clone_adapter_from_raw_state(crop, crop_state["adapter"].dump_state())
    snapshot_record = _persist_model_snapshot(
        store=store,
        crop=crop,
        greenhouse_id=greenhouse_id,
        adapter=adapter,
        source=req.source or "live_app_state",
        metadata=_build_live_model_metadata(crop),
    )
    store.upsert_current_state(
        greenhouse_id=greenhouse_id,
        crop=crop,
        latest_snapshot_id=snapshot_record["snapshot_id"],
    )

    return {
        "status": "success",
        "snapshot_id": snapshot_record["snapshot_id"],
        "crop": crop,
        "greenhouse_id": greenhouse_id,
        "snapshot": snapshot_record["normalized_snapshot"],
        "store": store.describe(),
    }


@app.post("/api/models/replay")
async def replay_model_events(req: ModelReplayRequest):
    """Replay canonical work events over a stored or live model snapshot."""
    from .services.model_runtime.model_state_store import ModelStateStore

    crop = _validate_crop(req.crop)
    store = ModelStateStore()

    if req.snapshot_id:
        baseline_record = store.load_snapshot(req.snapshot_id)
        if baseline_record is None:
            raise HTTPException(status_code=404, detail=f"Unknown snapshot_id: {req.snapshot_id}")
        if baseline_record["crop"] != crop:
            raise HTTPException(
                status_code=400,
                detail="snapshot_id crop does not match replay crop.",
            )
        greenhouse_id = _resolve_greenhouse_id(
            crop,
            req.greenhouse_id or baseline_record["greenhouse_id"],
        )
        adapter = _clone_adapter_from_raw_state(crop, baseline_record["raw_adapter_state"])
    else:
        crop_state = app_state[crop]
        if crop_state["adapter"] is None:
            raise HTTPException(
                status_code=400,
                detail="Model runtime is inactive. Call /api/start first or provide snapshot_id.",
            )
        greenhouse_id = _resolve_greenhouse_id(crop, req.greenhouse_id)
        adapter = _clone_adapter_from_raw_state(crop, crop_state["adapter"].dump_state())
        baseline_record = _persist_model_snapshot(
            store=store,
            crop=crop,
            greenhouse_id=greenhouse_id,
            adapter=adapter,
            source="replay_baseline",
            metadata=_build_live_model_metadata(crop),
        )

    latest_snapshot_record = baseline_record
    applied_events: list[Dict[str, Any]] = []

    for event in req.events:
        event_payload = event.model_dump(exclude_none=True)
        event_time = event.event_time or datetime.now(UTC)
        try:
            effect = _apply_model_replay_event(crop, adapter, event_payload)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc
        latest_snapshot_record = _persist_model_snapshot(
            store=store,
            crop=crop,
            greenhouse_id=greenhouse_id,
            adapter=adapter,
            source=f"replay:{event.event_type}",
            metadata={"replay": True, "event_effect": effect},
            snapshot_time=event_time,
        )
        stored_event = store.persist_work_event(
            greenhouse_id=greenhouse_id,
            crop=crop,
            event_time=event_time,
            event_type=event.event_type,
            payload=event_payload,
            before_snapshot_id=baseline_record["snapshot_id"],
            after_snapshot_id=latest_snapshot_record["snapshot_id"],
            operator=event.operator,
            reason_code=event.reason_code,
            confidence=event.confidence,
        )
        applied_events.append(
            {
                "event_id": stored_event["event_id"],
                "before_snapshot_id": baseline_record["snapshot_id"],
                "after_snapshot_id": latest_snapshot_record["snapshot_id"],
                **effect,
            }
        )
        baseline_record = latest_snapshot_record

    latest_event_id = applied_events[-1]["event_id"] if applied_events else None
    store.upsert_current_state(
        greenhouse_id=greenhouse_id,
        crop=crop,
        latest_snapshot_id=latest_snapshot_record["snapshot_id"],
        latest_event_id=latest_event_id,
    )

    return {
        "status": "success",
        "crop": crop,
        "greenhouse_id": greenhouse_id,
        "initial_snapshot_id": (
            req.snapshot_id
            or (applied_events[0]["before_snapshot_id"] if applied_events else baseline_record["snapshot_id"])
        ),
        "final_snapshot_id": latest_snapshot_record["snapshot_id"],
        "events": applied_events,
        "snapshot": latest_snapshot_record["normalized_snapshot"],
        "store": store.describe(),
    }


@app.post("/api/models/scenario")
async def run_model_scenario(req: ModelScenarioRequest):
    """Run a bounded counterfactual scenario over a stored or live snapshot."""
    from .services.model_runtime.model_state_store import ModelStateStore
    from .services.model_runtime.scenario_runner import run_bounded_scenario

    crop = _validate_crop(req.crop)
    store = ModelStateStore()
    greenhouse_id, snapshot_record = _resolve_runtime_snapshot_record(
        store=store,
        crop=crop,
        greenhouse_id=req.greenhouse_id,
        snapshot_id=req.snapshot_id,
        source="scenario_baseline",
    )
    scenario_payload = run_bounded_scenario(
        snapshot_record,
        controls=req.controls.model_dump(exclude_none=True) if req.controls else None,
        horizons_hours=req.horizon_hours,
    )
    scenario_record = store.persist_scenario_run(
        snapshot_id=snapshot_record["snapshot_id"],
        greenhouse_id=greenhouse_id,
        crop=crop,
        controls=scenario_payload["controls"],
        horizons_hours=[int(row["horizon_hours"]) for row in scenario_payload["outputs"]],
        violated_constraints=scenario_payload["violated_constraints"],
        confidence_score=float(scenario_payload["confidence"]),
        scenario_label=req.scenario_label,
    )
    stored_outputs = store.persist_scenario_outputs(
        scenario_id=scenario_record["scenario_id"],
        greenhouse_id=greenhouse_id,
        crop=crop,
        outputs=scenario_payload["outputs"],
    )

    return {
        "status": "success",
        "scenario_id": scenario_record["scenario_id"],
        "snapshot_id": snapshot_record["snapshot_id"],
        "crop": crop,
        "greenhouse_id": greenhouse_id,
        "controls": scenario_payload["controls"],
        "baseline_outputs": scenario_payload["baseline_outputs"],
        "outputs": stored_outputs,
        "violated_constraints": scenario_payload["violated_constraints"],
        "confidence": scenario_payload["confidence"],
        "store": store.describe(),
    }


@app.post("/api/models/sensitivity")
async def compute_model_sensitivity(req: ModelSensitivityRequest):
    """Compute bounded local sensitivities over a stored or live snapshot."""
    from .services.model_runtime.model_state_store import ModelStateStore
    from .services.model_runtime.sensitivity_engine import compute_local_sensitivities

    crop = _validate_crop(req.crop)
    store = ModelStateStore()
    greenhouse_id, snapshot_record = _resolve_runtime_snapshot_record(
        store=store,
        crop=crop,
        greenhouse_id=req.greenhouse_id,
        snapshot_id=req.snapshot_id,
        source="sensitivity_baseline",
    )
    sensitivity_payload = compute_local_sensitivities(
        snapshot_record,
        derivative_target=req.target,
        horizon_hours=req.horizon_hours,
        controls=req.controls,
        step_overrides=req.step_overrides,
    )
    stored_rows = store.persist_sensitivity_outputs(
        snapshot_id=snapshot_record["snapshot_id"],
        greenhouse_id=greenhouse_id,
        crop=crop,
        horizon_hours=int(sensitivity_payload["horizon_hours"]),
        sensitivities=sensitivity_payload["sensitivities"],
    )

    return {
        "status": "success",
        "snapshot_id": snapshot_record["snapshot_id"],
        "crop": crop,
        "greenhouse_id": greenhouse_id,
        "horizon_hours": req.horizon_hours,
        "analysis_horizon_hours": sensitivity_payload["horizon_hours"],
        "target": req.target,
        "sensitivities": stored_rows,
        "confidence": sensitivity_payload["confidence"],
        "store": store.describe(),
    }


@app.post("/api/advisor/summary")
async def advisor_summary(req: AdvisorSummaryRequest):
    """Return a thin SmartGrow advisor summary over live context plus local knowledge."""
    _validate_crop(req.crop)
    try:
        return build_advisor_summary_response(
            crop=req.crop,
            dashboard=_augment_dashboard_with_knowledge_context(req.crop, req.dashboard),
            language=req.language or "ko",
        )
    except RuntimeError as exc:
        logger.warning("Advisor summary degraded gracefully: %s", exc)
        fallback_text = (
            "모델 상담을 잠시 사용할 수 없습니다. 잠시 후 다시 시도해 주세요."
            if (req.language or "ko") == "ko"
            else "AI advising is temporarily unavailable. Please try again shortly."
        )
        runtime_summary = (
            "요약 계산이 중단되어 모델 상태를 함께 보여주지 못했습니다."
            if (req.language or "ko") == "ko"
            else "Model runtime details are unavailable because summary generation degraded early."
        )
        return {
            "status": "degraded",
            "family": "advisor_summary",
            "crop": req.crop,
            "text": fallback_text,
            "machine_payload": {
                "domains": [],
                "context_completeness": 0.0,
                "missing_data": ["openai_unavailable"],
                "actions": [],
                "model_runtime": {
                    "status": "unavailable",
                    "summary": runtime_summary,
                    "state_snapshot": {},
                    "scenario": {"baseline_outputs": [], "options": [], "recommended": None},
                    "sensitivity": {
                        "target": None,
                        "analysis_horizon_hours": None,
                        "confidence": 0.0,
                        "top_levers": [],
                    },
                    "constraint_checks": {
                        "status": "unavailable",
                        "violated_constraints": [],
                        "penalties": {},
                    },
                    "recommendations": [],
                    "provenance": {
                        "source": "advisor_summary_fallback",
                        "reason": "openai_unavailable",
                    },
                },
            },
        }
    except Exception as exc:
        logger.error("Advisor summary failed: %s", exc, exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Advisor summary failed: {exc}",
        ) from exc


@app.post("/api/advisor/tab/{tab_name}")
async def advisor_tab(tab_name: str, req: AdvisorTabRequest):
    """Return a tab-specific SmartGrow advisor payload."""
    _validate_crop(req.crop)
    try:
        return build_advisor_tab_response(
            tab_name=tab_name,
            crop=req.crop,
            greenhouse_id=req.greenhouse_id,
            target=req.target,
            limit=req.limit,
            stage=req.stage,
            medium=req.medium,
            dashboard=_augment_dashboard_with_knowledge_context(req.crop, req.dashboard),
            source_water_mmol_l=req.source_water_mmol_l,
            drain_water_mmol_l=req.drain_water_mmol_l,
            working_solution_volume_l=req.working_solution_volume_l,
            stock_ratio=req.stock_ratio,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.post("/api/advisor/chat")
async def advisor_chat(req: AdvisorChatRequest):
    """Return a SmartGrow chat reply with orchestration metadata."""
    _validate_crop(req.crop)
    try:
        return build_advisor_chat_response(
            crop=req.crop,
            messages=req.messages,
            dashboard=_augment_dashboard_with_knowledge_context(req.crop, req.dashboard),
            language=req.language or "ko",
        )
    except RuntimeError as exc:
        logger.warning("Advisor chat degraded gracefully: %s", exc)
        fallback_text = (
            "모델 상담을 잠시 사용할 수 없습니다. 잠시 후 다시 시도해 주세요."
            if (req.language or "ko") == "ko"
            else "AI chat is temporarily unavailable. Please try again shortly."
        )
        runtime_summary = (
            "대화 응답 계산이 중단되어 모델 상태를 함께 보여주지 못했습니다."
            if (req.language or "ko") == "ko"
            else "Model runtime details are unavailable because chat generation degraded early."
        )
        return {
            "status": "degraded",
            "family": "advisor_chat",
            "crop": req.crop,
            "text": fallback_text,
            "machine_payload": {
                "domains": [],
                "context_completeness": 0.0,
                "missing_data": ["openai_unavailable"],
                "model_runtime": {
                    "status": "unavailable",
                    "summary": runtime_summary,
                    "state_snapshot": {},
                    "scenario": {"baseline_outputs": [], "options": [], "recommended": None},
                    "sensitivity": {
                        "target": None,
                        "analysis_horizon_hours": None,
                        "confidence": 0.0,
                        "top_levers": [],
                    },
                    "constraint_checks": {
                        "status": "unavailable",
                        "violated_constraints": [],
                        "penalties": {},
                    },
                    "recommendations": [],
                    "provenance": {
                        "source": "advisor_chat_fallback",
                        "reason": "openai_unavailable",
                    },
                },
            },
        }
    except Exception as exc:
        logger.error("Advisor chat failed: %s", exc, exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Advisor chat failed: {exc}",
        ) from exc


@app.post("/api/advisor/environment")
async def advisor_environment(req: AdvisorSurfaceRequest):
    """Return the additive environment advisor surface with the exact directive route."""
    _validate_crop(req.crop)
    try:
        return build_environment_advisor_response(
            crop=req.crop,
            greenhouse_id=req.greenhouse_id,
            dashboard=_augment_dashboard_with_knowledge_context(req.crop, req.dashboard),
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.post("/api/advisor/physiology")
async def advisor_physiology(req: AdvisorSurfaceRequest):
    """Return the additive physiology advisor surface with the exact directive route."""
    _validate_crop(req.crop)
    try:
        return build_physiology_advisor_response(
            crop=req.crop,
            greenhouse_id=req.greenhouse_id,
            dashboard=_augment_dashboard_with_knowledge_context(req.crop, req.dashboard),
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.post("/api/advisor/work-tradeoff")
async def advisor_work_tradeoff(req: AdvisorSurfaceRequest):
    """Return the work-tradeoff advisor contract over persisted work-event compare outputs."""
    _validate_crop(req.crop)
    try:
        return build_work_tradeoff_advisor_response(
            crop=req.crop,
            greenhouse_id=req.greenhouse_id,
            dashboard=_augment_dashboard_with_knowledge_context(req.crop, req.dashboard),
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.post("/api/advisor/harvest")
async def advisor_harvest(req: AdvisorSurfaceRequest):
    """Return the additive harvest advisor surface with the exact directive route."""
    _validate_crop(req.crop)
    try:
        return build_harvest_advisor_response(
            crop=req.crop,
            greenhouse_id=req.greenhouse_id,
            dashboard=_augment_dashboard_with_knowledge_context(req.crop, req.dashboard),
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.post("/api/environment/recommend")
async def recommend_environment_controls(req: EnvironmentRecommendationRequest):
    """Return deterministic environment-control guidance from the live dashboard."""
    _validate_crop(req.crop)
    try:
        return build_environment_recommendation_response(
            crop=req.crop,
            dashboard=_augment_dashboard_with_knowledge_context(req.crop, req.dashboard),
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.post("/api/work/recommend")
async def recommend_cultivation_work(req: WorkRecommendationRequest):
    """Return deterministic cultivation-work guidance from the live dashboard."""
    _validate_crop(req.crop)
    try:
        return build_work_recommendation_response(
            crop=req.crop,
            dashboard=_augment_dashboard_with_knowledge_context(req.crop, req.dashboard),
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.post("/api/pesticides/recommend")
async def recommend_pesticide_products(req: PesticideRecommendationRequest):
    """Return deterministic pesticide candidates from the SmartGrow workbook."""
    return build_pesticide_recommendation_response(
        crop=req.crop,
        target=req.target,
        limit=req.limit,
    )


@app.post("/api/nutrients/recommend")
async def recommend_nutrient_program(req: NutrientRecommendationRequest):
    """Return deterministic nutrient recipe lookup from the SmartGrow workbook."""
    return build_nutrient_recommendation_response(
        crop=req.crop,
        stage=req.stage,
        medium=req.medium,
    )


@app.post("/api/nutrients/correction")
async def recommend_nutrient_correction_draft(req: NutrientCorrectionRequest):
    """Return a deterministic nutrient correction draft from workbook baselines."""
    return build_nutrient_correction_response(
        crop=req.crop,
        stage=req.stage,
        medium=req.medium,
        source_water_mmol_l=req.source_water_mmol_l,
        drain_water_mmol_l=req.drain_water_mmol_l,
        working_solution_volume_l=req.working_solution_volume_l,
        stock_ratio=req.stock_ratio,
    )


@app.post("/api/ai/consult")
async def ai_consult(req: AiConsultRequest):
    """Generate consulting content using OpenAI."""
    if req.crop not in ["tomato", "cucumber"]:
        raise HTTPException(status_code=400, detail="crop must be 'tomato' or 'cucumber'")
    try:
        text = generate_consulting(
            crop=req.crop,
            dashboard=_augment_dashboard_with_knowledge_context(req.crop, req.dashboard),
            language=req.language or "ko",
        )
        return {"status": "success", "text": text}
    except RuntimeError as e:
        logger.warning("AI consult degraded gracefully: %s", e)
        text = (
            "모델 상담을 잠시 사용할 수 없습니다. 잠시 후 다시 시도해 주세요."
            if (req.language or "ko") == "ko"
            else "AI consulting is temporarily unavailable. Please try again shortly."
        )
        return {"status": "degraded", "text": text}
    except Exception as e:
        logger.error(f"AI consult error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"AI consult failed: {str(e)}")


@app.post("/api/ai/chat")
async def ai_chat(req: AiChatRequest):
    """Chat endpoint using OpenAI."""
    if req.crop not in ["tomato", "cucumber"]:
        raise HTTPException(status_code=400, detail="crop must be 'tomato' or 'cucumber'")
    try:
        text = generate_chat_reply(
            crop=req.crop,
            messages=req.messages,
            dashboard=_augment_dashboard_with_knowledge_context(req.crop, req.dashboard),
            language=req.language or "ko",
        )
        return {"status": "success", "text": text}
    except RuntimeError as e:
        logger.warning("AI chat degraded gracefully: %s", e)
        text = (
            "모델 상담을 잠시 사용할 수 없습니다. 잠시 후 다시 시도해 주세요."
            if (req.language or "ko") == "ko"
            else "AI chat is temporarily unavailable. Please try again shortly."
        )
        return {"status": "degraded", "text": text}
    except Exception as e:
        logger.error(f"AI chat error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"AI chat failed: {str(e)}")


@app.get("/api/weather/daegu")
async def get_daegu_weather():
    """Return a live Daegu current-conditions + 3-day weather outlook."""
    try:
        payload = await fetch_daegu_weather_outlook()
        return {"status": "success", **payload}
    except httpx.HTTPError as exc:
        logger.warning("Daegu weather fetch failed: %s", exc)
        raise HTTPException(
            status_code=502,
            detail="Failed to fetch live Daegu weather from Open-Meteo.",
        ) from exc


@app.get("/api/market/produce")
async def get_featured_produce_market_prices():
    """Return curated KAMIS retail/wholesale produce snapshots plus retail trends."""
    try:
        payload = await fetch_featured_produce_prices()
        return {"status": "success", **payload}
    except httpx.HTTPError as exc:
        logger.warning("KAMIS produce price fetch failed: %s", exc)
        raise HTTPException(
            status_code=502,
            detail="Failed to fetch live produce prices from KAMIS.",
        ) from exc
    except ValueError as exc:
        logger.warning("KAMIS produce price payload was invalid: %s", exc)
        raise HTTPException(
            status_code=502,
            detail=str(exc),
        ) from exc


@app.get("/api/rtr/profiles")
async def get_rtr_profiles():
    """Return the active RTR profile payload."""
    try:
        return {"status": "success", **load_rtr_profiles()}
    except Exception as exc:
        logger.error("Failed to load RTR profiles: %s", exc, exc_info=True)
        raise HTTPException(
            status_code=500,
            detail="Failed to load RTR profiles.",
        ) from exc



@app.post("/api/crop/prune")
async def mark_pruning_event(crop: str = "cucumber"):
    """Mark manual pruning event for cucumber."""
    if crop not in ["cucumber"]:
        raise HTTPException(status_code=400, detail="Pruning action is only available for cucumber")

    crop_state = app_state[crop]

    if crop_state["adapter"] is None:
        crop_state["pending_prune_reset"] = True
        logger.info("Queued cucumber pruning baseline reset until simulator start")
        return {
            "status": "success",
            "crop": crop,
            "adapter_active": False,
            "message": "Pruning baseline queued and will apply when the simulator starts.",
        }

    adapter = crop_state["adapter"]
    adapter.mark_pruned()

    # Trigger forecast update
    _schedule_forecast(crop)

    crop_state["pending_prune_reset"] = False
    return {"status": "success", "crop": crop, "adapter_active": True, "message": "Pruning baseline updated"}


@app.get("/api/config/crop")
async def get_crop_config(crop: str):
    """Get current crop configuration."""
    _validate_crop(crop)
    return _serialize_crop_config(crop)


@app.get("/api/recommendations")
async def get_recommendations(crop: Optional[str] = None):
    """Get AI-based crop management recommendations for one or both crops."""
    result = {}
    
    crops_to_check = [crop] if crop in ["tomato", "cucumber"] else ["tomato", "cucumber"]
    
    for crop_name in crops_to_check:
        crop_state = app_state[crop_name]
        
        if crop_state["adapter"] is None or crop_state["decision"] is None:
            continue
        
        # Get latest state
        adapter = crop_state["adapter"]
        last_state = adapter._last_state or {}
        kpi = adapter.kpis(last_state)
        
        # Get irrigation and energy data
        irrigation = crop_state.get("last_irrigation", {})
        energy = crop_state.get("last_energy", {})
        
        # Get recommendations
        recommendations = crop_state["decision"].get_recommendations(
            kpi, last_state, irrigation, energy, last_state
        )
        
        result[crop_name] = {
            "count": len(recommendations),
            "recommendations": recommendations,
        }
    
    return {
        "status": "success",
        "crops": result,
        "timestamp": datetime.now().isoformat()
    }


@app.get("/api/status")
async def get_status():
    """Get current system status for both greenhouses."""
    status_result = {}
    
    for crop_name in CROPS:
        crop_state = app_state[crop_name]
        
        if crop_state["simulator"] is None:
            status_result[crop_name] = {"status": "idle"}
        else:
            simulator = crop_state["simulator"]
            total_rows = len(simulator.df_env)
            at_end = total_rows > 0 and simulator.idx >= total_rows - 1
            if total_rows <= 1:
                progress = 100.0 if at_end else 0.0
            else:
                progress = round(
                    min(simulator.idx, total_rows - 1) / (total_rows - 1) * 100,
                    2,
                )

            status_result[crop_name] = {
                "status": "completed" if at_end else ("active" if simulator.running else "stopped"),
                "running": simulator.running,
                "at_end": at_end,
                "idx": simulator.idx,
                "total_rows": total_rows,
                "progress": progress,
                "time_step": crop_state.get("time_step", "auto"),
                "dt_minutes": round(crop_state.get("dt_hours", 0) * 60, 3)
                if crop_state.get("dt_hours")
                else None,
            }
    
    return {"status": "success", "greenhouses": status_result}


@app.get("/api/forecast/{crop}")
async def get_forecast(crop: str):
    """Get latest forecast for a crop."""
    if crop not in ["tomato", "cucumber"]:
        raise HTTPException(status_code=400, detail="crop must be 'tomato' or 'cucumber'")
    
    crop_state = app_state[crop]
    
    if crop_state.get("latest_forecast"):
        return crop_state["latest_forecast"]
        
    return {"daily": [], "total_harvest_kg": 0, "total_ETc_mm": 0, "total_energy_kWh": 0}


# ===== WebSocket Endpoints =====


@app.websocket("/ws/sim/tomato")
async def websocket_sim_tomato(websocket: WebSocket):
    """WebSocket endpoint for tomato simulation updates."""
    await manager.connect(websocket, "/ws/sim/tomato")
    try:
        while True:
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_text("pong")
    except WebSocketDisconnect:
        manager.disconnect(websocket, "/ws/sim/tomato")


@app.websocket("/ws/sim/cucumber")
async def websocket_sim_cucumber(websocket: WebSocket):
    """WebSocket endpoint for cucumber simulation updates."""
    await manager.connect(websocket, "/ws/sim/cucumber")
    try:
        while True:
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_text("pong")
    except WebSocketDisconnect:
        manager.disconnect(websocket, "/ws/sim/cucumber")


@app.websocket("/ws/forecast/tomato")
async def websocket_forecast_tomato(websocket: WebSocket):
    """WebSocket endpoint for tomato forecast updates."""
    await manager.connect(websocket, "/ws/forecast/tomato")
    try:
        while True:
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_text("pong")
    except WebSocketDisconnect:
        manager.disconnect(websocket, "/ws/forecast/tomato")


@app.websocket("/ws/forecast/cucumber")
async def websocket_forecast_cucumber(websocket: WebSocket):
    """WebSocket endpoint for cucumber forecast updates."""
    await manager.connect(websocket, "/ws/forecast/cucumber")
    try:
        while True:
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_text("pong")
    except WebSocketDisconnect:
        manager.disconnect(websocket, "/ws/forecast/cucumber")


@app.get("/")
async def root():
    """Root endpoint."""
    return {
        "name": "1000-pyeong Greenhouse Dashboard API",
        "version": "1.0.0",
        "docs": "/docs",
    }


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "model_informed_greenhouse_dashboard.backend.app.main:app",
        host=settings.host,
        port=settings.port,
        reload=settings.debug,
        reload_dirs=[str(Path(__file__).resolve().parent)],
    )
