"""Thin SmartGrow advisor orchestration helpers over landed seams."""

from __future__ import annotations

from copy import deepcopy
from datetime import datetime, timezone
import logging
import re
from typing import Any, Optional

from .advisor_context_builder import (
    build_chat_advisor_context,
    build_summary_advisor_context,
    build_tab_advisor_context,
)
from .advisory_api import (
    build_nutrient_correction_response,
    build_nutrient_recommendation_response,
    build_pesticide_recommendation_response,
)
from .decision import DecisionSupport
from .knowledge_catalog import build_knowledge_catalog
from .model_runtime.constraint_engine import CONTROL_SPECS
from .model_runtime.model_state_store import ModelStateStore
from .model_runtime.scenario_runner import (
    run_bounded_scenario,
    run_precision_ladder_scenarios,
)
from .model_runtime.sensitivity_engine import compute_local_sensitivities
from .openai_service import (
    build_advisory_display_payload,
    generate_chat_reply,
    generate_consulting,
)


_LANDED_TABS = (
    "environment",
    "physiology",
    "work",
    "pesticide",
    "nutrient",
    "correction",
    "harvest_market",
)
_PLANNED_TABS: dict[str, str] = {}
_SUPPORTED_TABS = (*_LANDED_TABS, *_PLANNED_TABS.keys())
_MODEL_RUNTIME_HORIZONS_HOURS = (24, 72, 168, 336)
_MODEL_RUNTIME_CONTROL_HINTS = {
    "summary": ("co2_setpoint_day", "temperature_day", "rh_target"),
    "chat": ("co2_setpoint_day", "temperature_day", "temperature_night", "rh_target"),
    "environment": (
        "co2_setpoint_day",
        "temperature_day",
        "temperature_night",
        "rh_target",
        "screen_close",
    ),
    "physiology": ("co2_setpoint_day", "temperature_night", "rh_target"),
    "work": ("rh_target", "screen_close", "temperature_day"),
    "harvest_market": ("temperature_day", "screen_close", "rh_target"),
}
_MODEL_RUNTIME_TIME_WINDOWS = {
    "co2_setpoint_day": "today",
    "temperature_day": "today",
    "temperature_night": "this_week",
    "rh_target": "now",
    "screen_close": "now",
}
_MODEL_RUNTIME_CONTROL_LABELS = {
    "co2_setpoint_day": "주간 CO2",
    "temperature_day": "주간 온도",
    "temperature_night": "야간 온도",
    "rh_target": "상대습도 목표",
    "screen_close": "스크린 닫힘",
}
_MODEL_RUNTIME_CONTROL_LABELS_EN = {
    "co2_setpoint_day": "daytime CO2",
    "temperature_day": "day temperature",
    "temperature_night": "night temperature",
    "rh_target": "relative humidity target",
    "screen_close": "screen closure",
}
_CHAT_CURRENT_STATE_TERMS = (
    "생육",
    "생장",
    "발달",
    "전개",
    "마디",
    "마디수",
    "노드",
    "엽수",
    "작물 상태",
    "현재 상태",
    "지금 상태",
    "상태 어때",
    "상태는",
    "진단",
    "canopy balance",
    "growth status",
    "crop status",
    "current state",
    "node",
    "nodes",
    "node count",
    "leaf count",
    "development status",
)
_CHAT_WHAT_IF_TERMS = (
    "올리",
    "높",
    "내리",
    "낮추",
    "줄이",
    "늘리",
    "조정",
    "변경",
    "바꾸",
    "하면",
    "올리면",
    "낮추면",
    "하려면",
    "어떻게",
    "방법",
    "솔루션",
    "추천",
    "what if",
    "what-if",
    "raise",
    "lower",
    "increase",
    "decrease",
    "adjust",
    "change",
    "how to",
    "should",
    "recommend",
)
_WORK_EVENT_COMPARE_HORIZONS_HOURS = (24, 72, 168, 336)
logger = logging.getLogger(__name__)


def _normalize_tab_name(tab_name: str) -> str:
    normalized = (tab_name or "").strip().lower().replace("-", "_")
    if normalized in {"nutrient_correction", "drain_feedback"}:
        return "correction"
    return normalized


def _public_tab_entrypoint(tab_name: str) -> str:
    public_tab_name = "harvest-market" if tab_name == "harvest_market" else tab_name
    return f"/api/advisor/tab/{public_tab_name}"


def _context_has_value(value: Any) -> bool:
    if value is None:
        return False
    if isinstance(value, dict):
        return bool(value)
    if isinstance(value, (list, tuple, set)):
        return len(value) > 0
    return True


def _get_dashboard_context(
    dashboard: dict[str, Any],
    *keys: str,
) -> Any:
    for key in keys:
        value = dashboard.get(key)
        if _context_has_value(value):
            return value
    return None


def _collect_missing_data_flags(dashboard: dict[str, Any]) -> list[str]:
    return [
        key
        for key, aliases in (
            ("currentData", ("currentData", "data")),
            ("metrics", ("metrics",)),
            ("recentSummary", ("recentSummary",)),
            ("weather", ("weather",)),
            ("rtr", ("rtr",)),
        )
        if not _context_has_value(_get_dashboard_context(dashboard, *aliases))
    ]


def _context_completeness(dashboard: dict[str, Any]) -> float:
    checks = (
        _context_has_value(_get_dashboard_context(dashboard, "currentData", "data")),
        _context_has_value(_get_dashboard_context(dashboard, "metrics")),
        _context_has_value(_get_dashboard_context(dashboard, "recentSummary")),
        _context_has_value(_get_dashboard_context(dashboard, "weather")),
        _context_has_value(_get_dashboard_context(dashboard, "rtr")),
        _context_has_value(_get_dashboard_context(dashboard, "knowledge")),
    )
    return round(sum(1 for item in checks if item) / len(checks), 2)


def _infer_domains(
    dashboard: dict[str, Any],
    advisory_surfaces: dict[str, dict[str, Any]],
) -> list[str]:
    domains: list[str] = []

    if _context_has_value(_get_dashboard_context(dashboard, "weather")) or _context_has_value(
        _get_dashboard_context(dashboard, "rtr")
    ):
        domains.append("environment_control")
    if _context_has_value(_get_dashboard_context(dashboard, "currentData", "data")) or _context_has_value(
        _get_dashboard_context(dashboard, "metrics")
    ):
        domains.append("crop_physiology")
    if advisory_surfaces.get("pesticide", {}).get("status") == "ready":
        domains.append("disease_pest")
    if advisory_surfaces.get("nutrient", {}).get("status") == "ready":
        domains.append("nutrient_recipe")
    if advisory_surfaces.get("nutrient_correction", {}).get("status") == "ready":
        domains.append("drain_feedback")
    if _context_has_value(_get_dashboard_context(dashboard, "forecast")):
        domains.append("cultivation_work")
    if _context_has_value(_get_dashboard_context(dashboard, "market")) or _context_has_value(
        _get_dashboard_context(dashboard, "forecast")
    ):
        domains.append("harvest_market")

    ordered_domains: list[str] = []
    for domain in domains:
        if domain not in ordered_domains:
            ordered_domains.append(domain)

    return ordered_domains


def _build_internal_provenance(
    catalog_payload: dict[str, Any],
    advisory_surfaces: dict[str, dict[str, Any]],
    retrieval_context: dict[str, Any] | None = None,
) -> dict[str, Any]:
    payload = {
        "catalog_version": catalog_payload.get("catalog_version"),
        "pending_parsers": catalog_payload.get("summary", {}).get("pending_parsers", []),
        "surface_routes": {
            key: surface.get("route")
            for key, surface in advisory_surfaces.items()
        },
    }
    if retrieval_context:
        payload["knowledge_query_turn"] = retrieval_context.get("internal_provenance", {})
    return payload


def _inject_advisor_retrieval_context(
    dashboard: dict[str, Any],
    retrieval_context: dict[str, Any],
) -> dict[str, Any]:
    if retrieval_context.get("status") != "ready":
        return dashboard

    llm_context = retrieval_context.get("llm_context")
    if not llm_context:
        return dashboard

    dashboard_payload = deepcopy(dashboard)
    knowledge_payload = dict(dashboard_payload.get("knowledge") or {})
    knowledge_payload["advisor_retrieval_context"] = llm_context
    dashboard_payload["knowledge"] = knowledge_payload
    return dashboard_payload


def _inject_model_runtime_context(
    dashboard: dict[str, Any],
    model_runtime: dict[str, Any],
) -> dict[str, Any]:
    dashboard_payload = deepcopy(dashboard)
    dashboard_payload["model_runtime"] = model_runtime
    return dashboard_payload


def _coerce_float(value: Any) -> float | None:
    try:
        numeric = float(value)
    except (TypeError, ValueError):
        return None
    if numeric != numeric:
        return None
    return numeric


def _safe_int(value: Any, default: int = 0) -> int:
    numeric = _coerce_float(value)
    if numeric is None:
        return default
    return int(numeric)


def _coerce_dict(value: Any) -> dict[str, Any]:
    return value if isinstance(value, dict) else {}


def _clamp(value: float, low: float, high: float) -> float:
    return max(low, min(high, value))


def _normalize_leaf_activity_profile(
    *,
    lai: float,
    humidity_pct: float | None,
    vpd_kpa: float | None,
) -> dict[str, float]:
    upper = 0.46
    middle = 0.34
    bottom = 0.20

    if lai >= 3.2:
        upper += 0.06
        bottom -= 0.05
    elif lai <= 1.8:
        upper -= 0.03
        bottom += 0.04

    if humidity_pct is not None and humidity_pct >= 85:
        upper += 0.02
        bottom -= 0.03
    if vpd_kpa is not None and vpd_kpa <= 0.45:
        upper += 0.02
        middle += 0.01
        bottom -= 0.03
    elif vpd_kpa is not None and vpd_kpa >= 1.3:
        upper -= 0.02
        middle += 0.01
        bottom += 0.01

    total = max(upper + middle + bottom, 1e-9)
    normalized = {
        "upper": _clamp(upper / total, 0.05, 0.9),
        "middle": _clamp(middle / total, 0.05, 0.9),
        "bottom": _clamp(bottom / total, 0.05, 0.9),
    }
    renorm = max(sum(normalized.values()), 1e-9)
    return {
        layer: round(value / renorm, 6)
        for layer, value in normalized.items()
    }


def _infer_runtime_limiting_factor(
    *,
    co2_ppm: float | None,
    light_umol: float | None,
    vpd_kpa: float | None,
) -> str:
    if co2_ppm is not None and light_umol is not None and co2_ppm <= 550 and light_umol >= 200:
        return "rubisco"
    if vpd_kpa is not None and vpd_kpa >= 1.3:
        return "rubisco"
    if light_umol is not None and light_umol <= 180:
        return "electron_transport"
    return "electron_transport"


def _select_runtime_controls(
    *,
    tab_name: str,
    messages: Optional[list[dict[str, str]]] = None,
) -> list[str]:
    if tab_name != "chat":
        return list(_MODEL_RUNTIME_CONTROL_HINTS.get(tab_name, _MODEL_RUNTIME_CONTROL_HINTS["summary"]))

    transcript = " ".join(
        str(message.get("content") or "")
        for message in (messages or [])
        if isinstance(message, dict)
    ).lower()
    focused_controls: list[str] = []
    if any(keyword in transcript for keyword in ("co2", "ppm", "이산화탄소")):
        focused_controls.append("co2_setpoint_day")
    if any(keyword in transcript for keyword in ("night", "야간", "밤")):
        focused_controls.append("temperature_night")
    if any(keyword in transcript for keyword in ("temp", "temperature", "온도")):
        focused_controls.append("temperature_day")
    if any(keyword in transcript for keyword in ("humidity", "rh", "vpd", "습도")):
        focused_controls.append("rh_target")
    if any(keyword in transcript for keyword in ("screen", "차광", "커튼")):
        focused_controls.append("screen_close")

    if not focused_controls:
        focused_controls = list(_MODEL_RUNTIME_CONTROL_HINTS["chat"])

    ordered: list[str] = []
    for control in focused_controls:
        if control not in ordered:
            ordered.append(control)
    return ordered


def _latest_user_transcript(messages: Optional[list[dict[str, str]]]) -> str:
    for message in reversed(messages or []):
        if isinstance(message, dict) and str(message.get("role") or "user") == "user":
            return str(message.get("content") or "").lower()
    return ""


def _classify_chat_runtime_mode(messages: Optional[list[dict[str, str]]]) -> str:
    latest_user_turn = _latest_user_transcript(messages)
    if not latest_user_turn:
        return "recommendation"

    asks_current_state = any(term in latest_user_turn for term in _CHAT_CURRENT_STATE_TERMS)
    asks_control_change = any(term in latest_user_turn for term in _CHAT_WHAT_IF_TERMS)
    mentions_numeric_delta = bool(
        re.search(r"([+-]?\d+(?:\.\d+)?)\s*(?:ppm|피피엠|℃|°c|c|도|%|퍼센트|pct)", latest_user_turn)
    )
    mentions_control = any(
        term in latest_user_turn
        for term in (
            "co2",
            "이산화탄소",
            "ppm",
            "온도",
            "temperature",
            "temp",
            "습도",
            "humidity",
            "rh",
            "vpd",
            "screen",
            "스크린",
            "차광",
        )
    )

    if asks_current_state and not (asks_control_change or (mentions_control and mentions_numeric_delta)):
        return "current_state"
    return "recommendation"


def _signed_delta_from_text(value: float, text: str) -> float:
    if value < 0:
        return value
    decrease_terms = ("내리", "낮추", "줄이", "감소", "decrease", "reduce", "lower")
    increase_terms = ("올리", "높", "상향", "증가", "increase", "raise", "up")
    if any(term in text for term in decrease_terms):
        return -abs(value)
    if any(term in text for term in increase_terms):
        return abs(value)
    return value


def _extract_requested_runtime_delta(
    *,
    messages: Optional[list[dict[str, str]]],
    control_name: str,
) -> float | None:
    transcript = _latest_user_transcript(messages)
    if not transcript:
        return None

    patterns: tuple[str, ...]
    if control_name == "co2_setpoint_day":
        patterns = (
            r"([+-]?\d+(?:\.\d+)?)\s*(?:ppm|피피엠)",
            r"(?:co2|이산화탄소)[^\d+-]{0,18}([+-]?\d+(?:\.\d+)?)",
        )
    elif control_name in {"temperature_day", "temperature_night"}:
        patterns = (
            r"([+-]?\d+(?:\.\d+)?)\s*(?:℃|°c|c|도)",
            r"(?:온도|temperature|temp)[^\d+-]{0,18}([+-]?\d+(?:\.\d+)?)",
        )
    elif control_name in {"rh_target", "screen_close"}:
        patterns = (
            r"([+-]?\d+(?:\.\d+)?)\s*(?:%|퍼센트|pct)",
            r"(?:습도|rh|screen|스크린)[^\d+-]{0,18}([+-]?\d+(?:\.\d+)?)",
        )
    else:
        return None

    for pattern in patterns:
        match = re.search(pattern, transcript, flags=re.IGNORECASE)
        if not match:
            continue
        numeric = _coerce_float(match.group(1))
        if numeric is None:
            continue
        return _signed_delta_from_text(numeric, transcript)

    return None


def _format_signed_delta(value: Any, digits: int = 3) -> str:
    numeric = _coerce_float(value)
    if numeric is None:
        return "추가 데이터 필요"
    return f"{numeric:+.{digits}f}"


def _format_user_delta(
    value: Any,
    unit: Any,
    *,
    language: str = "ko",
) -> str:
    numeric = _coerce_float(value)
    if numeric is None:
        return "추가 데이터 필요" if not language.lower().startswith("en") else "missing data"
    unit_text = str(unit or "")
    if unit_text == "C":
        unit_text = "°C"
    if unit_text == "pct":
        unit_text = "%"
    digits = 0 if abs(numeric) >= 10 or float(numeric).is_integer() else 1
    return f"{numeric:+.{digits}f}{unit_text}"


def _user_visible_limiting_factor(value: Any, *, language: str = "ko") -> str:
    normalized = str(value or "").strip().casefold()
    if language.lower().startswith("en"):
        return {
            "rubisco": "CO2 or stomatal response",
            "electron_transport": "light reaction",
        }.get(normalized, str(value or "-"))
    return {
        "rubisco": "CO2·기공 반응 제한",
        "electron_transport": "광 반응 제한",
    }.get(normalized, str(value or "-"))


def _user_visible_control_label(
    control_name: Any,
    fallback: Any,
    *,
    language: str = "ko",
) -> str:
    control_key = str(control_name or "")
    if language.lower().startswith("en"):
        return _MODEL_RUNTIME_CONTROL_LABELS_EN.get(control_key, str(fallback or control_key or "control"))
    return _MODEL_RUNTIME_CONTROL_LABELS.get(control_key, str(fallback or control_key or "조정 항목"))


def _build_runtime_answer_focus(
    *,
    messages: Optional[list[dict[str, str]]],
    recommendation_families: list[dict[str, Any]],
    language: str = "ko",
) -> dict[str, Any] | None:
    if not recommendation_families:
        return None

    requested_candidates: list[tuple[dict[str, Any], float | None]] = []
    for family in recommendation_families:
        requested_delta = _extract_requested_runtime_delta(
            messages=messages,
            control_name=str(family.get("control") or ""),
        )
        if requested_delta is not None:
            requested_candidates.append((family, requested_delta))

    if not requested_candidates:
        return None

    for family, requested_delta in requested_candidates:
        steps = [
            step
            for step in family.get("steps", [])
            if isinstance(step, dict)
        ]
        if not steps:
            continue

        if requested_delta is None:
            step = family.get("recommended_step")
        else:
            step = min(
                steps,
                key=lambda item: abs(float(item.get("applied_delta", 0.0)) - requested_delta),
            )
        if not isinstance(step, dict):
            continue

        control_name = str(family.get("control") or "")
        label = _user_visible_control_label(
            control_name,
            family.get("label") or family.get("control"),
            language=language,
        )
        step_label = str(step.get("step_label") or "")
        requested_label = _format_user_delta(
            requested_delta,
            family.get("unit"),
            language=language,
        )
        matched_label = _format_user_delta(
            step.get("applied_delta"),
            family.get("unit"),
            language=language,
        )
        is_limited_delta = (
            requested_delta is not None
            and _coerce_float(step.get("applied_delta")) is not None
            and abs(float(requested_delta) - float(step.get("applied_delta"))) > 1e-6
        )
        effects = {
            "yield_delta_24h": step.get("yield_delta_24h"),
            "yield_delta_72h": step.get("yield_delta_72h"),
            "yield_delta_7d": step.get("yield_delta_7d"),
            "yield_delta_14d": step.get("yield_delta_14d"),
            "canopy_delta_72h": step.get("canopy_delta_72h"),
            "energy_delta": step.get("energy_delta"),
            "energy_delta_7d": step.get("energy_delta_7d"),
            "source_sink_balance_delta": step.get("source_sink_balance_delta"),
            "rtr_delta_72h": step.get("rtr_delta_72h"),
            "humidity_penalty_delta": step.get("humidity_penalty_delta"),
            "disease_penalty_delta": step.get("disease_penalty_delta"),
        }
        if language.lower().startswith("en"):
            if is_limited_delta:
                summary = (
                    f"The requested {label} {requested_label} is outside the safe calculation range, "
                    f"so the model compared {matched_label} instead: "
                )
            else:
                summary = f"{label} {matched_label} was compared by the crop model: "
            summary += (
                f"14d yield {_format_signed_delta(effects['yield_delta_14d'])}, "
                f"72h canopy assimilation {_format_signed_delta(effects['canopy_delta_72h'])}, "
                f"supply/demand balance {_format_signed_delta(effects['source_sink_balance_delta'])}, "
                f"energy {_format_signed_delta(effects['energy_delta'])}."
            )
        else:
            if is_limited_delta:
                summary = (
                    f"요청한 {label} {requested_label} 조정은 안전 계산 범위를 넘어 "
                    f"{matched_label}까지만 제한해 비교했습니다. "
                )
            else:
                summary = f"{label} {matched_label} 조정은 작물 모델에서 비교했습니다. "
            summary += (
                f"14일 예상 수량 {_format_signed_delta(effects['yield_delta_14d'])}, "
                f"72시간 군락 동화량 {_format_signed_delta(effects['canopy_delta_72h'])}, "
                f"공급/수요 균형 {_format_signed_delta(effects['source_sink_balance_delta'])}, "
                f"에너지 비용 {_format_signed_delta(effects['energy_delta'])}입니다."
            )
        return {
            "kind": "model_what_if",
            "computed_by": "process_model_bounded_scenario",
            "control": family.get("control"),
            "label": label,
            "requested_delta": requested_delta,
            "matched_delta": step.get("applied_delta"),
            "is_limited_delta": is_limited_delta,
            "unit": family.get("unit"),
            "step_label": step_label,
            "action": f"{label} {step_label} 조정",
            "summary": summary,
            "effects": effects,
            "confidence": step.get("confidence"),
            "risk_flags": step.get("risk_flags", []),
            "violated_constraints": step.get("violated_constraints", []),
            "operator_summary": family.get("operator_summary", {}),
            "precision_mode": family.get("precision_mode"),
            "matched_user_request": requested_delta is not None,
        }

    return None


def _build_unavailable_model_runtime_payload(
    *,
    tab_name: str,
    reason: str,
    observed_signal_score: float = 0.0,
    dashboard_missing_fields: Optional[list[str]] = None,
    inferred_fields: Optional[list[str]] = None,
    partial_state_snapshot: Optional[dict[str, Any]] = None,
) -> dict[str, Any]:
    return {
        "status": "monitoring-first",
        "summary": reason,
        "state_snapshot": partial_state_snapshot or {},
        "scenario": {
            "baseline_outputs": [],
            "options": [],
            "recommended": None,
        },
        "sensitivity": {
            "target": None,
            "analysis_horizon_hours": None,
            "confidence": 0.0,
            "top_levers": [],
        },
        "constraint_checks": {
            "status": "insufficient_context",
            "violated_constraints": [],
            "penalties": {},
        },
        "recommendation_families": [],
        "best_actions": [],
        "control_precision_matrix": {},
        "operator_view": {
            "now": [],
            "today": [],
            "this_week": [],
        },
        "tradeoff_summary": {
            "yield_vs_energy": [],
            "yield_vs_disease": [],
            "yield_vs_source_sink": [],
        },
        "recommendations": [],
        "provenance": {
            "source": "dashboard_synthesized_snapshot",
            "tab_name": tab_name,
            "observed_signal_score": round(observed_signal_score, 2),
            "dashboard_missing_fields": list(dashboard_missing_fields or []),
            "inferred_fields": list(inferred_fields or []),
        },
    }


def _parse_runtime_datetime(value: Any) -> datetime:
    if isinstance(value, datetime):
        return value if value.tzinfo else value.replace(tzinfo=timezone.utc)
    if isinstance(value, str):
        try:
            parsed = datetime.fromisoformat(value)
            return parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)
        except ValueError:
            return datetime.now(timezone.utc)
    return datetime.now(timezone.utc)


def _clone_compare_adapter_from_raw_state(crop: str, raw_state: dict[str, Any]):
    if crop == "tomato":
        from ..adapters.tomato import TomatoAdapter

        adapter = TomatoAdapter()
    else:
        from ..adapters.cucumber import CucumberAdapter

        adapter = CucumberAdapter()

    adapter.load_state(deepcopy(raw_state))
    return adapter


def _build_compare_snapshot_record(
    *,
    crop: str,
    greenhouse_id: str,
    adapter: Any,
    snapshot_time: datetime,
    snapshot_id: str,
    source: str,
    metadata: dict[str, Any] | None = None,
) -> dict[str, Any]:
    if crop == "tomato":
        from .crop_models.tomato_growth_model import build_tomato_snapshot

        normalized_snapshot = build_tomato_snapshot(
            adapter,
            greenhouse_id=greenhouse_id,
            snapshot_time=snapshot_time,
        )
    else:
        from .crop_models.cucumber_growth_model import build_cucumber_snapshot

        normalized_snapshot = build_cucumber_snapshot(
            adapter,
            greenhouse_id=greenhouse_id,
            snapshot_time=snapshot_time,
        )

    return {
        "snapshot_id": snapshot_id,
        "greenhouse_id": greenhouse_id,
        "crop": crop,
        "snapshot_time": snapshot_time.isoformat(),
        "source": source,
        "adapter_name": getattr(adapter, "name", crop),
        "adapter_version": getattr(adapter, "version", "1.0.0"),
        "normalized_snapshot": normalized_snapshot,
        "raw_adapter_state": adapter.dump_state(),
        "metadata": metadata or {},
    }


def _describe_logged_work_event(event: dict[str, Any]) -> str:
    payload = _coerce_dict(event.get("payload"))
    event_type = str(event.get("event_type") or "")
    if event_type == "leaf_removal":
        removed = _safe_int(payload.get("leaves_removed_count"))
        target_leaf_count = _safe_int(payload.get("target_leaf_count"), default=-1)
        if removed > 0:
            return f"하위엽 {removed}매 제거"
        if target_leaf_count > 0:
            return f"목표 엽수 {target_leaf_count}매"
        return "적엽 기록"
    if event_type == "fruit_thinning":
        removed = _safe_int(payload.get("fruits_removed_count"))
        target_fruits = _safe_int(payload.get("target_fruits_per_truss"), default=-1)
        if removed > 0:
            return f"{removed}과 감과"
        if target_fruits > 0:
            return f"화방당 {target_fruits}과 목표"
        return "감과 기록"
    return event_type or "work_event"


def _summarize_work_event_history(events: list[dict[str, Any]]) -> list[dict[str, Any]]:
    return [
        {
            "event_time": event.get("event_time"),
            "event_type": event.get("event_type"),
            "action": _describe_logged_work_event(event),
            "operator": event.get("operator"),
            "reason_code": event.get("reason_code"),
            "confidence": event.get("confidence"),
        }
        for event in events
    ]


def _build_unavailable_work_event_compare_payload(
    *,
    reason: str,
    history: list[dict[str, Any]],
) -> dict[str, Any]:
    return {
        "status": "history-unavailable",
        "summary": reason,
        "history": history,
        "current_state": {},
        "options": [],
        "recommended_action": None,
        "confidence": 0.0,
    }


def _build_dashboard_runtime_snapshot(
    *,
    crop: str,
    dashboard: dict[str, Any],
    tab_name: str,
) -> tuple[dict[str, Any], float, list[str], list[str]]:
    current_data = _get_dashboard_context(dashboard, "currentData", "data") or {}
    metrics = _get_dashboard_context(dashboard, "metrics") or {}
    forecast = _get_dashboard_context(dashboard, "forecast") or {}
    weather = _get_dashboard_context(dashboard, "weather") or {}
    growth_metrics = metrics.get("growth", {}) if isinstance(metrics, dict) else {}
    yield_metrics = metrics.get("yield", {}) if isinstance(metrics, dict) else {}
    weather_current = weather.get("current", {}) if isinstance(weather, dict) else {}

    inferred_fields: list[str] = []

    temperature_c = _coerce_float(current_data.get("temperature"))
    if temperature_c is None:
        temperature_c = _coerce_float(weather_current.get("temperature_c"))
        if temperature_c is not None:
            inferred_fields.append("inside_temperature")

    canopy_temperature_c = _coerce_float(current_data.get("canopyTemp"))
    if canopy_temperature_c is None:
        canopy_temperature_c = temperature_c
        if canopy_temperature_c is not None:
            inferred_fields.append("canopy_temperature")

    humidity_pct = _coerce_float(current_data.get("humidity"))
    vpd_kpa = _coerce_float(current_data.get("vpd"))
    if humidity_pct is None:
        humidity_pct = _coerce_float(weather_current.get("relative_humidity_pct"))
        if humidity_pct is not None:
            inferred_fields.append("inside_humidity")
    rh_fraction = humidity_pct / 100.0 if humidity_pct is not None else None

    co2_ppm = _coerce_float(current_data.get("co2"))
    light_umol = _coerce_float(current_data.get("light"))
    photosynthesis_umol = _coerce_float(current_data.get("photosynthesis"))
    transpiration_mm_h = _coerce_float(current_data.get("transpiration"))
    biomass_g_m2 = _coerce_float(growth_metrics.get("biomass"))
    growth_rate_g_m2_d = _coerce_float(growth_metrics.get("growthRate"))
    lai = _coerce_float(growth_metrics.get("lai"))
    predicted_weekly_yield_kg = _coerce_float(yield_metrics.get("predictedWeekly"))
    harvestable_fruits = _coerce_float(yield_metrics.get("harvestableFruits"))
    active_trusses = _coerce_float(growth_metrics.get("activeTrusses"))
    node_count = _coerce_float(growth_metrics.get("nodeCount"))
    total_harvest_kg = _coerce_float(forecast.get("total_harvest_kg"))

    observed_checks = (
        temperature_c is not None,
        canopy_temperature_c is not None,
        humidity_pct is not None or vpd_kpa is not None,
        co2_ppm is not None,
        light_umol is not None,
        photosynthesis_umol is not None,
        _context_has_value(growth_metrics),
        any(value is not None for value in (predicted_weekly_yield_kg, harvestable_fruits, active_trusses, node_count)),
    )
    observed_signal_score = sum(1 for item in observed_checks if item) / len(observed_checks)

    if lai is None:
        if crop == "tomato" and active_trusses is not None:
            lai = _clamp(1.6 + (0.18 * active_trusses), 1.2, 4.5)
        elif crop == "cucumber" and node_count is not None:
            lai = _clamp(1.0 + (0.06 * node_count), 1.0, 3.8)
        elif biomass_g_m2 is not None:
            lai = _clamp(1.2 + (biomass_g_m2 / 2400.0), 1.0, 4.2)
        if lai is not None:
            inferred_fields.append("lai")

    if photosynthesis_umol is None:
        if light_umol is not None:
            photosynthesis_umol = max(0.0, (light_umol * 0.022) + ((co2_ppm or 500.0) / 180.0) - 2.5)
        elif growth_rate_g_m2_d is not None:
            photosynthesis_umol = max(0.0, 4.2 + (0.18 * growth_rate_g_m2_d))
        if photosynthesis_umol is not None:
            inferred_fields.append("photosynthesis")

    if transpiration_mm_h is None:
        if vpd_kpa is not None:
            transpiration_mm_h = max(0.03, 0.08 + (0.05 * vpd_kpa))
        elif humidity_pct is not None:
            transpiration_mm_h = max(0.03, 0.14 - (0.0008 * humidity_pct))
        if transpiration_mm_h is not None:
            inferred_fields.append("transpiration")

    if crop == "tomato":
        fruit_load = harvestable_fruits if harvestable_fruits is not None else (
            active_trusses * 4.0 if active_trusses is not None else None
        )
        if fruit_load is None and predicted_weekly_yield_kg is not None:
            fruit_load = max(8.0, predicted_weekly_yield_kg * 1.4)
        sink_demand = (
            (fruit_load or 0.0) * 0.18
            + (active_trusses or 0.0) * 0.32
            + (predicted_weekly_yield_kg or 0.0) * 0.24
        )
    else:
        fruit_load = harvestable_fruits if harvestable_fruits is not None else (
            node_count * 0.55 if node_count is not None else None
        )
        if fruit_load is None and predicted_weekly_yield_kg is not None:
            fruit_load = max(8.0, predicted_weekly_yield_kg * 1.9)
        sink_demand = (
            (fruit_load or 0.0) * 0.22
            + (node_count or 0.0) * 0.12
            + (predicted_weekly_yield_kg or 0.0) * 0.2
        )

    if fruit_load is None:
        fruit_load = 10.0 if crop == "tomato" else 12.0
        inferred_fields.append("fruit_load")

    fruit_dry_matter_g_m2 = (
        (biomass_g_m2 * 0.22)
        if biomass_g_m2 is not None
        else (fruit_load * 6.8)
    )
    if biomass_g_m2 is None:
        inferred_fields.append("fruit_dry_matter")

    harvested_fruit_dry_matter_g_m2 = (
        (total_harvest_kg * 80.0)
        if total_harvest_kg is not None
        else ((predicted_weekly_yield_kg or 0.0) * 20.0)
    )
    if total_harvest_kg is None:
        inferred_fields.append("harvested_fruit_dry_matter")

    canopy_assimilation = max(0.0, photosynthesis_umol or 0.0)
    source_capacity = max(canopy_assimilation * 1.24, canopy_assimilation)
    layer_activity = _normalize_leaf_activity_profile(
        lai=max(lai or 1.2, 0.1),
        humidity_pct=humidity_pct,
        vpd_kpa=vpd_kpa,
    )
    limiting_factor = _infer_runtime_limiting_factor(
        co2_ppm=co2_ppm,
        light_umol=light_umol,
        vpd_kpa=vpd_kpa,
    )
    dashboard_missing_fields = sorted(
        set(
            _collect_environment_missing_data_flags(dashboard)
            + _collect_physiology_missing_data_flags(dashboard)
            + _collect_work_missing_data_flags(dashboard)
        )
    )
    snapshot_record = {
        "snapshot_id": f"dashboard-{crop}-{tab_name}",
        "greenhouse_id": crop,
        "crop": crop,
        "normalized_snapshot": {
            "crop": crop,
            "greenhouse_id": crop,
            "state": {
                "lai": round(max(lai or 1.2, 0.1), 6),
                "fruit_load": round(max(fruit_load, 0.0), 6),
                "source_capacity": round(source_capacity, 6),
                "sink_demand": round(max(sink_demand, 0.0), 6),
                "fruit_dry_matter_g_m2": round(max(fruit_dry_matter_g_m2, 0.0), 6),
                "harvested_fruit_dry_matter_g_m2": round(max(harvested_fruit_dry_matter_g_m2, 0.0), 6),
                "upper_leaf_activity": layer_activity["upper"],
                "middle_leaf_activity": layer_activity["middle"],
                "bottom_leaf_activity": layer_activity["bottom"],
                "limiting_factor": limiting_factor,
            },
            "gas_exchange": {
                "canopy_net_assimilation_umol_m2_s": round(canopy_assimilation, 6),
                "canopy_gross_assimilation_umol_m2_s": round(source_capacity, 6),
                "canopy_transpiration_proxy": round(max((transpiration_mm_h or 0.0) * 24.0, 0.0), 6),
                "limiting_factor": limiting_factor,
            },
            "live_observation": {
                "canopy_temperature_c": round(canopy_temperature_c or temperature_c or 24.0, 6),
                "transpiration_g_m2": round(max((transpiration_mm_h or 0.0) * 1000.0, 0.0), 6),
            },
        },
        "raw_adapter_state": {
            "RH": round(rh_fraction if rh_fraction is not None else 0.72, 6),
            "u_CO2": round(co2_ppm or 700.0, 6),
            "T_c": round((canopy_temperature_c or temperature_c or 24.0) + 273.15, 6),
        },
        "metadata": {
            "source": "dashboard_synthesized_snapshot",
            "tab_name": tab_name,
            "observed_signal_score": round(observed_signal_score, 2),
            "inferred_fields": sorted(set(inferred_fields)),
            "dashboard_missing_fields": dashboard_missing_fields,
        },
    }
    return snapshot_record, round(observed_signal_score, 2), dashboard_missing_fields, sorted(set(inferred_fields))


