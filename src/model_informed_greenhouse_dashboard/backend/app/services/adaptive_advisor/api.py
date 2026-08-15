"""FastAPI routes for the adaptive advisor and its durable data seams."""

from __future__ import annotations

from datetime import UTC, date, datetime, timedelta
from zoneinfo import ZoneInfo

from fastapi import APIRouter, HTTPException, Query

from .change_detection import detect_material_change
from .contracts import (
    AdaptiveAdvisorRequest,
    AdaptiveAdvisorResponse,
    AdaptiveGraphPlan,
    AdvisorFeedback,
    AdvisorOutcome,
    MarketObservationBatch,
    MaterialChangeDecision,
    MaterialChangeRequest,
    OperationsCalendar,
    OperationsCalendarWrite,
    TelemetryIngestRequest,
)
from .conversation_store import ConversationStore, ConversationThreadConflict
from .executor import execute_adaptive_advisor
from .market_supply_shock import MarketObservationStore, estimate_supply_shock
from .operations_calendar import CalendarRevisionConflict, OperationsCalendarStore
from .planner import build_adaptive_plan
from .quality_ledger import QualityLedger
from .routing_regression import evaluate_routing_regression
from .telemetry_store import TelemetryStore


SEOUL = ZoneInfo("Asia/Seoul")
router = APIRouter(prefix="/api/advisor/adaptive", tags=["adaptive-advisor"])
_calendar_store = OperationsCalendarStore()
_telemetry_store = TelemetryStore()
_market_store = MarketObservationStore()
_quality_ledger = QualityLedger()
_conversation_store = ConversationStore()


@router.get("/health")
async def adaptive_advisor_health() -> dict:
    return {
        "status": "ready",
        "schema_version": "adaptive-advisor-response.v3",
        "runtime": "bounded-run-specific-graph",
        "history_authority": _telemetry_store.describe(),
        "conversation_store": _conversation_store.describe(),
        "market_observations": _market_store.describe(),
        "quality_ledger": _quality_ledger.summary(),
        "market_model": "holiday-arrival-supply-shock.v1",
        "routing_regression": "offline-routing-ridge.v2",
        "numeric_gate": "unit-aware-curated-claims.v1",
        "snapshot_resolution": "server-aware-current-state.v1",
    }


@router.post("/plan", response_model=AdaptiveGraphPlan)
async def plan_adaptive_advisor(request: AdaptiveAdvisorRequest) -> AdaptiveGraphPlan:
    return build_adaptive_plan(request)


@router.post("/execute", response_model=AdaptiveAdvisorResponse)
async def run_adaptive_advisor(request: AdaptiveAdvisorRequest) -> AdaptiveAdvisorResponse:
    try:
        return await execute_adaptive_advisor(request)
    except ConversationThreadConflict as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/material-change", response_model=MaterialChangeDecision)
async def material_change(request: MaterialChangeRequest) -> MaterialChangeDecision:
    return detect_material_change(request.previous, request.current)


