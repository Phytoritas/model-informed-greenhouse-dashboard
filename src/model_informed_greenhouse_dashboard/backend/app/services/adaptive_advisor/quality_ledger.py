"""Durable append-only ledger for adaptive answers, feedback, and outcomes."""

from __future__ import annotations

import hashlib
import json
import os
import sqlite3
import threading
import uuid
from collections import Counter
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from .contracts import AdvisorFeedback, AdvisorOutcome


def _canonical_json(value: Any) -> str:
    return json.dumps(
        value,
        ensure_ascii=False,
        sort_keys=True,
        separators=(",", ":"),
        default=str,
    )


class RunConflict(RuntimeError):
    """Raised when a run_id is reused with different immutable content."""


class QualityLedger:
    """Single-host immutable run ledger with append-only labels and outcomes."""

    _lock = threading.RLock()

    def __init__(self, path: str | Path | None = None) -> None:
        configured = path or os.getenv("SMARTGROW_ADVISOR_QUALITY_DB_PATH")
        self.path = Path(
            configured or "artifacts/advisor_quality/advisor_quality.sqlite3"
        )
        self._initialize()

    def _connect(self) -> sqlite3.Connection:
        self.path.parent.mkdir(parents=True, exist_ok=True)
        connection = sqlite3.connect(self.path, timeout=30.0)
        connection.row_factory = sqlite3.Row
        connection.execute("PRAGMA journal_mode=WAL")
        connection.execute("PRAGMA synchronous=FULL")
        connection.execute("PRAGMA foreign_keys=ON")
        connection.execute("PRAGMA busy_timeout=30000")
        return connection

    def _initialize(self) -> None:
        with self._lock, self._connect() as connection:
            connection.executescript(
                """
                CREATE TABLE IF NOT EXISTS advisor_runs (
                    run_id TEXT PRIMARY KEY,
                    thread_id TEXT,
                    created_at TEXT NOT NULL,
                    crop TEXT NOT NULL,
                    greenhouse_id TEXT NOT NULL,
                    question TEXT NOT NULL,
                    intent TEXT NOT NULL,
                    route_signature TEXT NOT NULL,
                    answer_status TEXT NOT NULL,
                    quality_score REAL NOT NULL,
                    readiness_score REAL NOT NULL,
                    plan_json TEXT NOT NULL,
                    quality_json TEXT NOT NULL,
                    response_json TEXT NOT NULL,
                    response_sha256 TEXT NOT NULL,
                    snapshot_fingerprint TEXT NOT NULL
                );
                CREATE INDEX IF NOT EXISTS ix_advisor_runs_created
                    ON advisor_runs(created_at);
                CREATE INDEX IF NOT EXISTS ix_advisor_runs_route
                    ON advisor_runs(route_signature, created_at);

                CREATE TABLE IF NOT EXISTS advisor_feedback (
                    feedback_id TEXT PRIMARY KEY,
                    run_id TEXT NOT NULL REFERENCES advisor_runs(run_id),
                    submitted_at TEXT NOT NULL,
                    helpful INTEGER NOT NULL,
                    issue_codes_json TEXT NOT NULL,
                    comment TEXT
                );
                CREATE INDEX IF NOT EXISTS ix_advisor_feedback_run
                    ON advisor_feedback(run_id, submitted_at);

                CREATE TABLE IF NOT EXISTS advisor_outcomes (
                    outcome_id TEXT PRIMARY KEY,
                    run_id TEXT NOT NULL REFERENCES advisor_runs(run_id),
                    observed_at TEXT NOT NULL,
                    horizon_hours INTEGER NOT NULL,
                    reward REAL,
                    metrics_json TEXT NOT NULL,
                    notes TEXT
                );
                CREATE INDEX IF NOT EXISTS ix_advisor_outcomes_run
                    ON advisor_outcomes(run_id, observed_at);
                """
            )
            columns = {
                str(row["name"])
                for row in connection.execute(
                    "PRAGMA table_info(advisor_runs)"
                ).fetchall()
            }
            if "thread_id" not in columns:
                connection.execute(
                    "ALTER TABLE advisor_runs ADD COLUMN thread_id TEXT"
                )
            connection.execute(
                """
                CREATE INDEX IF NOT EXISTS ix_advisor_runs_thread
                ON advisor_runs(thread_id, created_at)
                """
            )

    def record_run(self, response: dict[str, Any]) -> dict[str, Any]:
        run_id = str(response["run_id"])
        thread_id = str(response.get("thread_id") or run_id)
        plan = response.get("plan") or {}
        quality = response.get("quality_profile") or {}
        route_signature = "|".join(
            [
                str(plan.get("intent") or ""),
                ",".join(str(node) for node in plan.get("nodes") or []),
            ]
        )
        response_json = _canonical_json(response)
        digest = hashlib.sha256(response_json.encode("utf-8")).hexdigest()
        values = (
            run_id,
            thread_id,
            datetime.now(UTC).isoformat(),
            str(response.get("crop") or ""),
            str(response.get("greenhouse_id") or ""),
            str(response.get("question") or ""),
            str(plan.get("intent") or ""),
            route_signature,
            str(quality.get("answer_status") or ""),
            float(quality.get("score") or 0.0),
            float(quality.get("readiness_score") or 0.0),
            _canonical_json(plan),
            _canonical_json(quality),
            response_json,
            digest,
            str(response.get("snapshot_fingerprint") or ""),
        )
        with self._lock, self._connect() as connection:
            existing = connection.execute(
                "SELECT response_sha256 FROM advisor_runs WHERE run_id = ?",
                (run_id,),
            ).fetchone()
            if existing:
                if existing["response_sha256"] != digest:
                    raise RunConflict(
                        f"run_id {run_id} already exists with different content"
                    )
                return {
                    "inserted": False,
                    "run_id": run_id,
                    "thread_id": thread_id,
                    "response_sha256": digest,
                }
            connection.execute(
                """
                INSERT INTO advisor_runs(
                    run_id, thread_id, created_at, crop, greenhouse_id, question,
                    intent, route_signature, answer_status, quality_score,
                    readiness_score, plan_json, quality_json, response_json,
                    response_sha256, snapshot_fingerprint
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                values,
            )
        return {
            "inserted": True,
            "run_id": run_id,
            "thread_id": thread_id,
            "response_sha256": digest,
        }

    def add_feedback(self, feedback: AdvisorFeedback) -> dict[str, Any]:
        feedback_id = str(uuid.uuid4())
        with self._lock, self._connect() as connection:
            exists = connection.execute(
                "SELECT 1 FROM advisor_runs WHERE run_id = ?",
                (feedback.run_id,),
            ).fetchone()
            if not exists:
                raise KeyError(f"unknown run_id: {feedback.run_id}")
            connection.execute(
                """
                INSERT INTO advisor_feedback(
                    feedback_id, run_id, submitted_at, helpful,
                    issue_codes_json, comment
                ) VALUES (?, ?, ?, ?, ?, ?)
                """,
                (
                    feedback_id,
                    feedback.run_id,
                    feedback.submitted_at.astimezone(UTC).isoformat(),
                    int(feedback.helpful),
                    _canonical_json(
                        [item.value for item in feedback.issue_codes]
                    ),
                    feedback.comment,
                ),
            )
        return {"feedback_id": feedback_id, "run_id": feedback.run_id}

    def add_outcome(self, outcome: AdvisorOutcome) -> dict[str, Any]:
        outcome_id = str(uuid.uuid4())
        with self._lock, self._connect() as connection:
            exists = connection.execute(
                "SELECT 1 FROM advisor_runs WHERE run_id = ?",
                (outcome.run_id,),
            ).fetchone()
            if not exists:
                raise KeyError(f"unknown run_id: {outcome.run_id}")
            connection.execute(
                """
                INSERT INTO advisor_outcomes(
                    outcome_id, run_id, observed_at, horizon_hours,
                    reward, metrics_json, notes
                ) VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    outcome_id,
                    outcome.run_id,
                    outcome.observed_at.astimezone(UTC).isoformat(),
                    outcome.horizon_hours,
                    outcome.reward,
                    _canonical_json(outcome.metrics),
                    outcome.notes,
                ),
            )
        return {"outcome_id": outcome_id, "run_id": outcome.run_id}

    def get_run(self, run_id: str) -> dict[str, Any] | None:
        with self._connect() as connection:
            run = connection.execute(
                "SELECT * FROM advisor_runs WHERE run_id = ?",
                (run_id,),
            ).fetchone()
            if not run:
                return None
            feedback = connection.execute(
                """
                SELECT feedback_id, submitted_at, helpful,
                       issue_codes_json, comment
                FROM advisor_feedback
                WHERE run_id = ?
                ORDER BY submitted_at, feedback_id
                """,
                (run_id,),
            ).fetchall()
            outcomes = connection.execute(
                """
                SELECT outcome_id, observed_at, horizon_hours,
                       reward, metrics_json, notes
                FROM advisor_outcomes
                WHERE run_id = ?
                ORDER BY observed_at, outcome_id
                """,
                (run_id,),
            ).fetchall()
        response = json.loads(run["response_json"])
        response["ledger"] = {
            "thread_id": run["thread_id"],
            "feedback": [
                {
                    "feedback_id": row["feedback_id"],
                    "submitted_at": row["submitted_at"],
                    "helpful": bool(row["helpful"]),
                    "issue_codes": json.loads(row["issue_codes_json"]),
                    "comment": row["comment"],
                }
                for row in feedback
            ],
            "outcomes": [
                {
                    "outcome_id": row["outcome_id"],
                    "observed_at": row["observed_at"],
                    "horizon_hours": int(row["horizon_hours"]),
                    "reward": row["reward"],
                    "metrics": json.loads(row["metrics_json"]),
                    "notes": row["notes"],
                }
                for row in outcomes
            ],
        }
        return response

    def training_rows(self, *, limit: int = 5000) -> list[dict[str, Any]]:
        """Return one deterministic latest feedback/outcome label per immutable run."""

        with self._connect() as connection:
            rows = connection.execute(
                """
                WITH latest_feedback AS (
                    SELECT *
                    FROM (
                        SELECT f.*,
                               ROW_NUMBER() OVER (
                                   PARTITION BY run_id
                                   ORDER BY submitted_at DESC, feedback_id DESC
                               ) AS row_rank
                        FROM advisor_feedback f
                    )
                    WHERE row_rank = 1
                ),
                latest_outcome AS (
                    SELECT *
                    FROM (
                        SELECT o.*,
                               ROW_NUMBER() OVER (
                                   PARTITION BY run_id
                                   ORDER BY observed_at DESC, outcome_id DESC
                               ) AS row_rank
                        FROM advisor_outcomes o
                    )
                    WHERE row_rank = 1
                )
                SELECT r.*,
                       f.helpful,
                       f.issue_codes_json,
                       o.reward AS outcome_reward,
                       o.metrics_json
                FROM advisor_runs r
                LEFT JOIN latest_feedback f ON f.run_id = r.run_id
                LEFT JOIN latest_outcome o ON o.run_id = r.run_id
                WHERE f.helpful IS NOT NULL OR o.reward IS NOT NULL
                ORDER BY r.created_at ASC, r.run_id ASC
                LIMIT ?
                """,
                (max(1, min(limit, 100000)),),
            ).fetchall()

        result: list[dict[str, Any]] = []
        for row in rows:
            result.append(
                {
                    "run_id": row["run_id"],
                    "thread_id": row["thread_id"] or row["run_id"],
                    "created_at": row["created_at"],
                    "crop": row["crop"],
                    "intent": row["intent"],
                    "route_signature": row["route_signature"],
                    "answer_status": row["answer_status"],
                    "quality_score": float(row["quality_score"]),
                    "readiness_score": float(row["readiness_score"]),
                    "plan": json.loads(row["plan_json"]),
                    "quality": json.loads(row["quality_json"]),
                    "helpful": (
                        None
                        if row["helpful"] is None
                        else bool(row["helpful"])
                    ),
                    "issue_codes": (
                        json.loads(row["issue_codes_json"])
                        if row["issue_codes_json"]
                        else []
                    ),
                    "outcome_reward": row["outcome_reward"],
                    "outcome_metrics": (
                        json.loads(row["metrics_json"])
                        if row["metrics_json"]
                        else {}
                    ),
                }
            )
        return result

    def calibration(self, *, minimum_examples: int = 10) -> dict[str, Any]:
        """Compare displayed quality scores with latest helpful/not-helpful labels."""

        with self._connect() as connection:
            rows = connection.execute(
                """
                WITH latest_feedback AS (
                    SELECT *
                    FROM (
                        SELECT f.*,
                               ROW_NUMBER() OVER (
                                   PARTITION BY run_id
                                   ORDER BY submitted_at DESC, feedback_id DESC
                               ) AS row_rank
                        FROM advisor_feedback f
                    )
                    WHERE row_rank = 1
                )
                SELECT r.quality_score, r.intent, r.answer_status, f.helpful
                FROM advisor_runs r
                JOIN latest_feedback f ON f.run_id = r.run_id
                ORDER BY r.created_at ASC, r.run_id ASC
                """
            ).fetchall()

        if len(rows) < minimum_examples:
            return {
                "status": "insufficient_data",
                "model": "delivered-quality-calibration.v1",
                "example_count": len(rows),
                "minimum_examples": minimum_examples,
            }

        bins: list[dict[str, Any]] = []
        absolute_gap_weighted = 0.0
        brier_total = 0.0
        for index in range(5):
            lower = index * 0.2
            upper = 1.0 if index == 4 else (index + 1) * 0.2
            selected = [
                row
                for row in rows
                if float(row["quality_score"]) >= lower
                and (
                    float(row["quality_score"]) <= upper
                    if index == 4
                    else float(row["quality_score"]) < upper
                )
            ]
            if not selected:
                continue
            mean_score = sum(
                float(row["quality_score"]) for row in selected
            ) / len(selected)
            helpful_rate = sum(
                int(row["helpful"]) for row in selected
            ) / len(selected)
            gap = helpful_rate - mean_score
            absolute_gap_weighted += abs(gap) * len(selected)
            bins.append(
                {
                    "range": [round(lower, 2), round(upper, 2)],
                    "sample_count": len(selected),
                    "mean_displayed_quality": round(mean_score, 4),
                    "helpful_rate": round(helpful_rate, 4),
                    "calibration_gap": round(gap, 4),
                }
            )

        for row in rows:
            score = float(row["quality_score"])
            label = float(int(row["helpful"]))
            brier_total += (score - label) ** 2

        issue_by_intent = Counter(
            (str(row["intent"]), bool(row["helpful"]))
            for row in rows
        )
        intent_summary = []
        for intent in sorted({str(row["intent"]) for row in rows}):
            helpful_count = issue_by_intent[(intent, True)]
            unhelpful_count = issue_by_intent[(intent, False)]
            total = helpful_count + unhelpful_count
            intent_summary.append(
                {
                    "intent": intent,
                    "sample_count": total,
                    "helpful_rate": round(
                        helpful_count / max(total, 1),
                        4,
                    ),
                }
            )

        return {
            "status": "ready",
            "model": "delivered-quality-calibration.v1",
            "example_count": len(rows),
            "expected_calibration_error": round(
                absolute_gap_weighted / len(rows),
                6,
            ),
            "brier_score": round(brier_total / len(rows), 6),
            "bins": bins,
            "intent_summary": intent_summary,
            "interpretation": (
                "quality_score is a delivery-quality indicator; this report checks "
                "whether it behaves like a helpfulness probability before any such "
                "interpretation is allowed"
            ),
        }

    def summary(self) -> dict[str, Any]:
        with self._connect() as connection:
            run_count = int(
                connection.execute(
                    "SELECT COUNT(*) FROM advisor_runs"
                ).fetchone()[0]
            )
            thread_count = int(
                connection.execute(
                    """
                    SELECT COUNT(DISTINCT COALESCE(thread_id, run_id))
                    FROM advisor_runs
                    """
                ).fetchone()[0]
            )
            feedback_count = int(
                connection.execute(
                    "SELECT COUNT(*) FROM advisor_feedback"
                ).fetchone()[0]
            )
            outcome_count = int(
                connection.execute(
                    "SELECT COUNT(*) FROM advisor_outcomes"
                ).fetchone()[0]
            )
            labeled_runs = int(
                connection.execute(
                    """
                    SELECT COUNT(DISTINCT run_id)
                    FROM (
                        SELECT run_id FROM advisor_feedback
                        UNION
                        SELECT run_id FROM advisor_outcomes WHERE reward IS NOT NULL
                    )
                    """
                ).fetchone()[0]
            )
            helpful = connection.execute(
                "SELECT AVG(helpful) FROM advisor_feedback"
            ).fetchone()[0]
            quality = connection.execute(
                """
                SELECT AVG(quality_score), AVG(readiness_score)
                FROM advisor_runs
                """
            ).fetchone()
        return {
            "status": "ready",
            "path": str(self.path),
            "run_count": run_count,
            "thread_count": thread_count,
            "feedback_count": feedback_count,
            "outcome_count": outcome_count,
            "labeled_run_count": labeled_runs,
            "label_coverage": (
                0.0
                if run_count == 0
                else round(labeled_runs / run_count, 4)
            ),
            "helpful_rate": (
                None if helpful is None else round(float(helpful), 4)
            ),
            "mean_quality_score": (
                None
                if quality[0] is None
                else round(float(quality[0]), 4)
            ),
            "mean_readiness_score": (
                None
                if quality[1] is None
                else round(float(quality[1]), 4)
            ),
        }
