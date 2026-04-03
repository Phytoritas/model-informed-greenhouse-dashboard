"""Main FastAPI application entry point."""

import logging
from contextlib import asynccontextmanager
from datetime import datetime
from pathlib import Path
import httpx
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Dict, Any, Optional, Literal

from .config import settings, greenhouse_config
from .ws import manager
from .services.ingest import BatchIngestor
from .services.simulator import Simulator
from .services.forecast import BranchForecaster
from .services.irrigation import IrrigationAdvisor
from .services.energy import EnergyEstimator
from .services.decision import DecisionSupport
from .services.openai_service import generate_consulting, generate_chat_reply
from .services.rtr_profiles import load_rtr_profiles
from .services.weather import fetch_daegu_weather_outlook
from .adapters.tomato import TomatoAdapter
from .adapters.cucumber import CucumberAdapter
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


@app.post("/api/ai/consult")
async def ai_consult(req: AiConsultRequest):
    """Generate consulting content using OpenAI."""
    if req.crop not in ["tomato", "cucumber"]:
        raise HTTPException(status_code=400, detail="crop must be 'tomato' or 'cucumber'")
    try:
        text = generate_consulting(crop=req.crop, dashboard=req.dashboard, language=req.language or "ko")
        return {"status": "success", "text": text}
    except RuntimeError as e:
        logger.warning("AI consult degraded gracefully: %s", e)
        return {"status": "degraded", "text": f"AI consulting is unavailable: {e}"}
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
            dashboard=req.dashboard,
            language=req.language or "ko",
        )
        return {"status": "success", "text": text}
    except RuntimeError as e:
        logger.warning("AI chat degraded gracefully: %s", e)
        return {"status": "degraded", "text": f"AI chat is unavailable: {e}"}
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
