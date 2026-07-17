"""OpenAI integration for consulting and chat endpoints."""

from __future__ import annotations

import json
import os
import re
from typing import Any, Dict, List, Optional

try:
    from openai import AuthenticationError, OpenAI
except ImportError:  # pragma: no cover - exercised only when optional dependency is absent
    AuthenticationError = None
    OpenAI = None


DEFAULT_MODEL = os.getenv("OPENAI_MODEL", "gpt-5.4-mini")
_OPENAI_API_KEY_CANDIDATES = (
    "OPENAI_API_KEY",
    "SMARTGROW_OPENAI_API_KEY",
    "OPENAI_API_KEY_RUNTIME",
)

_SECTION_ALIASES: dict[str, tuple[str, ...]] = {
    "summary": ("핵심 요약", "요약", "Executive Summary", "Summary"),
    "risks": ("경보 및 위험", "위험", "위험 신호", "Alerts & Risks", "Risks"),
    "actions": (
        "권장 조치",
        "실행 조치",
        "지금 할 일",
        "오늘 할 일",
        "Recommendations",
        "Recommendations (Priority)",
        "Actions Now",
        "Actions Today",
    ),
    "monitor": (
        "모니터링 체크리스트",
        "모니터링",
        "이번 주 모니터링",
        "Monitoring Checklist",
        "Monitoring",
        "Monitor",
    ),
}

_ACTION_SUBSECTION_ALIASES: dict[str, tuple[str, ...]] = {
    "actions_now": ("지금", "즉시", "지금 할 일", "Now", "Immediate", "Actions Now"),
    "actions_today": ("오늘", "이번 교대", "오늘 할 일", "Today", "This shift", "Actions Today"),
}

_SECTION_TITLES = {
    "ko": {
        "summary": "핵심 요약",
        "risks": "위험 신호",
        "actions": "권장 조치",
        "monitor": "모니터링",
    },
    "en": {
        "summary": "Summary",
        "risks": "Risks",
        "actions": "Actions",
        "monitor": "Monitor",
    },
}


def _is_redacted_or_placeholder_key(value: str) -> bool:
    normalized = (value or "").strip()
    if not normalized:
        return True
    lowered = normalized.casefold()
    return (
        "*" in normalized
        or lowered in {"changeme", "replace-me", "your-api-key", "your_openai_api_key"}
    )


def _get_api_key() -> Optional[str]:
    for key_name in _OPENAI_API_KEY_CANDIDATES:
        candidate = os.getenv(key_name)
        if not candidate:
            continue
        normalized = candidate.strip()
        if not normalized:
            continue
        if _is_redacted_or_placeholder_key(normalized):
            continue
        return normalized
    return None


def _client() -> OpenAI:
    if OpenAI is None:
        raise RuntimeError(
            "openai is not installed. Install the optional AI dependency to enable OpenAI endpoints."
        )

    api_key = _get_api_key()
    if not api_key:
        raise RuntimeError(
            "Missing OpenAI API key. Set OPENAI_API_KEY in backend environment."
        )

    try:
        return OpenAI(api_key=api_key)
    except TypeError:  # pragma: no cover - compatibility for patched test doubles
        return OpenAI()


def _generate_text(*, instructions: str, input_data: Any, model: str) -> str:
    try:
        response = _client().responses.create(
            model=model,
            instructions=instructions,
            input=input_data,
        )
    except AuthenticationError as exc:
        raise RuntimeError(
            "Invalid OpenAI API key. Recreate OPENAI_API_KEY from the OpenAI Platform and update the repo-root .env or backend environment."
        ) from exc

    text = getattr(response, "output_text", None)
    if text:
        return text

    raise ValueError("OpenAI response did not include text output.")


