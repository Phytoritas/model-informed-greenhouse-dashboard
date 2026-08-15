"""Typed contracts for the run-specific adaptive advisor computation graph."""

from __future__ import annotations

from datetime import UTC, date, datetime
from enum import Enum
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator


class AdvisorIntent(str, Enum):
    STATUS = "STATUS"
    DIAGNOSE = "DIAGNOSE"
    WHAT_IF = "WHAT_IF"
    PLAN = "PLAN"
    OPTIMIZE = "OPTIMIZE"


class AdaptiveNode(str, Enum):
    FREEZE_SNAPSHOT = "freeze_snapshot"
    LIVE_SNAPSHOT = "live_snapshot"
    HISTORY_COMPARE = "history_compare"
    ENVIRONMENT_ANALYSIS = "environment_analysis"
    PHYSIOLOGY_DIAGNOSIS = "physiology_diagnosis"
    WORK_PLANNING = "work_planning"
    HARVEST_MARKET_ANALYSIS = "harvest_market_analysis"
    BOUNDED_SCENARIO = "bounded_scenario"
    SENSITIVITY = "sensitivity"
    EXPERT_WIKI = "expert_wiki"
    WEATHER_OUTLOOK = "weather_outlook"
    MARKET_OUTLOOK = "market_outlook"
    OPERATIONS_CALENDAR = "operations_calendar"
    CONSTRAINT_GATE = "constraint_gate"
    ANSWER_ADMISSION = "answer_admission"
    QUALITY_GATE = "quality_gate"
    NARRATE = "narrate"


class AnswerCapability(str, Enum):
    LIVE_STATUS = "LIVE_STATUS"
    DIAGNOSTIC = "DIAGNOSTIC"
    MODEL_WHAT_IF = "MODEL_WHAT_IF"
    OPERATIONAL_PLAN = "OPERATIONAL_PLAN"
    CONSTRAINED_OPTIMIZATION = "CONSTRAINED_OPTIMIZATION"


class AnswerStatus(str, Enum):
    OPERATIONAL = "OPERATIONAL"
    CONDITIONAL = "CONDITIONAL"
    MONITORING_FIRST = "MONITORING_FIRST"
    NEEDS_DATA = "NEEDS_DATA"
    REFUSED = "REFUSED"


class NodeStatus(str, Enum):
    SUCCESS = "SUCCESS"
    SKIPPED = "SKIPPED"
    DEGRADED = "DEGRADED"
    FAILED = "FAILED"


class ContextStatus(str, Enum):
    READY = "READY"
    PARTIAL = "PARTIAL"
    NO_MATCH = "NO_MATCH"
    STALE = "STALE"
    UNAVAILABLE = "UNAVAILABLE"
    NOT_REQUESTED = "NOT_REQUESTED"


class ConstraintStatus(str, Enum):
    PASS = "PASS"
    WARNING = "WARNING"
    FAIL = "FAIL"


class OperationsEventType(str, Enum):
    HOLIDAY = "HOLIDAY"
    MARKET_CLOSURE = "MARKET_CLOSURE"
    SHIPMENT_BLACKOUT = "SHIPMENT_BLACKOUT"
    SHIPMENT_TARGET = "SHIPMENT_TARGET"
    LABOR_CAPACITY = "LABOR_CAPACITY"
    PACKING_CAPACITY = "PACKING_CAPACITY"
    STORAGE_CAPACITY = "STORAGE_CAPACITY"
    OTHER = "OTHER"


AllowedControl = Literal[
    "co2_setpoint_day",
    "temperature_day",
    "temperature_night",
    "rh_target",
    "screen_close",
]
AllowedHorizon = Literal[24, 72, 168, 336]


