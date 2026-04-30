"""Main FastAPI application entry point."""

import asyncio
import copy
import json
import logging
from contextlib import asynccontextmanager
from datetime import UTC, datetime, timedelta
from pathlib import Path
from zoneinfo import ZoneInfo
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
    build_advisor_chat_fallback_response,
    build_advisor_chat_response,
    build_environment_advisor_response,
    build_environment_recommendation_response,
    build_harvest_advisor_response,
    build_advisor_summary_fallback_response,
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
from .services.produce_prices import (
    build_featured_produce_prices_fallback_payload,
    fetch_featured_produce_prices,
)
from .services.rtr_profiles import (
    aggregate_daily_rtr_metrics,
    filter_rtr_good_windows_for_house,
    fit_rtr_profile,
    load_rtr_good_windows,
    load_rtr_profiles,
    normalize_rtr_good_windows,
    save_rtr_good_windows,
    save_rtr_profiles,
    select_rtr_calibration_days,
    upsert_rtr_good_windows,
)
from .services.weather import fetch_daegu_weather_outlook
from .schemas import AlertHistoryRequest, ControlStateUpdate, OpsConfig, CropConfig

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


class RTRGuardrailRequest(BaseModel):
    max_temp_delta_per_step: Optional[float] = None
    max_rtr_ratio_delta: Optional[float] = None
    humidity_risk_tolerance: Optional[float] = None
    disease_risk_tolerance: Optional[float] = None


class RTROptimizeRequest(BaseModel):
    crop: str
    greenhouse_id: Optional[str] = None
    snapshot_id: Optional[str] = None
    target_node_development_per_day: float
    optimization_mode: Literal[
        "growth_priority",
        "balanced",
        "energy_saving",
        "labor_saving",
        "custom_weights",
        "yield_priority",
        "energy_priority",
        "labor_priority",
        "cooling_saving",
        "heating_saving",
    ] = "balanced"
    include_energy_cost: bool = True
    include_labor_cost: bool = False
    include_cooling_cost: bool = True
    user_actual_area_pyeong: Optional[float] = None
    user_actual_area_m2: Optional[float] = None
    target_horizon: Literal["today", "next_24h", "day+night split"] = "today"
    custom_weights: Optional[Dict[str, float]] = None
    guardrails: Optional[RTRGuardrailRequest] = None
    user_labor_cost_coefficient: Optional[float] = None


class RTRCustomScenarioRequest(BaseModel):
    label: Optional[str] = "custom"
    day_min_temp_C: Optional[float] = None
    night_min_temp_C: Optional[float] = None
    day_heating_min_temp_C: Optional[float] = None
    night_heating_min_temp_C: Optional[float] = None
    day_cooling_target_C: Optional[float] = None
    night_cooling_target_C: Optional[float] = None
    vent_bias_C: Optional[float] = 0.0
    screen_bias_pct: Optional[float] = 0.0
    circulation_fan_pct: Optional[float] = None
    co2_target_ppm: Optional[float] = None
    rh_target_pct: Optional[float] = None
    dehumidification_bias: Optional[float] = None
    fogging_or_evap_cooling_intensity: Optional[float] = None


class RTRScenarioRequest(RTROptimizeRequest):
    custom_scenario: Optional[RTRCustomScenarioRequest] = None


class RTRSensitivityRequest(RTROptimizeRequest):
    step_c: float = 0.3


class RTRAreaSettingsRequest(BaseModel):
    crop: str
    greenhouse_id: Optional[str] = None
    user_actual_area_pyeong: Optional[float] = None
    user_actual_area_m2: Optional[float] = None


class RTRCalibrationWindowRequest(BaseModel):
    label: Optional[str] = None
    startDate: str
    endDate: str
    enabled: bool = True
    notes: Optional[str] = None
    houseId: Optional[str] = None
    approvalStatus: Literal[
        "heuristic-demo",
        "concept-demo",
        "grower-approved",
        "manager-approved",
        "consultant-approved",
        "internal-review",
    ] = "grower-approved"
    approvalSource: Optional[str] = None
    approvalReason: Optional[str] = None
    evidenceNotes: Optional[str] = None


class RTRCalibrationPreviewRequest(BaseModel):
    crop: str
    greenhouse_id: Optional[str] = None
    selection_mode: Literal["auto", "windows-only", "heuristic-only"] = "windows-only"
    windows: list[RTRCalibrationWindowRequest] = Field(default_factory=list)


class RTRCalibrationSaveRequest(RTRCalibrationPreviewRequest):
    pass

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
        "last_forecast_schedule_at": None,
        "ops_config": None,
        "control_state": None,
        "alert_history": None,
        "crop_config": None,
        "csv_filename": None,
        "pending_prune_reset": False,
        "rtr_area_settings": {},
        "last_runtime_snapshot_at": None,
        "last_runtime_tick_at": None,
        "last_runtime_error": None,
        "last_runtime_error_at": None,
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
        "last_forecast_schedule_at": None,
        "ops_config": None,
        "control_state": None,
        "alert_history": None,
        "crop_config": None,
        "csv_filename": None,
        "pending_prune_reset": False,
        "rtr_area_settings": {},
        "last_runtime_snapshot_at": None,
        "last_runtime_tick_at": None,
        "last_runtime_error": None,
        "last_runtime_error_at": None,
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
MODEL_RUNTIME_SNAPSHOT_INTERVAL = timedelta(hours=1)
SIMULATION_TASK_STALL_THRESHOLD = timedelta(seconds=8)
FORECAST_MIN_RESCHEDULE_INTERVAL = timedelta(
    seconds=max(1, int(settings.forecast_min_reschedule_seconds))
)
OVERVIEW_LIVE_SOURCE_SINK_SOURCES = (
    "simulation_run",
    "simulation_stream",
    "overview_signals",
)
OVERVIEW_SIGNAL_TIMEZONE = ZoneInfo("Asia/Seoul")
ALERT_HISTORY_STORE_PATH = (
    Path(settings.config_dir).resolve().parent
    / "artifacts"
    / "alerts"
    / "alert_history.json"
)
ALERT_HISTORY_LIMIT = 100


def _default_ops_config() -> Dict[str, float]:
    return {
        "heating_set_C": greenhouse_config["operations"]["heating_set_C"],
        "cooling_set_C": greenhouse_config["operations"]["cooling_set_C"],
        "p_band_C": greenhouse_config["operations"]["p_band_C"],
        "co2_target_ppm": greenhouse_config["operations"]["co2_target_ppm"],
        "drain_target_fraction": greenhouse_config["substrate"]["drain_target_fraction"],
    }


def _default_control_state() -> Dict[str, Any]:
    return {
        "ventilation": False,
        "irrigation": False,
        "heating": False,
        "shading": False,
        "mode": "manual-ui",
        "source": "backend-default",
        "updated_at": None,
    }


def _read_alert_history_store() -> Dict[str, list[Dict[str, Any]]]:
    if not ALERT_HISTORY_STORE_PATH.exists():
        return {crop: [] for crop in CROPS}

    try:
        payload = json.loads(ALERT_HISTORY_STORE_PATH.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        logger.warning("Failed to read alert history store: %s", ALERT_HISTORY_STORE_PATH)
        return {crop: [] for crop in CROPS}

    if not isinstance(payload, dict):
        return {crop: [] for crop in CROPS}

    return {
        crop: payload.get(crop, []) if isinstance(payload.get(crop, []), list) else []
        for crop in CROPS
    }


def _write_alert_history_store(store: Dict[str, list[Dict[str, Any]]]) -> None:
    ALERT_HISTORY_STORE_PATH.parent.mkdir(parents=True, exist_ok=True)
    payload = {crop: list(store.get(crop, []))[:ALERT_HISTORY_LIMIT] for crop in CROPS}
    ALERT_HISTORY_STORE_PATH.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2, sort_keys=True),
        encoding="utf-8",
    )


def _default_crop_config(crop: str) -> Dict[str, int]:
    if crop == "tomato":
        return {"n_fruits_per_truss": 4}

    return {
        "pruning_threshold": 18,
        "target_leaf_count": 15,
        "current_leaf_count": 0,
    }


def _normalize_crop_key(crop: str) -> str:
    normalized_crop = crop.strip().lower() if isinstance(crop, str) else ""
    if normalized_crop not in CROPS:
        raise HTTPException(status_code=400, detail="crop must be 'tomato' or 'cucumber'")

    return normalized_crop


def _validate_crop(crop: str) -> str:
    return _normalize_crop_key(crop)


def _target_crops(crop: Optional[str] = None) -> list[str]:
    if crop is None:
        return list(CROPS)

    return [_validate_crop(crop)]


def _normalize_catalog_crop(crop: Optional[str] = None) -> Optional[str]:
    if crop is None:
        return None

    normalized_crop = crop.strip().lower()
    if normalized_crop in ("", "all"):
        return None

    return _validate_crop(normalized_crop)


def _should_rebuild_knowledge_catalog(payload: Dict[str, Any]) -> bool:
    database = payload.get("database") if isinstance(payload, dict) else {}
    retrieval_surface = payload.get("retrieval_surface") if isinstance(payload, dict) else {}
    if not isinstance(database, dict):
        return True
    if database.get("status") != "ready":
        return True
    if int(database.get("document_count") or 0) <= 0:
        return True
    if int(database.get("chunk_count") or 0) <= 0:
        return True
    if isinstance(retrieval_surface, dict) and retrieval_surface.get("status") == "ready":
        return False
    return True


def _ensure_knowledge_catalog_ready(
    crop_scope: Optional[str],
    *,
    allow_bootstrap: bool = True,
) -> tuple[Dict[str, Any], bool]:
    payload = build_knowledge_catalog(crop_scope)
    if not allow_bootstrap:
        return payload, False

    if not _should_rebuild_knowledge_catalog(payload):
        return payload, False

    logger.info(
        "Knowledge catalog bootstrap triggered (crop_scope=%s) because retrieval surface was not ready.",
        crop_scope or "all",
    )
    rebuilt_payload = rebuild_knowledge_catalog(crop_scope)
    return rebuilt_payload, True


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


def _normalize_snapshot_datetime(value: Any) -> Optional[datetime]:
    if isinstance(value, datetime):
        return value if value.tzinfo else value.replace(tzinfo=UTC)
    if isinstance(value, str) and value:
        try:
            parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
        except ValueError:
            return None
        return parsed if parsed.tzinfo else parsed.replace(tzinfo=UTC)
    return None


def _normalize_simulation_datetime(value: Any) -> Optional[datetime]:
    if isinstance(value, datetime):
        normalized = value
    elif isinstance(value, str) and value:
        try:
            normalized = datetime.fromisoformat(value.replace("Z", "+00:00"))
        except ValueError:
            return None
    else:
        return None

    if normalized.tzinfo is None:
        return normalized.replace(tzinfo=OVERVIEW_SIGNAL_TIMEZONE)
    return normalized.astimezone(OVERVIEW_SIGNAL_TIMEZONE)


def _serialize_datetime(value: Optional[datetime]) -> Optional[str]:
    if not isinstance(value, datetime):
        return None
    normalized = value if value.tzinfo else value.replace(tzinfo=UTC)
    return normalized.isoformat()


def _is_meaningful_source_sink_snapshot(
    *,
    source_capacity: float,
    sink_demand: float,
    source_sink_balance: float,
) -> bool:
    epsilon = 1e-6
    return any(
        abs(metric) > epsilon
        for metric in (source_capacity, sink_demand, source_sink_balance)
    )


def _record_runtime_tick(crop: str, *, tick_at: Optional[datetime] = None) -> None:
    crop_state = app_state[crop]
    normalized = tick_at or datetime.now(UTC)
    crop_state["last_runtime_tick_at"] = (
        normalized if normalized.tzinfo else normalized.replace(tzinfo=UTC)
    )
    crop_state["last_runtime_error"] = None
    crop_state["last_runtime_error_at"] = None


def _record_runtime_error(crop: str, exc: Exception | str) -> None:
    crop_state = app_state[crop]
    crop_state["last_runtime_error"] = str(exc)
    crop_state["last_runtime_error_at"] = datetime.now(UTC)


