"""Compile completed graph lanes into one authoritative answer packet."""

from __future__ import annotations

import json
import re
from typing import Any

from .contracts import (
    AdaptiveAnswerPacket,
    AdaptiveGraphPlan,
    AdaptiveNode,
    AdmissionResult,
    AnswerAction,
    AnswerDriver,
    AnswerStatus,
    ConstraintGateResult,
)


def _dict(value: Any) -> dict[str, Any]:
    return value if isinstance(value, dict) else {}


def _list(value: Any) -> list[Any]:
    return value if isinstance(value, list) else []


def _float(value: Any) -> float | None:
    try:
        result = float(value)
    except (TypeError, ValueError):
        return None
    return None if result != result else result


def _runtime_candidates(outputs: dict[str, Any]) -> list[dict[str, Any]]:
    result: list[dict[str, Any]] = []
    for node in (
        AdaptiveNode.PHYSIOLOGY_DIAGNOSIS,
        AdaptiveNode.ENVIRONMENT_ANALYSIS,
        AdaptiveNode.WORK_PLANNING,
        AdaptiveNode.HARVEST_MARKET_ANALYSIS,
    ):
        lane = _dict(outputs.get(node.value))
        runtime = _dict(_dict(lane.get("machine_payload")).get("model_runtime"))
        if runtime:
            result.append({"node": node.value, "runtime": runtime})
    return result


def select_primary_runtime(
    outputs: dict[str, Any],
    *,
    plan: AdaptiveGraphPlan,
) -> dict[str, Any]:
    """Choose the runtime that best matches the user's actual request."""
    candidates = _runtime_candidates(outputs)
    if not candidates:
        return {}
    ranked: list[tuple[float, dict[str, Any]]] = []
    preferred = {
        "DIAGNOSE": AdaptiveNode.PHYSIOLOGY_DIAGNOSIS.value,
        "WHAT_IF": AdaptiveNode.PHYSIOLOGY_DIAGNOSIS.value,
        "PLAN": AdaptiveNode.WORK_PLANNING.value,
        "OPTIMIZE": AdaptiveNode.HARVEST_MARKET_ANALYSIS.value,
    }.get(plan.intent.value)
    for item in candidates:
        runtime = item["runtime"]
        focus = _dict(runtime.get("answer_focus"))
        scenario = _dict(runtime.get("scenario"))
        sensitivity = _dict(runtime.get("sensitivity"))
        score = 0.0
        score += 2.0 if item["node"] == preferred else 0.0
        score += 3.0 if focus.get("matched_user_request") is True else 0.0
        score += 2.0 if focus.get("admissible") is True else 0.0
        score += 1.5 if focus.get("requested_delta") is not None else 0.0
        score += _float(focus.get("confidence")) or 0.0
        score += _float(scenario.get("confidence")) or 0.0
        score += 0.5 * (_float(sensitivity.get("confidence")) or 0.0)
        ranked.append((score, item))
    ranked.sort(key=lambda pair: pair[0], reverse=True)
    selected = dict(ranked[0][1]["runtime"])
    selected["_selected_from_node"] = ranked[0][1]["node"]
    selected["_runtime_candidate_count"] = len(ranked)
    return selected


def _analysis_payload(lane: dict[str, Any]) -> dict[str, Any]:
    machine = _dict(lane.get("machine_payload"))
    for key in (
        "physiology_analysis",
        "environment_analysis",
        "work_analysis",
        "harvest_market_analysis",
    ):
        value = _dict(machine.get(key))
        if value:
            return value
    return {}


def _collect_lane_observations(outputs: dict[str, Any]) -> list[str]:
    observations: list[str] = []
    history = _dict(outputs.get(AdaptiveNode.HISTORY_COMPARE.value))
    if history.get("status") == "ready":
        similarity = _float(history.get("environment_similarity"))
        target_delta = _float(history.get("target_delta"))
        target = history.get("target_signal")
        if similarity is not None:
            observations.append(f"environment similarity={similarity:.2f}")
        if target_delta is not None:
            observations.append(f"{target} delta={target_delta:+.4g}")
    for node in (
        AdaptiveNode.PHYSIOLOGY_DIAGNOSIS,
        AdaptiveNode.ENVIRONMENT_ANALYSIS,
        AdaptiveNode.WORK_PLANNING,
        AdaptiveNode.HARVEST_MARKET_ANALYSIS,
    ):
        analysis = _analysis_payload(_dict(outputs.get(node.value)))
        for key in ("deviation", "diagnosis", "summary", "primary_constraint"):
            value = analysis.get(key)
            if isinstance(value, str) and value.strip():
                observations.append(value.strip())
        for value in _list(analysis.get("cause_hypotheses")):
            if isinstance(value, str) and value.strip():
                observations.append(value.strip())
    return list(dict.fromkeys(observations))[:12]