def _scenario_row_by_horizon(
    rows: list[dict[str, Any]],
    horizon_hours: int,
) -> dict[str, Any]:
    for row in rows:
        if int(row.get("horizon_hours", -1)) == int(horizon_hours):
            return row
    return {}


def _top_runtime_levers(
    sensitivity_payload: dict[str, Any],
) -> list[dict[str, Any]]:
    valid_rows = [
        row
        for row in sensitivity_payload.get("sensitivities", [])
        if row.get("valid")
    ]
    ranked = sorted(
        valid_rows,
        key=lambda row: (
            abs(float(row.get("elasticity", 0.0))),
            abs(float(row.get("derivative", 0.0))),
        ),
        reverse=True,
    )
    return ranked[:3]


def _score_runtime_option(
    *,
    baseline_72h: dict[str, Any],
    baseline_168h: dict[str, Any],
    baseline_336h: dict[str, Any],
    scenario_72h: dict[str, Any],
    scenario_168h: dict[str, Any],
    scenario_336h: dict[str, Any],
    penalties: dict[str, Any],
    confidence: float,
) -> float:
    base_yield_scale = max(abs(float(baseline_336h.get("yield_pred", 0.0))), 1.0)
    base_canopy_scale = max(abs(float(baseline_72h.get("canopy_A_pred", 0.0))), 1.0)
    base_energy_scale = max(abs(float(baseline_168h.get("energy_cost_pred", 0.0))), 1.0)

    normalized_yield_gain = (
        float(scenario_336h.get("yield_delta_vs_baseline", 0.0)) / base_yield_scale
    )
    normalized_photosynthesis_gain = (
        (
            float(scenario_72h.get("canopy_A_pred", 0.0))
            - float(baseline_72h.get("canopy_A_pred", 0.0))
        )
        / base_canopy_scale
    )
    normalized_balance_recovery = _clamp(
        float(scenario_72h.get("source_sink_balance_delta", 0.0)) / 0.25,
        -1.0,
        1.0,
    )
    energy_cost_penalty = max(
        0.0,
        float(scenario_168h.get("energy_delta_vs_baseline", 0.0)) / base_energy_scale,
    )
    disease_risk_penalty = float(penalties.get("disease_risk_penalty", 0.0))
    stress_penalty = float(penalties.get("stress_penalty", 0.0))
    confidence_penalty = max(0.0, 1.0 - confidence) + float(
        penalties.get("confidence_penalty", 0.0)
    )

    return round(
        (0.38 * normalized_yield_gain)
        + (0.2 * normalized_photosynthesis_gain)
        + (0.16 * normalized_balance_recovery)
        - (0.12 * energy_cost_penalty)
        - (0.07 * disease_risk_penalty)
        - (0.05 * stress_penalty)
        - (0.02 * confidence_penalty),
        6,
    )


def _build_model_runtime_payload(
    *,
    crop: str,
    dashboard: dict[str, Any],
    tab_name: str,
    messages: Optional[list[dict[str, str]]] = None,
    language: str = "ko",
) -> dict[str, Any]:
    snapshot_record, observed_signal_score, dashboard_missing_fields, inferred_fields = (
        _build_dashboard_runtime_snapshot(
            crop=crop,
            dashboard=dashboard,
            tab_name=tab_name,
        )
    )
    partial_state_snapshot = {
        "crop": crop,
        "observed_signal_score": observed_signal_score,
        "dashboard_missing_fields": dashboard_missing_fields,
        "inferred_fields": inferred_fields,
    }
    if observed_signal_score < 0.5:
        return _build_unavailable_model_runtime_payload(
            tab_name=tab_name,
            reason="실시간 생리·작업 신호가 아직 부족해 예측 모델 분석을 모니터링 우선 상태로 유지합니다.",
            observed_signal_score=observed_signal_score,
            dashboard_missing_fields=dashboard_missing_fields,
            inferred_fields=inferred_fields,
            partial_state_snapshot=partial_state_snapshot,
        )

    metrics_payload = _get_dashboard_context(dashboard, "metrics") or {}
    growth_metrics = metrics_payload.get("growth", {}) if isinstance(metrics_payload, dict) else {}
    node_count = _coerce_float(growth_metrics.get("nodeCount"))
    active_trusses = _coerce_float(growth_metrics.get("activeTrusses"))
    chat_runtime_mode = (
        _classify_chat_runtime_mode(messages)
        if tab_name == "chat"
        else "recommendation"
    )
    current_state_mode = chat_runtime_mode == "current_state"
    derivative_target = (
        "canopy_A_72h"
        if tab_name == "physiology" or current_state_mode
        else "predicted_yield_14d"
    )
    selected_controls = (
        []
        if current_state_mode
        else _select_runtime_controls(tab_name=tab_name, messages=messages)
    )
    try:
        baseline_payload = run_bounded_scenario(
            snapshot_record,
            controls={},
            horizons_hours=list(_MODEL_RUNTIME_HORIZONS_HOURS),
        )
        if current_state_mode:
            sensitivity_payload = {
                "derivative_target": derivative_target,
                "horizon_hours": 72,
                "confidence": baseline_payload.get("confidence"),
                "sensitivities": [],
            }
        else:
            sensitivity_payload = compute_local_sensitivities(
                snapshot_record,
                derivative_target=derivative_target,
                controls=selected_controls,
            )
    except Exception:
        return _build_unavailable_model_runtime_payload(
            tab_name=tab_name,
            reason="현재 대시보드 문맥에서 안정적인 예측 시나리오를 만들지 못했습니다.",
            observed_signal_score=observed_signal_score,
            dashboard_missing_fields=dashboard_missing_fields,
            inferred_fields=inferred_fields,
            partial_state_snapshot=partial_state_snapshot,
        )

    baseline_72h = _scenario_row_by_horizon(baseline_payload.get("baseline_outputs", []), 72)
    baseline_168h = _scenario_row_by_horizon(baseline_payload.get("baseline_outputs", []), 168)
    baseline_336h = _scenario_row_by_horizon(baseline_payload.get("baseline_outputs", []), 336)
    baseline_24h = _scenario_row_by_horizon(baseline_payload.get("baseline_outputs", []), 24)
    state = snapshot_record["normalized_snapshot"]["state"]
    gas_exchange = snapshot_record["normalized_snapshot"]["gas_exchange"]
    live_observation = snapshot_record["normalized_snapshot"]["live_observation"]

    if current_state_mode:
        state_snapshot = {
            "crop": crop,
            "lai": state.get("lai"),
            "fruit_load": state.get("fruit_load"),
            "source_capacity": state.get("source_capacity"),
            "sink_demand": state.get("sink_demand"),
            "source_sink_balance": baseline_payload.get("runtime_inputs", {}).get("source_sink_balance"),
            "limiting_factor": baseline_payload.get("runtime_inputs", {}).get("limiting_factor"),
            "canopy_temperature_c": live_observation.get("canopy_temperature_c"),
            "canopy_net_assimilation_umol_m2_s": gas_exchange.get("canopy_net_assimilation_umol_m2_s"),
            "upper_leaf_activity": state.get("upper_leaf_activity"),
            "middle_leaf_activity": state.get("middle_leaf_activity"),
            "bottom_leaf_activity": state.get("bottom_leaf_activity"),
            "node_count": int(node_count) if node_count is not None else None,
            "active_trusses": int(active_trusses) if active_trusses is not None else None,
            "observed_signal_score": observed_signal_score,
            "dashboard_missing_fields": dashboard_missing_fields,
            "inferred_fields": inferred_fields,
        }
        return {
            "status": "ready",
            "runtime_mode": "current_state",
            "summary": "현재 생육 상태를 잎면적, 공급/수요 균형, 군락 동화량, 제한요인 중심으로 진단합니다. 제어 변경 효과는 사용자가 조정 범위를 물을 때만 계산합니다.",
            "state_snapshot": state_snapshot,
            "growth_diagnosis": {
                "focus": "current_growth_status",
                "signals": [
                    {
                        "key": "node_count",
                        "label": "마디수",
                        "value": state_snapshot.get("node_count"),
                    },
                    {
                        "key": "lai",
                        "label": "잎면적",
                        "value": state_snapshot.get("lai"),
                    },
                    {
                        "key": "source_sink_balance",
                        "label": "공급/수요 균형",
                        "value": state_snapshot.get("source_sink_balance"),
                    },
                    {
                        "key": "canopy_net_assimilation",
                        "label": "군락 동화량",
                        "value": state_snapshot.get("canopy_net_assimilation_umol_m2_s"),
                    },
                    {
                        "key": "limiting_factor",
                        "label": "제한 요인",
                        "value": state_snapshot.get("limiting_factor"),
                    },
                ],
            },
            "scenario": {
                "baseline_outputs": baseline_payload.get("baseline_outputs", []),
                "options": [],
                "recommended": None,
                "confidence": baseline_payload.get("confidence"),
                "baseline_canopy_A_24h": baseline_24h.get("canopy_A_pred"),
            },
            "sensitivity": {
                "target": sensitivity_payload.get("derivative_target"),
                "analysis_horizon_hours": sensitivity_payload.get("horizon_hours"),
                "confidence": sensitivity_payload.get("confidence"),
                "top_levers": [],
            },
            "constraint_checks": {
                "status": "monitoring-first",
                "violated_constraints": [],
                "penalties": {},
            },
            "recommendation_families": [],
            "best_actions": [],
            "control_precision_matrix": {},
            "operator_view": {"now": [], "today": [], "this_week": []},
            "tradeoff_summary": {
                "yield_vs_energy": [],
                "yield_vs_disease": [],
                "yield_vs_source_sink": [],
            },
            "answer_focus": None,
            "recommendations": [],
            "provenance": {
                "source": "dashboard_synthesized_snapshot",
                "tab_name": tab_name,
                "runtime_mode": "current_state",
                "selected_controls": [],
                "derivative_target": derivative_target,
                "horizons_hours": list(_MODEL_RUNTIME_HORIZONS_HOURS),
                "dashboard_missing_fields": dashboard_missing_fields,
                "inferred_fields": inferred_fields,
                "recommendations_surface": "suppressed_for_current_state",
            },
        }

    sensitivity_rows = {
        str(row.get("control")): row
        for row in sensitivity_payload.get("sensitivities", [])
    }

    def _display_unit(spec: Any) -> str:
        return "%" if spec.unit == "pct" else str(spec.unit)

    def _format_magnitude(value: float, precision: int) -> str:
        formatted = f"{abs(float(value)):.{precision}f}"
        if "." in formatted:
            formatted = formatted.rstrip("0").rstrip(".")
        return formatted

    def _step_label(spec: Any, delta_value: float) -> str:
        sign = "+" if float(delta_value) > 0 else "-"
        return f"{sign}{_format_magnitude(delta_value, int(spec.display_precision))}{_display_unit(spec)}"

    def _action_label(spec: Any, delta_value: float) -> str:
        direction = "올리기" if float(delta_value) > 0 else "내리기"
        return f"{spec.ui_label} {_format_magnitude(delta_value, int(spec.display_precision))}{_display_unit(spec)} {direction}"

    def _current_value(control_name: str) -> float | None:
        normalized_snapshot = _coerce_dict(snapshot_record.get("normalized_snapshot"))
        live_snapshot = _coerce_dict(normalized_snapshot.get("live_observation"))
        raw_adapter_state = _coerce_dict(snapshot_record.get("raw_adapter_state"))
        if control_name == "co2_setpoint_day":
            return _coerce_float(raw_adapter_state.get("u_CO2"))
        if control_name in {"temperature_day", "temperature_night"}:
            return _coerce_float(live_snapshot.get("canopy_temperature_c"))
        if control_name == "rh_target":
            rh_value = _coerce_float(raw_adapter_state.get("RH"))
            if rh_value is None:
                return None
            return round(rh_value * 100.0, 6) if rh_value <= 1.0 else round(rh_value, 6)
        if control_name == "screen_close":
            return 0.0
        return None

    def _has_high_violation(violations: list[dict[str, Any]]) -> bool:
        return any(str(item.get("severity") or "").lower() == "high" for item in violations)

    def _score_weights() -> dict[str, float]:
        if tab_name == "environment":
            return {"objective": 0.26, "yield": 0.2, "source": 0.14, "energy": 0.16, "disease": 0.12, "humidity": 0.07, "confidence": 0.05}
        if tab_name == "physiology":
            return {"objective": 0.34, "yield": 0.14, "source": 0.2, "energy": 0.09, "disease": 0.1, "humidity": 0.07, "confidence": 0.06}
        if tab_name == "harvest_market":
            return {"objective": 0.16, "yield": 0.4, "source": 0.12, "energy": 0.12, "disease": 0.1, "humidity": 0.05, "confidence": 0.05}
        return {"objective": 0.24, "yield": 0.28, "source": 0.14, "energy": 0.12, "disease": 0.1, "humidity": 0.06, "confidence": 0.04}

    def _build_step(spec: Any, step_meta: dict[str, Any], comparison: dict[str, Any], sensitivity_row: dict[str, Any]) -> dict[str, Any]:
        outputs = comparison.get("outputs_by_horizon", {})
        scenario_24h = outputs.get(24, {})
        scenario_72h = outputs.get(72, {})
        scenario_168h = outputs.get(168, {})
        scenario_336h = outputs.get(336, {})
        penalties = _coerce_dict(comparison.get("penalties"))
        confidence = round(float(comparison.get("confidence", 0.0)), 6)
        yield_delta_24h = round(float(scenario_24h.get("yield_delta_vs_baseline", 0.0)), 6)
        yield_delta_72h = round(float(scenario_72h.get("yield_delta_vs_baseline", 0.0)), 6)
        yield_delta_7d = round(float(scenario_168h.get("yield_delta_vs_baseline", 0.0)), 6)
        yield_delta_14d = round(float(scenario_336h.get("yield_delta_vs_baseline", 0.0)), 6)
        canopy_delta_72h = round(float(scenario_72h.get("canopy_A_pred", 0.0)) - float(baseline_72h.get("canopy_A_pred", 0.0)), 6)
        energy_delta_72h = round(float(scenario_72h.get("energy_delta_vs_baseline", 0.0)), 6)
        energy_delta_7d = round(float(scenario_168h.get("energy_delta_vs_baseline", 0.0)), 6)
        humidity_penalty_delta = round(float(penalties.get("humidity_penalty", 0.0)), 6)
        disease_penalty_delta = round(float(penalties.get("disease_risk_penalty", 0.0)), 6)
        source_sink_balance_delta = round(float(scenario_72h.get("source_sink_balance_delta", 0.0)), 6)
        rtr_delta_72h = round(float(scenario_72h.get("rtr_pred", 0.0)) - float(baseline_72h.get("rtr_pred", 0.0)), 6)
        objective_delta = round(
            (0.6 * (canopy_delta_72h / max(abs(float(baseline_72h.get("canopy_A_pred", 0.0))), 1.0)))
            + (0.4 * (yield_delta_72h / max(abs(float(baseline_72h.get("yield_pred", 0.0))), 1.0))),
            6,
        )
        normalized_yield_14d = round(yield_delta_14d / max(abs(float(baseline_336h.get("yield_pred", 0.0))), 1.0), 6)
        normalized_balance = round(_clamp(source_sink_balance_delta / 0.25, -1.5, 1.5), 6)
        normalized_energy = max(0.0, round(energy_delta_72h / max(abs(float(baseline_72h.get("energy_cost_pred", 0.0))), 1.0), 6))
        weights = _score_weights()
        confidence_penalty = max(0.0, 1.0 - confidence) + float(penalties.get("confidence_penalty", 0.0))
        scenario_score = round(
            (weights["objective"] * objective_delta)
            + (weights["yield"] * normalized_yield_14d)
            + (weights["source"] * normalized_balance)
            - (weights["energy"] * normalized_energy)
            - (weights["disease"] * disease_penalty_delta)
            - (weights["humidity"] * humidity_penalty_delta)
            - (weights["confidence"] * confidence_penalty),
            6,
        )
        violations = list(comparison.get("violated_constraints", []))
        risk_flags: list[str] = []
        if _has_high_violation(violations):
            risk_flags.append("제약 초과")
        elif violations:
            risk_flags.append("제약 경고")
        if disease_penalty_delta >= 0.18:
            risk_flags.append("병해 리스크")
        if humidity_penalty_delta >= 0.12:
            risk_flags.append("습도 리스크")
        if energy_delta_72h > 0:
            risk_flags.append("에너지 증가")
        if source_sink_balance_delta < 0:
            risk_flags.append("공급/수요 균형 약화")
        if str(sensitivity_row.get("nonlinearity_hint") or "") in {"nonlinear", "direction_conflict"}:
            risk_flags.append("비선형성 경고")
        if scenario_score <= 0:
            risk_flags.append("효과 제한적")
        dominant_tradeoff = "수량 개선 우세"
        tradeoff_candidates = [
            ("에너지 증가", max(0.0, energy_delta_72h)),
            ("습도 리스크", max(0.0, humidity_penalty_delta)),
            ("병해 리스크", max(0.0, disease_penalty_delta)),
            ("공급/수요 균형 약화", max(0.0, -source_sink_balance_delta)),
        ]
        top_tradeoff = max(tradeoff_candidates, key=lambda item: item[1])
        if top_tradeoff[1] > 1e-9:
            dominant_tradeoff = top_tradeoff[0]
        requested_delta = round(float(step_meta["requested_delta"]), 6)
        applied_delta = round(
            float(comparison.get("applied_delta", requested_delta)),
            6,
        )
        bounded_delta = round(
            float(comparison.get("bounded_delta", applied_delta)),
            6,
        )
        return {
            "step_label": _step_label(spec, applied_delta),
            "step_class": step_meta["step_class"],
            "delta": applied_delta,
            "requested_delta": requested_delta,
            "applied_delta": applied_delta,
            "bounded_delta": bounded_delta,
            "scenario_score": scenario_score,
            "objective_delta": objective_delta,
            "yield_delta_24h": yield_delta_24h,
            "yield_delta_72h": yield_delta_72h,
            "yield_delta_7d": yield_delta_7d,
            "yield_delta_14d": yield_delta_14d,
            "canopy_delta_72h": canopy_delta_72h,
            "energy_delta": energy_delta_72h,
            "energy_delta_7d": energy_delta_7d,
            "humidity_penalty_delta": humidity_penalty_delta,
            "disease_penalty_delta": disease_penalty_delta,
            "source_sink_balance_delta": source_sink_balance_delta,
            "rtr_delta_72h": rtr_delta_72h,
            "confidence": confidence,
            "violated_constraints": violations,
            "risk_flags": risk_flags,
            "dominant_tradeoff": dominant_tradeoff,
            "ui_visible": bool(step_meta.get("ui_visible", True)),
            "is_clamped": bool(comparison.get("is_clamped")),
            "feasible": scenario_score > 0 and not _has_high_violation(violations),
        }

    def _build_family(control_name: str) -> dict[str, Any]:
        spec = CONTROL_SPECS[control_name]
        sensitivity_row = sensitivity_rows.get(control_name, {})
        ladder = [
            {"step_class": "micro", "requested_delta": round(spec.micro_step * sign, 6), "ui_visible": True}
            for sign in (1.0, -1.0)
        ] + [
            {"step_class": "macro", "requested_delta": round(spec.macro_step * sign, 6), "ui_visible": True}
            for sign in (1.0, -1.0)
        ]
        if spec.reference_step:
            ladder.extend(
                {"step_class": "reference", "requested_delta": round(spec.reference_step * sign, 6), "ui_visible": False}
                for sign in (1.0, -1.0)
            )
        ladder_payload = run_precision_ladder_scenarios(snapshot_record, control_name, [float(item["requested_delta"]) for item in ladder], horizons_hours=list(_MODEL_RUNTIME_HORIZONS_HOURS))
        comparisons = {round(float(item.get("requested_delta", 0.0)), 6): item for item in ladder_payload.get("comparisons", [])}
        steps = [_build_step(spec, item, comparisons[round(float(item["requested_delta"]), 6)], sensitivity_row) for item in ladder if round(float(item["requested_delta"]), 6) in comparisons]
        steps.sort(key=lambda item: float(item.get("scenario_score", 0.0)), reverse=True)
        recommended_step = next((item for item in steps if item.get("feasible") and item.get("ui_visible", True)), None)
        precision_mode = "hold"
        if recommended_step:
            same_sign = [item for item in steps if item.get("ui_visible") and (1 if float(item.get("applied_delta", 0.0)) > 0 else -1) == (1 if float(recommended_step.get("applied_delta", 0.0)) > 0 else -1) and item.get("step_class") in {"micro", "macro"}]
            micro = next((item for item in same_sign if item.get("step_class") == "micro"), None)
            macro = next((item for item in same_sign if item.get("step_class") == "macro"), None)
            if not micro or not macro:
                precision_mode = "micro_preferred" if recommended_step.get("step_class") == "micro" else "macro_preferred"
            elif float(micro.get("scenario_score", 0.0)) > 0 and float(macro.get("scenario_score", 0.0)) <= 0:
                precision_mode = "micro_preferred"
            elif float(macro.get("scenario_score", 0.0)) > float(micro.get("scenario_score", 0.0)) * 1.15:
                precision_mode = "macro_preferred"
            elif float(micro.get("scenario_score", 0.0)) >= float(macro.get("scenario_score", 0.0)) * 0.92:
                precision_mode = "range_preferred"
            else:
                precision_mode = "micro_preferred"
        confidence_adjustment = round(_clamp(0.55 + (0.2 * float(sensitivity_row.get("local_confidence", 0.0))) + (0.15 * float(sensitivity_payload.get("confidence", 0.0))) + (0.1 * float(recommended_step.get("confidence", 0.0)) if recommended_step else 0.0), 0.4, 1.0), 6)
        feasibility_adjustment = 0.35 if not recommended_step else round(_clamp(1.0 - (0.18 * (float(recommended_step.get("disease_penalty_delta", 0.0)) + float(recommended_step.get("humidity_penalty_delta", 0.0)) + max(0.0, float(recommended_step.get("energy_delta", 0.0))))), 0.45, 1.0), 6)
        clarity_adjustment = 0.72 if not recommended_step else (1.03 if precision_mode == "range_preferred" else 1.0 if precision_mode == "macro_preferred" else 0.96)
        family_score = round((float(recommended_step.get("scenario_score", 0.0)) if recommended_step else 0.0) * confidence_adjustment * feasibility_adjustment * clarity_adjustment, 6)
        diminishing_return = {"is_present": False, "marginal_gain_micro": 0.0, "marginal_gain_macro": 0.0, "marginal_cost_micro": 0.0, "marginal_cost_macro": 0.0, "micro_to_macro_gain_ratio": 0.0, "micro_to_macro_cost_ratio": 0.0, "energy_per_yield_ratio": 0.0}
        if recommended_step:
            step_sign = 1 if float(recommended_step.get("applied_delta", 0.0)) > 0 else -1
            same_sign = [item for item in steps if item.get("ui_visible") and (1 if float(item.get("applied_delta", 0.0)) > 0 else -1) == step_sign and item.get("step_class") in {"micro", "macro"}]
            micro = next((item for item in same_sign if item.get("step_class") == "micro"), None)
            macro = next((item for item in same_sign if item.get("step_class") == "macro"), None)
            if micro and macro:
                micro_gain = float(micro.get("yield_delta_14d", 0.0))
                macro_gain = float(macro.get("yield_delta_14d", 0.0)) - micro_gain
                micro_cost = abs(float(micro.get("energy_delta", 0.0))) + float(micro.get("disease_penalty_delta", 0.0)) + float(micro.get("humidity_penalty_delta", 0.0))
                macro_cost = abs(float(macro.get("energy_delta", 0.0))) + float(macro.get("disease_penalty_delta", 0.0)) + float(macro.get("humidity_penalty_delta", 0.0)) - micro_cost
                diminishing_return = {"is_present": (macro_gain / max(abs(micro_gain), 1e-9)) < 0.85 or (macro_cost / max(abs(micro_cost), 1e-9)) > 1.1, "marginal_gain_micro": round(micro_gain, 6), "marginal_gain_macro": round(macro_gain, 6), "marginal_cost_micro": round(micro_cost, 6), "marginal_cost_macro": round(macro_cost, 6), "micro_to_macro_gain_ratio": round(macro_gain / max(abs(micro_gain), 1e-9), 6), "micro_to_macro_cost_ratio": round(macro_cost / max(abs(micro_cost), 1e-9), 6), "energy_per_yield_ratio": round(abs(float(macro.get("energy_delta", 0.0))) / max(abs(float(macro.get("yield_delta_14d", 0.0))), 1e-9), 6)}
        operator_summary = {
            "headline": f"{spec.ui_label}은 지금 유지가 안전합니다.",
            "why": "작물 모델에서 신뢰할 만한 이득이 확인된 조정 폭이 없습니다.",
            "watch_out": "현재 조건에서는 큰 조정보다 관측 신호를 더 모으는 편이 안전합니다.",
            "time_window": {"now": "지금", "today": "오늘", "this_week": "이번주"}.get(
                _MODEL_RUNTIME_TIME_WINDOWS.get(control_name, "today"),
                "오늘",
            ),
        }
        if recommended_step:
            operator_summary = {
                "headline": f"{spec.ui_label}는 {recommended_step['step_label']} 조정이 가장 유리합니다.",
                "why": (
                    f"14일 예상 수량 {float(recommended_step.get('yield_delta_14d', 0.0)):+.3f}, "
                    f"72시간 군락 동화량 {float(recommended_step.get('canopy_delta_72h', 0.0)):+.3f}, "
                    f"공급/수요 균형 {float(recommended_step.get('source_sink_balance_delta', 0.0)):+.3f}입니다."
                ),
                "watch_out": (
                    "더 크게 조정하면 추가 이득보다 비용 또는 리스크가 먼저 커질 수 있습니다."
                    if precision_mode == "micro_preferred"
                    else "미세 조정보다 한 단계 더 크게 움직일 때 이득이 더 분명합니다."
                    if precision_mode == "macro_preferred"
                    else "미세 조정과 강한 조정이 모두 유효해 운영 여유 범위가 있습니다."
                    if precision_mode == "range_preferred"
                    else "신뢰 구간 안에서만 조정 강도를 비교해 주세요."
                ),
                "time_window": {"now": "지금", "today": "오늘", "this_week": "이번주"}.get(
                    _MODEL_RUNTIME_TIME_WINDOWS.get(control_name, "today"),
                    "오늘",
                ),
            }
        recommended_band = None
        if recommended_step:
            same_sign_values = [float(item.get("applied_delta", 0.0)) for item in steps if item.get("ui_visible") and (1 if float(item.get("applied_delta", 0.0)) > 0 else -1) == (1 if float(recommended_step.get("applied_delta", 0.0)) > 0 else -1) and item.get("step_class") in {"micro", "macro"}]
            same_sign_values = sorted(same_sign_values or [float(recommended_step.get("applied_delta", 0.0))])
            recommended_band = {"start": round(same_sign_values[0], 6), "end": round(same_sign_values[-1], 6), "unit": _display_unit(spec), "best_step": round(float(recommended_step.get("applied_delta", 0.0)), 6)}
        return {"control": control_name, "label": spec.ui_label, "current_value": _current_value(control_name), "unit": _display_unit(spec), "target_metric": derivative_target, "local_sensitivity": {"derivative": sensitivity_row.get("derivative"), "elasticity": sensitivity_row.get("elasticity"), "trust_region": sensitivity_row.get("trust_region"), "scenario_alignment": sensitivity_row.get("scenario_alignment"), "bounded_delta": sensitivity_row.get("bounded_delta"), "local_confidence": sensitivity_row.get("local_confidence"), "recommended_sign": sensitivity_row.get("recommended_sign"), "nonlinearity_hint": sensitivity_row.get("nonlinearity_hint")}, "steps": steps, "recommended_step": recommended_step, "diminishing_return": diminishing_return, "operator_summary": operator_summary, "action": _action_label(spec, float(recommended_step.get("applied_delta", 0.0))) if recommended_step else f"{spec.ui_label} 유지", "action_short": f"{spec.ui_label} {_step_label(spec, float(recommended_step.get('applied_delta', 0.0)))}" if recommended_step else f"{spec.ui_label} 유지", "action_family": spec.family_name, "recommended_band": recommended_band, "precision_mode": precision_mode, "why_summary": operator_summary["headline"], "why_detail": {"yield_24h": recommended_step.get("yield_delta_24h"), "yield_72h": recommended_step.get("yield_delta_72h"), "yield_7d": recommended_step.get("yield_delta_7d"), "yield_14d": recommended_step.get("yield_delta_14d"), "canopy_72h": recommended_step.get("canopy_delta_72h"), "energy": recommended_step.get("energy_delta"), "humidity": recommended_step.get("humidity_penalty_delta"), "disease": recommended_step.get("disease_penalty_delta"), "source_sink": recommended_step.get("source_sink_balance_delta")} if recommended_step else {}, "family_score": family_score, "best_step_score": float(recommended_step.get("scenario_score", 0.0)) if recommended_step else 0.0, "confidence_adjustment": confidence_adjustment, "feasibility_adjustment": feasibility_adjustment, "clarity_adjustment": clarity_adjustment, "time_window": _MODEL_RUNTIME_TIME_WINDOWS.get(control_name, "today")}

    recommendation_families = [
        _build_family(control_name)
        for control_name in selected_controls
        if control_name in sensitivity_rows
    ]
    recommendation_families.sort(
        key=lambda family: float(family.get("family_score", 0.0)),
        reverse=True,
    )
    best_actions = [
        family
        for family in recommendation_families
        if family.get("recommended_step") is not None
    ]
    runtime_options = [
        {
            "action": family.get("action"),
            "action_short": family.get("action_short"),
            "action_family": family.get("action_family"),
            "time_window": family.get("time_window"),
            "control": family.get("control"),
            "direction": "increase" if float(family["recommended_step"].get("applied_delta", 0.0)) > 0 else "decrease",
            "delta": family["recommended_step"].get("applied_delta"),
            "requested_delta": family["recommended_step"].get("requested_delta"),
            "unit": family.get("unit"),
            "score": family.get("family_score"),
            "expected_yield_delta_24h": family["recommended_step"].get("yield_delta_24h"),
            "expected_yield_delta_72h": family["recommended_step"].get("yield_delta_72h"),
            "expected_yield_delta_7d": family["recommended_step"].get("yield_delta_7d"),
            "expected_yield_delta_14d": family["recommended_step"].get("yield_delta_14d"),
            "expected_canopy_delta_72h": family["recommended_step"].get("canopy_delta_72h"),
            "expected_energy_delta": family["recommended_step"].get("energy_delta_7d"),
            "expected_RTR_delta": family["recommended_step"].get("rtr_delta_72h"),
            "expected_source_sink_balance_delta": family["recommended_step"].get("source_sink_balance_delta"),
            "confidence": family["recommended_step"].get("confidence"),
            "violated_constraints": family["recommended_step"].get("violated_constraints", []),
            "precision_mode": family.get("precision_mode"),
            "recommended_band": family.get("recommended_band"),
        }
        for family in best_actions[:3]
    ]
    recommended_option = runtime_options[0] if runtime_options else None
    top_levers = [
        {
            "control": lever.get("control"),
            "direction": lever.get("direction"),
            "derivative": lever.get("derivative"),
            "elasticity": lever.get("elasticity"),
            "trust_region": lever.get("trust_region"),
            "scenario_alignment": lever.get("scenario_alignment"),
            "bounded_delta": lever.get("bounded_delta"),
            "local_confidence": lever.get("local_confidence"),
            "recommended_sign": lever.get("recommended_sign"),
            "nonlinearity_hint": lever.get("nonlinearity_hint"),
        }
        for lever in _top_runtime_levers(sensitivity_payload)
    ]
    control_precision_matrix = {
        str(family.get("control")): [
            {
                "step_label": step.get("step_label"),
                "step_class": step.get("step_class"),
                "requested_delta": step.get("requested_delta"),
                "applied_delta": step.get("applied_delta"),
                "scenario_score": step.get("scenario_score"),
                "feasible": step.get("feasible"),
                "confidence": step.get("confidence"),
                "yield_delta_14d": step.get("yield_delta_14d"),
                "energy_delta": step.get("energy_delta"),
                "disease_penalty_delta": step.get("disease_penalty_delta"),
                "humidity_penalty_delta": step.get("humidity_penalty_delta"),
                "source_sink_balance_delta": step.get("source_sink_balance_delta"),
                "risk_flags": step.get("risk_flags", []),
                "ui_visible": step.get("ui_visible", True),
                "is_clamped": step.get("is_clamped", False),
            }
            for step in family.get("steps", [])
        ]
        for family in recommendation_families
    }
    operator_view = {"now": [], "today": [], "this_week": []}
    for family in best_actions[:3]:
        bucket = "today"
        if family.get("time_window") == "now":
            bucket = "now"
        elif family.get("time_window") == "this_week":
            bucket = "this_week"
        operator_view[bucket].append(
            {
                "control": family.get("control"),
                "label": family.get("label"),
                "action": family.get("action"),
                "action_short": family.get("action_short"),
                "precision_mode": family.get("precision_mode"),
                "headline": family.get("operator_summary", {}).get("headline"),
                "why": family.get("operator_summary", {}).get("why"),
                "watch_out": family.get("operator_summary", {}).get("watch_out"),
            }
        )
    tradeoff_summary = {
        "yield_vs_energy": [
            {
                "control": family.get("control"),
                "label": family.get("label"),
                "action_short": family.get("action_short"),
                "yield_delta_14d": family["recommended_step"].get("yield_delta_14d"),
                "energy_delta": family["recommended_step"].get("energy_delta"),
                "disease_penalty_delta": family["recommended_step"].get("disease_penalty_delta"),
                "humidity_penalty_delta": family["recommended_step"].get("humidity_penalty_delta"),
                "source_sink_balance_delta": family["recommended_step"].get("source_sink_balance_delta"),
            }
            for family in sorted(best_actions, key=lambda item: float(item["recommended_step"].get("yield_delta_14d", 0.0)) - abs(float(item["recommended_step"].get("energy_delta", 0.0))), reverse=True)[:3]
        ],
        "yield_vs_disease": [
            {
                "control": family.get("control"),
                "label": family.get("label"),
                "action_short": family.get("action_short"),
                "yield_delta_14d": family["recommended_step"].get("yield_delta_14d"),
                "energy_delta": family["recommended_step"].get("energy_delta"),
                "disease_penalty_delta": family["recommended_step"].get("disease_penalty_delta"),
                "humidity_penalty_delta": family["recommended_step"].get("humidity_penalty_delta"),
                "source_sink_balance_delta": family["recommended_step"].get("source_sink_balance_delta"),
            }
            for family in sorted(best_actions, key=lambda item: float(item["recommended_step"].get("yield_delta_14d", 0.0)) - float(item["recommended_step"].get("disease_penalty_delta", 0.0)), reverse=True)[:3]
        ],
        "yield_vs_source_sink": [
            {
                "control": family.get("control"),
                "label": family.get("label"),
                "action_short": family.get("action_short"),
                "yield_delta_14d": family["recommended_step"].get("yield_delta_14d"),
                "energy_delta": family["recommended_step"].get("energy_delta"),
                "disease_penalty_delta": family["recommended_step"].get("disease_penalty_delta"),
                "humidity_penalty_delta": family["recommended_step"].get("humidity_penalty_delta"),
                "source_sink_balance_delta": family["recommended_step"].get("source_sink_balance_delta"),
            }
            for family in sorted(best_actions, key=lambda item: float(item["recommended_step"].get("yield_delta_14d", 0.0)) + float(item["recommended_step"].get("source_sink_balance_delta", 0.0)), reverse=True)[:3]
        ],
    }
    answer_focus = _build_runtime_answer_focus(
        messages=messages,
        recommendation_families=recommendation_families,
        language=language,
    )

    return {
        "status": "ready",
        "runtime_mode": "recommendation",
        "summary": "현재 온실 상태를 기준으로 조정 후보의 효과와 비용을 비교했습니다.",
        "state_snapshot": {
            "crop": crop,
            "lai": state.get("lai"),
            "fruit_load": state.get("fruit_load"),
            "source_capacity": state.get("source_capacity"),
            "sink_demand": state.get("sink_demand"),
            "source_sink_balance": baseline_payload.get("runtime_inputs", {}).get("source_sink_balance"),
            "limiting_factor": baseline_payload.get("runtime_inputs", {}).get("limiting_factor"),
            "canopy_temperature_c": live_observation.get("canopy_temperature_c"),
            "canopy_net_assimilation_umol_m2_s": gas_exchange.get("canopy_net_assimilation_umol_m2_s"),
            "upper_leaf_activity": state.get("upper_leaf_activity"),
            "middle_leaf_activity": state.get("middle_leaf_activity"),
            "bottom_leaf_activity": state.get("bottom_leaf_activity"),
            "observed_signal_score": observed_signal_score,
            "dashboard_missing_fields": dashboard_missing_fields,
            "inferred_fields": inferred_fields,
        },
        "scenario": {
            "baseline_outputs": baseline_payload.get("baseline_outputs", []),
            "options": runtime_options[:3],
            "recommended": recommended_option,
            "confidence": baseline_payload.get("confidence"),
            "baseline_canopy_A_24h": baseline_24h.get("canopy_A_pred"),
        },
        "sensitivity": {
            "target": sensitivity_payload.get("derivative_target"),
            "analysis_horizon_hours": sensitivity_payload.get("horizon_hours"),
            "confidence": sensitivity_payload.get("confidence"),
            "top_levers": top_levers,
        },
        "constraint_checks": {
            "status": "pass" if recommended_option and not recommended_option.get("violated_constraints") else "warning" if recommended_option else "monitoring-first",
            "violated_constraints": recommended_option.get("violated_constraints", []) if recommended_option else [],
            "penalties": (
                {
                    "energy_cost_penalty": best_actions[0]["recommended_step"].get("energy_delta", 0.0),
                    "humidity_penalty": best_actions[0]["recommended_step"].get("humidity_penalty_delta", 0.0),
                    "disease_risk_penalty": best_actions[0]["recommended_step"].get("disease_penalty_delta", 0.0),
                    "confidence_penalty": max(0.0, 1.0 - float(best_actions[0]["recommended_step"].get("confidence", 0.0))),
                }
                if best_actions and best_actions[0].get("recommended_step")
                else {}
            ),
        },
        "recommendation_families": recommendation_families,
        "best_actions": [
            {
                "action": family.get("action"),
                "action_short": family.get("action_short"),
                "action_family": family.get("action_family"),
                "control": family.get("control"),
                "recommended_band": family.get("recommended_band"),
                "precision_mode": family.get("precision_mode"),
                "why_summary": family.get("why_summary"),
                "why_detail": family.get("why_detail"),
                "operator_summary": family.get("operator_summary"),
                "family_score": family.get("family_score"),
                "time_window": family.get("time_window"),
            }
            for family in best_actions[:3]
        ],
        "control_precision_matrix": control_precision_matrix,
        "operator_view": operator_view,
        "tradeoff_summary": tradeoff_summary,
        "answer_focus": answer_focus,
        "recommendations": runtime_options[:3],
        "provenance": {
            "source": "dashboard_synthesized_snapshot",
            "tab_name": tab_name,
            "selected_controls": selected_controls,
            "derivative_target": derivative_target,
            "horizons_hours": list(_MODEL_RUNTIME_HORIZONS_HOURS),
            "dashboard_missing_fields": dashboard_missing_fields,
            "inferred_fields": inferred_fields,
            "recommendations_surface": "legacy",
        },
    }

    runtime_options: list[dict[str, Any]] = []
    for lever in _top_runtime_levers(sensitivity_payload):
        control_name = str(lever.get("control"))
        spec = CONTROL_SPECS.get(control_name)
        direction = str(lever.get("direction") or "neutral")
        if spec is None or direction == "neutral":
            continue

        delta_value = spec.default_step if direction == "increase" else -spec.default_step
        scenario_payload = run_bounded_scenario(
            snapshot_record,
            controls={control_name: delta_value},
            horizons_hours=list(_MODEL_RUNTIME_HORIZONS_HOURS),
        )
        scenario_24h = _scenario_row_by_horizon(scenario_payload.get("outputs", []), 24)
        scenario_72h = _scenario_row_by_horizon(scenario_payload.get("outputs", []), 72)
        scenario_168h = _scenario_row_by_horizon(scenario_payload.get("outputs", []), 168)
        scenario_336h = _scenario_row_by_horizon(scenario_payload.get("outputs", []), 336)
        score = _score_runtime_option(
            baseline_72h=baseline_72h,
            baseline_168h=baseline_168h,
            baseline_336h=baseline_336h,
            scenario_72h=scenario_72h,
            scenario_168h=scenario_168h,
            scenario_336h=scenario_336h,
            penalties=scenario_payload.get("penalties", {}),
            confidence=float(scenario_payload.get("confidence", 0.0)),
        )
        runtime_options.append(
            {
                "action": (
                    f"{_MODEL_RUNTIME_CONTROL_LABELS.get(control_name, control_name)} "
                    f"{abs(delta_value):g}{spec.unit} {'올리기' if delta_value > 0 else '내리기'}"
                ),
                "time_window": _MODEL_RUNTIME_TIME_WINDOWS.get(control_name, "today"),
                "control": control_name,
                "direction": direction,
                "delta": round(delta_value, 6),
                "unit": spec.unit,
                "score": score,
                "expected_yield_delta_24h": scenario_24h.get("yield_delta_vs_baseline"),
                "expected_yield_delta_72h": scenario_72h.get("yield_delta_vs_baseline"),
                "expected_yield_delta_7d": scenario_168h.get("yield_delta_vs_baseline"),
                "expected_yield_delta_14d": scenario_336h.get("yield_delta_vs_baseline"),
                "expected_energy_delta": scenario_168h.get("energy_delta_vs_baseline"),
                "expected_RTR_delta": (
                    None
                    if not scenario_168h or not baseline_168h
                    else round(
                        float(scenario_168h.get("rtr_pred", 0.0))
                        - float(baseline_168h.get("rtr_pred", 0.0)),
                        6,
                    )
                ),
                "expected_source_sink_balance_delta": scenario_72h.get("source_sink_balance_delta"),
                "confidence": scenario_payload.get("confidence"),
                "violated_constraints": scenario_payload.get("violated_constraints", []),
                "scenario": {
                    "baseline_outputs": baseline_payload.get("baseline_outputs", []),
                    "outputs": scenario_payload.get("outputs", []),
                    "violated_constraints": scenario_payload.get("violated_constraints", []),
                    "penalties": scenario_payload.get("penalties", {}),
                },
            }
        )

    runtime_options.sort(key=lambda option: float(option.get("score", 0.0)), reverse=True)
    recommended_option = next(
        (
            option
            for option in runtime_options
            if float(option.get("score", 0.0)) > 0
            and not any(
                violation.get("severity") == "high"
                for violation in option.get("violated_constraints", [])
            )
        ),
        None,
    )

    top_levers = [
        {
            "control": lever.get("control"),
            "direction": lever.get("direction"),
            "derivative": lever.get("derivative"),
            "elasticity": lever.get("elasticity"),
            "trust_region": lever.get("trust_region"),
            "scenario_alignment": lever.get("scenario_alignment"),
            "bounded_delta": lever.get("bounded_delta"),
        }
        for lever in _top_runtime_levers(sensitivity_payload)
    ]
    state = snapshot_record["normalized_snapshot"]["state"]
    gas_exchange = snapshot_record["normalized_snapshot"]["gas_exchange"]
    live_observation = snapshot_record["normalized_snapshot"]["live_observation"]
    baseline_24h = _scenario_row_by_horizon(baseline_payload.get("baseline_outputs", []), 24)

    return {
        "status": "ready",
        "summary": "현재 대시보드 문맥을 기준으로 예측 시나리오와 주요 환경 요인을 함께 정리했습니다.",
        "state_snapshot": {
            "crop": crop,
            "lai": state.get("lai"),
            "fruit_load": state.get("fruit_load"),
            "source_capacity": state.get("source_capacity"),
            "sink_demand": state.get("sink_demand"),
            "source_sink_balance": baseline_payload.get("runtime_inputs", {}).get("source_sink_balance"),
            "limiting_factor": baseline_payload.get("runtime_inputs", {}).get("limiting_factor"),
            "canopy_temperature_c": live_observation.get("canopy_temperature_c"),
            "canopy_net_assimilation_umol_m2_s": gas_exchange.get("canopy_net_assimilation_umol_m2_s"),
            "upper_leaf_activity": state.get("upper_leaf_activity"),
            "middle_leaf_activity": state.get("middle_leaf_activity"),
            "bottom_leaf_activity": state.get("bottom_leaf_activity"),
            "observed_signal_score": observed_signal_score,
            "dashboard_missing_fields": dashboard_missing_fields,
            "inferred_fields": inferred_fields,
        },
        "scenario": {
            "baseline_outputs": baseline_payload.get("baseline_outputs", []),
            "options": runtime_options[:3],
            "recommended": recommended_option,
            "confidence": baseline_payload.get("confidence"),
            "baseline_canopy_A_24h": baseline_24h.get("canopy_A_pred"),
        },
        "sensitivity": {
            "target": sensitivity_payload.get("derivative_target"),
            "analysis_horizon_hours": sensitivity_payload.get("horizon_hours"),
            "confidence": sensitivity_payload.get("confidence"),
            "top_levers": top_levers,
        },
        "constraint_checks": {
            "status": (
                "pass"
                if recommended_option and not recommended_option.get("violated_constraints")
                else "warning"
                if recommended_option
                else "monitoring-first"
            ),
            "violated_constraints": (
                recommended_option.get("violated_constraints", []) if recommended_option else []
            ),
            "penalties": (
                recommended_option.get("scenario", {}).get("penalties", {}) if recommended_option else {}
            ),
        },
        "recommendations": [
            {
                key: value
                for key, value in option.items()
                if key != "scenario"
            }
            for option in runtime_options[:3]
        ],
        "provenance": {
            "source": "dashboard_synthesized_snapshot",
            "tab_name": tab_name,
            "selected_controls": selected_controls,
            "derivative_target": derivative_target,
            "horizons_hours": list(_MODEL_RUNTIME_HORIZONS_HOURS),
            "dashboard_missing_fields": dashboard_missing_fields,
            "inferred_fields": inferred_fields,
        },
    }


