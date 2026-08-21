"""Deterministic semantic analysis for adaptive greenhouse-advisor questions.

The analyzer converts a grower's question into a bounded contract. It does not
select arbitrary Python functions and it does not treat prose as an authoritative
calendar or market fact. Its output is consumed by the planner, exact scenario
gate, retrieval router, answer compiler, and quality benchmark.
"""

from __future__ import annotations

import re
from typing import Any

from .contracts import AdvisorIntent


_DIAGNOSIS_TERMS = (
    "왜", "원인", "차이", "다른", "저하", "감소", "이상", "비교",
    "diagnos", "why", "difference", "lower than", "decline",
)
_STATUS_TERMS = ("현재", "지금", "상태", "몇 도", "얼마", "current", "status", "now")
_FUTURE_TERMS = (
    "다음 주", "다음주", "이번 주", "이번주", "내일", "모레", "휴일", "휴가",
    "next week", "this week", "tomorrow", "holiday", "vacation",
)
_OPERATIONS_TERMS = (
    "출하", "휴가", "휴일", "휴장", "작업", "작업자", "포장", "저장", "선별",
    "shipment", "holiday", "labor", "packing", "storage", "grading",
)
_MARKET_TERMS = ("가격", "시장", "도매", "소매", "시세", "kamis", "price", "market")
_PLAN_TERMS = ("계획", "대응", "운영", "관리", "schedule", "plan", "strategy", "manage")
_OPTIMIZE_TERMS = (
    "최적", "최소화", "최대한", "tradeoff", "optimiz", "maximize", "minimize",
    "손실을 줄", "손실이 덜",
)
_ACTION_TERMS = (
    "조치", "대응", "해야", "할까", "권장", "추천", "관리", "어떻게 조정",
    "what should", "how should", "recommend", "action", "respond",
)
_CHANGE_TERMS = (
    "올리", "높이", "증가", "상향", "내리", "낮추", "감소", "하향", "바꾸", "조정",
    "increase", "raise", "decrease", "lower", "change", "adjust", "from", "to", "하면",
)
_DECREASE_TERMS = (
    "내리", "낮추", "감소", "하향", "줄이", "decrease", "lower", "reduce", "down",
)
_INCREASE_TERMS = (
    "올리", "높이", "증가", "상향", "늘리", "increase", "raise", "up",
)

_TARGET_TERMS: dict[str, tuple[str, ...]] = {
    "photosynthesis": ("광합성", "동화량", "동화", "photosynthesis", "assimilation"),
    "stomatal_conductance": ("기공전도도", "기공", "gsw", "stomatal"),
    "transpiration": ("증산", "transpiration"),
    "canopy_temperature": (
        "엽온", "잎 온도", "캐노피 온도", "canopy temperature", "leaf temperature",
    ),
    "vpd": ("vpd", "증기압차"),
    "root_zone_water": (
        "근권", "배지 수분", "토양 수분", "함수율", "soil moisture", "root-zone",
    ),
    "source_sink": ("소스-싱크", "source-sink", "source sink", "sink demand"),
    "yield": ("수량", "수확량", "생산량", "yield", "harvest"),
    "maturity": ("성숙", "숙기", "착색", "maturity", "ripening"),
    "price": _MARKET_TERMS,
    "energy": (
        "에너지", "난방비", "냉방비", "전력", "energy", "heating cost", "cooling cost",
    ),
    "disease_risk": ("병해", "결로", "곰팡이", "disease", "condensation"),
}

_OBJECTIVE_TERMS: dict[str, tuple[str, ...]] = {
    "minimize_yield_loss": (
        "수량 손실", "생산 손실", "손실 최소", "손실이 덜", "yield loss", "minimize loss",
    ),
    "maximize_revenue": ("수익", "매출", "이익", "revenue", "profit", "margin"),
    "price_risk": _MARKET_TERMS,
    "energy_cost": ("에너지", "비용", "난방비", "냉방비", "energy", "cost"),
    "quality": ("품질", "과숙", "열과", "quality", "overripe", "cracking"),
    "labor_capacity": ("작업자", "노동", "인력", "작업량", "labor", "workload"),
    "disease_risk": ("병해", "결로", "disease", "condensation"),
}

