"""Live weather integration for dashboard-side outlook panels."""

from __future__ import annotations

import logging
import time
from copy import deepcopy
from datetime import datetime, timedelta
from typing import Any, Dict
from zoneinfo import ZoneInfo

import httpx

OPEN_METEO_DOCS_URL = "https://open-meteo.com/en/docs"
OPEN_METEO_FORECAST_URL = "https://api.open-meteo.com/v1/forecast"
WEATHER_CACHE_TTL_SECONDS = 15 * 60
WEATHER_HISTORY_CACHE_TTL_SECONDS = 60
WEATHER_UPSTREAM_TIMEOUT = httpx.Timeout(connect=3.0, read=6.0, write=6.0, pool=6.0)
WEATHER_HISTORY_HOURS = 72

DAEGU_LOCATION = {
    "name": "Daegu",
    "country": "South Korea",
    "latitude": 35.8714,
    "longitude": 128.6014,
    "timezone": "Asia/Seoul",
}

_WMO_LABELS = {
    0: "Clear sky",
    1: "Mainly clear",
    2: "Partly cloudy",
    3: "Overcast",
    45: "Fog",
    48: "Rime fog",
    51: "Light drizzle",
    53: "Moderate drizzle",
    55: "Dense drizzle",
    56: "Light freezing drizzle",
    57: "Dense freezing drizzle",
    61: "Slight rain",
    63: "Moderate rain",
    65: "Heavy rain",
    66: "Light freezing rain",
    67: "Heavy freezing rain",
    71: "Slight snow",
    73: "Moderate snow",
    75: "Heavy snow",
    77: "Snow grains",
    80: "Light rain showers",
    81: "Moderate rain showers",
    82: "Violent rain showers",
    85: "Light snow showers",
    86: "Heavy snow showers",
    95: "Thunderstorm",
    96: "Thunderstorm with slight hail",
    99: "Thunderstorm with heavy hail",
}

_SEASONAL_FALLBACKS = {
    "winter": {
        "weather_code": 1,
        "temperature_max_c": 7.0,
        "temperature_min_c": -1.0,
        "current_day_c": 4.0,
        "current_night_c": 0.5,
        "humidity_pct": 50.0,
        "cloud_cover_pct": 26.0,
        "wind_speed_kmh": 10.5,
        "wind_direction_deg": 315.0,
        "shortwave_radiation_sum_mj_m2": 8.4,
        "precipitation_probability_max_pct": 20.0,
        "precipitation_sum_mm": 0.2,
        "wind_speed_max_kmh": 15.0,
        "sunshine_duration_h": 6.0,
    },
    "spring": {
        "weather_code": 2,
        "temperature_max_c": 19.0,
        "temperature_min_c": 9.5,
        "current_day_c": 16.5,
        "current_night_c": 11.5,
        "humidity_pct": 57.0,
        "cloud_cover_pct": 34.0,
        "wind_speed_kmh": 11.2,
        "wind_direction_deg": 185.0,
        "shortwave_radiation_sum_mj_m2": 15.2,
        "precipitation_probability_max_pct": 25.0,
        "precipitation_sum_mm": 0.6,
        "wind_speed_max_kmh": 16.0,
        "sunshine_duration_h": 7.2,
    },
    "summer": {
        "weather_code": 3,
        "temperature_max_c": 30.0,
        "temperature_min_c": 22.5,
        "current_day_c": 27.5,
        "current_night_c": 23.5,
        "humidity_pct": 74.0,
        "cloud_cover_pct": 58.0,
        "wind_speed_kmh": 12.8,
        "wind_direction_deg": 160.0,
        "shortwave_radiation_sum_mj_m2": 18.4,
        "precipitation_probability_max_pct": 52.0,
        "precipitation_sum_mm": 3.2,
        "wind_speed_max_kmh": 18.0,
        "sunshine_duration_h": 5.6,
    },
    "autumn": {
        "weather_code": 1,
        "temperature_max_c": 21.0,
        "temperature_min_c": 11.0,
        "current_day_c": 18.0,
        "current_night_c": 13.5,
        "humidity_pct": 60.0,
        "cloud_cover_pct": 28.0,
        "wind_speed_kmh": 9.6,
        "wind_direction_deg": 205.0,
        "shortwave_radiation_sum_mj_m2": 12.6,
        "precipitation_probability_max_pct": 24.0,
        "precipitation_sum_mm": 0.5,
        "wind_speed_max_kmh": 15.5,
        "sunshine_duration_h": 6.5,
    },
}

