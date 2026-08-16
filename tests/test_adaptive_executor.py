import asyncio
from datetime import UTC, date, datetime, timedelta

from model_informed_greenhouse_dashboard.backend.app.services.adaptive_advisor.contracts import (
    AdaptiveAdvisorRequest,
    AnswerCapability,
    AnswerStatus,
    MarketArrivalObservation,
    OperationsCalendar,
    OperationsCalendarEvent,
    OperationsEventType,
)
from model_informed_greenhouse_dashboard.backend.app.services.adaptive_advisor.executor import (
    AdaptiveAdvisorDependencies,
    execute_adaptive_advisor,
)
from model_informed_greenhouse_dashboard.backend.app.services.adaptive_advisor.market_supply_shock import (
    MarketObservationStore,
)
from model_informed_greenhouse_dashboard.backend.app.services.adaptive_advisor.operations_calendar import (
    OperationsCalendarStore,
)
from model_informed_greenhouse_dashboard.backend.app.services.adaptive_advisor.quality_ledger import (
    QualityLedger,
)
from model_informed_greenhouse_dashboard.backend.app.services.adaptive_advisor.telemetry_store import (
    TelemetryStore,
)


REFERENCE = datetime(2026, 8, 16, 1, 0, tzinfo=UTC)


def _dashboard():
    return {
        "currentData": {
            "datetime": REFERENCE.isoformat(),
            "temperature": 24.2,
            "canopyTemp": 25.0,
            "humidity": 72.0,
            "co2": 680.0,
            "light": 520.0,
            "vpd": 0.85,
            "photosynthesis": 14.4,
            "stomatalConductance": 0.20,
        },
        "metrics": {
            "growth": {"lai": 2.6},
            "yield": {"predictedWeekly": 420},
        },
        "weather": {"status": "ready", "daily": [{"date": "2026-08-17"}]},
        "market": {"status": "ready", "market_id": "wholesale-a"},
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
                "state_snapshot": {
                    "inferred_fields": [],
                    "limiting_factor": "stomatal",
                },
                "provenance": {
                    "observed_signal_score": 0.9,
                    "inferred_fields": [],
                },
                "scenario": {
                    "confidence": 0.86,
                    "options": [
                        {
                            "title": "야간 온도 소폭 조정",
                            "operator": "야간 온도를 단계적으로 조정합니다.",
                            "time_window": "오늘 밤",
                            "expected_effect": "출하 집중을 완화합니다.",
                            "control": "temperature_night",
                        }
                    ],
                    "recommended": {
                        "title": "야간 온도 소폭 조정",
                        "operator": "야간 온도를 단계적으로 조정합니다.",
                        "time_window": "오늘 밤",
                        "expected_effect": "출하 집중을 완화합니다.",
                        "control": "temperature_night",
                    },
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
                    "confidence": 0.84,
                    "risk_flags": (
                        [] if admissible else ["requested_delta_out_of_model_range"]
                    ),
                    "violated_constraints": [],
                },
                "best_actions": [
                    {
                        "title": "야간 온도 소폭 조정",
                        "operator": "야간 온도를 단계적으로 조정합니다.",
                        "time_window": "오늘 밤",
                        "expected_effect": "출하 집중을 완화합니다.",
                        "control": "temperature_night",
                    }
                ],
            },
            analysis_key: {
                "summary": f"{tab_name} adaptive summary",
                "cause_hypotheses": ["기공 제한 가능성이 우선입니다."],
            },
        },
    }


