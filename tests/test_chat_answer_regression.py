"""Chat boundary regressions; all provider and scenario calls are intercepted."""

from copy import deepcopy
import json

import pytest

from model_informed_greenhouse_dashboard.backend.app.services import (
    advisor_orchestration as advisor,
    openai_service as ai,
)


def _retrieval(status="ready", crop="tomato"):
    cards = [{
        "source_id": "S1",
        "title": "토마토 온실 관리 자료",
        "source_locator": "p. 42",
        "document_id": 7,
        "chunk_id": 19,
        "topic_major": "physiology",
        "evidence_role": "main",
        "source_context": {"language": "ko", "region": "Korea", "reference_kind": "technical_guide"},
        "evidence_excerpt": "시험 조건의 VPD 범위는 0.5–1.2 kPa였다.",
    }] if status == "ready" else []
    return {
        "status": status,
        "summary": {"status": status},
        "llm_context": {"status": status, "evidence_cards": cards, "resolved_crop": crop},
    }


def _capture(monkeypatch, retrieval):
    captured = {}

    def unexpected_scenario(**_):
        pytest.fail("chat must not construct a full scenario fan")

    def generate(**kwargs):
        captured.update(kwargs)
        return "질문에 대한 설명입니다."

    monkeypatch.setattr(advisor, "build_knowledge_catalog", lambda _: {})
    monkeypatch.setattr(advisor, "build_chat_advisor_context", lambda **_: deepcopy(retrieval))
    monkeypatch.setattr(advisor, "_build_chat_pesticide_context", lambda **_: None)
    monkeypatch.setattr(advisor, "_build_model_runtime_payload", unexpected_scenario)
    monkeypatch.setattr(ai, "_generate_text", generate)
    return captured


def _context(captured):
    return json.loads(captured["input_data"][0]["content"].split("참고 정보(JSON):\n", 1)[1])


def test_definition_skips_scenarios_and_preserves_reference_values_and_locations(monkeypatch):
    retrieval = _retrieval()
    captured = _capture(monkeypatch, retrieval)
    dashboard = {
        "data": {"temperature": 26.9, "vpd": 1.23},
        "source": "csv_replay",
        "simulation_time": "2024-07-09T12:00:00",
        "knowledge": {"titles": ["UNRELATED_CATALOG"], "old_json": {"cost": 99000}},
        "market": {"unrelated": "UNRELATED_MARKET"},
    }
    original = deepcopy(dashboard)
    response = advisor.build_advisor_chat_response(
        crop="tomato", messages=[{"role": "user", "content": "VPD가 뭐야?"}], dashboard=dashboard,
    )
    prompt = captured["input_data"][0]["content"]
    assert response["text"] == "질문에 대한 설명입니다."
    assert response["status"] == "success"
    assert response["grounded_status"] == "ready"
    assert len(response["sources"]) == 1
    assert {key: response["sources"][0][key] for key in (
        "source_id", "title", "source_locator", "document_id", "chunk_id",
    )} == {
        "source_id": "S1", "title": "토마토 온실 관리 자료", "source_locator": "p. 42", "document_id": 7, "chunk_id": 19,
    }
    assert prompt.count(retrieval["llm_context"]["evidence_cards"][0]["evidence_excerpt"]) == 1
    assert "토마토 온실 관리 자료" in prompt and "p. 42" in prompt
    assert "UNRELATED_CATALOG" not in prompt and "UNRELATED_MARKET" not in prompt
    assert "currentData는 실시간 계측값" not in prompt
    assert "모든 숫자는 제공된 모델 계산에서만" not in captured["instructions"]
    assert "4만원" not in captured["instructions"]
    assert _context(captured)["data"]["temperature"] == 26.9
    assert response["machine_payload"]["model_runtime"]["status"] == "not_requested"
    assert dashboard == original


