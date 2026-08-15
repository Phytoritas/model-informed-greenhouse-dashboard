"""Offline routing regression from immutable feedback and agronomic outcomes.

The evaluator never mutates the online planner. It emits versionable suggestions
that must be reviewed and deployed explicitly.
"""

from __future__ import annotations

import math
from collections import Counter
from typing import Any

import numpy as np

from .quality_ledger import QualityLedger


_ISSUE_PENALTIES = {
    "missing_cause": 0.18,
    "vague_action": 0.18,
    "wrong_number": 0.35,
    "missing_context": 0.15,
    "too_verbose": 0.08,
    "wrong_route": 0.30,
    "other": 0.05,
}


def _reward(row: dict[str, Any]) -> float:
    values: list[tuple[float, float]] = []
    if row.get("helpful") is not None:
        base = 1.0 if row["helpful"] else 0.0
        penalty = sum(_ISSUE_PENALTIES.get(str(code), 0.05) for code in row["issue_codes"])
        values.append((max(-1.0, min(1.0, base - penalty)), 0.65))
    if row.get("outcome_reward") is not None:
        values.append((max(-1.0, min(1.0, float(row["outcome_reward"]))), 0.35))
    if not values:
        return 0.0
    total_weight = sum(weight for _value, weight in values)
    return sum(value * weight for value, weight in values) / total_weight


def _features(rows: list[dict[str, Any]]) -> tuple[list[str], np.ndarray]:
    intents = sorted({str(row["intent"]) for row in rows})
    nodes = sorted(
        {
            str(node)
            for row in rows
            for node in (row.get("plan") or {}).get("nodes", [])
        }
    )
    names = [
        "intercept",
        "quality_score",
        "readiness_score",
        "diagnostic_depth",
        "actionability",
        "temporal_alignment",
        "cross_domain_synthesis",
        "numerical_integrity",
        "uncertainty_honesty",
        *[f"intent:{item}" for item in intents],
        *[f"node:{item}" for item in nodes],
    ]
    matrix: list[list[float]] = []
    for row in rows:
        quality = row.get("quality") or {}
        content = quality.get("content") or {}
        plan_nodes = {str(item) for item in (row.get("plan") or {}).get("nodes", [])}
        vector = [
            1.0,
            float(row.get("quality_score") or 0.0),
            float(row.get("readiness_score") or 0.0),
            float(content.get("diagnostic_depth") or 0.0),
            float(content.get("actionability") or 0.0),
            float(content.get("temporal_alignment") or 0.0),
            float(content.get("cross_domain_synthesis") or 0.0),
            float(content.get("numerical_integrity") or 0.0),
            float(content.get("uncertainty_honesty") or 0.0),
            *[1.0 if row["intent"] == item else 0.0 for item in intents],
            *[1.0 if item in plan_nodes else 0.0 for item in nodes],
        ]
        matrix.append(vector)
    return names, np.asarray(matrix, dtype=float)


def _ridge_fit(x: np.ndarray, y: np.ndarray, alpha: float) -> np.ndarray:
    identity = np.eye(x.shape[1], dtype=float)
    identity[0, 0] = 0.0
    return np.linalg.pinv(x.T @ x + alpha * identity) @ x.T @ y


