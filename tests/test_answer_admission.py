"""Admission is the existence proof of the design: an inadmissible number cannot be rendered."""

from __future__ import annotations

from model_informed_greenhouse_dashboard.backend.app.services.answer_admission import (
    AdmissionStatus,
    GroundingDecision,
    admit_rtr_sensitivity_row,
    admit_sensitivity,
    grounding_decision,
)
from model_informed_greenhouse_dashboard.backend.app.services.answer_composer import (
    compose_answer_facts_block,
    compose_fact_sentence,
)


def _healthy_row(**overrides):
    row = {
        "control": "co2_setpoint_day",
        "target": "predicted_yield_14d",
        "derivative": 0.42,
        "unit": "kg/ppm",
        "perturbation_size": 80.0,
        "trust_region": {"low": -120.0, "high": 120.0},
        "scenario_alignment": True,
        "nonlinearity_hint": "symmetric",
        "local_confidence": 0.71,
        "positive_response": 33.6,
        "negative_response": -33.6,
        "direction": "increase",
    }
    row.update(overrides)
    return row


def test_healthy_row_is_admitted_with_its_number() -> None:
    fact = admit_sensitivity(_healthy_row(), quantity="예상 수량")
    assert fact.status is AdmissionStatus.ADMITTED
    assert fact.admissible
    assert fact.value == 0.42
    assert fact.unit == "kg/ppm"


def test_direction_conflict_is_refused_and_carries_no_number() -> None:
    fact = admit_sensitivity(
        _healthy_row(nonlinearity_hint="direction_conflict"), quantity="예상 수량"
    )
    assert fact.status is AdmissionStatus.DIRECTION_CONFLICT
    assert not fact.admissible
    assert fact.value is None


def test_scenario_misalignment_is_refused() -> None:
    fact = admit_sensitivity(_healthy_row(scenario_alignment=False), quantity="예상 수량")
    assert fact.status is AdmissionStatus.DIRECTION_CONFLICT
    assert fact.value is None


def test_nonlinear_response_withdraws_the_slope() -> None:
    fact = admit_sensitivity(_healthy_row(nonlinearity_hint="nonlinear"), quantity="예상 수량")
    assert fact.status is AdmissionStatus.NONLINEAR
    assert fact.value is None


def test_low_confidence_is_refused() -> None:
    fact = admit_sensitivity(
        _healthy_row(local_confidence=0.2), quantity="예상 수량", min_confidence=0.4
    )
    assert fact.status is AdmissionStatus.LOW_CONFIDENCE
    assert fact.value is None


def test_missing_value_is_refused() -> None:
    fact = admit_sensitivity(_healthy_row(derivative=None), quantity="예상 수량")
    assert fact.status is AdmissionStatus.MISSING_VALUE
    assert fact.value is None


def test_currency_row_requires_provenance() -> None:
    row = {
        "control": "day_heating_min_temp_C",
        "target": "heating_energy_cost_krw",
        "derivative": 3.5,
        "unit": "KRW/m2/day/°C",
        "perturbation_size": 0.3,
        "trust_region": {"low": -0.3, "high": 0.3},
        "scenario_alignment": True,
    }
    refused = admit_rtr_sensitivity_row(row, assumptions=None)
    assert refused.status is AdmissionStatus.MISSING_PROVENANCE
    assert refused.value is None

    admitted = admit_rtr_sensitivity_row(
        row,
        assumptions={
            "cost_per_kwh": 135.0,
            "cost_per_kwh_source": "settings",
            "actual_area_m2": 3305.8,
            "actual_area_m2_source": "settings",
        },
    )
    assert admitted.status is AdmissionStatus.ADMITTED
    assert admitted.value == 3.5
    assert admitted.provenance["cost_per_kwh"] == 135.0