_weather_cache: Dict[str, Any] = {"expires_at": 0.0, "payload": None}
_weather_history_cache: Dict[str, Any] = {"expires_at": 0.0, "payload": None}
logger = logging.getLogger(__name__)


def _weather_label(code: int | None) -> str:
    return _WMO_LABELS.get(int(code or 0), "Unknown conditions")


def _sunshine_hours(seconds: float | int | None) -> float:
    if not seconds:
        return 0.0
    return round(float(seconds) / 3600.0, 1)


def _build_summary(current: Dict[str, Any], daily: list[Dict[str, Any]]) -> str:
    today = daily[0] if daily else None
    tomorrow = daily[1] if len(daily) > 1 else None
    today_label = today["weather_label"] if today else current["weather_label"]
    rain_today = today["precipitation_probability_max_pct"] if today else 0
    rain_tomorrow = (
        tomorrow["precipitation_probability_max_pct"] if tomorrow else rain_today
    )

    summary_parts = [
        (
            f"Daegu is currently {current['weather_label'].lower()} at "
            f"{current['temperature_c']:.1f}°C with {current['wind_speed_kmh']:.1f} km/h wind."
        ),
        (
            f"Today trends {today_label.lower()} with {today['temperature_max_c']:.1f}/{today['temperature_min_c']:.1f}°C "
            f"and up to {rain_today:.0f}% rain risk."
        )
        if today
        else "Today's daily outlook is unavailable.",
    ]

    if tomorrow:
        summary_parts.append(
            f"Tomorrow reaches {tomorrow['temperature_max_c']:.1f}°C with {rain_tomorrow:.0f}% rain risk."
        )

    return " ".join(summary_parts)


def _local_now(timestamp: float | None = None) -> datetime:
    return datetime.fromtimestamp(
        timestamp or time.time(),
        tz=ZoneInfo(DAEGU_LOCATION["timezone"]),
    )


def _seasonal_fallback_profile(now_dt: datetime) -> dict[str, float]:
    if now_dt.month in (12, 1, 2):
        return _SEASONAL_FALLBACKS["winter"]
    if now_dt.month in (3, 4, 5):
        return _SEASONAL_FALLBACKS["spring"]
    if now_dt.month in (6, 7, 8):
        return _SEASONAL_FALLBACKS["summer"]
    return _SEASONAL_FALLBACKS["autumn"]


def _build_cached_weather_payload(cached_payload: Dict[str, Any]) -> Dict[str, Any]:
    payload = deepcopy(cached_payload)
    source = dict(payload.get("source") or {})
    source["provider"] = "Open-Meteo cached"
    source["docs_url"] = OPEN_METEO_DOCS_URL
    payload["source"] = source
    payload["summary"] = (
        "Live Open-Meteo weather is temporarily unavailable, so the dashboard is "
        "showing the latest cached Daegu outlook until the feed recovers."
    )
    return payload


