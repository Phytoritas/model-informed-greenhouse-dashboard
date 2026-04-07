"""Heuristic intent routing and rerank boosts for SmartGrow knowledge queries."""

from __future__ import annotations

import re
from copy import deepcopy
from collections import Counter
from typing import Any, Mapping


_TOKEN_PATTERN = re.compile(r"[0-9A-Za-z가-힣_+-]+")

_PROFILE_DEFINITIONS: dict[str, dict[str, Any]] = {
    "general_chat": {
        "keywords": set(),
        "search_filters": {},
        "boosts": {},
        "expansion_terms": [],
        "rerank_profile": "general",
    },
    "environment_control": {
        "keywords": {
            "environment",
            "climate",
            "temperature",
            "humidity",
            "vpd",
            "co2",
            "ventilation",
            "heating",
            "cooling",
            "setpoint",
            "dew",
            "condensation",
            "telemetry",
            "환경",
            "온도",
            "습도",
            "환기",
            "난방",
            "냉방",
            "결로",
            "이산화탄소",
        },
        "search_filters": {"source_types": ["pdf", "csv"], "topic_major": "environment"},
        "boosts": {
            "source_types": ["pdf", "csv"],
            "topic_majors": ["environment"],
            "topic_minors": ["telemetry"],
        },
        "expansion_terms": ["temperature", "humidity", "vpd", "co2", "telemetry"],
        "rerank_profile": "environment",
    },
    "crop_physiology": {
        "keywords": {
            "physiology",
            "photosynthesis",
            "transpiration",
            "stomatal",
            "canopy",
            "assimilation",
            "flowering",
            "fruit",
            "fruit_set",
            "growth",
            "balance",
            "생리",
            "광합성",
            "증산",
            "기공",
            "수관",
            "착과",
            "개화",
            "생육",
            "초세",
        },
        "search_filters": {"source_types": ["pdf"], "topic_major": "physiology"},
        "boosts": {
            "source_types": ["pdf"],
            "topic_majors": ["physiology", "growth"],
        },
        "expansion_terms": ["canopy", "photosynthesis", "transpiration", "growth"],
        "rerank_profile": "physiology",
    },
    "disease_pest": {
        "keywords": {
            "disease",
            "pest",
            "powdery",
            "mildew",
            "blight",
            "fungicide",
            "insecticide",
            "rotation",
            "frac",
            "irac",
            "spray",
            "product",
            "symptom",
            "diagnosis",
            "병해충",
            "병해",
            "해충",
            "흰가루",
            "노균",
            "방제",
            "농약",
            "교호",
            "약제",
            "살균",
            "살충",
            "증상",
            "진단",
        },
        "search_filters": {"source_types": ["pdf", "xlsx"]},
        "boosts": {
            "asset_families": ["pesticide_workbook"],
            "source_types": ["xlsx"],
            "topic_majors": ["disease_pest"],
            "topic_minors": ["pesticide_product", "pesticide_rotation"],
        },
        "expansion_terms": ["rotation", "frac", "irac", "dilution", "mixing", "registration"],
        "rerank_profile": "structured_pesticide",
    },
    "nutrient_recipe": {
        "keywords": {
            "nutrient",
            "recipe",
            "fertilizer",
            "guardrail",
            "ec",
            "no3",
            "nh4",
            "ca",
            "mg",
            "k",
            "drain",
            "runoff",
            "source",
            "water",
            "tank",
            "stock",
            "formula",
            "양액",
            "비료",
            "배액",
            "원수",
            "처방",
            "보정",
            "급액",
        },
        "search_filters": {"asset_families": ["nutrient_workbook"], "source_types": ["xlsx"]},
        "boosts": {
            "asset_families": ["nutrient_workbook"],
            "source_types": ["xlsx"],
            "topic_majors": ["nutrient_recipe", "drain_feedback"],
            "topic_minors": ["nutrient_recipe", "fertilizer", "source_water", "drain_water"],
        },
        "expansion_terms": ["fertilizer", "guardrail", "recipe", "drain", "source_water", "tank"],
        "rerank_profile": "structured_nutrient",
    },
    "cultivation_work": {
        "keywords": {
            "work",
            "task",
            "pruning",
            "defoliation",
            "scouting",
            "checklist",
            "operation",
            "labor",
            "작업",
            "적엽",
            "유인",
            "순치기",
            "점검",
            "체크리스트",
            "수확작업",
        },
        "search_filters": {"source_types": ["pdf"]},
        "boosts": {
            "source_types": ["pdf"],
            "topic_majors": ["management", "growth"],
        },
        "expansion_terms": ["checklist", "operation", "management"],
        "rerank_profile": "cultivation_work",
    },
    "harvest_market": {
        "keywords": {
            "harvest",
            "market",
            "price",
            "shipment",
            "grading",
            "yield",
            "sales",
            "wholesale",
            "retail",
            "수확",
            "시장",
            "가격",
            "출하",
            "등급",
            "수량",
            "도매",
            "소매",
        },
        "search_filters": {"source_types": ["pdf", "csv"]},
        "boosts": {
            "source_types": ["pdf", "csv"],
            "topic_majors": ["management", "growth"],
        },
        "expansion_terms": ["harvest", "yield", "market", "shipment"],
        "rerank_profile": "harvest_market",
    },
}

