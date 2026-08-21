"""Resolve one authoritative current greenhouse snapshot for an advisor run.

The browser is a transport, not the authority for recency.  This module compares
the request snapshot with the latest server-owned telemetry point, selects the
newest usable observation, and only fills missing fields when both observations
are close enough in time to be considered one state.
"""

from __future__ import annotations

import copy
from datetime import UTC, datetime
from typing import Any


CURRENT_SIGNAL_KEYS = (
    "temperature",
    "canopyTemp",
    "humidity",
    "co2",
    "light",
    "vpd",
    "soilMoisture",
    "transpiration",
    "stomatalConductance",
    "photosynthesis",
)


def _dict(value: Any) -> dict[str, Any]:
    return value if isinstance(value, dict) else {}


def parse_observation_time(value: Any) -> datetime | None:
    if isinstance(value, datetime):
        return value.astimezone(UTC) if value.tzinfo else value.replace(tzinfo=UTC)
    if isinstance(value, (int, float)):
        number = float(value)
        if number > 1e12:
            number /= 1000.0
        try:
            return datetime.fromtimestamp(number, tz=UTC)
        except (OSError, OverflowError, ValueError):
            return None
    if isinstance(value, str) and value.strip():
        try:
            parsed = datetime.fromisoformat(value.strip().replace("Z", "+00:00"))
        except ValueError:
            return None
        return parsed.astimezone(UTC) if parsed.tzinfo else parsed.replace(tzinfo=UTC)
    return None


def observation_time(payload: dict[str, Any]) -> datetime | None:
    for key in ("datetime", "timestamp", "t", "observed_at"):
        parsed = parse_observation_time(payload.get(key))
        if parsed is not None:
            return parsed
    return None


def signal_coverage(payload: dict[str, Any]) -> float:
    if not payload:
        return 0.0
    present = sum(payload.get(key) is not None for key in CURRENT_SIGNAL_KEYS)
    return present / len(CURRENT_SIGNAL_KEYS)


def _age_seconds(
    timestamp: datetime | None,
    now: datetime,
    *,
    max_future_skew_seconds: float = 120.0,
) -> float | None:
    if timestamp is None:
        return None
    delta = (now.astimezone(UTC) - timestamp.astimezone(UTC)).total_seconds()
    if delta < -max_future_skew_seconds:
        return None
    return max(0.0, delta)


def resolve_dashboard_snapshot(
    dashboard: dict[str, Any],
    server_latest: dict[str, Any] | None,
    *,
    now: datetime,
    fresh_age_seconds: float = 15 * 60,
    merge_skew_seconds: float = 5 * 60,
) -> tuple[dict[str, Any], dict[str, Any]]:
    """Return a dashboard with one resolved ``currentData`` and its audit metadata.

    Selection rules are deterministic:

    * a fresh server observation supersedes an absent, stale, or older browser point;
    * otherwise the browser point remains primary;
    * the secondary point may fill missing signals only when timestamps differ by no
      more than ``merge_skew_seconds``;
    * stale server state is never laundered into a fresh browser state.
    """

    resolved_dashboard = copy.deepcopy(dashboard)
    browser = copy.deepcopy(
        _dict(resolved_dashboard.get("currentData") or resolved_dashboard.get("data"))
    )
    server = copy.deepcopy(_dict(server_latest))

    browser_time = observation_time(browser)
    server_time = observation_time(server)
    browser_age = _age_seconds(browser_time, now)
    server_age = _age_seconds(server_time, now)
    browser_coverage = signal_coverage(browser)
    server_coverage = signal_coverage(server)

    browser_fresh = browser_age is not None and browser_age <= fresh_age_seconds
    server_fresh = server_age is not None and server_age <= fresh_age_seconds

    server_newer = bool(
        server_time is not None
        and (
            browser_time is None
            or server_time.timestamp() > browser_time.timestamp() + 30.0
        )
    )
    use_server = bool(
        server
        and server_fresh
        and (
            not browser
            or not browser_fresh
            or server_newer
            or (
                browser_coverage < 0.3
                and server_coverage >= browser_coverage + 0.3
            )
        )
    )

    if use_server:
        primary = server
        secondary = browser
        source = "server"
        primary_time = server_time
        secondary_time = browser_time
    elif browser:
        primary = browser
        secondary = server
        source = "browser"
        primary_time = browser_time
        secondary_time = server_time
    elif server:
        primary = server
        secondary = {}
        source = "server_stale" if not server_fresh else "server"
        primary_time = server_time
        secondary_time = None
    else:
        primary = {}
        secondary = {}
        source = "unavailable"
        primary_time = None
        secondary_time = None

    resolved = copy.deepcopy(primary)
    filled_fields: list[str] = []
    merge_allowed = bool(
        secondary
        and primary_time is not None
        and secondary_time is not None
        and abs((primary_time - secondary_time).total_seconds()) <= merge_skew_seconds
    )
    if merge_allowed:
        for key in CURRENT_SIGNAL_KEYS:
            if resolved.get(key) is None and secondary.get(key) is not None:
                resolved[key] = secondary[key]
                filled_fields.append(key)

    if resolved:
        resolved_dashboard["currentData"] = resolved
        resolved_dashboard.pop("data", None)
    else:
        resolved_dashboard["currentData"] = {}

    selected_time = observation_time(resolved)
    selected_age = _age_seconds(selected_time, now)
    metadata = {
        "status": "ready" if resolved else "unavailable",
        "source": "merged" if filled_fields else source,
        "primary_source": source,
        "browser_observation_at": (
            browser_time.isoformat() if browser_time is not None else None
        ),
        "server_observation_at": (
            server_time.isoformat() if server_time is not None else None
        ),
        "selected_observation_at": (
            selected_time.isoformat() if selected_time is not None else None
        ),
        "snapshot_age_seconds": (
            round(selected_age, 3) if selected_age is not None else None
        ),
        "browser_age_seconds": (
            round(browser_age, 3) if browser_age is not None else None
        ),
        "server_age_seconds": (
            round(server_age, 3) if server_age is not None else None
        ),
        "browser_coverage": round(browser_coverage, 4),
        "server_coverage": round(server_coverage, 4),
        "resolved_coverage": round(signal_coverage(resolved), 4),
        "filled_fields": filled_fields,
        "merge_skew_seconds": merge_skew_seconds,
        "fresh_age_seconds": fresh_age_seconds,
        "browser_timestamp_invalid": bool(browser and browser_time is None),
        "server_timestamp_invalid": bool(server and server_time is None),
        "browser_current_should_persist": bool(browser and source != "server"),
    }
    resolved_dashboard["_adaptive_snapshot_resolution"] = metadata
    return resolved_dashboard, metadata
