from datetime import UTC, datetime, timedelta

from model_informed_greenhouse_dashboard.backend.app.services.adaptive_advisor.contracts import (
    AdvisorFeedback,
    AdvisorOutcome,
    FeedbackIssue,
)
from model_informed_greenhouse_dashboard.backend.app.services.adaptive_advisor.quality_ledger import (
    QualityLedger,
)
from model_informed_greenhouse_dashboard.backend.app.services.adaptive_advisor.routing_regression import (
    evaluate_routing_regression,
)


def _response(index: int) -> dict:
    helpful_route = index % 2 == 0
    nodes = (
        ["freeze_snapshot", "history_compare", "physiology_diagnosis", "quality_gate"]
        if helpful_route
        else ["freeze_snapshot", "environment_analysis", "quality_gate"]
    )
    score = 0.82 if helpful_route else 0.45
    return {
        "run_id": f"run-{index:04d}",
        "crop": "tomato",
        "greenhouse_id": "house-1",
        "question": f"question {index}",
        "snapshot_fingerprint": f"fingerprint-{index}",
        "plan": {"intent": "DIAGNOSE", "nodes": nodes},
        "quality_profile": {
            "answer_status": "OPERATIONAL" if helpful_route else "CONDITIONAL",
            "score": score,
            "readiness_score": 0.8,
            "content": {
                "diagnostic_depth": score,
                "actionability": score,
                "temporal_alignment": 1.0 if helpful_route else 0.2,
                "cross_domain_synthesis": 0.5,
                "numerical_integrity": 1.0,
                "uncertainty_honesty": 0.8,
            },
        },
        "text": "answer",
    }


def test_feedback_outcome_regression_is_offline_and_chronological(tmp_path):
    ledger = QualityLedger(tmp_path / "quality.sqlite3")
    base_time = datetime(2026, 1, 1, tzinfo=UTC)
    for index in range(24):
        response = _response(index)
        ledger.record_run(response)
        helpful = index % 2 == 0
        ledger.add_feedback(
            AdvisorFeedback(
                run_id=response["run_id"],
                helpful=helpful,
                issue_codes=[] if helpful else [FeedbackIssue.WRONG_ROUTE],
                submitted_at=base_time + timedelta(days=index),
            )
        )
        ledger.add_outcome(
            AdvisorOutcome(
                run_id=response["run_id"],
                observed_at=base_time + timedelta(days=index, hours=24),
                horizon_hours=24,
                reward=0.8 if helpful else -0.2,
            )
        )

    result = evaluate_routing_regression(
        ledger,
        minimum_examples=12,
        holdout_fraction=0.25,
    )

    assert result["status"] == "ready"
    assert result["holdout"] == "chronological"
    assert result["online_policy_changed"] is False
    assert result["train_count"] + result["test_count"] == 24
    assert result["suggestions"]