_FILTER_TO_INTENT = {
    "pesticide_workbook": "disease_pest",
    "nutrient_workbook": "nutrient_recipe",
}

_SUB_INTENT_KEYWORDS: dict[str, dict[str, set[str]]] = {
    "disease_pest": {
        "cycle_recommendation": {"rotation", "cycle", "교호", "주기"},
        "product_recommendation": {"product", "fungicide", "insecticide", "등록", "제품", "약제"},
        "symptom_to_action": {"symptom", "risk", "diagnosis", "증상", "진단"},
    },
    "nutrient_recipe": {
        "drain_feedback": {"drain", "runoff", "배액", "배수"},
        "formula_adjustment": {"adjust", "correction", "formula", "보정", "조정"},
        "product_recommendation": {"fertilizer", "tank", "stock", "비료", "탱크"},
    },
    "environment_control": {
        "next_24h_action": {"next", "24h", "tomorrow", "내일"},
        "current_state_diagnosis": {"current", "status", "diagnosis", "지금", "진단"},
    },
    "crop_physiology": {
        "current_state_diagnosis": {"current", "status", "diagnosis", "지금", "진단"},
        "explain_why": {"why", "because", "원인", "이유"},
    },
    "cultivation_work": {
        "next_24h_action": {"next", "24h", "tomorrow", "내일"},
        "checklist": {"checklist", "steps", "체크리스트", "순서"},
    },
    "harvest_market": {
        "comparative_option": {"compare", "option", "strategy", "비교", "전략"},
        "next_24h_action": {"next", "24h", "tomorrow", "내일"},
    },
}

_ANALYTE_EXPANSIONS = {
    "ca": "calcium",
    "mg": "magnesium",
    "k": "potassium",
    "ec": "conductivity",
    "co2": "carbon_dioxide",
    "no3": "nitrate",
    "nh4": "ammonium",
}


def _normalize_text(value: Any) -> str:
    return re.sub(r"\s+", " ", str(value or "")).strip().lower()


def _normalize_tokens(text: str) -> list[str]:
    tokens: list[str] = []
    seen: set[str] = set()
    for token in _TOKEN_PATTERN.findall(_normalize_text(text)):
        if token and token not in seen:
            seen.add(token)
            tokens.append(token)
    return tokens


