"""Backend runtime package for the greenhouse dashboard."""

__all__ = ["app", "get_app"]


def get_app():
    """Return the backend-owned FastAPI application lazily."""
    from .app.main import app

    return app


def __getattr__(name: str):
    if name == "app":
        return get_app()
    raise AttributeError(f"module {__name__!r} has no attribute {name!r}")