def _maybe_persist_runtime_snapshot(
    crop: str,
    *,
    greenhouse_id: Optional[str] = None,
    source: str = "simulation_stream",
    snapshot_time: Optional[datetime] = None,
) -> Dict[str, Any] | None:
    from .services.model_runtime.model_state_store import ModelStateStore

    crop_state = app_state[crop]
    adapter = crop_state.get("adapter")
    if adapter is None:
        return None

    snapshot_dt = (
        snapshot_time
        or getattr(adapter, "_last_datetime", None)
        or datetime.now(UTC)
    )
    snapshot_dt = snapshot_dt if snapshot_dt.tzinfo else snapshot_dt.replace(tzinfo=UTC)
    last_snapshot_at = crop_state.get("last_runtime_snapshot_at")
    if (
        isinstance(last_snapshot_at, datetime)
        and snapshot_dt >= last_snapshot_at
        and snapshot_dt - last_snapshot_at < MODEL_RUNTIME_SNAPSHOT_INTERVAL
    ):
        return None

    resolved_greenhouse_id = _resolve_greenhouse_id(crop, greenhouse_id)
    store = ModelStateStore()
    snapshot_record = _persist_model_snapshot(
        store=store,
        crop=crop,
        greenhouse_id=resolved_greenhouse_id,
        adapter=adapter,
        source=source,
        metadata=_build_live_model_metadata(crop),
        snapshot_time=snapshot_dt,
    )
    store.upsert_current_state(
        greenhouse_id=resolved_greenhouse_id,
        crop=crop,
        latest_snapshot_id=snapshot_record["snapshot_id"],
    )
    crop_state["last_runtime_snapshot_at"] = snapshot_dt
    return snapshot_record


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


def _get_control_state(crop: str) -> Dict[str, Any]:
    crop_state = app_state[crop]
    control_state = crop_state.get("control_state")
    if control_state is None:
        control_state = _default_control_state()
        crop_state["control_state"] = control_state

    return control_state


def _serialize_control_state(crop: str) -> Dict[str, Any]:
    control_state = _get_control_state(crop)
    return {
        "crop": crop,
        "mode": control_state.get("mode", "manual-ui"),
        "source": control_state.get("source", "backend"),
        "updated_at": control_state.get("updated_at"),
        "devices": {
            "ventilation": bool(control_state.get("ventilation", False)),
            "irrigation": bool(control_state.get("irrigation", False)),
            "heating": bool(control_state.get("heating", False)),
            "shading": bool(control_state.get("shading", False)),
        },
    }


def _load_alert_history(crop: str) -> list[Dict[str, Any]]:
    crop_state = app_state[crop]
    history = crop_state.get("alert_history")
    if history is None:
        history = list(_read_alert_history_store().get(crop, []))
        crop_state["alert_history"] = history

    return history


def _serialize_alert_history(crop: str, limit: int = 25) -> Dict[str, Any]:
    history = _load_alert_history(crop)
    resolved_limit = max(1, min(int(limit), ALERT_HISTORY_LIMIT))
    return {
        "status": "success",
        "crop": crop,
        "source": {
            "provider": "backend-alert-history",
            "persisted": True,
            "path": str(ALERT_HISTORY_STORE_PATH),
        },
        "events": history[:resolved_limit],
    }


def _upsert_alert_history_events(
    crop: str,
    events: list[Dict[str, Any]],
) -> Dict[str, Any]:
    history = _load_alert_history(crop)
    now_iso = datetime.now(UTC).isoformat()
    event_by_id = {str(item.get("id")): item for item in history if item.get("id")}
    changed = False

    for event in events:
        event_id = str(event["id"])
        next_event = {
            "id": event_id,
            "severity": event["severity"],
            "title": event["title"],
            "body": event.get("body", ""),
            "source": event.get("source") or "frontend",
            "observed_at": _serialize_datetime(event.get("observed_at")) or now_iso,
            "last_seen_at": now_iso,
            "crop": crop,
        }
        existing = event_by_id.get(event_id)
        if existing:
            existing.update(next_event)
        else:
            history.insert(0, next_event)
            event_by_id[event_id] = next_event
        changed = True

    if changed:
        del history[ALERT_HISTORY_LIMIT:]
        store = _read_alert_history_store()
        store[crop] = history
        _write_alert_history_store(store)

    return _serialize_alert_history(crop)


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


def _get_rtr_area_settings_store(crop: str) -> Dict[str, Dict[str, float]]:
    crop_state = app_state[crop]
    settings_store = crop_state.get("rtr_area_settings")
    if not isinstance(settings_store, dict):
        settings_store = {}
        crop_state["rtr_area_settings"] = settings_store
    return settings_store


def _resolve_rtr_area_meta(
    crop: str,
    greenhouse_id: str,
    *,
    user_actual_area_m2: Optional[float] = None,
    user_actual_area_pyeong: Optional[float] = None,
) -> Dict[str, float | None]:
    from .services.rtr.unit_projection import canonicalize_area

    stored_settings = _get_rtr_area_settings_store(crop).get(greenhouse_id) or {}
    resolved_area_m2 = (
        user_actual_area_m2 if user_actual_area_m2 is not None else stored_settings.get("actual_area_m2")
    )
    resolved_area_pyeong = (
        user_actual_area_pyeong
        if user_actual_area_pyeong is not None
        else stored_settings.get("actual_area_pyeong")
    )
    return canonicalize_area(
        greenhouse_area_m2=float(greenhouse_config["greenhouse"]["area_m2"]),
        user_actual_area_m2=None if resolved_area_m2 is None else float(resolved_area_m2),
        user_actual_area_pyeong=None if resolved_area_pyeong is None else float(resolved_area_pyeong),
    )


def _build_rtr_provisional_state_response(crop: str, greenhouse_id: Optional[str] = None) -> Dict[str, Any]:
    from .services.rtr.control_effects import build_actuator_availability

    resolved_greenhouse_id = _resolve_greenhouse_id(crop, greenhouse_id)
    area_meta = _resolve_rtr_area_meta(crop, resolved_greenhouse_id)
    profile_key = "Cucumber" if crop == "cucumber" else "Tomato"
    profile_payload = (load_rtr_profiles().get("profiles") or {}).get(profile_key) or {}
    baseline_payload = profile_payload.get("baseline") or {}
    optimizer_payload = profile_payload.get("optimizer") or {}
    baseline_target_c = float(
        baseline_payload.get(
            "baseTempC",
            greenhouse_config["operations"].get("heating_set_C", 18.0),
        )
    )
    greenhouse_area_m2 = float(greenhouse_config["greenhouse"]["area_m2"])
    actual_area_m2 = float(area_meta["actual_area_m2"] or greenhouse_area_m2)
    actual_area_pyeong = float(area_meta["actual_area_pyeong"] or 0.0)
    zero_units_projection = {
        "greenhouse_area_m2": greenhouse_area_m2,
        "actual_area_m2": actual_area_m2,
        "actual_area_pyeong": actual_area_pyeong,
        "yield_proxy_kg_m2_day": 0.0,
        "yield_proxy_kg_m2_week": 0.0,
        "energy_kwh_m2_day": 0.0,
        "energy_krw_m2_day": 0.0,
        "heating_energy_kwh_m2_day": 0.0,
        "cooling_energy_kwh_m2_day": 0.0,
        "labor_index_m2_day": 0.0,
        "labor_hours_m2_day": 0.0,
        "labor_cost_krw_m2_day": 0.0,
        "node_development_day": 0.0,
        "gross_margin_proxy_krw_m2_day": 0.0,
    }
    actual_area_projection = {
        "actual_area_m2": actual_area_m2,
        "actual_area_pyeong": actual_area_pyeong,
        "yield_kg_day": 0.0,
        "yield_kg_week": 0.0,
        "energy_kwh_day": 0.0,
        "energy_krw_day": 0.0,
        "heating_energy_kwh_day": 0.0,
        "cooling_energy_kwh_day": 0.0,
        "labor_index_day": 0.0,
        "labor_hours_day": 0.0,
        "labor_cost_krw_day": 0.0,
        "margin_krw_day": 0.0,
    }
    canonical_state = {
        "timestamp": datetime.now(UTC).isoformat().replace("+00:00", "Z"),
        "crop": crop,
        "greenhouse_id": resolved_greenhouse_id,
        "env": {
            "T_air_C": 0.0,
            "T_canopy_C": 0.0,
            "RH_pct": 0.0,
            "VPD_kPa": 0.0,
            "CO2_ppm": 0.0,
            "PAR_umol_m2_s": 0.0,
            "outside_T_C": 0.0,
        },
        "flux": {
            "gross_assim_umol_m2_s": 0.0,
            "net_assim_umol_m2_s": 0.0,
            "respiration_proxy_umol_m2_s": 0.0,
            "transpiration_g_m2_s": 0.0,
            "latent_heat_W_m2": 0.0,
            "sensible_heat_W_m2": 0.0,
            "stomatal_conductance_m_s": 0.0,
        },
        "growth": {
            "LAI": 0.0,
            "node_count": 0.0,
            "predicted_node_rate_day": 0.0,
            "fruit_load": 0.0,
            "sink_demand": 0.0,
            "source_capacity": 0.0,
            "vegetative_dry_matter_g_m2": 0.0,
            "fruit_dry_matter_g_m2": 0.0,
            "harvested_fruit_dry_matter_g_m2": 0.0,
        },
        "crop_specific": {
            "cucumber": {
                "leaf_area_by_rank": [],
                "upper_leaf_activity": 0.0,
                "middle_leaf_activity": 0.0,
                "bottom_leaf_activity": 0.0,
                "remaining_leaves": 0.0,
            },
            "tomato": {
                "truss_cohorts": [],
                "active_trusses": 0.0,
                "fruit_partition_ratio": 0.0,
            },
        },
        "energy": {
            "Q_load_kW": 0.0,
            "P_elec_kW": 0.0,
            "COP_current": 0.0,
            "daily_kWh": 0.0,
        },
        "events": {
            "recent_leaf_removal": [],
            "recent_fruit_thinning": [],
            "recent_harvest": [],
            "recent_setpoint_changes": [],
        },
        "baseline_rtr": {
            "baseTempC": float(baseline_payload.get("baseTempC", baseline_target_c)),
            "slopeCPerMjM2": float(baseline_payload.get("slopeCPerMjM2", 0.0)),
            "baseline_target_C": baseline_target_c,
        },
        "optimizer": optimizer_payload,
    }
    return {
        "status": "provisional",
        "crop": crop,
        "greenhouse_id": resolved_greenhouse_id,
        "snapshot_id": "runtime-inactive",
        "canonical_state": canonical_state,
        "baseline_rtr": canonical_state["baseline_rtr"],
        "optimizer_enabled": bool(optimizer_payload.get("enabled", False)),
        "area_unit_meta": area_meta,
        "actuator_availability": build_actuator_availability(_get_ops_config(crop)).as_dict(),
        "optimizer_defaults": optimizer_payload,
        "current_per_m_projections": zero_units_projection,
        "current_actual_area_projection": actual_area_projection,
        "current_control_effect_trace": {},
        "current_risk_flags": [
            {
                "kind": "runtime_inactive",
                "severity": "info",
                "message": "Model runtime is inactive. Start the simulator to unlock live RTR state.",
            }
        ],
    }


def _get_crop_cost_per_kwh(crop: str) -> float:
    decision_service = app_state[crop].get("decision")
    settings_payload = getattr(decision_service, "settings", None) if decision_service else None
    if isinstance(settings_payload, dict):
        try:
            return float(settings_payload.get("cost_per_kwh", 120.0))
        except (TypeError, ValueError):
            return 120.0
    return 120.0


def _build_rtr_request_bundle(req_payload: Dict[str, Any]):
    from .services.model_runtime.model_state_store import ModelStateStore
    from .services.rtr.controller_contract import build_service_inputs
    from .services.rtr.internal_model_bridge import build_internal_model_context

    crop = _validate_crop(req_payload["crop"])
    store = ModelStateStore()
    greenhouse_id, snapshot_record = _resolve_runtime_snapshot_record(
        store=store,
        crop=crop,
        greenhouse_id=req_payload.get("greenhouse_id"),
        snapshot_id=req_payload.get("snapshot_id"),
        source="rtr_optimizer_baseline",
    )
    area_meta = _resolve_rtr_area_meta(
        crop,
        greenhouse_id,
        user_actual_area_m2=req_payload.get("user_actual_area_m2"),
        user_actual_area_pyeong=req_payload.get("user_actual_area_pyeong"),
    )
    optimization_inputs = build_service_inputs(req_payload, greenhouse_id=greenhouse_id)
    profiles_payload = load_rtr_profiles()
    recent_events = store.list_work_events(greenhouse_id, crop, limit=12)
    context = build_internal_model_context(
        snapshot_record=snapshot_record,
        crop_state=app_state[crop],
        greenhouse_id=greenhouse_id,
        profiles_payload=profiles_payload,
        recent_events=recent_events,
        actual_area_m2=float(area_meta["actual_area_m2"] or greenhouse_config["greenhouse"]["area_m2"]),
        cost_per_kwh=_get_crop_cost_per_kwh(crop),
    )
    return crop, store, greenhouse_id, snapshot_record, profiles_payload, area_meta, optimization_inputs, context