def test_runtime_status_without_search_is_not_a_retrieval_failure(monkeypatch):
    _capture(monkeypatch, _retrieval("skipped"))
    monkeypatch.setattr(ai, "_generate_text", lambda **_: pytest.fail("Runtime state does not need text generation"))
    response = advisor.build_advisor_chat_response(
        crop="tomato",
        messages=[{"role": "user", "content": "지금 이 시뮬레이션은 실행 중이야, 일시정지 상태야?"}],
        dashboard={"simulation_runtime": {"status": "paused", "simulated_at": "2024-06-13T01:40:00+09:00"}},
    )
    assert response["grounded_status"] == "not_requested"
    assert response["sources"] == []
    assert "일시정지" in response["text"]
    assert "2024-06-13 01:40:00" in response["text"]
    assert "UTC+09:00" in response["text"]
    assert "paused" not in response["text"] and "task_alive" not in response["text"]


@pytest.mark.parametrize("status, expected", [
    ("no_matches", "no_matches"),
    ("database_missing", "retrieval_unavailable"),
    ("retrieval_unavailable", "retrieval_unavailable"),
])
def test_retrieval_failure_keeps_helpful_answer_and_discards_previous_evidence(monkeypatch, status, expected):
    captured = _capture(monkeypatch, _retrieval(status))
    response = advisor.build_advisor_chat_response(
        crop="tomato", messages=[{"role": "user", "content": "현재 온도는?"}],
        dashboard={"data": {"temperature": 22}, "knowledge": {
            "advisor_retrieval_context": {"evidence_cards": [{"evidence_excerpt": "OLD_EVIDENCE"}]},
        }},
    )
    assert response["status"] == "success"
    assert response["grounded_status"] == expected
    assert response["sources"] == []
    assert _context(captured)["data"]["temperature"] == 22
    assert "OLD_EVIDENCE" not in captured["input_data"][0]["content"]


@pytest.mark.parametrize("question, control, value, unit, mode", [
    ("CO2를 100ppm 올리면?", "co2_setpoint_day", 100, "ppm", "delta"),
    ("야간 온도를 1도 낮춰 보면?", "temperature_night", -1, "°C", "delta"),
    ("What if I raise temperature by 1 C?", "temperature_day", 1, "°C", "delta"),
    ("습도를 5% 낮추면?", "rh_target", -5, "%", "delta"),
    ("CO2를 800ppm으로 올리면?", "co2_setpoint_day", 800, "ppm", "target"),
])
def test_what_if_keeps_requested_units_without_uncalibrated_effects(monkeypatch, question, control, value, unit, mode):
    captured = _capture(monkeypatch, _retrieval())
    response = advisor.build_advisor_chat_response(
        crop="tomato", messages=[{"role": "user", "content": question}],
        dashboard={"data": {"temperature": 23, "photosynthesis": 12.8, "simulationStatus": "ok"}},
    )
    runtime = response["machine_payload"]["model_runtime"]
    assert runtime["requested_change"] == {
        "question": question, "control": control, "value": value, "unit": unit, "mode": mode,
    }
    assert runtime["effects"] is None
    assert runtime["calculation_basis"] == "uncalibrated_comparison_indices"
    assert _context(captured)["data"]["photosynthesis"] == 12.8
    assert "yield_delta" not in captured["input_data"][0]["content"]


def test_follow_up_uses_user_change_and_omits_old_assistant_json(monkeypatch):
    captured = _capture(monkeypatch, _retrieval())
    response = advisor.build_advisor_chat_response(crop="tomato", messages=[
        {"role": "user", "content": "야간 온도를 1도 낮추면?"},
        {"role": "assistant", "content": '{"old_yield_prediction": 123456}'},
        {"role": "user", "content": "그럼 0.5도는?"},
    ])
    change = response["machine_payload"]["model_runtime"]["requested_change"]
    assert change["control"] == "temperature_night" and change["value"] == -0.5
    assert captured["input_data"][-1]["content"] == "그럼 0.5도는?"
    assert all("old_yield_prediction" not in message["content"] for message in captured["input_data"])


