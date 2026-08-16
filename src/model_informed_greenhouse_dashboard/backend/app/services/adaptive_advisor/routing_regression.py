"""Guarded offline routing regression from immutable feedback and outcomes.

Only route-time features are used by the predictive model.  Delivered-answer
quality dimensions are reported as descriptive associations, preventing
post-response leakage from being mistaken for a deployable routing policy.
"""

from __future__ import annotations

import hashlib
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
        penalty = sum(
            _ISSUE_PENALTIES.get(str(code), 0.05)
            for code in row.get("issue_codes", [])
        )
        values.append((max(-1.0, min(1.0, base - penalty)), 0.65))
    if row.get("outcome_reward") is not None:
        values.append(
            (
                max(-1.0, min(1.0, float(row["outcome_reward"]))),
                0.35,
            )
        )
    if not values:
        return 0.0
    total_weight = sum(weight for _value, weight in values)
    return sum(value * weight for value, weight in values) / total_weight


def _route_features(rows: list[dict[str, Any]]) -> tuple[list[str], np.ndarray]:
    intents = sorted({str(row["intent"]) for row in rows})
    crops = sorted({str(row.get("crop") or "") for row in rows})
    nodes = sorted(
        {
            str(node)
            for row in rows
            for node in (row.get("plan") or {}).get("nodes", [])
        }
    )
    controls = sorted(
        {
            str(control)
            for row in rows
            for control in (row.get("plan") or {}).get("controls", [])
        }
    )
    names = [
        "intercept",
        "node_count",
        "control_count",
        "max_horizon_hours",
        "max_model_evaluations",
        *[f"intent:{item}" for item in intents],
        *[f"crop:{item}" for item in crops],
        *[f"node:{item}" for item in nodes],
        *[f"control:{item}" for item in controls],
    ]
    matrix: list[list[float]] = []
    for row in rows:
        plan = row.get("plan") or {}
        plan_nodes = {str(item) for item in plan.get("nodes", [])}
        plan_controls = {str(item) for item in plan.get("controls", [])}
        horizons = [
            float(item)
            for item in plan.get("horizons_hours", [])
            if isinstance(item, (int, float))
        ]
        vector = [
            1.0,
            float(len(plan_nodes)),
            float(len(plan_controls)),
            max(horizons, default=0.0),
            float(plan.get("max_model_evaluations") or 0.0),
            *[1.0 if str(row["intent"]) == item else 0.0 for item in intents],
            *[1.0 if str(row.get("crop") or "") == item else 0.0 for item in crops],
            *[1.0 if item in plan_nodes else 0.0 for item in nodes],
            *[1.0 if item in plan_controls else 0.0 for item in controls],
        ]
        matrix.append(vector)
    return names, np.asarray(matrix, dtype=float)


def _ridge_fit(x: np.ndarray, y: np.ndarray, alpha: float) -> np.ndarray:
    identity = np.eye(x.shape[1], dtype=float)
    identity[0, 0] = 0.0
    return np.linalg.pinv(x.T @ x + alpha * identity) @ x.T @ y


def _bootstrap_mean_interval(
    values: list[float],
    *,
    seed_material: str,
    samples: int = 2000,
) -> tuple[float, float]:
    array = np.asarray(values, dtype=float)
    if len(array) == 1:
        value = float(array[0])
        return value, value
    seed = int(hashlib.sha256(seed_material.encode("utf-8")).hexdigest()[:16], 16)
    rng = np.random.default_rng(seed)
    draws = rng.choice(array, size=(samples, len(array)), replace=True)
    means = np.mean(draws, axis=1)
    lower, upper = np.quantile(means, [0.025, 0.975])
    return float(lower), float(upper)


