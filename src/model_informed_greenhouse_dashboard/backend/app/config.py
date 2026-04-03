"""Configuration management for the greenhouse dashboard backend."""

import os
from pathlib import Path
from typing import Any, Dict

import yaml
from dotenv import dotenv_values, load_dotenv
from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


#
# Ensure the repo-root .env is loaded into process environment variables.
#
# Why: parts of the code (e.g., OpenAI integration) use os.getenv() directly,
# and pydantic-settings' env_file does NOT automatically populate os.environ.
#
_REPO_ROOT = Path(__file__).resolve().parents[4]
_ENV_PATH = _REPO_ROOT / ".env"

# 1) Load .env (best effort). Use utf-8-sig to tolerate BOM from Windows editors.
try:
    load_dotenv(dotenv_path=_ENV_PATH, override=False, encoding="utf-8-sig")
except TypeError:
    # Older python-dotenv versions may not support encoding kwarg
    load_dotenv(dotenv_path=_ENV_PATH, override=False)

# 2) Some Windows editors write UTF-8 BOM; in that case the first key can become
#    "\ufeffOPENAI_API_KEY" and os.getenv("OPENAI_API_KEY") stays empty.
#    Also, project-local `.env` should win over an unrelated global shell key so
#    repo-scoped backend runs stay reproducible even if the user has another
#    OPENAI_API_KEY exported system-wide.
try:
    _dotenv = dotenv_values(dotenv_path=_ENV_PATH, encoding="utf-8-sig")
except TypeError:
    _dotenv = dotenv_values(dotenv_path=_ENV_PATH)

for _k in ("OPENAI_API_KEY", "OPENAI_MODEL"):
    if _dotenv.get(_k):
        os.environ[_k] = str(_dotenv[_k]).strip()


class Settings(BaseSettings):
    """Application settings from environment variables."""

    # Ignore unrelated env vars in the repo-root .env (e.g., OPENAI_API_KEY).
    model_config = SettingsConfigDict(
        env_file=str(_ENV_PATH), case_sensitive=False, extra="ignore"
    )

    host: str = Field(default="0.0.0.0", alias="HOST")
    port: int = Field(default=8000, alias="PORT")
    debug: bool = Field(default=False, alias="DEBUG")
    log_level: str = Field(default="INFO", alias="LOG_LEVEL")

    data_dir: str = Field(default=str(_REPO_ROOT / "data"), alias="DATA_DIR")
    config_dir: str = Field(default=str(_REPO_ROOT / "configs"), alias="CONFIG_DIR")

    ws_heartbeat_interval: int = Field(default=30, alias="WS_HEARTBEAT_INTERVAL")

    forecast_window_days: int = Field(default=7, alias="FORECAST_WINDOW_DAYS")
    forecast_reschedule_interval_h: int = Field(
        default=1, alias="FORECAST_RESCHEDULE_INTERVAL_H"
    )
    forecast_step_interval: int = Field(
        default=6, alias="FORECAST_STEP_INTERVAL"
    )  # Sample every N rows (6 = 1hr for 10-min data)


def load_greenhouse_config(config_path: str = None) -> Dict[str, Any]:
    """Load greenhouse configuration from YAML file."""
    if config_path is None:
        settings = Settings()
        config_path = os.path.join(settings.config_dir, "greenhouse.yaml")

    config_file = Path(config_path)
    if not config_file.exists():
        raise FileNotFoundError(f"Greenhouse config not found: {config_path}")

    with open(config_file, "r", encoding="utf-8") as f:
        config = yaml.safe_load(f)

    return config


# Global instances
settings = Settings()
greenhouse_config = load_greenhouse_config()