def _drivers(outputs: dict[str, Any], runtime: dict[str, Any], language: str) -> list[AnswerDriver]:
    drivers: list[AnswerDriver] = []
    history = _dict(outputs.get(AdaptiveNode.HISTORY_COMPARE.value))
    for item in _list(history.get("hypotheses")):
        if not isinstance(item, dict):
            continue
        label = str(
            item.get("label_ko" if language == "ko" else "label_en")
            or item.get("code")
            or "driver"
        )
        drivers.append(
            AnswerDriver(
                code=str(item.get("code") or "temporal_driver"),
                label=label,
                support=max(0.0, min(1.0, _float(item.get("support")) or 0.5)),
                observations=[str(value) for value in _list(item.get("observations"))],
            )
        )
    state = _dict(runtime.get("state_snapshot"))
    limiting_factor = state.get("limiting_factor") or _dict(runtime.get("provenance")).get(
        "limiting_factor"
    )
    if limiting_factor:
        drivers.append(
            AnswerDriver(
                code="model_limiting_factor",
                label=(
                    f"모델 제한요인: {limiting_factor}"
                    if language == "ko"
                    else f"Model limiting factor: {limiting_factor}"
                ),
                support=max(0.45, _float(runtime.get("confidence")) or 0.55),
                observations=[],
            )
        )
    unique: dict[str, AnswerDriver] = {}
    for driver in sorted(drivers, key=lambda item: item.support, reverse=True):
        unique.setdefault(driver.code, driver)
    return list(unique.values())[:5]


def _action_from_mapping(
    value: dict[str, Any],
    *,
    rank: int,
    language: str,
) -> AnswerAction | None:
    title = str(value.get("title") or value.get("action") or value.get("message") or "").strip()
    if not title:
        return None
    operator = str(
        value.get("operator")
        or value.get("instruction")
        or value.get("message")
        or title
    ).strip()
    expected = str(
        value.get("expected_effect")
        or value.get("expectedEffect")
        or value.get("rationale")
        or (
            "변화 신호를 확인한 뒤 다음 계산에서 유지 여부를 판단합니다."
            if language == "ko"
            else "Re-evaluate the effect at the next calculation."
        )
    ).strip()
    time_window = str(
        value.get("time_window")
        or value.get("timeWindow")
        or value.get("window")
        or ("today" if language == "en" else "오늘")
    )
    control = value.get("control")
    if control not in {
        "co2_setpoint_day",
        "temperature_day",
        "temperature_night",
        "rh_target",
        "screen_close",
    }:
        control = None
    return AnswerAction(
        rank=rank,
        title=title,
        operator=operator,
        time_window=time_window,
        expected_effect=expected,
        condition=(
            str(value.get("condition") or value.get("recheck_condition")).strip()
            if (value.get("condition") or value.get("recheck_condition"))
            else None
        ),
        control=control,
    )


def _actions(outputs: dict[str, Any], runtime: dict[str, Any], language: str) -> list[AnswerAction]:
    candidates: list[dict[str, Any]] = []
    for key in ("best_actions", "recommendations"):
        candidates.extend(item for item in _list(runtime.get(key)) if isinstance(item, dict))
    scenario = _dict(runtime.get("scenario"))
    recommended = scenario.get("recommended")
    if isinstance(recommended, dict):
        candidates.append(recommended)
    for node in (
        AdaptiveNode.ENVIRONMENT_ANALYSIS,
        AdaptiveNode.WORK_PLANNING,
        AdaptiveNode.HARVEST_MARKET_ANALYSIS,
        AdaptiveNode.PHYSIOLOGY_DIAGNOSIS,
    ):
        lane = _dict(outputs.get(node.value))
        machine = _dict(lane.get("machine_payload"))
        candidates.extend(
            item for item in _list(machine.get("advisor_actions")) if isinstance(item, dict)
        )
        analysis = _analysis_payload(lane)
        for key in (
            "priority_actions",
            "immediate_actions",
            "today_steering",
            "recommended_actions",
        ):
            candidates.extend(item for item in _list(analysis.get(key)) if isinstance(item, dict))

    actions: list[AnswerAction] = []
    seen: set[str] = set()
    for item in candidates:
        action = _action_from_mapping(item, rank=len(actions) + 1, language=language)
        if action is None:
            continue
        fingerprint = f"{action.title}|{action.operator}"
        if fingerprint in seen:
            continue
        seen.add(fingerprint)
        actions.append(action)
        if len(actions) >= 5:
            break
    return actions