def _system_prompt(crop: str, language: str = "ko") -> str:
    """System prompt with crop-specific focus."""
    crop_norm = (crop or "").strip().lower()
    crop_focus_en = ""
    crop_focus_ko = ""

    if crop_norm == "tomato":
        crop_focus_en = (
            "Focus on tomato physiology and management: VPD/transpiration for fruit set, "
            "stomatal conductance & photosynthesis, canopy temperature, generative vs vegetative balance, "
            "active trusses/fruit load/harvest outlook, CO2 & light strategy, and energy/HVAC."
        )
        crop_focus_ko = (
            "토마토 관점에 집중하세요: 착과/비대에 중요한 VPD·증산, 기공전도도·광합성, 캐노피 온도, "
            "생식/영양 균형, 착과(활성 화방/과부하)·수확 전망, CO2/광 전략, 에너지(HVAC)까지 포함."
        )
    elif crop_norm == "cucumber":
        crop_focus_en = (
            "Focus on cucumber physiology and management: node development, pruning/leaf targets, "
            "vegetative vs reproductive balance, VPD/transpiration, canopy temperature, "
            "stomatal conductance & photosynthesis, CO2/light strategy, and energy/HVAC."
        )
        crop_focus_ko = (
            "오이 관점에 집중하세요: 마디수(노드) 발달, 적심/전정·엽수 목표, 영양/생식 균형, "
            "VPD·증산, 캐노피 온도, 기공전도도·광합성, CO2/광 전략, 에너지(HVAC)까지 포함."
        )

    if language.lower().startswith("en"):
        return (
            "You are a senior greenhouse agronomist and energy engineer. "
            "Provide concise, actionable consulting based ONLY on the provided dashboard data. "
            "Do not fabricate missing values; explicitly say 'missing data' when needed. "
            "Write in Markdown with clear headings and bullet points. "
            f"{crop_focus_en}"
        )

    return (
        "당신은 온실 작물 생리/재배(생육, 광합성, 기공, 증산)와 에너지(HVAC)까지 이해하는 시니어 컨설턴트입니다. "
        "아래 대시보드 데이터만 근거로 간결하고 실행 가능한 컨설팅을 제공하세요. "
        "없거나 추정 불가한 값은 임의로 만들지 말고 '추가 데이터 필요'라고 명시하세요. "
        "Markdown으로 제목/소제목/불릿 형태로 정리하세요. "
        f"{crop_focus_ko}"
    )


