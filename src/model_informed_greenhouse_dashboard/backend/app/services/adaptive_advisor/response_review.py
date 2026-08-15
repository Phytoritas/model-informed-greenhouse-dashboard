"""Post-render response validation and deterministic repair."""

from __future__ import annotations

import re
from typing import Any

from .answer_packet import render_answer_packet
from .contracts import AdaptiveAnswerPacket, AdvisorIntent, ResponseReview


_NUMBER_RE = re.compile(r"(?<![\w])[-+]?\d+(?:\.\d+)?(?:%|℃|°C|ppm|h|kg|원)?")
_ACTION_TERMS = (
    "조치",
    "설정",
    "유지",
    "낮추",
    "높이",
    "확인",
    "monitor",
    "set",
    "lower",
    "raise",
    "hold",
)
_CAUSE_TERMS = (
    "원인",
    "때문",
    "가능성",
    "제한",
    "driver",
    "because",
    "limitation",
)
_UNCERTAINTY_TERMS = (
    "한계",
    "조건부",
    "확인되지",
    "자료가",
    "불확실",
    "limit",
    "conditional",
    "uncertain",
    "missing",
)
_TIME_TERMS = (
    "지금",
    "오늘",
    "다음",
    "시간",
    "일",
    "now",
    "today",
    "next",
    "hour",
    "day",
)


def _normalize_numeric_token(value: str) -> str:
    return (
        value.replace("℃", "")
        .replace("°C", "")
        .replace("ppm", "")
        .replace("kg", "")
        .replace("원", "")
        .replace("h", "")
        .replace("%", "")
        .strip()
    )


def _authorized_numeric_claims(
    text: str,
    packet: AdaptiveAnswerPacket,
) -> list[str]:
    authorized = set(packet.authorized_numbers)
    unsupported: list[str] = []
    for token in _NUMBER_RE.findall(text):
        normalized = _normalize_numeric_token(token)
        try:
            numeric = float(normalized)
        except ValueError:
            continue
        candidates = {
            f"{numeric:g}",
            f"{numeric:.1f}",
            f"{numeric:.2f}",
        }
        if not candidates.intersection(authorized):
            unsupported.append(token)
    return list(dict.fromkeys(unsupported))


def _required_elements(intent: AdvisorIntent, packet: AdaptiveAnswerPacket) -> list[str]:
    required = ["direct_answer", "uncertainty"]
    if intent in {AdvisorIntent.DIAGNOSE, AdvisorIntent.WHAT_IF}:
        required.append("explanation")
    if intent in {AdvisorIntent.WHAT_IF, AdvisorIntent.PLAN, AdvisorIntent.OPTIMIZE}:
        required.extend(["action", "time_window"])
    if packet.market_context and intent in {AdvisorIntent.PLAN, AdvisorIntent.OPTIMIZE}:
        required.append("market_context")
    return list(dict.fromkeys(required))


def _present_elements(
    text: str,
    packet: AdaptiveAnswerPacket,
) -> list[str]:
    lower = text.lower()
    present = ["direct_answer"] if text.strip() else []
    if packet.causal_drivers and any(term in lower for term in _CAUSE_TERMS):
        present.append("explanation")
    if packet.actions and any(term in lower for term in _ACTION_TERMS):
        present.append("action")
    if packet.actions and any(term in lower for term in _TIME_TERMS):
        present.append("time_window")
    if packet.uncertainties and any(term in lower for term in _UNCERTAINTY_TERMS):
        present.append("uncertainty")
    if packet.market_context and any(
        term in lower for term in ("시장", "가격", "반입", "market", "price", "arrival")
    ):
        present.append("market_context")
    return list(dict.fromkeys(present))


