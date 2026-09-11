"""Chat model settings and source-bound compendium answers without network calls."""

from copy import deepcopy
from types import SimpleNamespace

import pytest

from model_informed_greenhouse_dashboard.backend.app.services import openai_service as ai


def _provider(monkeypatch, answer="응답"):
    monkeypatch.setenv("LLM_PROVIDER", "openai")
    calls = []

    def create(**kwargs):
        calls.append(kwargs)
        return SimpleNamespace(output_text=answer)

    client = SimpleNamespace(responses=SimpleNamespace(create=create))
    monkeypatch.setattr(ai, "_client", lambda: client)
    return calls


def _card(index=1, **overrides):
    return {
        "source_id": f"S{index}",
        "title": f"재배 자료 {index}",
        "document_id": 20,
        "chunk_id": 100 + index,
        "source_locator": f"page:{index}",
        "evidence_role": "main",
        "source_context": {
            "language": "ja", "region": "Japan", "reference_kind": "agronomy_compendium",
        },
        "evidence_excerpt": f"試験条件の説明 {index}。",
        **overrides,
    }


def _dashboard(cards, reading_context=None):
    return {"knowledge": {"advisor_retrieval_context": {
        "status": "ready", "evidence_cards": cards, "reading_context": reading_context,
    }}}


def test_chat_resolves_model_and_reasoning_at_call_time(monkeypatch):
    calls = _provider(monkeypatch)
    monkeypatch.setenv("OPENAI_MODEL", "gpt-5-mini-2025-08-07")
    monkeypatch.delenv("OPENAI_CHAT_MODEL", raising=False)
    monkeypatch.delenv("OPENAI_CHAT_REASONING_EFFORT", raising=False)
    messages = [{"role": "user", "content": "야간 습도 관리는?"}]

    ai.generate_chat_reply(crop="tomato", messages=messages)
    assert calls[-1]["model"] == "gpt-5.4"
    assert calls[-1]["reasoning"] == {"effort": "medium"}

    monkeypatch.setenv("OPENAI_CHAT_MODEL", " gpt-5.4-mini ")
    monkeypatch.setenv("OPENAI_CHAT_REASONING_EFFORT", " HIGH ")
    ai.generate_chat_reply(crop="tomato", messages=messages)
    assert calls[-1]["model"] == "gpt-5.4-mini"
    assert calls[-1]["reasoning"] == {"effort": "high"}

    ai.generate_chat_reply(crop="tomato", messages=messages, model="gpt-5.4")
    assert calls[-1]["model"] == "gpt-5.4"


@pytest.mark.parametrize("effort", ["none", "low", "medium", "high", "xhigh"])
def test_chat_forwards_configured_reasoning_effort(monkeypatch, effort):
    calls = _provider(monkeypatch)
    monkeypatch.setenv("OPENAI_CHAT_REASONING_EFFORT", effort)
    ai.generate_chat_reply(crop="tomato", messages=[], model="gpt-5.4")
    assert calls[-1]["reasoning"] == {"effort": effort}


def test_chat_settings_do_not_change_consulting_request(monkeypatch):
    calls = _provider(monkeypatch)
    monkeypatch.setenv("OPENAI_CHAT_MODEL", "gpt-5.4")
    monkeypatch.setenv("OPENAI_CHAT_REASONING_EFFORT", "high")
    ai.generate_consulting(crop="tomato", dashboard={}, model="gpt-5.4-mini")
    assert calls[-1]["model"] == "gpt-5.4-mini"
    assert "reasoning" not in calls[-1]


