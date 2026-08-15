"""Typed contracts for the adaptive greenhouse advisor and quality loop."""

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
    ANSWER_PACKET = "answer_packet"
    NARRATE = "narrate"
    RESPONSE_REVIEW = "response_review"
    QUALITY_GATE = "quality_gate"


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
    """Validated run-specific plan with a non-removable safety and review tail."""

    model_config = ConfigDict(extra="forbid")

    schema_version: Literal["adaptive-advisor-plan.v2"] = "adaptive-advisor-plan.v2"
    intent: AdvisorIntent
    nodes: list[AdaptiveNode] = Field(min_length=6, max_length=24)
    controls: list[AllowedControl] = Field(default_factory=list, max_length=5)
    horizons_hours: list[AllowedHorizon] = Field(default_factory=list, max_length=4)
    max_parallel_nodes: int = Field(default=5, ge=1, le=8)
    max_model_evaluations: int = Field(default=8, ge=0, le=24)
    include_narrative: bool = True
    reasons: list[str] = Field(default_factory=list, max_length=20)

    @model_validator(mode="after")
    def validate_graph(self) -> "AdaptiveGraphPlan":
        if len(self.nodes) != len(set(self.nodes)):
            raise ValueError("graph plan nodes must be unique")
        if self.nodes[0] is not AdaptiveNode.FREEZE_SNAPSHOT:
            raise ValueError("freeze_snapshot must be the first graph node")

        required = (
            AdaptiveNode.CONSTRAINT_GATE,
            AdaptiveNode.ANSWER_ADMISSION,
            AdaptiveNode.ANSWER_PACKET,
            AdaptiveNode.RESPONSE_REVIEW,
            AdaptiveNode.QUALITY_GATE,
        )
        missing = [node.value for node in required if node not in self.nodes]
        if missing:
            raise ValueError(f"missing mandatory graph nodes: {', '.join(missing)}")

        positions = {node: self.nodes.index(node) for node in required}
        if not (
            positions[AdaptiveNode.CONSTRAINT_GATE]
            < positions[AdaptiveNode.ANSWER_ADMISSION]
            < positions[AdaptiveNode.ANSWER_PACKET]
            < positions[AdaptiveNode.RESPONSE_REVIEW]
            < positions[AdaptiveNode.QUALITY_GATE]
        ):
            raise ValueError(
                "mandatory order is constraint -> admission -> packet -> review -> quality"
            )
        if self.nodes[-1] is not AdaptiveNode.QUALITY_GATE:
            raise ValueError("quality_gate must be the final graph node")

        if self.include_narrative:
            if AdaptiveNode.NARRATE not in self.nodes:
                raise ValueError("narrate is required when narrative is enabled")
            narrative_position = self.nodes.index(AdaptiveNode.NARRATE)
            if not (
                positions[AdaptiveNode.ANSWER_PACKET]
                < narrative_position
                < positions[AdaptiveNode.RESPONSE_REVIEW]
            ):
                raise ValueError("narrate must run between answer_packet and response_review")
        elif AdaptiveNode.NARRATE in self.nodes:
            raise ValueError("narrate cannot be present when narrative is disabled")

        if any(
            node in self.nodes
            for node in (AdaptiveNode.BOUNDED_SCENARIO, AdaptiveNode.SENSITIVITY)
        ) and not self.horizons_hours:
            raise ValueError("model nodes require at least one horizon")
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
    observed_signal_score: float | None = Field(default=None, ge=0, le=1)
    latest_observation_at: datetime | None = None


class ModelQuality(BaseModel):
    applicability: float = Field(ge=0, le=1)
    exact_request_match: bool | None = None
    within_supported_range: bool | None = None
    scenario_confidence: float | None = Field(default=None, ge=0, le=1)
    observed_input_fraction: float | None = Field(default=None, ge=0, le=1)
    inferred_input_count: int = Field(default=0, ge=0)
    constraint_status: ConstraintStatus
    violated_constraints: list[dict[str, Any]] = Field(default_factory=list)


class ContextQuality(BaseModel):
    expert_knowledge: ContextStatus = ContextStatus.NOT_REQUESTED
    weather: ContextStatus = ContextStatus.NOT_REQUESTED
    operations: ContextStatus = ContextStatus.NOT_REQUESTED
    market: ContextStatus = ContextStatus.NOT_REQUESTED


class AnswerContentQuality(BaseModel):
    diagnostic_depth: float = Field(ge=0, le=1)
    actionability: float = Field(ge=0, le=1)
    temporal_alignment: float = Field(ge=0, le=1)
    cross_domain_synthesis: float = Field(ge=0, le=1)
    numerical_integrity: float = Field(ge=0, le=1)
    uncertainty_honesty: float = Field(ge=0, le=1)
    gaps: list[str] = Field(default_factory=list)


class ResponseQuality(BaseModel):
    coverage: float = Field(ge=0, le=1)
    required_elements: list[str] = Field(default_factory=list)
    present_elements: list[str] = Field(default_factory=list)
    unsupported_numeric_claims: list[str] = Field(default_factory=list)
    fallback_used: bool = False
    source: Literal["llm", "deterministic_fallback", "deterministic_only"]
    reasons: list[str] = Field(default_factory=list)


class HorizonQuality(BaseModel):
    valid_from: datetime
    valid_until: datetime
    forecast_hours: int = Field(ge=0)
    invalidation_events: list[str] = Field(default_factory=list)


