"""Live weather integration for dashboard-side outlook panels."""

from __future__ import annotations

import time
from typing import Any, Dict

import httpx

OPEN_METEO_DOCS_URL = "https://open-meteo.com/en/docs"
OPEN_METEO_FORECAST_URL = "https://api.open-meteo.com/v1/forecast"
WEATHER_CACHE_TTL_SECONDS = 15 * 60

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

_weather_cache: Dict[str, Any] = {"expires_at": 0.0, "payload": None}


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


async def fetch_daegu_weather_outlook(force_refresh: bool = False) -> Dict[str, Any]:
    now = time.time()
    if (
        not force_refresh
        and _weather_cache["payload"] is not None
        and now < float(_weather_cache["expires_at"])
    ):
        return _weather_cache["payload"]

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

    async with httpx.AsyncClient(timeout=10.0) as client:
        response = await client.get(OPEN_METEO_FORECAST_URL, params=params)
        response.raise_for_status()
        data = response.json()

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
