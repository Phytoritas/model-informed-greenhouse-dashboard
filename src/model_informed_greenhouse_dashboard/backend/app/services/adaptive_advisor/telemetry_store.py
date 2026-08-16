"""Server-owned greenhouse telemetry history independent of browser memory."""

from __future__ import annotations

import hashlib
import json
import os
import sqlite3
import threading
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Any

from .temporal_compare import compare_temporal_windows


_CANONICAL_KEYS = (
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
    "hFlux",
    "leFlux",
    "energyUsage",
)


def _dict(value: Any) -> dict[str, Any]:
    return value if isinstance(value, dict) else {}


def _float(value: Any) -> float | None:
    try:
        number = float(value)
    except (TypeError, ValueError):
        return None
    if number != number:
        return None
    return number


def _parse_time(value: Any) -> datetime | None:
    if isinstance(value, datetime):
        return value if value.tzinfo else value.replace(tzinfo=UTC)
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
        return parsed if parsed.tzinfo else parsed.replace(tzinfo=UTC)
    return None


def normalize_telemetry_point(
    payload: dict[str, Any],
    *,
    crop: str,
    greenhouse_id: str,
    source: str,
    received_at: datetime | None = None,
) -> dict[str, Any]:
    """Normalize simulator or dashboard payloads into the frontend telemetry dialect."""
    env = _dict(payload.get("env"))
    flux = _dict(payload.get("flux"))
    state = _dict(payload.get("state"))
    kpi = _dict(payload.get("kpi"))
    current = _dict(payload.get("currentData") or payload.get("data"))
    base = current or payload

    observed_at = None
    for candidate in (
        base.get("datetime"),
        base.get("timestamp"),
        base.get("t"),
        payload.get("t"),
        state.get("datetime"),
    ):
        observed_at = _parse_time(candidate)
        if observed_at is not None:
            break
    observed_at = (observed_at or received_at or datetime.now(UTC)).astimezone(UTC)
    received_at = (received_at or datetime.now(UTC)).astimezone(UTC)

    aliases: dict[str, tuple[Any, ...]] = {
        "temperature": (
            base.get("temperature"),
            env.get("T_air_C"),
            state.get("T_air_C"),
        ),
        "canopyTemp": (
            base.get("canopyTemp"),
            state.get("T_canopy_C"),
            state.get("T_c"),
        ),
        "humidity": (
            base.get("humidity"),
            env.get("RH_percent"),
            state.get("RH_percent"),
        ),
        "co2": (
            base.get("co2"),
            env.get("CO2_ppm"),
            state.get("CO2_ppm"),
        ),
        "light": (
            base.get("light"),
            env.get("PAR_umol"),
            env.get("PAR_umol_m2_s"),
        ),
        "vpd": (
            base.get("vpd"),
            env.get("VPD_kPa"),
        ),
        "soilMoisture": (
            base.get("soilMoisture"),
            state.get("soil_moisture"),
            state.get("root_zone_water"),
        ),
        "transpiration": (
            base.get("transpiration"),
            kpi.get("transpiration_mm_h"),
            flux.get("transpiration_mm_h"),
            flux.get("transpiration_mm"),
        ),
        "stomatalConductance": (
            base.get("stomatalConductance"),
            kpi.get("stomatal_conductance"),
            flux.get("stomatal_conductance_mol_m2_s"),
            flux.get("stomatal_conductance_m_s"),
        ),
        "photosynthesis": (
            base.get("photosynthesis"),
            flux.get("net_assimilation_umol_m2_s"),
            flux.get("gross_photosynthesis_umol_m2_s"),
            state.get("net_assimilation_umol_m2_s"),
        ),
        "hFlux": (
            base.get("hFlux"),
            flux.get("H_W_m2"),
        ),
        "leFlux": (
            base.get("leFlux"),
            flux.get("LE_W_m2"),
        ),
        "energyUsage": (
            base.get("energyUsage"),
            _dict(payload.get("energy")).get("P_elec_kW"),
            _dict(payload.get("energy")).get("consumption"),
        ),
    }

    normalized: dict[str, Any] = {
        "datetime": observed_at.isoformat(),
        "timestamp": int(observed_at.timestamp() * 1000),
        "received_at": received_at.isoformat(),
        "crop": crop,
        "greenhouse_id": greenhouse_id,
        "source": source,
    }
    for key, candidates in aliases.items():
        value = next((number for item in candidates if (number := _float(item)) is not None), None)
        if value is not None:
            if key == "canopyTemp" and value > 100:
                value -= 273.15
            normalized[key] = round(value, 9)
    return normalized


