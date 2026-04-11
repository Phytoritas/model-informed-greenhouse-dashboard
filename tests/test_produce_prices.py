import asyncio
from datetime import date

from model_informed_greenhouse_dashboard.backend.app.services import produce_prices


def _make_row(
    *,
    product_cls_code: str = "01",
    category_code: str = "200",
    category_name: str = "\ucc44\uc18c\ub958",
    product_name: str,
    productno: str,
    unit: str,
    dpr1: str,
    dpr2: str,
    dpr3: str,
    dpr4: str,
    direction: str,
    value: str,
) -> dict:
    return {
        "product_cls_code": product_cls_code,
        "product_cls_name": "\uc18c\ub9e4" if product_cls_code == "01" else "\ub3c4\ub9e4",
        "category_code": category_code,
        "category_name": category_name,
        "productno": productno,
        "productName": product_name,
        "item_name": product_name,
        "unit": unit,
        "lastest_day": "2026-04-03",
        "dpr1": dpr1,
        "dpr2": dpr2,
        "dpr3": dpr3,
        "dpr4": dpr4,
        "direction": direction,
        "value": value,
    }


def test_featured_produce_selection_prefers_curated_retail_targets() -> None:
    rows = [
        _make_row(
            product_cls_code="02",
            product_name="\ud1a0\ub9c8\ud1a0/\ud1a0\ub9c8\ud1a0",
            productno="60",
            unit="5kg",
            dpr1="18,140",
            dpr2="18,800",
            dpr3="17,480",
            dpr4="19,556",
            direction="0",
            value="3.5",
        ),
        _make_row(
            product_name="\uc624\uc774/\ub2e4\ub2e4\uae30\uacc4",
            productno="313",
            unit="10ea",
            dpr1="8,505",
            dpr2="8,450",
            dpr3="10,880",
            dpr4="10,035",
            direction="1",
            value="0.7",
        ),
        _make_row(
            product_name="\uc624\uc774/\ucde8\uccad",
            productno="315",
            unit="10ea",
            dpr1="12,999",
            dpr2="13,043",
            dpr3="14,777",
            dpr4="16,271",
            direction="0",
            value="0.3",
        ),
        _make_row(
            product_name="\ud1a0\ub9c8\ud1a0/\ud1a0\ub9c8\ud1a0",
            productno="321",
            unit="1kg",
            dpr1="5,196",
            dpr2="5,234",
            dpr3="5,219",
            dpr4="5,663",
            direction="0",
            value="0.7",
        ),
        _make_row(
            product_name="\ubc29\uc6b8\ud1a0\ub9c8\ud1a0/\ubc29\uc6b8\ud1a0\ub9c8\ud1a0",
            productno="437",
            unit="1kg",
            dpr1="10,639",
            dpr2="10,639",
            dpr3="10,357",
            dpr4="11,707",
            direction="2",
            value="0.0",
        ),
    ]

    items = produce_prices._build_featured_produce_items(rows, market_code="01")

    assert [item["display_name"] for item in items] == [
        "Tomato",
        "Cherry Tomato",
        "Cucumber (Dadagi)",
        "Cucumber (Chuicheong)",
    ]
    assert items[0]["current_price_krw"] == 5196
    assert items[0]["direction"] == "down"
    assert items[2]["direction"] == "up"
    assert items[2]["day_over_day_pct"] == 0.7


def test_featured_produce_selection_can_build_wholesale_snapshot() -> None:
    rows = [
        _make_row(
            product_cls_code="02",
            product_name="\ud1a0\ub9c8\ud1a0/\ud1a0\ub9c8\ud1a0",
            productno="321",
            unit="5kg",
            dpr1="18,140",
            dpr2="18,800",
            dpr3="17,480",
            dpr4="19,556",
            direction="0",
            value="3.5",
        ),
        _make_row(
            product_cls_code="02",
            product_name="\ubc29\uc6b8\ud1a0\ub9c8\ud1a0/\ubc29\uc6b8\ud1a0\ub9c8\ud1a0",
            productno="437",
            unit="2kg",
            dpr1="21,222",
            dpr2="20,800",
            dpr3="19,750",
            dpr4="22,015",
            direction="1",
            value="2.0",
        ),
        _make_row(
            product_cls_code="02",
            product_name="\uc624\uc774/\ub2e4\ub2e4\uae30\uacc4",
            productno="313",
            unit="100ea",
            dpr1="31,000",
            dpr2="30,100",
            dpr3="28,400",
            dpr4="32,200",
            direction="1",
            value="3.0",
        ),
        _make_row(
            product_cls_code="02",
            product_name="\uc624\uc774/\ucde8\uccad",
            productno="315",
            unit="50ea",
            dpr1="23,400",
            dpr2="23,900",
            dpr3="24,100",
            dpr4="25,050",
            direction="0",
            value="2.1",
        ),
    ]

    items = produce_prices._build_featured_produce_items(rows, market_code="02")

    assert [item["display_name"] for item in items] == [
        "Tomato",
        "Cherry Tomato",
        "Cucumber (Dadagi)",
        "Cucumber (Chuicheong)",
    ]
    assert items[0]["market_label"] == "\ub3c4\ub9e4"
    assert items[0]["unit"] == "5kg"
    assert items[1]["direction"] == "up"
    assert items[3]["day_over_day_pct"] == -2.1


