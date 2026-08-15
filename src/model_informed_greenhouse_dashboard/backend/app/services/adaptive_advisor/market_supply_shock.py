"""Holiday-, closure-, and arrival-volume-aware market supply shock model."""

from __future__ import annotations

import hashlib
import json
import math
import os
import sqlite3
import statistics
import threading
from datetime import UTC, date, datetime, timedelta
from pathlib import Path
from typing import Any

from .contracts import MarketArrivalObservation
from .operations_calendar import OperationsCalendarStore


_RELEASE_WEIGHTS = (0.65, 0.25, 0.10)


def _median(values: list[float]) -> float | None:
    return float(statistics.median(values)) if values else None


def _risk_level(shock_ratio: float) -> str:
    if shock_ratio >= 1.45:
        return "very_high"
    if shock_ratio >= 1.25:
        return "high"
    if shock_ratio >= 1.10:
        return "elevated"
    if shock_ratio <= 0.80:
        return "short_supply"
    return "normal"


def _truthy(value: Any) -> bool:
    if isinstance(value, bool):
        return value
    return str(value or "").strip().lower() in {"1", "true", "yes", "y", "on"}


class MarketObservationStore:
    """Append-only daily market observations with latest-revision reads."""

    _lock = threading.RLock()

    def __init__(self, path: str | Path | None = None) -> None:
        configured = path or os.getenv("SMARTGROW_MARKET_OBSERVATION_DB_PATH")
        self.path = Path(configured or "artifacts/market/arrival_observations.sqlite3")
        self._initialize()

    def _connect(self) -> sqlite3.Connection:
        self.path.parent.mkdir(parents=True, exist_ok=True)
        connection = sqlite3.connect(self.path, timeout=30.0)
        connection.row_factory = sqlite3.Row
        connection.execute("PRAGMA journal_mode=WAL")
        connection.execute("PRAGMA synchronous=FULL")
        connection.execute("PRAGMA busy_timeout=30000")
        return connection

    def _initialize(self) -> None:
        with self._lock, self._connect() as connection:
            connection.executescript(
                """
                CREATE TABLE IF NOT EXISTS market_observations (
                    observation_id INTEGER PRIMARY KEY AUTOINCREMENT,
                    market_id TEXT NOT NULL,
                    crop TEXT NOT NULL,
                    observation_date TEXT NOT NULL,
                    arrival_volume_kg REAL NOT NULL,
                    wholesale_price_krw_per_kg REAL,
                    source TEXT NOT NULL,
                    metadata_json TEXT NOT NULL,
                    content_sha256 TEXT NOT NULL UNIQUE,
                    created_at TEXT NOT NULL
                );
                CREATE INDEX IF NOT EXISTS ix_market_observation_lookup
                    ON market_observations(market_id, crop, observation_date);
                """
            )

    def append(self, observation: MarketArrivalObservation) -> dict[str, Any]:
        payload = observation.model_dump(mode="json")
        blob = json.dumps(
            payload,
            ensure_ascii=False,
            sort_keys=True,
            separators=(",", ":"),
        )
        digest = hashlib.sha256(blob.encode("utf-8")).hexdigest()
        with self._lock, self._connect() as connection:
            cursor = connection.execute(
                """
                INSERT OR IGNORE INTO market_observations(
                    market_id, crop, observation_date, arrival_volume_kg,
                    wholesale_price_krw_per_kg, source, metadata_json,
                    content_sha256, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    observation.market_id,
                    observation.crop,
                    observation.observation_date.isoformat(),
                    observation.arrival_volume_kg,
                    observation.wholesale_price_krw_per_kg,
                    observation.source,
                    json.dumps(
                        observation.metadata,
                        ensure_ascii=False,
                        sort_keys=True,
                    ),
                    digest,
                    datetime.now(UTC).isoformat(),
                ),
            )
        return {"inserted": cursor.rowcount == 1, "content_sha256": digest}

    def append_many(
        self,
        observations: list[MarketArrivalObservation],
    ) -> dict[str, Any]:
        inserted = sum(int(self.append(item)["inserted"]) for item in observations)
        return {
            "inserted": inserted,
            "duplicates": len(observations) - inserted,
            "total": len(observations),
        }

    def list(
        self,
        *,
        market_id: str,
        crop: str,
        start: date | None = None,
        end: date | None = None,
        limit: int = 2000,
    ) -> list[dict[str, Any]]:
        """Return the latest appended revision for each market/crop/date."""

        clauses = ["market_id = ?", "crop = ?"]
        params: list[Any] = [market_id, crop]
        if start is not None:
            clauses.append("observation_date >= ?")
            params.append(start.isoformat())
        if end is not None:
            clauses.append("observation_date <= ?")
            params.append(end.isoformat())
        params.append(max(1, min(limit, 100000)))
        with self._connect() as connection:
            rows = connection.execute(
                f"""
                SELECT market_id, crop, observation_date, arrival_volume_kg,
                       wholesale_price_krw_per_kg, source, metadata_json
                FROM (
                    SELECT market_id, crop, observation_date, arrival_volume_kg,
                           wholesale_price_krw_per_kg, source, metadata_json,
                           ROW_NUMBER() OVER (
                               PARTITION BY market_id, crop, observation_date
                               ORDER BY created_at DESC, observation_id DESC
                           ) AS revision_rank
                    FROM market_observations
                    WHERE {' AND '.join(clauses)}
                )
                WHERE revision_rank = 1
                ORDER BY observation_date ASC
                LIMIT ?
                """,
                tuple(params),
            ).fetchall()
        return [
            {
                "market_id": row["market_id"],
                "crop": row["crop"],
                "observation_date": row["observation_date"],
                "arrival_volume_kg": float(row["arrival_volume_kg"]),
                "wholesale_price_krw_per_kg": (
                    None
                    if row["wholesale_price_krw_per_kg"] is None
                    else float(row["wholesale_price_krw_per_kg"])
                ),
                "source": row["source"],
                "metadata": json.loads(row["metadata_json"]),
            }
            for row in rows
        ]

    def describe(self) -> dict[str, Any]:
        with self._connect() as connection:
            count = int(
                connection.execute(
                    "SELECT COUNT(*) FROM market_observations"
                ).fetchone()[0]
            )
            canonical_count = int(
                connection.execute(
                    """
                    SELECT COUNT(*) FROM (
                        SELECT 1
                        FROM market_observations
                        GROUP BY market_id, crop, observation_date
                    )
                    """
                ).fetchone()[0]
            )
        return {
            "status": "ready",
            "path": str(self.path),
            "observation_count": count,
            "canonical_daily_count": canonical_count,
        }


def _weekday_baseline(
    rows: list[dict[str, Any]],
    forecast_date: date,
) -> tuple[float | None, int]:
    same_weekday = [
        float(row["arrival_volume_kg"])
        for row in rows
        if date.fromisoformat(str(row["observation_date"])).weekday()
        == forecast_date.weekday()
        and date.fromisoformat(str(row["observation_date"])) < forecast_date
    ]
    if len(same_weekday) >= 3:
        values = same_weekday[-12:]
        return _median(values), len(values)
    all_prior = [
        float(row["arrival_volume_kg"])
        for row in rows
        if date.fromisoformat(str(row["observation_date"])) < forecast_date
    ]
    values = all_prior[-28:]
    return _median(values), len(values)


def _estimate_elasticity(
    rows: list[dict[str, Any]],
) -> tuple[float, str, int]:
    pairs = [
        (
            float(row["arrival_volume_kg"]),
            float(row["wholesale_price_krw_per_kg"]),
        )
        for row in rows
        if row.get("wholesale_price_krw_per_kg")
        and float(row["arrival_volume_kg"]) > 0
        and float(row["wholesale_price_krw_per_kg"]) > 0
    ]
    if len(pairs) < 8:
        return -0.45, "conservative_prior", len(pairs)

    pairs = pairs[-90:]
    xs = [math.log(volume) for volume, _price in pairs]
    ys = [math.log(price) for _volume, price in pairs]
    x_mean = statistics.fmean(xs)
    y_mean = statistics.fmean(ys)
    denominator = sum((value - x_mean) ** 2 for value in xs)
    if denominator <= 1e-12:
        return -0.45, "conservative_prior", len(pairs)
    slope = sum(
        (x - x_mean) * (y - y_mean)
        for x, y in zip(xs, ys)
    ) / denominator
    return max(-1.5, min(-0.05, slope)), "historical_log_log", len(pairs)


def _event_dates(
    event: dict[str, Any],
    *,
    start: date,
    end: date,
) -> set[date]:
    event_start = date.fromisoformat(str(event["start_date"]))
    event_end = date.fromisoformat(str(event["end_date"]))
    cursor = max(event_start, start)
    stop = min(event_end, end)
    result: set[date] = set()
    while cursor <= stop:
        result.add(cursor)
        cursor += timedelta(days=1)
    return result


def _calendar_day_sets(
    operations: dict[str, Any],
    *,
    start: date,
    end: date,
) -> tuple[set[date], set[date], list[str]]:
    """Separate market closure from one greenhouse's shipment blackout."""

    market_closed: set[date] = set()
    shipment_blackout: set[date] = set()
    assumptions: list[str] = []
    events = operations.get("events_by_type") or {}

    for event in events.get("MARKET_CLOSURE", []):
        market_closed.update(_event_dates(event, start=start, end=end))
    for event in events.get("SHIPMENT_BLACKOUT", []):
        shipment_blackout.update(_event_dates(event, start=start, end=end))

    for event in events.get("HOLIDAY", []):
        metadata = event.get("metadata") or {}
        scope = str(metadata.get("scope") or "").strip().lower()
        dates = _event_dates(event, start=start, end=end)
        if _truthy(metadata.get("market_closed")) or scope in {
            "market",
            "wholesale_market",
        }:
            market_closed.update(dates)
        elif _truthy(metadata.get("shipment_blackout")) or scope in {
            "greenhouse",
            "shipment",
            "farm",
        }:
            shipment_blackout.update(dates)
        else:
            assumptions.append(
                f"HOLIDAY {event.get('event_id')} was not treated as a market closure "
                "because metadata.market_closed or metadata.scope=market was absent"
            )
    return market_closed, shipment_blackout, assumptions


def _release_backlog(
    pool: float,
    stage: int,
) -> tuple[float, float, int]:
    if pool <= 0:
        return 0.0, 0.0, 0
    stage = max(0, min(stage, len(_RELEASE_WEIGHTS) - 1))
    remaining_weight = sum(_RELEASE_WEIGHTS[stage:])
    fraction = _RELEASE_WEIGHTS[stage] / max(remaining_weight, 1e-12)
    release = pool * fraction
    remaining = max(0.0, pool - release)
    next_stage = stage + 1
    if next_stage >= len(_RELEASE_WEIGHTS) or remaining <= 1e-6:
        release += remaining
        remaining = 0.0
        next_stage = 0
    return release, remaining, next_stage


def estimate_supply_shock(
    *,
    market_store: MarketObservationStore,
    calendar_store: OperationsCalendarStore,
    market_id: str,
    crop: str,
    greenhouse_id: str,
    forecast_start: date,
    horizon_days: int = 14,
    dashboard_market: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Estimate arrival concentration and bounded elasticity-based price pressure."""

    horizon_days = max(1, min(int(horizon_days), 31))
    forecast_end = forecast_start + timedelta(days=horizon_days - 1)
    rows = market_store.list(
        market_id=market_id,
        crop=crop,
        end=forecast_start - timedelta(days=1),
        limit=365,
    )
    operations = calendar_store.describe_window(
        greenhouse_id,
        start=forecast_start - timedelta(days=7),
        end=forecast_end,
    )
    market_closed, shipment_blackout, calendar_assumptions = _calendar_day_sets(
        operations,
        start=forecast_start - timedelta(days=7),
        end=forecast_end,
    )
    elasticity, elasticity_source, elasticity_samples = _estimate_elasticity(rows)

    explicit_targets: dict[date, float] = {}
    for event in (operations.get("events_by_type") or {}).get(
        "SHIPMENT_TARGET",
        [],
    ):
        amount = event.get("amount")
        unit = str(event.get("unit") or "").lower()
        if amount is None or unit not in {"kg", "kilogram", "kilograms"}:
            continue
        event_date = date.fromisoformat(str(event["start_date"]))
        explicit_targets[event_date] = (
            explicit_targets.get(event_date, 0.0) + float(amount)
        )

    market_backlog = 0.0
    market_release_stage = 0
    greenhouse_backlog = 0.0
    greenhouse_release_stage = 0
    daily: list[dict[str, Any]] = []
    baseline_support_values: list[int] = []

    for offset in range(horizon_days):
        day = forecast_start + timedelta(days=offset)
        baseline, support = _weekday_baseline(rows, day)
        baseline_support_values.append(support)
        baseline_value = float(baseline or 0.0)
        registered_shipment = explicit_targets.get(day, 0.0)
        is_market_closed = day in market_closed
        is_shipment_blackout = day in shipment_blackout

        if is_market_closed:
            market_backlog += baseline_value * 0.82
            greenhouse_backlog += registered_shipment
            market_release_stage = 0
            greenhouse_release_stage = 0
            daily.append(
                {
                    "date": day.isoformat(),
                    "market_open": False,
                    "market_closed": True,
                    "shipment_blackout": is_shipment_blackout,
                    "baseline_arrival_kg": round(baseline_value, 3),
                    "expected_arrival_kg": 0.0,
                    "shock_ratio": 0.0,
                    "risk_level": "closed",
                    "price_pressure_pct": None,
                    "price_pressure_range_pct": None,
                    "explicit_shipment_kg": round(registered_shipment, 3),
                    "deferred_registered_shipment_kg": round(
                        registered_shipment,
                        3,
                    ),
                }
            )
            continue

        if is_shipment_blackout and registered_shipment > 0:
            greenhouse_backlog += registered_shipment
            greenhouse_release_stage = 0
            explicit_today = 0.0
        else:
            explicit_today = registered_shipment

        market_release, market_backlog, market_release_stage = _release_backlog(
            market_backlog,
            market_release_stage,
        )
        greenhouse_release = 0.0
        if not is_shipment_blackout:
            (
                greenhouse_release,
                greenhouse_backlog,
                greenhouse_release_stage,
            ) = _release_backlog(
                greenhouse_backlog,
                greenhouse_release_stage,
            )

        expected = (
            baseline_value
            + market_release
            + greenhouse_release
            + explicit_today
        )
        shock_ratio = expected / baseline_value if baseline_value > 0 else 1.0
        log_change = math.log(max(shock_ratio, 1e-6))
        pressure = 100.0 * (math.exp(elasticity * log_change) - 1.0)
        base_uncertainty = (
            4.0 if elasticity_source == "historical_log_log" else 9.0
        )
        support_penalty = max(0.0, 3 - support) * 1.5
        uncertainty = base_uncertainty + support_penalty

        daily.append(
            {
                "date": day.isoformat(),
                "market_open": True,
                "market_closed": False,
                "shipment_blackout": is_shipment_blackout,
                "baseline_arrival_kg": round(baseline_value, 3),
                "expected_arrival_kg": round(expected, 3),
                "released_market_backlog_kg": round(market_release, 3),
                "released_greenhouse_backlog_kg": round(
                    greenhouse_release,
                    3,
                ),
                "released_backlog_kg": round(
                    market_release + greenhouse_release,
                    3,
                ),
                "explicit_shipment_kg": round(explicit_today, 3),
                "deferred_registered_shipment_kg": round(
                    registered_shipment - explicit_today,
                    3,
                ),
                "shock_ratio": round(shock_ratio, 4),
                "risk_level": _risk_level(shock_ratio),
                "price_pressure_pct": round(pressure, 3),
                "price_pressure_range_pct": [
                    round(pressure - uncertainty, 3),
                    round(pressure + uncertainty, 3),
                ],
            }
        )

    open_days = [row for row in daily if row["market_open"]]
    peak = max(
        open_days,
        key=lambda row: float(row["shock_ratio"]),
        default=None,
    )
    observation_count = len(rows)
    baseline_support = max(baseline_support_values, default=0)
    confidence = min(
        0.92,
        0.20
        + min(observation_count / 56.0, 0.35)
        + min(baseline_support / 12.0, 0.20)
        + (
            0.12
            if elasticity_source == "historical_log_log"
            else 0.0
        )
        + (0.05 if operations.get("revision", 0) > 0 else 0.0),
    )
    if observation_count == 0:
        status = "unavailable"
    elif observation_count < 8 or baseline_support < 3:
        status = "partial"
    else:
        status = "ready"

    return {
        "status": status,
        "model": "holiday-arrival-supply-shock.v2",
        "market_id": market_id,
        "crop": crop,
        "greenhouse_id": greenhouse_id,
        "forecast_window": {
            "start": forecast_start.isoformat(),
            "end": forecast_end.isoformat(),
        },
        "observation_count": observation_count,
        "baseline_support_count": baseline_support,
        "elasticity": round(elasticity, 4),
        "elasticity_source": elasticity_source,
        "elasticity_sample_count": elasticity_samples,
        "operations_revision": operations.get("revision", 0),
        "market_closed_dates": sorted(day.isoformat() for day in market_closed),
        "shipment_blackout_dates": sorted(
            day.isoformat() for day in shipment_blackout
        ),
        "peak_shock": peak,
        "daily": daily,
        "confidence": round(confidence, 4),
        "seasonal_market_context": dashboard_market or {},
        "assumptions": [
            "market-wide baseline carryover is applied only to MARKET_CLOSURE "
            "or explicitly market-scoped HOLIDAY events",
            "a greenhouse SHIPMENT_BLACKOUT defers registered greenhouse "
            "shipment targets but does not close the whole market",
            "closed-market baseline carryover is bounded at 82 percent",
            "backlog release follows explicit 65/25/10 percent open-session weights",
            "price pressure is an elasticity-based scenario, not a quoted market forecast",
            "explicit shipment targets are included only when registered in kilograms",
            *calendar_assumptions,
        ],
    }
