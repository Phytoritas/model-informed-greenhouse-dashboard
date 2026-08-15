"""Adaptive advisor ASGI entry point.

This module wraps the existing FastAPI application and adds the v1 adaptive graph
routes as a shadow surface. The legacy entry point remains unchanged for safe rollout.
"""

from __future__ import annotations

from .main import app
from .services.adaptive_advisor.api import router as adaptive_advisor_router


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