def _build_synthetic_fallback_payload(timestamp: float | None = None) -> Dict[str, Any]:
    now_dt = _local_now(timestamp)
    profile = _seasonal_fallback_profile(now_dt)
    is_day = 6 <= now_dt.hour < 18
    base_max = float(profile["temperature_max_c"])
    base_min = float(profile["temperature_min_c"])
    day_offsets = (
        (0.0, 0.0, 0.0, 0.0, 0.0),
        (1.2, 0.4, 10.0, 0.4, 1.0),
        (-0.6, 0.8, 15.0, 1.0, -0.5),
    )
    daily_entries = []

    for offset_days, (max_delta, min_delta, rain_delta, precip_delta, wind_delta) in enumerate(
        day_offsets
    ):
        day_dt = now_dt + timedelta(days=offset_days)
        weather_code = int(profile["weather_code"])
        daily_entries.append(
            {
                "date": day_dt.date().isoformat(),
                "weather_code": weather_code,
                "weather_label": _weather_label(weather_code),
                "temperature_max_c": round(base_max + max_delta, 1),
                "temperature_min_c": round(base_min + min_delta, 1),
                "shortwave_radiation_sum_mj_m2": round(
                    float(profile["shortwave_radiation_sum_mj_m2"]) - offset_days * 0.7,
                    1,
                ),
                "precipitation_probability_max_pct": round(
                    max(5.0, min(85.0, float(profile["precipitation_probability_max_pct"]) + rain_delta)),
                    1,
                ),
                "precipitation_sum_mm": round(
                    max(0.0, float(profile["precipitation_sum_mm"]) + precip_delta),
                    1,
                ),
                "wind_speed_max_kmh": round(
                    max(4.0, float(profile["wind_speed_max_kmh"]) + wind_delta),
                    1,
                ),
                "sunshine_duration_h": round(
                    max(1.0, float(profile["sunshine_duration_h"]) - offset_days * 0.4),
                    1,
                ),
            }
        )

    current_code = int(profile["weather_code"])
    current_temperature_c = (
        float(profile["current_day_c"]) if is_day else float(profile["current_night_c"])
    )
    payload = {
        "location": DAEGU_LOCATION,
        "source": {
            "provider": "Open-Meteo fallback",
            "docs_url": OPEN_METEO_DOCS_URL,
            "fetched_at": now_dt.isoformat(timespec="minutes"),
        },
        "summary": (
            "Live Open-Meteo weather is temporarily unavailable, so the dashboard is "
            "showing a fallback Daegu outlook anchored to seasonal baseline conditions."
        ),
        "current": {
            "time": now_dt.isoformat(timespec="minutes"),
            "weather_code": current_code,
            "weather_label": "Fallback outlook",
            "temperature_c": round(current_temperature_c, 1),
            "apparent_temperature_c": round(current_temperature_c - 0.4, 1),
            "relative_humidity_pct": float(profile["humidity_pct"]),
            "precipitation_mm": round(float(profile["precipitation_sum_mm"]) / 4.0, 1),
            "cloud_cover_pct": float(profile["cloud_cover_pct"]),
            "wind_speed_kmh": float(profile["wind_speed_kmh"]),
            "wind_direction_deg": float(profile["wind_direction_deg"]),
            "is_day": is_day,
        },
        "daily": daily_entries,
    }
    return payload


async def fetch_daegu_weather_outlook(force_refresh: bool = False) -> Dict[str, Any]:
    now = time.time()
    cached_payload = _weather_cache["payload"]
    if (
        not force_refresh
        and cached_payload is not None
        and now < float(_weather_cache["expires_at"])
    ):
        return cached_payload

    params = {
        "latitude": DAEGU_LOCATION["latitude"],
        "longitude": DAEGU_LOCATION["longitude"],
        "timezone": DAEGU_LOCATION["timezone"],
        "forecast_days": 3,
        "current": ",".join(
            [
                "temperature_2m",
                "relative_humidity_2m",
                "apparent_temperature",
                "is_day",
                "precipitation",
                "weather_code",
                "cloud_cover",
                "wind_speed_10m",
                "wind_direction_10m",
            ]
        ),
        "daily": ",".join(
            [
                "weather_code",
                "temperature_2m_max",
                "temperature_2m_min",
                "shortwave_radiation_sum",
                "precipitation_probability_max",
                "precipitation_sum",
                "wind_speed_10m_max",
                "sunshine_duration",
            ]
        ),
    }

    try:
        async with httpx.AsyncClient(timeout=WEATHER_UPSTREAM_TIMEOUT) as client:
            response = await client.get(OPEN_METEO_FORECAST_URL, params=params)
            response.raise_for_status()
            data = response.json()
    except httpx.HTTPError as exc:
        if cached_payload is not None:
            logger.warning("Open-Meteo weather fetch failed, reusing cached Daegu payload: %s", exc)
            return _build_cached_weather_payload(cached_payload)
        logger.warning("Open-Meteo weather fetch failed, using fallback Daegu payload: %s", exc)
        return _build_synthetic_fallback_payload(timestamp=now)

    current_raw = data["current"]
    daily_raw = data["daily"]
    daily_entries = []

    for index, day in enumerate(daily_raw["time"]):
        weather_code = int(daily_raw["weather_code"][index])
        daily_entries.append(
            {
                "date": day,
                "weather_code": weather_code,
                "weather_label": _weather_label(weather_code),
                "temperature_max_c": float(daily_raw["temperature_2m_max"][index]),
                "temperature_min_c": float(daily_raw["temperature_2m_min"][index]),
                "shortwave_radiation_sum_mj_m2": float(
                    daily_raw["shortwave_radiation_sum"][index]
                ),
                "precipitation_probability_max_pct": float(
                    daily_raw["precipitation_probability_max"][index]
                ),
                "precipitation_sum_mm": float(daily_raw["precipitation_sum"][index]),
                "wind_speed_max_kmh": float(daily_raw["wind_speed_10m_max"][index]),
                "sunshine_duration_h": _sunshine_hours(
                    daily_raw["sunshine_duration"][index]
                ),
            }
        )

    current_code = int(current_raw["weather_code"])
    payload = {
        "location": DAEGU_LOCATION,
        "source": {
            "provider": "Open-Meteo",
            "docs_url": OPEN_METEO_DOCS_URL,
            "fetched_at": current_raw["time"],
        },
        "current": {
            "time": current_raw["time"],
            "weather_code": current_code,
            "weather_label": _weather_label(current_code),
            "temperature_c": float(current_raw["temperature_2m"]),
            "apparent_temperature_c": float(current_raw["apparent_temperature"]),
            "relative_humidity_pct": float(current_raw["relative_humidity_2m"]),
            "precipitation_mm": float(current_raw["precipitation"]),
            "cloud_cover_pct": float(current_raw["cloud_cover"]),
            "wind_speed_kmh": float(current_raw["wind_speed_10m"]),
            "wind_direction_deg": float(current_raw["wind_direction_10m"]),
            "is_day": bool(current_raw["is_day"]),
        },
        "daily": daily_entries,
    }
    payload["summary"] = _build_summary(payload["current"], daily_entries)

    _weather_cache["payload"] = payload
    _weather_cache["expires_at"] = now + WEATHER_CACHE_TTL_SECONDS
    return payload