_CONTROL_FAMILIES: tuple[dict[str, Any], ...] = (
    {
        "control": "co2_setpoint_day",
        "unit": "ppm",
        "keywords": ("co2", "이산화탄소", "탄산가스"),
        "unit_pattern": r"ppm|피피엠",
    },
    {
        "control": "screen_close",
        "unit": "%p",
        "keywords": ("스크린", "차광", "커튼", "screen"),
        "unit_pattern": r"%|퍼센트|pct",
    },
    {
        "control": "rh_target",
        "unit": "%p",
        "keywords": ("습도", "rh", "가습", "제습"),
        "unit_pattern": r"%|퍼센트|pct",
    },
    {
        "control": "temperature_night",
        "unit": "C",
        "keywords": ("야간 온도", "밤 온도", "야온", "야간", "night temperature"),
        "unit_pattern": r"℃|°c|도|c",
    },
    {
        "control": "temperature_day",
        "unit": "C",
        "keywords": ("주간 온도", "낮 온도", "주간", "온도", "temperature", "temp"),
        "unit_pattern": r"℃|°c|도|c",
    },
)


def _normalize(text: str) -> str:
    return " ".join((text or "").lower().split())


def _contains_any(text: str, terms: tuple[str, ...]) -> bool:
    return any(term in text for term in terms)


def _signed_by_language(value: float, text: str) -> float:
    if value < 0:
        return value
    if _contains_any(text, _DECREASE_TERMS):
        return -abs(value)
    if _contains_any(text, _INCREASE_TERMS):
        return abs(value)
    return value


def _keyword_span(text: str, keywords: tuple[str, ...]) -> tuple[int, int] | None:
    matches = [(text.find(keyword), keyword) for keyword in keywords if keyword in text]
    if not matches:
        return None
    start, keyword = min(matches, key=lambda item: item[0])
    return start, start + len(keyword)


def _local_segment(text: str, span: tuple[int, int], radius: int = 60) -> str:
    return text[max(0, span[0] - radius): min(len(text), span[1] + radius)]


def _extract_family_request(text: str, family: dict[str, Any]) -> dict[str, Any] | None:
    keywords = tuple(family["keywords"])
    span = _keyword_span(text, keywords)
    if span is None:
        return None

    if family["control"] == "temperature_day":
        night_span = _keyword_span(
            text,
            ("야간 온도", "밤 온도", "야온", "야간", "night temperature"),
        )
        day_specific = _contains_any(
            text,
            ("주간 온도", "낮 온도", "주간", "day temperature"),
        )
        if night_span is not None and not day_specific:
            return None

    segment = _local_segment(text, span)
    if not _contains_any(segment, _CHANGE_TERMS):
        return {
            "control": family["control"],
            "unit": family["unit"],
            "mode": "MENTIONED",
            "from_value": None,
            "target_value": None,
            "requested_delta": None,
            "resolved": False,
        }

    unit_pattern = str(family["unit_pattern"])
    number = r"([+-]?\d+(?:\.\d+)?)"
    optional_unit = rf"(?:\s*(?:{unit_pattern}))?"
    required_unit = rf"\s*(?:{unit_pattern})"

    transition_patterns = (
        rf"{number}{optional_unit}\s*(?:에서|부터)\s*{number}{required_unit}",
        rf"(?:from)\s*{number}{optional_unit}\s*(?:to)\s*{number}{required_unit}",
    )
    for pattern in transition_patterns:
        match = re.search(pattern, segment, flags=re.IGNORECASE)
        if match:
            start, target = float(match.group(1)), float(match.group(2))
            return {
                "control": family["control"],
                "unit": family["unit"],
                "mode": "TRANSITION",
                "from_value": start,
                "target_value": target,
                "requested_delta": round(target - start, 6),
                "resolved": True,
            }

    values = [
        float(match)
        for match in re.findall(
            rf"{number}{required_unit}",
            segment,
            flags=re.IGNORECASE,
        )
    ]
    if values:
        value = values[0]
        has_delta_language = (
            bool(re.search(r"[+-]\s*\d", segment))
            or _contains_any(segment, _DECREASE_TERMS + _INCREASE_TERMS)
        )
        if has_delta_language:
            return {
                "control": family["control"],
                "unit": family["unit"],
                "mode": "DELTA",
                "from_value": None,
                "target_value": None,
                "requested_delta": round(_signed_by_language(value, segment), 6),
                "resolved": True,
            }
        return {
            "control": family["control"],
            "unit": family["unit"],
            "mode": "ABSOLUTE_TARGET",
            "from_value": None,
            "target_value": value,
            "requested_delta": None,
            "resolved": False,
        }

    return {
        "control": family["control"],
        "unit": family["unit"],
        "mode": "DIRECTION_ONLY",
        "from_value": None,
        "target_value": None,
        "requested_delta": None,
        "resolved": False,
    }


