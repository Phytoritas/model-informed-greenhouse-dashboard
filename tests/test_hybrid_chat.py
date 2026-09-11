"""Exact checks for conditional Wiki retrieval and one-call streamed conversation."""
import asyncio
from copy import deepcopy
import json
from types import SimpleNamespace

import pytest

from model_informed_greenhouse_dashboard.backend.app.services import (
    advisor_context_builder as retrieval,
    advisor_orchestration as advisor,
    chat_case_state as state,
    chat_streaming as streaming,
    condition_wiki as wiki,
    openai_service as ai,
)


def test_long_case_keeps_reports_unknowns_and_excludes_assistant_claims():
    messages = [{"role": "user", "content": "토마토 잎이 시들어요"}]
    for answer in ["젖어 있어요", "28℃", "아직 확인하지 못했어요", "있어요", "없어요", "29℃", "30℃"]:
        messages += [{"role": "assistant", "content": "원인은 산소 부족입니다.\n뿌리 위치에서 확인했나요?"}, {"role": "user", "content": answer}]
    case = state.build_chat_case_state(crop="tomato", messages=messages)
    assert case["issue"] == messages[0]["content"]
    assert case["reports"][1]["statement"] == "젖어 있어요"
    assert case["reports"][3]["status"] == "unknown"
    assert case["unknown_conditions"] == ["뿌리 위치에서 확인했나요?"]
    assert "산소 부족" not in json.dumps(case, ensure_ascii=False)
    for new in ["오이 잎이 노랗게 됐어요", "오늘 시세를 알려줘"]:
        result = state.build_chat_case_state(crop="tomato", messages=messages + [{"role": "user", "content": new}])
        assert result["issue"] == new
        assert len(result["reports"]) == 1


@pytest.mark.parametrize("reply", ["특정 구역에 집중", "아직 확인하지 못함", "햇볕 드는 쪽", "Only the sunny side"])
def test_actual_quick_reply_keeps_its_question_and_original_symptom(reply):
    messages = [{"role": "user", "content": "토마토가 시들어요"},
                {"role": "assistant", "content": "시듦이 특정 구역에 나타나나요?"},
                {"role": "user", "content": reply, "reply_to": "시듦이 특정 구역에 나타나나요?"}]
    case = state.build_chat_case_state(crop="tomato", messages=messages)
    assert case["issue"] == "토마토가 시들어요"
    assert case["reports"][-1]["asked_about"] == messages[-1]["reply_to"]
    assert retrieval._chat_retrieval_query(crop="tomato", messages=messages)[1] == "토마토가 시들어요\n" + reply


def test_wiki_keeps_conditions_limits_and_source_scope(tmp_path, monkeypatch):
    monkeypatch.setattr(wiki, "wiki_directory", lambda: tmp_path)
    record = {
        "id": "CASE-01", "crop": "tomato", "filter_decision": "rewrite", "automatic_control_rule": False,
        "source_claim": "시든 개체의 일부 회복 보고", "action": "공급을 확인한다",
        "follow_up": "완전 회복은 미확인", "limits": ["일사와 급액도 함께 달라짐"],
        "source": [{"file": "report", "pdf_pages": [2], "printed_pages": [1], "read_scope": "excerpt"}],
    }
    records = [record, {**record, "id": "WITHHELD"}, {**record, "id": "WRONG-CROP", "crop": "cucumber"}]
    (tmp_path / "knowledge-records.filtered.jsonl").write_text("\n".join(json.dumps(r, ensure_ascii=False) for r in records), encoding="utf-8")
    (tmp_path / "second-pass-summary.json").write_text(json.dumps({"withheld_ids": ["WITHHELD"]}), encoding="utf-8")
    page = {"id": "SITUATION-01", "crop": ["tomato", "cucumber"], "branches": [{"when": "젖음 확인", "action": "뿌리 확인", "watch": "원인 미확정"}], "evidence_record_ids": [r["id"] for r in records]}
    (tmp_path / "situation-playbooks.filtered.json").write_text(json.dumps([page], ensure_ascii=False), encoding="utf-8")
    cards = wiki.select_condition_wiki(query="토마토가 시들어요", crop="tomato")
    assert cards[0]["content"]["branches"] == page["branches"]
    assert cards[0]["content"]["evidence_record_ids"] == ["CASE-01"]
    assert cards[1]["content"] == record
    assert wiki.select_condition_wiki(query="오늘 시세", crop="tomato") == []
    # A revised retained file must become visible without a server restart.
    record["follow_up"] = "악화 보고도 남아 있다"
    (tmp_path / "knowledge-records.filtered.jsonl").write_text(json.dumps(record, ensure_ascii=False), encoding="utf-8")
    assert wiki.select_condition_wiki(query="시들어요", crop="tomato")[1]["content"]["follow_up"] == record["follow_up"]