def _market_directive(market: dict[str, Any], language: str) -> str | None:
    peak = _dict(market.get("peak_shock"))
    if not peak:
        return None
    risk = peak.get("risk_level")
    date_value = peak.get("date")
    pressure = peak.get("price_pressure_pct")
    if language == "ko":
        if pressure is not None:
            return (
                f"{date_value} 반입 집중 위험은 {risk}이며, 탄력도 시나리오상 "
                f"가격 압력은 {float(pressure):+.1f}%입니다."
            )
        return f"{date_value} 반입 집중 위험은 {risk}입니다."
    if pressure is not None:
        return (
            f"Arrival concentration risk on {date_value} is {risk}; the elasticity "
            f"scenario gives {float(pressure):+.1f}% price pressure."
        )
    return f"Arrival concentration risk on {date_value} is {risk}."


def _direct_answer(
    *,
    plan: AdaptiveGraphPlan,
    admission: AdmissionResult,
    constraint: ConstraintGateResult,
    history: dict[str, Any],
    market: dict[str, Any],
    language: str,
) -> str:
    if constraint.status.value == "FAIL" or not admission.admitted:
        return (
            "현재 계산은 모델·제약조건 경계를 통과하지 못해 수치 조치를 제시하지 않습니다."
            if language == "ko"
            else "The calculation did not pass the model and constraint boundary, so no control value is issued."
        )
    market_text = _market_directive(market, language)
    if market_text and plan.intent.value in {"PLAN", "OPTIMIZE"}:
        return market_text
    if history.get("status") == "ready" and plan.intent.value == "DIAGNOSE":
        drivers = _list(history.get("hypotheses"))
        if drivers:
            top = drivers[0]
            label = top.get("label_ko" if language == "ko" else "label_en") or top.get("code")
            return (
                f"전일 동시간 비교에서 가장 우선적인 설명은 {label}입니다."
                if language == "ko"
                else f"The leading explanation from the same-time comparison is {label}."
            )
    return (
        "현재 상태와 계산 가능한 문맥을 결합한 조건부 운영 답변입니다."
        if language == "ko"
        else "This is a conditional operating answer based on the currently available state."
    )


def _uncertainties(
    outputs: dict[str, Any],
    admission: AdmissionResult,
    constraint: ConstraintGateResult,
    language: str,
) -> list[str]:
    result: list[str] = []
    history = _dict(outputs.get(AdaptiveNode.HISTORY_COMPARE.value))
    for value in _list(history.get("missing_discriminators")):
        result.append(
            f"미확인 진단 변수: {value}" if language == "ko" else f"Missing discriminator: {value}"
        )
    market = _dict(outputs.get(AdaptiveNode.MARKET_OUTLOOK.value))
    if market.get("status") in {"partial", "unavailable"}:
        result.append(
            "반입량 또는 가격 탄력도 자료가 충분하지 않아 시장 평가는 범위형 시나리오입니다."
            if language == "ko"
            else "Arrival or elasticity data are limited; the market result is a bounded scenario."
        )
    for reason in admission.reasons:
        result.append(str(reason))
    for flag in constraint.risk_flags:
        result.append(
            f"제약·위험 신호: {flag}" if language == "ko" else f"Constraint/risk signal: {flag}"
        )
    return list(dict.fromkeys(result))[:12]


