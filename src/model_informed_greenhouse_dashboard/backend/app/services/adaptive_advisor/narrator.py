"""LLM narrator for an already-compiled adaptive answer packet."""

from __future__ import annotations

import json
from typing import Any

from ..openai_service import DEFAULT_MODEL, _chat_system_prompt, _generate_text


def build_adaptive_narrative_response(
    *,
    crop: str,
    messages: list[dict[str, str]],
    dashboard: dict[str, Any] | None = None,
    language: str = "ko",
    answer_packet: dict[str, Any] | None = None,
    model: str = DEFAULT_MODEL,
    **_: Any,
) -> dict[str, Any]:
    """Narrate one authoritative packet without re-running retrieval or models."""
    packet = answer_packet or {}
    if not packet:
        raise ValueError("adaptive narration requires an answer_packet")

    if language == "ko":
        contract = (
            "아래 adaptive answer packet만 사용해 농가와 대화하듯 답하세요. "
            "첫 문장에서 현재 판단과 그 수준(확정/조건부/추가 측정 필요)을 직접 말하세요. "
            "이어 원인 후보와 관측 근거, 지금 또는 오늘의 조치, 예상 효과, 판단을 바꿀 신호를 설명하세요. "
            "knowledge.cards는 기작 설명에만 사용하고, packet 밖의 사실을 보태지 마세요. "
            "operator_assumptions는 등록된 운영 사실처럼 쓰지 말고 반드시 조건부 가정임을 밝히세요. "
            "시장 계절 평년선을 미래 가격 예측이라고 부르지 마세요. "
            "packet의 숫자·단위·시간범위는 그대로 사용하고 새 계산·환산·보간·외삽을 하지 마세요. "
            "temporal comparison이 없으면 전일 비교를 했다고 말하지 말고, "
            "admission이나 constraint가 막은 수치는 절대 복구하지 마세요. "
            "내부 노드명, JSON, provenance ID, 참고문헌 목록은 노출하지 마세요."
        )
    else:
        contract = (
            "Use only the adaptive answer packet below. Lead with the decision and whether it is "
            "operational, conditional, or measurement-first. Then explain the ranked driver, observed "
            "signals, what to do now/today, the expected effect, and what would invalidate the answer. "
            "Use knowledge.cards only for mechanism explanation. Treat operator assumptions as conditional, "
            "not registered facts, and never call seasonal market normals a forward price forecast. "
            "Preserve every number, unit, and horizon exactly; do not calculate, convert, interpolate, "
            "or extrapolate. Never claim a temporal comparison that is absent and never restore a "
            "number blocked by admission or constraints. Do not expose JSON, node names, provenance IDs, "
            "or a bibliography."
        )

    input_messages: list[dict[str, str]] = [
        {
            "role": "user",
            "content": (
                f"{contract}\n\n"
                f"Adaptive answer packet:\n{json.dumps(packet, ensure_ascii=False)}"
            ),
        }
    ]
    for message in messages[:-1]:
        role = message.get("role", "user")
        if role not in {"user", "assistant"}:
            role = "user"
        input_messages.append({"role": role, "content": str(message.get("content") or "")})
    input_messages.append({"role": "user", "content": str(packet.get("question") or "")})

    text = _generate_text(
        instructions=_chat_system_prompt(crop, language),
        input_data=input_messages,
        model=model,
    )
    return {"status": "success", "text": text, "source": "adaptive_answer_packet"}