class AdaptiveGraphPlan(BaseModel):
    """A validated, bounded run-specific graph plan.

    The planner may choose context/calculation nodes, but the fixed safety spine is
    mandatory and cannot be removed by an LLM- or client-proposed plan.
    """

    model_config = ConfigDict(extra="forbid")

    schema_version: Literal["adaptive-advisor-plan.v1"] = "adaptive-advisor-plan.v1"
    intent: AdvisorIntent
    nodes: list[AdaptiveNode] = Field(min_length=5, max_length=18)
    controls: list[AllowedControl] = Field(default_factory=list, max_length=5)
    horizons_hours: list[AllowedHorizon] = Field(default_factory=list, max_length=4)
    max_parallel_nodes: int = Field(default=5, ge=1, le=8)
    max_model_evaluations: int = Field(default=8, ge=0, le=24)
    include_narrative: bool = True
    reasons: list[str] = Field(default_factory=list, max_length=16)

    @model_validator(mode="after")
    def validate_safety_spine(self) -> "AdaptiveGraphPlan":
        if len(self.nodes) != len(set(self.nodes)):
            raise ValueError("graph plan nodes must be unique")
        if self.nodes[0] is not AdaptiveNode.FREEZE_SNAPSHOT:
            raise ValueError("freeze_snapshot must be the first graph node")

        required = (
            AdaptiveNode.CONSTRAINT_GATE,
            AdaptiveNode.ANSWER_ADMISSION,
            AdaptiveNode.QUALITY_GATE,
        )
        missing = [node.value for node in required if node not in self.nodes]
        if missing:
            raise ValueError(f"missing mandatory safety nodes: {', '.join(missing)}")

        positions = {node: self.nodes.index(node) for node in required}
        if not (
            positions[AdaptiveNode.CONSTRAINT_GATE]
            < positions[AdaptiveNode.ANSWER_ADMISSION]
            < positions[AdaptiveNode.QUALITY_GATE]
        ):
            raise ValueError("safety nodes must run constraint -> admission -> quality")

        if self.include_narrative:
            if not self.nodes or self.nodes[-1] is not AdaptiveNode.NARRATE:
                raise ValueError("narrate must be the final node when narrative is enabled")
        elif AdaptiveNode.NARRATE in self.nodes:
            raise ValueError("narrate cannot be present when narrative is disabled")

        scenario_nodes = {
            AdaptiveNode.BOUNDED_SCENARIO,
            AdaptiveNode.SENSITIVITY,
        }
        if any(node in self.nodes for node in scenario_nodes) and not self.horizons_hours:
            raise ValueError("scenario or sensitivity nodes require at least one horizon")
        return self


class AdaptiveAdvisorRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    crop: Literal["tomato", "cucumber"]
    greenhouse_id: str | None = Field(default=None, min_length=1, max_length=96)
    question: str = Field(min_length=1, max_length=4000)
    messages: list[dict[str, str]] = Field(default_factory=list, max_length=40)
    dashboard: dict[str, Any] = Field(default_factory=dict)
    language: Literal["ko", "en"] = "ko"
    include_narrative: bool = True
    requested_plan: AdaptiveGraphPlan | None = None


class OperationsCalendarEvent(BaseModel):
    model_config = ConfigDict(extra="forbid")

    event_id: str = Field(min_length=1, max_length=96, pattern=r"^[A-Za-z0-9._:-]+$")
    event_type: OperationsEventType
    start_date: date
    end_date: date
    title: str = Field(min_length=1, max_length=240)
    amount: float | None = None
    unit: str | None = Field(default=None, max_length=48)
    priority: int = Field(default=50, ge=0, le=100)
    notes: str | None = Field(default=None, max_length=2000)
    metadata: dict[str, Any] = Field(default_factory=dict)

    @model_validator(mode="after")
    def validate_dates(self) -> "OperationsCalendarEvent":
        if self.end_date < self.start_date:
            raise ValueError("end_date must not be before start_date")
        return self


class OperationsCalendar(BaseModel):
    model_config = ConfigDict(extra="forbid")

    schema_version: Literal["operations-calendar.v1"] = "operations-calendar.v1"
    greenhouse_id: str = Field(min_length=1, max_length=96)
    timezone: str = Field(default="Asia/Seoul", min_length=1, max_length=64)
    revision: int = Field(default=0, ge=0)
    updated_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    events: list[OperationsCalendarEvent] = Field(default_factory=list, max_length=1000)

    @model_validator(mode="after")
    def validate_unique_events(self) -> "OperationsCalendar":
        ids = [event.event_id for event in self.events]
        if len(ids) != len(set(ids)):
            raise ValueError("operations calendar event_id values must be unique")
        return self


