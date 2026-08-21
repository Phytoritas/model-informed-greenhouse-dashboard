"""Deterministic planner for the bounded adaptive advisor graph."""

from __future__ import annotations

import re

from .contracts import (
    AdaptiveAdvisorRequest,
    AdaptiveGraphPlan,
    AdaptiveNode,
    AdvisorIntent,
)
from .question_analysis import analyze_question


_FOLLOW_UP_MARKERS = (
    "그럼",
    "그러면",
    "그건",
    "그 조치",
    "그대로",
    "아까",
    "방금",
    "이 경우",
    "그 경우",
    "then",
    "what about",
    "in that case",
    "same action",
)
_DOMAIN_TERMS = (
    "온도",
    "co2",
    "습도",
    "vpd",
    "스크린",
    "광합성",
    "증산",
    "기공",
    "수확",
    "출하",
    "가격",
    "temperature",
    "humidity",
    "photosynthesis",
    "harvest",
    "shipment",
    "price",
)


def classify_intent(question: str) -> AdvisorIntent:
    facets = analyze_question(question, crop="tomato", language="ko")
    return AdvisorIntent(str(facets["intent"]))


def select_controls(question: str) -> list[str]:
    facets = analyze_question(question, crop="tomato", language="ko")
    return [str(item) for item in facets.get("control_candidates", []) if str(item)]


def _is_contextual_follow_up(question: str) -> bool:
    normalized = question.strip().lower()
    if not normalized:
        return False
    if any(marker in normalized for marker in _FOLLOW_UP_MARKERS):
        return True
    has_number = bool(re.search(r"[-+]?\d+(?:\.\d+)?", normalized))
    has_domain_term = any(term in normalized for term in _DOMAIN_TERMS)
    return len(normalized) <= 48 and has_number and not has_domain_term


def analysis_text_for_request(request: AdaptiveAdvisorRequest) -> str:
    """Resolve bounded anaphoric follow-ups without making all history authoritative."""

    if not request.messages or not _is_contextual_follow_up(request.question):
        return request.question
    prior: list[str] = []
    for message in reversed(request.messages):
        role = str(message.get("role") or "user")
        content = str(message.get("content") or "").strip()
        if role not in {"user", "assistant"} or not content:
            continue
        prior.append(f"{role}: {content}")
        if len(prior) >= 2:
            break
    if not prior:
        return request.question
    prior.reverse()
    return "\n".join([*prior, f"user follow-up: {request.question}"])


def _append_unique(nodes: list[AdaptiveNode], *items: AdaptiveNode) -> None:
    for item in items:
        if item not in nodes:
            nodes.append(item)


def _managed_tail(include_narrative: bool) -> list[AdaptiveNode]:
    result = [
        AdaptiveNode.CONSTRAINT_GATE,
        AdaptiveNode.ANSWER_ADMISSION,
        AdaptiveNode.ANSWER_PACKET,
    ]
    if include_narrative:
        result.append(AdaptiveNode.NARRATE)
    result.extend([AdaptiveNode.RESPONSE_REVIEW, AdaptiveNode.QUALITY_GATE])
    return result


def _normalize_requested_plan(
    request: AdaptiveAdvisorRequest,
    intent: AdvisorIntent,
) -> AdaptiveGraphPlan | None:
    requested = request.requested_plan
    if requested is None:
        return None
    managed = set(_managed_tail(True))
    optional = [node for node in requested.nodes if node not in managed]
    if not optional or optional[0] is not AdaptiveNode.FREEZE_SNAPSHOT:
        optional.insert(0, AdaptiveNode.FREEZE_SNAPSHOT)
    return AdaptiveGraphPlan(
        intent=intent,
        nodes=[*optional, *_managed_tail(request.include_narrative)],
        controls=requested.controls,
        horizons_hours=requested.horizons_hours,
        max_parallel_nodes=min(requested.max_parallel_nodes, 5),
        max_model_evaluations=min(requested.max_model_evaluations, 12),
        node_timeout_seconds=min(requested.node_timeout_seconds, 30.0),
        narration_timeout_seconds=min(requested.narration_timeout_seconds, 45.0),
        include_narrative=request.include_narrative,
        reasons=[
            *requested.reasons,
            "client plan admitted through the fixed safety and response-review tail",
        ],
    )


def _default_controls(intent: AdvisorIntent, facets: dict) -> list[str]:
    explicit = [str(item) for item in facets.get("control_candidates", []) if str(item)]
    if explicit:
        return list(dict.fromkeys(explicit))
    targets = set(str(item) for item in facets.get("target_signals", []))
    objectives = set(str(item) for item in facets.get("objectives", []))
    if intent in {AdvisorIntent.PLAN, AdvisorIntent.OPTIMIZE}:
        controls = ["temperature_day", "temperature_night", "rh_target"]
        if "energy" in targets or "energy_cost" in objectives:
            controls.append("screen_close")
        if "photosynthesis" in targets or "yield" in targets:
            controls.append("co2_setpoint_day")
        return controls
    return []