async def fetch_daegu_shortwave_history(
    *,
    hours: int = WEATHER_HISTORY_HOURS,
    force_refresh: bool = False,
) -> Dict[str, Any]:
    """Return actual outside irradiance history for Daegu from Open-Meteo."""
    now = time.time()
    cached_payload = _weather_history_cache["payload"]
    if (
        not force_refresh
        and cached_payload is not None
        and now < float(_weather_history_cache["expires_at"])
        and int(cached_payload.get("window_hours") or 0) == int(hours)
    ):
        return deepcopy(cached_payload)

    params = {
        "latitude": DAEGU_LOCATION["latitude"],
        "longitude": DAEGU_LOCATION["longitude"],
        "timezone": DAEGU_LOCATION["timezone"],
        "current": "shortwave_radiation",
        "hourly": "shortwave_radiation",
        "past_hours": max(1, int(hours)),
        "forecast_hours": 0,
    }

    async with httpx.AsyncClient(timeout=WEATHER_UPSTREAM_TIMEOUT) as client:
        response = await client.get(OPEN_METEO_FORECAST_URL, params=params)
        response.raise_for_status()
        data = response.json()

    hourly = data.get("hourly") or {}
    current = data.get("current") or {}
    hourly_times = hourly.get("time") or []
    shortwave_values = hourly.get("shortwave_radiation") or []
    points = []
    for timestamp, irradiance in zip(hourly_times, shortwave_values, strict=False):
        if irradiance is None:
            continue
        points.append(
            {
                "time": str(timestamp),
                "shortwave_radiation_w_m2": float(irradiance),
            }
        )
    current_time = current.get("time")
    current_shortwave = current.get("shortwave_radiation")
    if current_time and current_shortwave is not None:
        current_point = {
            "time": str(current_time),
            "shortwave_radiation_w_m2": float(current_shortwave),
        }
        if points and points[-1]["time"] == current_point["time"]:
            points[-1] = current_point
        else:
            points.append(current_point)

    payload = {
        "location": DAEGU_LOCATION,
        "source": {
            "provider": "Open-Meteo",
            "docs_url": OPEN_METEO_DOCS_URL,
            "endpoint": OPEN_METEO_FORECAST_URL,
            "fetched_at": str(current_time or _local_now(now).isoformat(timespec="minutes")),
        },
        "window_hours": max(1, int(hours)),
        "unit": "W/m²",
        "points": points,
    }
    _weather_history_cache["payload"] = deepcopy(payload)
    _weather_history_cache["expires_at"] = now + WEATHER_HISTORY_CACHE_TTL_SECONDS
    return payload
