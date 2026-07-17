"""Answer admission: a number reaches the grower only if it earns it.

The advisor must never state a confident wrong number, because a grower acts on it.
The failure the council found is that the LLM owns the numbers: it is handed a JSON
dashboard and free-writes prose, so an untrustworthy derivative (``direction_conflict``,
``scenario_alignment=false``), a stale figure, or a zero-evidence retrieval is laundered
into fluent, confident Korean.

This module inverts that. A model-derived number is wrapped in a typed :class:`AnswerFact`
and passed through admission rules **before** it can be rendered. The dangerous path is
structurally closed, not merely discouraged by a prompt: an inadmissible fact carries no
value, so a renderer has nothing to print.

The design choice — deterministic composition, not OpenAI tool calling — is deliberate.
Tool calling makes the truth of a number contingent on the model choosing to call,
choosing correctly, and not re-rendering the result. Here the engine owns the number and
the LLM only narrates a fact that has already been admitted or refused.

Reference: docs/research/20260717-advisor-answer-quality-architecture/improvement_spec.md
"""

from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Mapping


class AdmissionStatus(str, Enum):
    """Whether a fact may be rendered, and if not, why."""

    ADMITTED = "ADMITTED"
    DIRECTION_CONFLICT = "DIRECTION_CONFLICT"
    NONLINEAR = "NONLINEAR"
    OUT_OF_RANGE = "OUT_OF_RANGE"
    CLAMPED = "CLAMPED"
    LOW_CONFIDENCE = "LOW_CONFIDENCE"
    MISSING_VALUE = "MISSING_VALUE"
    MISSING_PROVENANCE = "MISSING_PROVENANCE"


class GroundingDecision(str, Enum):
    """The retrieval state behind a literature-grounded answer."""

    GROUNDED = "GROUNDED"
    NO_MATCH = "NO_MATCH"
    SOURCE_UNAVAILABLE = "SOURCE_UNAVAILABLE"
    SOURCE_STALE = "SOURCE_STALE"
    SOURCE_QUARANTINED = "SOURCE_QUARANTINED"


#: Statuses that permit a number to be rendered.
_ADMITTED = frozenset({AdmissionStatus.ADMITTED})


@dataclass(frozen=True)
class AnswerFact:
    """A single model-derived number and everything needed to render it honestly.

    ``value`` is None whenever ``status`` is not ADMITTED: an inadmissible fact must
    not carry a number a careless renderer could reach for.
    """

    quantity: str
    status: AdmissionStatus
    value: float | None
    unit: str | None
    control_scope: str | None = None
    perturbation: float | None = None
    validity: Mapping[str, Any] | None = None
    provenance: Mapping[str, Any] | None = None
    reason: str | None = None
    diagnostics: Mapping[str, Any] = field(default_factory=dict)

    @property
    def admissible(self) -> bool:
        return self.status in _ADMITTED and self.value is not None

    def to_dict(self) -> dict[str, Any]:
        return {
            "quantity": self.quantity,
            "status": self.status.value,
            "admissible": self.admissible,
            "value": self.value,
            "unit": self.unit,
            "control_scope": self.control_scope,
            "perturbation": self.perturbation,
            "validity": dict(self.validity) if self.validity else None,
            "provenance": dict(self.provenance) if self.provenance else None,
            "reason": self.reason,
            "diagnostics": dict(self.diagnostics),
        }


def _relative_disagreement(a: float, b: float) -> float:
    scale = max(abs(a), abs(b), 1e-9)
    return abs(a - b) / scale