def _deps(tmp_path, *, admissible: bool = True):
    telemetry = TelemetryStore(tmp_path / "telemetry.sqlite3")
    market = MarketObservationStore(tmp_path / "market.sqlite3")
    calendar = OperationsCalendarStore(tmp_path / "operations.json")
    quality = QualityLedger(tmp_path / "quality.sqlite3")

    for minutes in (-40, -20, 0):
        telemetry.append(
            {
                "datetime": (REFERENCE - timedelta(days=1) + timedelta(minutes=minutes)).isoformat(),
                "temperature": 24.0,
                "canopyTemp": 24.4,
                "humidity": 72,
                "co2": 680,
                "light": 510,
                "vpd": 0.82,
                "photosynthesis": 19.0,
                "stomatalConductance": 0.32,
            },
            crop="tomato",
            greenhouse_id="tomato",
            source="test",
        )

    today = REFERENCE.astimezone().date()
    calendar.save(
        OperationsCalendar(
            greenhouse_id="tomato",
            events=[
                OperationsCalendarEvent(
                    event_id="holiday",
                    event_type=OperationsEventType.MARKET_CLOSURE,
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
    start = today - timedelta(days=70)
    market.append_many(
        [
            MarketArrivalObservation(
                market_id="wholesale-a",
                crop="tomato",
                observation_date=start + timedelta(days=index),
                arrival_volume_kg=1000 + 20 * ((start + timedelta(days=index)).weekday()),
                wholesale_price_krw_per_kg=3500 - 8 * ((start + timedelta(days=index)).weekday()),
                source="test",
            )
            for index in range(70)
        ]
    )

    def tab_builder(**kwargs):
        return _lane_payload(kwargs["tab_name"], admissible=admissible)

    def retrieval_builder(**kwargs):
        return {
            "status": "ready",
            "summary": {"returned_count": 2},
            "llm_context": {"evidence_cards": [{"topic_major": "crop_physiology"}]},
        }

    def narrator_builder(**kwargs):
        return {
            "status": "success",
            "text": (
                "휴일 이후 반입 집중 때문에 가격 하방 압력이 커질 수 있어 조건부 조정이 필요합니다. "
                "오늘 출하 계획과 야간 온도 전략을 함께 정렬하고, 새 반입량이 확인되면 다시 계산하세요."
            ),
        }

    return AdaptiveAdvisorDependencies(
        tab_builder=tab_builder,
        narrator_builder=narrator_builder,
        retrieval_builder=retrieval_builder,
        calendar_store=calendar,
        telemetry_store=telemetry,
        market_store=market,
        quality_ledger=quality,
        clock=lambda: REFERENCE,
    )


def test_cross_domain_execution_uses_server_history_market_and_ledger(tmp_path):
    deps = _deps(tmp_path)
    request = AdaptiveAdvisorRequest(
        crop="tomato",
        question=(
            "다음 주 휴가라 출하가 없고 휴일 다음날 반입량과 가격 하락이 예상돼. "
            "온도와 수확 계획을 최적화해줘"
        ),
        dashboard=_dashboard(),
        include_narrative=True,
    )
    result = asyncio.run(execute_adaptive_advisor(request, deps=deps))

    assert result.run_id
    assert result.quality_profile.capability is AnswerCapability.CONSTRAINED_OPTIMIZATION
    assert result.quality_profile.answer_status in {
        AnswerStatus.OPERATIONAL,
        AnswerStatus.CONDITIONAL,
    }
    assert result.machine_payload["history_authority"] == "server_timeseries"
    history = result.machine_payload["node_outputs"]["history_compare"]
    assert history["history_source"] == "server_timeseries"
    market = result.machine_payload["node_outputs"]["market_outlook"]
    assert market["model"] == "holiday-arrival-supply-shock.v2"
    assert deps.quality_ledger.get_run(result.run_id) is not None
    assert [item.node.value for item in result.trace] == [
        node.value for node in result.plan.nodes
    ]


def test_out_of_range_request_fails_closed_before_render(tmp_path):
    deps = _deps(tmp_path, admissible=False)
    request = AdaptiveAdvisorRequest(
        crop="tomato",
        question="야간 온도를 10℃ 낮추면 수확량이 어떻게 돼?",
        dashboard=_dashboard(),
        include_narrative=False,
    )
    result = asyncio.run(execute_adaptive_advisor(request, deps=deps))

    assert result.status == "refused"
    assert result.constraint_gate.status.value == "FAIL"
    assert result.admission.admitted is False
    assert result.quality_profile.answer_status is AnswerStatus.REFUSED
    assert result.quality_profile.response.source == "deterministic_only"


def test_missing_live_data_lowers_answer_to_needs_data(tmp_path):
    deps = _deps(tmp_path)
    request = AdaptiveAdvisorRequest(
        crop="tomato",
        question="현재 상태 알려줘",
        dashboard={},
        include_narrative=False,
    )
    result = asyncio.run(execute_adaptive_advisor(request, deps=deps))
    assert result.quality_profile.answer_status is AnswerStatus.NEEDS_DATA
    assert result.quality_profile.data.current_state_coverage == 0
