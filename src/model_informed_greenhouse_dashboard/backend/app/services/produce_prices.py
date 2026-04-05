"""Live KAMIS produce price integration for dashboard-side market panels."""

from __future__ import annotations

import asyncio
import os
import time
from datetime import date, datetime, timedelta, timezone
from typing import Any, Dict, Iterable

import httpx

KAMIS_OPEN_API_DOCS_URL = "https://www.kamis.or.kr/customer/reference/openapi_list.do"
KAMIS_DAILY_PRICE_URL = "https://www.kamis.or.kr/service/price/xml.do"
PRODUCE_PRICE_CACHE_TTL_SECONDS = 30 * 60
PRODUCE_TREND_HISTORY_DAYS = 14
PRODUCE_TREND_FORECAST_DAYS = 14
PRODUCE_TREND_NORMAL_YEAR_WINDOWS = (3, 5, 10)

# The official KAMIS docs publish `test/test` as the sample credentials for
# the daily price endpoint. Production deployments can override them via env.
DEFAULT_KAMIS_API_KEY = "test"
DEFAULT_KAMIS_API_ID = "test"

AVERAGE_COUNTY_LABEL = "\ud3c9\uade0"
MARKET_CODE_TO_KEY = {"01": "retail", "02": "wholesale"}
MARKET_KEY_TO_LABEL = {"retail": "Retail", "wholesale": "Wholesale"}

FEATURED_PRODUCE_TARGETS = (
    {
        "productno": "321",
        "snapshot_product_name": "\ud1a0\ub9c8\ud1a0/\ud1a0\ub9c8\ud1a0",
        "display_name": "Tomato",
        "itemcategorycode": "200",
        "itemcode": "225",
        "kindcode": "00",
        "productrankcode": "04",
        "countrycode": "1101",
    },
    {
        "productno": "437",
        "snapshot_product_name": "\ubc29\uc6b8\ud1a0\ub9c8\ud1a0/\ubc29\uc6b8\ud1a0\ub9c8\ud1a0",
        "display_name": "Cherry Tomato",
        "itemcategorycode": "200",
        "itemcode": "422",
        "kindcode": "01",
        "productrankcode": "04",
        "countrycode": "1101",
    },
    {
        "productno": "313",
        "snapshot_product_name": "\uc624\uc774/\ub2e4\ub2e4\uae30\uacc4",
        "display_name": "Cucumber (Dadagi)",
        "itemcategorycode": "200",
        "itemcode": "223",
        "kindcode": "02",
        "productrankcode": "04",
        "countrycode": "1101",
    },
    {
        "productno": "315",
        "snapshot_product_name": "\uc624\uc774/\ucde8\uccad",
        "display_name": "Cucumber (Chuicheong)",
        "itemcategorycode": "200",
        "itemcode": "223",
        "kindcode": "03",
        "productrankcode": "04",
        "countrycode": "1101",
    },
)

FEATURED_PRODUCE_TARGETS_BY_PRODUCTNO = {
    target["productno"]: target for target in FEATURED_PRODUCE_TARGETS
}

FEATURED_PRODUCE_TARGETS_BY_SOURCE_NAME = {
    target["snapshot_product_name"]: target for target in FEATURED_PRODUCE_TARGETS
}

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


def _extract_error_code(payload: Dict[str, Any]) -> str:
    nested = payload.get("data")
    if isinstance(nested, dict):
        nested_error = nested.get("error_code") or nested.get("result_code")
        if nested_error not in (None, ""):
            return str(nested_error)

    error_code = payload.get("error_code") or payload.get("result_code")
    return str(error_code) if error_code not in (None, "") else "000"


def _normalize_price_row(
    row: Dict[str, Any],
    *,
    display_name: str | None = None,
) -> Dict[str, Any]:
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


def _market_rows(
    price_rows: Iterable[Dict[str, Any]],
    *,
    market_code: str,
) -> list[Dict[str, Any]]:
    return [
        row for row in price_rows if str(row.get("product_cls_code") or "") == market_code
    ]


