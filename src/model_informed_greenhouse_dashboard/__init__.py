"""Model-informed greenhouse dashboard package."""

__version__ = "0.1.0"

__all__ = ["__version__", "get_app"]


def get_app():
    """Return the package-owned FastAPI application."""
    from .backend.app.main import app

    return app
