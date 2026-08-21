"""Server-owned conversation continuity for adaptive advisor follow-up questions."""

from __future__ import annotations

import hashlib
import os
import re
import sqlite3
import threading
import uuid
from datetime import UTC, datetime
from pathlib import Path
from typing import Any


_THREAD_ID_RE = re.compile(r"^[A-Za-z0-9._:-]{8,96}$")
_ALLOWED_ROLES = {"user", "assistant"}


class ConversationThreadConflict(RuntimeError):
    """Raised when a thread identifier is reused for another greenhouse or crop."""


class ConversationStore:
    """SQLite WAL store for bounded, run-linked advisor turns."""

    _lock = threading.RLock()

    def __init__(self, path: str | Path | None = None) -> None:
        configured = path or os.getenv("SMARTGROW_ADVISOR_CONVERSATION_DB_PATH")
        self.path = Path(
            configured or "artifacts/advisor_conversations/advisor_conversations.sqlite3"
        )
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
                CREATE TABLE IF NOT EXISTS advisor_threads (
                    thread_id TEXT PRIMARY KEY,
                    crop TEXT NOT NULL,
                    greenhouse_id TEXT NOT NULL,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                );
                CREATE INDEX IF NOT EXISTS ix_advisor_threads_updated
                    ON advisor_threads(updated_at);

                CREATE TABLE IF NOT EXISTS advisor_turns (
                    turn_id TEXT PRIMARY KEY,
                    thread_id TEXT NOT NULL
                        REFERENCES advisor_threads(thread_id) ON DELETE CASCADE,
                    run_id TEXT NOT NULL,
                    role TEXT NOT NULL CHECK(role IN ('user', 'assistant')),
                    content TEXT NOT NULL,
                    content_sha256 TEXT NOT NULL,
                    created_at TEXT NOT NULL,
                    UNIQUE(thread_id, run_id, role)
                );
                CREATE INDEX IF NOT EXISTS ix_advisor_turns_thread
                    ON advisor_turns(thread_id, created_at);
                """
            )

    @staticmethod
    def _validate_thread_id(thread_id: str) -> str:
        normalized = str(thread_id).strip()
        if not _THREAD_ID_RE.fullmatch(normalized):
            raise ValueError(
                "thread_id must contain 8-96 ASCII letters, digits, '.', '_', ':', or '-'"
            )
        return normalized

    def ensure_thread(
        self,
        thread_id: str | None,
        *,
        crop: str,
        greenhouse_id: str,
        now: datetime | None = None,
    ) -> str:
        normalized = (
            self._validate_thread_id(thread_id)
            if thread_id is not None
            else str(uuid.uuid4())
        )
        timestamp = (now or datetime.now(UTC)).astimezone(UTC).isoformat()
        with self._lock, self._connect() as connection:
            existing = connection.execute(
                """
                SELECT crop, greenhouse_id
                FROM advisor_threads
                WHERE thread_id = ?
                """,
                (normalized,),
            ).fetchone()
            if existing:
                if (
                    str(existing["crop"]) != str(crop)
                    or str(existing["greenhouse_id"]) != str(greenhouse_id)
                ):
                    raise ConversationThreadConflict(
                        "thread_id is already bound to another crop or greenhouse"
                    )
                connection.execute(
                    "UPDATE advisor_threads SET updated_at = ? WHERE thread_id = ?",
                    (timestamp, normalized),
                )
                return normalized
            connection.execute(
                """
                INSERT INTO advisor_threads(
                    thread_id, crop, greenhouse_id, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?)
                """,
                (normalized, crop, greenhouse_id, timestamp, timestamp),
            )
        return normalized

    def history(
        self,
        thread_id: str,
        *,
        limit: int = 16,
    ) -> list[dict[str, str]]:
        normalized = self._validate_thread_id(thread_id)
        bounded_limit = max(1, min(int(limit), 40))
        with self._connect() as connection:
            rows = connection.execute(
                """
                SELECT role, content
                FROM (
                    SELECT role, content, created_at, rowid
                    FROM advisor_turns
                    WHERE thread_id = ?
                    ORDER BY created_at DESC, rowid DESC
                    LIMIT ?
                )
                ORDER BY created_at ASC, rowid ASC
                """,
                (normalized, bounded_limit),
            ).fetchall()
        return [
            {"role": str(row["role"]), "content": str(row["content"])}
            for row in rows
            if str(row["role"]) in _ALLOWED_ROLES
        ]

    def append_exchange(
        self,
        *,
        thread_id: str,
        run_id: str,
        user_text: str,
        assistant_text: str,
        created_at: datetime | None = None,
    ) -> dict[str, Any]:
        normalized = self._validate_thread_id(thread_id)
        timestamp = (created_at or datetime.now(UTC)).astimezone(UTC).isoformat()
        inserted = 0
        with self._lock, self._connect() as connection:
            if not connection.execute(
                "SELECT 1 FROM advisor_threads WHERE thread_id = ?",
                (normalized,),
            ).fetchone():
                raise KeyError(f"unknown thread_id: {normalized}")
            for role, content in (
                ("user", str(user_text).strip()),
                ("assistant", str(assistant_text).strip()),
            ):
                if not content:
                    continue
                digest = hashlib.sha256(content.encode("utf-8")).hexdigest()
                cursor = connection.execute(
                    """
                    INSERT OR IGNORE INTO advisor_turns(
                        turn_id, thread_id, run_id, role, content,
                        content_sha256, created_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        str(uuid.uuid4()),
                        normalized,
                        str(run_id),
                        role,
                        content,
                        digest,
                        timestamp,
                    ),
                )
                inserted += int(cursor.rowcount == 1)
            connection.execute(
                "UPDATE advisor_threads SET updated_at = ? WHERE thread_id = ?",
                (timestamp, normalized),
            )
        return {
            "thread_id": normalized,
            "run_id": str(run_id),
            "inserted_turns": inserted,
        }

    def get_thread(self, thread_id: str, *, limit: int = 20) -> dict[str, Any] | None:
        normalized = self._validate_thread_id(thread_id)
        with self._connect() as connection:
            thread = connection.execute(
                "SELECT * FROM advisor_threads WHERE thread_id = ?",
                (normalized,),
            ).fetchone()
        if thread is None:
            return None
        return {
            "thread_id": normalized,
            "crop": thread["crop"],
            "greenhouse_id": thread["greenhouse_id"],
            "created_at": thread["created_at"],
            "updated_at": thread["updated_at"],
            "messages": self.history(normalized, limit=limit),
        }

    def describe(self) -> dict[str, Any]:
        with self._connect() as connection:
            thread_count = int(
                connection.execute("SELECT COUNT(*) FROM advisor_threads").fetchone()[0]
            )
            turn_count = int(
                connection.execute("SELECT COUNT(*) FROM advisor_turns").fetchone()[0]
            )
        return {
            "status": "ready",
            "path": str(self.path),
            "thread_count": thread_count,
            "turn_count": turn_count,
        }
