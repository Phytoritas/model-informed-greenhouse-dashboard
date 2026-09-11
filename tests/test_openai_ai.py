from types import SimpleNamespace

import pytest

from model_informed_greenhouse_dashboard.backend.app.services import openai_service as ai_service


@pytest.fixture(autouse=True)
def isolated_provider_environment(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("LLM_PROVIDER", "openai")
    for name in (
        *ai_service._OPENAI_API_KEY_CANDIDATES,
        "ANTIGRAVITY_BASE_URL", "ANTIGRAVITY_MODEL", "ANTIGRAVITY_REASONING_EFFORT",
        "ANTIGRAVITY_PROXY_API_KEY",
    ):
        monkeypatch.delenv(name, raising=False)


class _FakeResponses:
    def __init__(self) -> None:
        self.calls: list[dict] = []

    def create(self, **kwargs):
        self.calls.append(kwargs)
        return SimpleNamespace(output_text="stubbed response")


class _FakeOpenAI:
    def __init__(self) -> None:
        self.responses = _FakeResponses()


class _FakeAuthError(Exception):
    pass


class TestAntigravityOAuth:
    @pytest.mark.parametrize("entrypoint", ["chat", "consulting", "adaptive"])
    def test_public_helpers_use_oauth_model_and_preserve_input(self, monkeypatch, entrypoint):
        from model_informed_greenhouse_dashboard.backend.app.services.adaptive_advisor.narrator import (
            build_adaptive_narrative_response,
        )

        fake_client = _FakeOpenAI()
        client_options = {}

        def fake_openai(**kwargs):
            client_options.update(kwargs)
            return fake_client

        monkeypatch.setenv("LLM_PROVIDER", "antigravity_oauth")
        monkeypatch.setenv("OPENAI_API_KEY", "unrelated-openai-key")
        monkeypatch.setenv("OPENAI_MODEL", "legacy-consult-model")
        monkeypatch.setenv("OPENAI_CHAT_MODEL", "legacy-chat-model")
        monkeypatch.setenv("OPENAI_CHAT_REASONING_EFFORT", "xhigh")
        monkeypatch.setattr(ai_service, "OpenAI", fake_openai)
        messages = [{"role": "user", "content": "관측 자료가 없으면 무엇을 확인하나요?"}]

        if entrypoint == "chat":
            answer = ai_service.generate_chat_reply(crop="tomato", messages=messages)
        elif entrypoint == "consulting":
            answer = ai_service.generate_consulting(crop="tomato", dashboard={})
        else:
            answer = build_adaptive_narrative_response(
                crop="tomato", messages=messages, answer_packet={"question": messages[0]["content"]},
            )["text"]

        assert answer == "stubbed response"
        assert client_options == {"base_url": "http://127.0.0.1:10100/v1", "api_key": "local-oauth"}
        call = fake_client.responses.calls[-1]
        assert call["model"] == "google-antigravity/gemini-3.8-flash"
        assert call["reasoning"] == {"effort": "low"}
        assert call["instructions"]
        if entrypoint == "consulting":
            assert isinstance(call["input"], str) and "Crop: tomato" in call["input"]
        else:
            assert call["input"][-1] == messages[0]

    def test_oauth_configuration_is_resolved_at_call_time(self, monkeypatch):
        fake_client = _FakeOpenAI()
        client_options = {}

        def fake_openai(**kwargs):
            client_options.update(kwargs)
            return fake_client

        monkeypatch.setenv("LLM_PROVIDER", "antigravity_oauth")
        monkeypatch.setattr(ai_service, "OpenAI", fake_openai)
        ai_service.generate_chat_reply(crop="tomato", messages=[])
        monkeypatch.setenv("ANTIGRAVITY_BASE_URL", " http://127.0.0.1:10200/v1 ")
        monkeypatch.setenv("ANTIGRAVITY_PROXY_API_KEY", "local-proxy-key")
        monkeypatch.setenv("ANTIGRAVITY_REASONING_EFFORT", " HIGH ")
        ai_service.generate_chat_reply(crop="tomato", messages=[])
        assert fake_client.responses.calls[-1]["reasoning"] == {"effort": "high"}
        assert client_options == {"base_url": "http://127.0.0.1:10200/v1", "api_key": "local-proxy-key"}

    def test_auth_failure_identifies_oauth(self, monkeypatch):
        def fail_client():
            raise _FakeAuthError("401")

        monkeypatch.setenv("LLM_PROVIDER", "antigravity_oauth")
        monkeypatch.setattr(ai_service, "AuthenticationError", _FakeAuthError)
        monkeypatch.setattr(ai_service, "_client", fail_client)
        with pytest.raises(RuntimeError, match="Antigravity OAuth authentication failed"):
            ai_service.generate_chat_reply(crop="tomato", messages=[])


def test_openai_helper_requires_api_key(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)

    with pytest.raises(RuntimeError, match="Missing OpenAI API key"):
        ai_service.generate_chat_reply(crop="tomato", messages=[{"role": "user", "content": "hi"}])


def test_openai_helper_uses_responses_output_text(monkeypatch: pytest.MonkeyPatch) -> None:
    fake_client = _FakeOpenAI()
    monkeypatch.setenv("OPENAI_API_KEY", "test-key")
    monkeypatch.setattr(ai_service, "OpenAI", lambda: fake_client)

    result = ai_service.generate_consulting(
        crop="tomato",
        dashboard={"currentData": {}, "metrics": {}},
        language="en",
        model="gpt-5.4-mini",
    )

    assert result == "stubbed response"
    assert fake_client.responses.calls
    assert fake_client.responses.calls[0]["model"] == "gpt-5.4-mini"
    assert "reasoning" not in fake_client.responses.calls[0]
    assert "Crop: tomato" in fake_client.responses.calls[0]["input"]


def test_openai_helper_accepts_smartgrow_api_key_fallback_env(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    fake_client = _FakeOpenAI()
    captured: dict[str, str | None] = {}

    monkeypatch.delenv("OPENAI_API_KEY", raising=False)
    monkeypatch.setenv("SMARTGROW_OPENAI_API_KEY", "smartgrow-test-key")

    def _fake_openai(*, api_key: str | None = None):
        captured["api_key"] = api_key
        return fake_client

    monkeypatch.setattr(ai_service, "OpenAI", _fake_openai)

    result = ai_service.generate_chat_reply(
        crop="cucumber",
        messages=[{"role": "user", "content": "상태 요약"}],
        dashboard={"currentData": {}, "metrics": {}},
        language="ko",
    )

    assert result == "stubbed response"
    assert captured["api_key"] == "smartgrow-test-key"


def test_openai_helper_uses_korean_headings_for_korean_consulting(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    fake_client = _FakeOpenAI()
    monkeypatch.setenv("OPENAI_API_KEY", "test-key")
    monkeypatch.setattr(ai_service, "OpenAI", lambda: fake_client)

    ai_service.generate_consulting(
        crop="cucumber",
        dashboard={"currentData": {}, "metrics": {}},
        language="ko",
        model="gpt-5.4-mini",
    )

    prompt = fake_client.responses.calls[0]["input"]
    assert "## 핵심 요약" in prompt
    assert "## 권장 조치" in prompt
    assert "### 지금" in prompt
    assert "## 모니터링 체크리스트 (24시간)" in prompt
    assert "## Executive Summary" not in prompt
    assert "## Recommendations" not in prompt
    assert "## Monitoring Checklist (Next 24h)" not in prompt


def test_openai_helper_surfaces_invalid_key(monkeypatch: pytest.MonkeyPatch) -> None:
    class _BrokenResponses:
        def create(self, **kwargs):
            raise _FakeAuthError("401 invalid_api_key")

    class _BrokenOpenAI:
        def __init__(self) -> None:
            self.responses = _BrokenResponses()

    monkeypatch.setenv("OPENAI_API_KEY", "test-key")
    monkeypatch.setattr(ai_service, "AuthenticationError", _FakeAuthError)
    monkeypatch.setattr(ai_service, "OpenAI", lambda: _BrokenOpenAI())

    with pytest.raises(RuntimeError, match="Invalid OpenAI API key"):
        ai_service.generate_chat_reply(
            crop="tomato",
            messages=[{"role": "user", "content": "hi"}],
        )


def test_openai_helper_omits_unretrieved_catalog_titles_from_chat(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    fake_client = _FakeOpenAI()
    monkeypatch.setenv("OPENAI_API_KEY", "test-key")
    monkeypatch.setattr(ai_service, "OpenAI", lambda: fake_client)

    ai_service.generate_chat_reply(
        crop="cucumber",
        messages=[{"role": "user", "content": "What should I watch today?"}],
        dashboard={
            "currentData": {},
            "knowledge": {
                "titles": ["Cucumber agronomy compendium"],
                "structured_workbooks": [
                    {"title": "Nutrient recipe workbook"},
                ],
            },
        },
        language="en",
        model="gpt-5.4-mini",
    )

    assert fake_client.responses.calls
    first_message = fake_client.responses.calls[0]["input"][0]["content"]
    assert "Cucumber agronomy compendium" not in first_message
    assert "Nutrient recipe workbook" not in first_message


def test_openai_helper_omits_uncalibrated_precision_effects_from_chat(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    fake_client = _FakeOpenAI()
    monkeypatch.setenv("OPENAI_API_KEY", "test-key")
    monkeypatch.setattr(ai_service, "OpenAI", lambda: fake_client)

    ai_service.generate_chat_reply(
        crop="tomato",
        messages=[{"role": "user", "content": "지금 추천을 설명해줘"}],
        dashboard={
            "currentData": {},
            "model_runtime": {
                "answer_focus": {
                    "summary": "주간 CO2 +100ppm 조정은 14일 예상 수량 +17.493으로 계산됨",
                    "effects": {
                        "expected_yield_delta_14d": 17.493,
                        "expected_energy_delta": 0.56,
                    },
                },
                "recommendation_families": [{"control": "co2_setpoint_day"}],
                "best_actions": [{"action": "주간 CO2 100ppm 올리기"}],
                "control_precision_matrix": {"co2_setpoint_day": []},
                "operator_view": {"now": [], "today": [], "this_week": []},
                "tradeoff_summary": {"yield_vs_energy": []},
            },
        },
        language="ko",
        model="gpt-5.4-mini",
    )

    prompt = fake_client.responses.calls[0]["input"][0]["content"]
    # The legacy scenario fan supplies comparison indices, not physical effects.
    assert "answer_focus" not in prompt
    assert "control_precision_matrix" not in prompt
    assert "17.493" not in prompt and "0.56" not in prompt
    assert "uncalibrated_comparison_indices" in prompt
    assert "model_runtime" in prompt
    assert "의미와 단위를 유지한 표시용 반올림" in prompt
    assert "외삽하지" in prompt, "a small step must not be extrapolated to a larger one"
    assert "추정하지" in prompt, "missing/unreliable values must be surfaced, not estimated"


def test_chat_system_prompt_connects_principles_conditions_and_management() -> None:
    """Management answers may be structured while simple definitions stay compact."""
    prompt = ai_service._chat_system_prompt("tomato", "ko")

    # Required: the quantitative register.
    assert "단위" in prompt
    assert "범위" in prompt
    assert "모른다" in prompt
    assert "만들어내지" in prompt

    assert "조건에 따른 판단" in prompt
    assert "관리와 확인할 반응" in prompt
    assert "확인 질문 하나만" in prompt
    assert "단순 개념 질문은 짧은 설명이면 충분" in prompt
    assert "source_id" in prompt
    assert "앞서 답한" in prompt

    # Forbidden: the gag clauses that caused the regression.
    assert "절대 언급하지 마세요" not in prompt
    assert "원래 아는 것처럼" not in prompt


def test_chat_evidence_is_transmitted_exactly_once(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Excerpts belong in the grounding block, not also in the dashboard JSON."""
    fake_client = _FakeOpenAI()
    monkeypatch.setenv("OPENAI_API_KEY", "test-key")
    monkeypatch.setattr(ai_service, "OpenAI", lambda: fake_client)

    marker = "붕소 결핍은 생장점 괴사로 나타난다"
    dashboard = {
        "currentData": {"temperature": 22.5},
        "knowledge": {
            "advisor_retrieval_context": {
                "status": "ready",
                "evidence_cards": [
                    {"topic_major": "physiology", "evidence_excerpt": marker},
                ],
            }
        },
    }

    ai_service.generate_chat_reply(
        crop="tomato",
        messages=[{"role": "user", "content": "생리장해 원인이 뭔가요"}],
        dashboard=dashboard,
        language="ko",
        model="gpt-5.4-mini",
    )

    prompt = fake_client.responses.calls[0]["input"][0]["content"]
    assert prompt.count(marker) == 1, "evidence was transmitted more than once"
    # The caller's dashboard must not be mutated.
    assert dashboard["knowledge"]["advisor_retrieval_context"]["evidence_cards"]


def test_build_advisory_display_payload_accepts_locale_aware_korean_headings() -> None:
    payload = ai_service.build_advisory_display_payload(
        (
            "## 요약\n"
            "- 오늘은 과습보다 CO2 제한이 더 큽니다.\n\n"
            "## 위험 신호\n"
            "- 오후 고습 지속 시 병해 리스크가 올라갑니다.\n\n"
            "## 권장 조치\n"
            "### 지금 할 일\n"
            "- 환기 설정을 소폭 열어 VPD를 회복합니다.\n\n"
            "### 오늘 할 일\n"
            "- CO2 설정을 80 ppm 높여 동화량 변화를 확인합니다.\n\n"
            "## 모니터링\n"
            "- 15시 이후 RH 추세를 확인합니다.\n"
        ),
        language="ko",
        confidence=0.82,
    )

    assert payload["language"] == "ko"
    assert payload["summary"] == "오늘은 과습보다 CO2 제한이 더 큽니다."
    assert payload["risks"] == ["오후 고습 지속 시 병해 리스크가 올라갑니다."]
    assert payload["actions_now"] == ["환기 설정을 소폭 열어 VPD를 회복합니다."]
    assert payload["actions_today"] == ["CO2 설정을 80 ppm 높여 동화량 변화를 확인합니다."]
    assert payload["monitor"] == ["15시 이후 RH 추세를 확인합니다."]
    assert payload["actions_week"] == []
    assert payload["confidence"] == 0.82
    assert payload["sections"] == [
        {
            "key": "summary",
            "title": "핵심 요약",
            "body": "- 오늘은 과습보다 CO2 제한이 더 큽니다.",
        },
        {
            "key": "risks",
            "title": "위험 신호",
            "body": "- 오후 고습 지속 시 병해 리스크가 올라갑니다.",
        },
        {
            "key": "actions",
            "title": "권장 조치",
            "body": (
                "### 지금 할 일\n"
                "- 환기 설정을 소폭 열어 VPD를 회복합니다.\n\n"
                "### 오늘 할 일\n"
                "- CO2 설정을 80 ppm 높여 동화량 변화를 확인합니다."
            ),
        },
        {
            "key": "monitor",
            "title": "모니터링",
            "body": "- 15시 이후 RH 추세를 확인합니다.",
        },
    ]