class TelemetryStore:
    """SQLite WAL store for server-owned telemetry history."""

    _lock = threading.RLock()

    def __init__(self, path: str | Path | None = None) -> None:
        configured = path or os.getenv("SMARTGROW_TELEMETRY_DB_PATH")
        self.path = Path(configured or "artifacts/telemetry/greenhouse_telemetry.sqlite3")
        self._initialize()

    def _connect(self) -> sqlite3.Connection:
        self.path.parent.mkdir(parents=True, exist_ok=True)
        connection = sqlite3.connect(self.path, timeout=30.0)
        connection.row_factory = sqlite3.Row
        connection.execute("PRAGMA journal_mode=WAL")
        connection.execute("PRAGMA synchronous=FULL")
        connection.execute("PRAGMA foreign_keys=ON")
        connection.execute("PRAGMA busy_timeout=30000")
        return connection

    def _initialize(self) -> None:
        with self._lock, self._connect() as connection:
            connection.executescript(
                """
                CREATE TABLE IF NOT EXISTS telemetry_points (
                    point_id INTEGER PRIMARY KEY AUTOINCREMENT,
                    greenhouse_id TEXT NOT NULL,
                    crop TEXT NOT NULL,
                    observed_at TEXT NOT NULL,
                    observed_epoch REAL NOT NULL,
                    received_at TEXT NOT NULL,
                    source TEXT NOT NULL,
                    payload_json TEXT NOT NULL,
                    payload_sha256 TEXT NOT NULL,
                    UNIQUE(greenhouse_id, crop, observed_at, payload_sha256)
                );
                CREATE INDEX IF NOT EXISTS ix_telemetry_window
                    ON telemetry_points(greenhouse_id, crop, observed_epoch);
                """
            )

    def append(
        self,
        payload: dict[str, Any],
        *,
        crop: str,
        greenhouse_id: str | None = None,
        source: str = "api",
        received_at: datetime | None = None,
    ) -> dict[str, Any]:
        greenhouse_id = greenhouse_id or crop
        normalized = normalize_telemetry_point(
            payload,
            crop=crop,
            greenhouse_id=greenhouse_id,
            source=source,
            received_at=received_at,
        )
        blob = json.dumps(
            normalized,
            ensure_ascii=False,
            sort_keys=True,
            separators=(",", ":"),
        )
        identity_payload = dict(normalized)
        # Receipt time is intentionally excluded so retrying the same observed
        # measurement remains idempotent.
        identity_payload.pop("received_at", None)
        digest = hashlib.sha256(
            json.dumps(
                identity_payload,
                ensure_ascii=False,
                sort_keys=True,
                separators=(",", ":"),
            ).encode("utf-8")
        ).hexdigest()
        observed = _parse_time(normalized["datetime"])
        assert observed is not None
        with self._lock, self._connect() as connection:
            cursor = connection.execute(
                """
                INSERT OR IGNORE INTO telemetry_points(
                    greenhouse_id, crop, observed_at, observed_epoch, received_at,
                    source, payload_json, payload_sha256
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    greenhouse_id,
                    crop,
                    normalized["datetime"],
                    observed.timestamp(),
                    normalized["received_at"],
                    source,
                    blob,
                    digest,
                ),
            )
        return {
            "inserted": cursor.rowcount == 1,
            "payload_sha256": digest,
            "point": normalized,
        }

    def append_many(
        self,
        points: list[dict[str, Any]],
        *,
        crop: str,
        greenhouse_id: str | None = None,
        source: str = "api",
    ) -> dict[str, Any]:
        inserted = 0
        duplicates = 0
        for point in points:
            result = self.append(
                point,
                crop=crop,
                greenhouse_id=greenhouse_id,
                source=source,
            )
            inserted += int(result["inserted"])
            duplicates += int(not result["inserted"])
        return {"inserted": inserted, "duplicates": duplicates, "total": len(points)}

    def query_window(
        self,
        *,
        crop: str,
        greenhouse_id: str | None = None,
        start: datetime,
        end: datetime,
        limit: int = 20000,
    ) -> list[dict[str, Any]]:
        greenhouse_id = greenhouse_id or crop
        start_epoch = start.astimezone(UTC).timestamp()
        end_epoch = end.astimezone(UTC).timestamp()
        with self._connect() as connection:
            rows = connection.execute(
                """
                SELECT payload_json
                FROM telemetry_points
                WHERE greenhouse_id = ? AND crop = ?
                  AND observed_epoch BETWEEN ? AND ?
                ORDER BY observed_epoch ASC
                LIMIT ?
                """,
                (greenhouse_id, crop, start_epoch, end_epoch, max(1, min(limit, 100000))),
            ).fetchall()
        return [json.loads(row["payload_json"]) for row in rows]

    def latest(
        self,
        *,
        crop: str,
        greenhouse_id: str | None = None,
    ) -> dict[str, Any] | None:
        greenhouse_id = greenhouse_id or crop
        with self._connect() as connection:
            row = connection.execute(
                """
                SELECT payload_json
                FROM telemetry_points
                WHERE greenhouse_id = ? AND crop = ?
                ORDER BY observed_epoch DESC
                LIMIT 1
                """,
                (greenhouse_id, crop),
            ).fetchone()
        return json.loads(row["payload_json"]) if row else None

    def history_for_comparison(
        self,
        *,
        crop: str,
        greenhouse_id: str | None = None,
        reference: datetime | None = None,
        lookback_hours: int = 30,
    ) -> list[dict[str, Any]]:
        reference = (reference or datetime.now(UTC)).astimezone(UTC)
        return self.query_window(
            crop=crop,
            greenhouse_id=greenhouse_id,
            start=reference - timedelta(hours=max(26, lookback_hours)),
            end=reference,
        )

    def compare_same_time(
        self,
        *,
        crop: str,
        greenhouse_id: str | None,
        current_data: dict[str, Any] | None,
        facets: dict[str, Any],
    ) -> dict[str, Any]:
        latest = normalize_telemetry_point(
            current_data or self.latest(crop=crop, greenhouse_id=greenhouse_id) or {},
            crop=crop,
            greenhouse_id=greenhouse_id or crop,
            source="adaptive_query",
        )
        reference = _parse_time(latest.get("datetime")) or datetime.now(UTC)
        history = self.history_for_comparison(
            crop=crop,
            greenhouse_id=greenhouse_id,
            reference=reference,
        )
        dashboard = {"currentData": latest, "history": history}
        result = compare_temporal_windows(dashboard, facets)
        result["history_source"] = "server_timeseries"
        result["server_point_count"] = len(history)
        return result

    def describe(self) -> dict[str, Any]:
        with self._connect() as connection:
            count = int(connection.execute("SELECT COUNT(*) FROM telemetry_points").fetchone()[0])
            bounds = connection.execute(
                "SELECT MIN(observed_at), MAX(observed_at) FROM telemetry_points"
            ).fetchone()
        return {
            "status": "ready",
            "path": str(self.path),
            "point_count": count,
            "start": bounds[0],
            "end": bounds[1],
        }