def test_retrieval_reuses_unknown_reply_but_invalidates_changed_condition(monkeypatch):
    calls = []
    revision = [1]
    monkeypatch.setattr(retrieval, "_retrieval_signature", lambda _: tuple(revision))
    monkeypatch.setattr(retrieval, "corpus_signature", lambda: ())
    monkeypatch.setattr(retrieval, "select_condition_wiki", lambda **_: [])
    monkeypatch.setattr(retrieval, "fetch_knowledge_neighbors", lambda **_: [])
    def query(**kwargs):
        calls.append(kwargs)
        return {"query_status": "ready", "results": [], "query_mode": "test", "routing": {}}
    monkeypatch.setattr(retrieval, "query_knowledge_database", query)
    messages = [{"role": "user", "content": "토마토가 시들어요"}]
    first = retrieval.build_chat_advisor_context(crop="tomato", messages=messages)
    assert first["summary"]["budget"] == "standard"
    follow = messages + [{"role": "assistant", "content": "배지는 젖어 있나요?"}, {"role": "user", "content": "아직 확인하지 못했어요"}]
    second = retrieval.build_chat_advisor_context(crop="tomato", messages=follow)
    assert second["summary"]["retrieval_reused"] is True
    assert len(calls) == 1
    wet = follow[:-1] + [{"role": "user", "content": "젖어 있어요"}]
    third = retrieval.build_chat_advisor_context(crop="tomato", messages=wet)
    assert third["summary"]["retrieval_reused"] is False
    assert "젖어 있어요" in calls[-1]["query"]
    revision[0] += 1
    assert retrieval.build_chat_advisor_context(crop="tomato", messages=wet)["summary"]["retrieval_reused"] is False


class ProviderStream:
    def __init__(self, events):
        self.events = events
        self.closed = False
    def __enter__(self):
        return iter(self.events)
    def __exit__(self, *_):
        self.closed = True


def test_one_streamed_model_call_decodes_only_answer_and_keeps_wiki_internal(monkeypatch):
    calls, visible = [], []
    raw = json.dumps({"text": '젖음 "확인" 🌱 [S1](https://example.test/source)\n원인은 미확정입니다.', "follow_up": {"question": "실제 급액은 확인했나요?", "options": ["모름"]}}, ensure_ascii=True)
    events = [SimpleNamespace(type="response.output_text.delta", delta=char) for char in raw]
    events += [SimpleNamespace(type="response.completed")]
    stream = ProviderStream(events)
    def create(**kwargs):
        calls.append(kwargs)
        return stream
    client = SimpleNamespace(responses=SimpleNamespace(create=create))
    client.with_options = lambda **_: client
    monkeypatch.setattr(ai, "_client", lambda: client)
    monkeypatch.setattr(ai, "_generation_settings", lambda *_, **__: ("gemini", "low"))
    dashboard = {"knowledge": {"advisor_retrieval_context": {"condition_wiki": [{"wiki_id": "C1", "limits": ["단독 효과 아님"]}]}}}
    turn = ai.generate_chat_turn(crop="tomato", messages=[{"role": "user", "content": "젖어 있어요"}], dashboard=dashboard, on_text=visible.append)
    assert len(calls) == 1 and calls[0]["stream"] is True
    assert calls[0]["reasoning"] == {"effort": "low"}
    assert "단독 효과 아님" in calls[0]["input"][0]["content"]
    assert "".join(visible) == turn["text"]
    assert "[S1]" not in "".join(visible)
    assert "example.test" not in "".join(visible)
    assert turn["follow_up"]["question"] not in "".join(visible)
    assert stream.closed


def test_interrupted_provider_stream_is_not_a_completed_answer():
    stream = ProviderStream([SimpleNamespace(type="response.output_text.delta", delta='{"text":"부분')])
    client = SimpleNamespace(responses=SimpleNamespace(create=lambda **_: stream))
    with pytest.raises(RuntimeError, match="before completion"):
        streaming.stream_model_text(client=client, options={}, on_text=lambda _: None)
    assert stream.closed


def test_ndjson_bridge_yields_progress_and_one_authoritative_done():
    calls = []
    def build(**kwargs):
        calls.append(kwargs)
        kwargs["on_event"]({"type": "delta", "text": "설명"})
        return {"text": "설명", "follow_up": None}
    async def collect():
        return [json.loads(line) async for line in streaming.chat_event_stream(build, kwargs={"language": "ko"})]
    events = asyncio.run(collect())
    assert [e["type"] for e in events] == ["status", "delta", "done"]
    assert len(calls) == 1


def test_wiki_only_chat_retains_case_and_does_not_claim_raw_retrieval(monkeypatch):
    monkeypatch.setattr(advisor, "build_knowledge_catalog", lambda _: {})
    monkeypatch.setattr(advisor, "_build_chat_pesticide_context", lambda **_: None)
    monkeypatch.setattr(advisor, "build_chat_advisor_context", lambda **_: {"status": "database_missing", "summary": {}, "llm_context": {"resolved_crop": "tomato", "condition_wiki": [{"wiki_id": "A", "content": {"limits": ["효과 미확인"]}}]}})
    prompts = []
    def generate(**kwargs):
        prompts.append(deepcopy(kwargs))
        return '{"text":"실제 급액과 뿌리를 살펴보세요.","follow_up":null}'
    monkeypatch.setattr(ai, "_generate_text", generate)
    response = advisor.build_advisor_chat_response(crop="tomato", messages=[{"role": "user", "content": "토마토가 시들어요"}, {"role": "assistant", "content": "배지는 젖어 있나요?"}, {"role": "user", "content": "젖어 있어요"}])
    prompt = prompts[0]["input_data"][0]["content"]
    assert "효과 미확인" in prompt and "젖어 있어요" in prompt
    assert response["grounded_status"] == "retrieval_unavailable"
    assert response["timings"]["retrieval_ms"] >= 0
    assert response["machine_payload"]["chat_case_state"]["issue"] == "토마토가 시들어요"
