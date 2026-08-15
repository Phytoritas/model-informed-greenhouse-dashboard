"""Execution engine for the bounded run-specific adaptive advisor graph."""

from __future__ import annotations

import asyncio
import copy
import time
from dataclasses import dataclass
from datetime import UTC, date, datetime, timedelta
from typing import Any, Callable

from .change_detection import fingerprint_snapshot
from .contracts import (
    AdaptiveAdvisorRequest,
    AdaptiveAdvisorResponse,
    AdaptiveGraphPlan,
    AdaptiveNode,
    AdmissionResult,
    AnswerStatus,
    ConstraintGateResult,
    ConstraintStatus,
    NodeStatus,
    NodeTrace,
)
from .operations_calendar import OperationsCalendarStore
from .planner import build_adaptive_plan
from .quality import build_quality_profile


TabBuilder = Callable[..., dict[str, Any]]
ChatBuilder = Callable[..., dict[str, Any]]
RetrievalBuilder = Callable[..., dict[str, Any]]


@dataclass
class AdaptiveAdvisorDependencies:
    tab_builder: TabBuilder
    chat_builder: ChatBuilder
    retrieval_builder: RetrievalBuilder
    calendar_store: OperationsCalendarStore
    clock: Callable[[], datetime] = lambda: datetime.now(UTC)


def default_dependencies() -> AdaptiveAdvisorDependencies:
    # Lazy imports keep the contracts/planner/test surface independent of the large
    # landed advisor module and avoid circular imports at application startup.
    from ..advisor_context_builder import build_chat_advisor_context
    from ..advisor_orchestration import (
        build_advisor_chat_response,
        build_advisor_tab_response,
    )

    return AdaptiveAdvisorDependencies(
        tab_builder=build_advisor_tab_response,
        chat_builder=build_advisor_chat_response,
        retrieval_builder=build_chat_advisor_context,
        calendar_store=OperationsCalendarStore(),
    )


def _dict(value: Any) -> dict[str, Any]:
    return value if isinstance(value, dict) else {}


def _list(value: Any) -> list[Any]:
    return value if isinstance(value, list) else []


def _compact_snapshot(dashboard: dict[str, Any]) -> dict[str, Any]:
    return {
        "currentData": copy.deepcopy(
            dashboard.get("currentData") or dashboard.get("data") or {}
        ),
        "metrics": copy.deepcopy(dashboard.get("metrics") or {}),
        "recentSummary": copy.deepcopy(dashboard.get("recentSummary") or {}),
        "forecast": copy.deepcopy(dashboard.get("forecast") or {}),
        "rtr": copy.deepcopy(dashboard.get("rtr") or {}),
        "weather": copy.deepcopy(dashboard.get("weather") or {}),
        "market": copy.deepcopy(
            dashboard.get("market")
            or dashboard.get("producePrices")
            or dashboard.get("prices")
            or {}
        ),
    }


def _result_summary(value: Any) -> tuple[str, list[str]]:
    if isinstance(value, dict):
        keys = sorted(str(key) for key in value.keys())
        status = value.get("status")
        summary = value.get("summary") or value.get("message")
        if isinstance(summary, dict):
            summary = summary.get("status") or summary.get("mode")
        text = str(summary or status or f"{len(keys)} output fields")
        return text[:300], keys[:30]
    if isinstance(value, list):
        return f"{len(value)} items", []
    return str(value)[:300], []


