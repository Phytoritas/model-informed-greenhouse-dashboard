"""Deterministic planner for the bounded adaptive advisor graph."""

from __future__ import annotations

import re
from collections.abc import Iterable

from .contracts import (
    AdaptiveAdvisorRequest,
    AdaptiveGraphPlan,
    AdaptiveNode,
    AdvisorIntent,
)


_STATUS_TERMS = (
    "현재", "지금", "상태", "몇 도", "얼마", "current", "status", "now",
)
_DIAGNOSE_TERMS = (
    "왜", "원인", "다른", "차이", "저하", "감소", "이상", "diagnos", "why",
    "photosynthesis", "광합성", "기공", "stomata", "vpd",
)
_WHAT_IF_TERMS = (
    "올리", "내리", "낮추", "높이", "바꾸", "조정", "하면", "what if",
    "scenario", "시나리오", "℃", "ppm", "%", "setpoint", "설정",
)
_PLAN_TERMS = (
    "다음 주", "이번 주", "내일", "휴가", "휴일", "출하", "작업", "계획",
    "next week", "tomorrow", "holiday", "shipment", "schedule", "plan",
)
_OPTIMIZE_TERMS = (
    "최적", "최대한", "손실", "수익", "가격", "에너지", "비용", "tradeoff",
    "optimiz", "price", "revenue", "yield loss",
)
_MARKET_TERMS = (
    "가격", "시장", "도매", "소매", "kamis", "시세", "price", "market",
)
_OPERATIONS_TERMS = (
    "휴가", "휴일", "휴장", "출하", "작업자", "포장", "저장", "shipment",
    "holiday", "labor", "packing", "storage",
)
_WEATHER_TERMS = (
    "날씨", "외기", "강수", "흐림", "일사", "예보", "weather", "forecast",
)
_PHYSIOLOGY_TERMS = (
    "광합성", "기공", "증산", "vpd", "동화", "호흡", "source", "sink",
    "생리", "photosynthesis", "stomatal", "transpiration",
)
_CONTROL_TERMS = {
    "co2_setpoint_day": ("co2", "이산화탄소", "ppm"),
    "temperature_day": ("주간 온도", "낮 온도", "day temperature", "temperature_day"),
    "temperature_night": ("야간", "밤 온도", "night temperature", "temperature_night"),
    "rh_target": ("습도", "rh", "vpd", "가습", "제습"),
    "screen_close": ("스크린", "차광", "커튼", "screen"),
}


def _contains_any(text: str, terms: Iterable[str]) -> bool:
    return any(term in text for term in terms)


def classify_intent(question: str) -> AdvisorIntent:
    text = " ".join((question or "").lower().split())
    scores = {
        AdvisorIntent.STATUS: sum(term in text for term in _STATUS_TERMS),
        AdvisorIntent.DIAGNOSE: sum(term in text for term in _DIAGNOSE_TERMS),
        AdvisorIntent.WHAT_IF: sum(term in text for term in _WHAT_IF_TERMS),
        AdvisorIntent.PLAN: sum(term in text for term in _PLAN_TERMS),
        AdvisorIntent.OPTIMIZE: sum(term in text for term in _OPTIMIZE_TERMS),
    }

    # Cross-domain questions involving future operations and economics are plans or
    # optimizations even when they also contain a temperature what-if.
    if _contains_any(text, _OPERATIONS_TERMS) and _contains_any(text, _MARKET_TERMS):
        scores[AdvisorIntent.OPTIMIZE] += 4
    elif _contains_any(text, _OPERATIONS_TERMS):
        scores[AdvisorIntent.PLAN] += 3

    if re.search(r"[+-]?\d+(?:\.\d+)?\s*(?:℃|°c|도|ppm|%)", text):
        scores[AdvisorIntent.WHAT_IF] += 3

    # Stable, explicit tie order: optimize > plan > what-if > diagnose > status.
    tie_order = {
        AdvisorIntent.OPTIMIZE: 5,
        AdvisorIntent.PLAN: 4,
        AdvisorIntent.WHAT_IF: 3,
        AdvisorIntent.DIAGNOSE: 2,
        AdvisorIntent.STATUS: 1,
    }
    best = max(scores, key=lambda item: (scores[item], tie_order[item]))
    if scores[best] == 0:
        return AdvisorIntent.DIAGNOSE
    return best


def select_controls(question: str) -> list[str]:
    text = " ".join((question or "").lower().split())
    controls = [
        control
        for control, terms in _CONTROL_TERMS.items()
        if _contains_any(text, terms)
    ]
    if not controls and _contains_any(text, _WHAT_IF_TERMS):
        controls = ["temperature_day", "temperature_night", "rh_target"]
    return controls


def _append_unique(nodes: list[AdaptiveNode], *items: AdaptiveNode) -> None:
    for item in items:
        if item not in nodes:
            nodes.append(item)


