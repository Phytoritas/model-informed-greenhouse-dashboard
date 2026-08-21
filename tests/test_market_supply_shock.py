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


def test_holiday_backlog_and_registered_shipment_create_supply_shock(tmp_path):
    market_store = MarketObservationStore(tmp_path / "market.sqlite3")
    calendar_store = OperationsCalendarStore(tmp_path / "operations.json")
    forecast_start = date(2026, 8, 17)

    observations = []
    start = forecast_start - timedelta(days=84)
    for offset in range(84):
        day = start + timedelta(days=offset)
        volume = 1000.0 + (day.weekday() * 20.0)
        price = 3600.0 * (1000.0 / volume) ** 0.5
        observations.append(
            MarketArrivalObservation(
                market_id="wholesale-a",
                crop="tomato",
                observation_date=day,
                arrival_volume_kg=volume,
                wholesale_price_krw_per_kg=price,
                source="test",
            )
        )
    market_store.append_many(observations)

    calendar_store.save(
        OperationsCalendar(
            greenhouse_id="house-1",
            events=[
                OperationsCalendarEvent(
                    event_id="closure",
                    event_type=OperationsEventType.MARKET_CLOSURE,
                    start_date=forecast_start,
                    end_date=forecast_start + timedelta(days=1),
                    title="holiday closure",
                ),
                OperationsCalendarEvent(
                    event_id="shipment",
                    event_type=OperationsEventType.SHIPMENT_TARGET,
                    start_date=forecast_start + timedelta(days=2),
                    end_date=forecast_start + timedelta(days=2),
                    title="post-holiday shipment",
                    amount=600,
                    unit="kg",
                ),
            ],
        ),
        expected_revision=0,
    )

    result = estimate_supply_shock(
        market_store=market_store,
        calendar_store=calendar_store,
        market_id="wholesale-a",
        crop="tomato",
        greenhouse_id="house-1",
        forecast_start=forecast_start,
        horizon_days=7,
    )

    assert result["status"] == "ready"
    assert result["peak_shock"]["shock_ratio"] > 1.25
    assert result["peak_shock"]["price_pressure_pct"] < 0
    assert result["elasticity_source"] == "historical_log_log"
    assert result["online_policy_changed"] is False if "online_policy_changed" in result else True
