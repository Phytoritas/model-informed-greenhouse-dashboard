"""Deterministic rendering of admitted facts.

The composer owns every number and every unit. The LLM's job downstream is to
narrate the sentence this produces, not to compute, adjust, or invent a figure. An
inadmissible fact renders as an explicit refusal, never as a nearby number dressed up
as the answer.

This is the render half of the admission contract in :mod:`answer_admission`: because an
inadmissible :class:`AnswerFact` carries no value, the "confident wrong number" path is
not reachable from here — there is no number to print.
"""

from __future__ import annotations

from typing import Any, Iterable, Mapping

from .answer_admission import AdmissionStatus, AnswerFact, admit_rtr_sensitivity_row


def _format_value(value: float, unit: str | None) -> str:
    # Currency reads better as an integer; physiology rates need decimals.
    if unit and "KRW" in unit:
        magnitude = f"{value:,.0f}" if abs(value) >= 1 else f"{value:.4f}"
    elif abs(value) >= 100:
        magnitude = f"{value:,.1f}"
    else:
        magnitude = f"{value:.4f}".rstrip("0").rstrip(".")
    return f"{magnitude} {unit}".strip() if unit else magnitude


def _validity_phrase(fact: AnswerFact) -> str:
    validity = fact.validity or {}
    low = validity.get("low")
    high = validity.get("high")
    if low is None or high is None:
        return ""
    return f" (유효 범위 {low:g}~{high:g})"


def _provenance_phrase(fact: AnswerFact) -> str:
    provenance = fact.provenance or {}
    unit = str(fact.unit or "")
    parts: list[str] = []
    # A tariff is only an assumption for a currency figure; a node rate does not
    # depend on it, so do not attach it there.
    if "KRW" in unit:
        tariff = provenance.get("cost_per_kwh")
        if tariff is not None:
            source = provenance.get("cost_per_kwh_source")
            note = "추정 기본값" if source == "default" else "설정값"
            parts.append(f"요금 {tariff:g}원/kWh({note})")
    # Area matters whenever a whole-house total is shown.
    if fact.diagnostics.get("derivative_total") is not None:
        area = provenance.get("area_m2")
        if area is not None:
            source = provenance.get("area_source")
            note = "추정 기본값" if source == "default" else "설정값"
            parts.append(f"면적 {area:g}㎡({note})")
    return f" [{', '.join(parts)}]" if parts else ""


_REFUSAL_PHRASES = {
    AdmissionStatus.DIRECTION_CONFLICT: "방향을 신뢰할 수 없어 제어 근거로 쓸 수 없습니다",
    AdmissionStatus.NONLINEAR: "이 구간에서는 비선형이라 단일 기울기로 답할 수 없습니다",
    AdmissionStatus.OUT_OF_RANGE: "모델이 계산하는 범위를 벗어났습니다",
    AdmissionStatus.CLAMPED: "실제 반응이 모델 관측 범위를 넘어 정확한 값을 낼 수 없습니다",
    AdmissionStatus.LOW_CONFIDENCE: "신뢰도가 낮아 숫자로 제시하지 않습니다",
    AdmissionStatus.MISSING_VALUE: "계산된 값이 없습니다",
    AdmissionStatus.MISSING_PROVENANCE: "요금·면적 정보가 없어 비용을 계산할 수 없습니다",
}


def compose_fact_sentence(fact: AnswerFact) -> str:
    """One deterministic Korean sentence stating a fact or refusing it.

    The number, unit, validity range and provenance are all fixed here; nothing
    downstream is permitted to change them.
    """
    label = fact.control_scope or fact.quantity
    if not fact.admissible or fact.value is None:
        why = _REFUSAL_PHRASES.get(fact.status, "값을 제시할 수 없습니다")
        detail = f" ({fact.reason})" if fact.reason else ""
        return f"{label} {fact.quantity}: {why}{detail}."

    magnitude = _format_value(fact.value, fact.unit)

    # For a currency figure, lead with the whole-house total per 1°C — the number a
    # grower can act on — rather than the per-m² gradient. The derivative is already
    # per-°C, so no "per step" suffix is appended (that would misread the FD step as
    # a divisor).
    total = fact.diagnostics.get("derivative_total")
    unit_total = str(fact.diagnostics.get("unit_total") or "")
    if total is not None and "KRW" in unit_total:
        # KRW/m2/day/°C x area -> KRW/day/°C: "1°C 올리면 하루 약 N원".
        per_c = f"1°C당 하루 약 {float(total):,.0f} 원 (온실 전체)"
        return (
            f"{label} {fact.quantity}: {per_c}, 즉 {magnitude}"
            f"{_validity_phrase(fact)}{_provenance_phrase(fact)}."
        )

    return (
        f"{label} {fact.quantity}: {magnitude} (1°C당)"
        f"{_validity_phrase(fact)}{_provenance_phrase(fact)}."
    )


#: The RTR sensitivity targets that answer the canonical marginal-change question,
#: mapped to the human quantity name the composer renders.
_MARGINAL_CHANGE_TARGETS = {
    "heating_energy_cost_krw": "난방비 변화",
    "cooling_energy_cost_krw": "냉방비 변화",
    "total_energy_cost_krw": "에너지 비용 변화",
    "node_rate_day": "마디 발생속도 변화",
}


def build_marginal_change_facts(sensitivity_payload: Mapping[str, Any]) -> dict:
    """Admit and compose the RTR sensitivity rows into the ₩/℃ and node/℃ answer.

    This is where "온도를 1℃ 올리면 난방비가 얼마나, 마디는 얼마나?" becomes a set of
    admitted facts with units, a validity range, and tariff/area provenance — or an
    explicit refusal when the model does not trust the derivative. It is the join of
    Phase 1 (the ₩/node derivatives) and Phase 2 (admission + composition).
    """
    rows = sensitivity_payload.get("sensitivities") or []
    assumptions = sensitivity_payload.get("assumptions") or {}

    facts: list[AnswerFact] = []
    for row in rows:
        target = str(row.get("target") or "")
        quantity = _MARGINAL_CHANGE_TARGETS.get(target)
        if quantity is None:
            continue
        fact = admit_rtr_sensitivity_row(row, assumptions=assumptions)
        # Relabel with the human quantity while keeping the machine target as scope.
        facts.append(
            AnswerFact(
                quantity=quantity,
                status=fact.status,
                value=fact.value,
                unit=fact.unit,
                control_scope=fact.control_scope,
                perturbation=fact.perturbation,
                validity=fact.validity,
                provenance=fact.provenance,
                reason=fact.reason,
                diagnostics={**fact.diagnostics, "target": target},
            )
        )

    return compose_answer_facts_block(facts)


def compose_answer_facts_block(facts: Iterable[AnswerFact]) -> dict:
    """A structured block of composed facts for the LLM to narrate.

    The block separates admitted facts (which carry rendered sentences and their
    numbers) from refusals (which carry no number at all), and states the hard rule
    the narrator must obey.
    """
    admitted: list[dict] = []
    refused: list[dict] = []
    for fact in facts:
        sentence = compose_fact_sentence(fact)
        entry = {**fact.to_dict(), "sentence": sentence}
        (admitted if fact.admissible else refused).append(entry)

    return {
        "admitted_facts": admitted,
        "refused_facts": refused,
        "narration_rule": (
            "각 사실의 sentence를 그대로 근거로 삼아 자연스럽게 풀어 쓰세요. 숫자·단위·"
            "유효 범위는 절대 바꾸지 말고, refused_facts의 항목은 숫자를 지어내지 말고 "
            "제시된 이유대로 '지금은 답할 수 없다'고 말하세요."
        ),
    }