def _chat_system_prompt(crop: str, language: str = "ko") -> str:
    """Conversational system prompt for chat.

    The register stays conversational — no report cards, no fixed sections — which
    is the point of the natural-conversation chat. What changed on 2026-07-17 is
    that the prompt no longer forbids the *substance* along with the scaffolding.

    The previous version told the model "리포트 구조 쓰지 마세요" and "출처·자료명을
    절대 언급하지 마세요 — 그냥 원래 아는 것처럼 자연스럽게 말하세요", then handed it
    retrieved literature under a header saying never to quote it. Read as a spec,
    that says: do not structure, do not attribute, do not show your work. Weak,
    unquantified answers were the prompt being obeyed.

    Natural and quantitative are not opposites: a real consultant says "1도 올리면
    난방비가 하루 4만원쯤 더 나오고, 마디는 주당 0.07마디쯤 빨라집니다. 다만 이건
    ±1.5도 범위에서만 맞는 계산이에요" — conversationally, with numbers, with a
    validity range, without a report card.
    """
    crop_norm = (crop or "").strip().lower()
    if crop_norm == "tomato":
        focus_ko = "토마토는 착과·비대, VPD·증산, 광합성·기공, 생식/영양 균형, 수확 전망, CO2·광, 에너지를 함께 봅니다."
        focus_en = "For tomato, keep fruit set/sizing, VPD/transpiration, photosynthesis, generative/vegetative balance, harvest outlook, CO2/light, and energy in view."
    elif crop_norm == "cucumber":
        focus_ko = "오이는 마디 발달, 적심·엽수, 영양/생식 균형, VPD·증산, 광합성·기공, CO2·광, 에너지를 함께 봅니다."
        focus_en = "For cucumber, keep node development, pruning/leaf targets, vegetative/generative balance, VPD/transpiration, photosynthesis, CO2/light, and energy in view."
    else:
        focus_ko = ""
        focus_en = ""

    if language.lower().startswith("en"):
        return (
            "You are a senior protected-horticulture consultant talking with a grower. "
            "Answer directly and conversationally, like a real chat — no report structure, "
            "no headings, no fixed sections. Write in short, natural paragraphs; use a brief "
            "list only when it genuinely helps.\n\n"
            "Be a specialist, not a reassurer:\n"
            "- When you give a number, give its unit and the range it is valid over. "
            "\"Cost will rise somewhat\" is a failure; \"about ₩40,000/day more, and that "
            "figure only holds within ±1.5°C of where you are now\" is the job.\n"
            "- Use the model calculations you are given as the source of any number. Never "
            "compute, adjust, rescale, or round a number into a different one, and never "
            "supply a number that was not given to you.\n"
            "- If a calculation is flagged as unreliable or out of range, say so plainly and "
            "do not give the number anyway.\n"
            "- You may refer to the background knowledge naturally, the way a consultant "
            "cites what they read (\"the RDA guide puts it around ...\"). Do not invent a "
            "source, and do not attach reference numbers or a citation list.\n"
            "- If you do not know, or nothing in the context supports an answer, say so. An "
            "honest \"I'd need to measure X first\" beats a fluent guess.\n"
            f"{focus_en}"
        )

    return (
        "당신은 농가와 대화하는 시니어 시설원예 컨설턴트입니다. "
        "질문에 곧바로, 대화하듯 자연스럽게 답하세요 — 리포트 구조나 제목·소제목·고정된 항목 나열은 쓰지 마세요. "
        "짧고 자연스러운 문단으로 말하고, 목록은 정말 도움이 될 때만 간단히 쓰세요.\n\n"
        "안심시키는 사람이 아니라 전문가로 답하세요:\n"
        "- 숫자를 말할 때는 반드시 단위와 그 숫자가 유효한 범위를 함께 말하세요. "
        "'비용이 다소 증가합니다'는 실패한 답변이고, '하루 4만원쯤 더 나오는데 이건 지금 온도에서 ±1.5도 안에서만 "
        "맞는 계산이에요'가 제대로 된 답변입니다.\n"
        "- 모든 숫자는 제공된 모델 계산에서만 가져오세요. 직접 계산하거나 환산·반올림해서 다른 숫자로 바꾸지 말고, "
        "주어지지 않은 숫자는 절대 만들어내지 마세요.\n"
        "- 계산이 '신뢰할 수 없음' 또는 '범위 밖'으로 표시돼 있으면 그 사실을 그대로 말하고, 숫자는 말하지 마세요.\n"
        "- 배경 지식은 컨설턴트가 읽은 것을 인용하듯 자연스럽게 언급해도 됩니다('농업기술길잡이 기준으로는 대략 ...'). "
        "다만 없는 출처를 지어내지 말고, 자료 번호나 참고문헌 목록은 붙이지 마세요.\n"
        "- 모르면 모른다고 하세요. 맥락에 근거가 없으면 '먼저 ○○를 재봐야 알겠다'가 유창한 추측보다 낫습니다.\n"
        f"{focus_ko}"
    )


#: How many retrieved excerpts reach the model. The retrieval layer caps the count
#: (`advisor_context_builder._MAX_CHAT_RESULTS`); this is the belt-and-braces bound
#: for callers that assemble a dashboard by hand.
_MAX_GROUNDING_CARDS = 6


def _evidence_cards(dashboard: Any) -> list[Any]:
    """Retrieved evidence cards, or an empty list when retrieval produced none."""
    knowledge = dashboard.get("knowledge") if isinstance(dashboard, dict) else None
    retrieval = (
        knowledge.get("advisor_retrieval_context") if isinstance(knowledge, dict) else None
    )
    cards = retrieval.get("evidence_cards") if isinstance(retrieval, dict) else None
    return list(cards) if isinstance(cards, list) else []


