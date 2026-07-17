"""Pesticide safety gate: refuse legally-binding numbers the local data cannot support.

Korean pesticide safe-use standards (안전사용기준: 수확 전 사용일수/PHI, 사용 횟수, 희석배수)
are legally binding. 농약관리법 제23조 requires growers to follow them and prohibits
recommending use that deviates from them. So a wrong PHI is not a quality defect, it is a
legal one.

The local ``pesticide_products`` table has **no PHI column and no application-count column**
(product_id, crop_scope, category, product_name, active_ingredient, moa_code_group,
registration_status, dilution, cycle_recommendation, mixing_caution, …). The safe-use
standard survives only as free text inside ``cycle_recommendation``, and even there it
defers ("제형에 따라 수확전일수·횟수 …"). The system therefore **cannot** return a correct PHI,
and an LLM parsing it out of prose — or inventing it from memory — is exactly the failure to
prevent.

This module decides when a pesticide question is asking for a legally-consequential number
the data cannot supply, and provides the refusal + authoritative pointer. What the schema
*does* support (MoA/resistance-group rotation, tank-mix cautions, registration status) stays
answerable.

Authoritative source: RDA 농약안전정보시스템 (PSIS), which publishes 안전사용기준 via public
OpenAPI on data.go.kr. A live gateway is a separate, credentialed integration; until it
exists the safe behaviour is to refuse the number and point there.

Reference: docs/research/20260717-advisor-answer-quality-architecture/improvement_spec.md
"""

from __future__ import annotations

import re
from typing import Any, Mapping


#: The authoritative Korean registry for safe-use standards.
PSIS_URL = "https://psis.rda.go.kr/"
PSIS_OPENAPI_REGISTRATION = "https://www.data.go.kr/data/15057994/openapi.do"
PSIS_OPENAPI_SAFE_USE = "https://www.data.go.kr/data/15059306/openapi.do"

#: Question patterns that ask for a legally-binding number the schema cannot supply.
#: Korean + a little English; matched case-insensitively against the raw question.
_PHI_QUESTION_PATTERNS = (
    r"수확\s*전\s*(?:며칠|사용\s*일수|일수)",
    r"수확\s*(?:몇\s*일\s*전|얼마\s*전)",
    r"안전\s*사용\s*기준",
    r"사용\s*횟수",
    r"몇\s*번\s*(?:까지)?\s*(?:칠|뿌|살포|사용)",
    r"희석\s*(?:배수|비율|농도)",
    r"\bphi\b",
    r"pre[-\s]?harvest",
)

#: Sub-topics the local schema genuinely supports.
_SUPPORTED_TOPICS = {
    "rotation": ("moa_code_group",),
    "mixing": ("mixing_caution",),
    "registration": ("registration_status",),
}


def asks_for_safe_use_number(question: str) -> bool:
    """Whether the question asks for a PHI / application-count / dilution figure."""
    text = (question or "").lower()
    return any(re.search(pattern, text) for pattern in _PHI_QUESTION_PATTERNS)


def authoritative_answer_or_refusal(
    *,
    crop: str,
    product_or_ingredient: str,
    target_pest: str | None = None,
    now_iso: str | None = None,
    language: str = "ko",
) -> dict[str, Any]:
    """Return an authoritative PHI answer if the PSIS gateway can supply one.

    Fail-closed: without a configured gateway, or on any lookup that does not yield a
    verified PHI, this returns the refusal. A number is only ever surfaced when it
    came from the authoritative registry — never from the local free text or a guess.
    """
    from .psis_gateway import fetch_safe_use_standard, is_configured

    if not is_configured():
        return safe_use_refusal(language=language)

    standard = fetch_safe_use_standard(
        crop=crop,
        product_or_ingredient=product_or_ingredient,
        target_pest=target_pest,
        now_iso=now_iso,
    )
    if not standard.is_authoritative:
        refusal = safe_use_refusal(language=language)
        refusal["lookup"] = standard.to_dict()
        return refusal

    return {
        "status": "authoritative_safe_use_standard",
        "standard": standard.to_dict(),
        "authoritative_sources": {"registry": PSIS_URL},
    }


def safe_use_refusal(*, language: str = "ko") -> dict[str, Any]:
    """The refusal payload for a safe-use-number question.

    An advisory system owes the grower the authoritative source when its own data
    cannot answer, not a best-effort guess.
    """
    if language.lower().startswith("en"):
        message = (
            "I can't give a safe-use figure (pre-harvest interval, application count, or "
            "dilution) from the local data — it does not carry those fields, and they are "
            "legally binding, so a guess is not acceptable. Check the exact product label "
            "and the RDA pesticide safe-use registry (PSIS) at "
            f"{PSIS_URL}. I can still help with resistance-group rotation, tank-mix "
            "cautions, and registration status."
        )
    else:
        message = (
            "안전사용기준(수확 전 사용일수·사용 횟수·희석배수)은 로컬 데이터에 해당 항목이 없어 "
            "정확히 알려드릴 수 없습니다. 이 값들은 법적 기준이라 추측으로 답하면 안 됩니다. "
            f"제품 라벨과 농촌진흥청 농약안전정보시스템(PSIS, {PSIS_URL})에서 정확한 값을 확인하세요. "
            "대신 교호방제(계통 로테이션), 혼용 주의, 등록 상태는 도와드릴 수 있습니다."
        )
    return {
        "status": "refused_safe_use_standard",
        "reason": "local schema has no PHI/application-count/dilution field; the figure is "
        "legally binding and must come from the authoritative registry",
        "authoritative_sources": {
            "registry": PSIS_URL,
            "openapi_registration": PSIS_OPENAPI_REGISTRATION,
            "openapi_safe_use": PSIS_OPENAPI_SAFE_USE,
        },
        "supported_topics": sorted(_SUPPORTED_TOPICS),
        "message": message,
    }


def schema_supports(topic: str, columns: Mapping[str, Any] | None = None) -> bool:
    """Whether the pesticide schema can answer a given sub-topic.

    `columns` may be a row mapping; when omitted, the check is against the known
    column set the ingest defines.
    """
    required = _SUPPORTED_TOPICS.get(topic)
    if not required:
        return False
    if columns is None:
        return True
    return all(col in columns for col in required)