def test_featured_produce_selection_falls_back_to_other_vegetables() -> None:
    rows = [
        _make_row(
            product_name="\ud1a0\ub9c8\ud1a0/\ud1a0\ub9c8\ud1a0",
            productno="321",
            unit="1kg",
            dpr1="5,196",
            dpr2="5,234",
            dpr3="5,219",
            dpr4="5,663",
            direction="0",
            value="0.7",
        ),
        _make_row(
            product_name="\ubc30\ucd94/\ubd09\ub3d9",
            productno="295",
            unit="1head",
            dpr1="4,573",
            dpr2="4,578",
            dpr3="5,153",
            dpr4="5,643",
            direction="0",
            value="0.1",
        ),
        _make_row(
            product_name="\uc5bc\uac08\uc774\ubc30\ucd94/\uc5bc\uac08\uc774\ubc30\ucd94",
            productno="297",
            unit="1head",
            dpr1="3,054",
            dpr2="3,083",
            dpr3="4,100",
            dpr4="5,269",
            direction="0",
            value="0.9",
        ),
        _make_row(
            product_name="\ube0c\ub85c\ucf5c\ub9ac/\ube0c\ub85c\ucf5c\ub9ac(\uad6d\uc0b0)",
            productno="301",
            unit="1ea",
            dpr1="2,460",
            dpr2="2,447",
            dpr3="2,520",
            dpr4="3,180",
            direction="1",
            value="0.5",
        ),
    ]

    items = produce_prices._build_featured_produce_items(rows, market_code="01")

    assert len(items) == 4
    assert items[0]["display_name"] == "Tomato"
    assert items[1]["display_name"] == "\ubc30\ucd94/\ubd09\ub3d9"
    assert items[2]["display_name"] == "\uc5bc\uac08\uc774\ubc30\ucd94/\uc5bc\uac08\uc774\ubc30\ucd94"
    assert items[3]["display_name"] == "\ube0c\ub85c\ucf5c\ub9ac/\ube0c\ub85c\ucf5c\ub9ac(\uad6d\uc0b0)"