def build_adaptive_plan(request: AdaptiveAdvisorRequest) -> AdaptiveGraphPlan:
    analysis_text = analysis_text_for_request(request)
    facets = analyze_question(
        analysis_text,
        crop=request.crop,
        language=request.language,
    )
    intent = AdvisorIntent(str(facets["intent"]))
    admitted_requested = _normalize_requested_plan(request, intent)
    if admitted_requested is not None:
        return admitted_requested

    controls = _default_controls(intent, facets)
    nodes: list[AdaptiveNode] = [
        AdaptiveNode.FREEZE_SNAPSHOT,
        AdaptiveNode.LIVE_SNAPSHOT,
    ]
    reasons = [
        f"intent classified as {intent.value}",
        f"targets={','.join(facets.get('target_signals', [])) or 'unspecified'}",
        f"comparison={facets.get('comparison_mode')}",
    ]
    if analysis_text != request.question:
        reasons.append("bounded server conversation context resolved an anaphoric follow-up")

    if intent is AdvisorIntent.STATUS:
        if facets.get("market_relevant"):
            _append_unique(nodes, AdaptiveNode.MARKET_OUTLOOK)
        if "weather" in analysis_text.lower() or "날씨" in analysis_text:
            _append_unique(nodes, AdaptiveNode.WEATHER_OUTLOOK)
    elif intent is AdvisorIntent.DIAGNOSE:
        _append_unique(
            nodes,
            AdaptiveNode.HISTORY_COMPARE,
            AdaptiveNode.PHYSIOLOGY_DIAGNOSIS,
            AdaptiveNode.EXPERT_WIKI,
        )
        reasons.append("diagnosis requires a server-side temporal baseline")
    elif intent is AdvisorIntent.WHAT_IF:
        _append_unique(
            nodes,
            AdaptiveNode.HISTORY_COMPARE,
            AdaptiveNode.PHYSIOLOGY_DIAGNOSIS,
            AdaptiveNode.BOUNDED_SCENARIO,
            AdaptiveNode.SENSITIVITY,
            AdaptiveNode.EXPERT_WIKI,
        )
        reasons.append("counterfactual requires exact bounded model output")
    elif intent is AdvisorIntent.PLAN:
        _append_unique(
            nodes,
            AdaptiveNode.ENVIRONMENT_ANALYSIS,
            AdaptiveNode.WORK_PLANNING,
            AdaptiveNode.WEATHER_OUTLOOK,
            AdaptiveNode.OPERATIONS_CALENDAR,
            AdaptiveNode.BOUNDED_SCENARIO,
            AdaptiveNode.EXPERT_WIKI,
        )
        reasons.append("plan joins operations, weather, work, and model context")
    else:
        _append_unique(
            nodes,
            AdaptiveNode.HISTORY_COMPARE,
            AdaptiveNode.ENVIRONMENT_ANALYSIS,
            AdaptiveNode.PHYSIOLOGY_DIAGNOSIS,
            AdaptiveNode.WORK_PLANNING,
            AdaptiveNode.HARVEST_MARKET_ANALYSIS,
            AdaptiveNode.BOUNDED_SCENARIO,
            AdaptiveNode.SENSITIVITY,
            AdaptiveNode.EXPERT_WIKI,
            AdaptiveNode.WEATHER_OUTLOOK,
            AdaptiveNode.MARKET_OUTLOOK,
            AdaptiveNode.OPERATIONS_CALENDAR,
        )
        reasons.append(
            "optimization joins crop, operations, weather, arrival volume, and market"
        )

    if facets.get("market_relevant"):
        _append_unique(
            nodes,
            AdaptiveNode.MARKET_OUTLOOK,
            AdaptiveNode.HARVEST_MARKET_ANALYSIS,
        )
    if facets.get("operations_relevant"):
        _append_unique(
            nodes,
            AdaptiveNode.OPERATIONS_CALENDAR,
            AdaptiveNode.WORK_PLANNING,
        )
    if facets.get("requires_temporal_pair"):
        _append_unique(nodes, AdaptiveNode.HISTORY_COMPARE)

    horizons: list[int] = []
    if AdaptiveNode.BOUNDED_SCENARIO in nodes or AdaptiveNode.SENSITIVITY in nodes:
        horizons = [24, 72, 168, 336]

    return AdaptiveGraphPlan(
        intent=intent,
        nodes=[*nodes, *_managed_tail(request.include_narrative)],
        controls=controls,
        horizons_hours=horizons,
        max_parallel_nodes=5,
        max_model_evaluations=12 if intent is AdvisorIntent.OPTIMIZE else 8,
        node_timeout_seconds=12.0,
        narration_timeout_seconds=20.0,
        include_narrative=request.include_narrative,
        reasons=reasons,
    )
