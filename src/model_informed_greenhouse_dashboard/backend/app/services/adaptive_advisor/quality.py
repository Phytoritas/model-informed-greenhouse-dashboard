"""Deterministic quality profiling from the realized graph and its outputs."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from typing import Any

from .contracts import (
    AdaptiveGraphPlan,
    AdaptiveNode,
    AdmissionResult,
    AdvisorQualityProfile,
    AnswerCapability,
    AnswerStatus,
    ConstraintGateResult,
    ConstraintStatus,
    ContextQuality,
    ContextStatus,
    DataQuality,
    HorizonQuality,
    ModelQuality,
)


def _dict(value: Any) -> dict[str, Any]:
    return value if isinstance(value, dict) else {}


def _list(value: Any) -> list[Any]:
    return value if isinstance(value, list) else []


def _float(value: Any) -> float | None:
    try:
        number = float(value)
    except (TypeError, ValueError):
        return None
    if number != number:
        return None
    return number


def _parse_datetime(value: Any) -> datetime | None:
    if isinstance(value, datetime):
        return value if value.tzinfo else value.replace(tzinfo=UTC)
    if not isinstance(value, str) or not value.strip():
        return None
    normalized = value.strip().replace("Z", "+00:00")
    try:
        parsed = datetime.fromisoformat(normalized)
    except ValueError:
        return None
    return parsed if parsed.tzinfo else parsed.replace(tzinfo=UTC)


def _latest_observation(dashboard: dict[str, Any]) -> datetime | None:
    current = _dict(dashboard.get("currentData") or dashboard.get("data"))
    candidates = [
        current.get("datetime"),
        current.get("timestamp"),
        current.get("t"),
        dashboard.get("telemetryReceivedAt"),
        dashboard.get("updated_at"),
    ]
    parsed = [item for value in candidates if (item := _parse_datetime(value))]
    return max(parsed) if parsed else None


def _freshness(latest: datetime | None, now: datetime) -> float:
    if latest is None:
        return 0.35
    age = max((now - latest.astimezone(UTC)).total_seconds(), 0.0)
    if age <= 5 * 60:
        return 1.0
    if age <= 15 * 60:
        return 0.85
    if age <= 60 * 60:
        return 0.55
    if age <= 6 * 60 * 60:
        return 0.3
    return 0.1


def _coverage(dashboard: dict[str, Any]) -> tuple[float, float, list[str]]:
    current = _dict(dashboard.get("currentData") or dashboard.get("data"))
    metrics = _dict(dashboard.get("metrics"))
    required_current = ("temperature", "humidity", "co2", "light", "vpd")
    present_current = sum(
        1 for key in required_current if current.get(key) is not None
    )
    current_coverage = present_current / len(required_current)
    if metrics:
        current_coverage = min(1.0, current_coverage + 0.1)

    recent = _dict(dashboard.get("recentSummary"))
    variables = _dict(recent.get("variables"))
    history_coverage = min(1.0, len(variables) / 5) if variables else (0.5 if recent else 0.0)

    missing = [f"currentData.{key}" for key in required_current if current.get(key) is None]
    if not metrics:
        missing.append("metrics")
    if not recent:
        missing.append("recentSummary")
    return round(current_coverage, 4), round(history_coverage, 4), missing


def _model_runtime(outputs: dict[str, Any]) -> dict[str, Any]:
    for key in (
        AdaptiveNode.PHYSIOLOGY_DIAGNOSIS.value,
        AdaptiveNode.ENVIRONMENT_ANALYSIS.value,
        AdaptiveNode.HARVEST_MARKET_ANALYSIS.value,
        AdaptiveNode.WORK_PLANNING.value,
    ):
        lane = _dict(outputs.get(key))
        machine = _dict(lane.get("machine_payload"))
        runtime = _dict(machine.get("model_runtime"))
        if runtime:
            return runtime
    return _dict(outputs.get("model_runtime"))


def _retrieval_status(outputs: dict[str, Any]) -> ContextStatus:
    payload = _dict(outputs.get(AdaptiveNode.EXPERT_WIKI.value))
    status = str(payload.get("status") or "").lower()
    if status == "ready":
        return ContextStatus.READY
    if status in {"no_matches", "skipped"}:
        return ContextStatus.NO_MATCH
    if status in {"retrieval_unavailable", "database_missing"}:
        return ContextStatus.UNAVAILABLE
    return ContextStatus.PARTIAL if payload else ContextStatus.NOT_REQUESTED


def _simple_context_status(
    *,
    requested: bool,
    payload: Any,
    stale_markers: tuple[str, ...] = ("stale",),
) -> ContextStatus:
    if not requested:
        return ContextStatus.NOT_REQUESTED
    if not payload:
        return ContextStatus.UNAVAILABLE
    status = str(_dict(payload).get("status") or "").lower()
    if any(marker in status for marker in stale_markers):
        return ContextStatus.STALE
    if status in {"unavailable", "error", "fallback-unavailable"}:
        return ContextStatus.UNAVAILABLE
    if status in {"partial", "fallback-cache", "empty"}:
        return ContextStatus.PARTIAL
    return ContextStatus.READY


def _capability(
    plan: AdaptiveGraphPlan,
    context: ContextQuality,
    model_applicability: float,
    constraint_status: ConstraintStatus,
) -> AnswerCapability:
    nodes = set(plan.nodes)
    if (
        plan.intent.value == "OPTIMIZE"
        and AdaptiveNode.BOUNDED_SCENARIO in nodes
        and AdaptiveNode.OPERATIONS_CALENDAR in nodes
        and AdaptiveNode.MARKET_OUTLOOK in nodes
        and context.operations in {ContextStatus.READY, ContextStatus.PARTIAL}
        and context.market in {ContextStatus.READY, ContextStatus.PARTIAL}
        and model_applicability >= 0.5
        and constraint_status is not ConstraintStatus.FAIL
    ):
        return AnswerCapability.CONSTRAINED_OPTIMIZATION
    if (
        AdaptiveNode.OPERATIONS_CALENDAR in nodes
        and AdaptiveNode.BOUNDED_SCENARIO in nodes
        and model_applicability >= 0.4
    ):
        return AnswerCapability.OPERATIONAL_PLAN
    if AdaptiveNode.BOUNDED_SCENARIO in nodes and model_applicability >= 0.4:
        return AnswerCapability.MODEL_WHAT_IF
    if (
        AdaptiveNode.PHYSIOLOGY_DIAGNOSIS in nodes
        or AdaptiveNode.HISTORY_COMPARE in nodes
    ):
        return AnswerCapability.DIAGNOSTIC
    return AnswerCapability.LIVE_STATUS


def build_quality_profile(
    *,
    plan: AdaptiveGraphPlan,
    dashboard: dict[str, Any],
    outputs: dict[str, Any],
    constraint_gate: ConstraintGateResult,
    admission: AdmissionResult,
    now: datetime | None = None,
) -> AdvisorQualityProfile:
    now = (now or datetime.now(UTC)).astimezone(UTC)
    latest = _latest_observation(dashboard)
    freshness = _freshness(latest, now)
    current_coverage, history_coverage, missing_fields = _coverage(dashboard)

    runtime = _model_runtime(outputs)
    runtime_status = str(runtime.get("status") or "").lower()
    sensitivity = _dict(runtime.get("sensitivity"))
    scenario = _dict(runtime.get("scenario"))
    scenario_confidence = (
        _float(scenario.get("confidence"))
        or _float(sensitivity.get("confidence"))
        or _float(runtime.get("confidence"))
    )
    if runtime_status in {"ready", "success", "actionable"}:
        model_applicability = 0.8
    elif runtime_status in {"monitoring-first", "provisional", "partial"}:
        model_applicability = 0.45
    elif runtime:
        model_applicability = 0.3
    else:
        model_applicability = 0.0
    if scenario_confidence is not None:
        model_applicability = min(
            1.0, max(model_applicability, scenario_confidence)
        )
    if constraint_gate.status is ConstraintStatus.FAIL:
        model_applicability = min(model_applicability, 0.2)

    requested = set(plan.nodes)
    context = ContextQuality(
        expert_knowledge=_retrieval_status(outputs),
        weather=_simple_context_status(
            requested=AdaptiveNode.WEATHER_OUTLOOK in requested,
            payload=outputs.get(AdaptiveNode.WEATHER_OUTLOOK.value),
        ),
        operations=_simple_context_status(
            requested=AdaptiveNode.OPERATIONS_CALENDAR in requested,
            payload=outputs.get(AdaptiveNode.OPERATIONS_CALENDAR.value),
        ),
        market=_simple_context_status(
            requested=AdaptiveNode.MARKET_OUTLOOK in requested,
            payload=outputs.get(AdaptiveNode.MARKET_OUTLOOK.value),
        ),
    )

    capability = _capability(
        plan,
        context,
        model_applicability,
        constraint_gate.status,
    )

    unavailable_required_context = any(
        status is ContextStatus.UNAVAILABLE
        for status in (
            context.weather,
            context.operations,
            context.market,
        )
        if status is not ContextStatus.NOT_REQUESTED
    )
    if constraint_gate.status is ConstraintStatus.FAIL:
        answer_status = AnswerStatus.REFUSED
    elif current_coverage < 0.4:
        answer_status = AnswerStatus.NEEDS_DATA
    elif runtime_status in {"monitoring-first", "unavailable"}:
        answer_status = AnswerStatus.MONITORING_FIRST
    elif unavailable_required_context or not admission.admitted:
        answer_status = AnswerStatus.CONDITIONAL
    else:
        answer_status = AnswerStatus.OPERATIONAL

    context_scores = {
        ContextStatus.READY: 1.0,
        ContextStatus.PARTIAL: 0.6,
        ContextStatus.NO_MATCH: 0.35,
        ContextStatus.STALE: 0.3,
        ContextStatus.UNAVAILABLE: 0.0,
        ContextStatus.NOT_REQUESTED: 1.0,
    }
    context_score = sum(
        context_scores[value]
        for value in (
            context.expert_knowledge,
            context.weather,
            context.operations,
            context.market,
        )
    ) / 4
    constraint_score = {
        ConstraintStatus.PASS: 1.0,
        ConstraintStatus.WARNING: 0.65,
        ConstraintStatus.FAIL: 0.0,
    }[constraint_gate.status]
    score = (
        0.22 * freshness
        + 0.18 * current_coverage
        + 0.10 * history_coverage
        + 0.25 * model_applicability
        + 0.15 * context_score
        + 0.10 * constraint_score
    )
    if answer_status is AnswerStatus.REFUSED:
        score = min(score, 0.25)
    score = round(max(0.0, min(1.0, score)), 4)

    forecast_hours = max(plan.horizons_hours, default=0)
    validity_minutes = {
        AnswerCapability.LIVE_STATUS: 5,
        AnswerCapability.DIAGNOSTIC: 10,
        AnswerCapability.MODEL_WHAT_IF: 15,
        AnswerCapability.OPERATIONAL_PLAN: 30,
        AnswerCapability.CONSTRAINED_OPTIMIZATION: 30,
    }[capability]

    triggers: list[str] = []
    if freshness < 0.8:
        triggers.append("new_telemetry")
    if context.weather is not ContextStatus.NOT_REQUESTED:
        triggers.append("weather_refresh")
    if context.market is not ContextStatus.NOT_REQUESTED:
        triggers.append("market_refresh")
    if context.operations is not ContextStatus.NOT_REQUESTED:
        triggers.append("operations_calendar_change")
    if forecast_hours:
        triggers.append("forecast_signature_change")
    if missing_fields:
        triggers.append("missing_data_recovered")

    inferred = []
    state_snapshot = _dict(runtime.get("state_snapshot"))
    inferred.extend(str(item) for item in _list(state_snapshot.get("inferred_fields")))

    return AdvisorQualityProfile(
        capability=capability,
        answer_status=answer_status,
        score=score,
        data=DataQuality(
            freshness=round(freshness, 4),
            current_state_coverage=current_coverage,
            history_coverage=history_coverage,
            missing_fields=missing_fields,
            inferred_fields=sorted(set(inferred)),
            latest_observation_at=latest,
        ),
        model=ModelQuality(
            applicability=round(model_applicability, 4),
            exact_request_match=admission.exact_request_match,
            within_supported_range=admission.within_supported_range,
            scenario_confidence=scenario_confidence,
            constraint_status=constraint_gate.status,
            violated_constraints=constraint_gate.violations,
        ),
        context=context,
        horizon=HorizonQuality(
            valid_from=now,
            valid_until=now + timedelta(minutes=validity_minutes),
            forecast_hours=forecast_hours,
            invalidation_events=triggers,
        ),
        adaptive_triggers=triggers,
        executed_nodes=plan.nodes,
    )