@router.get("/operations-calendar/{greenhouse_id}", response_model=OperationsCalendar)
async def get_operations_calendar(greenhouse_id: str) -> OperationsCalendar:
    try:
        return _calendar_store.load(greenhouse_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.put("/operations-calendar/{greenhouse_id}", response_model=OperationsCalendar)
async def put_operations_calendar(
    greenhouse_id: str,
    request: OperationsCalendarWrite,
) -> OperationsCalendar:
    if request.calendar.greenhouse_id != greenhouse_id:
        raise HTTPException(
            status_code=400,
            detail="path greenhouse_id must match calendar.greenhouse_id",
        )
    try:
        return _calendar_store.save(
            request.calendar,
            expected_revision=request.expected_revision,
        )
    except CalendarRevisionConflict as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc


@router.post("/telemetry/ingest")
async def ingest_telemetry(request: TelemetryIngestRequest) -> dict:
    return {
        "status": "success",
        **_telemetry_store.append_many(
            request.points,
            crop=request.crop,
            greenhouse_id=request.greenhouse_id,
            source=request.source,
        ),
        "store": _telemetry_store.describe(),
    }


@router.get("/telemetry/{greenhouse_id}")
async def get_telemetry_window(
    greenhouse_id: str,
    crop: str = Query(pattern="^(tomato|cucumber)$"),
    hours: int = Query(default=48, ge=1, le=24 * 31),
    end: datetime | None = None,
    limit: int = Query(default=20000, ge=1, le=100000),
) -> dict:
    end_at = (end or datetime.now(UTC)).astimezone(UTC)
    rows = _telemetry_store.query_window(
        crop=crop,
        greenhouse_id=greenhouse_id,
        start=end_at - timedelta(hours=hours),
        end=end_at,
        limit=limit,
    )
    return {
        "status": "ready" if rows else "empty",
        "greenhouse_id": greenhouse_id,
        "crop": crop,
        "window": {
            "start": (end_at - timedelta(hours=hours)).isoformat(),
            "end": end_at.isoformat(),
        },
        "point_count": len(rows),
        "points": rows,
    }


@router.get("/telemetry/{greenhouse_id}/same-time")
async def compare_server_same_time(
    greenhouse_id: str,
    crop: str = Query(pattern="^(tomato|cucumber)$"),
    target_signal: str = "photosynthesis",
) -> dict:
    facets = {
        "intent": "DIAGNOSE",
        "comparison_mode": "SAME_TIME_PREVIOUS_DAY",
        "target_signals": [target_signal],
    }
    return _telemetry_store.compare_same_time(
        crop=crop,
        greenhouse_id=greenhouse_id,
        current_data=None,
        facets=facets,
    )


@router.get("/threads/{thread_id}")
async def get_adaptive_thread(
    thread_id: str,
    limit: int = Query(default=20, ge=1, le=40),
) -> dict:
    try:
        payload = _conversation_store.get_thread(thread_id, limit=limit)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    if payload is None:
        raise HTTPException(status_code=404, detail=f"unknown thread_id: {thread_id}")
    return payload


@router.post("/market/observations")
async def ingest_market_observations(request: MarketObservationBatch) -> dict:
    return {
        "status": "success",
        **_market_store.append_many(request.observations),
        "store": _market_store.describe(),
    }


@router.get("/market/supply-shock/{greenhouse_id}")
async def get_market_supply_shock(
    greenhouse_id: str,
    crop: str = Query(pattern="^(tomato|cucumber)$"),
    market_id: str = "kamis-wholesale",
    forecast_start: date | None = None,
    horizon_days: int = Query(default=14, ge=1, le=31),
) -> dict:
    return estimate_supply_shock(
        market_store=_market_store,
        calendar_store=_calendar_store,
        market_id=market_id,
        crop=crop,
        greenhouse_id=greenhouse_id,
        forecast_start=forecast_start or datetime.now(SEOUL).date(),
        horizon_days=horizon_days,
    )


@router.post("/feedback")
async def submit_advisor_feedback(feedback: AdvisorFeedback) -> dict:
    try:
        return {"status": "recorded", **_quality_ledger.add_feedback(feedback)}
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.post("/outcomes")
async def submit_advisor_outcome(outcome: AdvisorOutcome) -> dict:
    try:
        return {"status": "recorded", **_quality_ledger.add_outcome(outcome)}
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.get("/quality-summary")
async def adaptive_quality_summary() -> dict:
    return _quality_ledger.summary()


@router.get("/quality-calibration")
async def adaptive_quality_calibration(
    minimum_examples: int = Query(default=10, ge=5, le=1000),
) -> dict:
    return _quality_ledger.calibration(minimum_examples=minimum_examples)


@router.get("/runs/{run_id}")
async def get_adaptive_run(run_id: str) -> dict:
    payload = _quality_ledger.get_run(run_id)
    if payload is None:
        raise HTTPException(status_code=404, detail=f"unknown run_id: {run_id}")
    return payload


@router.get("/routing-regression")
async def routing_regression(
    minimum_examples: int = Query(default=12, ge=6, le=1000),
    holdout_fraction: float = Query(default=0.25, gt=0.05, lt=0.5),
    ridge_alpha: float = Query(default=1.0, gt=0, le=100),
) -> dict:
    return evaluate_routing_regression(
        _quality_ledger,
        minimum_examples=minimum_examples,
        holdout_fraction=holdout_fraction,
        ridge_alpha=ridge_alpha,
    )
