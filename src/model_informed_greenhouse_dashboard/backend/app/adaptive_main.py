"""Adaptive advisor ASGI entry point.

The module wraps the existing application, installs server-side telemetry capture on
the simulation stream, and exposes the adaptive advisor routes. The legacy
``main:app`` entry point remains unchanged for rollback.
"""

from __future__ import annotations

import asyncio
import logging
from typing import Any

from .main import app
from .services.adaptive_advisor.api import router as adaptive_advisor_router
from .services.adaptive_advisor.telemetry_store import TelemetryStore
from .ws import manager


logger = logging.getLogger(__name__)


def _install_server_telemetry_capture() -> None:
    if getattr(manager, "_adaptive_telemetry_capture_installed", False):
        return
    store = TelemetryStore()
    original_broadcast = manager.broadcast

    async def broadcast_with_capture(path: str, message: dict[str, Any]) -> None:
        if path.startswith("/ws/sim/") and isinstance(message, dict):
            crop = str(message.get("crop") or path.rsplit("/", 1)[-1]).lower()
            if crop in {"tomato", "cucumber"}:
                try:
                    await asyncio.to_thread(
                        store.append,
                        message,
                        crop=crop,
                        greenhouse_id=crop,
                        source="simulation_stream",
                    )
                except Exception as exc:
                    logger.warning("Server telemetry capture degraded: %s", exc)
        await original_broadcast(path, message)

    manager.broadcast = broadcast_with_capture
    manager._adaptive_telemetry_capture_installed = True
    manager._adaptive_telemetry_store = store


_install_server_telemetry_capture()

if not any(
    getattr(route, "path", "").startswith("/api/advisor/adaptive")
    for route in app.routes
):
    app.include_router(adaptive_advisor_router)


if __name__ == "__main__":
    import uvicorn

    from .config import settings

    uvicorn.run(
        "model_informed_greenhouse_dashboard.backend.app.adaptive_main:app",
        host=settings.host,
        port=settings.port,
        reload=settings.debug,
    )
