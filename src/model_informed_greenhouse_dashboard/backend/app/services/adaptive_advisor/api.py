"""FastAPI routes for the adaptive advisor graph shadow surface."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException

from .change_detection import detect_material_change
from .contracts import (
    AdaptiveAdvisorRequest,
    AdaptiveAdvisorResponse,
    AdaptiveGraphPlan,
    MaterialChangeDecision,
    MaterialChangeRequest,
    OperationsCalendar,
    OperationsCalendarWrite,
)
from .executor import execute_adaptive_advisor
from .operations_calendar import CalendarRevisionConflict, OperationsCalendarStore
from .planner import build_adaptive_plan


router = APIRouter(
    prefix="/api/advisor/adaptive",
    tags=["adaptive-advisor"],
)
_calendar_store = OperationsCalendarStore()


@router.get("/health")
async def adaptive_advisor_health() -> dict[str, str]:
    return {
        "status": "ready",
        "schema_version": "adaptive-advisor-response.v1",
        "runtime": "bounded-run-specific-graph",
        "answer_packet": "adaptive-answer-packet.v2",
        "quality_pipeline": "post-render-reviewed",
    }


@router.post("/plan", response_model=AdaptiveGraphPlan)
async def plan_adaptive_advisor(
    request: AdaptiveAdvisorRequest,
) -> AdaptiveGraphPlan:
    """Compile a question and dashboard snapshot into a bounded graph plan."""
    return build_adaptive_plan(request)


@router.post("/execute", response_model=AdaptiveAdvisorResponse)
async def run_adaptive_advisor(
    request: AdaptiveAdvisorRequest,
) -> AdaptiveAdvisorResponse:
    """Execute the graph, review the rendered answer, then score delivered quality."""
    try:
        return await execute_adaptive_advisor(request)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/material-change", response_model=MaterialChangeDecision)
async def material_change(
    request: MaterialChangeRequest,
) -> MaterialChangeDecision:
    """Determine whether changed live context invalidates the previous advice."""
    return detect_material_change(request.previous, request.current)


@router.get(
    "/operations-calendar/{greenhouse_id}",
    response_model=OperationsCalendar,
)
async def get_operations_calendar(greenhouse_id: str) -> OperationsCalendar:
    try:
        return _calendar_store.load(greenhouse_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.put(
    "/operations-calendar/{greenhouse_id}",
    response_model=OperationsCalendar,
)
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