def test_compendium_context_and_adjacent_passages_reach_the_answer_once(monkeypatch):
    calls = _provider(monkeypatch, "夜間 관리는 조건을 구분합니다. [S1][S2]")
    excerpt = "夜間の温湿度条件。" + "원문의 적용 조건을 읽습니다. " * 90
    cards = [_card(
        1, title="農業技術大系 トマト", source_locator="page:89", evidence_excerpt=excerpt,
        source_context={
            "language": "ja", "region": "Japan", "reference_kind": "agronomy_compendium",
            "section_title": "夜間の温湿度管理",
        },
    )] + [_card(index) for index in range(2, 14)]
    cards[1].update(evidence_role="adjacent", context_for_chunk_id=101)
    cards[2]["evidence_role"] = "application"
    reading = {"approach": "principle_conditions_management", "condition_passage_found": True}
    dashboard = _dashboard(cards, reading)
    original = deepcopy(dashboard)

    answer = ai.generate_chat_reply(
        crop="tomato", messages=[{"role": "user", "content": "그럼 밤에는 어떻게 관리해?"}],
        dashboard=dashboard,
    )
    prompt = calls[0]["input"][0]["content"]
    assert len(excerpt) > 1200
    assert prompt.count(excerpt.strip()) == 1
    assert '"source_id": "S12"' in prompt and '"source_id": "S13"' not in prompt
    assert '"language": "ja"' in prompt and '"region": "Japan"' in prompt
    assert '"section_title": "夜間の温湿度管理"' in prompt
    assert '"evidence_role": "adjacent"' in prompt
    assert '"evidence_role": "application"' in prompt
    assert '"context_for_chunk_id": 101' in prompt
    assert "principle_conditions_management" in prompt
    assert answer == "夜間 관리는 조건을 구분합니다."
    assert dashboard == original


@pytest.mark.parametrize("markers", ["[S1][S2]", "[S1, S2]", "[S1; S2]"])
def test_internal_source_markers_are_hidden_without_removing_scientific_notation(markers):
    dashboard = _dashboard([
        _card(1, title="원문 자료", source_locator="page:89"),
        _card(2, title="재배 기록", source_locator="Sheet1:7"),
    ])
    assert ai._strip_chat_source_markers("설명 " + markers) == "설명"
    assert ai._strip_chat_source_markers("VPD (kPa), 범위 [0, 1] [S1]") == "VPD (kPa), 범위 [0, 1]"
    assert ai._strip_chat_source_markers("조건 [S1](RH 80%)") == "조건(RH 80%)"
    assert ai._chat_source_cards(dashboard)[0]["source_locator"] == "page:89"


def test_unknown_or_unsent_source_id_cannot_acquire_a_title(monkeypatch):
    cards = [_card(index) for index in range(1, 14)]
    _provider(monkeypatch, "알려진 근거 [S1], 미제공 근거 [S13], 없는 근거 [S99].")
    answer = ai.generate_chat_reply(crop="tomato", messages=[], dashboard=_dashboard(cards))
    assert answer == "알려진 근거, 미제공 근거, 없는 근거."
    assert "재배 자료 13" not in answer


def test_legacy_card_ids_are_stable_and_do_not_shadow_explicit_ids():
    legacy = _card(1, title="이전 자료", source_locator="page:7")
    legacy.pop("source_id")
    dashboard = _dashboard([legacy, _card(2, source_id="S1", title="명시한 자료")])
    assert [card["source_id"] for card in ai._chat_source_cards(dashboard)] == ["S2", "S1"]
    assert ai._strip_chat_source_markers("[S2][S1]") == ""
    assert "source_id" not in legacy


def test_missing_metadata_stays_internal_and_ambiguous_ids_are_not_used():
    dashboard = _dashboard([
        _card(1, title="부분 자료", source_locator=None),
        _card(2, source_id="S3"),
        _card(3, source_id="S3"),
    ])
    assert ai._strip_chat_source_markers("[S1] [S3]") == ""
    assert [card["source_id"] for card in ai._chat_source_cards(dashboard)] == ["S1"]


def test_compendium_prompt_keeps_source_conditions_and_allows_question_specific_structure():
    korean = ai._chat_system_prompt("tomato", "ko")
    english = ai._chat_system_prompt("tomato", "en")
    assert "농업기술대계" in korean and "조건에 따른 판단" in korean
    assert "일본어 원문은 한국어로" in korean
    assert "원문을 길게 복사하거나" in korean
    assert "작물·생육단계·온도·광·주야간" in korean
    assert "단순 개념 질문은 짧은 설명이면 충분" in korean
    assert "확인 질문 하나만" in korean and "내부 검토용" in korean
    assert "one concrete follow-up" in english
    assert "Japanese regional practices, local cultivars and historical" in english
    assert "Do not use a report structure" not in english