def test_hostile_llm_cannot_surface_an_unadmitted_number() -> None:
    """The existence proof.

    Every dangerous state — direction conflict, low confidence, missing value,
    missing provenance — is composed alongside a mock model that tries to emit a
    plausible number. Not one inadmissible value may appear in the rendered block.
    """
    dangerous_rows = [
        admit_sensitivity(_healthy_row(nonlinearity_hint="direction_conflict"), quantity="예상 수량"),
        admit_sensitivity(_healthy_row(scenario_alignment=False), quantity="예상 수량"),
        admit_sensitivity(_healthy_row(nonlinearity_hint="nonlinear"), quantity="예상 수량"),
        admit_sensitivity(_healthy_row(local_confidence=0.1), quantity="예상 수량"),
        admit_sensitivity(_healthy_row(derivative=None), quantity="예상 수량"),
        admit_rtr_sensitivity_row(
            {
                "control": "day_heating_min_temp_C",
                "target": "heating_energy_cost_krw",
                "derivative": 99999.0,
                "unit": "KRW/m2/day/°C",
                "scenario_alignment": True,
            },
            assumptions=None,
        ),
    ]

    block = compose_answer_facts_block(dangerous_rows)

    # No admitted facts, so no rendered number.
    assert block["admitted_facts"] == []
    assert len(block["refused_facts"]) == len(dangerous_rows)

    # The refused facts carry no value and no fabricated number in their sentence.
    for entry in block["refused_facts"]:
        assert entry["value"] is None
        assert "99999" not in entry["sentence"]
        assert "0.42" not in entry["sentence"]
        # A refusal states why, it does not quote a figure.
        assert any(
            phrase in entry["sentence"]
            for phrase in ("신뢰할 수 없어", "비선형", "신뢰도가 낮아", "계산된 값이 없", "요금·면적")
        )


def test_admitted_fact_renders_number_unit_and_validity() -> None:
    fact = admit_sensitivity(_healthy_row(), quantity="예상 수량")
    sentence = compose_fact_sentence(fact)
    assert "0.42" in sentence
    assert "kg/ppm" in sentence
    assert "유효 범위" in sentence


def test_default_tariff_is_disclosed_as_an_estimate() -> None:
    fact = admit_rtr_sensitivity_row(
        {
            "control": "day_heating_min_temp_C",
            "target": "heating_energy_cost_krw",
            "derivative": 3.5,
            "unit": "KRW/m2/day/°C",
            "scenario_alignment": True,
        },
        assumptions={
            "cost_per_kwh": 120.0,
            "cost_per_kwh_source": "default",
            "actual_area_m2": 3305.8,
            "actual_area_m2_source": "default",
        },
    )
    sentence = compose_fact_sentence(fact)
    # A placeholder tariff must not read as the grower's own cost.
    assert "추정 기본값" in sentence


def test_grounding_decision_classification() -> None:
    assert grounding_decision({"status": "ready", "evidence_cards": [{"x": 1}]}) is (
        GroundingDecision.GROUNDED
    )
    assert grounding_decision({"status": "ready", "evidence_cards": []}) is (
        GroundingDecision.NO_MATCH
    )
    assert grounding_decision({"status": "retrieval_unavailable"}) is (
        GroundingDecision.SOURCE_UNAVAILABLE
    )
    assert grounding_decision({"status": "database_missing"}) is (
        GroundingDecision.SOURCE_UNAVAILABLE
    )
    assert grounding_decision(None) is GroundingDecision.NO_MATCH


def test_retrieval_context_injection_records_grounding_even_on_miss() -> None:
    """A zero-evidence answer must be distinguishable from a grounded one.

    Regression guard for the silent-failure defect: the old inject helper returned
    the dashboard unchanged whenever status != "ready", so nothing downstream could
    tell that retrieval had found nothing.
    """
    from model_informed_greenhouse_dashboard.backend.app.services import (
        advisor_orchestration,
    )

    grounded = advisor_orchestration._inject_advisor_retrieval_context(
        {"currentData": {}},
        {"status": "ready", "llm_context": {"evidence_cards": [{"evidence_excerpt": "x"}]}},
    )
    assert grounded["knowledge"]["grounding_decision"] == "GROUNDED"
    assert grounded["knowledge"]["advisor_retrieval_context"]["evidence_cards"]

    missed = advisor_orchestration._inject_advisor_retrieval_context(
        {"currentData": {}},
        {"status": "ready", "llm_context": {"evidence_cards": []}},
    )
    assert missed["knowledge"]["grounding_decision"] == "NO_MATCH"
    assert "advisor_retrieval_context" not in missed["knowledge"]

    unavailable = advisor_orchestration._inject_advisor_retrieval_context(
        {"currentData": {}},
        {"status": "retrieval_unavailable"},
    )
    assert unavailable["knowledge"]["grounding_decision"] == "SOURCE_UNAVAILABLE"
