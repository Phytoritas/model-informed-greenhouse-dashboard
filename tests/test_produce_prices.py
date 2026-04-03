from model_informed_greenhouse_dashboard.backend.app.services import produce_prices


def _make_row(
    *,
    product_cls_code: str = "01",
    category_code: str = "200",
    category_name: str = "채소류",
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
        "product_cls_name": "소매" if product_cls_code == "01" else "도매",
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
            product_name="토마토/토마토",
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
            product_name="오이/다다기계통",
            productno="313",
            unit="10개",
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
            unit="10개",
            dpr1="12,999",
            dpr2="13,043",
            dpr3="14,777",
            dpr4="16,271",
            direction="0",
            value="0.3",
        ),
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
    ]

    items = produce_prices._build_featured_produce_items(rows)

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


def test_featured_produce_selection_falls_back_to_other_vegetables() -> None:
    rows = [
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
            product_name="배추/월동",
            productno="295",
            unit="1포기",
            dpr1="4,573",
            dpr2="4,578",
            dpr3="5,153",
            dpr4="5,643",
            direction="0",
            value="0.1",
        ),
        _make_row(
            product_name="양배추/양배추",
            productno="297",
            unit="1포기",
            dpr1="3,054",
            dpr2="3,083",
            dpr3="4,100",
            dpr4="5,269",
            direction="0",
            value="0.9",
        ),
        _make_row(
            product_name="브로콜리/브로콜리(국산)",
            productno="301",
            unit="1개",
            dpr1="2,460",
            dpr2="2,447",
            dpr3="2,520",
            dpr4="3,180",
            direction="1",
            value="0.5",
        ),
    ]

    items = produce_prices._build_featured_produce_items(rows)

    assert len(items) == 4
    assert items[0]["display_name"] == "Tomato"
    assert items[1]["display_name"] == "배추/월동"
    assert items[2]["display_name"] == "양배추/양배추"
    assert items[3]["display_name"] == "브로콜리/브로콜리(국산)"
