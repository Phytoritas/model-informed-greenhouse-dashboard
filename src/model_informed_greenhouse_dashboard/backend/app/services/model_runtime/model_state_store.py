"""SQLite-backed model runtime persistence for phase-2 SmartGrow seams."""

from __future__ import annotations

import json
import math
import sqlite3
from contextlib import contextmanager
from datetime import UTC, date, datetime
from pathlib import Path
from typing import Any, Iterator
from uuid import uuid4

from ...config import settings


REPO_ROOT = Path(settings.config_dir).resolve().parent
DEFAULT_MODEL_RUNTIME_DB_PATH = REPO_ROOT / "artifacts" / "models" / "model_runtime.sqlite3"
SCHEMA_VERSION = "smartgrow-model-runtime-v2"

_SCHEMA_STATEMENTS = [
    """
    CREATE TABLE IF NOT EXISTS meta (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS crop_model_snapshots (
        snapshot_id TEXT PRIMARY KEY,
        greenhouse_id TEXT NOT NULL,
        crop TEXT NOT NULL,
        snapshot_time TEXT NOT NULL,
        source TEXT NOT NULL,
        adapter_name TEXT NOT NULL,
        adapter_version TEXT NOT NULL,
        normalized_snapshot_json TEXT NOT NULL,
        raw_adapter_state_json TEXT NOT NULL,
        metadata_json TEXT NOT NULL,
        created_at TEXT NOT NULL
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS crop_work_events (
        event_id TEXT PRIMARY KEY,
        greenhouse_id TEXT NOT NULL,
        crop TEXT NOT NULL,
        event_time TEXT NOT NULL,
        event_type TEXT NOT NULL,
        operator TEXT,
        reason_code TEXT,
        confidence REAL,
        before_snapshot_id TEXT,
        after_snapshot_id TEXT,
        payload_json TEXT NOT NULL,
        created_at TEXT NOT NULL,
        FOREIGN KEY(before_snapshot_id) REFERENCES crop_model_snapshots(snapshot_id),
        FOREIGN KEY(after_snapshot_id) REFERENCES crop_model_snapshots(snapshot_id)
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS crop_model_states (
        greenhouse_id TEXT NOT NULL,
        crop TEXT NOT NULL,
        latest_snapshot_id TEXT NOT NULL,
        latest_event_id TEXT,
        updated_at TEXT NOT NULL,
        PRIMARY KEY(greenhouse_id, crop),
        FOREIGN KEY(latest_snapshot_id) REFERENCES crop_model_snapshots(snapshot_id),
        FOREIGN KEY(latest_event_id) REFERENCES crop_work_events(event_id)
    )
    """,
    """
    CREATE INDEX IF NOT EXISTS idx_crop_model_snapshots_lookup
    ON crop_model_snapshots(greenhouse_id, crop, snapshot_time DESC)
    """,
    """
    CREATE INDEX IF NOT EXISTS idx_crop_work_events_lookup
    ON crop_work_events(greenhouse_id, crop, event_time DESC)
    """,
    """
    CREATE TABLE IF NOT EXISTS scenario_runs (
        scenario_id TEXT PRIMARY KEY,
        snapshot_id TEXT NOT NULL,
        greenhouse_id TEXT NOT NULL,
        crop TEXT NOT NULL,
        scenario_label TEXT,
        controls_json TEXT NOT NULL,
        horizons_json TEXT NOT NULL,
        violated_constraints_json TEXT NOT NULL,
        confidence_score REAL NOT NULL,
        created_at TEXT NOT NULL,
        FOREIGN KEY(snapshot_id) REFERENCES crop_model_snapshots(snapshot_id)
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS scenario_outputs (
        output_id TEXT PRIMARY KEY,
        scenario_id TEXT NOT NULL,
        greenhouse_id TEXT NOT NULL,
        crop TEXT NOT NULL,
        horizon_hours INTEGER NOT NULL,
        yield_pred REAL NOT NULL,
        fruit_dm_pred REAL NOT NULL,
        lai_pred REAL NOT NULL,
        transpiration_pred REAL NOT NULL,
        canopy_A_pred REAL NOT NULL,
        respiration_pred REAL NOT NULL,
        energy_cost_pred REAL NOT NULL,
        rtr_pred REAL NOT NULL,
        source_sink_balance_score REAL NOT NULL,
        constraint_violations_json TEXT NOT NULL,
        confidence_score REAL NOT NULL,
        created_at TEXT NOT NULL,
        FOREIGN KEY(scenario_id) REFERENCES scenario_runs(scenario_id)
    )
    """,
    """
    CREATE INDEX IF NOT EXISTS idx_scenario_outputs_lookup
    ON scenario_outputs(scenario_id, horizon_hours)
    """,
    """
    CREATE TABLE IF NOT EXISTS sensitivity_outputs (
        sensitivity_id TEXT PRIMARY KEY,
        snapshot_id TEXT NOT NULL,
        greenhouse_id TEXT NOT NULL,
        crop TEXT NOT NULL,
        horizon_hours INTEGER NOT NULL,
        variable_name TEXT NOT NULL,
        derivative_target TEXT NOT NULL,
        derivative_value REAL NOT NULL,
        normalized_elasticity REAL NOT NULL,
        direction TEXT NOT NULL,
        method TEXT NOT NULL,
        perturbation_size REAL NOT NULL,
        trust_region_low REAL NOT NULL,
        trust_region_high REAL NOT NULL,
        valid_flag INTEGER NOT NULL,
        scenario_alignment INTEGER NOT NULL,
        created_at TEXT NOT NULL,
        FOREIGN KEY(snapshot_id) REFERENCES crop_model_snapshots(snapshot_id)
    )
    """,
    """
    CREATE INDEX IF NOT EXISTS idx_sensitivity_outputs_lookup
    ON sensitivity_outputs(snapshot_id, derivative_target, variable_name)
    """,
]