def _dashboard_without_evidence_cards(dashboard: Dict[str, Any]) -> Dict[str, Any]:
    """Copy of the dashboard with the retrieved excerpts removed.

    The excerpts are carried by `_chat_grounding_block`. Leaving them in the JSON
    dump as well sent every excerpt to the model twice — pure token cost with no
    added grounding. The retrieval *status* is kept so the model can still tell a
    grounded answer from an ungrounded one.
    """
    if not isinstance(dashboard, dict):
        return {}
    knowledge = dashboard.get("knowledge")
    if not isinstance(knowledge, dict):
        return dict(dashboard)
    retrieval = knowledge.get("advisor_retrieval_context")
    if not isinstance(retrieval, dict):
        return dict(dashboard)

    trimmed_retrieval = {
        key: value for key, value in retrieval.items() if key != "evidence_cards"
    }
    trimmed_retrieval["evidence_cards_omitted"] = (
        "inlined above as the evidence block; omitted here to avoid duplicate transmission"
    )
    trimmed_knowledge = dict(knowledge)
    trimmed_knowledge["advisor_retrieval_context"] = trimmed_retrieval
    trimmed = dict(dashboard)
    trimmed["knowledge"] = trimmed_knowledge
    return trimmed


def _chat_grounding_block(dashboard: Dict[str, Any], language: str) -> str:
    """Inline the retrieved manual/compendium excerpts as the reply's evidence.

    This block is the *only* place the excerpts are serialized: `generate_chat_reply`
    strips them out of the dashboard JSON so the same text is not transmitted twice.
    """
    cards = _evidence_cards(dashboard)
    if not cards:
        # No evidence must be visible as no evidence, not silently identical to a
        # grounded answer. Surface the grounding decision so the reply can say it
        # is speaking from general knowledge rather than the local references.
        knowledge = dashboard.get("knowledge") if isinstance(dashboard, dict) else None
        decision = (
            str(knowledge.get("grounding_decision") or "")
            if isinstance(knowledge, dict)
            else ""
        )
        if decision and decision != "GROUNDED":
            if language.lower().startswith("en"):
                return (
                    f"Retrieval status: {decision}. No local reference supports this "
                    "question. Answer from general knowledge and say so plainly; do not "
                    "imply you consulted the references.\n\n"
                )
            return (
                f"검색 상태: {decision}. 이 질문을 뒷받침하는 로컬 문헌이 없습니다. "
                "일반 지식으로 답하되 그렇다고 밝히고, 문헌을 참고한 것처럼 말하지 마세요.\n\n"
            )
        return ""

    excerpts = []
    for card in cards[:_MAX_GROUNDING_CARDS]:
        excerpt = str((card or {}).get("evidence_excerpt") or "").strip()
        if not excerpt:
            continue
        topic = str((card or {}).get("topic_major") or "").strip()
        excerpts.append(f"- [{topic}] {excerpt}" if topic else f"- {excerpt}")
    if not excerpts:
        return ""

    body = "\n".join(excerpts)
    if language.lower().startswith("en"):
        return (
            "Evidence retrieved from the local agronomy references for this question. "
            "Ground your answer in it, and refer to it naturally the way a consultant "
            "cites what they read. Do not invent sources, and do not add reference "
            "numbers or a citation list. If it does not answer the question, say so "
            "rather than filling the gap:\n"
            f"{body}\n\n"
        )
    return (
        "이 질문에 대해 로컬 농업 문헌에서 검색된 근거입니다. 답변을 여기에 근거해 작성하고, "
        "컨설턴트가 읽은 것을 인용하듯 자연스럽게 언급하세요. 없는 출처를 지어내지 말고 "
        "자료 번호나 참고문헌 목록은 붙이지 마세요. 이 근거가 질문에 답하지 못하면 "
        "빈틈을 메우지 말고 모른다고 하세요:\n"
        f"{body}\n\n"
    )


