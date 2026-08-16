from datetime import UTC, datetime, timedelta

from model_informed_greenhouse_dashboard.backend.app.services.adaptive_advisor.contracts import (
    AdvisorFeedback,
)
from model_informed_greenhouse_dashboard.backend.app.services.adaptive_advisor.quality_ledger import (
    QualityLedger,
)


def _response(index: int, score: float) -> dict:
    return {
        "run_id": f"cal-{index:04d}",
        "thread_id": f"thread-{index // 2:03d}",
        "crop": "tomato",
        "greenhouse_id": "house-1",
        "question": f"q{index}",
        "snapshot_fingerprint": f"fp-{index}",
        "plan": {
            "intent": "STATUS",
            "nodes": ["freeze_snapshot", "quality_gate"],
            "controls": [],
            "horizons_hours": [],
        },
        "quality_profile": {
            "answer_status": "OPERATIONAL",
            "score": score,
            "readiness_score": score,
            "content": {},
        },
        "text": "answer",
    }


def test_quality_calibration_reports_ece_and_thread_linkage(tmp_path):
    ledger = QualityLedger(tmp_path / "quality.sqlite3")
    base = datetime(2026, 1, 1, tzinfo=UTC)
    for index in range(12):
        score = 0.85 if index < 6 else 0.25
        response = _response(index, score)
        ledger.record_run(response)
        ledger.add_feedback(
            AdvisorFeedback(
                run_id=response["run_id"],
                helpful=index < 6,
                submitted_at=base + timedelta(days=index),
            )
        )
    report = ledger.calibration(minimum_examples=10)
    summary = ledger.summary()
    assert report["status"] == "ready"
    assert 0 <= report["expected_calibration_error"] <= 1
    assert 0 <= report["brier_score"] <= 1
    assert summary["thread_count"] == 6
    assert summary["label_coverage"] == 1.0
    rows = ledger.training_rows()
    assert rows[0]["thread_id"].startswith("thread-")
