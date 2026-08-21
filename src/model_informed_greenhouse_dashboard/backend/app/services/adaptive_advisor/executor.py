"""Execution engine for the bounded adaptive advisor graph."""

from __future__ import annotations

import asyncio
import copy
import time
import threading
import uuid
from dataclasses import dataclass, field
from datetime import UTC, date, datetime, timedelta
from typing import Any, Callable
from zoneinfo import ZoneInfo

from .answer_packet import build_answer_packet, render_answer_packet, select_primary_runtime
from .change_detection import fingerprint_snapshot
from .conversation_store import ConversationStore
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
from .market_supply_shock import MarketObservationStore, estimate_supply_shock
from .operations_calendar import OperationsCalendarStore
from .planner import analysis_text_for_request, build_adaptive_plan
from .quality import build_quality_profile
from .quality_ledger import QualityLedger
from .question_analysis import analyze_question
from .response_review import review_response
from .runtime_cache import RuntimeLaneCache
from .snapshot_resolution import resolve_dashboard_snapshot
from .telemetry_store import TelemetryStore
from .temporal_compare import compare_temporal_windows


TabBuilder = Callable[..., dict[str, Any]]
NarratorBuilder = Callable[..., dict[str, Any]]
RetrievalBuilder = Callable[..., dict[str, Any]]
SEOUL = ZoneInfo("Asia/Seoul")


@dataclass
class AdaptiveAdvisorDependencies:
    tab_builder: TabBuilder
    narrator_builder: NarratorBuilder
    retrieval_builder: RetrievalBuilder
    calendar_store: OperationsCalendarStore
    telemetry_store: TelemetryStore
    market_store: MarketObservationStore
    quality_ledger: QualityLedger
    conversation_store: ConversationStore = field(default_factory=ConversationStore)
    lane_cache: RuntimeLaneCache = field(default_factory=RuntimeLaneCache)
    node_timeouts: dict[AdaptiveNode, float] = field(default_factory=dict)
    clock: Callable[[], datetime] = lambda: datetime.now(UTC)


_DEFAULT_DEPENDENCIES: AdaptiveAdvisorDependencies | None = None
_DEFAULT_DEPENDENCIES_LOCK = threading.Lock()


def default_dependencies() -> AdaptiveAdvisorDependencies:
    global _DEFAULT_DEPENDENCIES
    if _DEFAULT_DEPENDENCIES is not None:
        return _DEFAULT_DEPENDENCIES
    with _DEFAULT_DEPENDENCIES_LOCK:
        if _DEFAULT_DEPENDENCIES is not None:
            return _DEFAULT_DEPENDENCIES

        from ..advisor_context_builder import build_chat_advisor_context
        from ..advisor_orchestration import build_advisor_tab_response
        from .narrator import build_adaptive_narrative_response

        _DEFAULT_DEPENDENCIES = AdaptiveAdvisorDependencies(
            tab_builder=build_advisor_tab_response,
            narrator_builder=build_adaptive_narrative_response,
            retrieval_builder=build_chat_advisor_context,
            calendar_store=OperationsCalendarStore(),
            telemetry_store=TelemetryStore(),
            market_store=MarketObservationStore(),
            quality_ledger=QualityLedger(),
            conversation_store=ConversationStore(),
            lane_cache=RuntimeLaneCache(),
        )
        return _DEFAULT_DEPENDENCIES


def _dict(value: Any) -> dict[str, Any]:
    return value if isinstance(value, dict) else {}


def _list(value: Any) -> list[Any]:
    return value if isinstance(value, list) else []


def _float(value: Any) -> float | None:
    try:
        number = float(value)
    except (TypeError, ValueError):
        return None
    return None if number != number else number


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
        summary = value.get("summary") or value.get("message") or value.get("status")
        if isinstance(summary, dict):
            summary = summary.get("status") or summary.get("mode")
        return str(summary or f"{len(keys)} output fields")[:300], keys[:30]
    if isinstance(value, list):
        return f"{len(value)} items", []
    return str(value)[:300], []