def _utcnow() -> datetime:
    return datetime.now(UTC)


def _json_safe(value: Any) -> Any:
    if value is None or isinstance(value, (str, int, bool)):
        return value
    if isinstance(value, float):
        if math.isnan(value) or math.isinf(value):
            return None
        return value
    if isinstance(value, datetime):
        return value.isoformat()
    if isinstance(value, date):
        return value.isoformat()
    if isinstance(value, Path):
        return str(value)
    if isinstance(value, dict):
        return {str(key): _json_safe(item) for key, item in value.items()}
    if isinstance(value, (list, tuple, set)):
        return [_json_safe(item) for item in value]
    if hasattr(value, "tolist"):
        return _json_safe(value.tolist())
    if hasattr(value, "item"):
        try:
            return _json_safe(value.item())
        except Exception:
            return str(value)
    return str(value)


def _dump_json(payload: dict[str, Any]) -> str:
    return json.dumps(_json_safe(payload), ensure_ascii=False, sort_keys=True)


def _load_json(payload: str) -> dict[str, Any]:
    loaded = json.loads(payload)
    if not isinstance(loaded, dict):
        raise ValueError("Expected a JSON object payload.")
    return loaded


class ModelStateStore:
    """Persist normalized model snapshots and canonical work events."""

    def __init__(self, db_path: str | Path | None = None) -> None:
        self.db_path = Path(db_path) if db_path else DEFAULT_MODEL_RUNTIME_DB_PATH
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        self._ensure_schema()

    @contextmanager
    def _connect(self) -> Iterator[sqlite3.Connection]:
        connection = sqlite3.connect(self.db_path)
        connection.row_factory = sqlite3.Row
        try:
            yield connection
            connection.commit()
        finally:
            connection.close()

    def _ensure_schema(self) -> None:
        with self._connect() as connection:
            for statement in _SCHEMA_STATEMENTS:
                connection.execute(statement)
            connection.execute(
                """
                INSERT INTO meta(key, value)
                VALUES('schema_version', ?)
                ON CONFLICT(key) DO UPDATE SET value=excluded.value
                """,
                (SCHEMA_VERSION,),
            )

    def describe(self) -> dict[str, Any]:
        return {
            "db_path": str(self.db_path),
            "schema_version": SCHEMA_VERSION,
        }

    def persist_snapshot(
        self,
        *,
        greenhouse_id: str,
        crop: str,
        snapshot_time: datetime,
        adapter_name: str,
        adapter_version: str,
        normalized_snapshot: dict[str, Any],
        raw_adapter_state: dict[str, Any],
        source: str,
        metadata: dict[str, Any] | None = None,
        snapshot_id: str | None = None,
    ) -> dict[str, Any]:
        resolved_snapshot_id = snapshot_id or f"snap-{uuid4().hex}"
        created_at = _utcnow().isoformat()
        normalized_payload = _json_safe(normalized_snapshot)
        raw_payload = _json_safe(raw_adapter_state)
        metadata_payload = _json_safe(metadata or {})

        with self._connect() as connection:
            connection.execute(
                """
                INSERT INTO crop_model_snapshots(
                    snapshot_id,
                    greenhouse_id,
                    crop,
                    snapshot_time,
                    source,
                    adapter_name,
                    adapter_version,
                    normalized_snapshot_json,
                    raw_adapter_state_json,
                    metadata_json,
                    created_at
                )
                VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    resolved_snapshot_id,
                    greenhouse_id,
                    crop,
                    snapshot_time.isoformat(),
                    source,
                    adapter_name,
                    adapter_version,
                    _dump_json(normalized_payload),
                    _dump_json(raw_payload),
                    _dump_json(metadata_payload),
                    created_at,
                ),
            )

        return {
            "snapshot_id": resolved_snapshot_id,
            "greenhouse_id": greenhouse_id,
            "crop": crop,
            "snapshot_time": snapshot_time.isoformat(),
            "source": source,
            "adapter_name": adapter_name,
            "adapter_version": adapter_version,
            "normalized_snapshot": normalized_payload,
            "raw_adapter_state": raw_payload,
            "metadata": metadata_payload,
            "created_at": created_at,
        }

    def load_snapshot(self, snapshot_id: str) -> dict[str, Any] | None:
        with self._connect() as connection:
            row = connection.execute(
                """
                SELECT snapshot_id, greenhouse_id, crop, snapshot_time, source,
                       adapter_name, adapter_version, normalized_snapshot_json,
                       raw_adapter_state_json, metadata_json, created_at
                FROM crop_model_snapshots
                WHERE snapshot_id = ?
                """,
                (snapshot_id,),
            ).fetchone()

        if row is None:
            return None

        return {
            "snapshot_id": row["snapshot_id"],
            "greenhouse_id": row["greenhouse_id"],
            "crop": row["crop"],
            "snapshot_time": row["snapshot_time"],
            "source": row["source"],
            "adapter_name": row["adapter_name"],
            "adapter_version": row["adapter_version"],
            "normalized_snapshot": _load_json(row["normalized_snapshot_json"]),
            "raw_adapter_state": _load_json(row["raw_adapter_state_json"]),
            "metadata": _load_json(row["metadata_json"]),
            "created_at": row["created_at"],
        }

    def latest_snapshot(self, greenhouse_id: str, crop: str) -> dict[str, Any] | None:
        with self._connect() as connection:
            row = connection.execute(
                """
                SELECT snapshot_id
                FROM crop_model_snapshots
                WHERE greenhouse_id = ? AND crop = ?
                ORDER BY snapshot_time DESC, created_at DESC
                LIMIT 1
                """,
                (greenhouse_id, crop),
            ).fetchone()

        if row is None:
            return None

        return self.load_snapshot(str(row["snapshot_id"]))

    def list_snapshots_since(
        self,
        greenhouse_id: str,
        crop: str,
        *,
        since: datetime,
        limit: int = 500,
    ) -> list[dict[str, Any]]:
        with self._connect() as connection:
            rows = connection.execute(
                """
                SELECT snapshot_id
                FROM crop_model_snapshots
                WHERE greenhouse_id = ? AND crop = ? AND snapshot_time >= ?
                ORDER BY snapshot_time ASC, created_at ASC
                LIMIT ?
                """,
                (
                    greenhouse_id,
                    crop,
                    since.isoformat(),
                    max(1, int(limit)),
                ),
            ).fetchall()

        records: list[dict[str, Any]] = []
        for row in rows:
            snapshot_record = self.load_snapshot(str(row["snapshot_id"]))
            if snapshot_record is not None:
                records.append(snapshot_record)
        return records

    def load_current_state(self, greenhouse_id: str, crop: str) -> dict[str, Any] | None:
        with self._connect() as connection:
            row = connection.execute(
                """
                SELECT greenhouse_id, crop, latest_snapshot_id, latest_event_id, updated_at
                FROM crop_model_states
                WHERE greenhouse_id = ? AND crop = ?
                """,
                (greenhouse_id, crop),
            ).fetchone()

        if row is None:
            return None

        return {
            "greenhouse_id": row["greenhouse_id"],
            "crop": row["crop"],
            "latest_snapshot_id": row["latest_snapshot_id"],
            "latest_event_id": row["latest_event_id"],
            "updated_at": row["updated_at"],
        }

    def list_work_events(
        self,
        greenhouse_id: str,
        crop: str,
        *,
        limit: int = 10,
        event_type: str | None = None,
    ) -> list[dict[str, Any]]:
        query = """
            SELECT event_id, greenhouse_id, crop, event_time, event_type, operator,
                   reason_code, confidence, before_snapshot_id, after_snapshot_id,
                   payload_json, created_at
            FROM crop_work_events
            WHERE greenhouse_id = ? AND crop = ?
        """
        params: list[Any] = [greenhouse_id, crop]
        if event_type:
            query += " AND event_type = ?"
            params.append(event_type)
        query += " ORDER BY event_time DESC, created_at DESC LIMIT ?"
        params.append(max(1, int(limit)))

        with self._connect() as connection:
            rows = connection.execute(query, params).fetchall()

        return [
            {
                "event_id": row["event_id"],
                "greenhouse_id": row["greenhouse_id"],
                "crop": row["crop"],
                "event_time": row["event_time"],
                "event_type": row["event_type"],
                "operator": row["operator"],
                "reason_code": row["reason_code"],
                "confidence": row["confidence"],
                "before_snapshot_id": row["before_snapshot_id"],
                "after_snapshot_id": row["after_snapshot_id"],
                "payload": _load_json(row["payload_json"]),
                "created_at": row["created_at"],
            }
            for row in rows
        ]

    def persist_work_event(
        self,
        *,
        greenhouse_id: str,
        crop: str,
        event_time: datetime,
        event_type: str,
        payload: dict[str, Any],
        before_snapshot_id: str | None,
        after_snapshot_id: str | None,
        operator: str | None = None,
        reason_code: str | None = None,
        confidence: float | None = None,
        event_id: str | None = None,
    ) -> dict[str, Any]:
        resolved_event_id = event_id or f"evt-{uuid4().hex}"
        created_at = _utcnow().isoformat()
        payload_json = _json_safe(payload)

        with self._connect() as connection:
            connection.execute(
                """
                INSERT INTO crop_work_events(
                    event_id,
                    greenhouse_id,
                    crop,
                    event_time,
                    event_type,
                    operator,
                    reason_code,
                    confidence,
                    before_snapshot_id,
                    after_snapshot_id,
                    payload_json,
                    created_at
                )
                VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    resolved_event_id,
                    greenhouse_id,
                    crop,
                    event_time.isoformat(),
                    event_type,
                    operator,
                    reason_code,
                    confidence,
                    before_snapshot_id,
                    after_snapshot_id,
                    _dump_json(payload_json),
                    created_at,
                ),
            )

        return {
            "event_id": resolved_event_id,
            "greenhouse_id": greenhouse_id,
            "crop": crop,
            "event_time": event_time.isoformat(),
            "event_type": event_type,
            "operator": operator,
            "reason_code": reason_code,
            "confidence": confidence,
            "before_snapshot_id": before_snapshot_id,
            "after_snapshot_id": after_snapshot_id,
            "payload": payload_json,
            "created_at": created_at,
        }

    def upsert_current_state(
        self,
        *,
        greenhouse_id: str,
        crop: str,
        latest_snapshot_id: str,
        latest_event_id: str | None = None,
    ) -> None:
        updated_at = _utcnow().isoformat()
        with self._connect() as connection:
            connection.execute(
                """
                INSERT INTO crop_model_states(
                    greenhouse_id,
                    crop,
                    latest_snapshot_id,
                    latest_event_id,
                    updated_at
                )
                VALUES(?, ?, ?, ?, ?)
                ON CONFLICT(greenhouse_id, crop) DO UPDATE SET
                    latest_snapshot_id=excluded.latest_snapshot_id,
                    latest_event_id=excluded.latest_event_id,
                    updated_at=excluded.updated_at
                """,
                (
                    greenhouse_id,
                    crop,
                    latest_snapshot_id,
                    latest_event_id,
                    updated_at,
                ),
            )

    def persist_scenario_run(
        self,
        *,
        snapshot_id: str,
        greenhouse_id: str,
        crop: str,
        controls: dict[str, Any],
        horizons_hours: list[int],
        violated_constraints: list[dict[str, Any]],
        confidence_score: float,
        scenario_label: str | None = None,
        scenario_id: str | None = None,
    ) -> dict[str, Any]:
        resolved_scenario_id = scenario_id or f"scn-{uuid4().hex}"
        created_at = _utcnow().isoformat()
        controls_payload = _json_safe(controls)
        horizons_payload = _json_safe({"horizons_hours": horizons_hours})
        violations_payload = _json_safe({"violated_constraints": violated_constraints})

        with self._connect() as connection:
            connection.execute(
                """
                INSERT INTO scenario_runs(
                    scenario_id,
                    snapshot_id,
                    greenhouse_id,
                    crop,
                    scenario_label,
                    controls_json,
                    horizons_json,
                    violated_constraints_json,
                    confidence_score,
                    created_at
                )
                VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    resolved_scenario_id,
                    snapshot_id,
                    greenhouse_id,
                    crop,
                    scenario_label,
                    _dump_json(controls_payload),
                    _dump_json(horizons_payload),
                    _dump_json(violations_payload),
                    confidence_score,
                    created_at,
                ),
            )

        return {
            "scenario_id": resolved_scenario_id,
            "snapshot_id": snapshot_id,
            "greenhouse_id": greenhouse_id,
            "crop": crop,
            "scenario_label": scenario_label,
            "controls": controls_payload,
            "horizons_hours": list(horizons_hours),
            "violated_constraints": list(violated_constraints),
            "confidence_score": confidence_score,
            "created_at": created_at,
        }

    def persist_scenario_outputs(
        self,
        *,
        scenario_id: str,
        greenhouse_id: str,
        crop: str,
        outputs: list[dict[str, Any]],
    ) -> list[dict[str, Any]]:
        created_at = _utcnow().isoformat()
        persisted_outputs: list[dict[str, Any]] = []

        with self._connect() as connection:
            for row in outputs:
                output_id = f"scnout-{uuid4().hex}"
                connection.execute(
                    """
                    INSERT INTO scenario_outputs(
                        output_id,
                        scenario_id,
                        greenhouse_id,
                        crop,
                        horizon_hours,
                        yield_pred,
                        fruit_dm_pred,
                        lai_pred,
                        transpiration_pred,
                        canopy_A_pred,
                        respiration_pred,
                        energy_cost_pred,
                        rtr_pred,
                        source_sink_balance_score,
                        constraint_violations_json,
                        confidence_score,
                        created_at
                    )
                    VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        output_id,
                        scenario_id,
                        greenhouse_id,
                        crop,
                        int(row["horizon_hours"]),
                        float(row["yield_pred"]),
                        float(row["fruit_dm_pred"]),
                        float(row["lai_pred"]),
                        float(row["transpiration_pred"]),
                        float(row["canopy_A_pred"]),
                        float(row["respiration_pred"]),
                        float(row["energy_cost_pred"]),
                        float(row["rtr_pred"]),
                        float(row["source_sink_balance_score"]),
                        _dump_json({"constraint_violations": _json_safe(row["constraint_violations"])}),
                        float(row["confidence_score"]),
                        created_at,
                    ),
                )
                persisted_outputs.append(
                    {
                        "output_id": output_id,
                        **row,
                        "created_at": created_at,
                    }
                )

        return persisted_outputs

    def persist_sensitivity_outputs(
        self,
        *,
        snapshot_id: str,
        greenhouse_id: str,
        crop: str,
        horizon_hours: int,
        sensitivities: list[dict[str, Any]],
    ) -> list[dict[str, Any]]:
        created_at = _utcnow().isoformat()
        persisted_rows: list[dict[str, Any]] = []

        with self._connect() as connection:
            for row in sensitivities:
                sensitivity_id = f"sen-{uuid4().hex}"
                trust_region = row.get("trust_region", {})
                connection.execute(
                    """
                    INSERT INTO sensitivity_outputs(
                        sensitivity_id,
                        snapshot_id,
                        greenhouse_id,
                        crop,
                        horizon_hours,
                        variable_name,
                        derivative_target,
                        derivative_value,
                        normalized_elasticity,
                        direction,
                        method,
                        perturbation_size,
                        trust_region_low,
                        trust_region_high,
                        valid_flag,
                        scenario_alignment,
                        created_at
                    )
                    VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        sensitivity_id,
                        snapshot_id,
                        greenhouse_id,
                        crop,
                        int(horizon_hours),
                        str(row["control"]),
                        str(row["target"]),
                        float(row["derivative"]),
                        float(row["elasticity"]),
                        str(row["direction"]),
                        str(row["method"]),
                        float(row["perturbation_size"]),
                        float(trust_region.get("low", 0.0)),
                        float(trust_region.get("high", 0.0)),
                        1 if row.get("valid") else 0,
                        1 if row.get("scenario_alignment") else 0,
                        created_at,
                    ),
                )
                persisted_rows.append(
                    {
                        "sensitivity_id": sensitivity_id,
                        **row,
                        "created_at": created_at,
                    }
                )

        return persisted_rows
