from datetime import UTC, datetime, timedelta

from model_informed_greenhouse_dashboard.backend.app.services.adaptive_advisor.snapshot_resolution import (
    resolve_dashboard_snapshot,
)


NOW = datetime(2026, 8, 16, 1, 0, tzinfo=UTC)


def _point(at: datetime, **values):
    return {"datetime": at.isoformat(), **values}


def test_fresh_server_snapshot_replaces_missing_browser_state():
    dashboard, metadata = resolve_dashboard_snapshot(
        {},
        _point(
            NOW - timedelta(minutes=2),
            temperature=24.0,
            humidity=72.0,
            co2=680.0,
            light=520.0,
            vpd=0.85,
        ),
        now=NOW,
    )
    assert metadata["primary_source"] == "server"
    assert metadata["snapshot_age_seconds"] == 120.0
    assert dashboard["currentData"]["temperature"] == 24.0


def test_close_observations_fill_only_missing_fields():
    dashboard, metadata = resolve_dashboard_snapshot(
        {
            "currentData": _point(
                NOW,
                temperature=24.2,
                humidity=71.0,
            )
        },
        _point(
            NOW - timedelta(minutes=1),
            temperature=23.9,
            co2=690.0,
            light=500.0,
            vpd=0.8,
        ),
        now=NOW,
    )
    assert metadata["primary_source"] == "browser"
    assert set(metadata["filled_fields"]) == {"co2", "light", "vpd"}
    assert dashboard["currentData"]["temperature"] == 24.2
    assert dashboard["currentData"]["co2"] == 690.0


def test_stale_server_snapshot_does_not_fill_fresh_browser_state():
    dashboard, metadata = resolve_dashboard_snapshot(
        {
            "currentData": _point(
                NOW,
                temperature=24.2,
                humidity=71.0,
            )
        },
        _point(
            NOW - timedelta(hours=3),
            co2=690.0,
            light=500.0,
            vpd=0.8,
        ),
        now=NOW,
    )
    assert metadata["primary_source"] == "browser"
    assert metadata["filled_fields"] == []
    assert "co2" not in dashboard["currentData"]


def test_far_future_server_timestamp_is_not_treated_as_fresh():
    dashboard, metadata = resolve_dashboard_snapshot(
        {},
        _point(
            NOW + timedelta(hours=2),
            temperature=24.0,
            humidity=72.0,
            co2=680.0,
            light=520.0,
            vpd=0.85,
        ),
        now=NOW,
    )
    assert metadata["primary_source"] == "server_stale"
    assert metadata["snapshot_age_seconds"] is None
    assert dashboard["currentData"]["temperature"] == 24.0