def _target_for_snapshot_row(row: Dict[str, Any]) -> Dict[str, str] | None:
    productno = str(row.get("productno") or "").strip()
    if productno and productno in FEATURED_PRODUCE_TARGETS_BY_PRODUCTNO:
        return FEATURED_PRODUCE_TARGETS_BY_PRODUCTNO[productno]

    source_name = str(row.get("productName") or row.get("item_name") or "").strip()
    if source_name and source_name in FEATURED_PRODUCE_TARGETS_BY_SOURCE_NAME:
        return FEATURED_PRODUCE_TARGETS_BY_SOURCE_NAME[source_name]

    return None


def _build_featured_produce_items(
    price_rows: Iterable[Dict[str, Any]],
    *,
    market_code: str = "01",
) -> list[Dict[str, Any]]:
    market_rows = _market_rows(price_rows, market_code=market_code)
    featured_items: list[Dict[str, Any]] = []
    seen_product_keys: set[str] = set()

    for target in FEATURED_PRODUCE_TARGETS:
        for row in market_rows:
            if _target_for_snapshot_row(row) != target:
                continue

            featured_items.append(
                _normalize_price_row(row, display_name=target["display_name"])
            )
            seen_product_keys.add(str(row.get("productno") or ""))
            break

    if len(featured_items) >= len(FEATURED_PRODUCE_TARGETS):
        return featured_items

    for row in market_rows:
        product_key = str(row.get("productno") or "").strip()
        if product_key and product_key in seen_product_keys:
            continue
        if str(row.get("category_code") or "") != "200":
            continue

        featured_items.append(_normalize_price_row(row))
        if product_key:
            seen_product_keys.add(product_key)

        if len(featured_items) >= len(FEATURED_PRODUCE_TARGETS):
            break

    return featured_items


def _parse_iso_date(value: str) -> date:
    return datetime.strptime(value, "%Y-%m-%d").date()


def _shift_years(day: date, years_back: int) -> date:
    target_year = day.year - years_back
    try:
        return day.replace(year=target_year)
    except ValueError:
        # Leap-day fallback.
        return day.replace(year=target_year, day=28)


def _parse_period_row_date(row: Dict[str, Any]) -> date:
    year = int(str(row.get("yyyy") or "").strip())
    month_text, day_text = str(row.get("regday") or "").strip().split("/")
    return date(year, int(month_text), int(day_text))


def _extract_average_price_series(period_rows: Iterable[Dict[str, Any]]) -> Dict[date, int]:
    series_by_date: Dict[date, int] = {}

    for row in period_rows:
        if str(row.get("countyname") or "").strip() != AVERAGE_COUNTY_LABEL:
            continue

        row_date = _parse_period_row_date(row)
        series_by_date[row_date] = _parse_krw(row.get("price"))

    return series_by_date


def _average_available_values(values: Iterable[int | None]) -> int | None:
    present_values = [value for value in values if value is not None]
    if not present_values:
        return None

    return round(sum(present_values) / len(present_values))


def _sample_count(values: Iterable[int | None]) -> int:
    return sum(1 for value in values if value is not None)


def _build_featured_trend_series(
    item: Dict[str, Any],
    reference_date: date,
    history_prices: Dict[date, int],
    seasonal_price_maps: Dict[int, Dict[date, int]],
) -> Dict[str, Any]:
    points: list[Dict[str, Any]] = []
    history_start = reference_date - timedelta(days=PRODUCE_TREND_HISTORY_DAYS - 1)

    for offset in range(PRODUCE_TREND_HISTORY_DAYS):
        point_date = history_start + timedelta(days=offset)
        points.append(
            {
                "date": point_date.isoformat(),
                "segment": "history",
                "actual_price_krw": history_prices.get(point_date),
                "normal_3y_price_krw": None,
                "normal_5y_price_krw": None,
                "normal_10y_price_krw": None,
                "normal_3y_sample_count": 0,
                "normal_5y_sample_count": 0,
                "normal_10y_sample_count": 0,
            }
        )

    for offset in range(1, PRODUCE_TREND_FORECAST_DAYS + 1):
        point_date = reference_date + timedelta(days=offset)
        point: Dict[str, Any] = {
            "date": point_date.isoformat(),
            "segment": "forecast",
            "actual_price_krw": None,
        }

        for window in PRODUCE_TREND_NORMAL_YEAR_WINDOWS:
            aligned_values = [
                seasonal_price_maps[years_back].get(_shift_years(point_date, years_back))
                for years_back in range(1, window + 1)
            ]
            point[f"normal_{window}y_price_krw"] = _average_available_values(aligned_values)
            point[f"normal_{window}y_sample_count"] = _sample_count(aligned_values)

        points.append(point)

    return {
        "key": item["key"],
        "display_name": item["display_name"],
        "source_name": item["source_name"],
        "unit": item["unit"],
        "reference_date": reference_date.isoformat(),
        "history_days": PRODUCE_TREND_HISTORY_DAYS,
        "forecast_days": PRODUCE_TREND_FORECAST_DAYS,
        "points": points,
    }


