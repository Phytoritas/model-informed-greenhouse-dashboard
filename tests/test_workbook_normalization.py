from model_informed_greenhouse_dashboard.backend.app.services.workbook_normalization import (
    build_workbook_previews,
    clear_workbook_preview_cache,
)


def setup_function() -> None:
    clear_workbook_preview_cache()


def test_pesticide_workbook_preview_is_crop_scoped() -> None:
    preview = build_workbook_previews("tomato")["pesticide"]

    assert preview["status"] == "ready"
    assert preview["crop_view"]["crop"] == "tomato"
    assert preview["summary"]["product_row_count"] >= preview["crop_view"]["product_count"] >= 1
    assert preview["crop_view"]["rotation_count"] >= 1
    assert preview["crop_view"]["moa_groups"]
    assert preview["crop_view"]["sample_products"]
    assert all(
        row["source_sheet"] == "성분별_통합"
        for row in preview["crop_view"]["sample_products"]
    )
    assert preview["crop_view"]["registration_status_counts"]["unknown"] >= 1
    assert preview["crop_view"]["registration_status_counts"]["label-check-required"] >= 1


def test_nutrient_workbook_preview_includes_recipe_guardrails() -> None:
    preview = build_workbook_previews("cucumber")["nutrient"]

    assert preview["status"] == "ready"
    assert preview["crop_view"]["crop"] == "cucumber"
    assert preview["crop_view"]["recipe_count"] >= 1
    assert "Start" in preview["crop_view"]["stages"]
    assert preview["crop_view"]["guardrail_ranges"]["cl_max"]["min"] > 0
    assert "Cl" in preview["crop_view"]["source_water_analytes"]
    assert preview["crop_view"]["fertilizer_names"]