def evaluate_routing_regression(
    ledger: QualityLedger,
    *,
    minimum_examples: int = 12,
    holdout_fraction: float = 0.25,
    ridge_alpha: float = 1.0,
) -> dict[str, Any]:
    rows = ledger.training_rows()
    if len(rows) < minimum_examples:
        return {
            "status": "insufficient_data",
            "model": "offline-routing-ridge.v1",
            "example_count": len(rows),
            "minimum_examples": minimum_examples,
            "online_policy_changed": False,
            "suggestions": [],
        }

    feature_names, x = _features(rows)
    y = np.asarray([_reward(row) for row in rows], dtype=float)
    split = max(2, min(len(rows) - 2, int(len(rows) * (1.0 - holdout_fraction))))
    x_train, x_test = x[:split], x[split:]
    y_train, y_test = y[:split], y[split:]
    coefficients = _ridge_fit(x_train, y_train, max(1e-6, ridge_alpha))
    predictions = np.clip(x_test @ coefficients, -1.0, 1.0)
    baseline_value = float(np.mean(y_train))
    baseline_predictions = np.full_like(y_test, baseline_value)

    mae = float(np.mean(np.abs(predictions - y_test)))
    rmse = float(math.sqrt(np.mean((predictions - y_test) ** 2)))
    baseline_mae = float(np.mean(np.abs(baseline_predictions - y_test)))
    baseline_rmse = float(math.sqrt(np.mean((baseline_predictions - y_test) ** 2)))
    improved = mae + 1e-9 < baseline_mae

    route_rewards: dict[str, list[float]] = {}
    for row, reward in zip(rows, y.tolist()):
        route_rewards.setdefault(str(row["route_signature"]), []).append(float(reward))
    route_summary = [
        {
            "route_signature": route,
            "sample_count": len(values),
            "mean_reward": round(float(np.mean(values)), 4),
        }
        for route, values in route_rewards.items()
    ]
    route_summary.sort(key=lambda item: (item["mean_reward"], -item["sample_count"]))

    coefficient_rows = [
        {"feature": name, "coefficient": round(float(value), 6)}
        for name, value in zip(feature_names, coefficients.tolist())
        if name != "intercept"
    ]
    coefficient_rows.sort(key=lambda item: item["coefficient"])

    issue_counts = Counter(
        str(code)
        for row in rows
        for code in row.get("issue_codes", [])
    )
    suggestions: list[dict[str, Any]] = []
    for route in route_summary:
        if route["sample_count"] >= 3 and route["mean_reward"] < 0.35:
            suggestions.append(
                {
                    "kind": "route_review",
                    "route_signature": route["route_signature"],
                    "reason": "low realized reward",
                    "sample_count": route["sample_count"],
                    "mean_reward": route["mean_reward"],
                }
            )
    for issue, count in issue_counts.most_common():
        if count >= 3:
            suggestions.append(
                {
                    "kind": "quality_gap",
                    "issue_code": issue,
                    "count": count,
                    "recommended_change": {
                        "missing_cause": "increase history/physiology routing requirement",
                        "vague_action": "require bounded action packet before narration",
                        "wrong_number": "tighten authorized-number response review",
                        "missing_context": "increase operations/market context admission",
                        "too_verbose": "lower narrator detail budget",
                        "wrong_route": "review intent and node-selection examples",
                    }.get(issue, "review canonical cases"),
                }
            )
    for item in coefficient_rows[:8]:
        if item["coefficient"] < -0.08:
            suggestions.append(
                {
                    "kind": "negative_feature_association",
                    "feature": item["feature"],
                    "coefficient": item["coefficient"],
                    "note": "association only; inspect confounding before changing routing",
                }
            )

    return {
        "status": "ready",
        "model": "offline-routing-ridge.v1",
        "example_count": len(rows),
        "train_count": len(y_train),
        "test_count": len(y_test),
        "holdout": "chronological",
        "ridge_alpha": ridge_alpha,
        "metrics": {
            "mae": round(mae, 6),
            "rmse": round(rmse, 6),
            "baseline_mae": round(baseline_mae, 6),
            "baseline_rmse": round(baseline_rmse, 6),
            "beats_mean_baseline": improved,
        },
        "reward_definition": {
            "feedback_weight": 0.65,
            "outcome_weight": 0.35,
            "range": [-1.0, 1.0],
        },
        "route_summary": route_summary,
        "coefficients": coefficient_rows,
        "suggestions": suggestions[:30],
        "online_policy_changed": False,
        "deployment_requirement": "manual review and versioned planner release",
    }
