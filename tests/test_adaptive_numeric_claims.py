from model_informed_greenhouse_dashboard.backend.app.services.adaptive_advisor.contracts import (
    AdaptiveAnswerPacket,
    AdvisorIntent,
    AnswerStatus,
)
from model_informed_greenhouse_dashboard.backend.app.services.adaptive_advisor.numeric_claims import (
    collect_authorized_numeric_claims,
    extract_numeric_mentions,
    numeric_mention_is_authorized,
)
from model_informed_greenhouse_dashboard.backend.app.services.adaptive_advisor.response_review import (
    review_response,
)


def _packet() -> AdaptiveAnswerPacket:
    packet = AdaptiveAnswerPacket(
        question="휴일 이후 시장 위험은?",
        intent=AdvisorIntent.PLAN,
        answer_status=AnswerStatus.CONDITIONAL,
        direct_answer="탄력도 시나리오상 가격 압력은 -8.2%입니다.",
        actions=[],
        uncertainties=["반입량 자료가 추가되면 다시 계산합니다."],
        market_context={
            "peak_shock": {
                "price_pressure_pct": -8.2,
                "expected_arrival_kg": 1200.0,
                "shock_ratio": 1.35,
            }
        },
    )
    packet.authorized_numeric_claims = collect_authorized_numeric_claims(packet)
    packet.authorized_numbers = sorted(
        {
            rendering
            for claim in packet.authorized_numeric_claims
            for rendering in claim.renderings
        }
    )
    return packet


def test_numeric_authorization_never_crosses_units():
    packet = _packet()
    percent = extract_numeric_mentions("-8.2%")[0]
    celsius = extract_numeric_mentions("-8.2℃")[0]
    assert numeric_mention_is_authorized(
        percent,
        packet.authorized_numeric_claims,
    )
    assert not numeric_mention_is_authorized(
        celsius,
        packet.authorized_numeric_claims,
    )


def test_response_review_rejects_same_value_with_wrong_unit():
    packet = _packet()
    review = review_response(
        text=(
            "가격 압력의 원인은 반입 집중입니다. 오늘 조치를 확인하고 "
            "-8.2℃로 설정한 뒤 자료 한계를 다시 확인하세요."
        ),
        packet=packet,
        language="ko",
        narrative_attempted=True,
    )
    assert review.fallback_used is True
    assert "-8.2℃" in review.unsupported_numeric_claims


def test_dates_and_list_numbers_are_not_treated_as_numeric_claims():
    mentions = extract_numeric_mentions(
        "2026-08-20 계획\n1. 오늘 반입량 1,200 kg을 확인합니다."
    )
    assert [item["token"].strip() for item in mentions] == ["1,200 kg"]