def _normalize_requested_plan(
    request: AdaptiveAdvisorRequest,
    intent: AdvisorIntent,
) -> AdaptiveGraphPlan | None:
    requested = request.requested_plan
    if requested is None:
        return None

    # A client may narrow optional work, but never alter the fixed safety spine,
    # narrative policy, crop-control repertoire, or execution budgets.
    nodes = [node for node in requested.nodes if node is not AdaptiveNode.NARRATE]
    if not nodes or nodes[0] is not AdaptiveNode.FREEZE_SNAPSHOT:
        nodes.insert(0, AdaptiveNode.FREEZE_SNAPSHOT)
    for mandatory in (
        AdaptiveNode.CONSTRAINT_GATE,
        AdaptiveNode.ANSWER_ADMISSION,
        AdaptiveNode.QUALITY_GATE,
    ):
        if mandatory not in nodes:
            nodes.append(mandatory)
    # Rebuild safety ordering in case a proposed plan placed them earlier.
    optional = [
        node
        for node in nodes
        if node
        not in {
            AdaptiveNode.CONSTRAINT_GATE,
            AdaptiveNode.ANSWER_ADMISSION,
            AdaptiveNode.QUALITY_GATE,
        }
    ]
    nodes = [
        *optional,
        AdaptiveNode.CONSTRAINT_GATE,
        AdaptiveNode.ANSWER_ADMISSION,
        AdaptiveNode.QUALITY_GATE,
    ]
    if request.include_narrative:
        nodes.append(AdaptiveNode.NARRATE)

    return AdaptiveGraphPlan(
        intent=intent,
        nodes=nodes,
        controls=requested.controls,
        horizons_hours=requested.horizons_hours,
        max_parallel_nodes=min(requested.max_parallel_nodes, 5),
        max_model_evaluations=min(requested.max_model_evaluations, 12),
        include_narrative=request.include_narrative,
        reasons=[
            *requested.reasons,
            "client plan admitted through the fixed safety spine",
        ],
    )


def build_adaptive_plan(request: AdaptiveAdvisorRequest) -> AdaptiveGraphPlan:
    intent = classify_intent(request.question)
    admitted_requested = _normalize_requested_plan(request, intent)
    if admitted_requested is not None:
        return admitted_requested

    text = " ".join(request.question.lower().split())
    controls = select_controls(text)
    nodes: list[AdaptiveNode] = [
        AdaptiveNode.FREEZE_SNAPSHOT,
        AdaptiveNode.LIVE_SNAPSHOT,
    ]
    reasons = [f"intent classified as {intent.value}"]

    if intent is AdvisorIntent.STATUS:
        if _contains_any(text, _WEATHER_TERMS):
            _append_unique(nodes, AdaptiveNode.WEATHER_OUTLOOK)
            reasons.append("weather context requested")
    elif intent is AdvisorIntent.DIAGNOSE:
        _append_unique(
            nodes,
            AdaptiveNode.HISTORY_COMPARE,
            AdaptiveNode.PHYSIOLOGY_DIAGNOSIS,
            AdaptiveNode.EXPERT_WIKI,
        )
        reasons.append("diagnosis requires recent history, physiology, and expert context")
    elif intent is AdvisorIntent.WHAT_IF:
        _append_unique(
            nodes,
            AdaptiveNode.HISTORY_COMPARE,
            AdaptiveNode.PHYSIOLOGY_DIAGNOSIS,
            AdaptiveNode.BOUNDED_SCENARIO,
            AdaptiveNode.SENSITIVITY,
            AdaptiveNode.EXPERT_WIKI,
        )
        reasons.append("counterfactual requires bounded model calculations")
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
        reasons.append("future plan requires weather, operations, work, and model context")
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
        reasons.append("cross-domain optimization requires crop, operations, weather, and market lanes")

    # Domain words may enrich a lower-level intent without upgrading it.
    if _contains_any(text, _PHYSIOLOGY_TERMS):
        _append_unique(nodes, AdaptiveNode.HISTORY_COMPARE, AdaptiveNode.PHYSIOLOGY_DIAGNOSIS)
    if _contains_any(text, _WEATHER_TERMS):
        _append_unique(nodes, AdaptiveNode.WEATHER_OUTLOOK)
    if _contains_any(text, _MARKET_TERMS):
        _append_unique(nodes, AdaptiveNode.MARKET_OUTLOOK, AdaptiveNode.HARVEST_MARKET_ANALYSIS)
    if _contains_any(text, _OPERATIONS_TERMS):
        _append_unique(nodes, AdaptiveNode.OPERATIONS_CALENDAR, AdaptiveNode.WORK_PLANNING)

    nodes.extend(
        [
            AdaptiveNode.CONSTRAINT_GATE,
            AdaptiveNode.ANSWER_ADMISSION,
            AdaptiveNode.QUALITY_GATE,
        ]
    )
    if request.include_narrative:
        nodes.append(AdaptiveNode.NARRATE)

    horizons: list[int] = []
    if AdaptiveNode.BOUNDED_SCENARIO in nodes or AdaptiveNode.SENSITIVITY in nodes:
        horizons = [24, 72, 168, 336]

    return AdaptiveGraphPlan(
        intent=intent,
        nodes=nodes,
        controls=controls,
        horizons_hours=horizons,
        max_parallel_nodes=5,
        max_model_evaluations=12 if intent is AdvisorIntent.OPTIMIZE else 8,
        include_narrative=request.include_narrative,
        reasons=reasons,
    )