def _quality_associations(
    rows: list[dict[str, Any]],
    rewards: np.ndarray,
) -> list[dict[str, Any]]:
    dimensions = (
        "quality_score",
        "readiness_score",
        "diagnostic_depth",
        "actionability",
        "temporal_alignment",
        "cross_domain_synthesis",
        "numerical_integrity",
        "uncertainty_honesty",
    )
    result: list[dict[str, Any]] = []
    for name in dimensions:
        values: list[float] = []
        for row in rows:
            if name in {"quality_score", "readiness_score"}:
                values.append(float(row.get(name) or 0.0))
            else:
                content = (row.get("quality") or {}).get("content") or {}
                values.append(float(content.get(name) or 0.0))
        array = np.asarray(values, dtype=float)
        if len(array) < 3 or float(np.std(array)) <= 1e-12:
            correlation = None
        else:
            correlation = float(np.corrcoef(array, rewards)[0, 1])
        result.append(
            {
                "dimension": name,
                "correlation_with_reward": (
                    None if correlation is None or correlation != correlation
                    else round(correlation, 6)
                ),
                "use": "diagnostic_only_not_route_feature",
            }
        )
    return result


def evaluate_routing_regression(
    ledger: QualityLedger,
    *,
    minimum_examples: int = 12,
    holdout_fraction: float = 0.25,
    ridge_alpha: float = 1.0,
) -> dict[str, Any]:
    rows = ledger.training_rows()
    ledger_summary = ledger.summary()
    if len(rows) < minimum_examples:
        return {
            "status": "insufficient_data",
            "model": "offline-routing-ridge.v2",
            "example_count": len(rows),
            "minimum_examples": minimum_examples,
            "label_coverage": (
                0.0
                if not ledger_summary.get("run_count")
                else round(
                    len(rows) / max(int(ledger_summary["run_count"]), 1),
                    4,
                )
            ),
            "online_policy_changed": False,
            "policy_candidate_eligible": False,
            "suggestions": [],
        }

    feature_names, x = _route_features(rows)
    y = np.asarray([_reward(row) for row in rows], dtype=float)
    target_test_count = max(2, int(round(len(rows) * holdout_fraction)))
    group_ids = [
        str(row.get("thread_id") or row.get("run_id") or index)
        for index, row in enumerate(rows)
    ]
    test_groups: set[str] = set()
    selected_count = 0
    for group_id in reversed(group_ids):
        test_groups.add(group_id)
        selected_count = sum(1 for value in group_ids if value in test_groups)
        if selected_count >= target_test_count:
            break
    test_indices = [
        index for index, group_id in enumerate(group_ids)
        if group_id in test_groups
    ]
    train_indices = [
        index for index, group_id in enumerate(group_ids)
        if group_id not in test_groups
    ]
    if len(train_indices) < 2 or len(test_indices) < 2:
        split = max(
            2,
            min(
                len(rows) - 2,
                int(len(rows) * (1.0 - holdout_fraction)),
            ),
        )
        train_indices = list(range(split))
        test_indices = list(range(split, len(rows)))
    x_train, x_test = x[train_indices], x[test_indices]
    y_train, y_test = y[train_indices], y[test_indices]
    train_threads = {group_ids[index] for index in train_indices}
    test_threads = {group_ids[index] for index in test_indices}
    thread_overlap = sorted(train_threads.intersection(test_threads))
    coefficients = _ridge_fit(x_train, y_train, max(1e-6, ridge_alpha))
    predictions = np.clip(x_test @ coefficients, -1.0, 1.0)
    baseline_value = float(np.mean(y_train))
    baseline_predictions = np.full_like(y_test, baseline_value)

    mae = float(np.mean(np.abs(predictions - y_test)))
    rmse = float(math.sqrt(np.mean((predictions - y_test) ** 2)))
    baseline_mae = float(np.mean(np.abs(baseline_predictions - y_test)))
    baseline_rmse = float(
        math.sqrt(np.mean((baseline_predictions - y_test) ** 2))
    )
    improvement_fraction = (
        0.0
        if baseline_mae <= 1e-12
        else max(0.0, (baseline_mae - mae) / baseline_mae)
    )
    beats_baseline = mae + 1e-9 < baseline_mae
    policy_candidate_eligible = bool(
        beats_baseline
        and improvement_fraction >= 0.05
        and len(y_test) >= 3
        and len(set(str(row["route_signature"]) for row in rows)) >= 2
        and not thread_overlap
    )

    route_rewards: dict[str, list[float]] = {}
    for row, reward in zip(rows, y.tolist()):
        route_rewards.setdefault(str(row["route_signature"]), []).append(
            float(reward)
        )
    route_summary: list[dict[str, Any]] = []
    for route, values in route_rewards.items():
        lower, upper = _bootstrap_mean_interval(
            values,
            seed_material=route,
        )
        route_summary.append(
            {
                "route_signature": route,
                "sample_count": len(values),
                "mean_reward": round(float(np.mean(values)), 4),
                "mean_reward_ci95": [
                    round(lower, 4),
                    round(upper, 4),
                ],
            }
        )
    route_summary.sort(
        key=lambda item: (
            item["mean_reward"],
            -item["sample_count"],
        )
    )

    coefficient_rows = [
        {
            "feature": name,
            "coefficient": round(float(value), 6),
            "availability": "route_time",
        }
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
        upper = float(route["mean_reward_ci95"][1])
        if (
            route["sample_count"] >= 5
            and upper < 0.35
        ):
            suggestions.append(
                {
                    "kind": "route_review",
                    "route_signature": route["route_signature"],
                    "reason": "95% bootstrap interval remains below the review threshold",
                    "sample_count": route["sample_count"],
                    "mean_reward": route["mean_reward"],
                    "mean_reward_ci95": route["mean_reward_ci95"],
                }
            )

    issue_threshold = max(3, math.ceil(0.10 * len(rows)))
    for issue, count in issue_counts.most_common():
        if count < issue_threshold:
            continue
        suggestions.append(
            {
                "kind": "quality_gap",
                "issue_code": issue,
                "count": count,
                "minimum_count": issue_threshold,
                "recommended_change": {
                    "missing_cause": "increase history/physiology routing requirement",
                    "vague_action": "require bounded action packet before narration",
                    "wrong_number": "tighten unit-aware numeric authorization",
                    "missing_context": "increase operations/market context admission",
                    "too_verbose": "lower narrator detail budget",
                    "wrong_route": "review contextual intent and node selection",
                }.get(issue, "review canonical cases"),
            }
        )

    if policy_candidate_eligible:
        for item in coefficient_rows[:8]:
            if (
                item["feature"].startswith(("node:", "control:"))
                and item["coefficient"] < -0.08
            ):
                suggestions.append(
                    {
                        "kind": "negative_route_feature_association",
                        "feature": item["feature"],
                        "coefficient": item["coefficient"],
                        "note": (
                            "route-time association only; require replay and "
                            "manual review before deployment"
                        ),
                    }
                )

    run_count = int(ledger_summary.get("run_count") or 0)
    feedback_labeled = sum(row.get("helpful") is not None for row in rows)
    outcome_labeled = sum(row.get("outcome_reward") is not None for row in rows)
    return {
        "status": "ready",
        "model": "offline-routing-ridge.v2",
        "example_count": len(rows),
        "train_count": len(y_train),
        "test_count": len(y_test),
        "holdout": "chronological",
        "holdout_grouping": "thread_id",
        "train_thread_count": len(train_threads),
        "test_thread_count": len(test_threads),
        "thread_overlap": thread_overlap,
        "ridge_alpha": ridge_alpha,
        "feature_policy": "route_time_only",
        "metrics": {
            "mae": round(mae, 6),
            "rmse": round(rmse, 6),
            "baseline_mae": round(baseline_mae, 6),
            "baseline_rmse": round(baseline_rmse, 6),
            "beats_mean_baseline": beats_baseline,
            "mae_improvement_fraction": round(improvement_fraction, 6),
        },
        "data_quality": {
            "recorded_run_count": run_count,
            "labeled_run_count": len(rows),
            "label_coverage": (
                0.0 if run_count == 0 else round(len(rows) / run_count, 4)
            ),
            "feedback_labeled_count": feedback_labeled,
            "outcome_labeled_count": outcome_labeled,
            "distinct_route_count": len(route_rewards),
        },
        "reward_definition": {
            "feedback_weight": 0.65,
            "outcome_weight": 0.35,
            "range": [-1.0, 1.0],
        },
        "route_summary": route_summary,
        "coefficients": coefficient_rows,
        "quality_associations": _quality_associations(rows, y),
        "suggestions": suggestions[:30],
        "policy_candidate_eligible": policy_candidate_eligible,
        "online_policy_changed": False,
        "deployment_requirement": (
            "manual review, canonical replay, and versioned planner release"
        ),
    }