def _get_rtr_profile_crop_key(crop: str) -> str:
    return "Tomato" if crop == "tomato" else "Cucumber"


def _build_rtr_calibration_environment_summary(crop: str, profiles_payload: Dict[str, Any]) -> tuple[Any, Dict[str, Any]]:
    env_df = app_state[crop].get("df_env")
    if env_df is None or len(env_df) == 0:
        return None, {
            "has_environment_history": False,
            "start_date": None,
            "end_date": None,
            "total_rows": 0,
            "total_days": 0,
        }

    crop_key = _get_rtr_profile_crop_key(crop)
    light_to_radiant_divisor = float(
        profiles_payload.get("profiles", {}).get(crop_key, {}).get("lightToRadiantDivisor", 4.57)
    )
    daily_df = aggregate_daily_rtr_metrics(
        env_df,
        light_to_radiant_divisor=light_to_radiant_divisor,
    )
    if daily_df.empty:
        return daily_df, {
            "has_environment_history": True,
            "start_date": None,
            "end_date": None,
            "total_rows": int(len(env_df)),
            "total_days": 0,
        }

    return daily_df, {
        "has_environment_history": True,
        "start_date": str(daily_df["date"].min()),
        "end_date": str(daily_df["date"].max()),
        "total_rows": int(len(env_df)),
        "total_days": int(len(daily_df)),
    }


