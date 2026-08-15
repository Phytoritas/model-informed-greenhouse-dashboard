"""Holiday- and arrival-volume-aware market supply shock model."""

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


class MarketObservationStore:
    """Append-only market arrival and price observations."""

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
                    json.dumps(observation.metadata, ensure_ascii=False, sort_keys=True),
                    digest,
                    datetime.now(UTC).isoformat(),
                ),
            )
        return {"inserted": cursor.rowcount == 1, "content_sha256": digest}

    def append_many(self, observations: list[MarketArrivalObservation]) -> dict[str, Any]:
        inserted = 0
        for observation in observations:
            inserted += int(self.append(observation)["inserted"])
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
                FROM market_observations
                WHERE {' AND '.join(clauses)}
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
            count = int(connection.execute("SELECT COUNT(*) FROM market_observations").fetchone()[0])
        return {"status": "ready", "path": str(self.path), "observation_count": count}


def _weekday_baseline(
    rows: list[dict[str, Any]],
    forecast_date: date,
) -> tuple[float | None, int]:
    same_weekday = [
        float(row["arrival_volume_kg"])
        for row in rows
        if date.fromisoformat(str(row["observation_date"])).weekday() == forecast_date.weekday()
        and date.fromisoformat(str(row["observation_date"])) < forecast_date
    ]
    if len(same_weekday) >= 3:
        return _median(same_weekday[-12:]), len(same_weekday[-12:])
    all_prior = [
        float(row["arrival_volume_kg"])
        for row in rows
        if date.fromisoformat(str(row["observation_date"])) < forecast_date
    ]
    return _median(all_prior[-28:]), len(all_prior[-28:])


def _estimate_elasticity(rows: list[dict[str, Any]]) -> tuple[float, str, int]:
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

    xs = [math.log(volume) for volume, _price in pairs[-90:]]
    ys = [math.log(price) for _volume, price in pairs[-90:]]
    x_mean = statistics.fmean(xs)
    y_mean = statistics.fmean(ys)
    denominator = sum((x - x_mean) ** 2 for x in xs)
    if denominator <= 1e-12:
        return -0.45, "conservative_prior", len(pairs)
    slope = sum((x - x_mean) * (y - y_mean) for x, y in zip(xs, ys)) / denominator
    # Supply/price relation should not be allowed to turn into an implausible
    # positive causal claim merely because the observational sample is confounded.
    return max(-1.5, min(-0.05, slope)), "historical_log_log", len(pairs)


def _closed_days(
    operations: dict[str, Any],
    *,
    start: date,
    end: date,
) -> set[date]:
    closed: set[date] = set()
    events_by_type = operations.get("events_by_type") or {}
    for event_type in ("MARKET_CLOSURE", "SHIPMENT_BLACKOUT", "HOLIDAY"):
        for event in events_by_type.get(event_type, []):
            event_start = date.fromisoformat(str(event["start_date"]))
            event_end = date.fromisoformat(str(event["end_date"]))
            cursor = max(event_start, start)
            while cursor <= min(event_end, end):
                closed.add(cursor)
                cursor += timedelta(days=1)
    return closed


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
    """Estimate post-closure arrival concentration and bounded price pressure."""
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
    closed = _closed_days(
        operations,
        start=forecast_start - timedelta(days=7),
        end=forecast_end,
    )
    elasticity, elasticity_source, elasticity_samples = _estimate_elasticity(rows)

    explicit_targets: dict[date, float] = {}
    for event in (operations.get("events_by_type") or {}).get("SHIPMENT_TARGET", []):
        amount = event.get("amount")
        unit = str(event.get("unit") or "").lower()
        if amount is None or unit not in {"kg", "kilogram", "kilograms"}:
            continue
        event_date = date.fromisoformat(str(event["start_date"]))
        explicit_targets[event_date] = explicit_targets.get(event_date, 0.0) + float(amount)

    release_weights = (0.65, 0.25, 0.10)
    backlog_pool = 0.0
    daily: list[dict[str, Any]] = []
    prior_baseline_samples: list[int] = []
    for offset in range(horizon_days):
        day = forecast_start + timedelta(days=offset)
        baseline, sample_count = _weekday_baseline(rows, day)
        prior_baseline_samples.append(sample_count)
        baseline_value = float(baseline or 0.0)

        if day in closed:
            # Observed arrivals that cannot clear on a closed day are carried into
            # the next open sessions. The carryover is conservative rather than 100%.
            backlog_pool += baseline_value * 0.82
            daily.append(
                {
                    "date": day.isoformat(),
                    "market_open": False,
                    "baseline_arrival_kg": round(baseline_value, 3),
                    "expected_arrival_kg": 0.0,
                    "shock_ratio": 0.0,
                    "risk_level": "closed",
                    "price_pressure_pct": None,
                    "price_pressure_range_pct": None,
                    "explicit_shipment_kg": round(explicit_targets.get(day, 0.0), 3),
                }
            )
            backlog_pool += explicit_targets.get(day, 0.0)
            continue

        release = 0.0
        if backlog_pool > 0:
            release = backlog_pool * release_weights[0]
            backlog_pool -= release
        explicit = explicit_targets.get(day, 0.0)
        expected = baseline_value + release + explicit
        shock_ratio = expected / baseline_value if baseline_value > 0 else 1.0
        log_change = math.log(max(shock_ratio, 1e-6))
        pressure = 100.0 * (math.exp(elasticity * log_change) - 1.0)
        uncertainty = 4.0 if elasticity_source == "historical_log_log" else 9.0
        daily.append(
            {
                "date": day.isoformat(),
                "market_open": True,
                "baseline_arrival_kg": round(baseline_value, 3),
                "expected_arrival_kg": round(expected, 3),
                "released_backlog_kg": round(release, 3),
                "explicit_shipment_kg": round(explicit, 3),
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
    peak = max(open_days, key=lambda row: float(row["shock_ratio"]), default=None)
    observation_count = len(rows)
    baseline_support = max(prior_baseline_samples, default=0)
    confidence = min(
        0.92,
        0.20
        + min(observation_count / 56.0, 0.35)
        + min(baseline_support / 12.0, 0.20)
        + (0.12 if elasticity_source == "historical_log_log" else 0.0)
        + (0.05 if operations.get("revision", 0) > 0 else 0.0),
    )
    if observation_count == 0:
        status = "unavailable"
    elif observation_count < 8 or baseline_support < 3:
        status = "partial"
    else:
        status = "ready"

    seasonal_context = dashboard_market or {}
    return {
        "status": status,
        "model": "holiday-arrival-supply-shock.v1",
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
        "peak_shock": peak,
        "daily": daily,
        "confidence": round(confidence, 4),
        "seasonal_market_context": seasonal_context,
        "assumptions": [
            "closed-day arrivals carry over at 82 percent",
            "backlog release is front-loaded over subsequent open sessions",
            "price pressure is an elasticity-based scenario, not a quoted market forecast",
            "explicit shipment targets are included only when registered in kilograms",
        ],
    }
