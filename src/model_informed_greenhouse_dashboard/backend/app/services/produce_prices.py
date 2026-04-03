"""Live KAMIS produce price integration for dashboard-side market panels."""

from __future__ import annotations

import os
import time
from datetime import datetime, timezone
from typing import Any, Dict, Iterable

import httpx

KAMIS_OPEN_API_DOCS_URL = (
    "https://www.kamis.or.kr/customer/reference/openapi_list.do?action=detail&boardno=6"
)
KAMIS_DAILY_PRICE_URL = "https://www.kamis.or.kr/service/price/xml.do"
PRODUCE_PRICE_CACHE_TTL_SECONDS = 30 * 60

# The official KAMIS docs publish `test/test` as the sample credentials for
# the daily price endpoint. Production deployments can override them via env.
DEFAULT_KAMIS_API_KEY = "test"
DEFAULT_KAMIS_API_ID = "test"

FEATURED_PRODUCE_TARGETS = (
    {"source_name": "토마토/토마토", "display_name": "Tomato"},
    {"source_name": "방울토마토/방울토마토", "display_name": "Cherry Tomato"},
    {"source_name": "오이/다다기계통", "display_name": "Cucumber (Dadagi)"},
    {"source_name": "오이/취청", "display_name": "Cucumber (Chuicheong)"},
)

_produce_price_cache: Dict[str, Any] = {"expires_at": 0.0, "payload": None}


def _parse_krw(value: str | None) -> int:
    cleaned = str(value or "").replace(",", "").strip()
    return int(cleaned) if cleaned else 0


def _parse_pct(value: str | None) -> float:
    cleaned = str(value or "").replace(",", "").strip()
    return float(cleaned) if cleaned else 0.0


def _direction_label(code: str | None) -> str:
    return {"0": "down", "1": "up", "2": "flat"}.get(str(code or "2"), "flat")


def _signed_pct(direction: str, raw_pct: float) -> float:
    if direction == "up":
        return round(raw_pct, 1)
    if direction == "down":
        return round(-raw_pct, 1)
    return 0.0


def _normalize_price_row(row: Dict[str, Any], display_name: str | None = None) -> Dict[str, Any]:
    source_name = str(row.get("productName") or row.get("item_name") or "").strip()
    direction = _direction_label(str(row.get("direction") or "2"))
    latest_day = str(row.get("lastest_day") or row.get("lastest_date") or "").strip()
    raw_day_over_day_pct = _parse_pct(row.get("value"))

    return {
        "key": str(row.get("productno") or source_name),
        "display_name": display_name or source_name,
        "source_name": source_name,
        "category_name": str(row.get("category_name") or "").strip(),
        "market_label": str(row.get("product_cls_name") or "").strip(),
        "unit": str(row.get("unit") or "").strip(),
        "latest_day": latest_day,
        "current_price_krw": _parse_krw(row.get("dpr1")),
        "previous_day_price_krw": _parse_krw(row.get("dpr2")),
        "month_ago_price_krw": _parse_krw(row.get("dpr3")),
        "year_ago_price_krw": _parse_krw(row.get("dpr4")),
        "direction": direction,
        "day_over_day_pct": _signed_pct(direction, raw_day_over_day_pct),
        "raw_day_over_day_pct": round(raw_day_over_day_pct, 1),
    }


def _retail_rows(price_rows: Iterable[Dict[str, Any]]) -> list[Dict[str, Any]]:
    return [row for row in price_rows if str(row.get("product_cls_code") or "") == "01"]


def _build_featured_produce_items(price_rows: Iterable[Dict[str, Any]]) -> list[Dict[str, Any]]:
    retail_rows = _retail_rows(price_rows)
    featured_items: list[Dict[str, Any]] = []
    seen_source_names: set[str] = set()

    for target in FEATURED_PRODUCE_TARGETS:
        for row in retail_rows:
            source_name = str(row.get("productName") or row.get("item_name") or "").strip()
            if source_name != target["source_name"]:
                continue

            featured_items.append(
                _normalize_price_row(row, display_name=target["display_name"])
            )
            seen_source_names.add(source_name)
            break

    if len(featured_items) >= len(FEATURED_PRODUCE_TARGETS):
        return featured_items

    for row in retail_rows:
        source_name = str(row.get("productName") or row.get("item_name") or "").strip()
        if not source_name or source_name in seen_source_names:
            continue
        if str(row.get("category_code") or "") != "200":
            continue

        featured_items.append(_normalize_price_row(row))
        seen_source_names.add(source_name)

        if len(featured_items) >= len(FEATURED_PRODUCE_TARGETS):
            break

    return featured_items


def _build_summary(items: list[Dict[str, Any]], latest_day: str) -> str:
    if not items:
        return "KAMIS live market panel is waiting for featured retail produce prices."

    up_count = sum(1 for item in items if item["direction"] == "up")
    down_count = sum(1 for item in items if item["direction"] == "down")
    flat_count = sum(1 for item in items if item["direction"] == "flat")
    survey_label = latest_day or "the latest survey"
    lead_item = items[0]

    return (
        f"KAMIS latest retail survey ({survey_label}) shows {up_count} up, "
        f"{down_count} down, and {flat_count} flat moves across featured produce. "
        f"{lead_item['display_name']} is {lead_item['direction']} at "
        f"KRW {lead_item['current_price_krw']:,}/{lead_item['unit']}."
    )


async def fetch_featured_produce_prices(force_refresh: bool = False) -> Dict[str, Any]:
    now = time.time()
    if (
        not force_refresh
        and _produce_price_cache["payload"] is not None
        and now < float(_produce_price_cache["expires_at"])
    ):
        return _produce_price_cache["payload"]

    kamis_api_key = (os.getenv("KAMIS_API_KEY") or DEFAULT_KAMIS_API_KEY).strip()
    kamis_api_id = (os.getenv("KAMIS_API_ID") or DEFAULT_KAMIS_API_ID).strip()
    auth_mode = (
        "configured"
        if os.getenv("KAMIS_API_KEY") and os.getenv("KAMIS_API_ID")
        else "sample"
    )

    params = {
        "action": "dailySalesList",
        "p_cert_key": kamis_api_key,
        "p_cert_id": kamis_api_id,
        "p_returntype": "json",
    }

    async with httpx.AsyncClient(timeout=10.0, follow_redirects=True) as client:
        response = await client.get(KAMIS_DAILY_PRICE_URL, params=params)
        response.raise_for_status()
        data = response.json()

    error_code = str(data.get("error_code") or data.get("result_code") or "000")
    if error_code != "000":
        raise ValueError(f"KAMIS returned error code {error_code}.")

    featured_items = _build_featured_produce_items(data.get("price", []))
    if not featured_items:
        raise ValueError("KAMIS returned no featured retail produce prices.")

    latest_day = next(
        (item["latest_day"] for item in featured_items if item["latest_day"]),
        "",
    )
    payload = {
        "source": {
            "provider": "KAMIS",
            "docs_url": KAMIS_OPEN_API_DOCS_URL,
            "endpoint": "dailySalesList",
            "auth_mode": auth_mode,
            "fetched_at": datetime.now(timezone.utc)
            .isoformat()
            .replace("+00:00", "Z"),
            "latest_day": latest_day,
        },
        "summary": _build_summary(featured_items, latest_day),
        "items": featured_items,
    }

    _produce_price_cache["payload"] = payload
    _produce_price_cache["expires_at"] = now + PRODUCE_PRICE_CACHE_TTL_SECONDS
    return payload