def _normalize_filters(filters: dict[str, Any] | None) -> dict[str, Any]:
    payload = filters or {}
    normalized: dict[str, Any] = {}

    source_types = [
        _normalize_text(value)
        for value in payload.get("source_types", [])
        if _normalize_text(value)
    ]
    if source_types:
        normalized["source_types"] = source_types

    asset_families = [
        _normalize_text(value)
        for value in payload.get("asset_families", [])
        if _normalize_text(value)
    ]
    if asset_families:
        normalized["asset_families"] = asset_families

    topic_major = _normalize_text(payload.get("topic_major"))
    if topic_major:
        normalized["topic_major"] = topic_major

    topic_minor = _normalize_text(payload.get("topic_minor"))
    if topic_minor:
        normalized["topic_minor"] = topic_minor

    return normalized


def _merge_filter_lists(explicit: list[str] | None, default: list[str] | None) -> list[str] | None:
    if explicit:
        return explicit
    if default:
        return default
    return None


def _merge_search_filters(
    explicit_filters: dict[str, Any],
    default_filters: dict[str, Any],
) -> dict[str, Any]:
    merged: dict[str, Any] = {}
    merged["source_types"] = _merge_filter_lists(
        explicit_filters.get("source_types"),
        default_filters.get("source_types"),
    )
    merged["asset_families"] = _merge_filter_lists(
        explicit_filters.get("asset_families"),
        default_filters.get("asset_families"),
    )
    merged["topic_major"] = explicit_filters.get("topic_major") or default_filters.get("topic_major")
    merged["topic_minor"] = explicit_filters.get("topic_minor") or default_filters.get("topic_minor")
    return {key: value for key, value in merged.items() if value}


def _intent_from_explicit_filters(filters: dict[str, Any]) -> str | None:
    for asset_family in filters.get("asset_families", []):
        if asset_family in _FILTER_TO_INTENT:
            return _FILTER_TO_INTENT[asset_family]

    topic_major = filters.get("topic_major")
    if topic_major == "environment":
        return "environment_control"
    if topic_major == "physiology":
        return "crop_physiology"
    if topic_major == "management":
        return "cultivation_work"

    return None


def _detect_intent(tokens: list[str], explicit_filters: dict[str, Any]) -> str:
    explicit_intent = _intent_from_explicit_filters(explicit_filters)
    if explicit_intent:
        return explicit_intent

    token_set = set(tokens)
    scores: Counter[str] = Counter()
    for intent, profile in _PROFILE_DEFINITIONS.items():
        if intent == "general_chat":
            continue
        scores[intent] += len(token_set & profile["keywords"])

    best_intent, best_score = scores.most_common(1)[0] if scores else ("general_chat", 0)
    if best_score <= 0:
        return "general_chat"
    return best_intent


def _detect_sub_intent(intent: str, tokens: list[str]) -> str | None:
    token_set = set(tokens)
    for sub_intent, keywords in _SUB_INTENT_KEYWORDS.get(intent, {}).items():
        if token_set & keywords:
            return sub_intent
    return None


def _build_query_terms(tokens: list[str], profile: Mapping[str, Any]) -> tuple[list[str], list[str]]:
    query_terms: list[str] = []
    seen: set[str] = set()

    def add_term(term: str) -> None:
        normalized = _normalize_text(term)
        if normalized and normalized not in seen:
            seen.add(normalized)
            query_terms.append(normalized)

    for token in tokens:
        add_term(token)
        if token in _ANALYTE_EXPANSIONS:
            add_term(_ANALYTE_EXPANSIONS[token])

    base_count = len(query_terms)

    for term in profile.get("expansion_terms", []):
        add_term(term)

    expanded_terms = query_terms[base_count:]
    return query_terms[:12], expanded_terms[:8]


