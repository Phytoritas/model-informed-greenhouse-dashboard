import pytest
from pydantic import ValidationError

from model_informed_greenhouse_dashboard.backend.app.services.adaptive_advisor.contracts import (
    AdaptiveAdvisorRequest,
    AdaptiveGraphPlan,
    AdaptiveNode,
    AdvisorIntent,
)
from model_informed_greenhouse_dashboard.backend.app.services.adaptive_advisor.planner import (
    build_adaptive_plan,
    classify_intent,
)


def request(question: str, *, narrative: bool = False) -> AdaptiveAdvisorRequest:
    return AdaptiveAdvisorRequest(
        crop="tomato",
        question=question,
        dashboard={},
        include_narrative=narrative,
    )


def test_photosynthesis_difference_routes_to_diagnostic_graph():
    plan = build_adaptive_plan(
        request("오전 환경은 같은데 왜 광합성 속도가 어제보다 낮아졌지?")
    )
    assert plan.intent is AdvisorIntent.DIAGNOSE
    assert AdaptiveNode.HISTORY_COMPARE in plan.nodes
    assert AdaptiveNode.PHYSIOLOGY_DIAGNOSIS in plan.nodes
    assert AdaptiveNode.EXPERT_WIKI in plan.nodes
    assert plan.nodes[-3:] == [
        AdaptiveNode.CONSTRAINT_GATE,
        AdaptiveNode.ANSWER_ADMISSION,
        AdaptiveNode.QUALITY_GATE,
    ]


def test_holiday_market_question_routes_to_cross_domain_optimization():
    plan = build_adaptive_plan(
        request(
            "다음 주 휴가라 출하가 없고 휴일 다음날 가격 하락이 예상돼. "
            "온도와 수확 계획을 최적화해줘"
        )
    )
    assert plan.intent is AdvisorIntent.OPTIMIZE
    assert AdaptiveNode.OPERATIONS_CALENDAR in plan.nodes
    assert AdaptiveNode.MARKET_OUTLOOK in plan.nodes
    assert AdaptiveNode.HARVEST_MARKET_ANALYSIS in plan.nodes
    assert AdaptiveNode.BOUNDED_SCENARIO in plan.nodes
    assert plan.horizons_hours == [24, 72, 168, 336]


def test_numeric_temperature_question_routes_to_what_if():
    plan = build_adaptive_plan(request("야간 온도를 1℃ 낮추면 14일 수확량은?"))
    assert plan.intent is AdvisorIntent.WHAT_IF
    assert "temperature_night" in plan.controls
    assert AdaptiveNode.SENSITIVITY in plan.nodes


def test_client_plan_cannot_remove_safety_spine():
    proposed = AdaptiveGraphPlan(
        intent=AdvisorIntent.STATUS,
        nodes=[
            AdaptiveNode.FREEZE_SNAPSHOT,
            AdaptiveNode.LIVE_SNAPSHOT,
            AdaptiveNode.CONSTRAINT_GATE,
            AdaptiveNode.ANSWER_ADMISSION,
            AdaptiveNode.QUALITY_GATE,
        ],
        include_narrative=False,
    )
    req = request("현재 상태")
    req.requested_plan = proposed
    plan = build_adaptive_plan(req)
    assert plan.nodes[-3:] == [
        AdaptiveNode.CONSTRAINT_GATE,
        AdaptiveNode.ANSWER_ADMISSION,
        AdaptiveNode.QUALITY_GATE,
    ]


def test_graph_contract_rejects_duplicate_nodes():
    with pytest.raises(ValidationError):
        AdaptiveGraphPlan(
            intent=AdvisorIntent.STATUS,
            nodes=[
                AdaptiveNode.FREEZE_SNAPSHOT,
                AdaptiveNode.LIVE_SNAPSHOT,
                AdaptiveNode.LIVE_SNAPSHOT,
                AdaptiveNode.CONSTRAINT_GATE,
                AdaptiveNode.ANSWER_ADMISSION,
                AdaptiveNode.QUALITY_GATE,
            ],
            include_narrative=False,
        )


@pytest.mark.parametrize(
    ("question", "intent"),
    [
        ("현재 온도 알려줘", AdvisorIntent.STATUS),
        ("왜 기공전도도가 낮지?", AdvisorIntent.DIAGNOSE),
        ("CO2를 100 ppm 올리면?", AdvisorIntent.WHAT_IF),
        ("다음 주 작업 계획", AdvisorIntent.PLAN),
        ("가격과 수확량을 같이 최적화", AdvisorIntent.OPTIMIZE),
    ],
)
def test_intent_examples(question, intent):
    assert classify_intent(question) is intent
