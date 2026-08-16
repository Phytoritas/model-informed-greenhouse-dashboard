"""Reusable contract for same-query adaptive-answer replay benchmarks."""

from __future__ import annotations

import hashlib
import json
from typing import Any

from pydantic import BaseModel, ConfigDict, Field

from .contracts import AdaptiveAdvisorRequest, AdaptiveAdvisorResponse, AdvisorIntent


class BenchmarkExpectation(BaseModel):
    model_config = ConfigDict(extra="forbid")

    expected_intent: AdvisorIntent
    allowed_answer_statuses: list[str] = Field(min_length=1)
    min_quality_score: float = Field(default=0.0, ge=0, le=1)
    max_quality_score: float = Field(default=1.0, ge=0, le=1)
    min_content_dimensions: dict[str, float] = Field(default_factory=dict)
    required_nodes: list[str] = Field(default_factory=list)
    required_quality_gaps: list[str] = Field(default_factory=list)
    forbidden_quality_gaps: list[str] = Field(default_factory=list)
    require_fallback: bool | None = None


class AdaptiveBenchmarkCase(BaseModel):
    model_config = ConfigDict(extra="forbid")

    case_id: str = Field(min_length=1, max_length=120)
    description: str = Field(min_length=1, max_length=1000)
    request: AdaptiveAdvisorRequest
    expectation: BenchmarkExpectation

    def digest(self) -> str:
        blob = json.dumps(
            self.model_dump(mode="json"),
            ensure_ascii=False,
            sort_keys=True,
            separators=(",", ":"),
        ).encode("utf-8")
        return hashlib.sha256(blob).hexdigest()


class BenchmarkCheck(BaseModel):
    name: str
    passed: bool
    actual: Any = None
    expected: Any = None


class AdaptiveBenchmarkResult(BaseModel):
    case_id: str
    case_digest: str
    passed: bool
    checks: list[BenchmarkCheck]
    quality_score: float
    answer_status: str


def _dimension_values(response: AdaptiveAdvisorResponse) -> dict[str, float]:
    content = response.quality_profile.content
    return {
        "diagnostic_depth": content.diagnostic_depth,
        "actionability": content.actionability,
        "temporal_alignment": content.temporal_alignment,
        "cross_domain_synthesis": content.cross_domain_synthesis,
        "numerical_integrity": content.numerical_integrity,
        "uncertainty_honesty": content.uncertainty_honesty,
        "response_coverage": response.quality_profile.response.coverage,
        "model_applicability": response.quality_profile.model.applicability,
        "input_readiness": response.quality_profile.readiness_score,
    }


def evaluate_benchmark_case(
    case: AdaptiveBenchmarkCase,
    response: AdaptiveAdvisorResponse,
) -> AdaptiveBenchmarkResult:
    expectation = case.expectation
    checks: list[BenchmarkCheck] = []

    def check(name: str, passed: bool, actual: Any, expected: Any) -> None:
        checks.append(
            BenchmarkCheck(
                name=name,
                passed=bool(passed),
                actual=actual,
                expected=expected,
            )
        )

    check(
        "intent",
        response.plan.intent is expectation.expected_intent,
        response.plan.intent.value,
        expectation.expected_intent.value,
    )
    status = response.quality_profile.answer_status.value
    check(
        "answer_status",
        status in expectation.allowed_answer_statuses,
        status,
        expectation.allowed_answer_statuses,
    )
    score = response.quality_profile.score
    check(
        "quality_score_range",
        expectation.min_quality_score <= score <= expectation.max_quality_score,
        score,
        [expectation.min_quality_score, expectation.max_quality_score],
    )

    dimensions = _dimension_values(response)
    for name, minimum in expectation.min_content_dimensions.items():
        actual = dimensions.get(name)
        check(
            f"dimension:{name}",
            actual is not None and actual >= minimum,
            actual,
            minimum,
        )

    executed = {item.node.value for item in response.trace}
    for node in expectation.required_nodes:
        check(f"node:{node}", node in executed, sorted(executed), node)

    gaps = set(response.quality_profile.content.gaps)
    for gap in expectation.required_quality_gaps:
        check(f"required_gap:{gap}", gap in gaps, sorted(gaps), gap)
    for gap in expectation.forbidden_quality_gaps:
        check(f"forbidden_gap:{gap}", gap not in gaps, sorted(gaps), f"not {gap}")

    if expectation.require_fallback is not None:
        check(
            "fallback",
            response.quality_profile.response.fallback_used
            is expectation.require_fallback,
            response.quality_profile.response.fallback_used,
            expectation.require_fallback,
        )

    return AdaptiveBenchmarkResult(
        case_id=case.case_id,
        case_digest=case.digest(),
        passed=all(item.passed for item in checks),
        checks=checks,
        quality_score=score,
        answer_status=status,
    )
