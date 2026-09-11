"""Heuristic intent routing and rerank boosts for SmartGrow knowledge queries."""

from __future__ import annotations

import re
from copy import deepcopy
from collections import Counter
from typing import Any, Mapping


_TOKEN_PATTERN = re.compile(r"[0-9A-Za-z가-힣\u3040-\u30ff\u3400-\u9fff_+-]+")

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
        "search_filters": {"source_types": ["pdf", "csv", "markdown"], "topic_major": "environment"},
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
            "생리장해",
            "광합성",
            "증산",
            "기공",
            "수관",
            "착과",
            "개화",
            "생육",
            "초세",
            "마디",
            "절간",
            "화방",
            "엽면적",
            "장해",
        },
        "search_filters": {"source_types": ["pdf", "markdown"], "topic_major": "physiology"},
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
        "search_filters": {"source_types": ["pdf", "xlsx", "markdown"]},
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
            "레시피",
            "조성",
            "배합",
            "養液",
            "培養液",
            "양액",
            "비료",
            "배액",
            "원수",
            "처방",
            "보정",
            "급액",
        },
        # Nutrient recipes and their conditions also live in reference PDFs.
        # Inferred intent must not turn a workbook's absence into corpus absence.
        # Explicit workbook filters are still honored by _merge_search_filters.
        "search_filters": {"source_types": ["pdf", "xlsx", "markdown"]},
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
            "cultivation",
            "grow",
            "growing",
            "method",
            "work",
            "task",
            "pruning",
            "defoliation",
            "scouting",
            "checklist",
            "operation",
            "labor",
            "재배",
            "재배방법",
            "재배법",
            "재배요령",
            "생육관리",
            "키우기",
            "키우는법",
            "방법",
            "작업",
            "적엽",
            "유인",
            "순치기",
            "점검",
            "체크리스트",
            "수확작업",
        },
        "search_filters": {"source_types": ["pdf", "markdown"]},
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
        "search_filters": {"source_types": ["pdf", "csv", "markdown"]},
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

# These are spelling/translation equivalents of caller words, not the broad
# intent expansions below. Only caller concepts can establish passage relevance.
_CALLER_TERM_VARIANTS = {
    "nutrient": ("nutrient", "nutrient solution", "양액", "배양액", "養液", "培養液"),
    "recipe": ("recipe", "formula", "formulation", "레시피", "조성", "조성비", "조성표", "배합", "배합표", "처방", "組成", "配合", "処方"),
    "vpd": ("vpd", "수증기압차", "증기압차", "수증기압포차", "포차", "飽差", "飽和水蒸気圧差"),
    "stomatal": ("stomatal", "stomata", "기공", "気孔"),
    "transpiration": ("transpiration", "증산", "蒸散"),
    "photosynthesis": ("photosynthesis", "광합성", "光合成"),
    "temperature": ("temperature", "온도", "温度", "気温", "葉温"),
    "humidity": ("humidity", "습도", "湿度"),
    "ventilation": ("ventilation", "환기", "換気"),
    "co2": ("co2", "carbon_dioxide", "이산화탄소", "二酸化炭素", "炭酸ガス"),
    "night": ("night", "nighttime", "야간", "밤", "夜間", "夜温", "暗期"),
    "day": ("day", "daytime", "주간", "낮", "日中", "昼間", "明期"),
    "light": ("light", "광량", "광도", "일사", "광환경", "日射", "光強度", "光環境"),
    "irrigation": ("irrigation", "관수", "潅水", "灌水", "かん水"),
    "root": ("root", "roots", "뿌리", "근권", "根系", "根域", "根圏"),
    "fruit_set": ("fruit_set", "착과", "着果", "着花"),
    "fruit_growth": ("fruit_growth", "과실비대", "과실 비대", "果実肥大"),
    "source_sink": ("source_sink", "source-sink", "소스싱크", "소스 싱크", "ソース", "シンク", "同化産物", "동화산물"),
    "dry_matter": ("dry_matter", "건물생산", "건물 생산", "건물분배", "건물 분배", "乾物生産", "乾物分配"),
    "respiration": ("respiration", "호흡", "呼吸"),
    "condensation": ("condensation", "결로", "結露"),
    "cultivation": ("cultivation", "growing", "재배", "재배방법", "재배법", "재배요령"),
    "method": ("method", "방법", "guide"),
    "management": ("management", "관리"),
    "calcium": ("calcium", "ca", "칼슘"),
    "magnesium": ("magnesium", "mg", "마그네슘"),
    "potassium": ("potassium", "k", "칼륨"),
    "ec": ("ec", "conductivity", "전기전도도"),
    "nitrate": ("nitrate", "no3"),
    "ammonium": ("ammonium", "nh4"),
}
_CALLER_CANONICAL_TERMS = {
    variant: canonical
    for canonical, variants in _CALLER_TERM_VARIANTS.items()
    for variant in variants
}
_GENERIC_CALLER_TERMS = frozenset({
    "cultivation", "method", "management", "greenhouse", "온실", "스마트",
    "manual", "매뉴얼", "crop", "작물", "control", "environment", "환경",
    "농업기술대계", "農業技術大系", "compendium", "agronomy", "기반", "바탕",
    "현재", "지금", "단계", "경계", "조건", "조건을", "정리해줘", "정리해주세요",
})
_CROP_TERMS = frozenset({"tomato", "tomatoes", "cucumber", "cucumbers", "토마토", "오이"})
_QUERY_STOPWORDS = frozenset({
    "a", "an", "the", "is", "are", "was", "were", "be", "to", "of", "in", "on",
    "for", "with", "at", "and", "or", "it", "its", "that", "this", "they", "them",
    "i", "my", "we", "our", "you", "your", "do", "does", "did", "can", "could",
    "should", "would", "what", "how", "why", "when", "then", "so", "about", "if",
    "please", "tell", "explain", "change", "changes", "high", "higher", "low", "lower",
    "그럼", "그러면", "그렇다면", "그건", "그걸", "그때", "그거", "이때", "이", "그",
    "경우", "좀", "더", "왜", "어떻게", "무엇", "뭐야", "뭔가요", "인가요", "알려줘",
    "알려주세요", "설명해줘", "설명해주세요", "대해", "대한", "되나요", "하나요",
    "높으면", "높을", "높은", "낮으면", "낮을", "낮은", "변해", "변하나요", "잘",
    "높아질", "때", "달라지는지", "바탕으로", "기반으로", "해", "원리", "원리와",
    "판단", "판단을", "관계", "관계는", "연결돼", "연결해서",
})

