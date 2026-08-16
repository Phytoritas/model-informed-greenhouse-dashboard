from datetime import UTC, datetime, timedelta

from model_informed_greenhouse_dashboard.backend.app.services.adaptive_advisor.telemetry_store import (
    TelemetryStore,
)


def test_server_store_produces_same_time_previous_day_comparison(tmp_path):
    store = TelemetryStore(tmp_path / "telemetry.sqlite3")
    reference = datetime(2026, 8, 16, 1, 0, tzinfo=UTC)

    for minutes in (-40, -20, 0):
        previous = reference - timedelta(days=1) + timedelta(minutes=minutes)
        current = reference + timedelta(minutes=minutes)
        store.append(
            {
                "datetime": previous.isoformat(),
                "temperature": 24.0,
                "humidity": 72.0,
                "co2": 700.0,
                "light": 500.0,
                "vpd": 0.85,
                "photosynthesis": 19.0,
                "stomatalConductance": 0.32,
            },
            crop="tomato",
            greenhouse_id="house-1",
            source="test",
        )
        store.append(
            {
                "datetime": current.isoformat(),
                "temperature": 24.1,
                "humidity": 72.5,
                "co2": 705.0,
                "light": 510.0,
                "vpd": 0.88,
                "photosynthesis": 14.0,
                "stomatalConductance": 0.20,
            },
            crop="tomato",
            greenhouse_id="house-1",
            source="test",
        )

    comparison = store.compare_same_time(
        crop="tomato",
        greenhouse_id="house-1",
        current_data={"datetime": reference.isoformat(), "photosynthesis": 14.0},
        facets={
            "intent": "DIAGNOSE",
            "comparison_mode": "SAME_TIME_PREVIOUS_DAY",
            "target_signals": ["photosynthesis"],
        },
    )

    assert comparison["status"] == "ready"
    assert comparison["history_source"] == "server_timeseries"
    assert comparison["target_delta"] < 0
    assert comparison["environment_similarity"] >= 0.75
    assert comparison["server_point_count"] == 6


def test_telemetry_deduplicates_identical_points(tmp_path):
    store = TelemetryStore(tmp_path / "telemetry.sqlite3")
    point = {
        "datetime": "2026-08-16T00:00:00+00:00",
        "temperature": 24.0,
    }
    first = store.append(point, crop="tomato", greenhouse_id="house-1")
    second = store.append(point, crop="tomato", greenhouse_id="house-1")
    assert first["inserted"] is True
    assert second["inserted"] is False
