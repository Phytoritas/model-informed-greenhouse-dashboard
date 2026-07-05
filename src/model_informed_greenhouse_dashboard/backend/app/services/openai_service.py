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
    """Conversational system prompt for chat: natural dialogue, no report
    scaffolding, and never cite sources."""
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
            "You are an experienced greenhouse grower talking with a farmer. "
            "Answer the question directly and conversationally, like a real chat — "
            "no report structure, no headings, no fixed sections. Write in short, natural "
            "paragraphs; use a brief list only when it genuinely helps. "
            "Draw on the background knowledge and model calculations you are given, but "
            "NEVER mention sources, references, documents, data numbers, or that you consulted "
            "anything — just speak as someone who knows. Do not fabricate missing measurements; "
            "if something is unknown, say so plainly. "
            f"{focus_en}"
        )

    return (
        "당신은 농가와 편하게 대화하는 노련한 온실 재배 전문가입니다. "
        "질문에 곧바로, 대화하듯 자연스럽게 답하세요 — 리포트 구조나 제목·소제목·고정된 항목 나열은 쓰지 마세요. "
        "짧고 자연스러운 문단으로 말하고, 목록은 정말 도움이 될 때만 간단히 쓰세요. "
        "제공된 배경 지식과 모델 계산을 활용하되, '참고 자료', '출처', 문서·자료 이름, 자료 번호, 근거를 찾아봤다는 표현을 "
        "답변에 절대 언급하지 마세요 — 그냥 원래 아는 것처럼 자연스럽게 말하세요. "
        "없는 값을 지어내지 말고, 모르는 것은 솔직히 모른다고 하세요. "
        f"{focus_ko}"
    )


def _chat_grounding_block(dashboard: Dict[str, Any], language: str) -> str:
    """Inline the retrieved wiki/manual excerpts as background knowledge, with a
    hard rule never to surface them as citations."""
    knowledge = dashboard.get("knowledge") if isinstance(dashboard, dict) else None
    retrieval = (knowledge or {}).get("advisor_retrieval_context") if isinstance(knowledge, dict) else None
    cards = (retrieval or {}).get("evidence_cards") if isinstance(retrieval, dict) else None
    if not cards:
        return ""

    excerpts = []
    for card in cards[:5]:
        excerpt = str((card or {}).get("evidence_excerpt") or "").strip()
        if excerpt:
            excerpts.append(f"- {excerpt}")
    if not excerpts:
        return ""

    body = "\n".join(excerpts)
    if language.lower().startswith("en"):
        return (
            "Background knowledge you may draw on (do NOT quote, cite, or name any of it in your reply):\n"
            f"{body}\n\n"
        )
    return (
        "답변에 활용할 배경 지식입니다 (이 내용을 인용하거나 출처·자료명을 답변에 절대 쓰지 마세요):\n"
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
    if language.lower().startswith("en"):
        context_intro = (
            "The following is PRIVATE context to help you answer — the current greenhouse "
            "readings, background knowledge, and model calculations. Use it to inform your "
            "answer, but never quote it, cite it, name a source, or say you looked anything up.\n\n"
            "Reading the numbers: currentData holds live readings "
            "(temperature °C, humidity %, co2 ppm, light PAR, vpd kPa, transpiration mm/h, "
            "stomatalConductance mol m⁻² s⁻¹, photosynthesis µmol m⁻² s⁻¹, energyUsage kW); "
            "weather is the live Daegu outlook; rtr is the temperature-strategy state; "
            "model_runtime holds calculated what-if effects — lean on those effects for "
            "what-if questions and explain the change in plain language. "
            "Use only the numbers given; do not invent missing ones.\n\n"
        )
    else:
        context_intro = (
            "아래는 답변을 돕기 위한 비공개 참고 정보입니다 — 현재 온실 계측값, 배경 지식, 모델 계산 결과입니다. "
            "이 정보를 바탕으로 답하되, 인용하거나 출처·자료명을 말하거나 뭔가 찾아봤다는 티를 내지 마세요.\n\n"
            "수치 읽는 법: currentData는 실시간 계측값입니다 "
            "(temperature ℃, humidity %, co2 ppm, light 광량, vpd kPa, transpiration mm/h, "
            "stomatalConductance mol m⁻² s⁻¹, photosynthesis µmol m⁻² s⁻¹, energyUsage kW). "
            "weather는 대구 외기, rtr는 온도 전략 상태, model_runtime은 계산된 what-if 효과입니다 — "
            "'~하면 어떻게 되나' 류 질문은 이 계산 효과를 근거로 쉬운 말로 설명하세요. "
            "주어진 수치만 쓰고 없는 값은 지어내지 마세요.\n\n"
        )

    input_messages: List[Dict[str, str]] = [
        {
            "role": "user",
            "content": (
                f"{context_intro}"
                f"{grounding_block}"
                f"작물: {crop}\n"
                f"참고 정보(JSON):\n{json.dumps(ctx, ensure_ascii=False)}"
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
