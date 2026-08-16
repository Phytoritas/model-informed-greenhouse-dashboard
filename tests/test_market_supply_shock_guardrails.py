from datetime import date, timedelta

from model_informed_greenhouse_dashboard.backend.app.services.adaptive_advisor.contracts import (
    MarketArrivalObservation,
    OperationsCalendar,
    OperationsCalendarEvent,
    OperationsEventType,
)
from model_informed_greenhouse_dashboard.backend.app.services.adaptive_advisor.market_supply_shock import (
    MarketObservationStore,
    estimate_supply_shock,
)
from model_informed_greenhouse_dashboard.backend.app.services.adaptive_advisor.operations_calendar import (
    OperationsCalendarStore,
)


def _market_store(tmp_path, forecast_start: date) -> MarketObservationStore:
    store = MarketObservationStore(tmp_path / "market.sqlite3")
    observations = []
    start = forecast_start - timedelta(days=84)
    for offset in range(84):
        day = start + timedelta(days=offset)
        volume = 1000.0 + day.weekday() * 10.0
        observations.append(
            MarketArrivalObservation(
                market_id="market-a",
                crop="tomato",
                observation_date=day,
                arrival_volume_kg=volume,
                wholesale_price_krw_per_kg=3600.0 * (1000.0 / volume) ** 0.5,
                source="test",
            )
        )
    store.append_many(observations)
    return store


def test_greenhouse_shipment_blackout_does_not_close_whole_market(tmp_path):
    start = date(2026, 8, 17)
    market = _market_store(tmp_path, start)
    calendar = OperationsCalendarStore(tmp_path / "operations.json")
    calendar.save(
        OperationsCalendar(
            greenhouse_id="house-1",
            events=[
                OperationsCalendarEvent(
                    event_id="farm-break",
                    event_type=OperationsEventType.SHIPMENT_BLACKOUT,
                    start_date=start,
                    end_date=start,
                    title="farm shipment blackout",
                ),
                OperationsCalendarEvent(
                    event_id="target",
                    event_type=OperationsEventType.SHIPMENT_TARGET,
                    start_date=start,
                    end_date=start,
                    title="registered shipment",
                    amount=300,
                    unit="kg",
                ),
            ],
        ),
        expected_revision=0,
    )
    result = estimate_supply_shock(
        market_store=market,
        calendar_store=calendar,
        market_id="market-a",
        crop="tomato",
        greenhouse_id="house-1",
        forecast_start=start,
        horizon_days=3,
    )
    first = result["daily"][0]
    assert first["market_open"] is True
    assert first["shipment_blackout"] is True
    assert first["expected_arrival_kg"] == first["baseline_arrival_kg"]
    assert first["deferred_registered_shipment_kg"] == 300
    assert start.isoformat() not in result["market_closed_dates"]


def test_unscoped_holiday_is_not_silently_promoted_to_market_closure(tmp_path):
    start = date(2026, 8, 17)
    market = _market_store(tmp_path, start)
    calendar = OperationsCalendarStore(tmp_path / "operations.json")
    calendar.save(
        OperationsCalendar(
            greenhouse_id="house-1",
            events=[
                OperationsCalendarEvent(
                    event_id="holiday",
                    event_type=OperationsEventType.HOLIDAY,
                    start_date=start,
                    end_date=start,
                    title="operator holiday",
                )
            ],
        ),
        expected_revision=0,
    )
    result = estimate_supply_shock(
        market_store=market,
        calendar_store=calendar,
        market_id="market-a",
        crop="tomato",
        greenhouse_id="house-1",
        forecast_start=start,
        horizon_days=2,
    )
    assert result["daily"][0]["market_open"] is True
    assert result["market_closed_dates"] == []
    assert any("metadata.market_closed" in value for value in result["assumptions"])


def test_latest_daily_market_revision_is_used_once(tmp_path):
    start = date(2026, 8, 17)
    store = MarketObservationStore(tmp_path / "market.sqlite3")
    day = start - timedelta(days=1)
    first = MarketArrivalObservation(
        market_id="market-a",
        crop="tomato",
        observation_date=day,
        arrival_volume_kg=1000,
        wholesale_price_krw_per_kg=3500,
        source="initial",
    )
    revised = MarketArrivalObservation(
        market_id="market-a",
        crop="tomato",
        observation_date=day,
        arrival_volume_kg=1200,
        wholesale_price_krw_per_kg=3300,
        source="corrected",
    )
    store.append(first)
    store.append(revised)
    rows = store.list(market_id="market-a", crop="tomato")
    assert len(rows) == 1
    assert rows[0]["arrival_volume_kg"] == 1200