def _knowledge_context_block(dashboard: Dict[str, Any]) -> str:
    knowledge = dashboard.get("knowledge") if isinstance(dashboard, dict) else None
    if not knowledge:
        return ""

    return (
        "Knowledge context when present:\n"
        "- `knowledge` summarizes the local tomato/cucumber agronomy corpus that lives under the repository data/ directory.\n"
        "- Use it as crop-specific background context, but do not claim that deterministic pesticide, nutrient, or environment engines are already complete unless the dashboard payload explicitly includes their outputs.\n"
        "- Do not expose raw provenance identifiers in the user-facing answer.\n"
        f"- Knowledge JSON:\n{json.dumps(knowledge, ensure_ascii=False)}\n\n"
    )


def _consult_markdown_template(crop: str, language: str = "ko") -> str:
    crop_norm = (crop or "").strip().lower()
    if crop_norm == "tomato":
        crop_block_en = "- Active trusses: ...\n" "- Harvest outlook: ...\n"
        crop_block_ko = (
            "- Active trusses(활성 화방): ...\n" "- Harvest outlook(수확 전망): ...\n"
        )
    elif crop_norm == "cucumber":
        crop_block_en = "- Node count: ...\n" "- Pruning / target leaf count: ...\n"
        crop_block_ko = (
            "- 마디수: ...\n"
            "- 전정 / 목표 엽수: ...\n"
        )
    else:
        crop_block_en = "- Crop-specific: ...\n"
        crop_block_ko = "- Crop-specific: ...\n"

    if language.lower().startswith("en"):
        return (
            "## Executive Summary\n"
            "- ...\n\n"
            "## Situation (Last 60 points summary)\n"
            "### Environment\n"
            "- Temperature (°C): ...\n"
            "- RH (%): ...\n"
            "- CO2 (ppm): ...\n"
            "- PAR (µmol m⁻² s⁻¹): ...\n"
            "- VPD (kPa): ...\n\n"
            "### Plant Physiology\n"
            "- Photosynthesis (µmol m⁻² s⁻¹): ...\n"
            "- Stomatal conductance (mol m⁻² s⁻¹): ...\n"
            "- Transpiration (mm/h): ...\n"
            "- Energy balance (H/LE, W/m²): ...\n\n"
            "### Growth / Yield\n"
            "- LAI: ...\n"
            "- Biomass (g/m²): ...\n"
            f"{crop_block_en}\n"
            "## Alerts & Risks\n"
            "- **High**: ...\n"
            "- **Medium**: ...\n"
            "- **Low**: ...\n\n"
            "## Recommendations (Priority)\n"
            "### Now\n"
            "- ...\n\n"
            "### Today\n"
            "- ...\n\n"
            "## Monitoring Checklist (Next 24h)\n"
            "- ...\n"
        )

    return (
        "## 핵심 요약\n"
        "- ...\n\n"
        "## 현재 상태 (최근 60포인트 요약)\n"
        "### 환경\n"
        "- 기온 (°C): ...\n"
        "- 상대습도 (%): ...\n"
        "- CO2 (ppm): ...\n"
        "- 광량 (µmol m⁻² s⁻¹): ...\n"
        "- VPD (kPa): ...\n\n"
        "### 작물 생리\n"
        "- 광합성 (µmol m⁻² s⁻¹): ...\n"
        "- 기공전도도 (mol m⁻² s⁻¹): ...\n"
        "- 증산 (mm/h): ...\n"
        "- 에너지 균형 (H/LE, W/m²): ...\n\n"
        "### 생육 / 수확\n"
        "- LAI: ...\n"
        "- 바이오매스 (g/m²): ...\n"
        f"{crop_block_ko}\n"
        "## 경보 및 위험\n"
        "- ...\n\n"
        "## 권장 조치\n"
        "### 지금\n"
        "- ...\n\n"
        "### 오늘\n"
        "- ...\n\n"
        "## 모니터링 체크리스트 (24시간)\n"
        "- ...\n"
    )