def _collect_environment_missing_data_flags(dashboard: dict[str, Any]) -> list[str]:
    current_data = _get_dashboard_context(dashboard, "currentData", "data") or {}
    recent_summary = _get_dashboard_context(dashboard, "recentSummary") or {}
    weather = _get_dashboard_context(dashboard, "weather") or {}
    rtr = _get_dashboard_context(dashboard, "rtr") or {}
    weather_current = weather.get("current", {}) if isinstance(weather, dict) else {}
    weather_daily = weather.get("daily", []) if isinstance(weather, dict) else []
    rtr_live = rtr.get("live", {}) if isinstance(rtr, dict) else {}
    rtr_forecast_targets = rtr.get("forecastTargets", []) if isinstance(rtr, dict) else []

    missing_flags: list[str] = []
    if _coerce_float(current_data.get("temperature")) is None:
        missing_flags.append("inside_temperature")
    if _coerce_float(current_data.get("humidity")) is None:
        missing_flags.append("inside_humidity")
    if _coerce_float(current_data.get("vpd")) is None:
        missing_flags.append("inside_vpd")
    if not _context_has_value(weather_current):
        missing_flags.append("weather_current")
    if not weather_daily:
        missing_flags.append("weather_forecast")
    if not _context_has_value(rtr_live):
        missing_flags.append("rtr_live")
    if not rtr_forecast_targets:
        missing_flags.append("rtr_forecast")
    if not _context_has_value(recent_summary):
        missing_flags.append("recentSummary")

    return missing_flags


def _environment_context_completeness(dashboard: dict[str, Any]) -> float:
    current_data = _get_dashboard_context(dashboard, "currentData", "data") or {}
    recent_summary = _get_dashboard_context(dashboard, "recentSummary") or {}
    weather = _get_dashboard_context(dashboard, "weather") or {}
    rtr = _get_dashboard_context(dashboard, "rtr") or {}
    weather_current = weather.get("current", {}) if isinstance(weather, dict) else {}
    weather_daily = weather.get("daily", []) if isinstance(weather, dict) else []
    rtr_live = rtr.get("live", {}) if isinstance(rtr, dict) else {}
    rtr_forecast_targets = rtr.get("forecastTargets", []) if isinstance(rtr, dict) else []

    checks = (
        _coerce_float(current_data.get("temperature")) is not None,
        _coerce_float(current_data.get("humidity")) is not None,
        _coerce_float(current_data.get("vpd")) is not None,
        _context_has_value(weather_current),
        bool(weather_daily),
        _context_has_value(rtr_live),
        bool(rtr_forecast_targets),
        _context_has_value(recent_summary),
    )
    return round(sum(1 for item in checks if item) / len(checks), 2)


def _collect_physiology_missing_data_flags(dashboard: dict[str, Any]) -> list[str]:
    current_data = _get_dashboard_context(dashboard, "currentData", "data") or {}
    metrics = _get_dashboard_context(dashboard, "metrics") or {}
    growth_metrics = metrics.get("growth", {}) if isinstance(metrics, dict) else {}

    missing_flags: list[str] = []
    if _coerce_float(current_data.get("temperature")) is None:
        missing_flags.append("inside_temperature")
    if _coerce_float(current_data.get("canopyTemp")) is None:
        missing_flags.append("canopy_temperature")
    if _coerce_float(current_data.get("vpd")) is None:
        missing_flags.append("inside_vpd")
    if _coerce_float(current_data.get("transpiration")) is None:
        missing_flags.append("transpiration")
    if _coerce_float(current_data.get("stomatalConductance")) is None:
        missing_flags.append("stomatal_conductance")
    if _coerce_float(current_data.get("photosynthesis")) is None:
        missing_flags.append("photosynthesis")
    if _coerce_float(current_data.get("light")) is None:
        missing_flags.append("inside_light")
    if _coerce_float(current_data.get("co2")) is None:
        missing_flags.append("inside_co2")
    if not _context_has_value(growth_metrics):
        missing_flags.append("growth_metrics")
    if not _context_has_value(_get_dashboard_context(dashboard, "recentSummary")):
        missing_flags.append("recentSummary")

    return missing_flags


def _physiology_context_completeness(dashboard: dict[str, Any]) -> float:
    current_data = _get_dashboard_context(dashboard, "currentData", "data") or {}
    metrics = _get_dashboard_context(dashboard, "metrics") or {}
    growth_metrics = metrics.get("growth", {}) if isinstance(metrics, dict) else {}

    checks = (
        _coerce_float(current_data.get("temperature")) is not None,
        _coerce_float(current_data.get("canopyTemp")) is not None,
        _coerce_float(current_data.get("vpd")) is not None,
        _coerce_float(current_data.get("transpiration")) is not None,
        _coerce_float(current_data.get("stomatalConductance")) is not None,
        _coerce_float(current_data.get("photosynthesis")) is not None,
        _coerce_float(current_data.get("light")) is not None,
        _coerce_float(current_data.get("co2")) is not None,
        _context_has_value(growth_metrics),
        _context_has_value(_get_dashboard_context(dashboard, "recentSummary")),
    )
    return round(sum(1 for item in checks if item) / len(checks), 2)


def _collect_work_missing_data_flags(dashboard: dict[str, Any]) -> list[str]:
    current_data = _get_dashboard_context(dashboard, "currentData", "data") or {}
    metrics = _get_dashboard_context(dashboard, "metrics") or {}
    forecast = _get_dashboard_context(dashboard, "forecast") or {}
    weather = _get_dashboard_context(dashboard, "weather") or {}
    rtr = _get_dashboard_context(dashboard, "rtr") or {}
    growth_metrics = metrics.get("growth", {}) if isinstance(metrics, dict) else {}
    yield_metrics = metrics.get("yield", {}) if isinstance(metrics, dict) else {}
    weather_current = weather.get("current", {}) if isinstance(weather, dict) else {}
    weather_daily = weather.get("daily", []) if isinstance(weather, dict) else []
    rtr_live = rtr.get("live", {}) if isinstance(rtr, dict) else {}

    missing_flags: list[str] = []
    if not _context_has_value(forecast):
        missing_flags.append("forecast")
    if not _context_has_value(growth_metrics):
        missing_flags.append("growth_metrics")
    if not _context_has_value(yield_metrics):
        missing_flags.append("yield_metrics")
    if not _context_has_value(weather_current):
        missing_flags.append("weather_current")
    if not weather_daily:
        missing_flags.append("weather_forecast")
    if not _context_has_value(rtr_live):
        missing_flags.append("rtr_live")
    if _coerce_float(current_data.get("humidity")) is None:
        missing_flags.append("inside_humidity")
    if _coerce_float(current_data.get("vpd")) is None:
        missing_flags.append("inside_vpd")
    return missing_flags


def _work_context_completeness(dashboard: dict[str, Any]) -> float:
    current_data = _get_dashboard_context(dashboard, "currentData", "data") or {}
    metrics = _get_dashboard_context(dashboard, "metrics") or {}
    forecast = _get_dashboard_context(dashboard, "forecast") or {}
    weather = _get_dashboard_context(dashboard, "weather") or {}
    rtr = _get_dashboard_context(dashboard, "rtr") or {}
    growth_metrics = metrics.get("growth", {}) if isinstance(metrics, dict) else {}
    yield_metrics = metrics.get("yield", {}) if isinstance(metrics, dict) else {}
    weather_current = weather.get("current", {}) if isinstance(weather, dict) else {}
    weather_daily = weather.get("daily", []) if isinstance(weather, dict) else []
    rtr_live = rtr.get("live", {}) if isinstance(rtr, dict) else {}

    checks = (
        _context_has_value(forecast),
        _context_has_value(growth_metrics),
        _context_has_value(yield_metrics),
        _context_has_value(weather_current),
        bool(weather_daily),
        _context_has_value(rtr_live),
        _coerce_float(current_data.get("humidity")) is not None,
        _coerce_float(current_data.get("vpd")) is not None,
    )
    return round(sum(1 for item in checks if item) / len(checks), 2)


def _resolve_state_datetime(
    current_data: dict[str, Any],
    weather_current: dict[str, Any],
) -> str | None:
    if isinstance(weather_current.get("time"), str) and weather_current["time"].strip():
        return weather_current["time"]

    timestamp = _coerce_float(current_data.get("timestamp"))
    if timestamp is None:
        return None
    return datetime.fromtimestamp(timestamp / 1000, tz=timezone.utc).isoformat()


def _build_work_time_windows(
    *,
    current_data: dict[str, Any],
    weather: dict[str, Any],
    rtr: dict[str, Any],
    top_actions: list[dict[str, Any]],
) -> list[dict[str, str]]:
    daily_weather = weather.get("daily", []) if isinstance(weather, dict) else []
    first_weather_day = daily_weather[0] if daily_weather else {}
    live_rtr = rtr.get("live", {}) if isinstance(rtr, dict) else {}
    forecast_targets = rtr.get("forecastTargets", []) if isinstance(rtr, dict) else []
    first_rtr_target = forecast_targets[0] if forecast_targets else {}

    next_6h_focus = []
    humidity_pct = _coerce_float(current_data.get("humidity"))
    if humidity_pct is not None and humidity_pct >= 85:
        next_6h_focus.append("고습 구간에서는 잎 접촉 작업보다 순찰·결로 확인을 우선합니다.")

    vpd_kpa = _coerce_float(current_data.get("vpd"))
    if vpd_kpa is not None and vpd_kpa <= 0.5:
        next_6h_focus.append("VPD가 낮아 적엽·수확 후 습기 체류를 줄이도록 작업 밀집을 피합니다.")

    if not next_6h_focus:
        next_6h_focus.append("즉시 작업은 고우선순위 action card부터 진행합니다.")

    next_24h_focus = []
    precip_pct = _coerce_float(first_weather_day.get("precipitation_probability_max_pct"))
    if precip_pct is not None and precip_pct >= 60:
        next_24h_focus.append("흐림·강수 가능성이 높아 오전 광량이 있을 때 유인·수확 작업을 앞당깁니다.")

    delta_temp_c = _coerce_float(live_rtr.get("deltaTempC"))
    if delta_temp_c is not None and delta_temp_c <= -1:
        next_24h_focus.append("RTR 목표 대비 온도가 낮아 생장 작업 강도를 분산하고 과부하 작업을 줄입니다.")

    if top_actions:
        next_24h_focus.append(f"오늘 우선 작업은 '{top_actions[0]['title']}'입니다.")

    next_3d_focus = []
    temp_max_c = _coerce_float(first_weather_day.get("temperature_max_c"))
    if temp_max_c is not None and temp_max_c >= 30:
        next_3d_focus.append("고온일 전에 적엽·유인·급액 점검을 선행 배치합니다.")

    if first_rtr_target:
        next_3d_focus.append(
            "RTR 예보 목표를 기준으로 작업량을 분산해 생육 제어와 충돌을 줄입니다."
        )

    if not next_3d_focus:
        next_3d_focus.append("3일 계획은 수확·관수·유인 작업의 리듬 유지에 집중합니다.")

    return [
        {
            "window": "next_6h",
            "focus": " / ".join(next_6h_focus),
            "rationale": "현재 습도·VPD와 즉시 실행 가능한 작업 충돌을 먼저 줄입니다.",
        },
        {
            "window": "next_24h",
            "focus": " / ".join(next_24h_focus),
            "rationale": "오늘 작업 순서는 일사·RTR 편차와 수확 부담을 같이 반영합니다.",
        },
        {
            "window": "next_3d",
            "focus": " / ".join(next_3d_focus),
            "rationale": "3일 창에서는 날씨 변화 전 선행 작업과 작업량 분산이 핵심입니다.",
        },
    ]