def _content_scores(
    packet: AdaptiveAnswerPacket,
    *,
    required: list[str],
    present: list[str],
    unsupported: list[str],
) -> tuple[dict[str, float], list[str]]:
    gaps: list[str] = []
    temporal = packet.temporal_context
    temporal_alignment = float(
        (temporal.get("quality") or {}).get("temporal_alignment")
        or (1.0 if temporal.get("status") == "ready" else 0.25)
    )
    diagnostic_depth = min(
        1.0,
        0.25
        + 0.16 * len(packet.causal_drivers)
        + 0.04 * min(len(packet.observations), 5),
    )
    if "explanation" in required and not packet.causal_drivers:
        gaps.append("ranked_hypothesis_missing")
        diagnostic_depth = min(diagnostic_depth, 0.35)
    if temporal.get("status") != "ready" and packet.intent is AdvisorIntent.DIAGNOSE:
        gaps.append("temporal_baseline_missing")

    actionability = min(1.0, 0.2 + 0.18 * len(packet.actions))
    if "action" in required and not packet.actions:
        gaps.append("action_plan_incomplete")
        actionability = min(actionability, 0.3)

    cross_domain = 0.25
    if packet.operations_context:
        cross_domain += 0.25
    if packet.market_context:
        cross_domain += 0.25
    if packet.model_context:
        cross_domain += 0.15
    if packet.weather_context:
        cross_domain += 0.10
    cross_domain = min(1.0, cross_domain)
    if (
        packet.intent in {AdvisorIntent.PLAN, AdvisorIntent.OPTIMIZE}
        and (not packet.operations_context or not packet.market_context)
    ):
        gaps.append("operations_market_join_incomplete")

    numerical = 0.0 if unsupported else 1.0
    if unsupported:
        gaps.append("unsupported_numeric_claim")
    uncertainty = min(1.0, 0.35 + 0.15 * len(packet.uncertainties))
    if not packet.uncertainties:
        uncertainty = 0.25

    coverage = len(set(required).intersection(present)) / max(len(required), 1)
    if coverage < 1:
        gaps.append("response_element_missing")
    return (
        {
            "diagnostic_depth": round(diagnostic_depth, 4),
            "actionability": round(actionability, 4),
            "temporal_alignment": round(max(0.0, min(1.0, temporal_alignment)), 4),
            "cross_domain_synthesis": round(cross_domain, 4),
            "numerical_integrity": round(numerical, 4),
            "uncertainty_honesty": round(uncertainty, 4),
            "coverage": round(coverage, 4),
        },
        list(dict.fromkeys(gaps)),
    )


def review_response(
    *,
    text: str,
    packet: AdaptiveAnswerPacket,
    language: str,
    narrative_attempted: bool,
) -> ResponseReview:
    deterministic = render_answer_packet(packet, language=language)
    source = "llm" if narrative_attempted else "deterministic_only"
    required = _required_elements(packet.intent, packet)
    present = _present_elements(text, packet)
    unsupported = _authorized_numeric_claims(text, packet)
    scores, gaps = _content_scores(
        packet,
        required=required,
        present=present,
        unsupported=unsupported,
    )
    coverage = scores["coverage"]
    accepted = bool(text.strip()) and coverage >= 0.8 and not unsupported
    reasons: list[str] = []
    if coverage < 0.8:
        reasons.append("response_element_missing")
    if unsupported:
        reasons.append("unsupported_numeric_claim")
    if not text.strip():
        reasons.append("empty_response")

    if accepted:
        return ResponseReview(
            accepted=True,
            text=text.strip(),
            coverage=coverage,
            required_elements=required,
            present_elements=present,
            unsupported_numeric_claims=[],
            fallback_used=False,
            source=source,
            reasons=[],
            content_scores={key: value for key, value in scores.items() if key != "coverage"},
            quality_gaps=gaps,
        )

    deterministic_present = _present_elements(deterministic, packet)
    deterministic_scores, deterministic_gaps = _content_scores(
        packet,
        required=required,
        present=deterministic_present,
        unsupported=[],
    )
    return ResponseReview(
        accepted=True,
        text=deterministic,
        coverage=deterministic_scores["coverage"],
        required_elements=required,
        present_elements=deterministic_present,
        unsupported_numeric_claims=unsupported,
        fallback_used=narrative_attempted,
        source="deterministic_fallback" if narrative_attempted else "deterministic_only",
        reasons=reasons,
        content_scores={
            key: value for key, value in deterministic_scores.items() if key != "coverage"
        },
        quality_gaps=list(dict.fromkeys([*gaps, *deterministic_gaps, *reasons])),
    )