def _normalize_heading(value: str) -> str:
    return re.sub(r"\s+", " ", value.strip()).casefold()


def _matches_heading(value: str, aliases: tuple[str, ...]) -> bool:
    normalized = _normalize_heading(value)
    return any(
        normalized == _normalize_heading(alias)
        or normalized.startswith(f"{_normalize_heading(alias)} ")
        or normalized.startswith(f"{_normalize_heading(alias)}(")
        for alias in aliases
    )


def _extract_markdown_sections(markdown: str) -> dict[str, str]:
    normalized = (markdown or "").replace("\r\n", "\n").strip()
    if not normalized:
        return {}

    heading_matches = list(re.finditer(r"^##\s+(.+)$", normalized, re.MULTILINE))
    if not heading_matches:
        return {}

    sections: dict[str, str] = {}
    for index, match in enumerate(heading_matches):
        heading = (match.group(1) or "").strip()
        start = match.end()
        end = heading_matches[index + 1].start() if index + 1 < len(heading_matches) else len(normalized)
        body = normalized[start:end].strip()
        if not body:
            continue
        for key, aliases in _SECTION_ALIASES.items():
            if _matches_heading(heading, aliases):
                sections[key] = body
                break

    return sections


def _extract_markdown_bullets(body: str) -> list[str]:
    items: list[str] = []
    for raw_line in (body or "").splitlines():
        line = raw_line.strip()
        if not line:
            continue
        if re.match(r"^([-*]|\d+\.)\s+", line):
            items.append(re.sub(r"^([-*]|\d+\.)\s+", "", line).strip())
    return items


def _extract_action_groups(body: str) -> tuple[list[str], list[str]]:
    normalized = (body or "").replace("\r\n", "\n").strip()
    if not normalized:
        return [], []

    subheading_matches = list(re.finditer(r"^###\s+(.+)$", normalized, re.MULTILINE))
    if not subheading_matches:
        bullets = _extract_markdown_bullets(normalized)
        return bullets[:2], bullets[2:]

    action_groups: dict[str, list[str]] = {"actions_now": [], "actions_today": []}
    for index, match in enumerate(subheading_matches):
        heading = (match.group(1) or "").strip()
        start = match.end()
        end = subheading_matches[index + 1].start() if index + 1 < len(subheading_matches) else len(normalized)
        block = normalized[start:end].strip()
        bullets = _extract_markdown_bullets(block)
        if not bullets:
            continue
        for key, aliases in _ACTION_SUBSECTION_ALIASES.items():
            if _matches_heading(heading, aliases):
                action_groups[key].extend(bullets)
                break

    if action_groups["actions_now"] or action_groups["actions_today"]:
        return action_groups["actions_now"], action_groups["actions_today"]

    bullets = _extract_markdown_bullets(normalized)
    return bullets[:2], bullets[2:]


def _extract_summary_text(body: str) -> str:
    bullets = _extract_markdown_bullets(body)
    if bullets:
        return bullets[0]

    for line in body.splitlines():
        normalized = line.strip()
        if normalized:
            return normalized

    return ""


def build_advisory_display_payload(
    markdown: str,
    *,
    language: str = "ko",
    confidence: float | None = None,
) -> dict[str, Any]:
    locale = "ko" if not language.lower().startswith("en") else "en"
    sections = _extract_markdown_sections(markdown)
    fallback_text = (markdown or "").replace("\r\n", "\n").strip()
    summary_body = sections.get("summary", fallback_text)
    actions_body = sections.get("actions", "")
    actions_now, actions_today = _extract_action_groups(actions_body)

    payload = {
        "language": locale,
        "summary": _extract_summary_text(summary_body),
        "risks": _extract_markdown_bullets(sections.get("risks", "")),
        "actions_now": actions_now,
        "actions_today": actions_today,
        "actions_week": [],
        "monitor": _extract_markdown_bullets(sections.get("monitor", "")),
        "confidence": confidence,
        "sections": [
            {
                "key": key,
                "title": _SECTION_TITLES[locale].get(key, key),
                "body": body,
            }
            for key, body in sections.items()
        ],
    }

    return payload