def admit_sensitivity(
    row: Mapping[str, Any],
    *,
    quantity: str,
    provenance: Mapping[str, Any] | None = None,
    min_confidence: float = 0.4,
    require_provenance: bool = False,
) -> AnswerFact:
    """Admit or refuse a single sensitivity row from the sensitivity engine.

    The admission rules, in order (any failing rule is fatal and no number is
    emitted):

    1. the row must actually carry a value and a unit;
    2. ``scenario_alignment`` must hold — the model's own signal that the ± probes
       agree on direction. When it is false the model is saying "do not trust this";
    3. ``nonlinearity_hint`` must not be ``direction_conflict`` (fatal) and, if
       ``nonlinear``, the derivative is withdrawn (the local slope does not describe
       the response). A ``mild_nonlinear`` probe asymmetry is recorded, not refused;
    4. ``local_confidence`` must clear ``min_confidence``;
    5. when ``require_provenance`` is set (currency answers), the tariff/area
       provenance must be present.
    """
    diagnostics = {
        "scenario_alignment": row.get("scenario_alignment"),
        "nonlinearity_hint": row.get("nonlinearity_hint"),
        "local_confidence": row.get("local_confidence"),
        "direction": row.get("direction"),
    }
    common = {
        "quantity": quantity,
        "unit": row.get("unit"),
        "control_scope": row.get("control"),
        "perturbation": row.get("perturbation_size"),
        "validity": row.get("trust_region"),
        "provenance": provenance,
        "diagnostics": diagnostics,
    }

    def refuse(status: AdmissionStatus, reason: str) -> AnswerFact:
        return AnswerFact(status=status, value=None, reason=reason, **common)

    derivative = row.get("derivative")
    if derivative is None or row.get("unit") is None:
        return refuse(AdmissionStatus.MISSING_VALUE, "no derivative or unit on the row")

    hint = str(row.get("nonlinearity_hint") or "")
    if hint == "direction_conflict":
        return refuse(
            AdmissionStatus.DIRECTION_CONFLICT,
            "the ± probes disagree on direction; the derivative is not usable as a "
            "basis for a control change",
        )

    if row.get("scenario_alignment") is False:
        return refuse(
            AdmissionStatus.DIRECTION_CONFLICT,
            "scenario_alignment is false; the model does not trust this derivative",
        )

    if hint == "nonlinear":
        return refuse(
            AdmissionStatus.NONLINEAR,
            "the response is nonlinear over the step; a single slope does not "
            "describe it, use a bounded scenario at the exact delta instead",
        )

    # A "mild_nonlinear" asymmetry between the ± probes is tolerated but recorded, so
    # a caller can widen the caveat. Anything sharper was already refused above.
    positive = row.get("positive_response")
    negative = row.get("negative_response")
    if positive is not None and negative is not None:
        diagnostics["probe_asymmetry"] = round(
            _relative_disagreement(float(positive), float(negative)), 6
        )

    confidence = row.get("local_confidence")
    if confidence is not None and float(confidence) < min_confidence:
        return refuse(
            AdmissionStatus.LOW_CONFIDENCE,
            f"local_confidence {float(confidence):.2f} is below the {min_confidence:.2f} bar",
        )

    if require_provenance and not provenance:
        return refuse(
            AdmissionStatus.MISSING_PROVENANCE,
            "a currency figure needs its tariff and area provenance",
        )

    return AnswerFact(
        status=AdmissionStatus.ADMITTED,
        value=round(float(derivative), 6),
        reason=None,
        **common,
    )


def admit_rtr_sensitivity_row(
    row: Mapping[str, Any],
    *,
    assumptions: Mapping[str, Any] | None = None,
    min_confidence: float = 0.0,
) -> AnswerFact:
    """Admit an RTR sensitivity row (heating ₩/℃, node rate, …).

    RTR rows use `scenario_alignment` but do not carry a `nonlinearity_hint` or
    `local_confidence`, so those checks are skipped; the currency rows require the
    tariff/area provenance to be present.
    """
    quantity = str(row.get("target") or "")
    is_currency = "krw" in quantity.lower() or "krw" in str(row.get("unit") or "").lower()
    provenance = None
    if assumptions is not None:
        provenance = {
            "cost_per_kwh": assumptions.get("cost_per_kwh"),
            "cost_per_kwh_source": assumptions.get("cost_per_kwh_source"),
            "area_m2": assumptions.get("actual_area_m2"),
            "area_source": assumptions.get("actual_area_m2_source"),
        }

    diagnostics = {
        "scenario_alignment": row.get("scenario_alignment"),
        "direction": row.get("direction"),
    }
    common = {
        "quantity": quantity,
        "unit": row.get("unit"),
        "control_scope": row.get("control"),
        "perturbation": row.get("perturbation_size"),
        "validity": row.get("trust_region"),
        "provenance": provenance,
        "diagnostics": diagnostics,
    }

    if row.get("derivative") is None or row.get("unit") is None:
        return AnswerFact(
            status=AdmissionStatus.MISSING_VALUE, value=None,
            reason="no derivative or unit on the row", **common,
        )
    if row.get("scenario_alignment") is False:
        return AnswerFact(
            status=AdmissionStatus.DIRECTION_CONFLICT, value=None,
            reason="scenario_alignment is false; the model does not trust this derivative",
            **common,
        )
    if is_currency and not provenance:
        return AnswerFact(
            status=AdmissionStatus.MISSING_PROVENANCE, value=None,
            reason="a currency figure needs its tariff and area provenance", **common,
        )

    return AnswerFact(
        status=AdmissionStatus.ADMITTED,
        value=round(float(row["derivative"]), 6),
        reason=None,
        **common,
    )


def grounding_decision(retrieval_context: Mapping[str, Any] | None) -> GroundingDecision:
    """Classify a retrieval result into a grounding state for the envelope."""
    if not isinstance(retrieval_context, Mapping):
        return GroundingDecision.NO_MATCH
    status = str(retrieval_context.get("status") or "").lower()
    if status in {"retrieval_unavailable", "database_missing"}:
        return GroundingDecision.SOURCE_UNAVAILABLE
    cards = retrieval_context.get("evidence_cards")
    if isinstance(cards, list) and cards:
        return GroundingDecision.GROUNDED
    llm_context = retrieval_context.get("llm_context")
    if isinstance(llm_context, Mapping):
        cards = llm_context.get("evidence_cards")
        if isinstance(cards, list) and cards:
            return GroundingDecision.GROUNDED
    return GroundingDecision.NO_MATCH