def test_build_featured_trend_series_combines_history_and_forward_normals() -> None:
    item = {
        "key": "321",
        "display_name": "Tomato",
        "source_name": "\ud1a0\ub9c8\ud1a0/\ud1a0\ub9c8\ud1a0",
        "unit": "1kg",
    }
    reference_date = date(2026, 4, 3)
    history_prices = {
        date(2026, 3, 21): 5000,
        date(2026, 4, 2): 5182,
        date(2026, 4, 3): 4932,
    }
    seasonal_price_maps = {
        years_back: {} for years_back in range(1, 11)
    }
    seasonal_price_maps[1][date(2025, 4, 4)] = 5258
    seasonal_price_maps[2][date(2024, 4, 4)] = 7502
    seasonal_price_maps[3][date(2023, 4, 4)] = 6788
    seasonal_price_maps[4][date(2022, 4, 4)] = 6400
    seasonal_price_maps[5][date(2021, 4, 4)] = 6120
    seasonal_price_maps[6][date(2020, 4, 4)] = 5800
    seasonal_price_maps[7][date(2019, 4, 4)] = 6100
    seasonal_price_maps[8][date(2018, 4, 4)] = 6000
    seasonal_price_maps[9][date(2017, 4, 4)] = 5900
    seasonal_price_maps[10][date(2016, 4, 4)] = 5700

    series = produce_prices._build_featured_trend_series(
        item,
        reference_date,
        history_prices,
        seasonal_price_maps,
    )

    assert series["reference_date"] == "2026-04-03"
    assert series["history_days"] == 14
    assert series["forecast_days"] == 14
    assert len(series["points"]) == 28

    first_history_point = series["points"][0]
    last_history_point = series["points"][13]
    first_forecast_point = series["points"][14]

    assert first_history_point["date"] == "2026-03-21"
    assert first_history_point["segment"] == "history"
    assert first_history_point["actual_price_krw"] == 5000
    assert last_history_point["date"] == "2026-04-03"
    assert last_history_point["actual_price_krw"] == 4932

    assert first_forecast_point["date"] == "2026-04-04"
    assert first_forecast_point["segment"] == "forecast"
    assert first_forecast_point["actual_price_krw"] is None
    assert first_forecast_point["normal_3y_price_krw"] == round((5258 + 7502 + 6788) / 3)
    assert first_forecast_point["normal_5y_price_krw"] == round(
        (5258 + 7502 + 6788 + 6400 + 6120) / 5
    )
    assert first_forecast_point["normal_10y_price_krw"] == round(
        (5258 + 7502 + 6788 + 6400 + 6120 + 5800 + 6100 + 6000 + 5900 + 5700) / 10
    )
    assert first_forecast_point["normal_3y_sample_count"] == 3
    assert first_forecast_point["normal_5y_sample_count"] == 5
    assert first_forecast_point["normal_10y_sample_count"] == 10


def test_fetch_featured_produce_prices_preserves_cards_when_trend_enrichment_fails(
    monkeypatch,
) -> None:
    class FakeResponse:
        def __init__(self, payload: dict) -> None:
            self._payload = payload

        def raise_for_status(self) -> None:
            return None

        def json(self) -> dict:
            return self._payload

    class FakeAsyncClient:
        def __init__(self, *args, **kwargs) -> None:
            return None

        async def __aenter__(self):
            return self

        async def __aexit__(self, exc_type, exc, tb) -> None:
            return None

        async def get(self, url: str, params: dict) -> FakeResponse:
            assert params["action"] == "dailySalesList"
            return FakeResponse(
                {
                    "price": [
                        _make_row(
                            product_name="\ud1a0\ub9c8\ud1a0/\ud1a0\ub9c8\ud1a0",
                            productno="321",
                            unit="1kg",
                            dpr1="5,196",
                            dpr2="5,234",
                            dpr3="5,219",
                            dpr4="5,663",
                            direction="0",
                            value="0.7",
                        ),
                        _make_row(
                            product_name="\ubc29\uc6b8\ud1a0\ub9c8\ud1a0/\ubc29\uc6b8\ud1a0\ub9c8\ud1a0",
                            productno="437",
                            unit="1kg",
                            dpr1="10,639",
                            dpr2="10,639",
                            dpr3="10,357",
                            dpr4="11,707",
                            direction="2",
                            value="0.0",
                        ),
                        _make_row(
                            product_name="\uc624\uc774/\ub2e4\ub2e4\uae30\uacc4",
                            productno="313",
                            unit="10ea",
                            dpr1="8,505",
                            dpr2="8,450",
                            dpr3="10,880",
                            dpr4="10,035",
                            direction="1",
                            value="0.7",
                        ),
                        _make_row(
                            product_name="\uc624\uc774/\ucde8\uccad",
                            productno="315",
                            unit="10ea",
                            dpr1="12,999",
                            dpr2="13,043",
                            dpr3="14,777",
                            dpr4="16,271",
                            direction="0",
                            value="0.3",
                        ),
                        _make_row(
                            product_cls_code="02",
                            product_name="\ud1a0\ub9c8\ud1a0/\ud1a0\ub9c8\ud1a0",
                            productno="321",
                            unit="5kg",
                            dpr1="18,140",
                            dpr2="18,800",
                            dpr3="17,480",
                            dpr4="19,556",
                            direction="0",
                            value="3.5",
                        ),
                        _make_row(
                            product_cls_code="02",
                            product_name="\ubc29\uc6b8\ud1a0\ub9c8\ud1a0/\ubc29\uc6b8\ud1a0\ub9c8\ud1a0",
                            productno="437",
                            unit="2kg",
                            dpr1="21,222",
                            dpr2="20,800",
                            dpr3="19,750",
                            dpr4="22,015",
                            direction="1",
                            value="2.0",
                        ),
                    ]
                }
            )

    async def fake_build_trend_series_for_item(*args, **kwargs):
        raise ValueError("trend overlay unavailable")

    produce_prices._produce_price_cache["payload"] = None
    produce_prices._produce_price_cache["expires_at"] = 0.0
    monkeypatch.setattr(produce_prices.httpx, "AsyncClient", FakeAsyncClient)
    monkeypatch.setattr(
        produce_prices,
        "_build_trend_series_for_item",
        fake_build_trend_series_for_item,
    )

    payload = asyncio.run(produce_prices.fetch_featured_produce_prices(force_refresh=True))

    assert len(payload["items"]) == 2
    assert payload["items"][0]["display_name"] == "Tomato"
    assert payload["markets"]["retail"]["items"][0]["market_label"] == "\uc18c\ub9e4"
    assert payload["markets"]["wholesale"]["items"][0]["market_label"] == "\ub3c4\ub9e4"
    assert payload["markets"]["wholesale"]["items"][0]["unit"] == "5kg"
    assert payload["trend"]["series"] == []
    assert payload["trend"]["market_key"] == "wholesale"
    assert len(payload["trend"]["unavailable_series"]) == 2
    assert payload["trend"]["unavailable_series"][0]["display_name"] == "Tomato"