def generate_consulting(
    *,
    crop: str,
    dashboard: Dict[str, Any],
    language: str = "ko",
    model: str = DEFAULT_MODEL,
) -> str:
    """Generate consulting text based on the current dashboard snapshot."""
    knowledge_block = _knowledge_context_block(dashboard)
    priority_heading_rule = (
        "- If weather or rtr fields are present, explicitly mention them in Executive Summary and Recommendations.\n"
        if language.lower().startswith("en")
        else "- weather 또는 rtr 필드가 있으면 핵심 요약과 권장 조치에 반드시 반영하세요.\n"
    )
    prompt = (
        f"Crop: {crop}\n"
        "Units & key mapping (dashboard JSON):\n"
        "- data.temperature: air temperature (°C)\n"
        "- data.canopyTemp: canopy temperature (°C)\n"
        "- data.humidity: RH (%)\n"
        "- data.co2: CO2 (ppm)\n"
        "- data.light: PAR (µmol m⁻² s⁻¹)\n"
        "- data.vpd: VPD (kPa)\n"
        "- data.transpiration: transpiration (mm/h)\n"
        "- data.stomatalConductance: stomatal conductance (mol m⁻² s⁻¹)\n"
        "- data.photosynthesis: gross photosynthesis (µmol m⁻² s⁻¹)\n"
        "- data.hFlux / data.leFlux: sensible/latent heat flux (W/m²)\n"
        "- data.energyUsage: electrical power (kW)\n"
        "- metrics.growth.lai: LAI\n"
        "- metrics.growth.biomass: biomass (g/m²)\n"
        "- metrics.energy.consumption: electrical power (kW)\n\n"
        "Required live context when present:\n"
        "- weather.current.temperature_c / humidity / cloud / wind plus next 3 daily forecasts for the live Daegu outside outlook\n"
        "- rtr.profile.* for the calibrated RTR line metadata\n"
        "- rtr.live.targetTempC / deltaTempC / balanceState / radiationSumMjM2D / averageTempC for the current 24 h balance\n"
        "- rtr.forecastTargets[*].targetTempC / radiationSumMjM2D for the next 3 days\n"
        "- knowledge.* for crop-scoped local corpus availability and workbook/manual scope\n\n"
        "Structured runtime recommendation contract when present:\n"
        "- model_runtime.answer_focus / recommendation_families / best_actions / control_precision_matrix / operator_view / tradeoff_summary\n"
        "- If model_runtime.answer_focus is present, start from those exact calculated effects before giving general advice.\n"
        "- For what-if questions, explain why the requested delta changes yield, canopy assimilation, source/sink balance, energy, and risk. Do not merely repeat that it is recommended.\n"
        "- Use only the provided numbers. Do not invent missing values.\n"
        "- Explain the strongest option, a stronger step, and a conservative step when the precision matrix supports it.\n"
        "- Do not expose internal terms like partial derivative, elasticity, or trust region in the visible answer.\n\n"
        f"{knowledge_block}"
        "Priority rules:\n"
        f"{priority_heading_rule}"
        "- Use weather and rtr as the primary live steering context when present.\n"
        "- If knowledge is present, use it as crop-specific agronomy background without pretending that unimplemented deterministic engines already produced outputs.\n"
        "- Use recentSummary as supporting evidence, not as the primary signal, when weather/rtr are available.\n\n"
        "The dashboard JSON includes a compact `recentSummary` (last ~60 points) with "
        "trend/step-change stats to avoid sending raw arrays.\n\n"
        f"Dashboard JSON:\n{json.dumps(dashboard, ensure_ascii=False)}\n\n"
        "Output rules:\n"
        "- Return ONLY Markdown (no surrounding code fences).\n"
        "- Follow EXACTLY the section structure of the template below.\n"
        "- When you cite numbers, include units and indicate whether it is mean/min/max/last when relevant.\n"
        "- If a required metric is missing, write '추가 데이터 필요' (or 'missing data').\n\n"
        "Markdown template:\n"
        f"{_consult_markdown_template(crop, language)}\n"
    )

    return _generate_text(
        instructions=_system_prompt(crop, language),
        input_data=prompt,
        model=model,
    )


