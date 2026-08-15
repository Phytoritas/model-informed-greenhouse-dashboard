"""Deterministic quality profile for the answer actually delivered."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from typing import Any

from .answer_packet import select_primary_runtime
from .contracts import (
    AdaptiveAnswerPacket,
    AdaptiveGraphPlan,
    AdaptiveNode,
    AdmissionResult,
    AdvisorQualityProfile,
    AnswerCapability,
    AnswerContentQuality,
    AnswerStatus,
    ConstraintGateResult,
    ConstraintStatus,
    ContextQuality,
    ContextStatus,
    DataQuality,
    HorizonQuality,
    ModelQuality,
    ResponseQuality,
    ResponseReview,
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
    return None if number != number else number


def _parse_datetime(value: Any) -> datetime | None:
    if isinstance(value, datetime):
        return value if value.tzinfo else value.replace(tzinfo=UTC)
    if isinstance(value, (int, float)):
        number = float(value)
        if number > 1e12:
            number /= 1000
        try:
            return datetime.fromtimestamp(number, tz=UTC)
        except (OSError, OverflowError, ValueError):
            return None
    if not isinstance(value, str) or not value.strip():
        return None
    try:
        parsed = datetime.fromisoformat(value.strip().replace("Z", "+00:00"))
    except ValueError:
        return None
    return parsed if parsed.tzinfo else parsed.replace(tzinfo=UTC)


def _latest_observation(dashboard: dict[str, Any], outputs: dict[str, Any]) -> datetime | None:
    current = _dict(dashboard.get("currentData") or dashboard.get("data"))
    live = _dict(outputs.get(AdaptiveNode.LIVE_SNAPSHOT.value))
    candidates = [
        current.get("datetime"),
        current.get("timestamp"),
        current.get("t"),
        live.get("latest_observation_at"),
        dashboard.get("telemetryReceivedAt"),
        dashboard.get("updated_at"),
    ]
    parsed = [item for value in candidates if (item := _parse_datetime(value))]
    return max(parsed) if parsed else None


def _freshness(latest: datetime | None, now: datetime) -> float:
    if latest is None:
        return 0.1
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


def _coverage(
    dashboard: dict[str, Any],
    outputs: dict[str, Any],
) -> tuple[float, float, list[str]]:
    current = _dict(dashboard.get("currentData") or dashboard.get("data"))
    required = ("temperature", "humidity", "co2", "light", "vpd")
    present = sum(current.get(key) is not None for key in required)
    current_coverage = present / len(required)
    if dashboard.get("metrics"):
        current_coverage = min(1.0, current_coverage + 0.1)
    history = _dict(outputs.get(AdaptiveNode.HISTORY_COMPARE.value))
    if history.get("status") == "ready":
        point_count = int(history.get("server_point_count") or 0)
        history_coverage = min(1.0, 0.65 + min(point_count / 120.0, 0.35))
    elif history.get("status") == "baseline_unavailable":
        history_coverage = 0.35
    elif dashboard.get("recentSummary"):
        history_coverage = 0.25
    else:
        history_coverage = 0.0
    missing = [f"currentData.{key}" for key in required if current.get(key) is None]
    if not dashboard.get("metrics"):
        missing.append("metrics")
    if history_coverage < 0.5:
        missing.append("server_same_time_history")
    return round(current_coverage, 4), round(history_coverage, 4), missing


def _context_status(requested: bool, payload: Any) -> ContextStatus:
    if not requested:
        return ContextStatus.NOT_REQUESTED
    if not payload:
        return ContextStatus.UNAVAILABLE
    status = str(_dict(payload).get("status") or "ready").lower()
    if "stale" in status:
        return ContextStatus.STALE
    if status in {"unavailable", "error", "history_unavailable", "database_missing"}:
        return ContextStatus.UNAVAILABLE
    if status in {"partial", "empty", "baseline_unavailable"}:
        return ContextStatus.PARTIAL
    if status in {"no_matches", "no_match"}:
        return ContextStatus.NO_MATCH
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
        and model_applicability >= 0.45
        and constraint_status is not ConstraintStatus.FAIL
    ):
        return AnswerCapability.CONSTRAINED_OPTIMIZATION
    if (
        AdaptiveNode.OPERATIONS_CALENDAR in nodes
        and AdaptiveNode.BOUNDED_SCENARIO in nodes
        and model_applicability >= 0.35
    ):
        return AnswerCapability.OPERATIONAL_PLAN
    if AdaptiveNode.BOUNDED_SCENARIO in nodes and model_applicability >= 0.35:
        return AnswerCapability.MODEL_WHAT_IF
    if AdaptiveNode.HISTORY_COMPARE in nodes or AdaptiveNode.PHYSIOLOGY_DIAGNOSIS in nodes:
        return AnswerCapability.DIAGNOSTIC
    return AnswerCapability.LIVE_STATUS


def build_quality_profile(
    *,
    plan: AdaptiveGraphPlan,
    dashboard: dict[str, Any],
    outputs: dict[str, Any],
    constraint_gate: ConstraintGateResult,
    admission: AdmissionResult,
    answer_packet: AdaptiveAnswerPacket,
    response_review: ResponseReview,
    now: datetime | None = None,
) -> AdvisorQualityProfile:
    now = (now or datetime.now(UTC)).astimezone(UTC)
    latest = _latest_observation(dashboard, outputs)
    freshness = _freshness(latest, now)
    current_coverage, history_coverage, missing_fields = _coverage(dashboard, outputs)

    runtime = select_primary_runtime(outputs, plan=plan)
    runtime_status = str(runtime.get("status") or "").lower()
    scenario = _dict(runtime.get("scenario"))
    sensitivity = _dict(runtime.get("sensitivity"))
    scenario_confidence = (
        _float(scenario.get("confidence"))
        or _float(sensitivity.get("confidence"))
        or _float(runtime.get("confidence"))
    )
    state_snapshot = _dict(runtime.get("state_snapshot"))
    inferred_fields = [str(item) for item in _list(state_snapshot.get("inferred_fields"))]
    provenance = _dict(runtime.get("provenance"))
    inferred_fields.extend(str(item) for item in _list(provenance.get("inferred_fields")))
    observed_signal_score = _float(provenance.get("observed_signal_score"))
    if observed_signal_score is None:
        observed_signal_score = current_coverage
    inferred_fields = sorted(set(inferred_fields))
    observed_input_fraction = max(
        0.0,
        min(1.0, float(observed_signal_score) - 0.04 * len(inferred_fields)),
    )

    if runtime_status in {"ready", "success", "actionable"}:
        model_applicability = 0.75
    elif runtime_status in {"monitoring-first", "provisional", "partial"}:
        model_applicability = 0.42
    elif runtime:
        model_applicability = 0.28
    else:
        model_applicability = 0.0
    if scenario_confidence is not None:
        model_applicability = min(
            1.0,
            0.55 * model_applicability + 0.45 * scenario_confidence,
        )
    model_applicability *= 0.65 + 0.35 * observed_input_fraction
    if constraint_gate.status is ConstraintStatus.FAIL:
        model_applicability = min(model_applicability, 0.2)

    requested = set(plan.nodes)
    context = ContextQuality(
        expert_knowledge=_context_status(
            AdaptiveNode.EXPERT_WIKI in requested,
            outputs.get(AdaptiveNode.EXPERT_WIKI.value),
        ),
        weather=_context_status(
            AdaptiveNode.WEATHER_OUTLOOK in requested,
            outputs.get(AdaptiveNode.WEATHER_OUTLOOK.value),
        ),
        operations=_context_status(
            AdaptiveNode.OPERATIONS_CALENDAR in requested,
            outputs.get(AdaptiveNode.OPERATIONS_CALENDAR.value),
        ),
        market=_context_status(
            AdaptiveNode.MARKET_OUTLOOK in requested,
            outputs.get(AdaptiveNode.MARKET_OUTLOOK.value),
        ),
    )
    capability = _capability(plan, context, model_applicability, constraint_gate.status)

    unavailable_required = any(
        status is ContextStatus.UNAVAILABLE
        for status in (context.weather, context.operations, context.market)
        if status is not ContextStatus.NOT_REQUESTED
    )
    if constraint_gate.status is ConstraintStatus.FAIL:
        answer_status = AnswerStatus.REFUSED
    elif current_coverage < 0.4:
        answer_status = AnswerStatus.NEEDS_DATA
    elif runtime_status in {"monitoring-first", "unavailable"}:
        answer_status = AnswerStatus.MONITORING_FIRST
    elif unavailable_required or not admission.admitted or response_review.coverage < 0.8:
        answer_status = AnswerStatus.CONDITIONAL
    else:
        answer_status = answer_packet.answer_status

    context_score_map = {
        ContextStatus.READY: 1.0,
        ContextStatus.PARTIAL: 0.6,
        ContextStatus.NO_MATCH: 0.45,
        ContextStatus.STALE: 0.3,
        ContextStatus.UNAVAILABLE: 0.0,
        ContextStatus.NOT_REQUESTED: 1.0,
    }
    context_score = sum(
        context_score_map[value]
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
    readiness = (
        0.20 * freshness
        + 0.19 * current_coverage
        + 0.12 * history_coverage
        + 0.25 * model_applicability
        + 0.14 * context_score
        + 0.10 * constraint_score
    )
    readiness = round(max(0.0, min(1.0, readiness)), 4)

    scores = response_review.content_scores
    content = AnswerContentQuality(
        diagnostic_depth=float(scores.get("diagnostic_depth", 0.0)),
        actionability=float(scores.get("actionability", 0.0)),
        temporal_alignment=float(scores.get("temporal_alignment", 0.0)),
        cross_domain_synthesis=float(scores.get("cross_domain_synthesis", 0.0)),
        numerical_integrity=float(scores.get("numerical_integrity", 0.0)),
        uncertainty_honesty=float(scores.get("uncertainty_honesty", 0.0)),
        gaps=response_review.quality_gaps,
    )
    content_mean = (
        content.diagnostic_depth
        + content.actionability
        + content.temporal_alignment
        + content.cross_domain_synthesis
        + content.numerical_integrity
        + content.uncertainty_honesty
    ) / 6
    delivered_score = (
        0.45 * readiness
        + 0.35 * content_mean
        + 0.20 * response_review.coverage
    )
    if response_review.unsupported_numeric_claims:
        delivered_score = min(delivered_score, 0.35)
    if answer_status is AnswerStatus.REFUSED:
        delivered_score = min(delivered_score, 0.30)
    delivered_score = round(max(0.0, min(1.0, delivered_score)), 4)

    forecast_hours = max(plan.horizons_hours, default=0)
    validity_minutes = {
        AnswerCapability.LIVE_STATUS: 5,
        AnswerCapability.DIAGNOSTIC: 10,
        AnswerCapability.MODEL_WHAT_IF: 15,
        AnswerCapability.OPERATIONAL_PLAN: 30,
        AnswerCapability.CONSTRAINED_OPTIMIZATION: 30,
    }[capability]
    triggers: list[str] = ["new_telemetry"]
    if context.weather is not ContextStatus.NOT_REQUESTED:
        triggers.append("weather_refresh")
    if context.market is not ContextStatus.NOT_REQUESTED:
        triggers.extend(["market_refresh", "arrival_volume_update"])
    if context.operations is not ContextStatus.NOT_REQUESTED:
        triggers.append("operations_calendar_change")
    if forecast_hours:
        triggers.append("forecast_signature_change")
    if missing_fields:
        triggers.append("missing_data_recovered")

    return AdvisorQualityProfile(
        capability=capability,
        answer_status=answer_status,
        score=delivered_score,
        readiness_score=readiness,
        data=DataQuality(
            freshness=round(freshness, 4),
            current_state_coverage=current_coverage,
            history_coverage=history_coverage,
            missing_fields=sorted(set(missing_fields)),
            inferred_fields=inferred_fields,
            observed_signal_score=round(observed_signal_score, 4),
            latest_observation_at=latest,
        ),
        model=ModelQuality(
            applicability=round(model_applicability, 4),
            exact_request_match=admission.exact_request_match,
            within_supported_range=admission.within_supported_range,
            scenario_confidence=scenario_confidence,
            observed_input_fraction=round(observed_input_fraction, 4),
            inferred_input_count=len(inferred_fields),
            constraint_status=constraint_gate.status,
            violated_constraints=constraint_gate.violations,
        ),
        context=context,
        content=content,
        response=ResponseQuality(
            coverage=response_review.coverage,
            required_elements=response_review.required_elements,
            present_elements=response_review.present_elements,
            unsupported_numeric_claims=response_review.unsupported_numeric_claims,
            fallback_used=response_review.fallback_used,
            source=response_review.source,
            reasons=response_review.reasons,
        ),
        horizon=HorizonQuality(
            valid_from=now,
            valid_until=now + timedelta(minutes=validity_minutes),
            forecast_hours=forecast_hours,
            invalidation_events=list(dict.fromkeys(triggers)),
        ),
        adaptive_triggers=list(dict.fromkeys(triggers)),
        executed_nodes=plan.nodes,
    )
