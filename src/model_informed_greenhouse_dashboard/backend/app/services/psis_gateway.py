"""RDA PSIS gateway: the authoritative source for pesticide safe-use standards.

The local pesticide workbook has no PHI or application-count field, so those legally
binding numbers must come from the authoritative registry — the RDA 농약안전정보시스템
(PSIS), which publishes 안전사용기준 through public OpenAPI on data.go.kr. This module is
that integration.

It is **fail-closed by construction**: with no configured service key it does not guess,
it reports ``unconfigured`` and the caller keeps refusing the number and pointing the grower
to the registry (see :mod:`pesticide_safety`). A stale or failed lookup is likewise a
refusal, never a fabricated figure. The LLM is never in this numeric path.

The transport mirrors the existing KAMIS integration (:mod:`produce_prices`): an env-provided
key, an httpx call with a bounded timeout, and a structured fallback on any failure.

Configuration:
    PSIS_SERVICE_KEY   data.go.kr service key (URL-decoded). Absent -> unconfigured.
    PSIS_BASE_URL      override for the safe-use-standard endpoint (optional).

Reference: docs/research/20260717-advisor-answer-quality-architecture/improvement_spec.md
Registry: https://psis.rda.go.kr/  ·  OpenAPI: https://www.data.go.kr/data/15059306/openapi.do
"""

from __future__ import annotations

import os
from dataclasses import dataclass
from typing import Any

import httpx


#: data.go.kr safe-use-standard (농약안전사용지침) service, default endpoint.
_DEFAULT_BASE_URL = "http://apis.data.go.kr/1390802/AgriPollutionService/getPesticideList"
_TIMEOUT_SECONDS = 8.0

#: How long a fetched standard may be treated as fresh before it must be re-fetched.
#: Registrations change; a lease keeps a served number from silently going stale.
AUTHORITY_LEASE_SECONDS = 24 * 60 * 60


@dataclass(frozen=True)
class SafeUseStandard:
    """A single authoritative safe-use record, or an unavailable result."""

    status: str  # "ok" | "unconfigured" | "not_found" | "error"
    product_name: str | None = None
    crop: str | None = None
    target_pest: str | None = None
    pre_harvest_interval_days: int | None = None
    max_applications: int | None = None
    dilution: str | None = None
    registration_status: str | None = None
    source: str = "rda_psis"
    fetched_at: str | None = None
    detail: str | None = None

    @property
    def is_authoritative(self) -> bool:
        return self.status == "ok" and self.pre_harvest_interval_days is not None

    def to_dict(self) -> dict[str, Any]:
        return {
            "status": self.status,
            "product_name": self.product_name,
            "crop": self.crop,
            "target_pest": self.target_pest,
            "pre_harvest_interval_days": self.pre_harvest_interval_days,
            "max_applications": self.max_applications,
            "dilution": self.dilution,
            "registration_status": self.registration_status,
            "source": self.source,
            "fetched_at": self.fetched_at,
            "detail": self.detail,
        }


def _service_key() -> str | None:
    key = os.getenv("PSIS_SERVICE_KEY", "").strip()
    return key or None


def is_configured() -> bool:
    """Whether a PSIS service key is present. Without it the gateway fails closed."""
    return _service_key() is not None


def _base_url() -> str:
    return os.getenv("PSIS_BASE_URL", "").strip() or _DEFAULT_BASE_URL


def _coerce_int(value: Any) -> int | None:
    try:
        text = str(value).strip()
        return int(text) if text and text.lstrip("-").isdigit() else None
    except (TypeError, ValueError):
        return None


def fetch_safe_use_standard(
    *,
    crop: str,
    product_or_ingredient: str,
    target_pest: str | None = None,
    now_iso: str | None = None,
    client: httpx.Client | None = None,
) -> SafeUseStandard:
    """Fetch the authoritative safe-use standard, or fail closed.

    Returns ``status="unconfigured"`` when no key is set — the caller must then keep
    refusing rather than presenting any number. ``now_iso`` is injected rather than
    read from the clock so the call is deterministic and testable.
    """
    if not is_configured():
        return SafeUseStandard(
            status="unconfigured",
            crop=crop,
            detail="no PSIS_SERVICE_KEY; the authoritative registry was not queried",
        )

    params = {
        "serviceKey": _service_key(),
        "cropName": crop,
        "pestName": target_pest or "",
        "pesticideName": product_or_ingredient,
        "numOfRows": "1",
        "pageNo": "1",
        "type": "json",
    }
    try:
        owns_client = client is None
        active = client or httpx.Client(timeout=_TIMEOUT_SECONDS)
        try:
            response = active.get(_base_url(), params=params)
            response.raise_for_status()
            payload = response.json()
        finally:
            if owns_client:
                active.close()
    except (httpx.HTTPError, ValueError) as exc:
        return SafeUseStandard(
            status="error",
            crop=crop,
            detail=f"PSIS lookup failed: {type(exc).__name__}",
        )

    record = _first_record(payload)
    if record is None:
        return SafeUseStandard(
            status="not_found",
            crop=crop,
            detail="no matching safe-use record in PSIS",
        )

    return SafeUseStandard(
        status="ok",
        product_name=record.get("pesticideName") or product_or_ingredient,
        crop=record.get("cropName") or crop,
        target_pest=record.get("pestName") or target_pest,
        pre_harvest_interval_days=_coerce_int(record.get("useSuittime")),
        max_applications=_coerce_int(record.get("useNum")),
        dilution=(str(record.get("dilutUnit")).strip() or None) if record.get("dilutUnit") else None,
        registration_status=record.get("prlsGboonName"),
        fetched_at=now_iso,
    )


def _first_record(payload: Any) -> dict[str, Any] | None:
    """Pull the first item out of the data.go.kr response envelope, defensively."""
    if not isinstance(payload, dict):
        return None
    body = payload.get("response", {}).get("body", {}) if "response" in payload else payload
    items = body.get("items") if isinstance(body, dict) else None
    if isinstance(items, dict):
        items = items.get("item")
    if isinstance(items, list) and items:
        first = items[0]
        return first if isinstance(first, dict) else None
    if isinstance(items, dict):
        return items
    return None