def _authorized_numbers(payload: dict[str, Any]) -> list[str]:
    numbers: set[str] = set()

    def walk(value: Any) -> None:
        if isinstance(value, bool) or value is None:
            return
        if isinstance(value, (int, float)):
            number = float(value)
            if number == number:
                numbers.add(f"{number:g}")
                numbers.add(f"{number:.1f}")
                numbers.add(f"{number:.2f}")
            return
        if isinstance(value, dict):
            for nested in value.values():
                walk(nested)
        elif isinstance(value, list):
            for nested in value:
                walk(nested)
        elif isinstance(value, str):
            for token in re.findall(r"[-+]?\d+(?:\.\d+)?", value):
                try:
                    number = float(token)
                except ValueError:
                    continue
                numbers.add(f"{number:g}")
                numbers.add(f"{number:.1f}")
                numbers.add(f"{number:.2f}")

    walk(payload)
    return sorted(numbers)


def build_answer_packet(
    *,
    question: str,
    plan: AdaptiveGraphPlan,
    outputs: dict[str, Any],
    admission: AdmissionResult,
    constraint_gate: ConstraintGateResult,
    answer_status: AnswerStatus,
    language: str,
) -> AdaptiveAnswerPacket:
    runtime = select_primary_runtime(outputs, plan=plan)
    history = _dict(outputs.get(AdaptiveNode.HISTORY_COMPARE.value))
    market = _dict(outputs.get(AdaptiveNode.MARKET_OUTLOOK.value))
    operations = _dict(outputs.get(AdaptiveNode.OPERATIONS_CALENDAR.value))
    weather = _dict(outputs.get(AdaptiveNode.WEATHER_OUTLOOK.value))
    expert = _dict(outputs.get(AdaptiveNode.EXPERT_WIKI.value))
    packet = AdaptiveAnswerPacket(
        question=question,
        intent=plan.intent,
        answer_status=answer_status,
        direct_answer=_direct_answer(
            plan=plan,
            admission=admission,
            constraint=constraint_gate,
            history=history,
            market=market,
            language=language,
        ),
        observations=_collect_lane_observations(outputs),
        causal_drivers=_drivers(outputs, runtime, language),
        actions=_actions(outputs, runtime, language),
        uncertainties=(
            _uncertainties(outputs, admission, constraint_gate, language)
            or [
                (
                    "새 센서·반입량·운영 일정이 들어오면 이 판단을 다시 계산해야 합니다."
                    if language == "ko"
                    else "Recalculate when new telemetry, arrival volume, or operations data arrive."
                )
            ]
        ),
        temporal_context=history,
        model_context={
            "selected_from_node": runtime.get("_selected_from_node"),
            "candidate_count": runtime.get("_runtime_candidate_count", 0),
            "status": runtime.get("status"),
            "answer_focus": _dict(runtime.get("answer_focus")),
            "scenario": _dict(runtime.get("scenario")),
            "sensitivity": _dict(runtime.get("sensitivity")),
            "state_snapshot": _dict(runtime.get("state_snapshot")),
        },
        weather_context=weather,
        market_context=market,
        operations_context=operations,
        expert_context={
            "status": expert.get("status"),
            "summary": expert.get("summary"),
            "llm_context": expert.get("llm_context"),
        },
    )
    dump = packet.model_dump(mode="json")
    packet.authorized_numbers = _authorized_numbers(dump)
    return packet


def render_answer_packet(packet: AdaptiveAnswerPacket, *, language: str) -> str:
    """Deterministic answer used when narration is disabled or rejected."""
    lines = [packet.direct_answer]
    if packet.causal_drivers:
        if language == "ko":
            lines.append("원인 우선순위:")
        else:
            lines.append("Ranked drivers:")
        for index, driver in enumerate(packet.causal_drivers[:3], start=1):
            observation = f" ({'; '.join(driver.observations)})" if driver.observations else ""
            lines.append(f"{index}. {driver.label}{observation}")
    if packet.actions:
        lines.append("조치:" if language == "ko" else "Actions:")
        for action in packet.actions[:4]:
            condition = (
                f" 조건: {action.condition}" if language == "ko" and action.condition
                else f" Condition: {action.condition}" if action.condition
                else ""
            )
            lines.append(
                f"{action.rank}. [{action.time_window}] {action.operator} "
                f"→ {action.expected_effect}{condition}"
            )
    if packet.uncertainties:
        lines.append("판단 한계:" if language == "ko" else "Limits:")
        for value in packet.uncertainties[:5]:
            lines.append(f"- {value}")
    return "\n".join(lines)
