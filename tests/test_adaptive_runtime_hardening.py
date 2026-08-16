import asyncio
import time
from datetime import UTC, datetime, timedelta

from model_informed_greenhouse_dashboard.backend.app.services.adaptive_advisor.contracts import (
    AdaptiveAdvisorRequest,
    AdaptiveNode,
    AnswerStatus,
)
from model_informed_greenhouse_dashboard.backend.app.services.adaptive_advisor.conversation_store import (
    ConversationStore,
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


NOW = datetime(2026, 8, 16, 1, 0, tzinfo=UTC)


def _live_point(at: datetime) -> dict:
    return {
        "datetime": at.isoformat(),
        "temperature": 24.2,
        "canopyTemp": 24.9,
        "humidity": 72.0,
        "co2": 680.0,
        "light": 520.0,
        "vpd": 0.85,
        "photosynthesis": 15.0,
        "stomatalConductance": 0.22,
    }


def _lane_payload(tab_name: str) -> dict:
    analysis_key = {
        "environment": "environment_analysis",
        "physiology": "physiology_analysis",
        "work": "work_analysis",
        "harvest_market": "harvest_market_analysis",
    }[tab_name]
    return {
        "status": "success",
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
                    "confidence": 0.85,
                    "recommended": {
                        "title": "야간 온도 단계 조정",
                        "operator": "요청한 범위에서 야간 온도를 단계적으로 조정합니다.",
                        "time_window": "오늘 밤",
                        "expected_effect": "수확 집중 위험을 완화합니다.",
                        "control": "temperature_night",
                    },
                },
                "sensitivity": {"confidence": 0.8, "top_levers": []},
                "constraint_checks": {
                    "status": "pass",
                    "violated_constraints": [],
                },
                "answer_focus": {
                    "admissible": True,
                    "matched_user_request": True,
                    "requested_delta": -1.0,
                    "matched_delta": -1.0,
                    "unit": "℃",
                    "confidence": 0.84,
                    "risk_flags": [],
                    "violated_constraints": [],
                },
                "best_actions": [
                    {
                        "title": "야간 온도 단계 조정",
                        "operator": "요청한 범위에서 야간 온도를 단계적으로 조정합니다.",
                        "time_window": "오늘 밤",
                        "expected_effect": "수확 집중 위험을 완화합니다.",
                        "control": "temperature_night",
                    }
                ],
            },
            analysis_key: {
                "summary": f"{tab_name} ready",
                "cause_hypotheses": ["기공 제한 가능성을 우선 확인합니다."],
            },
        },
    }


def _deps(tmp_path, *, server_at: datetime, slow_retrieval: bool = False):
    telemetry = TelemetryStore(tmp_path / "telemetry.sqlite3")
    telemetry.append(
        _live_point(server_at),
        crop="tomato",
        greenhouse_id="house-1",
        source="test",
    )
    telemetry.append(
        {
            **_live_point(server_at - timedelta(days=1)),
            "photosynthesis": 19.0,
            "stomatalConductance": 0.31,
        },
        crop="tomato",
        greenhouse_id="house-1",
        source="test",
    )

    def retrieval_builder(**_kwargs):
        if slow_retrieval:
            time.sleep(0.1)
        return {
            "status": "ready",
            "summary": {"returned_count": 1},
            "llm_context": {"evidence_cards": [{"topic_major": "crop_physiology"}]},
        }

    def narrator_builder(**kwargs):
        packet = kwargs["answer_packet"]
        return {
            "status": "success",
            "text": (
                f"{packet['direct_answer']} 원인은 기공 제한 가능성입니다. "
                "오늘 밤 조치를 적용하고 자료 한계를 확인한 뒤 다시 계산하세요."
            ),
        }

    return AdaptiveAdvisorDependencies(
        tab_builder=lambda **kwargs: _lane_payload(kwargs["tab_name"]),
        narrator_builder=narrator_builder,
        retrieval_builder=retrieval_builder,
        calendar_store=OperationsCalendarStore(tmp_path / "operations.json"),
        telemetry_store=telemetry,
        market_store=MarketObservationStore(tmp_path / "market.sqlite3"),
        quality_ledger=QualityLedger(tmp_path / "quality.sqlite3"),
        conversation_store=ConversationStore(tmp_path / "conversation.sqlite3"),
        node_timeouts=(
            {AdaptiveNode.EXPERT_WIKI: 0.01}
            if slow_retrieval
            else {}
        ),
        clock=lambda: NOW,
    )


