"""A legally-binding pesticide number the schema can't supply must be refused, not guessed."""

from __future__ import annotations

from model_informed_greenhouse_dashboard.backend.app.services.pesticide_safety import (
    PSIS_URL,
    asks_for_safe_use_number,
    safe_use_refusal,
    schema_supports,
)


def test_phi_and_safe_use_questions_are_detected() -> None:
    for question in (
        "토마토 흰가루병 수확 전 며칠 전까지 쓸 수 있나요",
        "이 약 안전사용기준 알려줘",
        "사용 횟수 제한이 어떻게 되나요",
        "몇 번까지 칠 수 있어요",
        "희석 배수는 얼마인가요",
        "what is the PHI for this fungicide",
        "pre-harvest interval?",
    ):
        assert asks_for_safe_use_number(question), question


def test_non_safe_use_pesticide_questions_are_not_gated() -> None:
    for question in (
        "흰가루병에 어떤 약이 등록돼 있어요",
        "교호방제 어떻게 짜나요",
        "이 두 약 섞어도 되나요",
        "오늘 온도 어때요",
    ):
        assert not asks_for_safe_use_number(question), question


def test_refusal_points_to_the_authoritative_registry() -> None:
    refusal = safe_use_refusal(language="ko")
    assert refusal["status"] == "refused_safe_use_standard"
    assert PSIS_URL in refusal["message"]
    assert "psis.rda.go.kr" in refusal["authoritative_sources"]["registry"]
    # It must offer what the schema *can* answer rather than a flat "no".
    assert set(refusal["supported_topics"]) == {"rotation", "mixing", "registration"}


def test_refusal_message_contains_no_fabricated_number() -> None:
    message = safe_use_refusal(language="ko")["message"]
    # A refusal for a legally-binding figure must not itself state a day count.
    assert "일수" in message or "수확" in message  # it names the concept
    # but never a concrete PHI like "7일" / "14일".
    import re

    assert not re.search(r"\d+\s*일", message)


def test_schema_supports_only_what_the_columns_carry() -> None:
    assert schema_supports("rotation")
    assert schema_supports("mixing")
    assert schema_supports("registration")
    # No PHI/application-count topic is supported, because there is no column.
    assert not schema_supports("phi")
    assert not schema_supports("application_count")
    # A row missing the required column fails the check.
    assert not schema_supports("rotation", columns={"product_name": "x"})
    assert schema_supports("rotation", columns={"moa_code_group": "FRAC 3"})


def test_chat_refuses_phi_before_any_llm_call(monkeypatch) -> None:
    """The gate must fire deterministically, without reaching the model."""
    from model_informed_greenhouse_dashboard.backend.app.services import (
        advisor_orchestration,
    )

    called = {"llm": False}

    def _boom(**kwargs):
        called["llm"] = True
        raise AssertionError("the LLM must not be called for a refused PHI question")

    monkeypatch.setattr(advisor_orchestration, "generate_chat_reply", _boom)

    response = advisor_orchestration.build_advisor_chat_response(
        crop="tomato",
        messages=[{"role": "user", "content": "흰가루병 약 수확 전 며칠 전까지 쓸 수 있어요"}],
        dashboard={"currentData": {}},
        language="ko",
    )

    assert called["llm"] is False
    assert response["machine_payload"]["answer_gate"] == "pesticide_safe_use_refusal"
    assert "psis.rda.go.kr" in response["machine_payload"]["authoritative_sources"]["registry"]
    assert PSIS_URL in response["text"]
