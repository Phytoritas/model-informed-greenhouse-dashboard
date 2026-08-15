"""Deterministic planner for the bounded adaptive advisor graph."""

from __future__ import annotations

from .contracts import (
    AdaptiveAdvisorRequest,
    AdaptiveGraphPlan,
    AdaptiveNode,
    AdvisorIntent,
)
from .question_analysis import analyze_question


def classify_intent(question: str) -> AdvisorIntent:
    facets = analyze_question(question, crop="tomato", language="ko")
    return AdvisorIntent(str(facets["intent"]))


def select_controls(question: str) -> list[str]:
    facets = analyze_question(question, crop="tomato", language="ko")
    return [str(item) for item in facets.get("control_candidates", []) if str(item)]


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
    facets = analyze_question(
        request.question,
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

    if intent is AdvisorIntent.STATUS:
        if facets.get("market_relevant"):
            _append_unique(nodes, AdaptiveNode.MARKET_OUTLOOK)
        if "weather" in request.question.lower() or "날씨" in request.question:
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
        reasons.append("optimization joins crop, operations, weather, arrival volume, and market")

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
        include_narrative=request.include_narrative,
        reasons=reasons,
    )