class OperationsCalendarWrite(BaseModel):
    model_config = ConfigDict(extra="forbid")

    expected_revision: int | None = Field(default=None, ge=0)
    calendar: OperationsCalendar


class NodeTrace(BaseModel):
    node: AdaptiveNode
    status: NodeStatus
    started_at: datetime
    finished_at: datetime
    duration_ms: float = Field(ge=0)
    summary: str
    output_keys: list[str] = Field(default_factory=list)
    error: str | None = None


class ConstraintGateResult(BaseModel):
    status: ConstraintStatus
    violations: list[dict[str, Any]] = Field(default_factory=list)
    risk_flags: list[str] = Field(default_factory=list)
    reason: str | None = None


class AdmissionResult(BaseModel):
    admitted: bool
    admitted_fact_count: int = Field(default=0, ge=0)
    refused_fact_count: int = Field(default=0, ge=0)
    exact_request_match: bool | None = None
    within_supported_range: bool | None = None
    reasons: list[str] = Field(default_factory=list)


class DataQuality(BaseModel):
    freshness: float = Field(ge=0, le=1)
    current_state_coverage: float = Field(ge=0, le=1)
    history_coverage: float = Field(ge=0, le=1)
    missing_fields: list[str] = Field(default_factory=list)
    inferred_fields: list[str] = Field(default_factory=list)
    latest_observation_at: datetime | None = None


class ModelQuality(BaseModel):
    applicability: float = Field(ge=0, le=1)
    exact_request_match: bool | None = None
    within_supported_range: bool | None = None
    scenario_confidence: float | None = Field(default=None, ge=0, le=1)
    constraint_status: ConstraintStatus
    violated_constraints: list[dict[str, Any]] = Field(default_factory=list)


class ContextQuality(BaseModel):
    expert_knowledge: ContextStatus = ContextStatus.NOT_REQUESTED
    weather: ContextStatus = ContextStatus.NOT_REQUESTED
    operations: ContextStatus = ContextStatus.NOT_REQUESTED
    market: ContextStatus = ContextStatus.NOT_REQUESTED


class HorizonQuality(BaseModel):
    valid_from: datetime
    valid_until: datetime
    forecast_hours: int = Field(ge=0)
    invalidation_events: list[str] = Field(default_factory=list)


class AdvisorQualityProfile(BaseModel):
    schema_version: Literal["advisor-quality-profile.v1"] = "advisor-quality-profile.v1"
    capability: AnswerCapability
    answer_status: AnswerStatus
    score: float = Field(ge=0, le=1)
    data: DataQuality
    model: ModelQuality
    context: ContextQuality
    horizon: HorizonQuality
    adaptive_triggers: list[str] = Field(default_factory=list)
    executed_nodes: list[AdaptiveNode] = Field(default_factory=list)


class MaterialChangeRequest(BaseModel):
    previous: dict[str, Any] = Field(default_factory=dict)
    current: dict[str, Any] = Field(default_factory=dict)


class MaterialChangeDecision(BaseModel):
    rerun_required: bool
    reasons: list[str] = Field(default_factory=list)
    changed_domains: list[str] = Field(default_factory=list)
    previous_fingerprint: str
    current_fingerprint: str


class AdaptiveAdvisorResponse(BaseModel):
    schema_version: Literal["adaptive-advisor-response.v1"] = "adaptive-advisor-response.v1"
    status: Literal["success", "degraded", "refused"]
    crop: Literal["tomato", "cucumber"]
    greenhouse_id: str
    question: str
    snapshot_fingerprint: str
    plan: AdaptiveGraphPlan
    trace: list[NodeTrace]
    quality_profile: AdvisorQualityProfile
    constraint_gate: ConstraintGateResult
    admission: AdmissionResult
    text: str
    machine_payload: dict[str, Any] = Field(default_factory=dict)