def test_fetch_featured_produce_prices_returns_snapshot_when_trend_enrichment_times_out(
    monkeypatch,
) -> None:
    class FakeResponse:
        def __init__(self, payload: dict) -> None:
            self._payload = payload

        def raise_for_status(self) -> None:
            return None

        def json(self) -> dict:
            return self._payload

    class FakeAsyncClient:
        def __init__(self, *args, **kwargs) -> None:
            return None

        async def __aenter__(self):
            return self

        async def __aexit__(self, exc_type, exc, tb) -> None:
            return None

        async def get(self, url: str, params: dict) -> FakeResponse:
            assert params["action"] == "dailySalesList"
            return FakeResponse(
                {
                    "price": [
                        _make_row(
                            product_name="토마토/토마토",
                            productno="321",
                            unit="1kg",
                            dpr1="5,196",
                            dpr2="5,234",
                            dpr3="5,219",
                            dpr4="5,663",
                            direction="0",
                            value="0.7",
                        ),
                        _make_row(
                            product_name="방울토마토/방울토마토",
                            productno="437",
                            unit="1kg",
                            dpr1="10,639",
                            dpr2="10,639",
                            dpr3="10,357",
                            dpr4="11,707",
                            direction="2",
                            value="0.0",
                        ),
                        _make_row(
                            product_name="오이/다다기계통",
                            productno="313",
                            unit="10ea",
                            dpr1="8,505",
                            dpr2="8,450",
                            dpr3="10,880",
                            dpr4="10,035",
                            direction="1",
                            value="0.7",
                        ),
                        _make_row(
                            product_name="오이/취청",
                            productno="315",
                            unit="10ea",
                            dpr1="12,999",
                            dpr2="13,043",
                            dpr3="14,777",
                            dpr4="16,271",
                            direction="0",
                            value="0.3",
                        ),
                    ]
                }
            )

    async def slow_build_trend_series_for_item(*args, **kwargs):
        await asyncio.sleep(0.02)
        return {"key": "late"}

    produce_prices._produce_price_cache["payload"] = None
    produce_prices._produce_price_cache["expires_at"] = 0.0
    monkeypatch.setattr(produce_prices.httpx, "AsyncClient", FakeAsyncClient)
    monkeypatch.setattr(
        produce_prices,
        "_build_trend_series_for_item",
        slow_build_trend_series_for_item,
    )
    monkeypatch.setattr(
        produce_prices,
        "PRODUCE_TREND_ENRICHMENT_TIMEOUT_SECONDS",
        0.001,
    )

    payload = asyncio.run(produce_prices.fetch_featured_produce_prices(force_refresh=True))

    assert len(payload["items"]) == 4
    assert payload["trend"]["series"] == []
    assert len(payload["trend"]["unavailable_series"]) == 4
    assert all(
        item["reason"] == "Retail trend enrichment timed out."
        for item in payload["trend"]["unavailable_series"]
    )