class AdvisorQualityProfile(BaseModel):
    schema_version: Literal["advisor-quality-profile.v2"] = "advisor-quality-profile.v2"
    capability: AnswerCapability
    answer_status: AnswerStatus
    score: float = Field(ge=0, le=1)
    readiness_score: float = Field(ge=0, le=1)
    data: DataQuality
    model: ModelQuality
    context: ContextQuality
    content: AnswerContentQuality
    response: ResponseQuality
    horizon: HorizonQuality
    adaptive_triggers: list[str] = Field(default_factory=list)
    executed_nodes: list[AdaptiveNode] = Field(default_factory=list)


class AnswerDriver(BaseModel):
    code: str
    label: str
    support: float = Field(ge=0, le=1)
    observations: list[str] = Field(default_factory=list)


class AnswerAction(BaseModel):
    rank: int = Field(ge=1)
    title: str
    operator: str
    time_window: str
    expected_effect: str
    condition: str | None = None
    control: AllowedControl | None = None


class AdaptiveAnswerPacket(BaseModel):
    schema_version: Literal["adaptive-answer-packet.v3"] = "adaptive-answer-packet.v3"
    question: str
    intent: AdvisorIntent
    answer_status: AnswerStatus
    direct_answer: str
    observations: list[str] = Field(default_factory=list)
    causal_drivers: list[AnswerDriver] = Field(default_factory=list)
    actions: list[AnswerAction] = Field(default_factory=list)
    uncertainties: list[str] = Field(default_factory=list)
    authorized_numbers: list[str] = Field(default_factory=list)
    temporal_context: dict[str, Any] = Field(default_factory=dict)
    model_context: dict[str, Any] = Field(default_factory=dict)
    weather_context: dict[str, Any] = Field(default_factory=dict)
    market_context: dict[str, Any] = Field(default_factory=dict)
    operations_context: dict[str, Any] = Field(default_factory=dict)
    expert_context: dict[str, Any] = Field(default_factory=dict)


class ResponseReview(BaseModel):
    accepted: bool
    text: str
    coverage: float = Field(ge=0, le=1)
    required_elements: list[str] = Field(default_factory=list)
    present_elements: list[str] = Field(default_factory=list)
    unsupported_numeric_claims: list[str] = Field(default_factory=list)
    fallback_used: bool = False
    source: Literal["llm", "deterministic_fallback", "deterministic_only"]
    reasons: list[str] = Field(default_factory=list)
    content_scores: dict[str, float] = Field(default_factory=dict)
    quality_gaps: list[str] = Field(default_factory=list)


class MaterialChangeRequest(BaseModel):
    previous: dict[str, Any] = Field(default_factory=dict)
    current: dict[str, Any] = Field(default_factory=dict)


class MaterialChangeDecision(BaseModel):
    rerun_required: bool
    reasons: list[str] = Field(default_factory=list)
    changed_domains: list[str] = Field(default_factory=list)
    previous_fingerprint: str
    current_fingerprint: str


class TelemetryIngestRequest(BaseModel):
    crop: Literal["tomato", "cucumber"]
    greenhouse_id: str | None = None
    source: str = Field(default="api", min_length=1, max_length=80)
    points: list[dict[str, Any]] = Field(min_length=1, max_length=10000)


class MarketArrivalObservation(BaseModel):
    model_config = ConfigDict(extra="forbid")

    market_id: str = Field(min_length=1, max_length=96)
    crop: Literal["tomato", "cucumber"]
    observation_date: date
    arrival_volume_kg: float = Field(gt=0)
    wholesale_price_krw_per_kg: float | None = Field(default=None, gt=0)
    source: str = Field(default="operator", min_length=1, max_length=120)
    metadata: dict[str, Any] = Field(default_factory=dict)


class MarketObservationBatch(BaseModel):
    observations: list[MarketArrivalObservation] = Field(min_length=1, max_length=5000)


class FeedbackIssue(str, Enum):
    MISSING_CAUSE = "missing_cause"
    VAGUE_ACTION = "vague_action"
    WRONG_NUMBER = "wrong_number"
    MISSING_CONTEXT = "missing_context"
    TOO_VERBOSE = "too_verbose"
    WRONG_ROUTE = "wrong_route"
    OTHER = "other"


class AdvisorFeedback(BaseModel):
    model_config = ConfigDict(extra="forbid")

    run_id: str = Field(min_length=8, max_length=96)
    helpful: bool
    issue_codes: list[FeedbackIssue] = Field(default_factory=list, max_length=10)
    comment: str | None = Field(default=None, max_length=2000)
    submitted_at: datetime = Field(default_factory=lambda: datetime.now(UTC))


class AdvisorOutcome(BaseModel):
    model_config = ConfigDict(extra="forbid")

    run_id: str = Field(min_length=8, max_length=96)
    observed_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    horizon_hours: int = Field(ge=0, le=24 * 365)
    reward: float | None = Field(default=None, ge=-1, le=1)
    metrics: dict[str, float] = Field(default_factory=dict)
    notes: str | None = Field(default=None, max_length=2000)


class AdaptiveAdvisorResponse(BaseModel):
    schema_version: Literal["adaptive-advisor-response.v2"] = "adaptive-advisor-response.v2"
    run_id: str
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
    answer_packet: AdaptiveAnswerPacket
    text: str
    machine_payload: dict[str, Any] = Field(default_factory=dict)