async def _run_traced(
    node: AdaptiveNode,
    fn: Callable[[], Any],
    *,
    clock: Callable[[], datetime],
    timeout_seconds: float | None,
) -> tuple[AdaptiveNode, Any, NodeTrace]:
    started_at = clock().astimezone(UTC)
    started_perf = time.perf_counter()
    status = NodeStatus.SUCCESS
    error = None
    timed_out = False

    async def invoke() -> Any:
        value = fn()
        if asyncio.iscoroutine(value):
            return await value
        return value

    try:
        if timeout_seconds is None:
            value = await invoke()
        else:
            value = await asyncio.wait_for(
                invoke(),
                timeout=max(0.001, float(timeout_seconds)),
            )
        marker = str(_dict(value).get("status") or "").lower()
        if marker in {
            "degraded",
            "unavailable",
            "partial",
            "baseline_unavailable",
            "history_unavailable",
            "insufficient_data",
        }:
            status = NodeStatus.DEGRADED
    except TimeoutError:
        timed_out = True
        status = NodeStatus.DEGRADED
        error = (
            f"TimeoutError: {node.value} exceeded "
            f"{float(timeout_seconds or 0.0):g} seconds"
        )
        value = {
            "status": "unavailable",
            "error": error,
            "timed_out": True,
        }
    except Exception as exc:
        status = NodeStatus.FAILED
        error = f"{type(exc).__name__}: {exc}"
        value = {"status": "unavailable", "error": error}

    finished_at = clock().astimezone(UTC)
    summary, output_keys = _result_summary(value)
    return (
        node,
        value,
        NodeTrace(
            node=node,
            status=status,
            started_at=started_at,
            finished_at=finished_at,
            duration_ms=round(
                max((time.perf_counter() - started_perf) * 1000, 0.0),
                3,
            ),
            summary=summary,
            output_keys=output_keys,
            error=error,
            timeout_seconds=timeout_seconds,
            timed_out=timed_out,
        ),
    )


def _lane_runtime(value: Any) -> dict[str, Any]:
    return _dict(_dict(_dict(value).get("machine_payload")).get("model_runtime"))


def _all_runtimes(outputs: dict[str, Any]) -> list[dict[str, Any]]:
    result: list[dict[str, Any]] = []
    for node in (
        AdaptiveNode.PHYSIOLOGY_DIAGNOSIS,
        AdaptiveNode.ENVIRONMENT_ANALYSIS,
        AdaptiveNode.WORK_PLANNING,
        AdaptiveNode.HARVEST_MARKET_ANALYSIS,
    ):
        runtime = _lane_runtime(outputs.get(node.value))
        if runtime:
            result.append(runtime)
    return result