#: Substrings that are re-emitted as standalone tokens when they appear inside a
#: longer word.
#:
#: Korean is agglutinative, so a naturally phrased question never yields the bare
#: keyword: a grower writes "생리장해", "광합성이", "착과율이", not "생리 광합성 착과".
#: ``_detect_intent`` scores by exact set intersection, so without an entry here a
#: profile keyword is unreachable for real questions. Before 2026-07-17 this tuple
#: held 23 terms covering cultivation and pest vocabulary but **none** of the
#: physiology vocabulary, which left ``crop_physiology`` effectively dead: all four
#: of the maintainer's real physiology questions fell through to ``general_chat``.
#:
#: Keep this list ordered coarse-to-fine within a family so that both the compound
#: and its head are emitted (e.g. "생리장해" yields both "생리" and "장해").
_KOREAN_COMPOUND_TERMS = (
    "농업기술대계",
    "오이",
    "토마토",
    "재배방법",
    "재배법",
    "재배요령",
    "생육관리",
    "키우는법",
    "재배",
    "생육",
    "관리",
    "방법",
    "방제",
    "농약",
    "병해충",
    "흰가루병",
    "흰가루",
    "온실가루이",
    "담배가루이",
    "노균병",
    "노균",
    "나방류",
    "약제",
    # Physiology vocabulary. Without these, `crop_physiology` never fires for a
    # naturally phrased Korean question.
    "생리장해",
    "생리",
    "광합성",
    "증산",
    "기공",
    "착과",
    "개화",
    "초세",
    "마디",
    "절간",
    "화방",
    "엽면적",
    "수관",
    "장해",
    "온도",
    "습도",
    "환기",
    "난방",
    "냉방",
    "결로",
    "이산화탄소",
    "수증기압차",
    "증기압차",
    "수증기압포차",
    "포차",
    "야간",
    "밤",
    "주간",
    "낮",
    "양액",
    "레시피",
    "조성",
    "조성비",
    "조성표",
    "배합",
    "배합표",
    "비료",
    "배액",
    "원수",
    "처방",
    "보정",
    "급액",
    "수확",
    "시장",
    "가격",
    "출하",
    "등급",
)


