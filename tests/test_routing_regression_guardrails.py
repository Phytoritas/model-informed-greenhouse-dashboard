from datetime import UTC, datetime, timedelta

from model_informed_greenhouse_dashboard.backend.app.services.adaptive_advisor.contracts import (
    AdvisorFeedback,
    FeedbackIssue,
)
from model_informed_greenhouse_dashboard.backend.app.services.adaptive_advisor.quality_ledger import (
    QualityLedger,
)
from model_informed_greenhouse_dashboard.backend.app.services.adaptive_advisor.routing_regression import (
    evaluate_routing_regression,
)


def _response(index: int, *, route: str, quality_score: float) -> dict:
    nodes = [
        "freeze_snapshot",
        route,
        "constraint_gate",
        "answer_admission",
        "answer_packet",
        "response_review",
        "quality_gate",
    ]
    return {
        "run_id": f"guard-{index:04d}",
        "crop": "tomato",
        "greenhouse_id": "house-1",
        "question": f"question {index}",
        "snapshot_fingerprint": f"fp-{index}",
        "plan": {
            "intent": "DIAGNOSE",
            "nodes": nodes,
            "controls": [],
            "horizons_hours": [],
            "max_model_evaluations": 8,
        },
        "quality_profile": {
            "answer_status": "OPERATIONAL",
            "score": quality_score,
            "readiness_score": quality_score,
            "content": {
                "diagnostic_depth": quality_score,
                "actionability": quality_score,
                "temporal_alignment": quality_score,
                "cross_domain_synthesis": quality_score,
                "numerical_integrity": 1.0,
                "uncertainty_honesty": quality_score,
            },
        },
        "text": "answer",
    }


def test_predictive_features_exclude_post_answer_quality_and_route_ci_is_reported(tmp_path):
    ledger = QualityLedger(tmp_path / "quality.sqlite3")
    base = datetime(2026, 1, 1, tzinfo=UTC)
    for index in range(24):
        good = index % 2 == 0
        response = _response(
            index,
            route="history_compare" if good else "environment_analysis",
            quality_score=0.99 if not good else 0.10,  # deliberately anti-correlated
        )
        ledger.record_run(response)
        ledger.add_feedback(
            AdvisorFeedback(
                run_id=response["run_id"],
                helpful=good,
                issue_codes=[] if good else [FeedbackIssue.WRONG_ROUTE],
                submitted_at=base + timedelta(days=index),
            )
        )

    result = evaluate_routing_regression(ledger, minimum_examples=12)
    assert result["status"] == "ready"
    feature_names = {item["feature"] for item in result["coefficients"]}
    assert "quality_score" not in feature_names
    assert "readiness_score" not in feature_names
    assert all("mean_reward_ci95" in item for item in result["route_summary"])
    assert result["online_policy_changed"] is False
    assert "policy_candidate_eligible" in result
