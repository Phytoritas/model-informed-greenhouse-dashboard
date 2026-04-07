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