def _normalize_text(value: Any) -> str:
    return re.sub(r"\s+", " ", str(value or "")).strip().lower()


def _normalize_tokens(text: str) -> list[str]:
    tokens: list[str] = []
    seen: set[str] = set()
    normalized_text = _normalize_text(text)

    def add_token(token: str) -> None:
        if token and token not in seen:
            seen.add(token)
            tokens.append(token)

    for token in _TOKEN_PATTERN.findall(normalized_text):
        add_token(token)
        # Preserve VPD/EC/CO2 when a Korean particle follows the Latin symbol.
        for latin_term in re.findall(r"[a-z][a-z0-9_+-]*", token):
            add_token(latin_term)
        for compound in _KOREAN_COMPOUND_TERMS:
            if compound in token:
                add_token(compound)

    compact_text = normalized_text.replace(" ", "")
    for compound in _KOREAN_COMPOUND_TERMS:
        if compound in compact_text:
            add_token(compound)

    for variant in _CALLER_CANONICAL_TERMS:
        if not re.fullmatch(r"[a-z0-9_+-]+", variant) and variant.replace(" ", "") in compact_text:
            add_token(variant)

    return tokens


def _caller_terms(tokens: list[str]) -> list[str]:
    terms: list[str] = []
    for token in tokens:
        if token in _QUERY_STOPWORDS or token in _CROP_TERMS or token.isdigit():
            continue
        # Prefer the extracted keyword over its particle-bearing surface form.
        if any(other != token and other in token for other in tokens if (
            other in _KOREAN_COMPOUND_TERMS or other in _CALLER_CANONICAL_TERMS
        )):
            continue
        canonical = _CALLER_CANONICAL_TERMS.get(token, token)
        if canonical not in terms:
            terms.append(canonical)
    specific = [term for term in terms if term not in _GENERIC_CALLER_TERMS]
    return (specific or terms)[:12]


def caller_term_variants(term: str) -> tuple[str, ...]:
    return _CALLER_TERM_VARIANTS.get(term, (term,))


def caller_relevance_hits(text: str, terms: list[str]) -> int:
    normalized = _normalize_text(text)
    return sum(
        any(
            re.search(r"(?<![a-z0-9])" + re.escape(variant) + r"(?![a-z0-9])", normalized)
            if re.fullmatch(r"[a-z0-9_+-]+", variant)
            else variant in normalized
            for variant in caller_term_variants(term)
        )
        for term in terms
    )


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
    # Inferred topics rank passages; document-level labels must not exclude a
    # matching passage (e.g. VPD physiology inside a management-labelled guide).
    # User-selected topics remain strict filters.
    merged["topic_major"] = explicit_filters.get("topic_major")
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

    best_score = max(scores.values(), default=0)
    if best_score <= 0:
        return "general_chat"
    tied = [intent for intent, score in scores.items() if score == best_score]
    if len(tied) == 1:
        return tied[0]

    # Korean and English both name the subject before its modifiers, so an even
    # keyword count is settled by whichever profile the caller reached first:
    # "마디 증가 속도는 온도에 따라" asks how internodes grow under a temperature
    # driver, not how to steer the climate. Equal positions keep profile order.
    def first_keyword_position(intent: str) -> int:
        keywords = _PROFILE_DEFINITIONS[intent]["keywords"]
        return next(
            (index for index, token in enumerate(tokens) if token in keywords),
            len(tokens),
        )

    return min(tied, key=first_keyword_position)


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

    # Reserve space for the caller's concepts before broad intent expansion or
    # particle-bearing surface forms, especially a condition in a follow-up.
    for term in _caller_terms(tokens):
        add_term(term)
    for token in tokens:
        if token in _QUERY_STOPWORDS or token in _CROP_TERMS:
            continue
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
        # `cycle_recommendation` and `product_recommendation` are structured
        # lookups against the pesticide workbook, so they stay deliberately narrow
        # — prose sources (pdf/markdown) must not dilute a registration answer.
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
            # Symptom/diagnosis questions are prose questions; keep them broad.
            adjusted["search_filters"] = {"source_types": ["pdf", "xlsx", "markdown"]}
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
            boosts["topic_minors"] = ["nutrient_recipe", "recipe"]
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
        "caller_terms": _caller_terms(tokens),
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
        if topic_minor in {"nutrient_recipe", "recipe"}:
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