def _constraint_gate(outputs: dict[str, Any]) -> ConstraintGateResult:
    violations: list[dict[str, Any]] = []
    risk_flags: list[str] = []
    statuses: list[str] = []
    for runtime in _all_runtimes(outputs):
        checks = _dict(runtime.get("constraint_checks"))
        if checks:
            statuses.append(str(checks.get("status") or "").lower())
            violations.extend(
                item
                for item in _list(checks.get("violated_constraints"))
                if isinstance(item, dict)
            )
        focus = _dict(runtime.get("answer_focus"))
        risk_flags.extend(str(item) for item in _list(focus.get("risk_flags")))
        violations.extend(
            item
            for item in _list(focus.get("violated_constraints"))
            if isinstance(item, dict)
        )
        if focus and focus.get("admissible") is False:
            statuses.append("fail")
    severe = any(
        str(item.get("severity") or "").lower()
        in {"critical", "error", "fatal", "high"}
        for item in violations
    )
    if severe or any(
        status in {"fail", "failed", "blocked", "unsafe", "refused"}
        for status in statuses
    ):
        return ConstraintGateResult(
            status=ConstraintStatus.FAIL,
            violations=violations,
            risk_flags=sorted(set(risk_flags)),
            reason="one or more model/control constraints failed",
        )
    if violations or risk_flags or any(
        status in {"warning", "warn", "degraded", "partial", "insufficient_context"}
        for status in statuses
    ):
        return ConstraintGateResult(
            status=ConstraintStatus.WARNING,
            violations=violations,
            risk_flags=sorted(set(risk_flags)),
            reason="usable only with the reported constraints and risks",
        )
    return ConstraintGateResult(
        status=ConstraintStatus.PASS,
        violations=[],
        risk_flags=[],
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
            refused_fact_count=1,
            reasons=[constraint_gate.reason or "constraint gate failed"],
        )
    runtime = select_primary_runtime(outputs, plan=plan)
    focus = _dict(runtime.get("answer_focus"))
    admitted_count = 0
    refused_count = 0
    reasons: list[str] = []
    exact_match: bool | None = None
    within_range: bool | None = None
    if focus:
        exact_match = focus.get("matched_user_request")
        risk_flags = {str(item) for item in _list(focus.get("risk_flags"))}
        within_range = "requested_delta_out_of_model_range" not in risk_flags
        if focus.get("admissible") is False:
            refused_count += 1
            reasons.append("model answer focus was not admitted")
        elif focus.get("requested_delta") is not None and exact_match is False:
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
        return AdmissionResult(
            admitted=False,
            refused_fact_count=max(1, refused_count),
            reasons=["model runtime output was unavailable"],
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
    return AdmissionResult(
        admitted=True,
        admitted_fact_count=admitted_count,
        refused_fact_count=refused_count,
        exact_request_match=exact_match,
        within_supported_range=within_range,
        reasons=reasons,
    )


def _preliminary_status(
    *,
    request: AdaptiveAdvisorRequest,
    admission: AdmissionResult,
    constraint: ConstraintGateResult,
    outputs: dict[str, Any],
) -> AnswerStatus:
    if constraint.status is ConstraintStatus.FAIL:
        return AnswerStatus.REFUSED
    current = _dict(request.dashboard.get("currentData") or request.dashboard.get("data"))
    present = sum(
        current.get(key) is not None
        for key in ("temperature", "humidity", "co2", "light", "vpd")
    )
    if present < 2:
        return AnswerStatus.NEEDS_DATA
    resolution = _dict(request.dashboard.get("_adaptive_snapshot_resolution"))
    snapshot_age = _float(resolution.get("snapshot_age_seconds"))
    if snapshot_age is None or snapshot_age > 60 * 60:
        return AnswerStatus.NEEDS_DATA
    if snapshot_age > 15 * 60:
        return AnswerStatus.MONITORING_FIRST
    if not admission.admitted:
        return AnswerStatus.CONDITIONAL
    required_nodes = set(request.requested_plan.nodes) if request.requested_plan else set()
    del required_nodes
    unavailable = any(
        str(_dict(outputs.get(node.value)).get("status") or "").lower()
        in {"unavailable", "history_unavailable"}
        for node in (
            AdaptiveNode.WEATHER_OUTLOOK,
            AdaptiveNode.MARKET_OUTLOOK,
            AdaptiveNode.OPERATIONS_CALENDAR,
        )
        if node.value in outputs
    )
    return AnswerStatus.CONDITIONAL if unavailable else AnswerStatus.OPERATIONAL


def _reference_time(current: dict[str, Any], clock: Callable[[], datetime]) -> datetime:
    for key in ("datetime", "timestamp", "t"):
        value = current.get(key)
        if isinstance(value, datetime):
            return value if value.tzinfo else value.replace(tzinfo=UTC)
        if isinstance(value, (int, float)):
            number = float(value)
            if number > 1e12:
                number /= 1000
            try:
                return datetime.fromtimestamp(number, tz=UTC)
            except (OSError, OverflowError, ValueError):
                pass
        if isinstance(value, str):
            try:
                parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
                return parsed if parsed.tzinfo else parsed.replace(tzinfo=UTC)
            except ValueError:
                pass
    return clock().astimezone(UTC)


def _server_history_compare(
    *,
    request: AdaptiveAdvisorRequest,
    deps: AdaptiveAdvisorDependencies,
    facets: dict[str, Any],
    greenhouse_id: str,
) -> dict[str, Any]:
    current = _dict(request.dashboard.get("currentData") or request.dashboard.get("data"))
    server = deps.telemetry_store.compare_same_time(
        crop=request.crop,
        greenhouse_id=greenhouse_id,
        current_data=current,
        facets=facets,
    )
    if server.get("status") == "ready":
        return server
    browser = compare_temporal_windows(request.dashboard, facets)
    if browser.get("status") == "ready":
        browser["history_source"] = "browser_fallback"
        browser["server_history_status"] = server.get("status")
        return browser
    server["browser_fallback_status"] = browser.get("status")
    return server


def _enriched_messages(
    request: AdaptiveAdvisorRequest,
    outputs: dict[str, Any],
) -> list[dict[str, str]]:
    fragments = [request.question]
    history = _dict(outputs.get(AdaptiveNode.HISTORY_COMPARE.value))
    if history:
        fragments.append(
            "temporal comparison: "
            + str(
                {
                    "status": history.get("status"),
                    "environment_similarity": history.get("environment_similarity"),
                    "target_delta": history.get("target_delta"),
                    "hypotheses": history.get("hypotheses"),
                    "missing": history.get("missing_discriminators"),
                }
            )
        )
    market = _dict(outputs.get(AdaptiveNode.MARKET_OUTLOOK.value))
    if market:
        fragments.append(
            "market supply shock: "
            + str(
                {
                    "status": market.get("status"),
                    "peak_shock": market.get("peak_shock"),
                    "assumptions": market.get("assumptions"),
                }
            )
        )
    operations = _dict(outputs.get(AdaptiveNode.OPERATIONS_CALENDAR.value))
    if operations:
        fragments.append(
            "operations: "
            + str(
                {
                    "shipment_blackout": operations.get("shipment_blackout"),
                    "next_shipment": operations.get("next_shipment"),
                    "capacities": operations.get("capacities"),
                }
            )
        )
    return [
        *request.messages,
        {"role": "user", "content": "\n".join(fragments)},
    ]


def _merge_messages(
    stored: list[dict[str, str]],
    supplied: list[dict[str, str]],
    *,
    limit: int = 20,
) -> list[dict[str, str]]:
    result: list[dict[str, str]] = []
    for message in [*stored, *supplied]:
        role = str(message.get("role") or "user")
        content = str(message.get("content") or "").strip()
        if role not in {"user", "assistant"} or not content:
            continue
        normalized = {"role": role, "content": content}
        if result and result[-1] == normalized:
            continue
        result.append(normalized)
    return result[-max(1, min(limit, 40)):]


async def execute_adaptive_advisor(
    request: AdaptiveAdvisorRequest,
    *,
    deps: AdaptiveAdvisorDependencies | None = None,
) -> AdaptiveAdvisorResponse:
    deps = deps or default_dependencies()
    greenhouse_id = request.greenhouse_id or request.crop
    run_id = str(uuid.uuid4())
    execution_now = deps.clock().astimezone(UTC)
    thread_id = deps.conversation_store.ensure_thread(
        request.thread_id,
        crop=request.crop,
        greenhouse_id=greenhouse_id,
        now=execution_now,
    )
    stored_messages = (
        deps.conversation_store.history(thread_id, limit=16)
        if request.use_thread_context
        else []
    )
    merged_messages = _merge_messages(stored_messages, request.messages)
    original_dashboard = copy.deepcopy(request.dashboard)
    browser_current = _dict(
        original_dashboard.get("currentData") or original_dashboard.get("data")
    )
    server_latest = deps.telemetry_store.latest(
        crop=request.crop,
        greenhouse_id=greenhouse_id,
    )
    resolved_dashboard, snapshot_resolution = resolve_dashboard_snapshot(
        original_dashboard,
        server_latest,
        now=execution_now,
    )
    request = request.model_copy(
        update={
            "greenhouse_id": greenhouse_id,
            "thread_id": thread_id,
            "messages": merged_messages,
            "dashboard": resolved_dashboard,
        }
    )
    plan = build_adaptive_plan(request)
    frozen_dashboard = copy.deepcopy(resolved_dashboard)
    fingerprint_dashboard = copy.deepcopy(resolved_dashboard)
    fingerprint_dashboard.pop("_adaptive_snapshot_resolution", None)
    snapshot_fingerprint = fingerprint_snapshot(fingerprint_dashboard)
    outputs: dict[str, Any] = {}
    trace_by_node: dict[AdaptiveNode, NodeTrace] = {}
    analysis_text = analysis_text_for_request(request)
    facets = analyze_question(
        analysis_text,
        crop=request.crop,
        language=request.language,
    )

    async def record(node: AdaptiveNode, fn: Callable[[], Any]) -> Any:
        timeout_seconds = deps.node_timeouts.get(node)
        if timeout_seconds is None:
            timeout_seconds = (
                plan.narration_timeout_seconds
                if node is AdaptiveNode.NARRATE
                else plan.node_timeout_seconds
            )
        result_node, value, trace = await _run_traced(
            node,
            fn,
            clock=deps.clock,
            timeout_seconds=timeout_seconds,
        )
        outputs[result_node.value] = value
        trace_by_node[result_node] = trace
        return value

    await record(
        AdaptiveNode.FREEZE_SNAPSHOT,
        lambda: {
            "status": "ready",
            "fingerprint": snapshot_fingerprint,
            "run_id": run_id,
            "greenhouse_id": greenhouse_id,
        },
    )

    current_data = _dict(
        frozen_dashboard.get("currentData") or frozen_dashboard.get("data")
    )

    def persist_live() -> dict[str, Any]:
        persisted = None
        if (
            browser_current
            and snapshot_resolution.get("browser_current_should_persist")
        ):
            persisted = deps.telemetry_store.append(
                browser_current,
                crop=request.crop,
                greenhouse_id=greenhouse_id,
                source="adaptive_request",
            )
        latest = deps.telemetry_store.latest(
            crop=request.crop,
            greenhouse_id=greenhouse_id,
        )
        return {
            "status": "ready" if current_data or latest else "unavailable",
            **_compact_snapshot(frozen_dashboard),
            "server_telemetry": deps.telemetry_store.describe(),
            "persisted_current": persisted,
            "latest_observation_at": _dict(latest).get("datetime"),
        }

    await record(AdaptiveNode.LIVE_SNAPSHOT, lambda: asyncio.to_thread(persist_live))

    parallel_nodes = [
        node
        for node in plan.nodes
        if node
        in {
            AdaptiveNode.HISTORY_COMPARE,
            AdaptiveNode.ENVIRONMENT_ANALYSIS,
            AdaptiveNode.PHYSIOLOGY_DIAGNOSIS,
            AdaptiveNode.WORK_PLANNING,
            AdaptiveNode.HARVEST_MARKET_ANALYSIS,
            AdaptiveNode.WEATHER_OUTLOOK,
            AdaptiveNode.OPERATIONS_CALENDAR,
        }
    ]
    semaphore = asyncio.Semaphore(plan.max_parallel_nodes)

    def callable_for(node: AdaptiveNode) -> Callable[[], Any]:
        if node is AdaptiveNode.HISTORY_COMPARE:
            return lambda: _server_history_compare(
                request=request,
                deps=deps,
                facets=facets,
                greenhouse_id=greenhouse_id,
            )
        if node is AdaptiveNode.WEATHER_OUTLOOK:
            return lambda: copy.deepcopy(frozen_dashboard.get("weather") or {})
        if node is AdaptiveNode.OPERATIONS_CALENDAR:
            horizon_days = max(plan.horizons_hours, default=336) // 24
            local_today = deps.clock().astimezone(SEOUL).date()
            return lambda: deps.calendar_store.describe_window(
                greenhouse_id,
                start=local_today,
                end=local_today + timedelta(days=max(1, horizon_days)),
            )
        tab_name = {
            AdaptiveNode.ENVIRONMENT_ANALYSIS: "environment",
            AdaptiveNode.PHYSIOLOGY_DIAGNOSIS: "physiology",
            AdaptiveNode.WORK_PLANNING: "work",
            AdaptiveNode.HARVEST_MARKET_ANALYSIS: "harvest_market",
        }[node]
        def cached_tab_lane() -> dict[str, Any]:
            cache_key = "|".join(
                [
                    "adaptive-tab-v1",
                    snapshot_fingerprint,
                    request.crop,
                    greenhouse_id,
                    node.value,
                ]
            )
            value, cache_hit = deps.lane_cache.get_or_compute(
                cache_key,
                lambda: deps.tab_builder(
                    tab_name=tab_name,
                    crop=request.crop,
                    greenhouse_id=greenhouse_id,
                    dashboard=frozen_dashboard,
                ),
            )
            payload = copy.deepcopy(_dict(value))
            payload["_adaptive_cache"] = {
                "hit": cache_hit,
                "key": cache_key,
            }
            return payload

        return cached_tab_lane

    async def run_parallel(node: AdaptiveNode) -> None:
        async with semaphore:
            fn = callable_for(node)
            await record(node, lambda: asyncio.to_thread(fn))

    if parallel_nodes:
        await asyncio.gather(*(run_parallel(node) for node in parallel_nodes))

    if AdaptiveNode.MARKET_OUTLOOK in plan.nodes:
        local_today = deps.clock().astimezone(SEOUL).date()
        market_id = str(
            frozen_dashboard.get("market_id")
            or _dict(frozen_dashboard.get("market")).get("market_id")
            or "kamis-wholesale"
        )
        await record(
            AdaptiveNode.MARKET_OUTLOOK,
            lambda: asyncio.to_thread(
                estimate_supply_shock,
                market_store=deps.market_store,
                calendar_store=deps.calendar_store,
                market_id=market_id,
                crop=request.crop,
                greenhouse_id=greenhouse_id,
                forecast_start=local_today,
                horizon_days=max(plan.horizons_hours, default=336) // 24,
                dashboard_market=_dict(
                    frozen_dashboard.get("market")
                    or frozen_dashboard.get("producePrices")
                ),
            ),
        )

    if AdaptiveNode.EXPERT_WIKI in plan.nodes:
        await record(
            AdaptiveNode.EXPERT_WIKI,
            lambda: asyncio.to_thread(
                deps.retrieval_builder,
                crop=request.crop,
                messages=_enriched_messages(request, outputs),
            ),
        )

    primary_runtime = select_primary_runtime(outputs, plan=plan)
    if AdaptiveNode.BOUNDED_SCENARIO in plan.nodes:
        await record(
            AdaptiveNode.BOUNDED_SCENARIO,
            lambda: {
                "status": "ready" if primary_runtime else "unavailable",
                "selected_from_node": primary_runtime.get("_selected_from_node"),
                "scenario": copy.deepcopy(_dict(primary_runtime.get("scenario"))),
                "answer_focus": copy.deepcopy(
                    _dict(primary_runtime.get("answer_focus"))
                ),
            },
        )
    if AdaptiveNode.SENSITIVITY in plan.nodes:
        await record(
            AdaptiveNode.SENSITIVITY,
            lambda: {
                "status": "ready" if primary_runtime else "unavailable",
                "selected_from_node": primary_runtime.get("_selected_from_node"),
                "sensitivity": copy.deepcopy(
                    _dict(primary_runtime.get("sensitivity"))
                ),
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
    preliminary_status = _preliminary_status(
        request=request,
        admission=admission,
        constraint=constraint_gate,
        outputs=outputs,
    )
    packet = build_answer_packet(
        question=request.question,
        plan=plan,
        outputs=outputs,
        admission=admission,
        constraint_gate=constraint_gate,
        answer_status=preliminary_status,
        language=request.language,
    )
    await record(
        AdaptiveNode.ANSWER_PACKET,
        lambda: packet.model_dump(mode="json"),
    )

    deterministic_text = render_answer_packet(packet, language=request.language)
    narrative_text = deterministic_text
    narrative_attempted = False
    if plan.include_narrative:
        narrative_attempted = True

        async def narrate() -> dict[str, Any]:
            try:
                return await asyncio.to_thread(
                    deps.narrator_builder,
                    crop=request.crop,
                    messages=[
                        *request.messages,
                        {"role": "user", "content": request.question},
                    ],
                    language=request.language,
                    answer_packet=packet.model_dump(mode="json"),
                )
            except Exception as exc:
                return {
                    "status": "degraded",
                    "text": deterministic_text,
                    "error": f"{type(exc).__name__}: {exc}",
                }

        narrative = await record(AdaptiveNode.NARRATE, narrate)
        narrative_text = str(_dict(narrative).get("text") or deterministic_text)

    review = review_response(
        text=narrative_text,
        packet=packet,
        language=request.language,
        narrative_attempted=narrative_attempted,
    )
    await record(
        AdaptiveNode.RESPONSE_REVIEW,
        lambda: review.model_dump(mode="json"),
    )
    quality = build_quality_profile(
        plan=plan,
        dashboard=frozen_dashboard,
        outputs=outputs,
        constraint_gate=constraint_gate,
        admission=admission,
        answer_packet=packet,
        response_review=review,
        now=deps.clock(),
    )
    await record(
        AdaptiveNode.QUALITY_GATE,
        lambda: quality.model_dump(mode="json"),
    )

    ordered_trace = [
        trace_by_node[node] for node in plan.nodes if node in trace_by_node
    ]
    status = (
        "refused"
        if quality.answer_status is AnswerStatus.REFUSED
        else "degraded"
        if any(
            item.status in {NodeStatus.DEGRADED, NodeStatus.FAILED}
            for item in ordered_trace
        )
        else "success"
    )
    response = AdaptiveAdvisorResponse(
        run_id=run_id,
        thread_id=thread_id,
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
        answer_packet=packet,
        text=review.text,
        machine_payload={
            "node_outputs": outputs,
            "question_facets": facets,
            "history_authority": "server_timeseries",
            "market_model": "holiday-arrival-supply-shock.v2",
            "snapshot_resolution": snapshot_resolution,
            "runtime_lane_cache": deps.lane_cache.describe(),
            "conversation": {
                "thread_id": thread_id,
                "loaded_message_count": len(stored_messages),
                "merged_message_count": len(merged_messages),
                "context_used": analysis_text != request.question,
            },
            "fixed_tail": [
                AdaptiveNode.CONSTRAINT_GATE.value,
                AdaptiveNode.ANSWER_ADMISSION.value,
                AdaptiveNode.ANSWER_PACKET.value,
                *(
                    [AdaptiveNode.NARRATE.value]
                    if plan.include_narrative
                    else []
                ),
                AdaptiveNode.RESPONSE_REVIEW.value,
                AdaptiveNode.QUALITY_GATE.value,
            ],
        },
    )
    try:
        deps.quality_ledger.record_run(response.model_dump(mode="json"))
    except Exception as exc:
        response.machine_payload["quality_ledger_warning"] = (
            f"{type(exc).__name__}: {exc}"
        )
    try:
        conversation_receipt = deps.conversation_store.append_exchange(
            thread_id=thread_id,
            run_id=run_id,
            user_text=request.question,
            assistant_text=response.text,
            created_at=deps.clock(),
        )
        response.machine_payload["conversation"]["persisted"] = True
        response.machine_payload["conversation"]["receipt"] = conversation_receipt
    except Exception as exc:
        response.machine_payload["conversation"]["persisted"] = False
        response.machine_payload["conversation_warning"] = (
            f"{type(exc).__name__}: {exc}"
        )
    return response