def test_fresh_server_snapshot_answers_without_browser_current_state(tmp_path):
    deps = _deps(tmp_path, server_at=NOW - timedelta(minutes=2))
    result = asyncio.run(
        execute_adaptive_advisor(
            AdaptiveAdvisorRequest(
                crop="tomato",
                greenhouse_id="house-1",
                question="현재 상태 알려줘",
                dashboard={"metrics": {"growth": {"lai": 2.6}}},
                include_narrative=False,
            ),
            deps=deps,
        )
    )
    assert result.quality_profile.answer_status is not AnswerStatus.NEEDS_DATA
    assert result.quality_profile.data.snapshot_source == "server"
    assert result.quality_profile.data.snapshot_age_seconds == 120.0
    assert result.machine_payload["snapshot_resolution"]["primary_source"] == "server"


def test_stale_server_snapshot_is_not_promoted_to_operational(tmp_path):
    deps = _deps(tmp_path, server_at=NOW - timedelta(hours=3))
    result = asyncio.run(
        execute_adaptive_advisor(
            AdaptiveAdvisorRequest(
                crop="tomato",
                greenhouse_id="house-1",
                question="현재 상태 알려줘",
                dashboard={},
                include_narrative=False,
            ),
            deps=deps,
        )
    )
    assert result.quality_profile.answer_status in {
        AnswerStatus.NEEDS_DATA,
        AnswerStatus.MONITORING_FIRST,
    }
    assert result.quality_profile.data.snapshot_source == "server_stale"


def test_optional_lane_timeout_degrades_instead_of_hanging(tmp_path):
    deps = _deps(
        tmp_path,
        server_at=NOW - timedelta(minutes=2),
        slow_retrieval=True,
    )
    result = asyncio.run(
        execute_adaptive_advisor(
            AdaptiveAdvisorRequest(
                crop="tomato",
                greenhouse_id="house-1",
                question="왜 오늘 광합성이 어제보다 낮아?",
                dashboard={"metrics": {"growth": {"lai": 2.6}}},
                include_narrative=False,
            ),
            deps=deps,
        )
    )
    expert_trace = next(
        item for item in result.trace if item.node is AdaptiveNode.EXPERT_WIKI
    )
    assert expert_trace.timed_out is True
    assert expert_trace.timeout_seconds == 0.01
    assert result.status == "degraded"
    assert result.quality_profile.answer_status is AnswerStatus.CONDITIONAL


def test_server_thread_resolves_anaphoric_what_if_follow_up(tmp_path):
    deps = _deps(tmp_path, server_at=NOW - timedelta(minutes=2))
    first = asyncio.run(
        execute_adaptive_advisor(
            AdaptiveAdvisorRequest(
                crop="tomato",
                greenhouse_id="house-1",
                question="야간 온도를 1℃ 낮추면 수확량은?",
                dashboard={"metrics": {"growth": {"lai": 2.6}}},
                include_narrative=False,
            ),
            deps=deps,
        )
    )
    second = asyncio.run(
        execute_adaptive_advisor(
            AdaptiveAdvisorRequest(
                crop="tomato",
                greenhouse_id="house-1",
                thread_id=first.thread_id,
                question="그럼 0.5℃만?",
                dashboard={"metrics": {"growth": {"lai": 2.6}}},
                include_narrative=False,
            ),
            deps=deps,
        )
    )
    assert second.thread_id == first.thread_id
    assert second.plan.intent.value == "WHAT_IF"
    assert "temperature_night" in second.plan.controls
    assert second.machine_payload["conversation"]["loaded_message_count"] >= 2
