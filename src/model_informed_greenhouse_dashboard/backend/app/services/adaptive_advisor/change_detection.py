"""Material-change detection for adaptive re-analysis triggers."""

from __future__ import annotations

import hashlib
import json
from typing import Any

from .contracts import MaterialChangeDecision


_DOMAIN_KEYS = {
    "telemetry": ("currentData", "data", "metrics", "recentSummary"),
    "weather": ("weather",),
    "market": ("market", "producePrices", "prices"),
    "operations": ("operations", "operations_calendar"),
    "forecast": ("forecast", "rtr"),
}


def _canonical(value: Any) -> str:
    return json.dumps(
        value,
        ensure_ascii=False,
        sort_keys=True,
        separators=(",", ":"),
        default=str,
    )


def fingerprint_snapshot(payload: dict[str, Any]) -> str:
    return hashlib.sha256(_canonical(payload).encode("utf-8")).hexdigest()


def _pick(payload: dict[str, Any], keys: tuple[str, ...]) -> Any:
    for key in keys:
        if key in payload:
            return payload.get(key)
    return None


def detect_material_change(
    previous: dict[str, Any],
    current: dict[str, Any],
) -> MaterialChangeDecision:
    previous_fp = fingerprint_snapshot(previous)
    current_fp = fingerprint_snapshot(current)
    if previous_fp == current_fp:
        return MaterialChangeDecision(
            rerun_required=False,
            reasons=[],
            changed_domains=[],
            previous_fingerprint=previous_fp,
            current_fingerprint=current_fp,
        )

    changed_domains: list[str] = []
    reasons: list[str] = []
    for domain, keys in _DOMAIN_KEYS.items():
        before = _pick(previous, keys)
        after = _pick(current, keys)
        if _canonical(before) != _canonical(after):
            changed_domains.append(domain)
            reasons.append(f"{domain} context changed")

    # Unknown top-level changes remain material instead of being silently ignored.
    if not changed_domains:
        changed_domains.append("other")
        reasons.append("unclassified dashboard context changed")

    priority_domains = {"market", "operations", "forecast", "weather"}
    if priority_domains.intersection(changed_domains):
        reasons.append("a planning context changed; invalidate prior operational advice")

    return MaterialChangeDecision(
        rerun_required=True,
        reasons=reasons,
        changed_domains=changed_domains,
        previous_fingerprint=previous_fp,
        current_fingerprint=current_fp,
    )
