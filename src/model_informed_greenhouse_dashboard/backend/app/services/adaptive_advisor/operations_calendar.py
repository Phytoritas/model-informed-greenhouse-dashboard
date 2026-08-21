"""Durable, revisioned operations calendar for shipment and labor-aware advice."""

from __future__ import annotations

import json
import os
import threading
from datetime import UTC, date, datetime
from pathlib import Path
from typing import Any

from .contracts import OperationsCalendar, OperationsCalendarEvent


class CalendarRevisionConflict(RuntimeError):
    """Raised when a compare-and-swap calendar update loses a race."""


class OperationsCalendarStore:
    """Small JSON-backed calendar store with atomic replacement and CAS revisions.

    The store is intentionally independent of the LLM. Calendar events are operator
    facts used by the adaptive graph; they are never inferred from prose and committed
    without an explicit write request.
    """

    _lock = threading.RLock()

    def __init__(self, path: str | Path | None = None) -> None:
        configured = path or os.getenv("SMARTGROW_OPERATIONS_CALENDAR_PATH")
        self.path = Path(configured or "artifacts/operations/operations_calendar.json")

    def _read_root(self) -> dict[str, Any]:
        if not self.path.exists():
            return {
                "schema_version": "operations-calendar-store.v1",
                "calendars": {},
            }
        try:
            payload = json.loads(self.path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError) as exc:
            raise RuntimeError(f"operations calendar store is unreadable: {exc}") from exc
        if payload.get("schema_version") != "operations-calendar-store.v1":
            raise RuntimeError("unsupported operations calendar store schema")
        calendars = payload.get("calendars")
        if not isinstance(calendars, dict):
            raise RuntimeError("operations calendar store has an invalid calendars mapping")
        return payload

    def _write_root(self, payload: dict[str, Any]) -> None:
        self.path.parent.mkdir(parents=True, exist_ok=True)
        tmp = self.path.with_suffix(f"{self.path.suffix}.tmp")
        serialized = json.dumps(
            payload,
            ensure_ascii=False,
            indent=2,
            sort_keys=True,
            default=str,
        )
        tmp.write_text(serialized + "\n", encoding="utf-8")
        os.replace(tmp, self.path)

    def load(self, greenhouse_id: str) -> OperationsCalendar:
        normalized = (greenhouse_id or "").strip()
        if not normalized:
            raise ValueError("greenhouse_id is required")
        with self._lock:
            root = self._read_root()
            payload = root["calendars"].get(normalized)
            if payload is None:
                return OperationsCalendar(greenhouse_id=normalized)
            return OperationsCalendar.model_validate(payload)

    def save(
        self,
        calendar: OperationsCalendar,
        *,
        expected_revision: int | None = None,
    ) -> OperationsCalendar:
        with self._lock:
            root = self._read_root()
            current_payload = root["calendars"].get(calendar.greenhouse_id)
            current_revision = (
                int(current_payload.get("revision", 0))
                if isinstance(current_payload, dict)
                else 0
            )
            if expected_revision is not None and current_revision != expected_revision:
                raise CalendarRevisionConflict(
                    f"calendar revision changed: expected {expected_revision}, "
                    f"current {current_revision}"
                )

            saved = calendar.model_copy(
                update={
                    "revision": current_revision + 1,
                    "updated_at": datetime.now(UTC),
                }
            )
            root["calendars"][calendar.greenhouse_id] = saved.model_dump(mode="json")
            self._write_root(root)
            return saved

    def active_events(
        self,
        greenhouse_id: str,
        *,
        start: date,
        end: date,
    ) -> list[OperationsCalendarEvent]:
        calendar = self.load(greenhouse_id)
        return sorted(
            (
                event
                for event in calendar.events
                if event.start_date <= end and event.end_date >= start
            ),
            key=lambda event: (event.start_date, -event.priority, event.event_id),
        )

    def describe_window(
        self,
        greenhouse_id: str,
        *,
        start: date,
        end: date,
    ) -> dict[str, Any]:
        calendar = self.load(greenhouse_id)
        events = self.active_events(greenhouse_id, start=start, end=end)
        by_type: dict[str, list[dict[str, Any]]] = {}
        for event in events:
            by_type.setdefault(event.event_type.value, []).append(
                event.model_dump(mode="json")
            )

        shipment_blackout = any(
            event.event_type.value in {"SHIPMENT_BLACKOUT", "MARKET_CLOSURE"}
            for event in events
        )
        next_shipment = next(
            (
                event
                for event in events
                if event.event_type.value == "SHIPMENT_TARGET"
                and event.start_date >= start
            ),
            None,
        )
        capacities = {
            event.event_type.value: {
                "amount": event.amount,
                "unit": event.unit,
                "start_date": event.start_date.isoformat(),
                "end_date": event.end_date.isoformat(),
            }
            for event in events
            if event.event_type.value
            in {"LABOR_CAPACITY", "PACKING_CAPACITY", "STORAGE_CAPACITY"}
        }
        return {
            "status": "ready" if calendar.revision > 0 else "empty",
            "greenhouse_id": greenhouse_id,
            "revision": calendar.revision,
            "window": {"start": start.isoformat(), "end": end.isoformat()},
            "shipment_blackout": shipment_blackout,
            "next_shipment": (
                next_shipment.model_dump(mode="json") if next_shipment else None
            ),
            "capacities": capacities,
            "events_by_type": by_type,
            "event_count": len(events),
        }