def _extract_controls(text: str) -> tuple[list[str], list[dict[str, Any]]]:
    candidates: list[str] = []
    requests: list[dict[str, Any]] = []
    for family in _CONTROL_FAMILIES:
        item = _extract_family_request(text, family)
        if item is None:
            continue
        control = str(item["control"])
        if control not in candidates:
            candidates.append(control)
        if item["mode"] in {"TRANSITION", "DELTA", "ABSOLUTE_TARGET"}:
            requests.append(item)
    return candidates, requests


def _time_scope(text: str) -> str:
    if _contains_any(text, ("2주", "14일", "fortnight", "two weeks")):
        return "NEXT_14D"
    if _contains_any(text, ("다음 주", "다음주", "7일", "next week")):
        return "NEXT_7D"
    if _contains_any(text, ("3일", "사흘", "next 3", "three day")):
        return "NEXT_3D"
    if _contains_any(text, ("내일", "tomorrow")):
        return "NEXT_24H"
    if _contains_any(text, ("오늘", "금일", "today")):
        return "TODAY"
    if _contains_any(text, ("현재", "지금", "now", "current")):
        return "NOW"
    return "UNSPECIFIED"


def _comparison_mode(text: str) -> str:
    if _contains_any(
        text,
        ("어제", "전일", "같은 시간", "동시간", "yesterday", "same time"),
    ):
        return "SAME_TIME_PREVIOUS_DAY"
    if _contains_any(
        text,
        ("최근", "추세", "평소", "지난", "trend", "recent", "baseline"),
    ):
        return "RECENT_BASELINE"
    return "NONE"


def _operator_assumptions(text: str) -> list[dict[str, Any]]:
    candidates = (
        (
            "shipment_blackout_stated",
            ("출하가 없", "출하 없음", "출하하지 않", "no shipment"),
            "The operator states that shipment is unavailable.",
        ),
        (
            "holiday_or_vacation_stated",
            ("휴가", "휴일", "holiday", "vacation"),
            "The operator states a holiday or vacation constraint.",
        ),
        (
            "price_decline_expected",
            ("가격 인하", "가격 하락", "가격이 떨어", "price drop", "lower price"),
            "The operator expects a price decline.",
        ),
        (
            "post_holiday_volume_surge_expected",
            ("물량이 쏟", "물량 집중", "출하 집중", "volume surge", "supply glut"),
            "The operator expects a post-holiday shipment concentration.",
        ),
    )
    return [
        {
            "code": code,
            "statement": statement,
            "status": "OPERATOR_STATED",
            "authoritative": False,
        }
        for code, terms, statement in candidates
        if _contains_any(text, terms)
    ]