def _priority_rank(priority: str | None) -> int:
    return {"high": 1, "medium": 2, "low": 3}.get(str(priority or "").lower(), 4)


def _build_work_action_items(
    recommendations: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    time_window_map = {
        "harvest": "today",
        "irrigation": "today",
        "environment": "next_6h",
        "health": "next_6h",
        "forecast": "next_24h",
        "energy": "this_week",
    }

    actions: list[dict[str, Any]] = []
    for recommendation in recommendations[:5]:
        category = str(recommendation.get("category") or "general")
        actions.append(
            {
                "priority": recommendation.get("priority", "medium"),
                "rank": _priority_rank(str(recommendation.get("priority"))),
                "category": category,
                "title": str(recommendation.get("title") or recommendation.get("message") or "Work action"),
                "message": str(recommendation.get("message") or ""),
                "action": recommendation.get("action"),
                "time_window": time_window_map.get(category, "today"),
            }
        )
    return actions


def _build_work_priority_action(
    *,
    priority: str,
    category: str,
    title: str,
    message: str,
    action: str,
    time_window: str,
) -> dict[str, Any]:
    return {
        "priority": priority,
        "rank": _priority_rank(priority),
        "category": category,
        "title": title,
        "message": message,
        "action": action,
        "time_window": time_window,
    }


def _append_unique_work_action(
    target: list[dict[str, Any]],
    action: dict[str, Any],
) -> None:
    candidate_title = str(action.get("title") or "").strip()
    if not candidate_title:
        return
    if any(str(item.get("title") or "").strip() == candidate_title for item in target):
        return
    target.append(action)


def _build_environment_action(
    *,
    title: str,
    rationale: str,
    operator: str,
    expected_effect: str,
    time_window: str,
) -> dict[str, str]:
    return {
        "title": title,
        "rationale": rationale,
        "operator": operator,
        "expected_effect": expected_effect,
        "time_window": time_window,
    }


def _build_physiology_action(
    *,
    title: str,
    rationale: str,
    operator: str,
    expected_effect: str,
    time_window: str,
) -> dict[str, str]:
    return {
        "title": title,
        "rationale": rationale,
        "operator": operator,
        "expected_effect": expected_effect,
        "time_window": time_window,
    }


def _build_work_rule_actions(
    *,
    crop: str,
    daily_harvest_kg: float | None,
    etc_mm_day: float | None,
    humidity_pct: float | None,
    vpd_kpa: float | None,
    forecast_high_temp_c: float | None,
    forecast_precip_probability_pct: float | None,
    active_trusses: int | None,
    node_count: int | None,
    rtr_delta_temp_c: float | None,
) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    high_humidity = humidity_pct is not None and humidity_pct >= 85
    low_vpd = vpd_kpa is not None and vpd_kpa <= 0.5
    humidity_sensitive_window = high_humidity or low_vpd
    harvest_ready = daily_harvest_kg is not None and daily_harvest_kg >= 1.0
    high_etc = etc_mm_day is not None and etc_mm_day >= 5.0
    heat_peak = forecast_high_temp_c is not None and forecast_high_temp_c >= 30
    storm_risk = (
        forecast_precip_probability_pct is not None
        and forecast_precip_probability_pct >= 60
    )
    rtr_cool_gap = rtr_delta_temp_c is not None and rtr_delta_temp_c <= -1.0
    fruit_load_pressure = crop == "tomato" and active_trusses is not None and active_trusses >= 8
    canopy_extension_pressure = (
        crop == "cucumber" and node_count is not None and node_count >= 24
    )

    risk_flags: list[str] = []
    if humidity_sensitive_window:
        risk_flags.append("humidity-sensitive-window")
    if harvest_ready:
        risk_flags.append("harvest-window-open")
    if high_etc:
        risk_flags.append("high-etc-day")
    if heat_peak:
        risk_flags.append("heat-peak-risk")
    if storm_risk:
        risk_flags.append("storm-risk")
    if rtr_cool_gap:
        risk_flags.append("rtr-cool-gap")
    if fruit_load_pressure:
        risk_flags.append("fruit-load-pressure")
    if canopy_extension_pressure:
        risk_flags.append("canopy-extension-pressure")

    operating_mode = "steady-rhythm"
    primary_constraint = "현재 작업 리듬을 유지하며 큰 충돌 신호를 모니터링합니다."
    labor_strategy = "수확·유인·급액 점검을 기본 순서대로 유지합니다."

    if harvest_ready and humidity_sensitive_window:
        operating_mode = "protected-harvest-window"
        primary_constraint = "수확 창과 고습/저VPD 작업 충돌을 줄여야 합니다."
        labor_strategy = "수확·선별을 먼저 열고 적엽·유인 같은 잎 접촉 작업은 분리합니다."
    elif high_etc or heat_peak:
        operating_mode = "irrigation-and-heat-prep"
        primary_constraint = "고온/고ETc 구간 전에 급액·관수 리듬을 먼저 맞춰야 합니다."
        labor_strategy = "오전 창에 급액·관수 점검을 앞세우고 무거운 작업은 분산합니다."
    elif rtr_cool_gap and (fruit_load_pressure or canopy_extension_pressure):
        operating_mode = "load-protected-rhythm"
        primary_constraint = "생장 pace가 밀리는 구간에서 과한 canopy 작업이 생육부하를 키울 수 있습니다."
        labor_strategy = "생장부하를 키우는 작업을 하루에 몰지 말고 여러 창으로 나눕니다."
    elif harvest_ready:
        operating_mode = "harvest-first"
        primary_constraint = "짧은 수확 창을 먼저 확보하는 편이 오늘 작업 효율이 높습니다."
        labor_strategy = "수확·선별을 우선하고 나머지 관리 작업은 후속 창으로 보냅니다."

    rule_actions: list[dict[str, Any]] = []
    if harvest_ready and humidity_sensitive_window:
        _append_unique_work_action(
            rule_actions,
            _build_work_priority_action(
                priority="high",
                category="workflow",
                title="수확·습기 민감 작업 분리",
                message="다음 수확 물량이 있고 고습/저VPD라 수확·적엽·유인 작업을 같은 창에 몰지 않는 편이 안전합니다.",
                action="split_harvest_and_leafwork",
                time_window="today_am",
            ),
        )
    elif harvest_ready:
        _append_unique_work_action(
            rule_actions,
            _build_work_priority_action(
                priority="high",
                category="harvest",
                title="수확·선별 창 선점",
                message="다음 수확 물량이 보여 오전 수확·선별 창을 먼저 확보하는 편이 작업 품질이 안정적입니다.",
                action="prioritize_harvest_window",
                time_window="today_am",
            ),
        )

    if high_etc or heat_peak:
        _append_unique_work_action(
            rule_actions,
            _build_work_priority_action(
                priority="high" if high_etc else "medium",
                category="irrigation",
                title="급액·관수 확인 선행",
                message="고온 또는 높은 ETc가 예고돼 작업보다 급액·관수 리듬을 먼저 정렬해야 오후 스트레스가 덜 커집니다.",
                action="frontload_irrigation_checks",
                time_window="today_am",
            ),
        )

    if storm_risk:
        _append_unique_work_action(
            rule_actions,
            _build_work_priority_action(
                priority="medium",
                category="forecast",
                title="흐림·강수 전 민감 작업 선행",
                message="강수/흐림 가능성이 높아 오전 광량이 있을 때 유인·정리 작업을 앞당기는 편이 안전합니다.",
                action="advance_sensitive_tasks",
                time_window="next_24h",
            ),
        )

    if rtr_cool_gap and (fruit_load_pressure or canopy_extension_pressure):
        _append_unique_work_action(
            rule_actions,
            _build_work_priority_action(
                priority="medium",
                category="growth",
                title=(
                    "토마토 생장부하 작업 분산"
                    if crop == "tomato"
                    else "오이 생장 리듬 보호 작업 분산"
                ),
                message=(
                    "RTR 기준보다 차가운 상태에서 canopy workload를 하루에 몰면 생장 회복이 더 느려질 수 있습니다."
                ),
                action="spread_labor_load",
                time_window="today",
            ),
        )

    if crop == "tomato" and fruit_load_pressure and humidity_sensitive_window:
        _append_unique_work_action(
            rule_actions,
            _build_work_priority_action(
                priority="medium",
                category="growth",
                title="토마토 과부하 적엽 보수 운용",
                message="fruit load가 큰 구간에서 고습/저VPD가 겹치면 과한 적엽보다 작업 속도와 범위를 보수적으로 두는 편이 안전합니다.",
                action="keep_pruning_conservative",
                time_window="today_pm",
            ),
        )

    if crop == "cucumber" and canopy_extension_pressure and humidity_sensitive_window:
        _append_unique_work_action(
            rule_actions,
            _build_work_priority_action(
                priority="medium",
                category="growth",
                title="오이 유인·적엽 리듬 분리",
                message="node pace가 빠른 구간에서는 유인과 적엽을 분리해 canopy 회복 여유를 남겨두는 편이 안전합니다.",
                action="separate_training_and_pruning",
                time_window="today",
            ),
        )

    return rule_actions, {
        "operating_mode": operating_mode,
        "primary_constraint": primary_constraint,
        "labor_strategy": labor_strategy,
        "risk_flags": risk_flags,
    }


def _build_supporting_signal(
    label: str,
    value: str,
    interpretation: str,
) -> dict[str, str]:
    return {
        "label": label,
        "value": value,
        "interpretation": interpretation,
    }


def _map_action_horizon(time_window: str | None) -> str:
    normalized = (time_window or "").strip().lower()
    if normalized in {"next_6h", "immediate", "now"}:
        return "now"
    if normalized in {"today", "next_24h", "today_am", "today_pm"}:
        return "today"
    return "next_3d"


def _build_advisor_action_item(
    *,
    title: str,
    rationale: str,
    operator: str | None = None,
    expected_effect: str | None = None,
    badges: list[str] | None = None,
) -> dict[str, Any]:
    payload: dict[str, Any] = {
        "title": title,
        "rationale": rationale,
        "badges": [badge for badge in (badges or []) if badge],
    }
    if operator:
        payload["operator"] = operator
    if expected_effect:
        payload["expected_effect"] = expected_effect
    return payload


def _build_environment_advisor_actions(
    environment_analysis: dict[str, Any],
) -> dict[str, Any]:
    return {
        "mode": str(environment_analysis.get("mode") or "actionable"),
        "now": [
            _build_advisor_action_item(
                title=str(action.get("title") or "Environment action"),
                rationale=str(action.get("rationale") or ""),
                operator=str(action.get("operator") or ""),
                expected_effect=str(action.get("expected_effect") or ""),
                badges=[str(action.get("time_window") or "")],
            )
            for action in environment_analysis.get("immediate_actions", [])
        ],
        "today": [
            _build_advisor_action_item(
                title=str(action.get("title") or "환경 제어"),
                rationale=str(action.get("rationale") or ""),
                operator=str(action.get("operator") or ""),
                expected_effect=str(action.get("expected_effect") or ""),
                badges=[str(action.get("time_window") or "")],
            )
            for action in environment_analysis.get("today_steering", [])
        ],
        "next_3d": [
            _build_advisor_action_item(
                title=str(action.get("title") or "3일 제어"),
                rationale=str(action.get("rationale") or ""),
                badges=[str(action.get("date") or "")],
            )
            for action in environment_analysis.get("three_day_plan", [])
        ],
    }


def _build_work_advisor_actions(
    work_analysis: dict[str, Any],
) -> dict[str, Any]:
    buckets: dict[str, list[dict[str, Any]]] = {
        "now": [],
        "today": [],
        "next_3d": [],
    }

    for action in work_analysis.get("priority_actions", []):
        horizon = _map_action_horizon(str(action.get("time_window") or ""))
        buckets[horizon].append(
            _build_advisor_action_item(
                title=str(action.get("title") or "Work action"),
                rationale=str(action.get("message") or ""),
                operator=(
                    str(action.get("action"))
                    if action.get("action") is not None
                    else None
                ),
                badges=[
                    str(action.get("priority") or ""),
                    str(action.get("category") or ""),
                    str(action.get("time_window") or ""),
                ],
            )
        )

    for window in work_analysis.get("time_windows", []):
        horizon = _map_action_horizon(str(window.get("window") or ""))
        buckets[horizon].append(
            _build_advisor_action_item(
                title=str(window.get("focus") or "Work window"),
                rationale=str(window.get("rationale") or ""),
                badges=[str(window.get("window") or "")],
            )
        )

    return {
        "mode": str(work_analysis.get("mode") or "actionable"),
        "now": buckets["now"],
        "today": buckets["today"],
        "next_3d": buckets["next_3d"],
    }


def _build_environment_tab_payload(
    *,
    dashboard: dict[str, Any],
) -> dict[str, Any]:
    current_data = _get_dashboard_context(dashboard, "currentData", "data") or {}
    recent_summary = _get_dashboard_context(dashboard, "recentSummary") or {}
    weather = _get_dashboard_context(dashboard, "weather") or {}
    rtr = _get_dashboard_context(dashboard, "rtr") or {}

    weather_current = weather.get("current", {}) if isinstance(weather, dict) else {}
    weather_daily = weather.get("daily", []) if isinstance(weather, dict) else []
    first_weather_day = weather_daily[0] if weather_daily else {}
    rtr_live = rtr.get("live", {}) if isinstance(rtr, dict) else {}
    rtr_forecast_targets = rtr.get("forecastTargets", []) if isinstance(rtr, dict) else []
    rtr_profile = rtr.get("profile", {}) if isinstance(rtr, dict) else {}
    recent_variables = recent_summary.get("variables", {}) if isinstance(recent_summary, dict) else {}

    temperature_c = _coerce_float(current_data.get("temperature"))
    humidity_pct = _coerce_float(current_data.get("humidity"))
    vpd_kpa = _coerce_float(current_data.get("vpd"))
    co2_ppm = _coerce_float(current_data.get("co2"))
    light_umol = _coerce_float(current_data.get("light"))
    cloud_cover_pct = _coerce_float(weather_current.get("cloud_cover_pct"))
    current_weather_label = weather_current.get("weather_label") or None
    target_temp_c = _coerce_float(rtr_live.get("targetTempC"))
    delta_temp_c = _coerce_float(rtr_live.get("deltaTempC"))
    balance_state = str(rtr_live.get("balanceState") or "unknown")
    tolerance_c = _coerce_float(rtr_profile.get("toleranceC")) or 1.0
    humidity_trend = (
        recent_variables.get("humidity", {}).get("trend")
        if isinstance(recent_variables.get("humidity"), dict)
        else None
    )
    vpd_trend = (
        recent_variables.get("vpd", {}).get("trend")
        if isinstance(recent_variables.get("vpd"), dict)
        else None
    )
    temperature_trend = (
        recent_variables.get("temperature", {}).get("trend")
        if isinstance(recent_variables.get("temperature"), dict)
        else None
    )
    precipitation_probability_pct = _coerce_float(
        first_weather_day.get("precipitation_probability_max_pct")
    )
    forecast_high_temp_c = _coerce_float(first_weather_day.get("temperature_max_c"))
    forecast_radiation_mj_m2 = _coerce_float(first_weather_day.get("shortwave_radiation_sum_mj_m2"))
    sunshine_hours = _coerce_float(first_weather_day.get("sunshine_duration_h"))

    diagnosis_parts: list[str] = []
    deviation_parts: list[str] = []
    cause_hypotheses: list[str] = []
    immediate_actions: list[dict[str, str]] = []
    today_steering: list[dict[str, str]] = []
    expected_effects: list[str] = []
    focus_areas: list[str] = []
    inside_signal_count = sum(
        1 for value in (temperature_c, humidity_pct, vpd_kpa) if value is not None
    )
    limited_monitoring_mode = inside_signal_count == 0
    has_rtr_gap = (
        balance_state in {"cool-for-light", "warm-for-light"}
        and delta_temp_c is not None
        and abs(delta_temp_c) > tolerance_c
    )

    if limited_monitoring_mode:
        diagnosis_parts.append("실내 환경 데이터 부족")
        deviation_parts.append(
            "실내 온도, 습도, VPD 데이터가 부족해 모니터링 우선 모드로 유지합니다."
        )
        cause_hypotheses.append(
            "현재 대시보드 데이터에는 자동 제어 판단에 필요한 실내 환경 신호가 충분하지 않습니다."
        )

    if (
        (humidity_pct is not None and humidity_pct >= 85)
        or (vpd_kpa is not None and vpd_kpa <= 0.4)
    ):
        focus_areas.append("humidity_control")
        diagnosis_parts.append("고습/저VPD 패턴")
        deviation_parts.append(
            f"{f'상대습도 {humidity_pct:.0f}%' if humidity_pct is not None else '상대습도 정보 없음'} 및 "
            f"{f'VPD {vpd_kpa:.2f} kPa' if vpd_kpa is not None else 'VPD 정보 없음'}로 결로·병해 리스크가 높습니다."
        )
        cause_hypotheses.append("실내 습기가 높고 잎 표면 건조 시간이 짧아질 가능성이 큽니다.")
        if humidity_trend == "up":
            cause_hypotheses.append("최근 습도 상승 추세가 이어져 야간과 이른 오전 구간의 습기 누적이 의심됩니다.")
        immediate_actions.append(
            _build_environment_action(
                title="제습 우선 제어",
                rationale="고습/저VPD는 결로와 병 발생 리스크를 동시에 밀어 올립니다.",
                operator="난방 설정온도를 약 +0.5°C 높이고 짧은 환기로 습기를 털어냅니다.",
                expected_effect="RH 피크를 낮추고 잎 표면 건조 시간을 확보합니다.",
                time_window="next_6h",
            )
        )
        expected_effects.append("결로 및 병압 완화")

    if (
        (vpd_kpa is not None and vpd_kpa >= 1.4)
        or (temperature_c is not None and temperature_c >= 29)
    ):
        focus_areas.append("heat_stress")
        diagnosis_parts.append("고온/고VPD 스트레스")
        deviation_parts.append(
            f"{f'실내 {temperature_c:.1f}°C' if temperature_c is not None else '실내 온도 정보 없음'}, "
            f"{f'VPD {vpd_kpa:.2f} kPa' if vpd_kpa is not None else 'VPD 정보 없음'}로 증산 과부하 가능성이 있습니다."
        )
        cause_hypotheses.append("과도한 일사 또는 환기 과강도로 체감 건조가 커졌을 가능성이 있습니다.")
        immediate_actions.append(
            _build_environment_action(
                title="냉방·가습 완충",
                rationale="고VPD가 지속되면 기공 반응과 수분 스트레스가 먼저 문제 됩니다.",
                operator="환기 과개방을 피하고 필요한 경우 차광/가습으로 VPD 급등을 완충합니다.",
                expected_effect="증산 스트레스를 줄이고 오후 광합성 저하를 완화합니다.",
                time_window="next_6h",
            )
        )
        expected_effects.append("수분 스트레스 완화")

    if (
        co2_ppm is not None
        and co2_ppm <= 500
        and light_umol is not None
        and light_umol >= 250
        and bool(weather_current.get("is_day"))
    ):
        focus_areas.append("co2_support")
        diagnosis_parts.append("주간 CO2 저하 신호")
        deviation_parts.append(f"광량 {light_umol:.0f} µmol m⁻² s⁻¹ 대비 CO2 {co2_ppm:.0f} ppm이 낮습니다.")
        cause_hypotheses.append("주간 동화 수요 대비 CO2 보강 여유가 부족했을 수 있습니다.")
        today_steering.append(
            _build_environment_action(
                title="주간 CO2 보강 유지",
                rationale="광이 있는 시간대의 저 CO2는 환경이 안정해 보여도 실제 동화량을 먼저 눌릴 수 있습니다.",
                operator="환기 개방 구간과 CO2 보강 지속시간을 같이 점검해 광이 있는 시간대의 CO2 저하를 줄입니다.",
                expected_effect="주간 탄소 확보력을 유지해 생장 속도와 품질 흔들림을 줄입니다.",
                time_window="next_24h",
            )
        )
        expected_effects.append("주간 동화 유지")

    if has_rtr_gap and balance_state == "cool-for-light":
        focus_areas.append("rtr_recovery")
        diagnosis_parts.append("RTR cool-for-light")
        if target_temp_c is not None and delta_temp_c is not None:
            deviation_parts.append(
                f"RTR target {target_temp_c:.1f}°C 대비 {abs(delta_temp_c):.1f}°C 낮아 평균온도 회복이 필요합니다."
            )
        cause_hypotheses.append("현재 광량 대비 평균온도가 낮아 생장 속도가 눌릴 수 있습니다.")
        today_steering.append(
            _build_environment_action(
                title="평균온도 방어",
                rationale="RTR 기준 평균온도가 낮으면 오늘 생육 속도가 밀릴 수 있습니다.",
                operator="과도한 냉방/환기를 줄이고 일사 구간의 목표온도 하단을 방어합니다.",
                expected_effect="RTR line에 다시 근접하도록 평균온도를 회복합니다.",
                time_window="next_24h",
            )
        )
        expected_effects.append("RTR 회복")
    elif has_rtr_gap and balance_state == "warm-for-light":
        focus_areas.append("rtr_balance")
        diagnosis_parts.append("RTR warm-for-light")
        if target_temp_c is not None and delta_temp_c is not None:
            deviation_parts.append(
                f"RTR 목표온도 {target_temp_c:.1f}°C 대비 {delta_temp_c:.1f}°C 높아 과열 완화가 필요합니다."
            )
        cause_hypotheses.append("광량 대비 평균온도가 높아 품질/에너지 효율이 나빠질 수 있습니다.")
        today_steering.append(
            _build_environment_action(
                title="평균온도 과상승 억제",
                rationale="RTR line 위쪽 과열은 품질/비용 양쪽을 악화시킬 수 있습니다.",
                operator="오후 과열 시간대의 환기·차광·야간 reset을 조정합니다.",
                expected_effect="평균온도를 RTR 허용대 안으로 되돌립니다.",
                time_window="next_24h",
            )
        )
        expected_effects.append("과열 및 비용 상승 억제")

    if precipitation_probability_pct is not None and precipitation_probability_pct >= 60:
        focus_areas.append("forecast_humidity")
        today_steering.append(
            _build_environment_action(
                title="흐림/강수 대비 습도 방어",
                rationale="흐린 날은 광량 저하와 외기 습도가 같이 들어와 제습 여유가 줄어듭니다.",
                operator="오전 광량이 있을 때 습도 정리를 먼저 하고, 늦은 시간 과도한 환기 의존을 피합니다.",
                expected_effect="흐린 날에도 습도 누적을 덜어냅니다.",
                time_window="next_24h",
            )
        )
    if forecast_high_temp_c is not None and forecast_high_temp_c >= 30:
        focus_areas.append("heat_preparation")
        today_steering.append(
            _build_environment_action(
                title="고온일 사전 준비",
                rationale="예상 최고기온이 높으면 오후 제어 마진이 빠르게 줄어듭니다.",
                operator="차광, 냉방, 관수 타이밍을 오전에 미리 정렬합니다.",
                expected_effect="고온 피크 구간에서 급격한 스트레스 상승을 완화합니다.",
                time_window="next_24h",
            )
        )

    if not diagnosis_parts:
        diagnosis_parts.append("대체로 안정")
        deviation_parts.append("현재 날씨, RTR, 실시간 데이터 기준 즉시 교정이 필요한 큰 편차는 제한적입니다.")
        cause_hypotheses.append("현재 구간은 모니터링 중심 제어가 적절합니다.")
        focus_areas.append("stability_watch")

    if not immediate_actions:
        immediate_actions.append(
            _build_environment_action(
                title="즉시 모니터링 유지",
                rationale="큰 이탈이 없을 때는 과조정보다 지속 관찰이 더 안전합니다.",
                operator="센서와 RTR 편차를 보며 setpoint 급변 없이 유지합니다.",
                expected_effect="불필요한 oscillation을 줄입니다.",
                time_window="next_6h",
            )
        )

    if not today_steering:
        today_steering.append(
            _build_environment_action(
                title="오늘 제어 유지",
                rationale="현재 문맥에서는 급격한 제어 변경보다 추세 감시가 우선입니다.",
                operator="RTR 목표 범위와 RH/VPD를 함께 보며 오늘 제어를 유지합니다.",
                expected_effect="안정 상태를 해치지 않고 미세 조정 여지만 남깁니다.",
                time_window="next_24h",
            )
        )

    three_day_plan: list[dict[str, str]] = []
    for index, target in enumerate(rtr_forecast_targets[:3]):
        weather_day = weather_daily[index] if index < len(weather_daily) else {}
        date_label = str(target.get("date") or weather_day.get("date") or f"day-{index + 1}")
        target_temp_value = _coerce_float(target.get("targetTempC"))
        radiation_value = _coerce_float(target.get("radiationSumMjM2D"))
        weather_label = str(target.get("weatherLabel") or weather_day.get("weather_label") or "예보")
        steering_title = (
            f"{date_label}: RTR {target_temp_value:.1f}°C 제어"
            if target_temp_value is not None
            else f"{date_label}: 환경 제어"
        )
        steering_rationale = (
            f"{weather_label} 예보와 일사 {radiation_value:.1f} MJ m⁻²를 기준으로 평균온도 제어를 맞춥니다."
            if radiation_value is not None
            else f"{weather_label} 예보 기준으로 평균온도 제어를 조정합니다."
        )
        three_day_plan.append(
            {
                "date": date_label,
                "title": steering_title,
                "rationale": steering_rationale,
            }
        )

    if not three_day_plan:
        three_day_plan.append(
            {
                "date": "next_3d",
                "title": "3일 기본 제어 유지",
                "rationale": "예보 목표가 부족해 현재 RTR와 실시간 추세를 기준으로 보수적으로 유지합니다.",
            }
        )

    monitoring_checklist = [
        "다음 6시간 RH/VPD 재상승 여부 확인",
        "RTR deltaTempC가 허용대 밖으로 더 벌어지는지 확인",
        "외기 강수/운량 변화 후 환기 전략이 과도하지 않은지 확인",
    ]
    if co2_ppm is not None and co2_ppm <= 500 and light_umol is not None and light_umol >= 250:
        monitoring_checklist.append("주간 저 CO2가 반복되는지 추가 확인")
    if limited_monitoring_mode:
        monitoring_checklist.insert(
            0,
            "자동 제어 전에 누락된 실내 온도, 습도, VPD 데이터를 먼저 복구합니다.",
        )

    urgency = "medium"
    if any(
        condition
        for condition in (
            humidity_pct is not None and humidity_pct >= 85,
            vpd_kpa is not None and vpd_kpa <= 0.4,
            vpd_kpa is not None and vpd_kpa >= 1.4,
            temperature_c is not None and temperature_c >= 29,
            has_rtr_gap,
        )
    ):
        urgency = "high"
    elif (
        precipitation_probability_pct is not None
        and precipitation_probability_pct >= 60
    ) or (
        forecast_high_temp_c is not None
        and forecast_high_temp_c >= 30
    ):
        urgency = "medium"
    else:
        urgency = "low"

    target_band = (
        f"{target_temp_c - tolerance_c:.1f} to {target_temp_c + tolerance_c:.1f}°C RTR band"
        if target_temp_c is not None
        else "RTR target band unavailable"
    )
    if limited_monitoring_mode:
        operating_mode = "monitoring-first"
        recovery_objective = "실내 기후 데이터를 복구한 뒤 자동 제어를 다시 시작합니다."
    elif "humidity_control" in focus_areas and "rtr_recovery" in focus_areas:
        operating_mode = "dehumidify-and-rtr-recovery"
        recovery_objective = "제습과 평균온도 회복을 동시에 맞춰 결로 리스크와 생장 지연을 함께 줄입니다."
    elif "humidity_control" in focus_areas:
        operating_mode = "dehumidify-first"
        recovery_objective = "결로·병압 리스크를 먼저 낮추고 잎 표면 건조 시간을 확보합니다."
    elif "heat_stress" in focus_areas and "heat_preparation" in focus_areas:
        operating_mode = "heat-buffering"
        recovery_objective = "오후 고온 피크 전에 VPD와 잎 온도 균형을 완충합니다."
    elif "heat_stress" in focus_areas:
        operating_mode = "transpiration-protection"
        recovery_objective = "과도한 건조와 증산 과부하를 먼저 낮춰 기공 반응을 보호합니다."
    elif "rtr_recovery" in focus_areas or "rtr_balance" in focus_areas:
        operating_mode = "rtr-recovery"
        recovery_objective = "RTR 허용 범위 안으로 평균온도를 다시 맞춰 오늘 생장 속도를 회복합니다."
    elif "co2_support" in focus_areas:
        operating_mode = "co2-recovery"
        recovery_objective = "광이 있는 시간대의 CO2 확보력을 높여 낮 시간 동화 여유를 복구합니다."
    else:
        operating_mode = "steady-state"
        recovery_objective = "큰 편차 없이 현재 제어 범위를 유지하면서 추세를 모니터링합니다."

    return {
        "mode": "monitoring-first" if limited_monitoring_mode else "actionable",
        "summary": (
            "환경 어드바이저가 실시간 계측, 날씨, RTR 문맥을 바탕으로 제어 방향을 정리했습니다."
            if not limited_monitoring_mode
            else "실내 기후 데이터가 부족해 환경 어드바이저를 모니터링 우선 상태로 유지합니다."
        ),
        "urgency": urgency,
        "confidence": _environment_context_completeness(dashboard),
        "focus_areas": list(dict.fromkeys(focus_areas)),
        "current_state": {
            "diagnosis": " / ".join(diagnosis_parts),
            "operating_mode": operating_mode,
            "recovery_objective": recovery_objective,
            "target_band": target_band,
            "deviation": " ".join(deviation_parts),
            "cause_hypotheses": cause_hypotheses,
            "risk_flags": (
                ["inside-climate-missing", *list(dict.fromkeys(focus_areas))]
                if limited_monitoring_mode
                else list(dict.fromkeys(focus_areas))
            ),
        },
        "immediate_actions": immediate_actions,
        "today_steering": today_steering,
        "three_day_plan": three_day_plan,
        "expected_effects": expected_effects or ["현재 제어 안정성 유지"],
        "monitoring_checklist": monitoring_checklist,
        "context_snapshot": {
            "inside_temp_c": temperature_c,
            "inside_humidity_pct": humidity_pct,
            "inside_vpd_kpa": vpd_kpa,
            "inside_co2_ppm": co2_ppm,
            "inside_light_umol_m2_s": light_umol,
            "outside_temp_c": _coerce_float(weather_current.get("temperature_c")),
            "outside_humidity_pct": _coerce_float(weather_current.get("relative_humidity_pct")),
            "outside_cloud_cover_pct": cloud_cover_pct,
            "current_weather_label": current_weather_label,
            "rtr_target_temp_c": target_temp_c,
            "rtr_delta_temp_c": delta_temp_c,
            "rtr_balance_state": balance_state,
            "temperature_trend": temperature_trend,
            "humidity_trend": humidity_trend,
            "vpd_trend": vpd_trend,
            "next_day_high_temp_c": forecast_high_temp_c,
            "next_day_precip_probability_pct": precipitation_probability_pct,
            "next_day_radiation_mj_m2": forecast_radiation_mj_m2,
            "next_day_sunshine_h": sunshine_hours,
        },
    }


def _build_physiology_tab_payload(
    *,
    crop: str,
    dashboard: dict[str, Any],
) -> dict[str, Any]:
    current_data = _get_dashboard_context(dashboard, "currentData", "data") or {}
    metrics = _get_dashboard_context(dashboard, "metrics") or {}
    growth_metrics = metrics.get("growth", {}) if isinstance(metrics, dict) else {}
    yield_metrics = metrics.get("yield", {}) if isinstance(metrics, dict) else {}
    recent_summary = _get_dashboard_context(dashboard, "recentSummary") or {}
    recent_variables = recent_summary.get("variables", {}) if isinstance(recent_summary, dict) else {}

    temperature_c = _coerce_float(current_data.get("temperature"))
    humidity_pct = _coerce_float(current_data.get("humidity"))
    canopy_temp_c = _coerce_float(current_data.get("canopyTemp"))
    canopy_air_delta_c = (
        canopy_temp_c - temperature_c
        if canopy_temp_c is not None and temperature_c is not None
        else None
    )
    vpd_kpa = _coerce_float(current_data.get("vpd"))
    transpiration_mm_h = _coerce_float(current_data.get("transpiration"))
    stomatal_conductance = _coerce_float(current_data.get("stomatalConductance"))
    photosynthesis_umol = _coerce_float(current_data.get("photosynthesis"))
    light_umol = _coerce_float(current_data.get("light"))
    co2_ppm = _coerce_float(current_data.get("co2"))
    lai = _coerce_float(growth_metrics.get("lai"))
    biomass_g_m2 = _coerce_float(growth_metrics.get("biomass"))
    growth_rate_g_m2_d = _coerce_float(growth_metrics.get("growthRate"))
    development_stage = str(growth_metrics.get("developmentStage") or "").strip() or None
    active_trusses_value = _coerce_float(growth_metrics.get("activeTrusses"))
    node_count_value = _coerce_float(growth_metrics.get("nodeCount"))
    active_trusses = int(active_trusses_value) if active_trusses_value is not None else None
    node_count = int(node_count_value) if node_count_value is not None else None
    harvestable_fruits_value = _coerce_float(yield_metrics.get("harvestableFruits"))
    harvestable_fruits = (
        int(harvestable_fruits_value)
        if harvestable_fruits_value is not None
        else None
    )
    predicted_weekly_yield_kg = _coerce_float(yield_metrics.get("predictedWeekly"))
    temperature_trend = (
        recent_variables.get("temperature", {}).get("trend")
        if isinstance(recent_variables.get("temperature"), dict)
        else None
    )
    vpd_trend = (
        recent_variables.get("vpd", {}).get("trend")
        if isinstance(recent_variables.get("vpd"), dict)
        else None
    )
    transpiration_trend = (
        recent_variables.get("transpiration", {}).get("trend")
        if isinstance(recent_variables.get("transpiration"), dict)
        else None
    )
    photosynthesis_trend = (
        recent_variables.get("photosynthesis", {}).get("trend")
        if isinstance(recent_variables.get("photosynthesis"), dict)
        else None
    )

    core_signal_count = sum(
        1
        for value in (
            temperature_c,
            canopy_temp_c,
            vpd_kpa,
            transpiration_mm_h,
            stomatal_conductance,
            photosynthesis_umol,
        )
        if value is not None
    )
    limited_monitoring_mode = core_signal_count < 3
    soft_canopy = any(
        condition
        for condition in (
            humidity_pct is not None and humidity_pct >= 85,
            vpd_kpa is not None and vpd_kpa <= 0.45,
            transpiration_mm_h is not None
            and transpiration_mm_h <= 0.12
            and light_umol is not None
            and light_umol >= 150,
        )
    )
    dry_stress = any(
        condition
        for condition in (
            vpd_kpa is not None and vpd_kpa >= 1.3,
            canopy_air_delta_c is not None and canopy_air_delta_c >= 1.0,
            stomatal_conductance is not None
            and stomatal_conductance <= 0.18
            and light_umol is not None
            and light_umol >= 250,
        )
    )
    carbon_limit = (
        photosynthesis_umol is not None
        and photosynthesis_umol <= 10
        and light_umol is not None
        and light_umol >= 250
    )
    balanced_assimilation = (
        photosynthesis_umol is not None
        and photosynthesis_umol >= 14
        and stomatal_conductance is not None
        and stomatal_conductance >= 0.22
        and vpd_kpa is not None
        and 0.5 <= vpd_kpa <= 1.1
    )

    balance_state = "balanced"
    diagnosis_parts: list[str] = []
    deviation_parts: list[str] = []
    cause_hypotheses: list[str] = []
    follow_up_actions: list[dict[str, str]] = []

    if limited_monitoring_mode:
        balance_state = "monitoring-first"
        diagnosis_parts.append("생리 데이터 부족")
        deviation_parts.append(
            "캐노피/증산/광합성 신호가 충분하지 않아 원인 해석보다 monitoring-first로 유지합니다."
        )
        cause_hypotheses.append(
            "현재 payload만으로는 생식/영양 균형이나 기공 반응을 안전하게 단정하기 어렵습니다."
        )
        follow_up_actions.append(
            _build_physiology_action(
                title="핵심 생리 데이터 복구",
                rationale="캐노피 온도, VPD, 증산, 기공, 광합성 신호가 있어야 physiology tab이 추론을 과장하지 않습니다.",
                operator="센서 연결과 최근 요약 집계를 먼저 확인한 뒤 advisor를 다시 실행합니다.",
                expected_effect="원인 설명과 균형 진단의 신뢰도를 높입니다.",
                time_window="next_6h",
            )
        )
    else:
        if dry_stress and carbon_limit:
            balance_state = "stress-watch"
        elif dry_stress:
            balance_state = "generative-leaning"
        elif soft_canopy:
            balance_state = "vegetative-leaning"
        elif balanced_assimilation:
            balance_state = "balanced"

        if soft_canopy:
            diagnosis_parts.append("연약/저증산 방향")
            deviation_parts.append(
                "낮은 VPD 또는 느린 증산 흐름으로 작물이 연약해지거나 웃자랄 수 있습니다."
            )
            cause_hypotheses.append(
                "오전 광량 대비 증산 회복이 늦으면 영양생장 쪽으로 기울면서 조직이 연해질 수 있습니다."
            )
            if vpd_trend == "down":
                cause_hypotheses.append(
                    "최근 요약 기준 VPD 하락 추세가 이어져 연약한 상태가 길어질 수 있습니다."
                )
            follow_up_actions.append(
                _build_physiology_action(
                    title="증산 회복 우선",
                    rationale="연약한 작물 상태는 착과, 건전성, 작업성 모두에 불리합니다.",
                    operator="오전 광이 있을 때 과도한 가습과 과한 급액을 피하고 VPD 회복 폭을 먼저 확인합니다.",
                    expected_effect="증산과 동화 균형을 회복해 canopy를 단단하게 유지합니다.",
                    time_window="next_6h",
                )
            )

        if dry_stress:
            diagnosis_parts.append("고VPD/캐노피 과열 방향")
            deviation_parts.append(
                "캐노피가 공기보다 더 뜨겁거나 VPD가 높아져 증산 과부하 쪽으로 기울고 있습니다."
            )
            cause_hypotheses.append(
                "오후 광량 피크, 과개방 환기, 또는 수분 공급 타이밍 불일치가 기공 반응을 압박할 수 있습니다."
            )
            if canopy_air_delta_c is not None and canopy_air_delta_c >= 1.0:
                cause_hypotheses.append(
                    "군락-실내 온도차가 커서 잎 온도 균형이 빡빡한 상태일 수 있습니다."
                )
            follow_up_actions.append(
                _build_physiology_action(
                    title="오후 수분 스트레스 완충",
                    rationale="과도한 건조·생식생장 제어는 착과 부담이 있을 때 동화 저하와 품질 변동으로 이어질 수 있습니다.",
                    operator="환기·차광·급액 타이밍을 함께 보며 VPD 급등과 캐노피 과열을 완충합니다.",
                    expected_effect="기공 닫힘과 광합성 저하를 줄여 생리적 흔들림을 낮춥니다.",
                    time_window="next_6h",
                )
            )

        if carbon_limit:
            diagnosis_parts.append("광 대비 동화 저하")
            deviation_parts.append(
                "광이 있는 시간대에도 광합성량이 낮아 탄소 확보 병목 가능성이 보입니다."
            )
            cause_hypotheses.append(
                "CO2 공급, 기공 반응, 군락 온도, 수분 상태 중 하나가 동화량을 제한할 수 있습니다."
            )
            if photosynthesis_trend == "down":
                cause_hypotheses.append(
                    "최근 요약에서 광합성 하락 추세가 이어지면 일시적 현상보다 반복 패턴일 가능성이 있습니다."
                )
            follow_up_actions.append(
                _build_physiology_action(
                    title="광·CO2 대비 동화 점검",
                    rationale="충분한 광량에서 동화량이 낮으면 생장 효율과 수확 흐름이 함께 흔들립니다.",
                    operator="주간 CO2 유지, 기공 반응, 캐노피 온도, 급액 타이밍을 같은 구간에서 같이 확인합니다.",
                    expected_effect="낮 시간 탄소 확보력을 회복해 생장 균형을 안정화합니다.",
                    time_window="today",
                )
            )

        if balanced_assimilation and not diagnosis_parts:
            diagnosis_parts.append("생리 균형 유지")
            deviation_parts.append(
                "현재 VPD, 기공전도도, 광합성 조합은 큰 흔들림 없이 유지되고 있습니다."
            )
            cause_hypotheses.append(
                "현재 구간은 과한 제어보다 추세 유지와 착과 부하 모니터링이 더 중요합니다."
            )

        if crop == "tomato":
            if active_trusses is not None and active_trusses >= 8:
                cause_hypotheses.append(
                    f"토마토 활성 화방 {active_trusses}개 구간은 이미 착과 부담이 커서 추가 건조 제어는 보수적으로 다뤄야 합니다."
                )
                crop_specific_context = (
                    f"토마토 활성 화방 {active_trusses}개와 수확 가능 과실 "
                    f"{harvestable_fruits if harvestable_fruits is not None else '정보 없음'}개가 보여 착과 부담 신호가 분명합니다."
                )
            elif active_trusses is not None:
                crop_specific_context = (
                    f"토마토 활성 화방 {active_trusses}개 기준으로 착과 부담은 보이지만, 생리 판단의 핵심은 VPD·증산·동화 흐름의 연속성입니다."
                )
            else:
                crop_specific_context = (
                    "토마토 착과 데이터가 제한적이므로 VPD·증산·광합성 흐름을 우선 기준으로 봅니다."
                )
        else:
            if node_count is not None and node_count >= 24:
                crop_specific_context = (
                    f"오이 마디 수 {node_count}개 구간은 초세 전개가 활발해 유인·적엽 리듬을 VPD·증산과 같이 맞춰야 합니다."
                )
            elif node_count is not None:
                crop_specific_context = (
                    f"오이 마디 수 {node_count}개 구간에서는 연약한 상태가 길어지면 절간과 엽 균형이 흐려질 수 있습니다."
                )
            else:
                crop_specific_context = (
                    "오이 마디 생장 데이터가 제한적이므로 군락 온도와 증산 회복 여부를 우선 지표로 씁니다."
                )

        if not follow_up_actions:
            follow_up_actions.append(
                _build_physiology_action(
                    title="현재 균형 유지",
                    rationale="명확한 과조정 신호가 없을 때는 추세 유지가 가장 안전합니다.",
                    operator="VPD, 증산, 광합성, 착과 부하를 함께 보며 급격한 제어는 피합니다.",
                    expected_effect="생식/영양 균형을 해치지 않고 현재 생리 상태를 유지합니다.",
                    time_window="today",
                )
            )

    if limited_monitoring_mode:
        crop_specific_context = (
            "Crop-specific physiology interpretation is deferred until canopy, gas-exchange, and growth signals are populated."
        )

    supporting_signals: list[dict[str, str]] = []
    if vpd_kpa is not None:
        supporting_signals.append(
            _build_supporting_signal(
                "VPD",
                f"{vpd_kpa:.2f} kPa",
                (
                    "증산 요구가 낮아 작물이 연약해질 수 있습니다."
                    if vpd_kpa <= 0.45
                    else "증산 요구가 높아 수분 스트레스 쪽을 확인해야 합니다."
                    if vpd_kpa >= 1.3
                    else "VPD는 생리 제어 범위 안에 있습니다."
                ),
            )
        )
    if canopy_air_delta_c is not None:
        supporting_signals.append(
            _build_supporting_signal(
                "군락-실내 온도차",
                f"{canopy_air_delta_c:.1f} °C",
                (
                    "군락 온도가 더 높아 잎 온도 부담이 있습니다."
                    if canopy_air_delta_c >= 1.0
                    else "캐노피와 공기 온도 차가 과도하지 않습니다."
                ),
            )
        )
    if transpiration_mm_h is not None:
        supporting_signals.append(
            _build_supporting_signal(
                "증산",
                f"{transpiration_mm_h:.2f} mm h⁻¹",
                (
                    "낮 시간 기준 증산 회복이 느린 편입니다."
                    if transpiration_mm_h <= 0.12
                    else "증산 흐름이 살아 있습니다."
                ),
            )
        )
    if stomatal_conductance is not None:
        supporting_signals.append(
            _build_supporting_signal(
                "기공전도도",
                f"{stomatal_conductance:.2f} mol m⁻² s⁻¹",
                (
                    "기공 반응이 조여진 상태라 동화 제한 가능성을 봐야 합니다."
                    if stomatal_conductance <= 0.18
                    else "기공 개방은 크게 막히지 않은 상태입니다."
                ),
            )
        )
    if photosynthesis_umol is not None:
        supporting_signals.append(
            _build_supporting_signal(
                "광합성",
                f"{photosynthesis_umol:.1f} µmol m⁻² s⁻¹",
                (
                    "광 대비 동화가 다소 눌려 있을 수 있습니다."
                    if carbon_limit
                    else "탄소 획득 흐름은 유지되는 편입니다."
                ),
            )
        )
    if crop == "tomato" and active_trusses is not None:
        supporting_signals.append(
            _build_supporting_signal(
                "활성 화방",
                str(active_trusses),
                "착과 부담 신호입니다. 기후 제어가 과도하면 비대와 착과 변동성이 커질 수 있습니다.",
            )
        )
    if crop == "cucumber" and node_count is not None:
        supporting_signals.append(
            _build_supporting_signal(
                "마디 수",
                str(node_count),
                "마디 생장 속도를 유인과 적엽 리듬과 함께 봐야 합니다.",
            )
        )

    urgency = "low"
    if limited_monitoring_mode:
        urgency = "low"
    elif dry_stress or carbon_limit:
        urgency = "high"
    elif soft_canopy or transpiration_trend == "down" or photosynthesis_trend == "down":
        urgency = "medium"

    monitoring_checklist = [
        "다음 실행에서도 VPD-증산-광합성이 같은 방향으로 움직이는지 확인",
        "군락-실내 온도차가 더 벌어지거나 연약한 상태가 길어지는지 확인",
        "즉시 조치 후 착과 부담 또는 마디 생장 속도가 흔들리지 않는지 확인",
    ]
    if limited_monitoring_mode:
        monitoring_checklist.insert(
            0,
            "원인 진단 전에 군락 온도, 증산, 기공전도도, 광합성 데이터를 먼저 복구합니다.",
        )
    elif crop == "tomato":
        monitoring_checklist.append("활성 화방과 수확 가능 과실이 늘 때 과도한 건조 제어가 없는지 확인")
    else:
        monitoring_checklist.append("마디 수가 늘어나는 구간에서 유인·적엽 리듬이 증산 회복을 해치지 않는지 확인")

    if not diagnosis_parts:
        diagnosis_parts.append("추세 모니터링 중심")
        deviation_parts.append("현재 physiology context에서 즉시 강한 교정이 필요한 편차는 제한적입니다.")
        cause_hypotheses.append("현재 구간은 착과 부하와 가스교환 추세를 함께 보는 편이 안전합니다.")

    return {
        "summary": (
            "생리 어드바이저가 실시간 기후, 가스교환, 생장 신호를 바탕으로 작물 균형을 해석했습니다."
            if not limited_monitoring_mode
            else "작물 생리 데이터가 부족해 생리 어드바이저를 모니터링 우선 상태로 유지합니다."
        ),
        "urgency": urgency,
        "confidence": _physiology_context_completeness(dashboard),
        "current_state": {
            "diagnosis": " / ".join(diagnosis_parts),
            "balance_state": balance_state,
            "deviation": " ".join(deviation_parts),
            "cause_hypotheses": cause_hypotheses,
            "crop_specific_context": crop_specific_context,
        },
        "supporting_signals": supporting_signals,
        "follow_up_actions": follow_up_actions[:3],
        "monitoring_checklist": monitoring_checklist,
        "context_snapshot": {
            "inside_temp_c": temperature_c,
            "inside_humidity_pct": humidity_pct,
            "canopy_temp_c": canopy_temp_c,
            "canopy_air_delta_c": canopy_air_delta_c,
            "inside_vpd_kpa": vpd_kpa,
            "transpiration_mm_h": transpiration_mm_h,
            "stomatal_conductance_mol_m2_s": stomatal_conductance,
            "photosynthesis_umol_m2_s": photosynthesis_umol,
            "inside_co2_ppm": co2_ppm,
            "inside_light_umol_m2_s": light_umol,
            "lai": lai,
            "biomass_g_m2": biomass_g_m2,
            "growth_rate_g_m2_d": growth_rate_g_m2_d,
            "development_stage": development_stage,
            "active_trusses": active_trusses,
            "node_count": node_count,
            "harvestable_fruits": harvestable_fruits,
            "predicted_weekly_yield_kg": predicted_weekly_yield_kg,
            "temperature_trend": temperature_trend,
            "vpd_trend": vpd_trend,
            "transpiration_trend": transpiration_trend,
            "photosynthesis_trend": photosynthesis_trend,
        },
    }


def _work_event_compare_candidates_legacy(
    *,
    crop: str,
    baseline_snapshot_record: dict[str, Any],
    recent_events: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    state = _coerce_dict(
        _coerce_dict(baseline_snapshot_record.get("normalized_snapshot")).get("state")
    )
    candidates: list[dict[str, Any]] = []

    if crop == "tomato":
        active_cohort = next(
            (
                cohort
                for cohort in state.get("truss_cohorts", [])
                if isinstance(cohort, dict)
                and cohort.get("active")
                and _safe_int(cohort.get("n_fruits")) > 0
            ),
            None,
        )
        current_fruits = (
            _safe_int(active_cohort.get("n_fruits"))
            if active_cohort
            else _safe_int(state.get("fruit_load"))
        )
        candidates.append(
            {
                "comparison_kind": "maintain",
                "action": "현재 착과수 유지",
                "event_type": None,
                "event_payload": None,
                "operator_note": "현재 착과수를 그대로 유지하며 baseline을 비교합니다.",
            }
        )
        if active_cohort and current_fruits > 1:
            candidates.append(
                {
                    "comparison_kind": "candidate_event",
                    "action": "1과 감과",
                    "event_type": "fruit_thinning",
                    "event_payload": {
                        "event_type": "fruit_thinning",
                        "cohort_id": _safe_int(active_cohort.get("cohort_id")),
                        "fruits_removed_count": 1,
                        "target_fruits_per_truss": current_fruits - 1,
                        "reason_code": "issue21_work_event_compare",
                        "operator": "advisor",
                        "confidence": 0.72 if recent_events else 0.6,
                    },
                    "operator_note": "현재 활성 화방에서 1과 감과했을 때의 replay diff를 비교합니다.",
                }
            )
        candidates.append(
            {
                "comparison_kind": "defer",
                "action": "감과 보류",
                "event_type": None,
                "event_payload": None,
                "operator_note": "다음 화방 상태가 더 선명해질 때까지 즉시 감과를 보류합니다.",
            }
        )
        return candidates

    current_leaf_count = _safe_int(state.get("leaf_count"))
    recent_leaf_event = next(
        (event for event in recent_events if event.get("event_type") == "leaf_removal"),
        None,
    )
    default_removed_count = _safe_int(
        _coerce_dict((recent_leaf_event or {}).get("payload")).get("leaves_removed_count"),
        default=2,
    )
    default_removed_count = max(1, min(default_removed_count, 3))
    candidates.append(
        {
            "comparison_kind": "maintain",
            "action": "유지",
            "event_type": None,
            "event_payload": None,
            "operator_note": "현재 엽수를 유지하며 baseline을 비교합니다.",
        }
    )
    target_leaf_count = max(15, current_leaf_count - default_removed_count)
    if target_leaf_count < current_leaf_count:
        candidates.append(
            {
                "comparison_kind": "candidate_event",
                "action": f"하위엽 {current_leaf_count - target_leaf_count}매 제거",
                "event_type": "leaf_removal",
                "event_payload": {
                    "event_type": "leaf_removal",
                    "leaves_removed_count": current_leaf_count - target_leaf_count,
                    "target_leaf_count": target_leaf_count,
                    "reason_code": "issue21_work_event_compare",
                    "operator": "advisor",
                    "confidence": 0.72 if recent_events else 0.6,
                },
                "operator_note": "현재 상태에서 소폭 적엽했을 때의 replay diff를 비교합니다.",
            }
        )
    candidates.append(
        {
            "comparison_kind": "defer",
            "action": "적엽 보류",
            "event_type": None,
            "event_payload": None,
            "operator_note": "다음 작업창까지 적엽을 보류하고 광/부하 변화를 더 지켜봅니다.",
        }
    )
    return candidates


def _work_event_compare_state_balance(state: dict[str, Any]) -> float:
    source_capacity = _coerce_float(state.get("source_capacity")) or 0.0
    sink_demand = _coerce_float(state.get("sink_demand")) or 0.0
    if source_capacity <= 0.0 and sink_demand <= 0.0:
        return 0.0
    return (source_capacity - sink_demand) / max(1.0, source_capacity + sink_demand)


def _tomato_sink_overload_score(
    state: dict[str, Any],
    active_cohort: dict[str, Any] | None,
) -> float:
    fruit_load = _coerce_float(state.get("fruit_load")) or 0.0
    fruit_partition_ratio = _coerce_float(state.get("current_fruit_partition_ratio")) or 0.0
    source_sink_balance = _work_event_compare_state_balance(state)
    active_fruits = _safe_int((active_cohort or {}).get("n_fruits"), default=_safe_int(fruit_load))
    return round(
        _clamp(
            (0.35 * _clamp((fruit_load - 9.0) / 6.0, 0.0, 1.0))
            + (0.25 * _clamp((fruit_partition_ratio - 0.42) / 0.2, 0.0, 1.0))
            + (0.25 * _clamp((-source_sink_balance) / 0.25, 0.0, 1.0))
            + (0.15 * _clamp((active_fruits - 4.0) / 2.0, 0.0, 1.0)),
            0.0,
            1.0,
        ),
        6,
    )


def _work_event_compare_candidates(
    *,
    crop: str,
    baseline_snapshot_record: dict[str, Any],
    recent_events: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    state = _coerce_dict(
        _coerce_dict(baseline_snapshot_record.get("normalized_snapshot")).get("state")
    )
    candidates: list[dict[str, Any]] = []

    if crop == "tomato":
        active_cohorts = sorted(
            [
                cohort
                for cohort in state.get("truss_cohorts", [])
                if isinstance(cohort, dict)
                and cohort.get("active")
                and _safe_int(cohort.get("n_fruits")) > 0
            ],
            key=lambda cohort: (
                _safe_int(cohort.get("n_fruits")),
                _coerce_float(cohort.get("tdvs")) or 0.0,
            ),
            reverse=True,
        )
        active_cohort = active_cohorts[0] if active_cohorts else None
        current_fruits = (
            _safe_int(active_cohort.get("n_fruits"))
            if active_cohort
            else _safe_int(state.get("fruit_load"))
        )
        sink_overload_score = _tomato_sink_overload_score(state, active_cohort)
        candidates.append(
            {
                "comparison_kind": "maintain",
                "action": "\ud604\uc7ac \ucc29\uacfc\uc218 \uc720\uc9c0",
                "event_type": None,
                "event_payload": None,
                "operator_note": "\ud604\uc7ac \ud654\ubc29 \ucc29\uacfc\uc218\ub97c \uadf8\ub300\ub85c \ub450\uace0 baseline\uacfc \ube44\uad50\ud569\ub2c8\ub2e4.",
                "agronomy_flags": ["sink-overload-high"] if sink_overload_score >= 0.58 else ["sink-overload-low"],
            }
        )
        if active_cohort and current_fruits > 1:
            candidates.append(
                {
                    "comparison_kind": "candidate_event",
                    "action": "1\uacfc \uac10\uacfc",
                    "event_type": "fruit_thinning",
                    "event_payload": {
                        "event_type": "fruit_thinning",
                        "cohort_id": _safe_int(active_cohort.get("cohort_id")),
                        "fruits_removed_count": 1,
                        "target_fruits_per_truss": current_fruits - 1,
                        "reason_code": "issue21_work_event_compare",
                        "operator": "advisor",
                        "confidence": 0.74 if recent_events else 0.62,
                    },
                    "operator_note": (
                        "\ud604\uc7ac \ud654\ubc29 sink overload \uc644\ud654\ub97c \uc704\ud574 1\uacfc \uac10\uacfc replay diff\ub97c \ube44\uad50\ud569\ub2c8\ub2e4."
                        if sink_overload_score >= 0.5
                        else "\uc989\uc2dc \uac10\uacfc\ubcf4\ub2e4 \ub2e4\uc74c \ud654\ubc29 \uc870\uc815\uc774 \uc720\ub825\ud55c \uc0c1\ud0dc\uc5d0\uc11c 1\uacfc \uac10\uacfc \uc2dc\ub098\ub9ac\uc624\ub97c \ube44\uad50\ud569\ub2c8\ub2e4."
                    ),
                    "agronomy_flags": (
                        ["sink-overload-high", "active-cohort-priority"]
                        if sink_overload_score >= 0.5
                        else ["sink-overload-low", "thin-too-early-risk"]
                    ),
                }
            )
        candidates.append(
            {
                "comparison_kind": "planning_adjustment",
                "action": "\ub2e4\uc74c \ud654\ubc29\uc5d0\uc11c \uc870\uc815",
                "event_type": None,
                "event_payload": None,
                "operator_note": "\uc9c0\uae08 \ud654\ubc29\ubcf4\ub2e4 \ub2e4\uc74c \ud654\ubc29\uc5d0\uc11c \ucc29\uacfc\uc218\ub97c \ub2e4\uc2dc \ub9de\ucd94\ub294 planning option\uc785\ub2c8\ub2e4.",
                "agronomy_flags": ["next-truss-adjust"],
            }
        )
        candidates.append(
            {
                "comparison_kind": "defer",
                "action": "\uac10\uacfc \ubcf4\ub958",
                "event_type": None,
                "event_payload": None,
                "operator_note": "\ub2e4\uc74c \ud654\ubc29 \uc0c1\ud0dc\uac00 \ub354 \uc120\uba85\ud574\uc9c8 \ub54c\uae4c\uc9c0 \uc989\uc2dc \uac10\uacfc\ub97c \ubcf4\ub958\ud569\ub2c8\ub2e4.",
                "agronomy_flags": ["defer-and-monitor"],
            }
        )
        return candidates

    current_leaf_count = _safe_int(state.get("leaf_count"))
    recent_leaf_event = next(
        (event for event in recent_events if event.get("event_type") == "leaf_removal"),
        None,
    )
    recent_removed_count = _safe_int(
        _coerce_dict((recent_leaf_event or {}).get("payload")).get("leaves_removed_count"),
        default=2,
    )
    recent_removed_count = max(1, min(recent_removed_count, 3))
    removable_leaves = max(0, current_leaf_count - 15)
    lai = _coerce_float(state.get("lai")) or 0.0
    fruit_load = _coerce_float(state.get("fruit_load")) or 0.0
    bottom_leaf_activity = _coerce_float(state.get("bottom_leaf_activity")) or 0.0
    source_sink_balance = _work_event_compare_state_balance(state)
    source_limited = source_sink_balance <= -0.08
    dense_canopy = current_leaf_count >= 18 or lai >= 1.45
    lower_canopy_shaded = bottom_leaf_activity <= 0.18
    fruit_pressure = fruit_load >= 14.0

    candidates.append(
        {
            "comparison_kind": "maintain",
            "action": "\uc720\uc9c0",
            "event_type": None,
            "event_payload": None,
            "operator_note": "\ud604\uc7ac \uc5fd\uc218\ub97c \uc720\uc9c0\ud558\uace0 baseline\uacfc \ube44\uad50\ud569\ub2c8\ub2e4.",
            "agronomy_flags": ["source-protection"] if source_limited or fruit_pressure else ["steady-canopy"],
        }
    )

    mild_removed_count = 0
    if removable_leaves > 0:
        mild_removed_count = 2 if dense_canopy and lower_canopy_shaded and removable_leaves >= 2 else 1
        if source_limited or fruit_pressure:
            mild_removed_count = min(mild_removed_count, 1)
        if recent_removed_count >= 2 and removable_leaves >= 2 and not source_limited:
            mild_removed_count = max(mild_removed_count, 2)
        mild_removed_count = min(mild_removed_count, removable_leaves)

    aggressive_removed_count = 0
    if removable_leaves >= 2 and dense_canopy and lower_canopy_shaded:
        aggressive_removed_count = min(removable_leaves, max(mild_removed_count + 1, 2))
        if source_limited or fruit_pressure:
            aggressive_removed_count = min(aggressive_removed_count, 2)
        if aggressive_removed_count <= mild_removed_count:
            aggressive_removed_count = 0

    if mild_removed_count > 0:
        candidates.append(
            {
                "comparison_kind": "candidate_event",
                "action": f"\ud558\uc704\uc5fd {mild_removed_count}\ub9e4 \uc81c\uac70",
                "event_type": "leaf_removal",
                "event_payload": {
                    "event_type": "leaf_removal",
                    "leaves_removed_count": mild_removed_count,
                    "target_leaf_count": current_leaf_count - mild_removed_count,
                    "reason_code": "issue21_work_event_compare",
                    "operator": "advisor",
                    "confidence": 0.74 if recent_events else 0.62,
                },
                "operator_note": (
                    "\ud558\uc5fd \uc74c\uc601\uc740 \ud06c\uc9c0\ub9cc source \uc5ec\uc720\uac00 \uc801\uc5b4 \uc18c\ud3ed \uc801\uc5fd\ub9cc \ube44\uad50\ud569\ub2c8\ub2e4."
                    if source_limited or fruit_pressure
                    else "\ud558\uc5fd \uc74c\uc601 \uc644\ud654\uc640 canopy \uc815\ub9ac\ub97c \uc704\ud55c \uc18c\ud3ed \uc801\uc5fd \uc2dc\ub098\ub9ac\uc624\uc785\ub2c8\ub2e4."
                ),
                "agronomy_flags": (
                    ["lower-canopy-shade", "source-limited"]
                    if source_limited or fruit_pressure
                    else ["lower-canopy-shade", "mild-defoliation"]
                ),
            }
        )
    if aggressive_removed_count > 0:
        candidates.append(
            {
                "comparison_kind": "candidate_event",
                "action": f"\ud558\uc704\uc5fd {aggressive_removed_count}\ub9e4 \uc81c\uac70",
                "event_type": "leaf_removal",
                "event_payload": {
                    "event_type": "leaf_removal",
                    "leaves_removed_count": aggressive_removed_count,
                    "target_leaf_count": current_leaf_count - aggressive_removed_count,
                    "reason_code": "issue21_work_event_compare",
                    "operator": "advisor",
                    "confidence": 0.68 if recent_events else 0.56,
                },
                "operator_note": "\uc5fd\uc218\uac00 \ucda9\ubd84\ud558\uace0 \ud558\uc5fd \uae30\uc5ec\uac00 \ub0ae\uc740 \uacbd\uc6b0\uc758 \uac15\ud55c \uc801\uc5fd \ube44\uad50 \uc2dc\ub098\ub9ac\uc624\uc785\ub2c8\ub2e4.",
                "agronomy_flags": ["lower-canopy-shade", "aggressive-defoliation"],
            }
        )
    candidates.append(
        {
            "comparison_kind": "defer",
            "action": "\uc801\uc5fd \ubcf4\ub958",
            "event_type": None,
            "event_payload": None,
            "operator_note": "\ub2e4\uc74c \uc791\uc5c5 \ucc3d\uae4c\uc9c0 \uc801\uc5fd\uc744 \ubcf4\ub958\ud558\uace0 \uad00\ubd80\ud558 \ubcc0\ud654\ub97c \ub354 \uc9c0\ucf1c\ubd05\ub2c8\ub2e4.",
            "agronomy_flags": ["defer-and-monitor"],
        }
    )
    return candidates


def _build_work_event_state_delta(
    *,
    crop: str,
    baseline_snapshot_record: dict[str, Any],
    candidate_snapshot_record: dict[str, Any],
) -> dict[str, Any]:
    baseline_state = baseline_snapshot_record.get("normalized_snapshot", {}).get("state", {})
    candidate_state = candidate_snapshot_record.get("normalized_snapshot", {}).get("state", {})
    if crop == "tomato":
        return {
            "fruit_load_delta": round(
                float(candidate_state.get("fruit_load", 0.0))
                - float(baseline_state.get("fruit_load", 0.0)),
                6,
            ),
            "sink_demand_delta": round(
                float(candidate_state.get("sink_demand", 0.0))
                - float(baseline_state.get("sink_demand", 0.0)),
                6,
            ),
            "fruit_partition_ratio_delta": round(
                float(candidate_state.get("current_fruit_partition_ratio", 0.0))
                - float(baseline_state.get("current_fruit_partition_ratio", 0.0)),
                6,
            ),
            "source_capacity_delta": round(
                float(candidate_state.get("source_capacity", 0.0))
                - float(baseline_state.get("source_capacity", 0.0)),
                6,
            ),
        }
    return {
        "leaf_count_delta": round(
            float(candidate_state.get("leaf_count", 0.0))
            - float(baseline_state.get("leaf_count", 0.0)),
            6,
        ),
        "lai_delta": round(
            float(candidate_state.get("lai", 0.0))
            - float(baseline_state.get("lai", 0.0)),
            6,
        ),
        "source_capacity_delta": round(
            float(candidate_state.get("source_capacity", 0.0))
            - float(baseline_state.get("source_capacity", 0.0)),
            6,
        ),
        "sink_demand_delta": round(
            float(candidate_state.get("sink_demand", 0.0))
            - float(baseline_state.get("sink_demand", 0.0)),
            6,
        ),
    }


def _score_work_event_option(
    *,
    crop: str,
    baseline_state: dict[str, Any],
    option: dict[str, Any],
    baseline_72h: dict[str, Any],
    baseline_168h: dict[str, Any],
    baseline_336h: dict[str, Any],
    scenario_72h: dict[str, Any],
    scenario_168h: dict[str, Any],
    scenario_336h: dict[str, Any],
    penalties: dict[str, Any],
    confidence: float,
) -> float:
    score = _score_runtime_option(
        baseline_72h=baseline_72h,
        baseline_168h=baseline_168h,
        baseline_336h=baseline_336h,
        scenario_72h=scenario_72h,
        scenario_168h=scenario_168h,
        scenario_336h=scenario_336h,
        penalties=penalties,
        confidence=confidence,
    )
    kind = str(option.get("comparison_kind") or "")
    immediate_delta = _coerce_dict(option.get("immediate_state_delta"))
    source_sink_balance = _work_event_compare_state_balance(baseline_state)
    has_high_violation = any(
        violation.get("severity") == "high"
        for violation in option.get("violated_constraints", [])
    )
    if has_high_violation:
        score -= 0.2

    if crop == "tomato":
        active_cohort = next(
            (
                cohort
                for cohort in baseline_state.get("truss_cohorts", [])
                if isinstance(cohort, dict)
                and cohort.get("active")
                and _safe_int(cohort.get("n_fruits")) > 0
            ),
            None,
        )
        sink_overload_score = _tomato_sink_overload_score(baseline_state, active_cohort)
        fruit_load = _coerce_float(baseline_state.get("fruit_load")) or 0.0
        fruit_load_after = fruit_load + (_coerce_float(immediate_delta.get("fruit_load_delta")) or 0.0)
        if kind == "candidate_event":
            score += 0.09 * sink_overload_score
            if sink_overload_score <= 0.28:
                score -= 0.18
            if fruit_load_after < 3.0:
                score -= 0.14
        elif kind == "planning_adjustment":
            if sink_overload_score < 0.5:
                score += 0.06
        elif kind == "maintain":
            score += 0.04 if sink_overload_score < 0.35 else -(0.01 * sink_overload_score)
    else:
        leaf_count = _safe_int(baseline_state.get("leaf_count"))
        fruit_load = _coerce_float(baseline_state.get("fruit_load")) or 0.0
        lai = _coerce_float(baseline_state.get("lai")) or 0.0
        bottom_leaf_activity = _coerce_float(baseline_state.get("bottom_leaf_activity")) or 0.0
        leaf_count_after = leaf_count + _safe_int(immediate_delta.get("leaf_count_delta"))
        if kind == "candidate_event":
            if leaf_count_after < 15:
                score -= 0.45
            elif leaf_count_after == 15:
                score -= 0.12
            if bottom_leaf_activity <= 0.18 and lai >= 1.45:
                score += 0.06
            if source_sink_balance <= -0.08 and (
                (_coerce_float(option.get("expected_canopy_a_delta_72h")) or 0.0) < 0.0
            ):
                score -= 0.16
            if fruit_load >= 14.0 and leaf_count_after <= 16:
                score -= 0.08
        elif kind == "maintain":
            if source_sink_balance <= -0.08 or fruit_load >= 14.0:
                score += 0.05
        elif kind == "defer":
            score -= 0.03

    return round(score, 6)


def _select_work_event_recommendation(options: list[dict[str, Any]]) -> dict[str, Any] | None:
    if not options:
        return None

    kind_preference = {
        "candidate_event": 3,
        "maintain": 2,
        "planning_adjustment": 1,
        "defer": 0,
    }
    viable = [
        option
        for option in options
        if not any(
            violation.get("severity") == "high"
            for violation in option.get("violated_constraints", [])
        )
    ]
    ranked = viable or options
    return max(
        ranked,
        key=lambda option: (
            float(option.get("ranking_score") or float("-inf")),
            float(option.get("expected_yield_delta_14d") or 0.0),
            float(option.get("expected_source_sink_balance_delta") or 0.0),
            kind_preference.get(str(option.get("comparison_kind") or ""), -1),
        ),
    )

def _build_work_event_compare_payload(
    crop: str,
    greenhouse_id: Optional[str] = None,
) -> dict[str, Any]:
    resolved_greenhouse_id = greenhouse_id or crop
    history: list[dict[str, Any]] = []
    recent_events: list[dict[str, Any]] = []
    baseline_snapshot_record: dict[str, Any] | None = None
    baseline_snapshot_id: str | None = None

    try:
        store = ModelStateStore()
        current_state = store.load_current_state(resolved_greenhouse_id, crop)
        recent_events = store.list_work_events(resolved_greenhouse_id, crop, limit=3)
        history = _summarize_work_event_history(recent_events)

        if current_state:
            baseline_snapshot_record = store.load_snapshot(str(current_state["latest_snapshot_id"]))
        if baseline_snapshot_record is None:
            baseline_snapshot_record = store.latest_snapshot(resolved_greenhouse_id, crop)
    except Exception as exc:
        logger.warning(
            "Work-event compare store access degraded for greenhouse=%s crop=%s: %s",
            resolved_greenhouse_id,
            crop,
            exc,
        )
        return {
            "payload": _build_unavailable_work_event_compare_payload(
                reason="저장된 작업 비교 기록을 불러오지 못해 작업 이벤트 비교를 잠시 중단했습니다.",
                history=history,
            ),
            "internal_provenance": {
                "status": "store-unavailable",
                "greenhouse_id": resolved_greenhouse_id,
                "history_event_ids": [event.get("event_id") for event in recent_events],
                "baseline_snapshot_id": None,
            },
        }

    if baseline_snapshot_record is None:
        return {
            "payload": _build_unavailable_work_event_compare_payload(
                reason="저장된 기준 상태가 없어 작업 이벤트 비교를 만들 수 없습니다. 먼저 기준 상태를 저장해 주세요.",
                history=history,
            ),
            "internal_provenance": {
                "status": "history-unavailable",
                "greenhouse_id": resolved_greenhouse_id,
                "history_event_ids": [event.get("event_id") for event in recent_events],
                "baseline_snapshot_id": None,
            },
        }

    try:
        baseline_scenario = run_bounded_scenario(
            baseline_snapshot_record,
            controls={},
            horizons_hours=list(_WORK_EVENT_COMPARE_HORIZONS_HOURS),
        )
        baseline_72h = _scenario_row_by_horizon(baseline_scenario.get("baseline_outputs", []), 72)
        baseline_168h = _scenario_row_by_horizon(
            baseline_scenario.get("baseline_outputs", []),
            168,
        )
        baseline_336h = _scenario_row_by_horizon(
            baseline_scenario.get("baseline_outputs", []),
            336,
        )

        compare_options: list[dict[str, Any]] = []
        option_provenance: list[dict[str, Any]] = []
        baseline_snapshot_id = str(baseline_snapshot_record.get("snapshot_id") or "")
        baseline_snapshot_time = _parse_runtime_datetime(
            baseline_snapshot_record.get("snapshot_time")
            or baseline_snapshot_record.get("captured_at")
        )

        for index, candidate in enumerate(
            _work_event_compare_candidates(
                crop=crop,
                baseline_snapshot_record=baseline_snapshot_record,
                recent_events=recent_events,
            )
        ):
            event_payload = candidate.get("event_payload")
            candidate_snapshot_record = baseline_snapshot_record
            event_effect: dict[str, Any] | None = None
            scenario_payload = baseline_scenario

            if event_payload:
                adapter = _clone_compare_adapter_from_raw_state(
                    crop,
                    baseline_snapshot_record["raw_adapter_state"],
                )
                if crop == "tomato":
                    from .crop_models.tomato_growth_model import apply_tomato_work_event

                    event_effect = apply_tomato_work_event(adapter, event_payload)
                else:
                    from .crop_models.cucumber_growth_model import apply_cucumber_work_event

                    event_effect = apply_cucumber_work_event(adapter, event_payload)

                candidate_snapshot_record = _build_compare_snapshot_record(
                    crop=crop,
                    greenhouse_id=resolved_greenhouse_id,
                    adapter=adapter,
                    snapshot_time=baseline_snapshot_time,
                    snapshot_id=f"{baseline_snapshot_id or crop}-candidate-{index}",
                    source=f"work_event_compare:{candidate['comparison_kind']}",
                    metadata={
                        "synthetic_work_event_compare": True,
                        "baseline_snapshot_id": baseline_snapshot_id,
                    },
                )
                scenario_payload = run_bounded_scenario(
                    candidate_snapshot_record,
                    controls={},
                    horizons_hours=list(_WORK_EVENT_COMPARE_HORIZONS_HOURS),
                )

            scenario_72h = _scenario_row_by_horizon(
                scenario_payload.get("baseline_outputs", []),
                72,
            )
            scenario_168h = _scenario_row_by_horizon(
                scenario_payload.get("baseline_outputs", []),
                168,
            )
            scenario_336h = _scenario_row_by_horizon(
                scenario_payload.get("baseline_outputs", []),
                336,
            )
            violated_constraints = scenario_payload.get("violated_constraints", [])
            penalties = _coerce_dict(scenario_payload.get("penalties"))
            option_confidence = round(
                float(
                    scenario_payload.get(
                        "confidence",
                        baseline_scenario.get("confidence", 0.0),
                    )
                ),
                6,
            )
            immediate_state_delta = _build_work_event_state_delta(
                crop=crop,
                baseline_snapshot_record=baseline_snapshot_record,
                candidate_snapshot_record=candidate_snapshot_record,
            )
            has_high_violation = any(
                violation.get("severity") == "high"
                for violation in violated_constraints
            )
            expected_yield_delta_14d = (
                float(scenario_336h.get("yield_pred", 0.0))
                - float(baseline_336h.get("yield_pred", 0.0))
            )
            expected_fruit_dm_delta_14d = (
                float(scenario_336h.get("fruit_dm_pred", 0.0))
                - float(baseline_336h.get("fruit_dm_pred", 0.0))
            )
            expected_lai_delta_14d = (
                float(scenario_336h.get("lai_pred", 0.0))
                - float(baseline_336h.get("lai_pred", 0.0))
            )
            expected_canopy_a_delta_72h = (
                float(scenario_72h.get("canopy_A_pred", 0.0))
                - float(baseline_72h.get("canopy_A_pred", 0.0))
            )
            expected_balance_delta = (
                float(scenario_72h.get("source_sink_balance_score", 0.0))
                - float(baseline_72h.get("source_sink_balance_score", 0.0))
            )
            option_payload = {
                "action": candidate["action"],
                "comparison_kind": candidate["comparison_kind"],
                "event_type": candidate["event_type"],
                "operator_note": candidate["operator_note"],
                "agronomy_flags": list(candidate.get("agronomy_flags") or []),
                "expected_yield_delta_7d": round(
                    float(scenario_168h.get("yield_pred", 0.0))
                    - float(baseline_168h.get("yield_pred", 0.0)),
                    6,
                ),
                "expected_yield_delta_14d": round(expected_yield_delta_14d, 6),
                "expected_fruit_dm_delta_14d": round(expected_fruit_dm_delta_14d, 6),
                "expected_lai_delta_14d": round(expected_lai_delta_14d, 6),
                "expected_canopy_a_delta_72h": round(expected_canopy_a_delta_72h, 6),
                "expected_source_sink_balance_delta": round(expected_balance_delta, 6),
                "immediate_state_delta": immediate_state_delta,
                "replay_effect": event_effect,
                "confidence": option_confidence,
                "violated_constraints": violated_constraints,
            }
            option_payload["ranking_score"] = _score_work_event_option(
                crop=crop,
                baseline_state=_coerce_dict(
                    _coerce_dict(baseline_snapshot_record.get("normalized_snapshot")).get("state")
                ),
                option=option_payload,
                baseline_72h=baseline_72h,
                baseline_168h=baseline_168h,
                baseline_336h=baseline_336h,
                scenario_72h=scenario_72h,
                scenario_168h=scenario_168h,
                scenario_336h=scenario_336h,
                penalties=penalties,
                confidence=option_confidence,
            )
            option_payload["risk"] = (
                "high"
                if has_high_violation
                or expected_yield_delta_14d < -0.15
                or option_payload["ranking_score"] < -0.08
                else "medium"
                if violated_constraints or option_payload["ranking_score"] < 0.03
                else "low"
            )
            compare_options.append(
                option_payload
            )
            option_provenance.append(
                {
                    "action": candidate["action"],
                    "comparison_kind": candidate["comparison_kind"],
                    "baseline_snapshot_id": baseline_snapshot_id,
                    "candidate_snapshot_id": candidate_snapshot_record.get("snapshot_id"),
                    "event_payload": event_payload,
                }
            )

        recommended = _select_work_event_recommendation(compare_options)
        baseline_state = _coerce_dict(
            _coerce_dict(baseline_snapshot_record.get("normalized_snapshot")).get("state")
        )
        current_state_payload = {
            "leaf_count": baseline_state.get("leaf_count"),
            "lai": baseline_state.get("lai"),
            "fruit_load": baseline_state.get("fruit_load"),
            "source_sink_balance": round(
                float(
                    _coerce_dict(baseline_scenario.get("runtime_inputs")).get(
                        "source_sink_balance",
                        0.0,
                    )
                ),
                6,
            ),
        }
        if crop == "tomato":
            current_state_payload["active_trusses"] = baseline_state.get("active_trusses")
            active_cohort = next(
                (
                    cohort
                    for cohort in baseline_state.get("truss_cohorts", [])
                    if isinstance(cohort, dict)
                    and cohort.get("active")
                    and _safe_int(cohort.get("n_fruits")) > 0
                ),
                None,
            )
            current_state_payload["sink_overload_score"] = _tomato_sink_overload_score(
                baseline_state,
                active_cohort,
            )
            current_state_payload["active_cohort_id"] = (
                None if active_cohort is None else active_cohort.get("cohort_id")
            )
        else:
            current_state_payload["minimum_leaf_guard"] = 15
            current_state_payload["bottom_leaf_activity"] = baseline_state.get("bottom_leaf_activity")

        return {
            "payload": {
                "status": "ready",
                "summary": (
                    "저장된 기준 상태와 작업 이력을 바탕으로 작업 전후 비교를 만들었습니다."
                    if history
                    else "저장된 기준 상태를 바탕으로 첫 작업 비교를 만들었습니다. 아직 저장된 작업 이력은 없습니다."
                ),
                "history": history,
                "current_state": current_state_payload,
                "options": compare_options,
                "recommended_action": None if recommended is None else recommended.get("action"),
                "confidence": round(float(baseline_scenario.get("confidence", 0.0)), 6),
            },
            "internal_provenance": {
                "status": "ready",
                "greenhouse_id": resolved_greenhouse_id,
                "baseline_snapshot_id": baseline_snapshot_id,
                "history_event_ids": [event.get("event_id") for event in recent_events],
                "options": option_provenance,
            },
        }
    except Exception as exc:
        logger.warning(
            "Work-event compare build degraded for greenhouse=%s crop=%s baseline_snapshot=%s: %s",
            resolved_greenhouse_id,
            crop,
            baseline_snapshot_id,
            exc,
        )
        return {
            "payload": _build_unavailable_work_event_compare_payload(
                reason="저장된 작업 이력 형식이 불완전해 작업 이벤트 비교를 잠시 중단했습니다.",
                history=history,
            ),
            "internal_provenance": {
                "status": "compare-build-failed",
                "greenhouse_id": resolved_greenhouse_id,
                "history_event_ids": [event.get("event_id") for event in recent_events],
                "baseline_snapshot_id": baseline_snapshot_id,
            },
        }


def _build_work_tab_payload(
    *,
    crop: str,
    dashboard: dict[str, Any],
) -> dict[str, Any]:
    current_data = _get_dashboard_context(dashboard, "currentData", "data") or {}
    metrics = _get_dashboard_context(dashboard, "metrics") or {}
    forecast = _get_dashboard_context(dashboard, "forecast") or {}
    weather = _get_dashboard_context(dashboard, "weather") or {}
    rtr = _get_dashboard_context(dashboard, "rtr") or {}
    growth_metrics = metrics.get("growth", {}) if isinstance(metrics, dict) else {}
    yield_metrics = metrics.get("yield", {}) if isinstance(metrics, dict) else {}
    energy_metrics = metrics.get("energy", {}) if isinstance(metrics, dict) else {}
    daily_forecast = forecast.get("daily", []) if isinstance(forecast, dict) else []
    first_forecast_day = daily_forecast[0] if daily_forecast else {}
    weather_daily = weather.get("daily", []) if isinstance(weather, dict) else []
    weather_current = weather.get("current", {}) if isinstance(weather, dict) else {}

    daily_harvest_kg = (
        _coerce_float(first_forecast_day.get("harvest_kg"))
        or _coerce_float(forecast.get("total_harvest_kg"))
        or (
            (_coerce_float(yield_metrics.get("predictedWeekly")) or 0.0) / 7
            if _coerce_float(yield_metrics.get("predictedWeekly")) is not None
            else 0.0
        )
    )
    etc_mm_day = (
        _coerce_float(first_forecast_day.get("ETc_mm"))
        or (
            (_coerce_float(forecast.get("total_ETc_mm")) or 0.0) / len(daily_forecast)
            if daily_forecast
            else None
        )
        or (_coerce_float(current_data.get("transpiration")) or 0.0) * 24
    )
    daily_kwh = (
        (
            (_coerce_float(forecast.get("total_energy_kWh")) or 0.0) / len(daily_forecast)
            if daily_forecast
            else None
        )
        or (_coerce_float(energy_metrics.get("consumption")) or 0.0) * 24
    )
    harvestable_fruits_value = _coerce_float(yield_metrics.get("harvestableFruits"))
    harvestable_fruits = (
        int(harvestable_fruits_value) if harvestable_fruits_value is not None else None
    )
    humidity_pct = _coerce_float(current_data.get("humidity"))
    vpd_kpa = _coerce_float(current_data.get("vpd"))
    rtr_delta_temp_c = _coerce_float(
        (rtr.get("live", {}) if isinstance(rtr, dict) else {}).get("deltaTempC")
    )
    forecast_high_temp_c = _coerce_float(
        (weather_daily[0] if weather_daily else {}).get("temperature_max_c")
    )
    forecast_precip_probability_pct = _coerce_float(
        (weather_daily[0] if weather_daily else {}).get("precipitation_probability_max_pct")
    )
    work_missing_flags = _collect_work_missing_data_flags(dashboard)
    planning_core_ready = any(
        (
            _context_has_value(forecast),
            _context_has_value(growth_metrics),
            _context_has_value(yield_metrics),
        )
    )
    climate_core_ready = any(
        (
            humidity_pct is not None,
            vpd_kpa is not None,
            _context_has_value((rtr.get("live", {}) if isinstance(rtr, dict) else {})),
        )
    )
    limited_monitoring_mode = not planning_core_ready or not climate_core_ready

    kpi = {
        "daily_harvest_kg": daily_harvest_kg,
        "active_trusses": int(_coerce_float(growth_metrics.get("activeTrusses")) or 0),
        "node_count": int(_coerce_float(growth_metrics.get("nodeCount")) or 0),
    }
    state = {
        "datetime": _resolve_state_datetime(current_data, weather_current),
        "node_count": int(_coerce_float(growth_metrics.get("nodeCount")) or 0),
    }
    irrigation = {"ETc_mm_day": etc_mm_day}
    energy = {"daily_kWh": daily_kwh}
    env = {
        "T_air_C": (
            _coerce_float(current_data.get("temperature"))
            or _coerce_float(weather_current.get("temperature_c"))
            or 0.0
        ),
        "RH_percent": (
            _coerce_float(current_data.get("humidity"))
            or _coerce_float(weather_current.get("relative_humidity_pct"))
            or 0.0
        ),
        "PAR_umol": _coerce_float(current_data.get("light")) or 0.0,
    }
    forecast_data = {
        "daily": [
            {
                "date": day.get("date"),
                "T_air_max": _coerce_float(day.get("temperature_max_c")) or 0.0,
                "T_air_min": _coerce_float(day.get("temperature_min_c")) or 0.0,
                "precipitation_probability_max_pct": (
                    _coerce_float(day.get("precipitation_probability_max_pct")) or 0.0
                ),
            }
            for day in weather_daily[:3]
            if isinstance(day, dict)
        ]
    }

    if limited_monitoring_mode:
        return {
            "mode": "monitoring-first",
            "summary": "작업 계획 또는 기후 데이터가 부족해 작업 어드바이저를 모니터링 우선 상태로 유지합니다.",
            "urgency": "low",
            "confidence": _work_context_completeness(dashboard),
            "focus_areas": ["workflow_visibility"],
            "current_state": {
                "diagnosis": "작업 계획/기후 데이터 부족",
                "operating_mode": "monitoring-first",
                "primary_constraint": "작업 계획 또는 기후 데이터가 부족해 강한 작업 재배치를 피해야 합니다.",
                "labor_strategy": "누락 신호를 복구하기 전에는 기본 작업 리듬을 크게 바꾸지 않습니다.",
                "workload_balance": "monitoring-first",
                "deviation": "예보, 생장/수량, 습도/VPD, RTR 실시간 값 중 일부가 비어 있어 작업 순서를 강하게 바꾸기보다 데이터 가시성 회복이 우선입니다.",
                "cause_hypotheses": [
                    "현재 dashboard payload만으로는 작업량과 기후 리스크를 같이 판단하기에 핵심 planning signal이 부족합니다.",
                ],
                "risk_flags": ["workflow-visibility-missing"],
            },
            "priority_actions": [
                _build_work_priority_action(
                    priority="medium",
                    category="workflow",
                    title="핵심 작업 planning signal 복구",
                    message="예보, 생장/수량, 습도/VPD, RTR 실시간 값 중 누락 신호를 먼저 복구한 뒤 작업 우선순위를 다시 계산합니다.",
                    action="restore_workflow_visibility",
                    time_window="next_6h",
                )
            ],
            "time_windows": [
                {
                    "window": "next_6h",
                    "focus": "누락된 작업 planning/climate signal을 먼저 복구합니다.",
                    "rationale": "visibility가 부족한 상태에서는 작업 강도보다 데이터 복구가 우선입니다.",
                },
                {
                    "window": "next_24h",
                    "focus": "visibility recovery 이후 수확·급액·적엽 순서를 다시 계산합니다.",
                    "rationale": "불완전한 planning signal로 강한 작업 지시를 내리지 않습니다.",
                },
                {
                    "window": "next_3d",
                    "focus": "3일 계획은 보수적으로 유지합니다.",
                    "rationale": "forecast와 yield context가 회복되기 전까지는 작업량을 크게 바꾸지 않습니다.",
                },
            ],
            "expected_effects": ["불완전한 데이터를 정상 작업지시로 오인하는 리스크 차단"],
            "monitoring_checklist": [
                "예보, 생장/수량, 습도/VPD, RTR 실시간 신호가 다시 들어오는지 확인",
                "누락 신호가 복구되기 전까지는 접촉 작업과 수확 창을 과도하게 재배치하지 않기",
            ],
            "context_snapshot": {
                "next_day_harvest_kg": daily_harvest_kg,
                "next_day_etc_mm": etc_mm_day,
                "daily_energy_kwh": daily_kwh,
                "active_trusses": kpi["active_trusses"] or None,
                "node_count": kpi["node_count"] or None,
                "harvestable_fruits": harvestable_fruits,
                "humidity_pct": humidity_pct,
                "vpd_kpa": vpd_kpa,
                "rtr_delta_temp_c": rtr_delta_temp_c,
                "forecast_high_temp_c": forecast_high_temp_c,
                "missing_work_signals": work_missing_flags,
            },
        }

    recommendations = DecisionSupport(crop).get_recommendations(
        kpi,
        state,
        irrigation,
        energy,
        env=env,
        forecast_data=forecast_data,
    )
    priority_actions = _build_work_action_items(recommendations)
    workflow_rule_actions, workflow_state = _build_work_rule_actions(
        crop=crop,
        daily_harvest_kg=daily_harvest_kg,
        etc_mm_day=etc_mm_day,
        humidity_pct=humidity_pct,
        vpd_kpa=vpd_kpa,
        forecast_high_temp_c=forecast_high_temp_c,
        forecast_precip_probability_pct=forecast_precip_probability_pct,
        active_trusses=kpi["active_trusses"] or None,
        node_count=kpi["node_count"] or None,
        rtr_delta_temp_c=rtr_delta_temp_c,
    )
    rule_actions: list[dict[str, Any]] = []
    focus_areas: list[str] = []
    diagnosis_parts: list[str] = []
    deviation_parts: list[str] = []
    cause_hypotheses: list[str] = []
    expected_effects: list[str] = []

    if daily_harvest_kg >= 1.2 or (harvestable_fruits is not None and harvestable_fruits >= 15):
        focus_areas.append("harvest_load")
        diagnosis_parts.append("수확 작업 비중이 높은 날")
        deviation_parts.append(
            f"예상 수확량 {daily_harvest_kg:.2f}kg"
            + (
                f", harvestable fruits {harvestable_fruits}개" if harvestable_fruits is not None else ""
            )
            + "로 수확 창을 먼저 고정해야 작업 밀집을 줄일 수 있습니다."
        )
        cause_hypotheses.append("수확·선별·이동 작업이 같은 시간대에 몰리면 다른 재배작업이 밀릴 수 있습니다.")
        expected_effects.append("수확 밀집과 품질 저하 리스크 완화")
        rule_actions.append(
            _build_work_priority_action(
                priority="high",
                category="harvest",
                title="수확 창 우선 배치",
                message="오전 또는 건조 구간에 수확·선별 동선을 먼저 고정하고 적엽/유인은 분리합니다.",
                action="stage_harvest_window",
                time_window="today",
            )
        )

    if (humidity_pct is not None and humidity_pct >= 85) or (vpd_kpa is not None and vpd_kpa <= 0.45):
        focus_areas.append("touch_work_separation")
        diagnosis_parts.append("접촉 작업 분리 필요")
        deviation_parts.append(
            "고습 또는 저VPD 구간이라 적엽·유인·수확을 한 창에 몰리게 하면 canopy 회복이 더 느려질 수 있습니다."
        )
        cause_hypotheses.append("잎 접촉 작업이 겹치면 습기 체류와 병압, 작업 피로가 같이 올라갈 수 있습니다.")
        expected_effects.append("고습 구간 작업 간섭과 병압 리스크 완화")
        rule_actions.append(
            _build_work_priority_action(
                priority="high",
                category="health",
                title="접촉 작업 분리",
                message="고습/저VPD 구간에는 적엽·유인과 수확을 분리해 canopy 건조 시간을 확보합니다.",
                action="split_touch_work",
                time_window="next_6h",
            )
        )

    if (etc_mm_day is not None and etc_mm_day >= 5.0) or (
        forecast_high_temp_c is not None and forecast_high_temp_c >= 30
    ):
        focus_areas.append("irrigation_precheck")
        diagnosis_parts.append("급액·고온 대비 선행 점검 필요")
        deviation_parts.append(
            "증산 수요 또는 예보 고온이 높아 급액/설비 점검을 먼저 맞춰야 오후 작업 충돌을 줄일 수 있습니다."
        )
        cause_hypotheses.append("급액 점검이 늦으면 오후 고온 구간에서 작업과 수분 관리가 동시에 꼬일 수 있습니다.")
        expected_effects.append("오후 고온/고증산 구간 대응력 확보")
        rule_actions.append(
            _build_work_priority_action(
                priority="high",
                category="irrigation",
                title="급액·고온 대응 선행 점검",
                message="급액 스케줄, 배액 확인, 냉방 보조 설비를 오전에 먼저 점검합니다.",
                action="precheck_irrigation_and_cooling",
                time_window="today",
            )
        )

    if crop == "tomato" and kpi["active_trusses"] >= 8 and rtr_delta_temp_c is not None and rtr_delta_temp_c <= -1.0:
        focus_areas.append("tomato_load_balance")
        diagnosis_parts.append("토마토 착과 부담 대비 작업 속도 보수화 필요")
        deviation_parts.append(
            f"활성 화방 {kpi['active_trusses']}개와 RTR 편차 {rtr_delta_temp_c:.1f}°C는 순지르기와 유인 강도를 보수적으로 나눌 필요가 있습니다."
        )
        cause_hypotheses.append("착과 부담이 큰 날 과도한 작업 강도는 생장 속도와 회복을 동시에 흔들 수 있습니다.")
        expected_effects.append("토마토 착과 부담일의 작업 과부하 억제")
        rule_actions.append(
            _build_work_priority_action(
                priority="medium",
                category="growth",
                title="순지르기 강도 분산",
                message="토마토 착과 부담이 큰 날은 순지르기와 유인을 한 번에 몰지 말고 수확 이후로 나눕니다.",
                action="moderate_pruning_load",
                time_window="today",
            )
        )

    if crop == "cucumber" and kpi["node_count"] >= 24 and (
        (humidity_pct is not None and humidity_pct >= 85)
        or (vpd_kpa is not None and vpd_kpa <= 0.45)
    ):
        focus_areas.append("cucumber_canopy_rhythm")
        diagnosis_parts.append("오이 작업 리듬 분산 필요")
        deviation_parts.append(
            f"마디 수 {kpi['node_count']}개 구간의 연약한 초세에서는 유인과 적엽을 분산해야 초세 전개를 덜 흔듭니다."
        )
        cause_hypotheses.append("오이는 마디 전개 리듬이 무너지면 초세 회복과 작업성이 동시에 떨어질 수 있습니다.")
        expected_effects.append("오이 초세 전개와 작업 리듬 안정화")
        rule_actions.append(
            _build_work_priority_action(
                priority="medium",
                category="pruning",
                title="유인·적엽 분산",
                message="오이 초세 전개 구간에서는 유인과 적엽을 분리해 마디 생장 속도를 보전합니다.",
                action="split_training_and_pruning",
                time_window="today",
            )
        )

    merged_actions: list[dict[str, Any]] = []
    seen_action_keys: set[tuple[str, str]] = set()
    for action in sorted(
        [*workflow_rule_actions, *rule_actions, *priority_actions],
        key=lambda item: (
            int(item.get("rank", 4)),
            str(item.get("title") or ""),
        ),
    ):
        dedupe_key = (str(action.get("title") or ""), str(action.get("action") or ""))
        if dedupe_key in seen_action_keys:
            continue
        seen_action_keys.add(dedupe_key)
        merged_actions.append(action)

    priority_actions = merged_actions[:6]
    high_priority_count = sum(1 for action in priority_actions if action["priority"] == "high")
    urgency = "high" if high_priority_count > 0 else "medium" if priority_actions else "low"
    summary = (
        f"작업 어드바이저가 우선 작업 {len(priority_actions)}건을 정리했습니다."
        if priority_actions
        else "현재 대시보드 문맥에서는 강한 작업 트리거가 아직 뚜렷하지 않습니다."
    )

    if not diagnosis_parts:
        diagnosis_parts.append("작업 리듬 대체로 안정")
        deviation_parts.append("현재 대시보드 문맥에서는 작업 순서를 급격히 바꿔야 할 강한 작업 신호가 제한적입니다.")
        cause_hypotheses.append("기본 작업 리듬을 유지하면서 수확, 습도, 급액 신호만 추적하면 됩니다.")
        focus_areas.append("workflow_stability")
        expected_effects.append("기본 작업 리듬 유지")

    monitoring_checklist = [
        "작업 전후 RH/VPD 재상승 여부 확인",
        "급액과 수확 작업이 같은 시간대에 몰리지 않는지 확인",
        "RTR 목표 대비 편차가 커지면 작업 강도를 재조정",
    ]
    if "touch_work_separation" in focus_areas:
        monitoring_checklist.append("접촉 작업 후 canopy 건조 시간과 병반/결로 여부를 다시 확인")
    if "irrigation_precheck" in focus_areas:
        monitoring_checklist.append("급액 점검 이후 오후 ETc와 배액 반응이 예상 범위인지 확인")
    if "harvest_load" in focus_areas:
        monitoring_checklist.append("수확 창 이후 다른 작업이 뒤로 밀리지 않았는지 확인")

    return {
        "mode": "actionable",
        "summary": summary,
        "urgency": urgency,
        "confidence": max(_work_context_completeness(dashboard), 0.42),
        "focus_areas": list(dict.fromkeys(focus_areas)),
        "current_state": {
            "diagnosis": " / ".join(diagnosis_parts),
            "operating_mode": str(workflow_state.get("operating_mode") or "steady-rhythm"),
            "primary_constraint": str(
                workflow_state.get("primary_constraint") or "현재 작업 리듬을 유지합니다."
            ),
            "labor_strategy": str(
                workflow_state.get("labor_strategy") or "기본 작업 순서를 유지합니다."
            ),
            "workload_balance": (
                "harvest-heavy"
                if "harvest_load" in focus_areas
                else "humidity-constrained"
                if "touch_work_separation" in focus_areas
                else "steady"
            ),
            "deviation": " ".join(deviation_parts),
            "cause_hypotheses": cause_hypotheses,
            "risk_flags": list(dict.fromkeys(workflow_state.get("risk_flags") or focus_areas)),
        },
        "priority_actions": priority_actions,
        "time_windows": _build_work_time_windows(
            current_data=current_data,
            weather=weather,
            rtr=rtr,
            top_actions=priority_actions,
        ),
        "expected_effects": list(dict.fromkeys(expected_effects)),
        "monitoring_checklist": monitoring_checklist,
        "context_snapshot": {
            "next_day_harvest_kg": daily_harvest_kg,
            "next_day_etc_mm": etc_mm_day,
            "daily_energy_kwh": daily_kwh,
            "active_trusses": kpi["active_trusses"] or None,
            "node_count": kpi["node_count"] or None,
            "harvestable_fruits": harvestable_fruits,
            "humidity_pct": humidity_pct,
            "vpd_kpa": vpd_kpa,
            "rtr_delta_temp_c": rtr_delta_temp_c,
            "forecast_high_temp_c": forecast_high_temp_c,
        },
    }


def _collect_harvest_market_missing_data_flags(dashboard: dict[str, Any]) -> list[str]:
    current_data = _get_dashboard_context(dashboard, "currentData", "data") or {}
    metrics = _get_dashboard_context(dashboard, "metrics") or {}
    yield_metrics = metrics.get("yield", {}) if isinstance(metrics, dict) else {}
    forecast = _get_dashboard_context(dashboard, "forecast") or {}
    market = _get_dashboard_context(dashboard, "market") or {}
    weather = _get_dashboard_context(dashboard, "weather") or {}
    rtr = _get_dashboard_context(dashboard, "rtr") or {}
    weather_daily = weather.get("daily", []) if isinstance(weather, dict) else []
    rtr_live = rtr.get("live", {}) if isinstance(rtr, dict) else {}
    market_items_available = (
        bool(market.get("retail_items"))
        or bool(market.get("wholesale_items"))
        or bool(market.get("trend_items"))
    ) if isinstance(market, dict) else False

    missing_flags: list[str] = []
    if not _context_has_value(forecast):
        missing_flags.append("forecast")
    if not _context_has_value(yield_metrics):
        missing_flags.append("yield_metrics")
    if not market_items_available:
        missing_flags.append("market")
    if not weather_daily:
        missing_flags.append("weather_forecast")
    if not _context_has_value(rtr_live):
        missing_flags.append("rtr_live")
    if _coerce_float(current_data.get("humidity")) is None:
        missing_flags.append("inside_humidity")
    if _coerce_float(current_data.get("vpd")) is None:
        missing_flags.append("inside_vpd")
    return missing_flags


def _harvest_market_context_completeness(dashboard: dict[str, Any]) -> float:
    current_data = _get_dashboard_context(dashboard, "currentData", "data") or {}
    metrics = _get_dashboard_context(dashboard, "metrics") or {}
    yield_metrics = metrics.get("yield", {}) if isinstance(metrics, dict) else {}
    forecast = _get_dashboard_context(dashboard, "forecast") or {}
    market = _get_dashboard_context(dashboard, "market") or {}
    weather = _get_dashboard_context(dashboard, "weather") or {}
    rtr = _get_dashboard_context(dashboard, "rtr") or {}
    weather_daily = weather.get("daily", []) if isinstance(weather, dict) else []
    rtr_live = rtr.get("live", {}) if isinstance(rtr, dict) else {}
    market_items_available = (
        bool(market.get("retail_items"))
        or bool(market.get("wholesale_items"))
        or bool(market.get("trend_items"))
    ) if isinstance(market, dict) else False

    checks = (
        _context_has_value(forecast),
        _context_has_value(yield_metrics),
        market_items_available,
        bool(weather_daily),
        _context_has_value(rtr_live),
        _coerce_float(current_data.get("humidity")) is not None,
        _coerce_float(current_data.get("vpd")) is not None,
    )
    return round(sum(1 for item in checks if item) / len(checks), 2)


def _build_harvest_market_action(
    *,
    priority: str,
    title: str,
    rationale: str,
    operator: str,
    expected_effect: str,
    time_window: str,
) -> dict[str, str]:
    return {
        "priority": priority,
        "title": title,
        "rationale": rationale,
        "operator": operator,
        "expected_effect": expected_effect,
        "time_window": time_window,
    }


def _build_harvest_market_tab_payload(
    *,
    crop: str,
    dashboard: dict[str, Any],
) -> dict[str, Any]:
    current_data = _get_dashboard_context(dashboard, "currentData", "data") or {}
    metrics = _get_dashboard_context(dashboard, "metrics") or {}
    forecast = _get_dashboard_context(dashboard, "forecast") or {}
    market = _get_dashboard_context(dashboard, "market") or {}
    weather = _get_dashboard_context(dashboard, "weather") or {}
    rtr = _get_dashboard_context(dashboard, "rtr") or {}
    growth_metrics = metrics.get("growth", {}) if isinstance(metrics, dict) else {}
    yield_metrics = metrics.get("yield", {}) if isinstance(metrics, dict) else {}
    energy_metrics = metrics.get("energy", {}) if isinstance(metrics, dict) else {}
    daily_forecast = forecast.get("daily", []) if isinstance(forecast, dict) else []
    first_forecast_day = daily_forecast[0] if daily_forecast else {}
    weather_daily = weather.get("daily", []) if isinstance(weather, dict) else []
    first_weather_day = weather_daily[0] if weather_daily else {}
    rtr_live = rtr.get("live", {}) if isinstance(rtr, dict) else {}
    retail_items = market.get("retail_items", []) if isinstance(market, dict) else []
    wholesale_items = market.get("wholesale_items", []) if isinstance(market, dict) else []
    trend_items = market.get("trend_items", []) if isinstance(market, dict) else []
    trend_market_key = str(market.get("trend_market_key") or "").strip() or None
    trend_lookup = {
        str(item.get("display_name") or ""): item
        for item in trend_items
        if isinstance(item, dict)
    }

    predicted_weekly_yield_kg = _coerce_float(yield_metrics.get("predictedWeekly"))
    next_day_harvest_kg = _coerce_float(first_forecast_day.get("harvest_kg"))
    if next_day_harvest_kg is None and predicted_weekly_yield_kg is not None:
        next_day_harvest_kg = round(predicted_weekly_yield_kg / 7, 2)

    total_harvest_kg = _coerce_float(forecast.get("total_harvest_kg"))
    if total_harvest_kg is None:
        total_harvest_kg = predicted_weekly_yield_kg

    harvestable_fruits_value = _coerce_float(yield_metrics.get("harvestableFruits"))
    harvestable_fruits = (
        int(harvestable_fruits_value) if harvestable_fruits_value is not None else None
    )
    active_trusses_value = _coerce_float(growth_metrics.get("activeTrusses"))
    active_trusses = int(active_trusses_value) if active_trusses_value is not None else None
    node_count_value = _coerce_float(growth_metrics.get("nodeCount"))
    node_count = int(node_count_value) if node_count_value is not None else None

    daily_energy_kwh = (
        (
            (_coerce_float(forecast.get("total_energy_kWh")) or 0.0) / len(daily_forecast)
            if daily_forecast
            else None
        )
        or (_coerce_float(energy_metrics.get("consumption")) or 0.0) * 24
    )
    humidity_pct = _coerce_float(current_data.get("humidity"))
    vpd_kpa = _coerce_float(current_data.get("vpd"))
    rtr_delta_temp_c = _coerce_float(rtr_live.get("deltaTempC"))
    rtr_balance_state = str(rtr_live.get("balanceState") or "").strip() or None
    forecast_high_temp_c = _coerce_float(first_weather_day.get("temperature_max_c"))
    forecast_precip_probability_pct = _coerce_float(
        first_weather_day.get("precipitation_probability_max_pct")
    )
    next_day_weather_label = str(first_weather_day.get("weather_label") or "").strip() or None

    retail_item = retail_items[0] if retail_items else {}
    wholesale_item = wholesale_items[0] if wholesale_items else {}
    retail_price_krw = _coerce_float(retail_item.get("current_price_krw"))
    retail_day_over_day_pct = _coerce_float(retail_item.get("day_over_day_pct"))
    wholesale_price_krw = _coerce_float(wholesale_item.get("current_price_krw"))
    wholesale_day_over_day_pct = _coerce_float(wholesale_item.get("day_over_day_pct"))
    price_direction = str(wholesale_item.get("direction") or retail_item.get("direction") or "").strip() or None
    market_reference_day = str(
        (market.get("source", {}) if isinstance(market, dict) else {}).get("latest_day") or ""
    ).strip() or None
    primary_display_name = str(
        wholesale_item.get("display_name") or retail_item.get("display_name") or ""
    ).strip()
    primary_market_key = str(wholesale_item.get("market_key") or retail_item.get("market_key") or "").strip() or None
    primary_trend = (
        trend_lookup.get(primary_display_name, trend_items[0] if trend_items else {})
        if primary_market_key == trend_market_key
        else {}
    )
    seasonal_bias = str(primary_trend.get("seasonal_bias") or "").strip() or None

    market_items_available = bool(retail_items) or bool(wholesale_items) or bool(trend_items)
    limited_market_mode = not market_items_available
    limited_harvest_mode = (
        next_day_harvest_kg is None and total_harvest_kg is None and harvestable_fruits is None
    )
    monitoring_first = limited_market_mode and limited_harvest_mode

    volume_ready = next_day_harvest_kg is not None and next_day_harvest_kg >= 0.8
    weather_risk = bool(
        (forecast_high_temp_c is not None and forecast_high_temp_c >= 30)
        or (
            forecast_precip_probability_pct is not None
            and forecast_precip_probability_pct >= 60
        )
        or (
            humidity_pct is not None
            and humidity_pct >= 85
            and vpd_kpa is not None
            and vpd_kpa <= 0.45
        )
    )
    primary_day_over_day_pct = wholesale_day_over_day_pct if wholesale_day_over_day_pct is not None else retail_day_over_day_pct
    market_favorable = bool(
        (primary_day_over_day_pct is not None and primary_day_over_day_pct >= 3)
        or price_direction == "up"
        or seasonal_bias == "above-seasonal-normal"
    )
    market_soft = bool(
        (primary_day_over_day_pct is not None and primary_day_over_day_pct <= -3)
        or price_direction == "down"
        or seasonal_bias == "below-seasonal-normal"
    )

    if limited_harvest_mode:
        harvest_outlook = "수확 forecast가 얕아 오늘은 관찰 중심으로 수확 창을 잡아야 합니다."
    elif volume_ready:
        harvest_outlook = "다음 24시간 수확 물량이 보여 선별·포장 창을 실제로 운영할 수 있습니다."
    else:
        harvest_outlook = "단기 수확량은 과도하지 않아 품질 안정과 수확 타이밍 조정이 우선입니다."

    if limited_market_mode:
        market_outlook = "현재 작물과 직접 맞는 시장 가격 정보가 부족합니다."
    elif market_favorable:
        market_outlook = "현재 가격 흐름은 출하 우선분을 활용해볼 수 있는 쪽입니다."
    elif market_soft:
        market_outlook = "현재 가격 흐름은 약세에 가까워 품질 방어와 선별 강화가 더 중요합니다."
    else:
        market_outlook = "시장 가격 흐름은 중립에 가까워 수확 물량과 품질 안정성을 함께 봐야 합니다."

    if weather_risk:
        tradeoff_focus = "quality_stability"
    elif volume_ready and market_favorable:
        tradeoff_focus = "productivity_first"
    elif market_soft and daily_energy_kwh is not None and daily_energy_kwh >= 20:
        tradeoff_focus = "cost_defense"
    else:
        tradeoff_focus = "balanced"

    if crop == "tomato":
        crop_specific_context = (
            f"토마토 착과 문맥: 활성 화방 {active_trusses or 0}개, "
            f"수확 가능 과실 {harvestable_fruits or 0}개."
        )
    else:
        crop_specific_context = (
            f"오이 생장 문맥: 마디 수 {node_count or 0}개, "
            f"수확 가능 과실 {harvestable_fruits or 0}개."
        )

    priority_actions: list[dict[str, str]] = []
    if weather_risk and volume_ready:
        priority_actions.append(
            _build_harvest_market_action(
                priority="high",
                title="오전 수확/선별 창 확보",
                rationale="고온·강수·고습 리스크가 겹치면 오후로 갈수록 품질 변동성이 커집니다.",
                operator="수확과 선별을 오전 창으로 당기고 포장 대기시간을 최소화합니다.",
                expected_effect="품질 흔들림을 줄이면서 당일 출하 여지를 확보합니다.",
                time_window="today_am",
            )
        )
    if volume_ready and market_favorable:
        priority_actions.append(
            _build_harvest_market_action(
                priority="medium",
                title="가격 우호분 우선 출하",
                rationale="현재 가격 흐름이 받쳐주면 규격품을 먼저 묶는 편이 유리합니다.",
                operator="소매/도매 기준 규격품을 먼저 선별해 출하 우선 순서를 올립니다.",
                expected_effect="가격이 살아 있는 구간에 물량을 연결할 수 있습니다.",
                time_window="today",
            )
        )
    if market_soft:
        priority_actions.append(
            _build_harvest_market_action(
                priority="medium",
                title="품질 우선 선별",
                rationale="가격이 약할 때는 무리한 조기 수확보다 등급 방어가 더 중요합니다.",
                operator="과숙·등외품 분리를 강화하고 규격품 중심으로 출하 비중을 맞춥니다.",
                expected_effect="약세장에서도 단가 하락을 완화합니다.",
                time_window="today_pm",
            )
        )
    if limited_market_mode:
        priority_actions.append(
            _build_harvest_market_action(
                priority="low",
                title="시장 데이터 복구",
                rationale="시장 가격 정보가 없으면 수확량과 가격을 함께 해석할 수 없습니다.",
                operator="가격 패널과 API 응답을 확인해 작물 일치 가격 정보를 먼저 복구합니다.",
                expected_effect="다음 실행에서 가격 연동 제어 방향을 함께 볼 수 있습니다.",
                time_window="next_run",
            )
        )
    if not priority_actions:
        priority_actions.append(
            _build_harvest_market_action(
                priority="low",
                title="수확/출하 추세 모니터링",
                rationale="현재는 강한 재배치보다 수확 물량과 가격 추세 확인이 우선입니다.",
                operator="오늘 수확 물량과 오후 가격 변동이 함께 움직이는지 모니터링합니다.",
                expected_effect="불필요한 출하 조정을 줄이고 다음 window를 더 정확히 잡습니다.",
                time_window="next_24h",
            )
        )

    market_watchlist: list[dict[str, Any]] = []
    for item in [*retail_items[:2], *wholesale_items[:2]]:
        if not isinstance(item, dict):
            continue
        display_name = str(item.get("display_name") or "").strip()
        market_key = str(item.get("market_key") or "").strip() or None
        trend_item = trend_lookup.get(display_name, {}) if market_key == trend_market_key else {}
        item_seasonal_bias = str(trend_item.get("seasonal_bias") or "").strip() or None
        item_direction = str(item.get("direction") or "").strip() or None
        item_day_over_day_pct = _coerce_float(item.get("day_over_day_pct"))

        if item_seasonal_bias == "above-seasonal-normal" and item_direction == "up":
            interpretation = "계절선보다 강하고 상승 중이라 출하 우선분을 볼 수 있습니다."
        elif item_seasonal_bias == "below-seasonal-normal" or item_direction == "down":
            interpretation = "가격이 약한 편이라 품질 우선 선별과 출하 타이밍 방어가 필요합니다."
        else:
            interpretation = "가격은 중립 구간이라 수확 물량과 기상 리스크를 함께 봐야 합니다."

        market_watchlist.append(
            {
                "display_name": display_name,
                "market_label": str(item.get("market_label") or "market"),
                "current_price_krw": _coerce_float(item.get("current_price_krw")),
                "direction": item_direction,
                "day_over_day_pct": item_day_over_day_pct,
                "seasonal_bias": item_seasonal_bias,
                "interpretation": interpretation,
            }
        )

    timing_windows = [
        {
            "window": "today_am",
            "focus": "수확/선별 창",
            "rationale": (
                "고온/습도 리스크가 있으면 오전에 수확과 선별을 당기는 편이 안전합니다."
                if weather_risk
                else "첫 수확 창에서 규격품 선별과 포장 속도를 먼저 맞춥니다."
            ),
        },
        {
            "window": "today_pm",
            "focus": "포장·출하 조정",
            "rationale": (
                "가격이 우호적이면 출하 우선분을 유지하고, 약세면 품질 선별을 더 보수적으로 가져갑니다."
            ),
        },
        {
            "window": "next_3d",
            "focus": "수확/시장 연동 모니터링",
            "rationale": (
                "예상 물량, RTR 균형, 가격 정보가 같은 방향인지 보며 다음 수확 창을 조정합니다."
            ),
        },
    ]

    monitoring_checklist = [
        "다음 실행에서 예상 수확량과 실제 수확 흐름이 크게 어긋나지 않는지 확인",
        "오후 고습/저VPD 구간이 길어질 때 선별·포장 대기 시간이 늘지 않는지 확인",
        "시장 가격 흐름이 약세로 돌면 규격/비규격 분리 기준을 바로 조정할 수 있는지 확인",
    ]
    if limited_market_mode:
        monitoring_checklist.insert(
            0,
            "시장 가격 정보가 비었으면 가격 패널과 API 응답부터 복구합니다.",
        )
    if monitoring_first:
        monitoring_checklist.insert(
            0,
            "수확 예측과 작물 일치 가격 정보가 모두 비어 있어 모니터링 우선으로 유지합니다.",
        )

    urgency = "low"
    if weather_risk and volume_ready:
        urgency = "high"
    elif volume_ready or market_favorable or market_soft:
        urgency = "medium"

    return {
        "summary": (
            "수확/가격 어드바이저가 수확 전망, 가격 정보, 기후 위험을 함께 묶어 출하 방향을 정리했습니다."
            if not monitoring_first and not limited_market_mode
            else "수확/가격 어드바이저가 가격 정보가 일부만 있는 상태에서 수확 우선 가이드를 정리했습니다."
            if not monitoring_first
            else "수확 전망과 가격 정보가 모두 부족해 수확/가격 어드바이저를 모니터링 우선 상태로 유지합니다."
        ),
        "urgency": urgency,
        "confidence": _harvest_market_context_completeness(dashboard),
        "current_state": {
            "harvest_outlook": harvest_outlook,
            "market_outlook": market_outlook,
            "tradeoff_focus": tradeoff_focus,
            "crop_specific_context": crop_specific_context,
        },
        "priority_actions": priority_actions,
        "market_watchlist": market_watchlist,
        "timing_windows": timing_windows,
        "monitoring_checklist": monitoring_checklist,
        "context_snapshot": {
            "next_day_harvest_kg": next_day_harvest_kg,
            "total_harvest_kg": total_harvest_kg,
            "predicted_weekly_yield_kg": predicted_weekly_yield_kg,
            "harvestable_fruits": harvestable_fruits,
            "active_trusses": active_trusses,
            "node_count": node_count,
            "daily_energy_kwh": daily_energy_kwh,
            "humidity_pct": humidity_pct,
            "vpd_kpa": vpd_kpa,
            "rtr_delta_temp_c": rtr_delta_temp_c,
            "rtr_balance_state": rtr_balance_state,
            "forecast_high_temp_c": forecast_high_temp_c,
            "forecast_precip_probability_pct": forecast_precip_probability_pct,
            "next_day_weather_label": next_day_weather_label,
            "retail_price_krw": retail_price_krw,
            "retail_day_over_day_pct": retail_day_over_day_pct,
            "wholesale_price_krw": wholesale_price_krw,
            "wholesale_day_over_day_pct": wholesale_day_over_day_pct,
            "market_reference_day": market_reference_day,
            "seasonal_bias": seasonal_bias,
        },
    }


def build_advisor_summary_response(
    *,
    crop: str,
    dashboard: dict[str, Any],
    language: str = "ko",
) -> dict[str, Any]:
    catalog_payload = build_knowledge_catalog(crop)
    advisory_surfaces = catalog_payload.get("advisory_surfaces", {})
    missing_data = _collect_missing_data_flags(dashboard)
    domains = _infer_domains(dashboard, advisory_surfaces)
    retrieval_context = build_summary_advisor_context(
        crop=crop,
        domains=domains,
    )
    model_runtime = _build_model_runtime_payload(
        crop=crop,
        dashboard=dashboard,
        tab_name="summary",
    )
    context_completeness = _context_completeness(dashboard)
    llm_dashboard = _inject_model_runtime_context(
        _inject_advisor_retrieval_context(dashboard, retrieval_context),
        model_runtime,
    )
    text = generate_consulting(
        crop=crop,
        dashboard=llm_dashboard,
        language=language,
    )
    display = build_advisory_display_payload(
        text,
        language=language,
        confidence=context_completeness,
    )
    structured_actions = [
        {"title": action, "message": action}
        for action in [*display.get("actions_now", []), *display.get("actions_today", [])]
    ]

    return {
        "status": "success",
        "family": "advisor_summary",
        "crop": crop,
        "text": text,
        "machine_payload": {
            "summary": "SmartGrow advisor summary generated from the live dashboard and crop-scoped local knowledge context.",
            "domains": domains,
            "context_completeness": context_completeness,
            "actions": structured_actions,
            "missing_data": missing_data,
            "retrieval_context": retrieval_context.get("summary", {}),
            "advisory_surfaces": advisory_surfaces,
            "model_runtime": model_runtime,
            "display": display,
            "internal_provenance": _build_internal_provenance(
                catalog_payload,
                advisory_surfaces,
                retrieval_context=retrieval_context,
            ),
        },
    }


def _dedupe_nonempty_strings(values: list[Any]) -> list[str]:
    ordered: list[str] = []
    for value in values:
        normalized = str(value or "").strip()
        if normalized and normalized not in ordered:
            ordered.append(normalized)
    return ordered


def _build_summary_fallback_markdown(
    *,
    language: str,
    model_runtime: dict[str, Any],
    reason: str,
) -> str:
    locale = "ko" if not language.lower().startswith("en") else "en"
    scenario = _coerce_dict(model_runtime.get("scenario"))
    recommended = _coerce_dict(scenario.get("recommended"))
    recommendations = model_runtime.get("recommendations")
    recommendation_items = recommendations if isinstance(recommendations, list) else []
    best_actions = model_runtime.get("best_actions")
    best_action_items = best_actions if isinstance(best_actions, list) else []
    constraint_checks = _coerce_dict(model_runtime.get("constraint_checks"))
    violations = constraint_checks.get("violated_constraints")
    violation_items = violations if isinstance(violations, list) else []

    summary_text = str(model_runtime.get("summary") or "").strip()
    if not summary_text:
        summary_text = (
            "LLM 응답이 지연되어 모델 기반 요약을 먼저 표시합니다."
            if locale == "ko"
            else "The LLM summary is delayed, so the deterministic model summary is shown first."
        )
    elif reason == "llm_timeout":
        summary_text = (
            f"{summary_text} LLM 응답이 지연되어 모델 기반 요약을 먼저 표시합니다."
            if locale == "ko"
            else f"{summary_text} The deterministic model summary is shown first because the LLM response is delayed."
        )

    actions_now = _dedupe_nonempty_strings([
        recommended.get("action"),
        *[
            item.get("action") or item.get("message")
            for item in recommendation_items
            if isinstance(item, dict)
        ],
    ])
    if not actions_now:
        actions_now = [
            "현재 제어안을 유지하면서 다음 센서 갱신을 확인합니다."
            if locale == "ko"
            else "Hold the current control strategy and confirm the next telemetry update."
        ]

    actions_today = _dedupe_nonempty_strings([
        item.get("action_short") or item.get("action")
        for item in best_action_items
        if isinstance(item, dict)
    ])
    actions_today = [action for action in actions_today if action not in actions_now][:2]
    if not actions_today and len(actions_now) > 1:
        actions_today = actions_now[1:3]

    risks = _dedupe_nonempty_strings([
        item.get("message")
        for item in violation_items
        if isinstance(item, dict)
    ])[:3]
    monitor = _dedupe_nonempty_strings([
        (
            "OpenAI 요약이 복구되면 운영 문장을 다시 확인합니다."
            if locale == "ko"
            else "Recheck the operator summary once the OpenAI response recovers."
        ) if reason == "openai_unavailable" else (
            "요약 카드가 다시 갱신되면 권장 조치를 최신 상태로 확인합니다."
            if locale == "ko"
            else "Recheck the recommendation once the summary card refreshes again."
        ),
        (
            "RTR, 예보, 센서 추세가 같은 방향인지 확인합니다."
            if locale == "ko"
            else "Confirm that RTR, forecast, and telemetry trends are aligned."
        ),
    ])

    if locale == "ko":
        risks_block = "\n".join(f"- {risk}" for risk in risks)
        actions_now_block = "\n".join(f"- {action}" for action in actions_now[:2])
        actions_today_block = "\n".join(f"- {action}" for action in actions_today)
        monitor_block = "\n".join(f"- {item}" for item in monitor[:3])
        return (
            "## 핵심 요약\n"
            f"- {summary_text}\n\n"
            "## 경보 및 위험\n"
            f"{risks_block}\n\n"
            "## 권장 조치\n"
            "### 지금\n"
            f"{actions_now_block}\n\n"
            "### 오늘\n"
            f"{actions_today_block}\n\n"
            "## 모니터링 체크리스트 (24시간)\n"
            f"{monitor_block}\n"
        )

    risks_block = "\n".join(f"- {risk}" for risk in risks)
    actions_now_block = "\n".join(f"- {action}" for action in actions_now[:2])
    actions_today_block = "\n".join(f"- {action}" for action in actions_today)
    monitor_block = "\n".join(f"- {item}" for item in monitor[:3])
    return (
        "## Summary\n"
        f"- {summary_text}\n\n"
        "## Risks\n"
        f"{risks_block}\n\n"
        "## Actions\n"
        "### Now\n"
        f"{actions_now_block}\n\n"
        "### Today\n"
        f"{actions_today_block}\n\n"
        "## Monitor\n"
        f"{monitor_block}\n"
    )


def build_advisor_summary_fallback_response(
    *,
    crop: str,
    dashboard: dict[str, Any],
    language: str = "ko",
    reason: str = "openai_unavailable",
) -> dict[str, Any]:
    catalog_payload = build_knowledge_catalog(crop)
    advisory_surfaces = catalog_payload.get("advisory_surfaces", {})
    missing_data = _collect_missing_data_flags(dashboard)
    domains = _infer_domains(dashboard, advisory_surfaces)
    retrieval_context = build_summary_advisor_context(
        crop=crop,
        domains=domains,
    )
    model_runtime = _build_model_runtime_payload(
        crop=crop,
        dashboard=dashboard,
        tab_name="summary",
    )
    context_completeness = _context_completeness(dashboard)
    text = _build_summary_fallback_markdown(
        language=language,
        model_runtime=model_runtime,
        reason=reason,
    )
    display = build_advisory_display_payload(
        text,
        language=language,
        confidence=context_completeness,
    )
    structured_actions = [
        {"title": action, "message": action}
        for action in [*display.get("actions_now", []), *display.get("actions_today", [])]
    ]

    return {
        "status": "degraded",
        "family": "advisor_summary",
        "crop": crop,
        "text": text,
        "machine_payload": {
            "summary": "SmartGrow advisor summary fallback generated from deterministic model runtime context.",
            "domains": domains,
            "context_completeness": context_completeness,
            "actions": structured_actions,
            "missing_data": missing_data,
            "retrieval_context": retrieval_context.get("summary", {}),
            "advisory_surfaces": advisory_surfaces,
            "model_runtime": model_runtime,
            "display": display,
            "internal_provenance": _build_internal_provenance(
                catalog_payload,
                advisory_surfaces,
                retrieval_context=retrieval_context,
            ),
        },
    }


def _build_chat_answer_focus_markdown(
    *,
    model_runtime: dict[str, Any],
    language: str,
) -> str | None:
    focus = _coerce_dict(model_runtime.get("answer_focus"))
    if not focus or not focus.get("matched_user_request"):
        return None

    effects = _coerce_dict(focus.get("effects"))
    operator_summary = _coerce_dict(focus.get("operator_summary"))
    violations = focus.get("violated_constraints")
    violation_items = violations if isinstance(violations, list) else []
    confidence = _coerce_float(focus.get("confidence"))
    locale = "ko" if not language.lower().startswith("en") else "en"

    if locale == "ko":
        confidence_text = "추가 데이터 필요" if confidence is None else f"{confidence:.0%}"
        constraint_text = "제약 위반 없음" if not violation_items else f"제약 {len(violation_items)}건 확인 필요"
        return (
            "## 모델 계산 결과\n"
            f"- {focus.get('summary')}\n"
            f"- 수량 변화: 24시간 {_format_signed_delta(effects.get('yield_delta_24h'))}, "
            f"72시간 {_format_signed_delta(effects.get('yield_delta_72h'))}, "
            f"7일 {_format_signed_delta(effects.get('yield_delta_7d'))}, "
            f"14일 {_format_signed_delta(effects.get('yield_delta_14d'))}.\n"
            f"- 생리 반응: 72시간 군락 동화량 {_format_signed_delta(effects.get('canopy_delta_72h'))}, "
            f"공급/수요 균형 {_format_signed_delta(effects.get('source_sink_balance_delta'))}, "
            f"RTR {_format_signed_delta(effects.get('rtr_delta_72h'))}.\n"
            f"- 비용/리스크: 에너지 {_format_signed_delta(effects.get('energy_delta'))}, "
            f"습도 부담 {_format_signed_delta(effects.get('humidity_penalty_delta'))}, "
            f"병해 부담 {_format_signed_delta(effects.get('disease_penalty_delta'))}; "
            f"{constraint_text}, 계산 신뢰도 {confidence_text}.\n"
            f"- 해석: {operator_summary.get('why') or '모델 계산값을 기준으로 효과와 비용을 함께 비교했습니다.'}\n"
        )

    confidence_text = "missing data" if confidence is None else f"{confidence:.0%}"
    constraint_text = "no constraint violation" if not violation_items else f"{len(violation_items)} constraint checks need review"
    return (
        "## Model-calculated effect\n"
        f"- {focus.get('summary')}\n"
        f"- Yield change: 24h {_format_signed_delta(effects.get('yield_delta_24h'))}, "
        f"72h {_format_signed_delta(effects.get('yield_delta_72h'))}, "
        f"7d {_format_signed_delta(effects.get('yield_delta_7d'))}, "
        f"14d {_format_signed_delta(effects.get('yield_delta_14d'))}.\n"
        f"- Physiology: 72h canopy assimilation {_format_signed_delta(effects.get('canopy_delta_72h'))}, "
        f"supply/demand balance {_format_signed_delta(effects.get('source_sink_balance_delta'))}, "
        f"RTR {_format_signed_delta(effects.get('rtr_delta_72h'))}.\n"
        f"- Cost/risk: energy {_format_signed_delta(effects.get('energy_delta'))}, "
        f"humidity penalty {_format_signed_delta(effects.get('humidity_penalty_delta'))}, "
        f"disease penalty {_format_signed_delta(effects.get('disease_penalty_delta'))}; "
        f"{constraint_text}, confidence {confidence_text}.\n"
        f"- Interpretation: {operator_summary.get('why') or 'The process model compared effect and operating cost together.'}\n"
    )


def _prepend_chat_answer_focus(
    *,
    text: str,
    model_runtime: dict[str, Any],
    language: str,
) -> str:
    focus_markdown = _build_chat_answer_focus_markdown(
        model_runtime=model_runtime,
        language=language,
    )
    if not focus_markdown:
        return text
    return f"{focus_markdown}\n{text.lstrip()}"


def _build_chat_fallback_markdown(
    *,
    language: str,
    model_runtime: dict[str, Any],
    reason: str,
) -> str:
    locale = "ko" if not language.lower().startswith("en") else "en"
    focus_markdown = _build_chat_answer_focus_markdown(
        model_runtime=model_runtime,
        language=language,
    )
    if focus_markdown:
        suffix = (
            "## 답변 상태\n"
            "- 외부 LLM 문장 생성은 잠시 사용할 수 없어, 현재 화면의 모델 계산값으로 먼저 답변했습니다.\n"
            "- 수치 적용 전에는 최근 센서와 작업 기록이 최신인지 한 번 더 확인하세요.\n"
            if locale == "ko"
            else "## Answer status\n"
            "- External LLM wording is temporarily unavailable, so the current process-model calculation is shown first.\n"
            "- Confirm the latest telemetry and work-event records before applying numeric changes.\n"
        )
        return f"{focus_markdown}\n{suffix}"

    return _build_summary_fallback_markdown(
        language=language,
        model_runtime=model_runtime,
        reason=reason,
    )


def _format_optional_number(
    value: Any,
    *,
    digits: int = 1,
    suffix: str = "",
) -> str:
    numeric = _coerce_float(value)
    if numeric is None:
        return "추가 데이터 필요"
    return f"{numeric:.{digits}f}{suffix}"


def _is_node_status_question(messages: Optional[list[dict[str, str]]]) -> bool:
    latest_user_turn = _latest_user_transcript(messages)
    return any(term in latest_user_turn for term in ("마디", "마디수", "노드", "node", "nodes", "node count"))


def _build_current_state_chat_display_payload(
    *,
    model_runtime: dict[str, Any],
    messages: Optional[list[dict[str, str]]],
    language: str,
    confidence: float | None,
) -> dict[str, Any]:
    locale = "ko" if not language.lower().startswith("en") else "en"
    state = _coerce_dict(model_runtime.get("state_snapshot"))
    node_count = _coerce_float(state.get("node_count"))
    lai = _coerce_float(state.get("lai"))
    balance = _coerce_float(state.get("source_sink_balance"))
    canopy_a = _coerce_float(state.get("canopy_net_assimilation_umol_m2_s"))
    limiting_factor = _user_visible_limiting_factor(
        state.get("limiting_factor"),
        language=language,
    )

    if locale == "en":
        if _is_node_status_question(messages) and node_count is not None:
            summary = f"Current node count is {node_count:.0f}."
        else:
            summary = (
                f"Current growth status: LAI {_format_optional_number(lai, digits=2)}, "
                f"supply/demand balance {_format_optional_number(balance, digits=2)}, "
                f"canopy assimilation {_format_optional_number(canopy_a, digits=1, suffix=' umol')}, "
                f"main bottleneck {limiting_factor}."
            )
        monitor = [
            "Record node count, LAI, and canopy assimilation together at the next observation.",
            "Ask a separate what-if question when you want a control-change calculation.",
        ]
        sections = [
            {"key": "summary", "title": "Summary", "body": f"- {summary}"},
            {"key": "monitor", "title": "Monitor", "body": "\n".join(f"- {item}" for item in monitor)},
        ]
        return {
            "language": locale,
            "summary": summary,
            "risks": [],
            "actions_now": [],
            "actions_today": [],
            "actions_week": [],
            "monitor": monitor,
            "confidence": confidence,
            "sections": sections,
        }

    if _is_node_status_question(messages) and node_count is not None:
        summary = f"현재 마디수는 {node_count:.0f}개입니다."
    else:
        summary = (
            f"현재 생육은 잎면적 {_format_optional_number(lai, digits=2)}, "
            f"공급/수요 균형 {_format_optional_number(balance, digits=2)}, "
            f"군락 동화량 {_format_optional_number(canopy_a, digits=1, suffix=' µmol')}, "
            f"주요 병목 {limiting_factor} 기준으로 봅니다."
        )
    monitor = [
        "다음 관측 때 마디수, 잎면적, 군락 동화량을 같은 시간대에 같이 기록하세요.",
        "온도·CO2·습도를 바꾸면 어떤 효과가 나는지는 별도 what-if 질문으로 확인하세요.",
    ]
    sections = [
        {"key": "summary", "title": "핵심 요약", "body": f"- {summary}"},
        {"key": "monitor", "title": "모니터링", "body": "\n".join(f"- {item}" for item in monitor)},
    ]
    return {
        "language": locale,
        "summary": summary,
        "risks": [],
        "actions_now": [],
        "actions_today": [],
        "actions_week": [],
        "monitor": monitor,
        "confidence": confidence,
        "sections": sections,
    }


def _build_chat_display_payload(
    *,
    text: str,
    model_runtime: dict[str, Any],
    messages: Optional[list[dict[str, str]]],
    language: str,
    confidence: float | None,
) -> dict[str, Any]:
    if model_runtime.get("runtime_mode") == "current_state":
        return _build_current_state_chat_display_payload(
            model_runtime=model_runtime,
            messages=messages,
            language=language,
            confidence=confidence,
        )
    return build_advisory_display_payload(
        text,
        language=language,
        confidence=confidence,
    )


def _build_display_markdown(
    display: dict[str, Any],
    *,
    language: str,
) -> str:
    locale = "ko" if not language.lower().startswith("en") else "en"
    summary = str(display.get("summary") or "").strip()
    risks = [str(item) for item in display.get("risks", []) if str(item).strip()]
    actions = [
        str(item)
        for item in [
            *display.get("actions_now", []),
            *display.get("actions_today", []),
            *display.get("actions_week", []),
        ]
        if str(item).strip()
    ]
    monitor = [str(item) for item in display.get("monitor", []) if str(item).strip()]

    if locale == "en":
        sections = [f"## Summary\n- {summary or 'Current crop status was checked from the model snapshot.'}"]
        if actions:
            sections.append("## Recommended checks\n" + "\n".join(f"- {item}" for item in actions))
        if risks:
            sections.append("## Watch-outs\n" + "\n".join(f"- {item}" for item in risks))
        if monitor:
            sections.append("## Monitor\n" + "\n".join(f"- {item}" for item in monitor))
        return "\n\n".join(sections)

    sections = [f"## 핵심 요약\n- {summary or '현재 생육 상태를 모델 스냅샷 기준으로 확인했습니다.'}"]
    if actions:
        sections.append("## 확인할 내용\n" + "\n".join(f"- {item}" for item in actions))
    if risks:
        sections.append("## 주의할 점\n" + "\n".join(f"- {item}" for item in risks))
    if monitor:
        sections.append("## 모니터링\n" + "\n".join(f"- {item}" for item in monitor))
    return "\n\n".join(sections)


def build_advisor_chat_fallback_response(
    *,
    crop: str,
    messages: list[dict[str, str]],
    dashboard: Optional[dict[str, Any]] = None,
    language: str = "ko",
    reason: str = "openai_unavailable",
) -> dict[str, Any]:
    dashboard_payload = dashboard or {}
    catalog_payload = build_knowledge_catalog(crop)
    advisory_surfaces = catalog_payload.get("advisory_surfaces", {})
    retrieval_context = build_chat_advisor_context(
        crop=crop,
        messages=messages,
    )
    model_runtime = _build_model_runtime_payload(
        crop=crop,
        dashboard=dashboard_payload,
        tab_name="chat",
        messages=messages,
        language=language,
    )
    if model_runtime.get("runtime_mode") == "current_state":
        display = _build_chat_display_payload(
            text="",
            model_runtime=model_runtime,
            messages=messages,
            language=language,
            confidence=_context_completeness(dashboard_payload),
        )
        text = _build_display_markdown(display, language=language)
    else:
        text = _build_chat_fallback_markdown(
            language=language,
            model_runtime=model_runtime,
            reason=reason,
        )
        display = _build_chat_display_payload(
            text=text,
            model_runtime=model_runtime,
            messages=messages,
            language=language,
            confidence=_context_completeness(dashboard_payload),
        )

    return {
        "status": "degraded",
        "family": "advisor_chat",
        "crop": crop,
        "text": text,
        "machine_payload": {
            "domains": _infer_domains(dashboard_payload, advisory_surfaces),
            "context_completeness": _context_completeness(dashboard_payload),
            "missing_data": [
                *_collect_missing_data_flags(dashboard_payload),
                "openai_unavailable",
            ],
            "retrieval_context": retrieval_context.get("summary", {}),
            "model_runtime": model_runtime,
            "display": display,
            "internal_provenance": _build_internal_provenance(
                catalog_payload,
                advisory_surfaces,
                retrieval_context=retrieval_context,
            ),
        },
    }


def build_advisor_chat_response(
    *,
    crop: str,
    messages: list[dict[str, str]],
    dashboard: Optional[dict[str, Any]] = None,
    language: str = "ko",
) -> dict[str, Any]:
    dashboard_payload = dashboard or {}
    catalog_payload = build_knowledge_catalog(crop)
    advisory_surfaces = catalog_payload.get("advisory_surfaces", {})
    retrieval_context = build_chat_advisor_context(
        crop=crop,
        messages=messages,
    )
    model_runtime = _build_model_runtime_payload(
        crop=crop,
        dashboard=dashboard_payload,
        tab_name="chat",
        messages=messages,
        language=language,
    )
    if model_runtime.get("runtime_mode") == "current_state":
        display = _build_chat_display_payload(
            text="",
            model_runtime=model_runtime,
            messages=messages,
            language=language,
            confidence=_context_completeness(dashboard_payload),
        )
        text = _build_display_markdown(display, language=language)
        return {
            "status": "success",
            "family": "advisor_chat",
            "crop": crop,
            "text": text,
            "machine_payload": {
                "domains": _infer_domains(dashboard_payload, advisory_surfaces),
                "context_completeness": _context_completeness(dashboard_payload),
                "missing_data": _collect_missing_data_flags(dashboard_payload),
                "retrieval_context": retrieval_context.get("summary", {}),
                "model_runtime": model_runtime,
                "display": display,
                "internal_provenance": _build_internal_provenance(
                    catalog_payload,
                    advisory_surfaces,
                    retrieval_context=retrieval_context,
                ),
            },
        }

    llm_dashboard = _inject_model_runtime_context(
        _inject_advisor_retrieval_context(dashboard_payload, retrieval_context),
        model_runtime,
    )
    text = generate_chat_reply(
        crop=crop,
        messages=messages,
        dashboard=llm_dashboard,
        language=language,
    )
    text = _prepend_chat_answer_focus(
        text=text,
        model_runtime=model_runtime,
        language=language,
    )
    display = _build_chat_display_payload(
        text=text,
        model_runtime=model_runtime,
        messages=messages,
        language=language,
        confidence=_context_completeness(dashboard_payload),
    )

    return {
        "status": "success",
        "family": "advisor_chat",
        "crop": crop,
        "text": text,
        "machine_payload": {
            "domains": _infer_domains(dashboard_payload, advisory_surfaces),
            "context_completeness": _context_completeness(dashboard_payload),
            "missing_data": _collect_missing_data_flags(dashboard_payload),
            "retrieval_context": retrieval_context.get("summary", {}),
            "model_runtime": model_runtime,
            "display": display,
            "internal_provenance": _build_internal_provenance(
                catalog_payload,
                advisory_surfaces,
                retrieval_context=retrieval_context,
            ),
        },
    }


def build_advisor_tab_response(
    *,
    tab_name: str,
    crop: str,
    greenhouse_id: Optional[str] = None,
    target: Optional[str] = None,
    limit: int = 5,
    stage: Optional[str] = None,
    medium: Optional[str] = None,
    source_water_mmol_l: Optional[dict[str, float]] = None,
    drain_water_mmol_l: Optional[dict[str, float]] = None,
    working_solution_volume_l: Optional[float] = None,
    stock_ratio: Optional[float] = None,
    dashboard: Optional[dict[str, Any]] = None,
) -> dict[str, Any]:
    normalized_tab = _normalize_tab_name(tab_name)

    if normalized_tab == "pesticide":
        if not target:
            raise ValueError("The pesticide advisor tab requires a non-empty target.")

        payload = dict(
            build_pesticide_recommendation_response(
                crop=crop,
                target=target,
                limit=limit,
            )
        )
    elif normalized_tab == "nutrient":
        payload = dict(
            build_nutrient_recommendation_response(
                crop=crop,
                stage=stage,
                medium=medium,
            )
        )
    elif normalized_tab == "correction":
        payload = dict(
            build_nutrient_correction_response(
                crop=crop,
                stage=stage,
                medium=medium,
                source_water_mmol_l=source_water_mmol_l,
                drain_water_mmol_l=drain_water_mmol_l,
                working_solution_volume_l=working_solution_volume_l,
                stock_ratio=stock_ratio,
            )
        )
    elif normalized_tab == "environment":
        catalog_payload = build_knowledge_catalog(crop)
        advisory_surfaces = catalog_payload.get("advisory_surfaces", {})
        dashboard_payload = dashboard or {}
        missing_data = _collect_environment_missing_data_flags(dashboard_payload)
        environment_analysis = _build_environment_tab_payload(
            dashboard=dashboard_payload,
        )
        retrieval_context = build_tab_advisor_context(
            crop=crop,
            tab_name=normalized_tab,
        )
        payload = {
            "status": "success",
            "family": "advisor_tab",
            "crop": crop,
            "message": "환경 어드바이저를 현재 대시보드 문맥으로 생성했습니다.",
            "available_tabs": list(_LANDED_TABS),
            "machine_payload": {
                "missing_data": missing_data,
                "advisory_surfaces": advisory_surfaces,
                "advisor_actions": _build_environment_advisor_actions(environment_analysis),
                "retrieval_context": retrieval_context.get("summary", {}),
                "knowledge_evidence": (
                    retrieval_context.get("llm_context")
                    if retrieval_context.get("status") == "ready"
                    else None
                ),
                "model_runtime": _build_model_runtime_payload(
                    crop=crop,
                    dashboard=dashboard_payload,
                    tab_name=normalized_tab,
                ),
                "environment_analysis": environment_analysis,
                "internal_provenance": _build_internal_provenance(
                    catalog_payload,
                    advisory_surfaces,
                    retrieval_context=retrieval_context,
                ),
            },
        }
    elif normalized_tab == "physiology":
        catalog_payload = build_knowledge_catalog(crop)
        advisory_surfaces = catalog_payload.get("advisory_surfaces", {})
        dashboard_payload = dashboard or {}
        retrieval_context = build_tab_advisor_context(
            crop=crop,
            tab_name=normalized_tab,
        )
        payload = {
            "status": "success",
            "family": "advisor_tab",
            "crop": crop,
            "message": "생리 어드바이저를 현재 대시보드 문맥으로 생성했습니다.",
            "available_tabs": list(_LANDED_TABS),
            "machine_payload": {
                "missing_data": _collect_physiology_missing_data_flags(dashboard_payload),
                "advisory_surfaces": advisory_surfaces,
                "retrieval_context": retrieval_context.get("summary", {}),
                "knowledge_evidence": (
                    retrieval_context.get("llm_context")
                    if retrieval_context.get("status") == "ready"
                    else None
                ),
                "model_runtime": _build_model_runtime_payload(
                    crop=crop,
                    dashboard=dashboard_payload,
                    tab_name=normalized_tab,
                ),
                "physiology_analysis": _build_physiology_tab_payload(
                    crop=crop,
                    dashboard=dashboard_payload,
                ),
                "internal_provenance": _build_internal_provenance(
                    catalog_payload,
                    advisory_surfaces,
                    retrieval_context=retrieval_context,
                ),
            },
        }
    elif normalized_tab == "work":
        catalog_payload = build_knowledge_catalog(crop)
        advisory_surfaces = catalog_payload.get("advisory_surfaces", {})
        dashboard_payload = dashboard or {}
        work_analysis = _build_work_tab_payload(
            crop=crop,
            dashboard=dashboard_payload,
        )
        work_event_compare = _build_work_event_compare_payload(
            crop,
            greenhouse_id=greenhouse_id,
        )
        retrieval_context = build_tab_advisor_context(
            crop=crop,
            tab_name=normalized_tab,
        )
        internal_provenance = _build_internal_provenance(
            catalog_payload,
            advisory_surfaces,
            retrieval_context=retrieval_context,
        )
        internal_provenance["work_event_compare"] = work_event_compare["internal_provenance"]
        payload = {
            "status": "success",
            "family": "advisor_tab",
            "crop": crop,
            "message": "작업 어드바이저를 현재 대시보드 문맥으로 생성했습니다.",
            "available_tabs": list(_LANDED_TABS),
            "machine_payload": {
                "missing_data": _collect_work_missing_data_flags(dashboard_payload),
                "advisory_surfaces": advisory_surfaces,
                "advisor_actions": _build_work_advisor_actions(work_analysis),
                "retrieval_context": retrieval_context.get("summary", {}),
                "knowledge_evidence": (
                    retrieval_context.get("llm_context")
                    if retrieval_context.get("status") == "ready"
                    else None
                ),
                "model_runtime": _build_model_runtime_payload(
                    crop=crop,
                    dashboard=dashboard_payload,
                    tab_name=normalized_tab,
                ),
                "work_analysis": work_analysis,
                "work_event_compare": work_event_compare["payload"],
                "internal_provenance": internal_provenance,
            },
        }
    elif normalized_tab == "harvest_market":
        catalog_payload = build_knowledge_catalog(crop)
        advisory_surfaces = catalog_payload.get("advisory_surfaces", {})
        dashboard_payload = dashboard or {}
        retrieval_context = build_tab_advisor_context(
            crop=crop,
            tab_name=normalized_tab,
        )
        payload = {
            "status": "success",
            "family": "advisor_tab",
            "crop": crop,
            "message": "수확/가격 어드바이저를 현재 대시보드 문맥으로 생성했습니다.",
            "available_tabs": list(_LANDED_TABS),
            "machine_payload": {
                "missing_data": _collect_harvest_market_missing_data_flags(dashboard_payload),
                "advisory_surfaces": advisory_surfaces,
                "retrieval_context": retrieval_context.get("summary", {}),
                "knowledge_evidence": (
                    retrieval_context.get("llm_context")
                    if retrieval_context.get("status") == "ready"
                    else None
                ),
                "model_runtime": _build_model_runtime_payload(
                    crop=crop,
                    dashboard=dashboard_payload,
                    tab_name=normalized_tab,
                ),
                "harvest_market_analysis": _build_harvest_market_tab_payload(
                    crop=crop,
                    dashboard=dashboard_payload,
                ),
                "internal_provenance": _build_internal_provenance(
                    catalog_payload,
                    advisory_surfaces,
                    retrieval_context=retrieval_context,
                ),
            },
        }
    elif normalized_tab in _PLANNED_TABS:
        catalog_payload = build_knowledge_catalog(crop)
        advisory_surfaces = catalog_payload.get("advisory_surfaces", {})
        return {
            "status": "pending",
            "family": "advisor_tab",
            "crop": crop,
            "tab_name": normalized_tab,
            "message": _PLANNED_TABS[normalized_tab],
            "available_tabs": list(_LANDED_TABS),
            "machine_payload": {
                "missing_data": ["deterministic_orchestration_not_landed"],
                "advisory_surfaces": advisory_surfaces,
                "model_runtime": _build_unavailable_model_runtime_payload(
                    tab_name=normalized_tab,
                    reason="준비 중인 탭은 실제 계산 엔진이 연결되기 전까지 예측 모델 분석을 붙이지 않습니다.",
                ),
                "internal_provenance": _build_internal_provenance(
                    catalog_payload,
                    advisory_surfaces,
                ),
            },
        }
    else:
        raise ValueError(
            f"Unsupported advisor tab '{tab_name}'. Supported tabs: {', '.join(_SUPPORTED_TABS)}"
        )

    payload["tab_name"] = normalized_tab
    payload["orchestration"] = {
        "entrypoint": _public_tab_entrypoint(normalized_tab),
        "available_tabs": list(_LANDED_TABS),
    }
    return payload


def _build_dedicated_recommendation_response(
    *,
    family: str,
    entrypoint: str,
    tab_name: str,
    crop: str,
    greenhouse_id: Optional[str] = None,
    dashboard: Optional[dict[str, Any]] = None,
) -> dict[str, Any]:
    payload = dict(
        build_advisor_tab_response(
            tab_name=tab_name,
            crop=crop,
            greenhouse_id=greenhouse_id,
            dashboard=dashboard,
        )
    )
    orchestration = dict(payload.get("orchestration", {}))
    delegated_entrypoint = orchestration.get("entrypoint")
    orchestration["entrypoint"] = entrypoint
    if delegated_entrypoint and delegated_entrypoint != entrypoint:
        orchestration["delegates_to"] = delegated_entrypoint
    payload["family"] = family
    payload["orchestration"] = orchestration
    return payload


def build_environment_recommendation_response(
    *,
    crop: str,
    dashboard: Optional[dict[str, Any]] = None,
) -> dict[str, Any]:
    return _build_dedicated_recommendation_response(
        family="environment_recommendation",
        entrypoint="/api/environment/recommend",
        tab_name="environment",
        crop=crop,
        dashboard=dashboard,
    )


def build_work_recommendation_response(
    *,
    crop: str,
    dashboard: Optional[dict[str, Any]] = None,
) -> dict[str, Any]:
    return _build_dedicated_recommendation_response(
        family="work_recommendation",
        entrypoint="/api/work/recommend",
        tab_name="work",
        crop=crop,
        dashboard=dashboard,
    )


def build_environment_advisor_response(
    *,
    crop: str,
    greenhouse_id: Optional[str] = None,
    dashboard: Optional[dict[str, Any]] = None,
) -> dict[str, Any]:
    return _build_dedicated_recommendation_response(
        family="advisor_environment",
        entrypoint="/api/advisor/environment",
        tab_name="environment",
        crop=crop,
        greenhouse_id=greenhouse_id,
        dashboard=dashboard,
    )


def build_physiology_advisor_response(
    *,
    crop: str,
    greenhouse_id: Optional[str] = None,
    dashboard: Optional[dict[str, Any]] = None,
) -> dict[str, Any]:
    return _build_dedicated_recommendation_response(
        family="advisor_physiology",
        entrypoint="/api/advisor/physiology",
        tab_name="physiology",
        crop=crop,
        greenhouse_id=greenhouse_id,
        dashboard=dashboard,
    )


def build_harvest_advisor_response(
    *,
    crop: str,
    greenhouse_id: Optional[str] = None,
    dashboard: Optional[dict[str, Any]] = None,
) -> dict[str, Any]:
    return _build_dedicated_recommendation_response(
        family="advisor_harvest",
        entrypoint="/api/advisor/harvest",
        tab_name="harvest_market",
        crop=crop,
        greenhouse_id=greenhouse_id,
        dashboard=dashboard,
    )


def build_work_tradeoff_advisor_response(
    *,
    crop: str,
    greenhouse_id: Optional[str] = None,
    dashboard: Optional[dict[str, Any]] = None,
) -> dict[str, Any]:
    payload = _build_dedicated_recommendation_response(
        family="advisor_work_tradeoff",
        entrypoint="/api/advisor/work-tradeoff",
        tab_name="work",
        crop=crop,
        greenhouse_id=greenhouse_id,
        dashboard=dashboard,
    )
    machine_payload = payload.get("machine_payload", {})
    compare_payload = machine_payload.get("work_event_compare", {})
    work_analysis = machine_payload.get("work_analysis", {})
    return {
        "status": payload.get("status", "success"),
        "family": "advisor_work_tradeoff",
        "crop": crop,
        "summary": compare_payload.get("summary")
        or work_analysis.get("summary")
        or payload.get("message"),
        "current_state": compare_payload.get("current_state", {}),
        "options": compare_payload.get("options", []),
        "recommended_action": compare_payload.get("recommended_action"),
        "confidence": compare_payload.get("confidence", work_analysis.get("confidence", 0.0)),
        "analysis": work_analysis,
        "model_runtime": machine_payload.get("model_runtime"),
        "orchestration": payload.get("orchestration", {}),
    }