async def _fetch_period_average_prices(
    client: httpx.AsyncClient,
    *,
    target: Dict[str, str],
    start_date: date,
    end_date: date,
    kamis_api_key: str,
    kamis_api_id: str,
) -> Dict[date, int]:
    params = {
        "action": "periodRetailProductList",
        "p_cert_key": kamis_api_key,
        "p_cert_id": kamis_api_id,
        "p_returntype": "json",
        "p_startday": start_date.isoformat(),
        "p_endday": end_date.isoformat(),
        "p_itemcategorycode": target["itemcategorycode"],
        "p_itemcode": target["itemcode"],
        "p_kindcode": target["kindcode"],
        "p_productrankcode": target["productrankcode"],
        "p_countrycode": target["countrycode"],
        "p_convert_kg_yn": "N",
    }

    response = await client.get(KAMIS_DAILY_PRICE_URL, params=params)
    response.raise_for_status()
    payload = response.json()

    error_code = _extract_error_code(payload)
    if error_code != "000":
        raise ValueError(
            f"KAMIS returned error code {error_code} for periodRetailProductList."
        )

    period_rows = payload.get("data", {}).get("item", [])
    if not isinstance(period_rows, list):
        raise ValueError("KAMIS periodRetailProductList payload was invalid.")

    return _extract_average_price_series(period_rows)


async def _build_trend_series_for_item(
    client: httpx.AsyncClient,
    *,
    item: Dict[str, Any],
    reference_date: date,
    kamis_api_key: str,
    kamis_api_id: str,
) -> Dict[str, Any] | None:
    target = FEATURED_PRODUCE_TARGETS_BY_PRODUCTNO.get(str(item["key"]))
    if target is None:
        return None

    history_start = reference_date - timedelta(days=PRODUCE_TREND_HISTORY_DAYS - 1)
    future_start = reference_date + timedelta(days=1)
    future_end = reference_date + timedelta(days=PRODUCE_TREND_FORECAST_DAYS)

    max_window = max(PRODUCE_TREND_NORMAL_YEAR_WINDOWS)
    tasks = [
        _fetch_period_average_prices(
            client,
            target=target,
            start_date=history_start,
            end_date=reference_date,
            kamis_api_key=kamis_api_key,
            kamis_api_id=kamis_api_id,
        )
    ]

    for years_back in range(1, max_window + 1):
        tasks.append(
            _fetch_period_average_prices(
                client,
                target=target,
                start_date=_shift_years(future_start, years_back),
                end_date=_shift_years(future_end, years_back),
                kamis_api_key=kamis_api_key,
                kamis_api_id=kamis_api_id,
            )
        )

    results = await asyncio.gather(*tasks)
    history_prices = results[0]
    seasonal_price_maps = {
        years_back: results[years_back] for years_back in range(1, max_window + 1)
    }

    return _build_featured_trend_series(
        item,
        reference_date,
        history_prices,
        seasonal_price_maps,
    )