def _apply_sub_intent_profile(
    intent: str,
    sub_intent: str | None,
    profile: dict[str, Any],
) -> dict[str, Any]:
    adjusted = deepcopy(profile)
    boosts = adjusted.setdefault("boosts", {})

    if intent == "disease_pest":
        if sub_intent == "cycle_recommendation":
            adjusted["search_filters"] = {
                "asset_families": ["pesticide_workbook"],
                "source_types": ["xlsx"],
            }
            boosts["topic_minors"] = ["pesticide_rotation"]
        elif sub_intent == "product_recommendation":
            adjusted["search_filters"] = {
                "asset_families": ["pesticide_workbook"],
                "source_types": ["xlsx"],
            }
            boosts["topic_minors"] = ["pesticide_product"]
        else:
            adjusted["search_filters"] = {"source_types": ["pdf", "xlsx"]}
        return adjusted

    if intent == "nutrient_recipe":
        if sub_intent == "product_recommendation":
            boosts["topic_majors"] = ["nutrient_recipe"]
            boosts["topic_minors"] = ["fertilizer"]
        elif sub_intent == "drain_feedback":
            boosts["topic_majors"] = ["drain_feedback", "nutrient_recipe"]
            boosts["topic_minors"] = ["drain_water", "source_water", "nutrient_recipe"]
        else:
            boosts["topic_majors"] = ["nutrient_recipe"]
            boosts["topic_minors"] = ["nutrient_recipe"]
        return adjusted

    if intent == "environment_control" and sub_intent == "current_state_diagnosis":
        boosts["topic_minors"] = ["telemetry"]
        return adjusted

    return adjusted


def route_knowledge_query(
    query_text: str,
    filters: dict[str, Any] | None = None,
) -> dict[str, Any]:
    explicit_filters = _normalize_filters(filters)
    tokens = _normalize_tokens(query_text)
    intent = _detect_intent(tokens, explicit_filters)
    sub_intent = _detect_sub_intent(intent, tokens)
    profile = _apply_sub_intent_profile(intent, sub_intent, _PROFILE_DEFINITIONS[intent])
    query_terms, expanded_terms = _build_query_terms(tokens, profile)
    search_filters = _merge_search_filters(explicit_filters, profile.get("search_filters", {}))

    return {
        "intent": intent,
        "sub_intent": sub_intent,
        "rerank_profile": profile.get("rerank_profile", "general"),
        "search_filters": search_filters,
        "explicit_filters": explicit_filters,
        "query_terms": query_terms,
        "expanded_terms": expanded_terms,
        "boosts": profile.get("boosts", {}),
    }


def routed_relevance_bonus(
    *,
    row: Mapping[str, Any],
    route: Mapping[str, Any],
    haystack: str,
) -> float:
    boosts = route.get("boosts", {})
    bonus = 0.0

    asset_family = _normalize_text(row.get("asset_family"))
    if asset_family and asset_family in boosts.get("asset_families", []):
        bonus += 9.0

    source_type = _normalize_text(row.get("source_type"))
    if source_type and source_type in boosts.get("source_types", []):
        bonus += 4.0

    topic_major = _normalize_text(row.get("topic_major"))
    if topic_major and topic_major in boosts.get("topic_majors", []):
        bonus += 5.0

    topic_minor = _normalize_text(row.get("topic_minor"))
    if topic_minor and topic_minor in boosts.get("topic_minors", []):
        bonus += 3.0

    intent = route.get("intent")
    sub_intent = route.get("sub_intent")
    if intent == "nutrient_recipe" and sub_intent != "product_recommendation":
        if topic_minor == "fertilizer":
            bonus -= 6.0
        if topic_minor == "nutrient_recipe":
            bonus += 4.0
    if intent == "disease_pest" and sub_intent == "cycle_recommendation":
        if topic_minor == "pesticide_product":
            bonus -= 3.0
        if topic_minor == "pesticide_rotation":
            bonus += 2.0

    title_haystack = _normalize_text(row.get("title"))
    for term in route.get("expanded_terms", [])[:4]:
        normalized = _normalize_text(term)
        if not normalized:
            continue
        if normalized in title_haystack:
            bonus += 1.5
        elif normalized in haystack:
            bonus += 0.75

    if "fts" in row.get("candidate_sources", []):
        bonus += 1.0
    if "lexical" in row.get("candidate_sources", []):
        bonus += 1.0

    return round(min(bonus, 18.0), 3)
