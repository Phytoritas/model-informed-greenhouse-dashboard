"""Small bounded cache for question-independent model/advisor lane outputs."""

from __future__ import annotations

import copy
import threading
import time
from collections import OrderedDict
from typing import Any, Callable


class RuntimeLaneCache:
    """TTL/LRU cache for expensive tab calculations keyed by frozen snapshot."""

    def __init__(
        self,
        *,
        ttl_seconds: float = 120.0,
        max_entries: int = 128,
        clock: Callable[[], float] = time.monotonic,
    ) -> None:
        self.ttl_seconds = max(0.0, float(ttl_seconds))
        self.max_entries = max(1, int(max_entries))
        self._clock = clock
        self._lock = threading.RLock()
        self._entries: OrderedDict[str, tuple[float, Any]] = OrderedDict()
        self._hits = 0
        self._misses = 0
        self._evictions = 0

    def get(self, key: str) -> Any | None:
        now = self._clock()
        with self._lock:
            item = self._entries.get(key)
            if item is None:
                self._misses += 1
                return None
            expires_at, value = item
            if expires_at < now:
                del self._entries[key]
                self._misses += 1
                self._evictions += 1
                return None
            self._entries.move_to_end(key)
            self._hits += 1
            return copy.deepcopy(value)

    def put(self, key: str, value: Any) -> None:
        marker = str(value.get("status") or "").lower() if isinstance(value, dict) else ""
        if marker in {"unavailable", "error", "failed"}:
            return
        expires_at = self._clock() + self.ttl_seconds
        with self._lock:
            self._entries[key] = (expires_at, copy.deepcopy(value))
            self._entries.move_to_end(key)
            while len(self._entries) > self.max_entries:
                self._entries.popitem(last=False)
                self._evictions += 1

    def get_or_compute(self, key: str, fn: Callable[[], Any]) -> tuple[Any, bool]:
        cached = self.get(key)
        if cached is not None:
            return cached, True
        value = fn()
        self.put(key, value)
        return copy.deepcopy(value), False

    def describe(self) -> dict[str, Any]:
        with self._lock:
            return {
                "status": "ready",
                "ttl_seconds": self.ttl_seconds,
                "max_entries": self.max_entries,
                "entry_count": len(self._entries),
                "hits": self._hits,
                "misses": self._misses,
                "evictions": self._evictions,
            }