def test_current_value_is_not_parsed_as_requested_delta():
    runtime = advisor._chat_model_runtime_context([
        {"role": "user", "content": "현재 26도인데 온도를 낮추면?"},
    ])
    assert runtime["requested_change"] == {"question": "현재 26도인데 온도를 낮추면?"}
    assert runtime["effects"] is None


@pytest.mark.parametrize("model_status", ["failed", "unconverged", "invalid_input"])
def test_failed_models_are_missing_even_when_task_is_active(monkeypatch, model_status):
    captured = _capture(monkeypatch, _retrieval())
    advisor.build_advisor_chat_response(
        crop="tomato", messages=[{"role": "user", "content": "현재 생육과 광합성 상태는?"}],
        dashboard={
            "source": "csv_replay",
            "data": {"temperature": 22, "photosynthesis": 123.456, "transpiration": 9.87},
            "simulation_runtime": {"status": "active", "task_alive": True, "last_model_status": model_status},
            "metrics": {"growth": {"biomass": 987.654}},
            "recentSummary": {"variables": {"photosynthesis": {"last": 123.456}, "temperature": {"last": 22}}},
        },
    )
    ctx = _context(captured)
    assert ctx["simulation_runtime"]["status"] == "active"
    assert ctx["data_validity"]["invalid_model"] is True
    assert ctx["data"]["photosynthesis"] is None and ctx["data"]["transpiration"] is None
    assert ctx["data"]["temperature"] == 22
    assert "metrics" not in ctx and "photosynthesis" not in ctx["recentSummary"]["variables"]
    assert "123.456" not in captured["input_data"][0]["content"]


def test_paused_snapshot_preserves_valid_zero_and_field_availability():
    dashboard = {
        "currentData": {"temperature": 0, "photosynthesis": 78.91, "simulationStatus": "ok", "fieldAvailability": {"photosynthesis": False}},
        "simulation_runtime": {"status": "paused", "last_model_status": "ok", "simulated_at": "2024-07-09T00:00:00"},
        "recentSummary": {"variables": {"photosynthesis": {"last": 78.91}}},
    }
    original = deepcopy(dashboard)
    ctx = ai._dashboard_without_evidence_cards(dashboard)
    assert ctx["data"]["temperature"] == 0
    assert ctx["data"]["photosynthesis"] is None
    assert ctx["simulation_runtime"]["status"] == "paused"
    assert ctx["data_validity"]["stale"] is False
    assert ctx["recentSummary"]["variables"] == {}
    assert dashboard == original


def test_stale_snapshot_cannot_supply_control_values_or_old_runtime_numbers():
    ctx = ai._dashboard_without_evidence_cards({
        "stale": True,
        "data": {"temperature": 29, "photosynthesis": 12.3},
        "metrics": {"growth": {"biomass": 456}},
        "model_runtime": {"status": "ready", "answer_focus": {"effects": {"yield_delta": 123}}, "control_precision_matrix": {"temperature_day": []}},
    }, [{"role": "user", "content": "지금 온도를 내려야 하나?"}])
    assert ctx["data"]["temperature"] is None and ctx["data"]["photosynthesis"] is None
    assert "metrics" not in ctx and "answer_focus" not in ctx["model_runtime"]
    assert ctx["model_runtime"]["calculation_basis"] == "uncalibrated_comparison_indices"


def test_explicit_other_crop_does_not_receive_selected_crop_dashboard(monkeypatch):
    captured = _capture(monkeypatch, _retrieval("no_matches", crop="cucumber"))
    response = advisor.build_advisor_chat_response(
        crop="tomato", messages=[{"role": "user", "content": "오이는 지금 온도에서 어떻게 반응해?"}],
        dashboard={"data": {"temperature": 31.234}, "source": "csv_replay"},
    )
    ctx = _context(captured)
    assert response["status"] == "success"
    assert ctx["chat_crop_scope"] == {"dashboard_crop": "tomato", "question_crop": "cucumber", "dashboard_applies": False}
    assert "31.234" not in captured["input_data"][0]["content"]