def _intent(
    text: str,
    *,
    comparison_mode: str,
    operations: bool,
    market: bool,
    objectives: list[str],
    control_candidates: list[str],
    control_requests: list[dict[str, Any]],
) -> AdvisorIntent:
    future = _contains_any(text, _FUTURE_TERMS)
    diagnostic = comparison_mode != "NONE" or _contains_any(text, _DIAGNOSIS_TERMS)
    status = _contains_any(text, _STATUS_TERMS)
    explicit_optimize = _contains_any(text, _OPTIMIZE_TERMS)
    explicit_plan = _contains_any(text, _PLAN_TERMS)

    if explicit_optimize and (objectives or operations or market):
        return AdvisorIntent.OPTIMIZE
    if operations and (market or objectives):
        return AdvisorIntent.OPTIMIZE
    if (future and operations) or (explicit_plan and (future or objectives)):
        return AdvisorIntent.PLAN
    if control_requests or (control_candidates and _contains_any(text, _CHANGE_TERMS)):
        return AdvisorIntent.WHAT_IF
    if diagnostic:
        return AdvisorIntent.DIAGNOSE
    if status:
        return AdvisorIntent.STATUS
    return AdvisorIntent.DIAGNOSE


def _retrieval_queries(
    *,
    question: str,
    crop: str,
    language: str,
    targets: list[str],
    objectives: list[str],
) -> list[str]:
    queries = [" ".join(question.split())]
    crop_label = {"tomato": "토마토", "cucumber": "오이"}.get(crop, crop)
    target_text = " ".join(targets) or "greenhouse crop physiology"
    objective_text = " ".join(objectives)
    if language == "ko":
        queries.append(f"{crop_label} {target_text} 원인 기작 제한요인 온실 생리")
        queries.append(
            f"{crop_label} {target_text} {objective_text} 재배 관리 교정 조치"
        )
    else:
        queries.append(
            f"{crop} {target_text} mechanism limiting factor greenhouse physiology"
        )
        queries.append(
            f"{crop} {target_text} {objective_text} corrective crop management"
        )
    result: list[str] = []
    for query in queries:
        normalized = " ".join(query.split())
        if normalized and normalized not in result:
            result.append(normalized)
    return result[:3]


def analyze_question(
    question: str,
    *,
    crop: str,
    language: str = "ko",
) -> dict[str, Any]:
    text = _normalize(question)
    targets = [
        name for name, terms in _TARGET_TERMS.items() if _contains_any(text, terms)
    ]
    objectives = [
        name for name, terms in _OBJECTIVE_TERMS.items() if _contains_any(text, terms)
    ]
    comparison_mode = _comparison_mode(text)
    operations = _contains_any(text, _OPERATIONS_TERMS)
    market = _contains_any(text, _MARKET_TERMS)
    control_candidates, control_requests = _extract_controls(text)
    intent = _intent(
        text,
        comparison_mode=comparison_mode,
        operations=operations,
        market=market,
        objectives=objectives,
        control_candidates=control_candidates,
        control_requests=control_requests,
    )
    assumptions = _operator_assumptions(text)
    action_requested = (
        intent in {AdvisorIntent.DIAGNOSE, AdvisorIntent.PLAN, AdvisorIntent.OPTIMIZE}
        or _contains_any(text, _ACTION_TERMS)
    )

    unresolved: list[str] = []
    if any(not bool(item.get("resolved")) for item in control_requests):
        unresolved.append(
            "absolute control target needs the current setpoint to resolve a delta"
        )
    if comparison_mode != "NONE" and not targets:
        unresolved.append("comparison target was not explicit")
    if assumptions:
        unresolved.append(
            "operator-stated operations/market assumptions are not authoritative until registered"
        )

    return {
        "schema_version": "adaptive-question-facets.v2",
        "intent": intent.value,
        "target_signals": targets,
        "comparison_mode": comparison_mode,
        "time_scope": _time_scope(text),
        "objectives": objectives,
        "control_candidates": control_candidates,
        "requested_controls": control_requests,
        "requires_temporal_pair": comparison_mode != "NONE"
        or intent is AdvisorIntent.DIAGNOSE,
        "requires_market_operations_join": operations and (market or bool(objectives)),
        "requires_action": action_requested,
        "requires_explanation": intent is not AdvisorIntent.STATUS,
        "operations_relevant": operations,
        "market_relevant": market,
        "operator_assumptions": assumptions,
        "retrieval_queries": _retrieval_queries(
            question=question,
            crop=crop,
            language=language,
            targets=targets,
            objectives=objectives,
        ),
        "unresolved_references": unresolved,
    }