def generate_chat_reply(
    *,
    crop: str,
    messages: List[Dict[str, str]],
    dashboard: Optional[Dict[str, Any]] = None,
    language: str = "ko",
    model: str = DEFAULT_MODEL,
) -> str:
    """Generate a natural-conversation chat reply. The live dashboard, retrieved
    background knowledge, and model calculations are provided as private context;
    the reply must read like ordinary conversation and never cite any of it."""
    ctx = dashboard or {}
    grounding_block = _chat_grounding_block(ctx, language)
    # The excerpts live in `grounding_block`; strip them from the JSON so the same
    # text is not transmitted twice.
    ctx_json = _dashboard_without_evidence_cards(ctx)
    if language.lower().startswith("en"):
        context_intro = (
            "The following is context for your answer — the current greenhouse readings and "
            "the model's calculations. It is working material, not something to read out: "
            "do not dump the JSON back at the grower.\n\n"
            "Reading the numbers: currentData holds live readings "
            "(temperature °C, humidity %, co2 ppm, light PAR, vpd kPa, transpiration mm/h, "
            "stomatalConductance mol m⁻² s⁻¹, photosynthesis µmol m⁻² s⁻¹, energyUsage kW); "
            "weather is the live Daegu outlook; rtr is the temperature-strategy state; "
            "model_runtime holds the calculated what-if effects.\n\n"
            "Every number in your reply must come from here verbatim. Do not recompute, "
            "rescale, or interpolate — in particular, never extrapolate a small step to a "
            "larger one the model was not asked about. If a value is missing or flagged "
            "unreliable, say so instead of estimating it.\n\n"
        )
    else:
        context_intro = (
            "아래는 답변에 쓸 컨텍스트입니다 — 현재 온실 계측값과 모델 계산 결과입니다. "
            "작업용 자료이지 읽어줄 내용이 아니니, JSON을 그대로 농가에게 늘어놓지 마세요.\n\n"
            "수치 읽는 법: currentData는 실시간 계측값입니다 "
            "(temperature ℃, humidity %, co2 ppm, light 광량, vpd kPa, transpiration mm/h, "
            "stomatalConductance mol m⁻² s⁻¹, photosynthesis µmol m⁻² s⁻¹, energyUsage kW). "
            "weather는 대구 외기, rtr는 온도 전략 상태, model_runtime은 계산된 what-if 효과입니다.\n\n"
            "답변에 등장하는 모든 숫자는 여기에서 그대로 가져와야 합니다. 직접 다시 계산하거나 "
            "환산·보간하지 마세요 — 특히 작은 변화량의 계산 결과를 모델이 계산하지 않은 큰 변화량으로 "
            "외삽하지 마세요. 값이 없거나 신뢰할 수 없다고 표시돼 있으면 추정하지 말고 그렇다고 말하세요.\n\n"
        )

    input_messages: List[Dict[str, str]] = [
        {
            "role": "user",
            "content": (
                f"{context_intro}"
                f"{grounding_block}"
                f"작물: {crop}\n"
                f"참고 정보(JSON):\n{json.dumps(ctx_json, ensure_ascii=False)}"
            ),
        }
    ]

    for message in messages:
        role = message.get("role", "user")
        if role not in {"user", "assistant"}:
            role = "user"
        input_messages.append(
            {
                "role": role,
                "content": message.get("content", ""),
            }
        )

    return _generate_text(
        instructions=_chat_system_prompt(crop, language),
        input_data=input_messages,
        model=model,
    )