def _serialize_rtr_calibration_windows(
    crop: str,
    greenhouse_id: str,
    raw_windows: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    normalized_windows = normalize_rtr_good_windows(raw_windows, greenhouse_id=greenhouse_id)
    return filter_rtr_good_windows_for_house(
        {
            "crops": {
                _get_rtr_profile_crop_key(crop): normalized_windows,
            }
        },
        crop,
        greenhouse_id,
    )


def _build_rtr_calibration_preview_payload(
    *,
    crop: str,
    greenhouse_id: str,
    selection_mode: str,
    windows: list[dict[str, Any]],
    profiles_payload: Dict[str, Any],
) -> Dict[str, Any]:
    daily_df, environment_summary = _build_rtr_calibration_environment_summary(crop, profiles_payload)
    if daily_df is None:
        raise HTTPException(
            status_code=400,
            detail="RTR calibration preview requires loaded environment history. Start the crop simulator first.",
        )

    crop_key = _get_rtr_profile_crop_key(crop)
    preview_profile = fit_rtr_profile(
        crop_key,
        daily_df,
        calibration_windows=windows,
        selection_mode=selection_mode,
    )
    filtered_df, selection_metadata = select_rtr_calibration_days(
        crop_key,
        daily_df,
        calibration_windows=windows,
        selection_mode=selection_mode,
    )
    return {
        "status": "success",
        "crop": crop,
        "greenhouse_id": greenhouse_id,
        "selection_mode": selection_mode,
        "windows": windows,
        "preview_profile": preview_profile,
        "environment_summary": environment_summary,
        "selection_summary": {
            "filtered_days": int(len(filtered_df)),
            "pre_filter_days": int(selection_metadata.get("preFilterDays", 0)),
            "selection_source": selection_metadata.get("selectionSource", "heuristic-fallback"),
            "window_count": int(selection_metadata.get("windowCount", 0)),
        },
    }


def _build_rtr_baseline_candidate(context, optimization_inputs):
    from .services.rtr.control_effects import build_baseline_control_candidate
    from .services.rtr.objective_terms import evaluate_rtr_candidate

    baseline_candidate = build_baseline_control_candidate(
        env=context.canonical_state["env"],
        ops_config=context.ops_config,
        baseline_target_c=float(context.canonical_state["baseline_rtr"]["baseline_target_C"]),
    )
    return evaluate_rtr_candidate(
        context=context,
        optimization_inputs=optimization_inputs,
        weights={
            "temp": 1.0,
            "node": 0.0,
            "carbon": 0.0,
            "sink": 0.0,
            "resp": 0.0,
            "risk": 0.0,
            "energy": 0.0,
            "labor": 0.0,
            "assim": 0.0,
            "yield": 0.0,
            "heating": 0.0,
            "cooling": 0.0,
            "ventilation": 0.0,
            "humidity": 0.0,
            "disease": 0.0,
            "stress": 0.0,
        },
        day_min_temp_c=baseline_candidate.day_heating_min_temp_C,
        night_min_temp_c=baseline_candidate.night_heating_min_temp_C,
        day_cooling_target_c=baseline_candidate.day_cooling_target_C,
        night_cooling_target_c=baseline_candidate.night_cooling_target_C,
        co2_target_ppm=baseline_candidate.co2_target_ppm,
        rh_target_pct=float(context.canonical_state["env"]["RH_pct"]),
    )


def _resolve_active_rtr_weights(context, optimization_inputs):
    from .services.rtr.controller_contract import build_weight_vector

    optimizer_defaults = (
        context.canonical_state.get("optimizer")
        or context.crop_profile.get("optimizer")
        or {}
    )
    return build_weight_vector(
        optimizer_defaults,
        optimization_inputs.optimization_mode,
        include_energy_cost=optimization_inputs.include_energy_cost,
        include_labor_cost=optimization_inputs.include_labor_cost,
        include_cooling_cost=optimization_inputs.include_cooling_cost,
        custom_weights=optimization_inputs.custom_weights,
    )


def _coalesce_optional_number(*values, default):
    for value in values:
        if value is not None:
            return float(value)
    return float(default)


def _estimate_rtr_yield_proxy_kg_m2_day(context) -> float:
    last_state = copy.deepcopy(getattr(context.adapter, "_last_state", None) or {})
    kpi_payload = context.adapter.kpis(last_state)
    if context.canonical_state["crop"] == "tomato":
        return float(kpi_payload.get("daily_harvest_kg", 0.0)) / max(context.greenhouse_area_m2, 1.0)
    return float(kpi_payload.get("daily_fruit_growth_g_m2", 0.0)) / 1000.0


def _build_rtr_crop_specific_insight(context) -> Dict[str, Any]:
    crop = context.canonical_state["crop"]
    crop_specific = context.canonical_state["crop_specific"]
    if crop == "cucumber":
        cucumber = crop_specific["cucumber"]
        layer_activity = {
            "upper": float(cucumber.get("upper_leaf_activity", 0.0)),
            "middle": float(cucumber.get("middle_leaf_activity", 0.0)),
            "bottom": float(cucumber.get("bottom_leaf_activity", 0.0)),
        }
        bottleneck_layer = min(layer_activity, key=layer_activity.get)
        return {
            "crop": "cucumber",
            "remaining_leaves": int(cucumber.get("remaining_leaves", 0)),
            "leaf_area_by_rank": cucumber.get("leaf_area_by_rank") or [],
            "layer_activity": layer_activity,
            "bottleneck_layer": bottleneck_layer,
            "recent_leaf_removal_count": len(context.canonical_state["events"]["recent_leaf_removal"]),
        }

    tomato = crop_specific["tomato"]
    truss_cohorts = tomato.get("truss_cohorts") or []
    dominant_cohort_id = None
    dominant_sink = 0.0
    for index, cohort in enumerate(truss_cohorts):
        sink_strength = float(cohort.get("n_fruits", 0.0)) * float(cohort.get("w_fr_cohort", 0.0))
        if sink_strength > dominant_sink:
            dominant_sink = sink_strength
            dominant_cohort_id = index
    return {
        "crop": "tomato",
        "active_trusses": int(tomato.get("active_trusses", 0)),
        "fruit_partition_ratio": float(tomato.get("fruit_partition_ratio", 0.0)),
        "layer_activity": {
            "upper": float(tomato.get("upper_leaf_activity", 0.0)),
            "middle": float(tomato.get("middle_leaf_activity", 0.0)),
            "bottom": float(tomato.get("bottom_leaf_activity", 0.0)),
        },
        "dominant_cohort_id": dominant_cohort_id,
        "dominant_cohort_sink": round(dominant_sink, 6),
        "recent_fruit_thinning_count": len(context.canonical_state["events"]["recent_fruit_thinning"]),
    }


def _build_rtr_explanation_payload(
    *,
    context,
    optimization_inputs,
    baseline_candidate: Dict[str, Any],
    optimized_candidate: Dict[str, Any],
    rtr_equivalent: Dict[str, float],
    crop_specific_insight: Dict[str, Any],
) -> Dict[str, Any]:
    from .services.rtr.node_target_engine import build_development_curve_rows

    crop_name = str(context.canonical_state["crop"]).lower()
    is_tomato = crop_name == "tomato"
    development_metric = "truss" if is_tomato else "node"
    development_scale = 3.0 if is_tomato else 1.0

    delta_temp = float(rtr_equivalent["delta_temp_C"])
    reason_tags: list[str] = []
    if delta_temp > 0.05:
        reason_tags.append("temperature-up")
    elif delta_temp < -0.05:
        reason_tags.append("temperature-down")
    if not optimized_candidate["node_summary"]["target_hit"]:
        reason_tags.append("node-target-guarded")
    if (
        float(optimized_candidate["objective_breakdown"]["respiration_cost"])
        > float(baseline_candidate["objective_breakdown"]["respiration_cost"])
    ):
        reason_tags.append("respiration-tradeoff")
    if (
        float(optimized_candidate["objective_breakdown"]["energy_cost"])
        > float(baseline_candidate["objective_breakdown"]["energy_cost"])
    ):
        reason_tags.append("energy-tradeoff")
    if (
        float(optimized_candidate["objective_breakdown"]["labor_index"])
        > float(baseline_candidate["objective_breakdown"]["labor_index"])
    ):
        reason_tags.append("labor-tradeoff")

    if context.canonical_state["crop"] == "cucumber":
        crop_summary = (
            f"오이는 {crop_specific_insight['bottleneck_layer']} 엽층 기여가 가장 약하고 "
            f"남은 엽수 {crop_specific_insight['remaining_leaves']}매가 현재 source 여력을 좌우합니다."
        )
    else:
        crop_summary = (
            f"토마토는 active truss {crop_specific_insight['active_trusses']}개와 "
            f"dominant cohort {crop_specific_insight['dominant_cohort_id']}의 sink 부담이 핵심입니다."
        )

    development_label_ko = "화방 진행" if is_tomato else "마디 전개"
    summary = (
        f"목표 {development_label_ko}를 맞추기 위한 최소 적정 온도를 내부 광합성·호흡·에너지 seam으로 다시 계산했습니다."
        if delta_temp >= 0
        else "현재 source-sink와 비용 조건을 반영하면 평소 설정값보다 더 낮은 적정 온도도 가능합니다."
    )

    baseline_mean_temp_c = float(baseline_candidate["controls"]["mean_temp_C"])
    optimized_mean_temp_c = float(optimized_candidate["controls"]["mean_temp_C"])
    raw_adapter_state = context.adapter.dump_state()
    optimizer_config = context.canonical_state.get("optimizer", {}) or {}
    default_max_delta = 1.2 if crop_name == "cucumber" else 1.5
    max_delta_temp_c = float(optimizer_config.get("max_delta_temp_C", default_max_delta))
    valid_max_temp_c = min(
        30.0,
        max(
            15.0,
            baseline_mean_temp_c + max_delta_temp_c,
            optimized_mean_temp_c + 0.3,
        ),
    )
    if is_tomato and bool(raw_adapter_state.get("fr_clamp_to_valid", False)):
        fr_max_valid = raw_adapter_state.get("fr_T_max_valid")
        try:
            valid_max_temp_c = min(valid_max_temp_c, float(fr_max_valid))
        except (TypeError, ValueError):
            pass

    temperature_development_rows = build_development_curve_rows(
        crop=crop_name,
        raw_adapter_state=raw_adapter_state,
        min_temp_c=15.0,
        max_temp_c=valid_max_temp_c,
        step_c=0.5,
        development_scale=development_scale,
    )

    return {
        "summary": summary,
        "target_node_development_per_day": float(optimization_inputs.target_node_development_per_day),
        "baseline_mean_temp_C": baseline_mean_temp_c,
        "optimized_mean_temp_C": optimized_mean_temp_c,
        "development_metric": development_metric,
        "temperature_development_rows": temperature_development_rows,
        "reason_tags": reason_tags,
        "crop_summary": crop_summary,
        "missing_work_event_warning": (
            "작업 이벤트가 적게 기록되어 있어 적엽/적과 영향 해석 신뢰도가 제한됩니다."
            if (
                context.canonical_state["crop"] == "cucumber"
                and not context.canonical_state["events"]["recent_leaf_removal"]
            )
            or (
                context.canonical_state["crop"] == "tomato"
                and not context.canonical_state["events"]["recent_fruit_thinning"]
            )
            else None
        ),
    }


def _build_rtr_warning_badges(context, optimized_candidate: Dict[str, Any], rtr_equivalent: Dict[str, float]) -> list[str]:
    warnings: list[str] = []
    if context.canonical_state["crop"] == "cucumber" and not context.canonical_state["events"]["recent_leaf_removal"]:
        warnings.append("recent_leaf_removal_missing")
    if context.canonical_state["crop"] == "tomato" and not context.canonical_state["events"]["recent_fruit_thinning"]:
        warnings.append("recent_fruit_thinning_missing")
    if optimized_candidate["feasibility"]["risk_flags"]:
        warnings.append("risk_bound_active")
    max_ratio_delta = float(context.canonical_state.get("optimizer", {}).get("max_rtr_ratio_delta", 0.03))
    if abs(float(rtr_equivalent["delta_ratio"])) >= max_ratio_delta * 0.8:
        warnings.append("large_rtr_deviation_reason_required")
    return warnings


def _build_rtr_control_guidance(context, optimization_inputs) -> Dict[str, Any]:
    from .services.rtr.controller_contract import horizon_hours

    optimizer_config = context.canonical_state.get("optimizer", {}) or {}
    day_hours, night_hours = horizon_hours(optimization_inputs.target_horizon)
    default_max_delta = 1.2 if optimization_inputs.crop == "cucumber" else 1.5
    default_ratio_delta = 0.03 if optimization_inputs.crop == "cucumber" else 0.04
    return {
        "target_horizon": optimization_inputs.target_horizon,
        "day_hold_hours": round(float(day_hours), 3),
        "night_hold_hours": round(float(night_hours), 3),
        "change_limit_C_per_step": round(
            float(optimizer_config.get("temp_slew_rate_C_per_step", 0.12)),
            6,
        ),
        "max_delta_temp_C": round(
            float(optimizer_config.get("max_delta_temp_C", default_max_delta)),
            6,
        ),
        "max_rtr_ratio_delta": round(
            float(optimizer_config.get("max_rtr_ratio_delta", default_ratio_delta)),
            6,
        ),
    }


def _build_rtr_projection_payloads(context, area_meta, candidate: Dict[str, Any]) -> tuple[Dict[str, Any], Dict[str, Any]]:
    from .services.rtr.unit_projection import build_actual_area_projection

    yield_summary = candidate.get("yield_projection", {}) or {}
    energy_summary = candidate.get("energy_summary", {}) or {}
    labor_summary = candidate.get("labor_projection", {}) or {}
    units_m2 = {
        "greenhouse_area_m2": round(float(area_meta["greenhouse_area_m2"] or 0.0), 6),
        "actual_area_m2": round(float(area_meta["actual_area_m2"] or 0.0), 6),
        "actual_area_pyeong": round(float(area_meta["actual_area_pyeong"] or 0.0), 6),
        "yield_proxy_kg_m2_day": round(float(yield_summary.get("predicted_yield_kg_m2_day", 0.0)), 6),
        "yield_proxy_kg_m2_week": round(float(yield_summary.get("predicted_yield_kg_m2_week", 0.0)), 6),
        "energy_kwh_m2_day": round(float(energy_summary.get("total_energy_kWh_m2_day", 0.0)), 6),
        "energy_krw_m2_day": round(float(energy_summary.get("total_energy_cost_krw_m2_day", 0.0)), 6),
        "heating_energy_kwh_m2_day": round(float(energy_summary.get("heating_energy_kWh_m2_day", 0.0)), 6),
        "cooling_energy_kwh_m2_day": round(float(energy_summary.get("cooling_energy_kWh_m2_day", 0.0)), 6),
        "labor_index_m2_day": round(float(labor_summary.get("labor_index", 0.0)), 6),
        "labor_hours_m2_day": round(float(labor_summary.get("labor_hours_m2_day", 0.0)), 6),
        "labor_cost_krw_m2_day": round(float(labor_summary.get("labor_cost_krw_m2_day", 0.0)), 6),
        "node_development_day": round(float(candidate["node_summary"]["predicted_rate_day"]), 6),
        "gross_margin_proxy_krw_m2_day": round(float(yield_summary.get("gross_margin_proxy_krw_m2_day", 0.0)), 6),
    }
    actual_area_projection = build_actual_area_projection(
        area_meta=area_meta,
        yield_kg_m2_day=float(yield_summary.get("predicted_yield_kg_m2_day", 0.0)),
        yield_kg_m2_week=float(yield_summary.get("predicted_yield_kg_m2_week", 0.0)),
        energy_kwh_m2_day=float(energy_summary.get("total_energy_kWh_m2_day", 0.0)),
        energy_krw_m2_day=float(energy_summary.get("total_energy_cost_krw_m2_day", 0.0)),
        heating_energy_kwh_m2_day=float(energy_summary.get("heating_energy_kWh_m2_day", 0.0)),
        cooling_energy_kwh_m2_day=float(energy_summary.get("cooling_energy_kWh_m2_day", 0.0)),
        labor_index_m2_day=float(labor_summary.get("labor_index", 0.0)),
        labor_hours_m2_day=float(labor_summary.get("labor_hours_m2_day", 0.0)),
        labor_cost_krw_m2_day=float(labor_summary.get("labor_cost_krw_m2_day", 0.0)),
        margin_krw_m2_day=float(yield_summary.get("gross_margin_proxy_krw_m2_day", 0.0)),
    )
    return units_m2, actual_area_projection


def _serialize_rtr_solver(solver_payload: Dict[str, Any]) -> Dict[str, Any]:
    stage1_success = bool(solver_payload.get("stage1_success", False))
    stage2_success = bool(solver_payload.get("stage2_success", False))
    stage1_message = str(solver_payload.get("stage1_message", ""))
    stage2_message = str(solver_payload.get("stage2_message", ""))
    return {
        "success": stage1_success and stage2_success,
        "message": stage2_message or stage1_message or "RTR optimizer completed.",
        "method": "two-stage-l-bfgs-b",
        "stage1_success": stage1_success,
        "stage2_success": stage2_success,
        "stage1_message": stage1_message,
        "stage2_message": stage2_message,
        "stage2_coordination": solver_payload.get("stage2_coordination"),
        "coordinated_candidate": solver_payload.get("coordinated_candidate"),
    }


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
    crop = _validate_crop(req.crop)
    logger.info(f"Starting simulation for {crop} greenhouse with {req.csv_filename}")
    from .adapters.cucumber import CucumberAdapter
    from .adapters.tomato import TomatoAdapter
    from .services.decision import DecisionSupport
    from .services.forecast import BranchForecaster
    from .services.ingest import BatchIngestor
    from .services.simulator import Simulator

    crop_state = app_state[crop]
    ops_config = _get_ops_config(crop)
    _get_crop_config_store(crop)

    # Avoid expensive stop/reload churn when the requested simulation is already live.
    existing_simulator = crop_state.get("simulator")
    existing_task = crop_state.get("sim_task")
    if existing_simulator is not None:
        total_rows = len(existing_simulator.df_env)
        at_end = total_rows > 0 and existing_simulator.idx >= total_rows - 1
        task_alive = existing_task is not None and not existing_task.done()
        is_paused = bool(getattr(existing_simulator, "paused", False))
        same_dataset = (
            crop_state.get("csv_filename") == req.csv_filename
            and crop_state.get("time_step") == req.time_step
        )
        if (
            existing_simulator.running
            and task_alive
            and not is_paused
            and not at_end
            and same_dataset
        ):
            logger.info(
                "%s simulation already active for %s (%s); skipping restart",
                crop,
                req.csv_filename,
                req.time_step,
            )
            _record_runtime_tick(crop)
            return {
                "status": "already_running",
                "crop": crop,
                "rows": total_rows,
                "time_step": crop_state.get("time_step", req.time_step),
                "dt_minutes": round((crop_state.get("dt_hours") or 0.0) * 60, 3),
            }

    # Stop any running simulation for THIS crop first
    if crop_state["simulator"] is not None:
        import asyncio

        logger.info(f"Stopping previous {crop} simulation...")
        crop_state["simulator"].stop()
        
        # Cancel running simulation task
        if crop_state["sim_task"] and not crop_state["sim_task"].done():
            logger.info(f"Cancelling previous {crop} simulation task...")
            crop_state["sim_task"].cancel()
            try:
                await crop_state["sim_task"]
            except asyncio.CancelledError:
                logger.info(f"Previous {crop} simulation task cancelled cleanly")
            except Exception as exc:
                logger.warning(
                    "Previous %s simulation task raised during cancellation: %s",
                    crop,
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
    crop_state["csv_filename"] = req.csv_filename
    crop_state["time_step"] = req.time_step
    crop_state["last_runtime_snapshot_at"] = None
    crop_state["last_runtime_tick_at"] = None
    crop_state["last_runtime_error"] = None
    crop_state["last_runtime_error_at"] = None
    crop_state["last_forecast_schedule_at"] = None

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
    crop_config = greenhouse_config["crops"][crop]

    if crop == "tomato":
        adapter = TomatoAdapter(
            area_m2=area_m2, plant_density=crop_config["plant_density_per_m2"]
        )
    else:
        adapter = CucumberAdapter(
            area_m2=area_m2, plant_density=crop_config["plant_density_per_m2"]
        )

    crop_state["adapter"] = adapter
    _apply_crop_config_to_adapter(crop)
    if crop == "cucumber" and crop_state.get("pending_prune_reset"):
        adapter.mark_pruned()
        crop_state["pending_prune_reset"] = False

    # Initialize decision support system
    decision_support = DecisionSupport(crop_type=crop)
    crop_state["decision"] = decision_support

    # Initialize simulator with irrigation and energy services
    simulator = Simulator(
        adapter=adapter,
        broadcaster=lambda path, payload: manager.broadcast_sync(f"{path}/{crop}", payload),
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
        manager.broadcast_sync(f"{path}/{crop}", payload)

    forecaster = BranchForecaster(
        broadcaster=_handle_forecast_broadcast,
        area_m2=area_m2,
        window_days=settings.forecast_window_days,
        forecast_step_interval=forecast_step_interval,
        crop_name=crop,
    )
    crop_state["forecaster"] = forecaster

    # Reset services
    crop_state["irrigation"].reset_daily()
    crop_state["energy"].reset_daily()

    logger.info(f"{crop} simulation initialized with {len(df_env)} rows")

    # Auto-start simulation for real-time streaming
    simulator.start()
    import asyncio

    crop_state["sim_task"] = asyncio.create_task(_run_simulation_task(crop))
    logger.info(f"{crop} real-time simulation started")
    
    # Schedule initial forecast almost immediately to show results quickly
    async def _initial_forecast():
        await asyncio.sleep(0.2)  # tiny delay to ensure simulator has started
        if _schedule_forecast(crop, force=True):
            logger.info(f"{crop} initial forecast scheduled")
        else:
            logger.info(f"{crop} initial forecast skipped")
    
    asyncio.create_task(_initial_forecast())

    return {
        "status": "success",
        "crop": crop,
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
    crop = _validate_crop(crop)
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

    _maybe_persist_runtime_snapshot(
        crop,
        source="simulation_step",
        snapshot_time=_normalize_snapshot_datetime(
            payload.get("state", {}).get("datetime") or payload.get("t")
        ),
    )

    await manager.broadcast(f"/ws/sim/{crop}", payload)
    _record_runtime_tick(crop)

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
    _record_runtime_tick(crop)

    try:
        for i in range(simulator.idx, len(simulator.df_env)):
            if not simulator.running:
                logger.info(f"{crop} simulation stopped by user")
                break

            # Handle pause
            while simulator.paused:
                _record_runtime_tick(crop)
                await asyncio.sleep(0.1)

            try:
                # Crop model stepping is CPU-heavy enough to starve the event loop if
                # we run it inline here. Offload it so API and WebSocket handshakes
                # remain responsive while the simulation is advancing.
                payload = await asyncio.to_thread(simulator.step_from_index, i)

                # Store last values for recommendations
                crop_state["last_irrigation"] = payload.get("irrigation", {})
                crop_state["last_energy"] = payload.get("energy", {})

                # Real-time recommendations
                if crop_state.get("decision"):
                    try:
                        recs = await asyncio.to_thread(
                            crop_state["decision"].get_recommendations,
                            payload["kpi"],
                            payload["state"],
                            crop_state["last_irrigation"],
                            crop_state["last_energy"],
                            payload["env"],
                            crop_state.get("latest_forecast"),
                        )
                        payload["recommendations"] = recs
                    except Exception as exc:
                        logger.error("Failed to compute %s recommendations: %s", crop, exc)

                try:
                    _maybe_persist_runtime_snapshot(
                        crop,
                        source="simulation_run",
                        snapshot_time=_normalize_snapshot_datetime(
                            payload.get("state", {}).get("datetime") or payload.get("t")
                        ),
                    )
                except Exception as exc:
                    _record_runtime_error(crop, exc)
                    logger.error("Failed to persist %s runtime snapshot: %s", crop, exc, exc_info=True)

                # Broadcast full payload (already includes /tomato or /cucumber path)
                await manager.broadcast(f"/ws/sim/{crop}", payload)
                _record_runtime_tick(crop)

                # Schedule forecast periodically (default: every settings.forecast_reschedule_interval_h hours)
                try:
                    steps_per_hour = max(1, int(round(1.0 / max(simulator.dt_hours, 1e-6))))
                    resched_steps = max(1, int(round(steps_per_hour * settings.forecast_reschedule_interval_h)))
                except Exception:
                    resched_steps = 6  # sensible fallback for 10-min data
                if i % resched_steps == 0 and i > 0:
                    try:
                        if _schedule_forecast(crop):
                            logger.info(
                                "%s forecast scheduled at step %s (every %s steps)",
                                crop,
                                i,
                                resched_steps,
                            )
                    except Exception as exc:
                        _record_runtime_error(crop, exc)
                        logger.error("Failed to schedule %s forecast at step %s: %s", crop, i, exc, exc_info=True)

                # Speed-controlled delay (adjustable via simulator.speed)
                # Default: 0.1s per step (10 steps/sec) for smooth visualization
                delay = 0.1 / simulator.speed
                await asyncio.sleep(delay)
            except asyncio.CancelledError:
                raise
            except Exception as exc:
                _record_runtime_error(crop, exc)
                logger.error("%s simulation step %s failed: %s", crop, i, exc, exc_info=True)
                await asyncio.sleep(0.25)

        if simulator.running and simulator.idx >= len(simulator.df_env) - 1:
            simulator.stop()
            logger.info("%s simulation reached end of data", crop)

        logger.info(f"{crop} simulation run completed")
    
    except asyncio.CancelledError:
        logger.info(f"{crop} simulation task was cancelled")
        raise
    except Exception as e:
        _record_runtime_error(crop, e)
        simulator.stop()
        logger.error(f"{crop} simulation task error: {e}", exc_info=True)
    finally:
        if crop_state.get("sim_task") is asyncio.current_task():
            crop_state["sim_task"] = None


def _schedule_forecast(crop: str, *, force: bool = False) -> bool:
    """Schedule a forecast run for specific crop."""
    crop_state = app_state[crop]
    
    if crop_state["simulator"] is None or crop_state["forecaster"] is None:
        logger.warning(f"{crop} forecast skipped - no simulator/forecaster")
        return False

    simulator = crop_state["simulator"]
    forecaster = crop_state["forecaster"]
    adapter = crop_state["adapter"]

    if not force:
        now_utc = datetime.now(UTC)
        last_scheduled_at = crop_state.get("last_forecast_schedule_at")
        if isinstance(last_scheduled_at, datetime):
            normalized_last_scheduled_at = (
                last_scheduled_at
                if last_scheduled_at.tzinfo is not None
                else last_scheduled_at.replace(tzinfo=UTC)
            )
            if now_utc - normalized_last_scheduled_at < FORECAST_MIN_RESCHEDULE_INTERVAL:
                return False

    # Get future rows (7 days)
    from datetime import timedelta
    import pandas as pd

    current_idx = simulator.idx
    if current_idx >= len(simulator.df_env):
        logger.warning(f"{crop} forecast skipped - at end of data")
        return False

    current_dt = pd.to_datetime(simulator.df_env.iloc[current_idx]["datetime"])
    future_end = current_dt + timedelta(days=settings.forecast_window_days)

    mask = (simulator.df_env["datetime"] > current_dt) & (
        simulator.df_env["datetime"] <= future_end
    )
    future_df = simulator.df_env.loc[mask]

    if len(future_df) == 0:
        logger.warning(f"{crop} forecast skipped - no future data")
        return False

    future_rows = future_df.to_dict(orient="records")

    logger.info(f"Scheduling {crop} forecast for {len(future_rows)} rows")
    forecaster.schedule(adapter, future_rows)
    crop_state["last_forecast_schedule_at"] = datetime.now(UTC)
    return True


@app.post("/api/pause")
async def pause_simulation(crop: Optional[str] = None):
    """Pause simulation."""
    paused_crops = []
    for crop_name in _target_crops(crop):
        simulator = app_state[crop_name]["simulator"]
        if simulator is None:
            continue

        simulator.pause()
        _record_runtime_tick(crop_name)
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
        _record_runtime_tick(crop_name)
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


@app.get("/api/config/ops")
async def get_ops_config(crop: str = "cucumber"):
    """Return crop-scoped operational configuration."""
    crop = _validate_crop(crop)
    return {
        "status": "success",
        "crop": crop,
        "config": dict(_get_ops_config(crop)),
        "control_state": _serialize_control_state(crop),
    }


@app.get("/api/control/state")
async def get_control_state(crop: str = "cucumber"):
    """Return backend-held manual actuator state for the UI control lane."""
    crop = _validate_crop(crop)
    return {"status": "success", "control_state": _serialize_control_state(crop)}


@app.post("/api/control/commands")
async def update_control_state(update: ControlStateUpdate, crop: str = "cucumber"):
    """Persist a manual actuator command issued from the frontend."""
    crop = _validate_crop(crop)
    control_state = _get_control_state(crop)
    payload = update.model_dump(exclude_none=True)
    for key in ("ventilation", "irrigation", "heating", "shading"):
        if key in payload:
            control_state[key] = bool(payload[key])

    control_state["source"] = payload.get("source") or "frontend"
    control_state["mode"] = "manual-ui"
    control_state["updated_at"] = datetime.now(UTC).isoformat()
    logger.info("Control state updated for %s: %s", crop, _serialize_control_state(crop)["devices"])

    return {"status": "success", "control_state": _serialize_control_state(crop)}


@app.get("/api/alerts/history")
async def get_alert_history(crop: str = "cucumber", limit: int = 25):
    """Return persisted alert history for the selected crop."""
    crop = _validate_crop(crop)
    return _serialize_alert_history(crop, limit=limit)


@app.post("/api/alerts/history")
async def update_alert_history(request: AlertHistoryRequest, crop: str = "cucumber"):
    """Persist frontend-observed alert events into backend alert history."""
    crop = _validate_crop(crop)
    return _upsert_alert_history_events(
        crop,
        [event.model_dump() for event in request.events],
    )


@app.post("/api/config/crop")
async def update_crop_config(config: CropConfig, crop: str):
    """Update crop-specific configuration."""
    crop = _validate_crop(crop)

    crop_config = _get_crop_config_store(crop)
    config_payload = config.model_dump(exclude_none=True)
    crop_config.update(config_payload)
    applied = _apply_crop_config_to_adapter(crop)
    if applied:
        logger.info(f"Applied {crop} crop config update: {config_payload}")
        _schedule_forecast(crop, force=True)
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
    crop = _validate_crop(crop)
    
    crop_state = app_state[crop]
    if crop_state["decision"]:
        crop_state["decision"].update_settings(settings.dict())
        logger.info(f"Updated settings for {crop}: {settings}")
        return {"status": "success", "settings": settings}
    
    return {"status": "error", "message": "Decision service not active"}

@app.get("/api/settings")
async def get_settings(crop: str = "tomato"):
    """Get current financial settings."""
    crop = _validate_crop(crop)
    
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
async def get_knowledge_status(
    crop: Optional[str] = None,
    bootstrap: bool = False,
):
    """Return the phase-1 SmartGrow corpus catalog."""
    try:
        crop_scope = _normalize_catalog_crop(crop)
        payload, bootstrapped = _ensure_knowledge_catalog_ready(
            crop_scope,
            allow_bootstrap=bootstrap,
        )
        return {"status": "success", "catalog_bootstrapped": bootstrapped, **payload}
    except HTTPException:
        raise
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
    except HTTPException:
        raise
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
        _, bootstrapped = _ensure_knowledge_catalog_ready(crop_scope)
        return {
            "status": "success",
            "catalog_bootstrapped": bootstrapped,
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
    crop = _validate_crop(req.crop)
    import asyncio

    dashboard_payload = _augment_dashboard_with_knowledge_context(crop, req.dashboard)
    try:
        return await asyncio.wait_for(
            asyncio.to_thread(
                build_advisor_summary_response,
                crop=crop,
                dashboard=dashboard_payload,
                language=req.language or "ko",
            ),
            timeout=12.0,
        )
    except asyncio.TimeoutError:
        logger.warning("Advisor summary timed out; returning deterministic fallback.")
        return await asyncio.to_thread(
            build_advisor_summary_fallback_response,
            crop=crop,
            dashboard=dashboard_payload,
            language=req.language or "ko",
            reason="llm_timeout",
        )
    except RuntimeError as exc:
        logger.warning("Advisor summary degraded gracefully: %s", exc)
        return await asyncio.to_thread(
            build_advisor_summary_fallback_response,
            crop=crop,
            dashboard=dashboard_payload,
            language=req.language or "ko",
            reason="openai_unavailable",
        )
    except Exception as exc:
        logger.error("Advisor summary failed: %s", exc, exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Advisor summary failed: {exc}",
        ) from exc


@app.post("/api/advisor/tab/{tab_name}")
async def advisor_tab(tab_name: str, req: AdvisorTabRequest):
    """Return a tab-specific SmartGrow advisor payload."""
    crop = _validate_crop(req.crop)
    try:
        return build_advisor_tab_response(
            tab_name=tab_name,
            crop=crop,
            greenhouse_id=req.greenhouse_id,
            target=req.target,
            limit=req.limit,
            stage=req.stage,
            medium=req.medium,
            dashboard=_augment_dashboard_with_knowledge_context(crop, req.dashboard),
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
    crop = _validate_crop(req.crop)
    try:
        return await asyncio.to_thread(
            build_advisor_chat_response,
            crop=crop,
            messages=req.messages,
            dashboard=_augment_dashboard_with_knowledge_context(crop, req.dashboard),
            language=req.language or "ko",
        )
    except RuntimeError as exc:
        logger.warning("Advisor chat degraded gracefully: %s", exc)
        return await asyncio.to_thread(
            build_advisor_chat_fallback_response,
            crop=crop,
            messages=req.messages,
            dashboard=_augment_dashboard_with_knowledge_context(crop, req.dashboard),
            language=req.language or "ko",
            reason="openai_unavailable",
        )
    except Exception as exc:
        logger.error("Advisor chat failed: %s", exc, exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Advisor chat failed: {exc}",
        ) from exc


@app.post("/api/advisor/environment")
async def advisor_environment(req: AdvisorSurfaceRequest):
    """Return the additive environment advisor surface with the exact directive route."""
    crop = _validate_crop(req.crop)
    try:
        return build_environment_advisor_response(
            crop=crop,
            greenhouse_id=req.greenhouse_id,
            dashboard=_augment_dashboard_with_knowledge_context(crop, req.dashboard),
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.post("/api/advisor/physiology")
async def advisor_physiology(req: AdvisorSurfaceRequest):
    """Return the additive physiology advisor surface with the exact directive route."""
    crop = _validate_crop(req.crop)
    try:
        return build_physiology_advisor_response(
            crop=crop,
            greenhouse_id=req.greenhouse_id,
            dashboard=_augment_dashboard_with_knowledge_context(crop, req.dashboard),
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.post("/api/advisor/work-tradeoff")
async def advisor_work_tradeoff(req: AdvisorSurfaceRequest):
    """Return the work-tradeoff advisor contract over persisted work-event compare outputs."""
    crop = _validate_crop(req.crop)
    try:
        return build_work_tradeoff_advisor_response(
            crop=crop,
            greenhouse_id=req.greenhouse_id,
            dashboard=_augment_dashboard_with_knowledge_context(crop, req.dashboard),
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.post("/api/advisor/harvest")
async def advisor_harvest(req: AdvisorSurfaceRequest):
    """Return the additive harvest advisor surface with the exact directive route."""
    crop = _validate_crop(req.crop)
    try:
        return build_harvest_advisor_response(
            crop=crop,
            greenhouse_id=req.greenhouse_id,
            dashboard=_augment_dashboard_with_knowledge_context(crop, req.dashboard),
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.post("/api/environment/recommend")
async def recommend_environment_controls(req: EnvironmentRecommendationRequest):
    """Return deterministic environment-control guidance from the live dashboard."""
    crop = _validate_crop(req.crop)
    try:
        return build_environment_recommendation_response(
            crop=crop,
            dashboard=_augment_dashboard_with_knowledge_context(crop, req.dashboard),
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.post("/api/work/recommend")
async def recommend_cultivation_work(req: WorkRecommendationRequest):
    """Return deterministic cultivation-work guidance from the live dashboard."""
    crop = _validate_crop(req.crop)
    try:
        return build_work_recommendation_response(
            crop=crop,
            dashboard=_augment_dashboard_with_knowledge_context(crop, req.dashboard),
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.post("/api/pesticides/recommend")
async def recommend_pesticide_products(req: PesticideRecommendationRequest):
    """Return deterministic pesticide candidates from the SmartGrow workbook."""
    crop = _validate_crop(req.crop)
    return build_pesticide_recommendation_response(
        crop=crop,
        target=req.target,
        limit=req.limit,
    )


@app.post("/api/nutrients/recommend")
async def recommend_nutrient_program(req: NutrientRecommendationRequest):
    """Return deterministic nutrient recipe lookup from the SmartGrow workbook."""
    crop = _validate_crop(req.crop)
    return build_nutrient_recommendation_response(
        crop=crop,
        stage=req.stage,
        medium=req.medium,
    )


@app.post("/api/nutrients/correction")
async def recommend_nutrient_correction_draft(req: NutrientCorrectionRequest):
    """Return a deterministic nutrient correction draft from workbook baselines."""
    crop = _validate_crop(req.crop)
    return build_nutrient_correction_response(
        crop=crop,
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
    crop = _validate_crop(req.crop)
    try:
        import asyncio

        text = await asyncio.to_thread(
            generate_consulting,
            crop=crop,
            dashboard=_augment_dashboard_with_knowledge_context(crop, req.dashboard),
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
    crop = _validate_crop(req.crop)
    try:
        import asyncio

        text = await asyncio.to_thread(
            generate_chat_reply,
            crop=crop,
            messages=req.messages,
            dashboard=_augment_dashboard_with_knowledge_context(crop, req.dashboard),
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


def _build_overview_internal_irradiance_history(
    crop: str,
    window_hours: int,
    *,
    reference_end: Optional[datetime] = None,
) -> Dict[str, Any]:
    """Build irradiance history from internal greenhouse PAR values."""
    crop_state = app_state[crop]
    simulator = crop_state.get("simulator")
    df_env = crop_state.get("df_env")
    if simulator is not None and getattr(simulator, "df_env", None) is not None:
        df_env = simulator.df_env

    points: list[Dict[str, Any]] = []
    try:
        if df_env is not None and len(df_env) > 0:
            reference_end_dt = _normalize_simulation_datetime(reference_end) if reference_end else None
            current_idx = len(df_env) - 1
            if simulator is not None:
                current_idx = min(
                    max(int(getattr(simulator, "idx", current_idx)), 0),
                    len(df_env) - 1,
                )
            elif reference_end_dt is not None and "datetime" in df_env.columns:
                for idx in range(len(df_env) - 1, -1, -1):
                    row_dt = _normalize_simulation_datetime(df_env.iloc[idx]["datetime"])
                    if row_dt is None:
                        continue
                    if row_dt <= reference_end_dt:
                        current_idx = idx
                        break
            dt_hours = float(crop_state.get("dt_hours") or 1.0)
            window_steps = max(1, int(round(window_hours / max(dt_hours, 1e-6))))
            start_idx = max(0, current_idx - window_steps + 1)
            window_df = df_env.iloc[start_idx : current_idx + 1]
            window_start_dt = (
                reference_end_dt - timedelta(hours=window_hours)
                if reference_end_dt is not None
                else None
            )
            for row in window_df.itertuples(index=False):
                ts_value = getattr(row, "datetime", None)
                par_value = getattr(row, "PAR_umol", None)
                if ts_value is None or par_value is None:
                    continue
                ts_dt = _normalize_simulation_datetime(ts_value)
                if ts_dt is None:
                    continue
                if (
                    reference_end_dt is not None
                    and window_start_dt is not None
                    and (ts_dt < window_start_dt or ts_dt > reference_end_dt)
                ):
                    continue
                try:
                    par_umol = max(0.0, float(par_value))
                except (TypeError, ValueError):
                    continue
                # Approximate conversion: 1 W/m² PAR ≈ 4.57 µmol m⁻² s⁻¹.
                shortwave_w_m2 = par_umol / 4.57
                points.append(
                    {
                        "time": ts_dt.isoformat(),
                        "shortwave_radiation_w_m2": round(shortwave_w_m2, 3),
                    }
                )
    except Exception as exc:
        logger.warning("%s internal irradiance build failed: %s", crop, exc)

    points.sort(
        key=lambda point: _normalize_simulation_datetime(point.get("time"))
        or datetime.min.replace(tzinfo=OVERVIEW_SIGNAL_TIMEZONE)
    )

    return {
        "location": {
            "name": "Greenhouse internal",
            "country": "South Korea",
            "timezone": "Asia/Seoul",
        },
        "source": {
            "provider": "Greenhouse internal PAR",
            "docs_url": "internal://simulator/par-umol",
            "fetched_at": datetime.now(UTC).isoformat(),
        },
        "window_hours": int(window_hours),
        "unit": "W/m²",
        "points": points,
    }


@app.get("/api/overview/signals")
async def get_overview_signal_trends(
    crop: str,
    greenhouse_id: Optional[str] = None,
    window_hours: int = 72,
):
    """Return greenhouse irradiance and model source-sink trend points."""
    import asyncio

    from .services.model_runtime.model_state_store import ModelStateStore
    from .services.model_runtime.scenario_runner import extract_runtime_inputs

    normalized_crop = _validate_crop(crop)
    resolved_greenhouse_id = _resolve_greenhouse_id(normalized_crop, greenhouse_id)
    resolved_window_hours = max(24, min(int(window_hours), 168))
    reference_end = None
    crop_state = app_state.get(normalized_crop, {})
    simulator = crop_state.get("simulator")
    try:
        import pandas as pd

        simulator_df = getattr(simulator, "df_env", None)
        if simulator is not None and simulator_df is not None and len(simulator_df) > 0:
            current_idx = min(
                max(int(getattr(simulator, "idx", 0)), 0),
                len(simulator_df) - 1,
            )
            reference_end = pd.to_datetime(simulator_df.iloc[current_idx]["datetime"]).to_pydatetime()
    except Exception as exc:
        logger.warning("Failed to resolve simulation reference datetime for overview signals: %s", exc)
    reference_end_dt = (
        _normalize_simulation_datetime(reference_end)
        if reference_end is not None
        else None
    )
    source_sink_window_start = (
        reference_end_dt - timedelta(hours=resolved_window_hours)
        if reference_end_dt is not None
        else None
    )

    irradiance_history = _build_overview_internal_irradiance_history(
        normalized_crop,
        resolved_window_hours,
        reference_end=reference_end_dt,
    )

    await asyncio.to_thread(
        _maybe_persist_runtime_snapshot,
        normalized_crop,
        greenhouse_id=resolved_greenhouse_id,
        source="overview_signals",
    )

    def _load_snapshot_records() -> list[dict[str, Any]]:
        store = ModelStateStore()
        return store.list_snapshots_created_since(
            resolved_greenhouse_id,
            normalized_crop,
            since=datetime.now(UTC) - timedelta(hours=resolved_window_hours),
            limit=max(96, resolved_window_hours * 4),
            sources=OVERVIEW_LIVE_SOURCE_SINK_SOURCES,
        )

    snapshot_records = await asyncio.to_thread(_load_snapshot_records)

    source_sink_points = []
    for snapshot_record in snapshot_records:
        runtime_inputs = extract_runtime_inputs(snapshot_record)
        if not _is_meaningful_source_sink_snapshot(
            source_capacity=float(runtime_inputs.source_capacity),
            sink_demand=float(runtime_inputs.sink_demand),
            source_sink_balance=float(runtime_inputs.source_sink_balance),
        ):
            continue
        snapshot_dt = (
            _normalize_simulation_datetime(snapshot_record.get("snapshot_time"))
            or _normalize_simulation_datetime(snapshot_record.get("created_at"))
        )
        if snapshot_dt is None:
            continue
        if (
            source_sink_window_start is not None
            and reference_end_dt is not None
            and (snapshot_dt < source_sink_window_start or snapshot_dt > reference_end_dt)
        ):
            continue
        source_sink_points.append(
            {
                "time": snapshot_dt.isoformat(),
                "source_sink_balance": round(float(runtime_inputs.source_sink_balance), 6),
                "source_capacity": round(float(runtime_inputs.source_capacity), 6),
                "sink_demand": round(float(runtime_inputs.sink_demand), 6),
            }
        )
    source_sink_points.sort(
        key=lambda point: _normalize_simulation_datetime(point["time"])
        or datetime.min.replace(tzinfo=OVERVIEW_SIGNAL_TIMEZONE)
    )

    return {
        "status": "success",
        "crop": normalized_crop,
        "greenhouse_id": resolved_greenhouse_id,
        "window_hours": resolved_window_hours,
        "irradiance": irradiance_history,
        "source_sink": {
            "source": {
                "provider": "Model runtime snapshots",
                "sources": list(OVERVIEW_LIVE_SOURCE_SINK_SOURCES),
            },
            "unit": "index",
            "status": "ready" if source_sink_points else "model_history_unavailable",
            "points": source_sink_points,
        },
    }


@app.get("/api/market/produce")
async def get_featured_produce_market_prices():
    """Return curated KAMIS retail/wholesale produce snapshots plus trend overlays."""
    try:
        payload = await fetch_featured_produce_prices()
        return {"status": "success", **payload}
    except httpx.HTTPError as exc:
        logger.warning("KAMIS produce price fetch failed: %r", exc)
        payload = build_featured_produce_prices_fallback_payload(reason=str(exc))
        return {"status": "success", **payload}
    except ValueError as exc:
        logger.warning("KAMIS produce price payload was invalid: %r", exc)
        payload = build_featured_produce_prices_fallback_payload(reason=str(exc))
        return {"status": "success", **payload}


@app.get("/api/rtr/profiles")
async def get_rtr_profiles():
    """Return the active RTR profile payload."""
    try:
        payload = load_rtr_profiles()
        optimizer_enabled = any(
            bool((profile or {}).get("optimizer", {}).get("enabled", False))
            for profile in (payload.get("profiles") or {}).values()
        )
        return {
            "status": "success",
            "mode": "baseline",
            "optimizerEnabled": optimizer_enabled,
            **payload,
        }
    except Exception as exc:
        logger.error("Failed to load RTR profiles: %s", exc, exc_info=True)
        raise HTTPException(
            status_code=500,
            detail="Failed to load RTR profiles.",
        ) from exc


@app.get("/api/rtr/state")
async def get_rtr_state(crop: str, greenhouse_id: Optional[str] = None, snapshot_id: Optional[str] = None):
    """Return the canonical internal RTR state plus baseline and area metadata."""
    from .services.model_runtime.model_state_store import ModelStateStore
    from .services.rtr.control_effects import build_actuator_availability
    from .services.rtr.internal_model_bridge import build_internal_model_context

    normalized_crop = _validate_crop(crop)
    store = ModelStateStore()
    try:
        resolved_greenhouse_id, snapshot_record = _resolve_runtime_snapshot_record(
            store=store,
            crop=normalized_crop,
            greenhouse_id=greenhouse_id,
            snapshot_id=snapshot_id,
            source="rtr_state_baseline",
        )
    except HTTPException as exc:
        if (
            exc.status_code == 400
            and snapshot_id is None
            and "Model runtime is inactive" in str(exc.detail)
        ):
            return _build_rtr_provisional_state_response(normalized_crop, greenhouse_id)
        raise
    area_meta = _resolve_rtr_area_meta(normalized_crop, resolved_greenhouse_id)
    context = build_internal_model_context(
        snapshot_record=snapshot_record,
        crop_state=app_state[normalized_crop],
        greenhouse_id=resolved_greenhouse_id,
        profiles_payload=load_rtr_profiles(),
        recent_events=store.list_work_events(resolved_greenhouse_id, normalized_crop, limit=12),
        actual_area_m2=float(area_meta["actual_area_m2"] or greenhouse_config["greenhouse"]["area_m2"]),
        cost_per_kwh=_get_crop_cost_per_kwh(normalized_crop),
    )
    optimizer_inputs = _build_rtr_request_bundle(
        {
            "crop": normalized_crop,
            "greenhouse_id": resolved_greenhouse_id,
            "snapshot_id": snapshot_record["snapshot_id"],
            "target_node_development_per_day": float(context.canonical_state["growth"]["predicted_node_rate_day"]),
            "optimization_mode": "balanced",
            "include_energy_cost": True,
            "include_labor_cost": False,
            "include_cooling_cost": True,
            "user_actual_area_m2": area_meta["actual_area_m2"],
            "user_actual_area_pyeong": area_meta["actual_area_pyeong"],
        }
    )[6]
    baseline_candidate = _build_rtr_baseline_candidate(context, optimizer_inputs)
    units_m2, actual_area_projection = _build_rtr_projection_payloads(context, area_meta, baseline_candidate)
    return {
        "status": "success",
        "crop": normalized_crop,
        "greenhouse_id": resolved_greenhouse_id,
        "snapshot_id": snapshot_record["snapshot_id"],
        "canonical_state": context.canonical_state,
        "baseline_rtr": context.canonical_state["baseline_rtr"],
        "optimizer_enabled": bool(context.canonical_state.get("optimizer", {}).get("enabled", False)),
        "area_unit_meta": area_meta,
        "actuator_availability": build_actuator_availability(context.ops_config).as_dict(),
        "optimizer_defaults": context.canonical_state.get("optimizer", {}) or {},
        "current_per_m_projections": units_m2,
        "current_actual_area_projection": actual_area_projection,
        "current_control_effect_trace": baseline_candidate.get("control_effect_trace", {}),
        "current_risk_flags": baseline_candidate.get("feasibility", {}).get("risk_flags", []),
    }


@app.post("/api/rtr/optimize")
async def optimize_rtr(req: RTROptimizeRequest):
    """Optimize minimum-feasible RTR temperatures from the internal crop-energy model only."""
    from .services.rtr.lagrangian_optimizer import optimize_rtr_targets
    from .services.rtr.rtr_deriver import derive_rtr_equivalent
    from .services.rtr.control_effects import build_actuator_availability

    (
        crop,
        _store,
        resolved_greenhouse_id,
        snapshot_record,
        _profiles_payload,
        area_meta,
        optimization_inputs,
        context,
    ) = _build_rtr_request_bundle(req.model_dump(exclude_none=True))
    baseline_candidate = _build_rtr_baseline_candidate(context, optimization_inputs)
    optimized_candidate = optimize_rtr_targets(
        context=context,
        optimization_inputs=optimization_inputs,
    )
    max_ratio_delta = float(context.canonical_state.get("optimizer", {}).get("max_rtr_ratio_delta", 0.03))
    rtr_equivalent = derive_rtr_equivalent(
        baseline_targets=optimized_candidate["baseline_targets"],
        optimized_targets=optimized_candidate["controls"],
        max_ratio_delta=max_ratio_delta,
    )
    crop_specific_insight = _build_rtr_crop_specific_insight(context)
    explanation_payload = _build_rtr_explanation_payload(
        context=context,
        optimization_inputs=optimization_inputs,
        baseline_candidate=baseline_candidate,
        optimized_candidate=optimized_candidate,
        rtr_equivalent=rtr_equivalent,
        crop_specific_insight=crop_specific_insight,
    )
    control_guidance = _build_rtr_control_guidance(
        context,
        optimization_inputs,
    )
    warning_badges = _build_rtr_warning_badges(context, optimized_candidate, rtr_equivalent)
    confidence = max(
        0.2,
        min(
            0.98,
            1.0
            - float(optimized_candidate["constraint_checks"]["confidence_penalty"])
            - (0.05 * len(warning_badges)),
        ),
    )
    units_m2, actual_area_projection = _build_rtr_projection_payloads(context, area_meta, optimized_candidate)
    return {
        "status": "success",
        "mode": "optimizer",
        "crop": crop,
        "greenhouse_id": resolved_greenhouse_id,
        "snapshot_id": snapshot_record["snapshot_id"],
        "baseline": {
            "mode": "baseline",
            "targets": baseline_candidate["controls"],
            "objective_breakdown": baseline_candidate["objective_breakdown"],
            "feasibility": baseline_candidate["feasibility"],
        },
        "optimal_targets": optimized_candidate["controls"],
        "rtr_equivalent": rtr_equivalent,
        "objective_breakdown": optimized_candidate["objective_breakdown"],
        "feasibility": {
            **optimized_candidate["feasibility"],
            "confidence": round(confidence, 6),
        },
        "flux_projection": optimized_candidate["flux_projection"],
        "crop_specific_insight": crop_specific_insight,
        "warning_badges": warning_badges,
        "units_m2": units_m2,
        "actual_area_projection": actual_area_projection,
        "actuator_availability": build_actuator_availability(context.ops_config).as_dict(),
        "energy_summary": optimized_candidate.get("energy_summary", {}),
        "labor_summary": optimized_candidate.get("labor_projection", {}),
        "yield_summary": optimized_candidate.get("yield_projection", {}),
        "control_effect_trace": optimized_candidate.get("control_effect_trace", {}),
        "explanation_payload": explanation_payload,
        "control_guidance": control_guidance,
        "solver": _serialize_rtr_solver(optimized_candidate["solver"]),
    }


@app.post("/api/rtr/scenario")
async def run_rtr_optimizer_scenario(req: RTRScenarioRequest):
    """Compare baseline and optimizer RTR scenarios over the internal model stack."""
    from .services.rtr.objective_terms import evaluate_rtr_candidate
    from .services.rtr.scenario_runner import run_rtr_scenarios

    (
        crop,
        _store,
        resolved_greenhouse_id,
        snapshot_record,
        _profiles_payload,
        area_meta,
        optimization_inputs,
        context,
    ) = _build_rtr_request_bundle(req.model_dump(exclude_none=True))
    scenarios = run_rtr_scenarios(
        context=context,
        optimization_inputs=optimization_inputs,
    )
    if req.custom_scenario is not None:
        custom = req.custom_scenario
        active_weights = _resolve_active_rtr_weights(context, optimization_inputs)
        custom_eval = evaluate_rtr_candidate(
            context=context,
            optimization_inputs=optimization_inputs,
            weights=active_weights,
            day_min_temp_c=_coalesce_optional_number(
                custom.day_heating_min_temp_C,
                custom.day_min_temp_C,
                default=context.ops_config.get("heating_set_C", context.canonical_state["env"]["T_air_C"]),
            ),
            night_min_temp_c=_coalesce_optional_number(
                custom.night_heating_min_temp_C,
                custom.night_min_temp_C,
                default=context.ops_config.get("heating_set_C", context.canonical_state["env"]["T_air_C"]),
            ),
            day_cooling_target_c=_coalesce_optional_number(
                custom.day_cooling_target_C,
                default=context.ops_config.get("cooling_set_C", context.canonical_state["env"]["T_air_C"] + 7.0),
            ),
            night_cooling_target_c=_coalesce_optional_number(
                custom.night_cooling_target_C,
                default=max(
                    float(context.ops_config.get("cooling_set_C", context.canonical_state["env"]["T_air_C"] + 7.0)) - 1.0,
                    float(context.ops_config.get("heating_set_C", context.canonical_state["env"]["T_air_C"])) + 1.0,
                ),
            ),
            vent_bias_c=_coalesce_optional_number(custom.vent_bias_C, default=0.0),
            screen_bias_pct=_coalesce_optional_number(custom.screen_bias_pct, default=0.0),
            circulation_fan_pct=_coalesce_optional_number(custom.circulation_fan_pct, default=35.0),
            co2_target_ppm=_coalesce_optional_number(
                custom.co2_target_ppm,
                default=context.ops_config.get("co2_target_ppm", context.canonical_state["env"]["CO2_ppm"]),
            ),
            rh_target_pct=_coalesce_optional_number(
                custom.rh_target_pct,
                default=context.canonical_state["env"]["RH_pct"],
            ),
            dehumidification_bias=_coalesce_optional_number(custom.dehumidification_bias, default=0.0),
            fogging_or_evap_cooling_intensity=_coalesce_optional_number(
                custom.fogging_or_evap_cooling_intensity,
                default=0.0,
            ),
        )
        custom_constraint_checks = custom_eval.get("constraint_checks", {}) or {}
        custom_feasibility = custom_eval.get("feasibility", {}) or {}
        custom_flux_projection = custom_eval.get("flux_projection", {}) or {}
        custom_controls = custom_eval.get("controls", {}) or {}
        custom_objective_breakdown = custom_eval.get("objective_breakdown", {}) or {}
        custom_energy_summary = custom_eval.get("energy_summary", {}) or {}
        custom_labor_summary = custom_eval.get("labor_projection", {}) or {}
        custom_yield_summary = custom_eval.get("yield_projection", {}) or {}
        custom_node_summary = custom_eval.get("node_summary", {}) or {}
        custom_risk_flags = custom_feasibility.get("risk_flags") or []
        custom_confidence = max(
            0.2,
            min(
                0.98,
                1.0
                - float(custom_constraint_checks.get("confidence_penalty", 0.0))
                - (0.05 * len(custom_risk_flags)),
            ),
        )
        scenarios.append(
            {
                "label": str(custom.label or "custom"),
                "mode": "custom",
                "mean_temp_C": custom_controls.get("mean_temp_C", 0.0),
                "day_min_temp_C": custom_controls.get("day_min_temp_C", 0.0),
                "night_min_temp_C": custom_controls.get("night_min_temp_C", 0.0),
                "day_heating_min_temp_C": custom_controls.get("day_heating_min_temp_C", custom_controls.get("day_min_temp_C", 0.0)),
                "night_heating_min_temp_C": custom_controls.get("night_heating_min_temp_C", custom_controls.get("night_min_temp_C", 0.0)),
                "day_cooling_target_C": custom_controls.get("day_cooling_target_C", context.ops_config.get("cooling_set_C", 26.0)),
                "night_cooling_target_C": custom_controls.get("night_cooling_target_C", max(float(context.ops_config.get("cooling_set_C", 26.0)) - 1.0, float(context.ops_config.get("heating_set_C", 18.0)) + 1.0)),
                "vent_bias_C": custom_controls.get("vent_bias_C", 0.0),
                "screen_bias_pct": custom_controls.get("screen_bias_pct", 0.0),
                "circulation_fan_pct": custom_controls.get("circulation_fan_pct", 0.0),
                "co2_target_ppm": custom_controls.get("co2_target_ppm", 0.0),
                "node_rate_day": custom_node_summary.get("predicted_rate_day", 0.0),
                "net_carbon": custom_flux_projection.get("carbon_margin", 0.0),
                "net_assimilation": custom_flux_projection.get("net_assim_umol_m2_s", 0.0),
                "respiration": custom_flux_projection.get("respiration_umol_m2_s", 0.0),
                "humidity_penalty": custom_objective_breakdown.get("humidity_risk_penalty", 0.0),
                "disease_penalty": custom_objective_breakdown.get("disease_penalty", 0.0),
                "energy_kwh_m2_day": custom_objective_breakdown.get("energy_cost", 0.0),
                "heating_energy_kwh_m2_day": custom_energy_summary.get("heating_energy_kWh_m2_day", 0.0),
                "cooling_energy_kwh_m2_day": custom_energy_summary.get("cooling_energy_kWh_m2_day", 0.0),
                "total_energy_cost_krw_m2_day": custom_energy_summary.get("total_energy_cost_krw_m2_day", 0.0),
                "labor_index": custom_objective_breakdown.get("labor_index", 0.0),
                "labor_hours_m2_day": custom_labor_summary.get("labor_hours_m2_day", 0.0),
                "labor_cost_krw_m2_day": custom_labor_summary.get("labor_cost_krw_m2_day", 0.0),
                "labor_summary": custom_labor_summary,
                "yield_kg_m2_day": custom_yield_summary.get("predicted_yield_kg_m2_day", 0.0),
                "yield_kg_m2_week": custom_yield_summary.get("predicted_yield_kg_m2_week", 0.0),
                "harvest_trend_delta_pct": custom_yield_summary.get("harvest_trend_delta_pct", 0.0),
                "yield_trend": "up" if custom_feasibility.get("carbon_margin_positive") else "guarded",
                "recommendation_badge": "custom",
                "group": "optimizer",
                "confidence": round(custom_confidence, 6),
                "risk_flags": custom_risk_flags,
                "objective_breakdown": custom_objective_breakdown,
                "energy_summary": custom_energy_summary,
                "yield_summary": custom_yield_summary,
                "control_effect_trace": custom_eval.get("control_effect_trace", {}),
            }
        )
    for row in scenarios:
        objective_breakdown = row.get("objective_breakdown", {}) or {}
        row.setdefault("net_assimilation", float(row.get("yield_proxy_basis_net_assim", 0.0)))
        row.setdefault("yield_kg_m2_day", 0.0)
        row.setdefault("yield_kg_m2_week", float(row.get("yield_kg_m2_day", 0.0)) * 7.0)
        row.setdefault("harvest_trend_delta_pct", 0.0)
        row.setdefault("heating_energy_kwh_m2_day", 0.0)
        row.setdefault("cooling_energy_kwh_m2_day", 0.0)
        row.setdefault("labor_hours_m2_day", float(objective_breakdown.get("labor_hours_m2_day", 0.0)))
        row.setdefault("labor_cost_krw_m2_day", float(objective_breakdown.get("labor_cost_krw", objective_breakdown.get("labor_cost", 0.0))))
        row.setdefault(
            "total_energy_cost_krw_m2_day",
            float(objective_breakdown.get("energy_cost_krw", 0.0)),
        )
        row["confidence"] = round(float(row.get("confidence", 0.0)), 6)
        row["risk_flags"] = row.get("risk_flags") or []
        row["actual_area_projection"] = _build_rtr_projection_payloads(
            context,
            area_meta,
            {
                "yield_projection": {
                    "predicted_yield_kg_m2_day": float(row.get("yield_kg_m2_day", 0.0)),
                    "predicted_yield_kg_m2_week": float(row.get("yield_kg_m2_week", 0.0)),
                    "gross_margin_proxy_krw_m2_day": float(objective_breakdown.get("gross_margin_proxy_krw_m2_day", 0.0)),
                },
                "energy_summary": row.get("energy_summary", {
                    "total_energy_kWh_m2_day": float(row.get("energy_kwh_m2_day", 0.0)),
                    "total_energy_cost_krw_m2_day": float(row.get("total_energy_cost_krw_m2_day", objective_breakdown.get("energy_cost_krw", 0.0))),
                    "heating_energy_kWh_m2_day": float(row.get("heating_energy_kwh_m2_day", 0.0)),
                    "cooling_energy_kWh_m2_day": float(row.get("cooling_energy_kwh_m2_day", 0.0)),
                }),
                "labor_projection": {
                    "labor_index": float(row.get("labor_index", 0.0)),
                    "labor_hours_m2_day": float(row.get("labor_hours_m2_day", objective_breakdown.get("labor_hours_m2_day", 0.0))),
                    "labor_cost_krw_m2_day": float(row.get("labor_cost_krw_m2_day", objective_breakdown.get("labor_cost_krw", objective_breakdown.get("labor_cost", 0.0)))),
                },
                "node_summary": {"predicted_rate_day": float(row.get("node_rate_day", 0.0))},
            },
        )[1]
    return {
        "status": "success",
        "crop": crop,
        "greenhouse_id": resolved_greenhouse_id,
        "snapshot_id": snapshot_record["snapshot_id"],
        "target_node_development_per_day": optimization_inputs.target_node_development_per_day,
        "scenarios": scenarios,
        "area_unit_meta": area_meta,
    }


@app.post("/api/rtr/sensitivity")
async def compute_rtr_optimizer_sensitivity(req: RTRSensitivityRequest):
    """Compute local temperature sensitivities around the optimized RTR solution."""
    from .services.rtr.lagrangian_optimizer import optimize_rtr_targets
    from .services.rtr.control_effects import build_actuator_availability
    from .services.rtr.scenario_runner import compute_rtr_temperature_sensitivity

    (
        crop,
        store,
        resolved_greenhouse_id,
        snapshot_record,
        _profiles_payload,
        area_meta,
        optimization_inputs,
        context,
    ) = _build_rtr_request_bundle(req.model_dump(exclude_none=True))
    optimized_candidate = optimize_rtr_targets(
        context=context,
        optimization_inputs=optimization_inputs,
    )
    sensitivity_payload = compute_rtr_temperature_sensitivity(
        context=context,
        optimization_inputs=optimization_inputs,
        optimized_candidate=optimized_candidate,
        step_c=float(req.step_c),
    )
    stored_rows = store.persist_sensitivity_outputs(
        snapshot_id=snapshot_record["snapshot_id"],
        greenhouse_id=resolved_greenhouse_id,
        crop=crop,
        horizon_hours=24,
        sensitivities=sensitivity_payload["sensitivities"],
    )
    return {
        "status": "success",
        "mode": "optimizer",
        "crop": crop,
        "greenhouse_id": resolved_greenhouse_id,
        "snapshot_id": snapshot_record["snapshot_id"],
        "target_horizon": optimization_inputs.target_horizon,
        "step_c": req.step_c,
        "sensitivities": stored_rows,
        "optimized_targets": optimized_candidate["controls"],
        "area_unit_meta": area_meta,
        "actuator_availability": build_actuator_availability(context.ops_config).as_dict(),
    }


@app.post("/api/rtr/area-settings")
async def save_rtr_area_settings(req: RTRAreaSettingsRequest):
    """Persist actual-area overrides for RTR projections per crop/greenhouse."""
    crop = _validate_crop(req.crop)
    greenhouse_id = _resolve_greenhouse_id(crop, req.greenhouse_id)
    area_meta = _resolve_rtr_area_meta(
        crop,
        greenhouse_id,
        user_actual_area_m2=req.user_actual_area_m2,
        user_actual_area_pyeong=req.user_actual_area_pyeong,
    )
    _get_rtr_area_settings_store(crop)[greenhouse_id] = {
        "actual_area_m2": float(area_meta["actual_area_m2"] or 0.0),
        "actual_area_pyeong": float(area_meta["actual_area_pyeong"] or 0.0),
    }
    return {
        "status": "success",
        "crop": crop,
        "greenhouse_id": greenhouse_id,
        "area_unit_meta": area_meta,
    }


@app.get("/api/rtr/calibration-state")
async def get_rtr_calibration_state(crop: str, greenhouse_id: Optional[str] = None):
    """Return the current RTR calibration windows and profile for a crop/house."""
    normalized_crop = _validate_crop(crop)
    resolved_greenhouse_id = _resolve_greenhouse_id(normalized_crop, greenhouse_id)
    profiles_payload = load_rtr_profiles()
    windows_payload = load_rtr_good_windows()
    current_windows = filter_rtr_good_windows_for_house(
        windows_payload,
        normalized_crop,
        resolved_greenhouse_id,
    )
    _, environment_summary = _build_rtr_calibration_environment_summary(normalized_crop, profiles_payload)
    crop_key = _get_rtr_profile_crop_key(normalized_crop)
    return {
        "status": "success",
        "crop": normalized_crop,
        "greenhouse_id": resolved_greenhouse_id,
        "current_profile": copy.deepcopy(profiles_payload.get("profiles", {}).get(crop_key, {})),
        "windows": current_windows,
        "environment_summary": environment_summary,
        "available_selection_modes": ["windows-only", "auto", "heuristic-only"],
        "selection_mode": "windows-only",
    }


@app.post("/api/rtr/calibration-preview")
async def preview_rtr_calibration(req: RTRCalibrationPreviewRequest):
    """Preview an RTR calibration fit using user-entered good-production windows."""
    normalized_crop = _validate_crop(req.crop)
    resolved_greenhouse_id = _resolve_greenhouse_id(normalized_crop, req.greenhouse_id)
    profiles_payload = load_rtr_profiles()
    scoped_windows = _serialize_rtr_calibration_windows(
        normalized_crop,
        resolved_greenhouse_id,
        [window.model_dump(exclude_none=True) for window in req.windows],
    )
    return _build_rtr_calibration_preview_payload(
        crop=normalized_crop,
        greenhouse_id=resolved_greenhouse_id,
        selection_mode=req.selection_mode,
        windows=scoped_windows,
        profiles_payload=profiles_payload,
    )


@app.post("/api/rtr/calibration-save")
async def save_rtr_calibration(req: RTRCalibrationSaveRequest):
    """Persist RTR calibration windows and refresh the crop RTR profile."""
    normalized_crop = _validate_crop(req.crop)
    resolved_greenhouse_id = _resolve_greenhouse_id(normalized_crop, req.greenhouse_id)
    crop_key = _get_rtr_profile_crop_key(normalized_crop)
    incoming_windows = [window.model_dump(exclude_none=True) for window in req.windows]
    existing_windows_payload = load_rtr_good_windows()
    updated_windows_payload = upsert_rtr_good_windows(
        existing_windows_payload,
        crop=normalized_crop,
        greenhouse_id=resolved_greenhouse_id,
        windows=incoming_windows,
    )
    scoped_windows = filter_rtr_good_windows_for_house(
        updated_windows_payload,
        normalized_crop,
        resolved_greenhouse_id,
    )
    profiles_payload = load_rtr_profiles()
    preview_payload = _build_rtr_calibration_preview_payload(
        crop=normalized_crop,
        greenhouse_id=resolved_greenhouse_id,
        selection_mode=req.selection_mode,
        windows=scoped_windows,
        profiles_payload=profiles_payload,
    )
    updated_profiles_payload = copy.deepcopy(profiles_payload)
    updated_profiles_payload.setdefault("profiles", {})[crop_key] = preview_payload["preview_profile"]
    updated_profiles_payload["updatedAt"] = datetime.now(UTC).isoformat()
    windows_path = save_rtr_good_windows(updated_windows_payload)
    profiles_path = save_rtr_profiles(updated_profiles_payload)
    return {
        **preview_payload,
        "saved": True,
        "current_profile": preview_payload["preview_profile"],
        "config_paths": {
            "windows": str(windows_path),
            "profiles": str(profiles_path),
        },
    }



@app.post("/api/crop/prune")
async def mark_pruning_event(crop: str = "cucumber"):
    """Mark manual pruning event for cucumber."""
    crop = _validate_crop(crop)
    if crop != "cucumber":
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
    _schedule_forecast(crop, force=True)

    crop_state["pending_prune_reset"] = False
    return {"status": "success", "crop": crop, "adapter_active": True, "message": "Pruning baseline updated"}


@app.get("/api/config/crop")
async def get_crop_config(crop: str):
    """Get current crop configuration."""
    crop = _validate_crop(crop)
    return _serialize_crop_config(crop)


@app.get("/api/recommendations")
async def get_recommendations(crop: Optional[str] = None):
    """Get AI-based crop management recommendations for one or both crops."""
    result = {}
    
    crops_to_check = _target_crops(crop)
    
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
    now_utc = datetime.now(UTC)
    
    for crop_name in CROPS:
        crop_state = app_state[crop_name]
        ops_config = dict(_get_ops_config(crop_name))
        control_state = _serialize_control_state(crop_name)
        
        if crop_state["simulator"] is None:
            status_result[crop_name] = {
                "status": "idle",
                "ops_config": ops_config,
                "control_state": control_state,
            }
        else:
            simulator = crop_state["simulator"]
            sim_task = crop_state.get("sim_task")
            task_alive = sim_task is not None and not sim_task.done()
            is_paused = simulator.running and task_alive and bool(getattr(simulator, "paused", False))
            total_rows = len(simulator.df_env)
            at_end = total_rows > 0 and simulator.idx >= total_rows - 1
            last_tick_at = crop_state.get("last_runtime_tick_at")
            last_error = crop_state.get("last_runtime_error")
            last_error_at = crop_state.get("last_runtime_error_at")
            is_stalled = (
                simulator.running
                and not is_paused
                and not at_end
                and (
                    not task_alive
                    or (
                        isinstance(last_tick_at, datetime)
                        and now_utc - (last_tick_at if last_tick_at.tzinfo else last_tick_at.replace(tzinfo=UTC))
                        > SIMULATION_TASK_STALL_THRESHOLD
                    )
                )
            )
            if total_rows <= 1:
                progress = 100.0 if at_end else 0.0
            else:
                progress = round(
                    min(simulator.idx, total_rows - 1) / (total_rows - 1) * 100,
                    2,
                )

            if at_end:
                status = "completed"
            elif is_paused:
                status = "paused"
            elif is_stalled:
                status = "stalled"
            elif simulator.running and task_alive:
                status = "active"
            else:
                status = "stopped"

            status_result[crop_name] = {
                "status": status,
                "running": simulator.running,
                "at_end": at_end,
                "idx": simulator.idx,
                "total_rows": total_rows,
                "progress": progress,
                "time_step": crop_state.get("time_step", "auto"),
                "dt_minutes": round(crop_state.get("dt_hours", 0) * 60, 3)
                if crop_state.get("dt_hours")
                else None,
                "paused": is_paused,
                "task_alive": task_alive,
                "last_tick_at": _serialize_datetime(last_tick_at),
                "last_error": last_error,
                "last_error_at": _serialize_datetime(last_error_at),
                "ops_config": ops_config,
                "control_state": control_state,
            }
    
    return {"status": "success", "greenhouses": status_result}


@app.get("/api/forecast/{crop}")
async def get_forecast(crop: str):
    """Get latest forecast for a crop."""
    crop = _validate_crop(crop)
    
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
