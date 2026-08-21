from model_informed_greenhouse_dashboard.backend.app.services.adaptive_advisor.change_detection import (
    detect_material_change,
)


def test_identical_context_does_not_rerun():
    payload = {"currentData": {"temperature": 24.0}}
    decision = detect_material_change(payload, payload)
    assert decision.rerun_required is False
    assert decision.changed_domains == []


def test_market_or_calendar_change_invalidates_operational_advice():
    before = {
        "currentData": {"temperature": 24.0},
        "market": {"price": 3000},
        "operations_calendar": {"revision": 1},
    }
    after = {
        "currentData": {"temperature": 24.0},
        "market": {"price": 2600},
        "operations_calendar": {"revision": 2},
    }
    decision = detect_material_change(before, after)
    assert decision.rerun_required is True
    assert set(decision.changed_domains) == {"market", "operations"}
    assert any("invalidate" in reason for reason in decision.reasons)