async def _run_traced(
    node: AdaptiveNode,
    fn: Callable[[], Any],
    *,
    clock: Callable[[], datetime],
) -> tuple[AdaptiveNode, Any, NodeTrace]:
    started_at = clock().astimezone(UTC)
    started_perf = time.perf_counter()
    status = NodeStatus.SUCCESS
    error = None
    value: Any = None
    try:
        value = fn()
        if asyncio.iscoroutine(value):
            value = await value
        if isinstance(value, dict) and str(value.get("status") or "").lower() in {
            "degraded",
            "unavailable",
            "retrieval_unavailable",
            "database_missing",
        }:
            status = NodeStatus.DEGRADED
    except Exception as exc:  # each optional lane degrades independently
        status = NodeStatus.FAILED
        error = f"{type(exc).__name__}: {exc}"
        value = {"status": "unavailable", "error": error}
    finished_at = clock().astimezone(UTC)
    duration_ms = max((time.perf_counter() - started_perf) * 1000, 0.0)
    summary, output_keys = _result_summary(value)
    return (
        node,
        value,
        NodeTrace(
            node=node,
            status=status,
            started_at=started_at,
            finished_at=finished_at,
            duration_ms=round(duration_ms, 3),
            summary=summary,
            output_keys=output_keys,
            error=error,
        ),
    )


def _lane_runtime(lane: Any) -> dict[str, Any]:
    machine = _dict(_dict(lane).get("machine_payload"))
    return _dict(machine.get("model_runtime"))


def _find_runtime(outputs: dict[str, Any]) -> dict[str, Any]:
    for node in (
        AdaptiveNode.PHYSIOLOGY_DIAGNOSIS,
        AdaptiveNode.ENVIRONMENT_ANALYSIS,
        AdaptiveNode.HARVEST_MARKET_ANALYSIS,
        AdaptiveNode.WORK_PLANNING,
    ):
        runtime = _lane_runtime(outputs.get(node.value))
        if runtime:
            return runtime
    return {}


def _constraint_gate(outputs: dict[str, Any]) -> ConstraintGateResult:
    violations: list[dict[str, Any]] = []
    risk_flags: list[str] = []
    statuses: list[str] = []

    for node_value in outputs.values():
        runtime = _lane_runtime(node_value)
        if not runtime:
            continue
        checks = _dict(runtime.get("constraint_checks"))
        if checks:
            statuses.append(str(checks.get("status") or "").lower())
            violations.extend(
                item for item in _list(checks.get("violated_constraints"))
                if isinstance(item, dict)
            )
        focus = _dict(runtime.get("answer_focus"))
        risk_flags.extend(str(item) for item in _list(focus.get("risk_flags")))
        violations.extend(
            item for item in _list(focus.get("violated_constraints"))
            if isinstance(item, dict)
        )
        if focus and focus.get("admissible") is False:
            statuses.append("fail")

    severe = any(
        str(item.get("severity") or "").lower()
        in {"critical", "error", "fatal", "high"}
        for item in violations
    )
    fail_markers = {"fail", "failed", "blocked", "unsafe", "refused"}
    warning_markers = {"warning", "warn", "degraded", "partial"}
    if severe or any(status in fail_markers for status in statuses):
        status = ConstraintStatus.FAIL
        reason = "one or more model/control constraints failed"
    elif violations or risk_flags or any(status in warning_markers for status in statuses):
        status = ConstraintStatus.WARNING
        reason = "the answer is usable only with the reported constraints and risks"
    else:
        status = ConstraintStatus.PASS
        reason = None

    return ConstraintGateResult(
        status=status,
        violations=violations,
        risk_flags=sorted(set(risk_flags)),
        reason=reason,
    )


