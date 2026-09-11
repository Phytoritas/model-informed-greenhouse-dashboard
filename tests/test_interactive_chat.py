"""One model call produces a grounded answer and an optional conversational question."""
import json

import pytest

from model_informed_greenhouse_dashboard.backend.app.services import (
    advisor_context_builder as context_builder,
    advisor_orchestration as advisor,
    openai_service as ai,
)


def test_interactive_turn_retains_context_and_keeps_sources_internal(monkeypatch):
    calls = []
    evidence = {
        "source_id": "S1", "title": "Internal reference", "source_locator": "page:42",
        "evidence_excerpt": "젖은 배지에서 시들면 실제 급액과 뿌리 상태를 확인한다.",
    }
    expected_follow_up = {
        "question": "배지가 젖어 있나요?",
        "options": ["젖어 있어요", "말라 있어요", "아직 확인하지 못했어요"],
    }

    def completion(**kwargs):
        calls.append(kwargs)
        return json.dumps({"text": "시듦만으로 물이 부족하다고 단정할 수 없습니다. [S1]", "follow_up": expected_follow_up}, ensure_ascii=False)

    monkeypatch.setattr(advisor, "build_knowledge_catalog", lambda _: {})
    monkeypatch.setattr(advisor, "build_chat_advisor_context", lambda **_: {
        "status": "ready", "summary": {"status": "ready"},
        "llm_context": {"resolved_crop": "tomato", "evidence_cards": [evidence]},
    })
    monkeypatch.setattr(advisor, "_build_chat_pesticide_context", lambda **_: None)
    monkeypatch.setattr(ai, "_generate_text", completion)
    messages = [{"role": "user", "content": "토마토가 시들어요"}]
    response = advisor.build_advisor_chat_response(crop="tomato", messages=messages)
    assert response["text"] == "시듦만으로 물이 부족하다고 단정할 수 없습니다."
    assert response["follow_up"] == expected_follow_up
    assert response["sources"][0]["title"] == "Internal reference"
    assert len(calls) == 1
    assert "Internal reference" in calls[0]["input_data"][0]["content"]

    messages += [
        {"role": "assistant", "content": response["text"] + "\n\n" + response["follow_up"]["question"]},
        {"role": "user", "content": "젖어 있어요"},
    ]
    advisor.build_advisor_chat_response(crop="tomato", messages=messages)
    assert calls[-1]["input_data"][-3:] == messages
    assert "앞서 답한" in calls[-1]["instructions"]
    assert "조치를 권했다는 이유만으로 실행되거나 회복됐다고 가정하지" in calls[-1]["instructions"]


@pytest.mark.parametrize("body,expected", [
    ('{"text":"충분한 답입니다.","follow_up":null}', {"text": "충분한 답입니다.", "follow_up": None}),
    ('```json\n{"text":"설명 (kPa) [S1]","follow_up":{"question":"측정값은요?","options":[]}}\n```', {"text": "설명 (kPa)", "follow_up": {"question": "측정값은요?", "options": []}}),
    ('{"text":"설명","follow_up":{"question":"상태는요?","options":["젖음",4,"젖음","건조","모름","초과"]}}', {"text": "설명", "follow_up": {"question": "상태는요?", "options": ["젖음", "건조", "모름"]}}),
    ("일반 설명 [S1](https://example.test/internal)", {"text": "일반 설명", "follow_up": None}),
    ("조건 (23℃), 범위 [0, 1] [S1; S2]", {"text": "조건 (23℃), 범위 [0, 1]", "follow_up": None}),
])
def test_chat_turn_parsing_keeps_only_visible_answer_and_valid_choices(body, expected):
    assert ai._parse_chat_turn(body) == expected


@pytest.mark.parametrize("body", ['{"text":', '{"text":3}', '{"text":" [S1] "}', ""])
def test_invalid_structured_response_cannot_leak_raw_payload(body):
    with pytest.raises(ValueError):
        ai._parse_chat_turn(body)


@pytest.mark.parametrize("reply", ["젖어 있어요", "아직 확인하지 못했어요", "28℃", "yes", "it's wet"])
def test_short_reply_retrieval_preserves_the_question_topic(reply):
    crop, query = context_builder._chat_retrieval_query(crop="tomato", messages=[
        {"role": "user", "content": "토마토가 시들어요"},
        {"role": "assistant", "content": "내부 모델 주장이 아닙니다. 배지가 젖어 있나요?"},
        {"role": "user", "content": reply},
    ])
    assert crop == "tomato"
    assert query == "토마토가 시들어요\n" + reply
    assert "내부 모델 주장" not in query


@pytest.mark.parametrize("reply", ["오늘 시세를 알려줘", "오이 잎이 노랗게 됐어요", "What is VPD?"])
def test_new_question_does_not_inherit_previous_follow_up_topic(reply):
    _, query = context_builder._chat_retrieval_query(crop="tomato", messages=[
        {"role": "user", "content": "토마토가 시들어요"},
        {"role": "assistant", "content": "배지가 젖어 있나요?"},
        {"role": "user", "content": reply},
    ])
    assert query == reply
