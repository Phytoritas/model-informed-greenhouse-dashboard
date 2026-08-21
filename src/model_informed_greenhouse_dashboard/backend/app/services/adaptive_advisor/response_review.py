"""Post-render semantic validation, unit-aware numeric checks, and repair."""

from __future__ import annotations

import re
from typing import Iterable

from .answer_packet import render_answer_packet
from .contracts import AdaptiveAnswerPacket, AdvisorIntent, ResponseReview
from .numeric_claims import (
    extract_numeric_mentions,
    numeric_mention_is_authorized,
)


_WORD_RE = re.compile(r"[A-Za-z]{3,}|[가-힣]{2,}")
_TIME_RE = re.compile(
    r"(지금|오늘(?:\s*밤)?|내일|이번\s*주|다음\s*주|"
    r"\d+(?:\.\d+)?\s*(?:시간|일|h|hours?|days?)|"
    r"now|today|tonight|tomorrow|this\s+week|next\s+week)",
    re.IGNORECASE,
)
_STOPWORDS = {
    "입니다",
    "합니다",
    "하세요",
    "가능성",
    "현재",
    "답변",
    "조건부",
    "because",
    "possible",
    "current",
    "answer",
    "should",
}
_CAUSE_TERMS = (
    "원인",
    "때문",
    "제한",
    "영향",
    "driver",
    "because",
    "limitation",
    "caused",
)
_UNCERTAINTY_TERMS = (
    "한계",
    "조건부",
    "확인되지",
    "자료가 부족",
    "불확실",
    "추가 측정",
    "limit",
    "conditional",
    "uncertain",
    "missing",
    "insufficient",
)
_MARKET_TERMS = (
    "시장",
    "가격",
    "반입",
    "출하",
    "market",
    "price",
    "arrival",
    "shipment",
)


def _tokens(text: str) -> set[str]:
    return {
        token.lower()
        for token in _WORD_RE.findall(str(text))
        if token.lower() not in _STOPWORDS
    }


def _anchor_overlap(text: str, anchors: Iterable[str], *, minimum: int) -> bool:
    text_tokens = _tokens(text)
    for anchor in anchors:
        anchor_tokens = _tokens(anchor)
        if len(text_tokens.intersection(anchor_tokens)) >= min(
            minimum,
            max(len(anchor_tokens), 1),
        ):
            return True
    return False


def _authorized_numeric_claims(
    text: str,
    packet: AdaptiveAnswerPacket,
) -> list[str]:
    unsupported: list[str] = []
    for mention in extract_numeric_mentions(text):
        if not numeric_mention_is_authorized(
            mention,
            packet.authorized_numeric_claims,
        ):
            unsupported.append(str(mention["token"]))
    return list(dict.fromkeys(unsupported))


def _required_elements(
    intent: AdvisorIntent,
    packet: AdaptiveAnswerPacket,
) -> list[str]:
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

    driver_anchors = [
        driver.label
        for driver in packet.causal_drivers
        if driver.label.strip()
    ]
    driver_anchors.extend(
        observation
        for driver in packet.causal_drivers
        for observation in driver.observations
        if observation.strip()
    )
    if packet.causal_drivers and (
        _anchor_overlap(text, driver_anchors, minimum=1)
        and any(term in lower for term in _CAUSE_TERMS)
    ):
        present.append("explanation")

    action_anchors = [
        value
        for action in packet.actions
        for value in (action.title, action.operator, action.expected_effect)
        if value.strip()
    ]
    if packet.actions and _anchor_overlap(text, action_anchors, minimum=2):
        present.append("action")

    time_anchors = [
        action.time_window
        for action in packet.actions
        if action.time_window.strip()
    ]
    if packet.actions and (
        any(anchor.lower() in lower for anchor in time_anchors)
        or _TIME_RE.search(text)
    ):
        present.append("time_window")

    if packet.uncertainties and (
        _anchor_overlap(text, packet.uncertainties, minimum=2)
        or any(term in lower for term in _UNCERTAINTY_TERMS)
    ):
        present.append("uncertainty")

    if packet.market_context and any(term in lower for term in _MARKET_TERMS):
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

    required_set = set(required)
    coverage = len(required_set.intersection(present)) / max(len(required_set), 1)
    missing = sorted(required_set.difference(present))
    if missing:
        gaps.append("response_element_missing")
        gaps.extend(f"missing_response_element:{name}" for name in missing)
    return (
        {
            "diagnostic_depth": round(diagnostic_depth, 4),
            "actionability": round(actionability, 4),
            "temporal_alignment": round(
                max(0.0, min(1.0, temporal_alignment)),
                4,
            ),
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
    max_chars = 1800 if language == "ko" else 2200
    too_verbose = len(text.strip()) > max_chars
    accepted = bool(text.strip()) and coverage >= 1.0 and not unsupported and not too_verbose
    reasons: list[str] = []
    if coverage < 1.0:
        reasons.append("response_element_missing")
    if unsupported:
        reasons.append("unsupported_numeric_claim")
    if too_verbose:
        reasons.append("response_too_verbose")
        gaps.append("response_too_verbose")
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
            content_scores={
                key: value
                for key, value in scores.items()
                if key != "coverage"
            },
            quality_gaps=list(dict.fromkeys(gaps)),
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
        source=(
            "deterministic_fallback"
            if narrative_attempted
            else "deterministic_only"
        ),
        reasons=list(dict.fromkeys(reasons)),
        content_scores={
            key: value
            for key, value in deterministic_scores.items()
            if key != "coverage"
        },
        quality_gaps=list(
            dict.fromkeys(
                [
                    *gaps,
                    *deterministic_gaps,
                    *reasons,
                ]
            )
        ),
    )