def _admit_answer(
    *,
    plan: AdaptiveGraphPlan,
    outputs: dict[str, Any],
    constraint_gate: ConstraintGateResult,
) -> AdmissionResult:
    if constraint_gate.status is ConstraintStatus.FAIL:
        return AdmissionResult(
            admitted=False,
            reasons=[constraint_gate.reason or "constraint gate failed"],
        )

    runtime = _find_runtime(outputs)
    focus = _dict(runtime.get("answer_focus"))
    reasons: list[str] = []
    exact_match: bool | None = None
    within_range: bool | None = None
    admitted_count = 0
    refused_count = 0

    if focus:
        exact_match = focus.get("matched_user_request")
        risk_flags = {str(item) for item in _list(focus.get("risk_flags"))}
        within_range = "requested_delta_out_of_model_range" not in risk_flags
        if focus.get("admissible") is False:
            refused_count += 1
            reasons.append("model answer focus was not admitted")
        elif exact_match is False and focus.get("requested_delta") is not None:
            refused_count += 1
            reasons.append("computed model step differs from the requested delta")
        else:
            admitted_count += 1

    answer_facts = _dict(runtime.get("answer_facts"))
    admitted_count += len(_list(answer_facts.get("admitted_facts")))
    refused_count += len(_list(answer_facts.get("refused_facts")))

    requires_model = any(
        node in plan.nodes
        for node in (AdaptiveNode.BOUNDED_SCENARIO, AdaptiveNode.SENSITIVITY)
    )
    if requires_model and not runtime:
        reasons.append("model runtime output was unavailable")
        return AdmissionResult(
            admitted=False,
            admitted_fact_count=admitted_count,
            refused_fact_count=max(refused_count, 1),
            exact_request_match=exact_match,
            within_supported_range=within_range,
            reasons=reasons,
        )

    if focus and refused_count and not admitted_count:
        return AdmissionResult(
            admitted=False,
            admitted_fact_count=0,
            refused_fact_count=refused_count,
            exact_request_match=exact_match,
            within_supported_range=within_range,
            reasons=reasons,
        )

    # Qualitative status/diagnostic answers need no numerical fact. They are admitted
    # when the fixed constraint gate passed.
    return AdmissionResult(
        admitted=True,
        admitted_fact_count=admitted_count,
        refused_fact_count=refused_count,
        exact_request_match=exact_match,
        within_supported_range=within_range,
        reasons=reasons,
    )


def _deterministic_fallback_text(
    *,
    request: AdaptiveAdvisorRequest,
    outputs: dict[str, Any],
    quality_status: AnswerStatus,
    constraint_gate: ConstraintGateResult,
) -> str:
    if quality_status is AnswerStatus.REFUSED:
        return (
            "현재 계산은 제약조건을 통과하지 못해 조치 수치로 제시하지 않습니다. "
            "센서 상태와 모델 적용 범위를 먼저 확인해 주세요."
            if request.language == "ko"
            else "The current calculation failed its constraint gate, so no control number is being issued."
        )

    for node in (
        AdaptiveNode.HARVEST_MARKET_ANALYSIS,
        AdaptiveNode.WORK_PLANNING,
        AdaptiveNode.PHYSIOLOGY_DIAGNOSIS,
        AdaptiveNode.ENVIRONMENT_ANALYSIS,
    ):
        lane = _dict(outputs.get(node.value))
        machine = _dict(lane.get("machine_payload"))
        for key in (
            "harvest_market_analysis",
            "work_analysis",
            "physiology_analysis",
            "environment_analysis",
        ):
            analysis = _dict(machine.get(key))
            summary = analysis.get("summary")
            if isinstance(summary, str) and summary.strip():
                return summary.strip()
        message = lane.get("message")
        if isinstance(message, str) and message.strip():
            return message.strip()

    current = _dict(outputs.get(AdaptiveNode.LIVE_SNAPSHOT.value))
    readings = _dict(current.get("currentData"))
    if request.language == "ko":
        if readings:
            return "현재 계측 상태를 읽었습니다. 더 구체적인 진단을 위해 비교 시점이나 조정하려는 변수를 알려주세요."
        return "현재 실시간 계측값이 부족해 조치보다 데이터 확인이 우선입니다."
    return (
        "The live state was read. Specify a comparison window or control change for a deeper diagnosis."
        if readings
        else "Live measurements are insufficient; restore data visibility before taking action."
    )


