from types import SimpleNamespace

import pytest

from model_informed_greenhouse_dashboard.backend.app.services import openai_service as ai_service


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


def test_openai_helper_includes_knowledge_context_when_present(
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
    assert "Cucumber agronomy compendium" in first_message
    assert "Nutrient recipe workbook" in first_message


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
