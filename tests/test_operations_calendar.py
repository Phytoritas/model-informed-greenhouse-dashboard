from datetime import date

import pytest

from model_informed_greenhouse_dashboard.backend.app.services.adaptive_advisor.contracts import (
    OperationsCalendar,
    OperationsCalendarEvent,
    OperationsEventType,
)
from model_informed_greenhouse_dashboard.backend.app.services.adaptive_advisor.operations_calendar import (
    CalendarRevisionConflict,
    OperationsCalendarStore,
)


def test_calendar_save_is_revisioned_and_window_summary_is_operational(tmp_path):
    store = OperationsCalendarStore(tmp_path / "operations.json")
    calendar = OperationsCalendar(
        greenhouse_id="house-1",
        events=[
            OperationsCalendarEvent(
                event_id="holiday-2026-08-17",
                event_type=OperationsEventType.SHIPMENT_BLACKOUT,
                start_date=date(2026, 8, 17),
                end_date=date(2026, 8, 18),
                title="휴가 출하 중단",
            ),
            OperationsCalendarEvent(
                event_id="shipment-2026-08-19",
                event_type=OperationsEventType.SHIPMENT_TARGET,
                start_date=date(2026, 8, 19),
                end_date=date(2026, 8, 19),
                title="휴가 후 집중 출하",
                amount=650,
                unit="kg",
            ),
        ],
    )

    saved = store.save(calendar, expected_revision=0)
    assert saved.revision == 1
    loaded = store.load("house-1")
    assert loaded.revision == 1
    assert len(loaded.events) == 2

    window = store.describe_window(
        "house-1",
        start=date(2026, 8, 17),
        end=date(2026, 8, 20),
    )
    assert window["shipment_blackout"] is True
    assert window["next_shipment"]["amount"] == 650
    assert window["event_count"] == 2


def test_calendar_compare_and_swap_rejects_stale_writer(tmp_path):
    store = OperationsCalendarStore(tmp_path / "operations.json")
    initial = OperationsCalendar(greenhouse_id="house-1")
    saved = store.save(initial, expected_revision=0)
    assert saved.revision == 1

    with pytest.raises(CalendarRevisionConflict):
        store.save(saved, expected_revision=0)
