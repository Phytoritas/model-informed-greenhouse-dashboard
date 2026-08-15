import asyncio
from datetime import UTC, date, datetime, timedelta

from model_informed_greenhouse_dashboard.backend.app.services.adaptive_advisor.contracts import (
    AdaptiveAdvisorRequest,
    AnswerCapability,
    AnswerStatus,
    OperationsCalendar,
    OperationsCalendarEvent,
    OperationsEventType,
)
from model_informed_greenhouse_dashboard.backend.app.services.adaptive_advisor.executor import (
    AdaptiveAdvisorDependencies,
    execute_adaptive_advisor,
)
from model_informed_greenhouse_dashboard.backend.app.services.adaptive_advisor.operations_calendar import (
    OperationsCalendarStore,
)


def _dashboard():
    now = datetime.now(UTC).isoformat()
    return {
        "currentData": {
            "datetime": now,
            "temperature": 24.2,
            "humidity": 72.0,
            "co2": 680.0,
            "light": 520.0,
            "vpd": 0.85,
            "photosynthesis": 18.4,
        },
        "metrics": {"growth": {"lai": 2.6}, "yield": {"predictedWeekly": 420}},
        "recentSummary": {
            "variables": {
                "temperature": {"trend": "flat"},
                "humidity": {"trend": "up"},
                "co2": {"trend": "flat"},
                "light": {"trend": "flat"},
                "photosynthesis": {"trend": "down"},
            }
        },
        "weather": {"status": "ready", "daily": [{"date": "2026-08-17"}]},
        "market": {"status": "ready", "trend": {"risk": "price-down"}},
        "forecast": {"daily": [{"harvest_kg": 80.0}]},
        "rtr": {"live": {"deltaTempC": 0.3}},
    }


def _lane_payload(tab_name: str, *, admissible: bool = True):
    analysis_key = {
        "environment": "environment_analysis",
        "physiology": "physiology_analysis",
        "work": "work_analysis",
        "harvest_market": "harvest_market_analysis",
    }[tab_name]
    return {
        "status": "success",
        "message": f"{tab_name} ready",
        "machine_payload": {
            "model_runtime": {
                "status": "ready",
                "state_snapshot": {"inferred_fields": []},
                "scenario": {
                    "confidence": 0.86,
                    "options": [{"action": "night temp -0.5C"}],
                },
                "sensitivity": {"confidence": 0.82, "top_levers": []},
                "constraint_checks": {
                    "status": "pass",
                    "violated_constraints": [],
                },
                "answer_focus": {
                    "admissible": admissible,
                    "matched_user_request": True if admissible else False,
                    "requested_delta": -0.5,
                    "matched_delta": -0.5 if admissible else None,
                    "risk_flags": (
                        []
                        if admissible
                        else ["requested_delta_out_of_model_range"]
                    ),
                    "violated_constraints": [],
                },
            },
            analysis_key: {"summary": f"{tab_name} adaptive summary"},
        },
    }


def _deps(tmp_path, *, admissible: bool = True):
    store = OperationsCalendarStore(tmp_path / "operations.json")
    today = date.today()
    store.save(
        OperationsCalendar(
            greenhouse_id="tomato",
            events=[
                OperationsCalendarEvent(
                    event_id="holiday",
                    event_type=OperationsEventType.SHIPMENT_BLACKOUT,
                    start_date=today + timedelta(days=2),
                    end_date=today + timedelta(days=3),
                    title="휴가 출하 중단",
                ),
                OperationsCalendarEvent(
                    event_id="post-holiday-shipment",
                    event_type=OperationsEventType.SHIPMENT_TARGET,
                    start_date=today + timedelta(days=4),
                    end_date=today + timedelta(days=4),
                    title="휴가 후 출하",
                    amount=600,
                    unit="kg",
                ),
            ],
        ),
        expected_revision=0,
    )

    def tab_builder(**kwargs):
        return _lane_payload(kwargs["tab_name"], admissible=admissible)

    def retrieval_builder(**kwargs):
        return {
            "status": "ready",
            "summary": {"status": "ready", "returned_count": 2},
            "llm_context": {
                "evidence_cards": [{"topic_major": "crop_physiology"}]
            },
        }

    def chat_builder(**kwargs):
        return {
            "status": "success",
            "text": (
                "휴일 전에는 수확 집중을 피하고 야간 온도 조정을 "
                "조건부로 적용하세요."
            ),
        }

    return AdaptiveAdvisorDependencies(
        tab_builder=tab_builder,
        chat_builder=chat_builder,
        retrieval_builder=retrieval_builder,
        calendar_store=store,
        clock=lambda: datetime.now(UTC),
    )


def test_cross_domain_graph_reaches_constrained_optimization(tmp_path):
    request = AdaptiveAdvisorRequest(
        crop="tomato",
        question=(
            "다음 주 휴가라 출하가 없고 휴일 다음날 물량과 가격 하락이 예상돼. "
            "온도와 수확 계획을 최적화해줘"
        ),
        dashboard=_dashboard(),
        include_narrative=True,
    )
    result = asyncio.run(execute_adaptive_advisor(request, deps=_deps(tmp_path)))

    assert result.status == "success"
    assert (
        result.quality_profile.capability
        is AnswerCapability.CONSTRAINED_OPTIMIZATION
    )
    assert result.quality_profile.answer_status is AnswerStatus.OPERATIONAL
    assert result.admission.admitted is True
    assert "휴일" in result.text
    nodes = [item.node.value for item in result.trace]
    assert nodes == [node.value for node in result.plan.nodes]
    assert result.machine_payload["fixed_safety_spine"] == [
        "constraint_gate",
        "answer_admission",
        "quality_gate",
    ]


def test_model_out_of_range_is_refused_before_narration(tmp_path):
    request = AdaptiveAdvisorRequest(
        crop="tomato",
        question="야간 온도를 10℃ 낮추면 수확량이 어떻게 돼?",
        dashboard=_dashboard(),
        include_narrative=False,
    )
    result = asyncio.run(
        execute_adaptive_advisor(
            request,
            deps=_deps(tmp_path, admissible=False),
        )
    )

    assert result.status == "refused"
    assert result.constraint_gate.status.value == "FAIL"
    assert result.admission.admitted is False
    assert result.quality_profile.answer_status is AnswerStatus.REFUSED
    assert "제약조건" in result.text


def test_missing_live_data_lowers_answer_to_needs_data(tmp_path):
    request = AdaptiveAdvisorRequest(
        crop="tomato",
        question="현재 상태 알려줘",
        dashboard={},
        include_narrative=False,
    )
    result = asyncio.run(execute_adaptive_advisor(request, deps=_deps(tmp_path)))
    assert result.quality_profile.answer_status is AnswerStatus.NEEDS_DATA
    assert result.quality_profile.data.current_state_coverage == 0