async def execute_adaptive_advisor(
    request: AdaptiveAdvisorRequest,
    *,
    deps: AdaptiveAdvisorDependencies | None = None,
) -> AdaptiveAdvisorResponse:
    deps = deps or default_dependencies()
    plan = build_adaptive_plan(request)
    greenhouse_id = request.greenhouse_id or request.crop
    frozen_dashboard = copy.deepcopy(request.dashboard)
    snapshot_fingerprint = fingerprint_snapshot(frozen_dashboard)
    outputs: dict[str, Any] = {}
    trace_by_node: dict[AdaptiveNode, NodeTrace] = {}

    async def record(node: AdaptiveNode, fn: Callable[[], Any]) -> Any:
        result_node, value, trace = await _run_traced(node, fn, clock=deps.clock)
        outputs[result_node.value] = value
        trace_by_node[result_node] = trace
        return value

    await record(
        AdaptiveNode.FREEZE_SNAPSHOT,
        lambda: {
            "status": "ready",
            "fingerprint": snapshot_fingerprint,
            "greenhouse_id": greenhouse_id,
        },
    )
    await record(
        AdaptiveNode.LIVE_SNAPSHOT,
        lambda: {"status": "ready", **_compact_snapshot(frozen_dashboard)},
    )

    lane_nodes = [
        node
        for node in plan.nodes
        if node
        in {
            AdaptiveNode.HISTORY_COMPARE,
            AdaptiveNode.ENVIRONMENT_ANALYSIS,
            AdaptiveNode.PHYSIOLOGY_DIAGNOSIS,
            AdaptiveNode.WORK_PLANNING,
            AdaptiveNode.HARVEST_MARKET_ANALYSIS,
            AdaptiveNode.EXPERT_WIKI,
            AdaptiveNode.WEATHER_OUTLOOK,
            AdaptiveNode.MARKET_OUTLOOK,
            AdaptiveNode.OPERATIONS_CALENDAR,
        }
    ]
    semaphore = asyncio.Semaphore(plan.max_parallel_nodes)

    def node_callable(node: AdaptiveNode) -> Callable[[], Any]:
        if node is AdaptiveNode.HISTORY_COMPARE:
            return lambda: {
                "status": "ready" if frozen_dashboard.get("recentSummary") else "unavailable",
                "recentSummary": copy.deepcopy(frozen_dashboard.get("recentSummary") or {}),
            }
        if node is AdaptiveNode.WEATHER_OUTLOOK:
            return lambda: copy.deepcopy(frozen_dashboard.get("weather") or {})
        if node is AdaptiveNode.MARKET_OUTLOOK:
            return lambda: copy.deepcopy(
                frozen_dashboard.get("market")
                or frozen_dashboard.get("producePrices")
                or frozen_dashboard.get("prices")
                or {}
            )
        if node is AdaptiveNode.OPERATIONS_CALENDAR:
            horizon_days = max(plan.horizons_hours, default=168) // 24
            return lambda: deps.calendar_store.describe_window(
                greenhouse_id,
                start=date.today(),
                end=date.today() + timedelta(days=max(1, horizon_days)),
            )
        if node is AdaptiveNode.EXPERT_WIKI:
            messages = [
                *request.messages,
                {"role": "user", "content": request.question},
            ]
            return lambda: deps.retrieval_builder(
                crop=request.crop,
                messages=messages,
            )

        tab_name = {
            AdaptiveNode.ENVIRONMENT_ANALYSIS: "environment",
            AdaptiveNode.PHYSIOLOGY_DIAGNOSIS: "physiology",
            AdaptiveNode.WORK_PLANNING: "work",
            AdaptiveNode.HARVEST_MARKET_ANALYSIS: "harvest_market",
        }[node]
        return lambda: deps.tab_builder(
            tab_name=tab_name,
            crop=request.crop,
            greenhouse_id=greenhouse_id,
            dashboard=frozen_dashboard,
        )

    async def run_lane(node: AdaptiveNode) -> None:
        async with semaphore:
            fn = node_callable(node)
            await record(node, lambda: asyncio.to_thread(fn))

    if lane_nodes:
        await asyncio.gather(*(run_lane(node) for node in lane_nodes))

    # Model calculation nodes expose the already-computed, admitted model runtime
    # from the landed advisor lane rather than giving the LLM a second calculation
    # path.
    runtime = _find_runtime(outputs)
    if AdaptiveNode.BOUNDED_SCENARIO in plan.nodes:
        await record(
            AdaptiveNode.BOUNDED_SCENARIO,
            lambda: {
                "status": "ready" if runtime else "unavailable",
                "scenario": copy.deepcopy(_dict(runtime.get("scenario"))),
                "answer_focus": copy.deepcopy(_dict(runtime.get("answer_focus"))),
            },
        )
    if AdaptiveNode.SENSITIVITY in plan.nodes:
        await record(
            AdaptiveNode.SENSITIVITY,
            lambda: {
                "status": "ready" if runtime else "unavailable",
                "sensitivity": copy.deepcopy(_dict(runtime.get("sensitivity"))),
            },
        )

    constraint_gate = _constraint_gate(outputs)
    await record(
        AdaptiveNode.CONSTRAINT_GATE,
        lambda: constraint_gate.model_dump(mode="json"),
    )
    admission = _admit_answer(
        plan=plan,
        outputs=outputs,
        constraint_gate=constraint_gate,
    )
    await record(
        AdaptiveNode.ANSWER_ADMISSION,
        lambda: admission.model_dump(mode="json"),
    )

    quality = build_quality_profile(
        plan=plan,
        dashboard=frozen_dashboard,
        outputs=outputs,
        constraint_gate=constraint_gate,
        admission=admission,
        now=deps.clock(),
    )
    await record(
        AdaptiveNode.QUALITY_GATE,
        lambda: quality.model_dump(mode="json"),
    )

    fallback_text = _deterministic_fallback_text(
        request=request,
        outputs=outputs,
        quality_status=quality.answer_status,
        constraint_gate=constraint_gate,
    )
    text = fallback_text
    if plan.include_narrative:
        dashboard_with_graph = copy.deepcopy(frozen_dashboard)
        dashboard_with_graph["adaptive_advisor"] = {
            "plan": plan.model_dump(mode="json"),
            "quality_profile": quality.model_dump(mode="json"),
            "constraint_gate": constraint_gate.model_dump(mode="json"),
            "admission": admission.model_dump(mode="json"),
            "operations_calendar": outputs.get(
                AdaptiveNode.OPERATIONS_CALENDAR.value
            ),
        }

        async def narrate() -> dict[str, Any]:
            try:
                result = await asyncio.to_thread(
                    deps.chat_builder,
                    crop=request.crop,
                    messages=[
                        *request.messages,
                        {"role": "user", "content": request.question},
                    ],
                    dashboard=dashboard_with_graph,
                    language=request.language,
                )
                return result
            except Exception as exc:
                return {
                    "status": "degraded",
                    "text": fallback_text,
                    "error": f"{type(exc).__name__}: {exc}",
                }

        narrative = await record(AdaptiveNode.NARRATE, narrate)
        text = str(_dict(narrative).get("text") or fallback_text)

    ordered_trace = [
        trace_by_node[node]
        for node in plan.nodes
        if node in trace_by_node
    ]
    status = (
        "refused"
        if quality.answer_status is AnswerStatus.REFUSED
        else "degraded"
        if any(item.status in {NodeStatus.DEGRADED, NodeStatus.FAILED} for item in ordered_trace)
        else "success"
    )
    return AdaptiveAdvisorResponse(
        status=status,
        crop=request.crop,
        greenhouse_id=greenhouse_id,
        question=request.question,
        snapshot_fingerprint=snapshot_fingerprint,
        plan=plan,
        trace=ordered_trace,
        quality_profile=quality,
        constraint_gate=constraint_gate,
        admission=admission,
        text=text,
        machine_payload={
            "node_outputs": outputs,
            "fixed_safety_spine": [
                AdaptiveNode.CONSTRAINT_GATE.value,
                AdaptiveNode.ANSWER_ADMISSION.value,
                AdaptiveNode.QUALITY_GATE.value,
            ],
        },
    )