def _build_summary(
    items: list[Dict[str, Any]],
    latest_day: str,
    *,
    market_label: str,
) -> str:
    market_label_lower = market_label.lower()
    if not items:
        return (
            "KAMIS live market panel is waiting for featured "
            f"{market_label_lower} produce prices."
        )

    up_count = sum(1 for item in items if item["direction"] == "up")
    down_count = sum(1 for item in items if item["direction"] == "down")
    flat_count = sum(1 for item in items if item["direction"] == "flat")
    survey_label = latest_day or "the latest survey"
    lead_item = items[0]

    return (
        f"KAMIS latest {market_label_lower} survey ({survey_label}) shows {up_count} up, "
        f"{down_count} down, and {flat_count} flat moves across featured produce. "
        f"{lead_item['display_name']} is {lead_item['direction']} at "
        f"KRW {lead_item['current_price_krw']:,}/{lead_item['unit']}, and the panel "
        f"now exposes live {market_label_lower} cards alongside the retail 14-day "
        f"trend overlay and forward 3y/5y/10y seasonal normals."
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

    limits = httpx.Limits(max_connections=12, max_keepalive_connections=6)
    async with httpx.AsyncClient(
        timeout=10.0,
        follow_redirects=True,
        limits=limits,
    ) as client:
        response = await client.get(
            KAMIS_DAILY_PRICE_URL,
            params={
                "action": "dailySalesList",
                "p_cert_key": kamis_api_key,
                "p_cert_id": kamis_api_id,
                "p_returntype": "json",
            },
        )
        response.raise_for_status()
        data = response.json()

        error_code = _extract_error_code(data)
        if error_code != "000":
            raise ValueError(f"KAMIS returned error code {error_code}.")

        price_rows = data.get("price", [])
        retail_items = _build_featured_produce_items(price_rows, market_code="01")
        wholesale_items = _build_featured_produce_items(price_rows, market_code="02")
        if not retail_items and not wholesale_items:
            raise ValueError(
                "KAMIS returned no featured retail or wholesale produce prices."
            )

        latest_day = next(
            (item["latest_day"] for item in retail_items if item["latest_day"]),
            "",
        )
        if not latest_day:
            latest_day = next(
                (item["latest_day"] for item in wholesale_items if item["latest_day"]),
                "",
            )
        reference_date = _parse_iso_date(latest_day) if latest_day else datetime.now(
            timezone.utc
        ).date()

        trend_series_results = await asyncio.gather(
            *[
                _build_trend_series_for_item(
                    client,
                    item=item,
                    reference_date=reference_date,
                    kamis_api_key=kamis_api_key,
                    kamis_api_id=kamis_api_id,
                )
                for item in retail_items
            ],
            return_exceptions=True,
        )

    trend_series: list[Dict[str, Any]] = []
    unavailable_series: list[Dict[str, str]] = []
    for item, result in zip(retail_items, trend_series_results):
        if isinstance(result, Exception):
            unavailable_series.append(
                {
                    "key": item["key"],
                    "display_name": item["display_name"],
                    "reason": str(result),
                }
            )
            continue

        if result is None:
            unavailable_series.append(
                {
                    "key": item["key"],
                    "display_name": item["display_name"],
                    "reason": "No trend mapping is available for this featured item.",
                }
            )
            continue

        trend_series.append(result)

    markets = {
        MARKET_CODE_TO_KEY[market_code]: {
            "market_key": MARKET_CODE_TO_KEY[market_code],
            "market_label": MARKET_KEY_TO_LABEL[MARKET_CODE_TO_KEY[market_code]],
            "summary": _build_summary(
                items,
                next((item["latest_day"] for item in items if item["latest_day"]), latest_day),
                market_label=MARKET_KEY_TO_LABEL[MARKET_CODE_TO_KEY[market_code]],
            ),
            "items": items,
        }
        for market_code, items in (("01", retail_items), ("02", wholesale_items))
    }
    primary_market_key = "retail" if retail_items else "wholesale"
    primary_market = markets[primary_market_key]

    payload = {
        "source": {
            "provider": "KAMIS",
            "docs_url": KAMIS_OPEN_API_DOCS_URL,
            "endpoint": "dailySalesList + periodRetailProductList (retail trend overlay)",
            "auth_mode": auth_mode,
            "fetched_at": datetime.now(timezone.utc)
            .isoformat()
            .replace("+00:00", "Z"),
            "latest_day": latest_day,
        },
        "summary": primary_market["summary"],
        "items": primary_market["items"],
        "markets": markets,
        "trend": {
            "market_key": "retail",
            "reference_date": reference_date.isoformat(),
            "history_days": PRODUCE_TREND_HISTORY_DAYS,
            "forecast_days": PRODUCE_TREND_FORECAST_DAYS,
            "normal_year_windows": list(PRODUCE_TREND_NORMAL_YEAR_WINDOWS),
            "series": trend_series,
            "unavailable_series": unavailable_series,
        },
    }

    _produce_price_cache["payload"] = payload
    _produce_price_cache["expires_at"] = now + PRODUCE_PRICE_CACHE_TTL_SECONDS
    return payload
