import os
from zipfile import ZipFile
import xml.etree.ElementTree as ET

from model_informed_greenhouse_dashboard.backend.app.services import workbook_normalization
from model_informed_greenhouse_dashboard.backend.app.services.workbook_normalization import (
    build_workbook_previews,
    clear_workbook_preview_cache,
)


def setup_function() -> None:
    clear_workbook_preview_cache()


def test_pesticide_workbook_preview_is_crop_scoped(synthetic_knowledge_assets) -> None:
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


def test_nutrient_workbook_preview_includes_recipe_guardrails(synthetic_knowledge_assets) -> None:
    preview = build_workbook_previews("cucumber")["nutrient"]

    assert preview["status"] == "ready"
    assert preview["crop_view"]["crop"] == "cucumber"
    assert preview["crop_view"]["recipe_count"] >= 1
    assert "Start" in preview["crop_view"]["stages"]
    assert preview["crop_view"]["guardrail_ranges"]["cl_max"]["min"] > 0
    assert "Cl" in preview["crop_view"]["source_water_analytes"]
    assert preview["crop_view"]["fertilizer_names"]


def test_recipe_headers_units_and_replaced_workbook_cache(tmp_path, monkeypatch) -> None:
    workbook = tmp_path / workbook_normalization.NUTRIENT_WORKBOOK
    monkeypatch.setattr(workbook_normalization, "DATA_ROOT", tmp_path)
    headers = (
        "Crop", "Medium", "Stage", "EC(mS/cm)", "N-NO3", "N-NH4", "P", "K", "Ca", "Mg", "S",
        "Fe(µmol/L)", "Mn(µmol/L)", "Zn(µmol/L)", "B(µmol/L)", "Cu(µmol/L)", "Mo(µmol/L)",
        "Cl_max", "HCO3_max", "Na_max", "Key", "Source",
    )

    def write_workbook(mo: str):
        rows = (
            {
                "row_index": 1,
                "values": ("작물/생육시기별 추천 목표(단위: mmol/L, 미량원소: µmol/L)",),
            },
            {"row_index": 2, "values": headers},
            {
                "row_index": 7,
                "values": (
                    "오이", "무기배지(암면 등)", "Start", "2", "12", "1", "1.25", "6", "4", "2",
                    "1.375", "15", "10", "5", "20", "0.75", mo, "2", "0.5", "2",
                    "cucumber-rockwool-start", "source",
                ),
            },
        )
        namespace = "http://schemas.openxmlformats.org/spreadsheetml/2006/main"
        sheet = ET.Element("worksheet", {"xmlns": namespace})
        sheet_data = ET.SubElement(sheet, "sheetData")
        for source_row in rows:
            row = ET.SubElement(sheet_data, "row", {"r": str(source_row["row_index"])})
            for index, value in enumerate(source_row["values"]):
                cell = ET.SubElement(
                    row,
                    "c",
                    {"r": f"{chr(65 + index)}{source_row['row_index']}", "t": "inlineStr"},
                )
                ET.SubElement(ET.SubElement(cell, "is"), "t").text = value
        with ZipFile(workbook, "w") as archive:
            archive.writestr(
                "xl/workbook.xml",
                f'<workbook xmlns="{namespace}" '
                'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'
                '<sheets><sheet name="추천레시피_DB" sheetId="1" r:id="rId1"/></sheets></workbook>',
            )
            archive.writestr(
                "xl/_rels/workbook.xml.rels",
                '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
                '<Relationship Id="rId1" Target="worksheets/sheet1.xml"/></Relationships>',
            )
            archive.writestr("xl/worksheets/sheet1.xml", ET.tostring(sheet, encoding="utf-8"))
        return rows

    source_rows = write_workbook("0.5")
    original_stat = workbook.stat()
    recipe = workbook_normalization.export_nutrient_reference_rows("cucumber")["recipes"][0]

    # Substring lookup previously read Crop for P, Stage for S, and Fe's unit for Mo.
    assert (recipe["p"], recipe["s"], recipe["mo"]) == (1.25, 1.375, 0.5)
    assert recipe["ec_target"] == 2.0
    assert recipe["source_row"] == 7
    assert recipe["nutrient_units"] == {
        "ec_target": "mS/cm",
        **dict.fromkeys(
            ("n_no3", "n_nh4", "p", "k", "ca", "mg", "s", "cl_max", "hco3_max", "na_max"),
            "mmol/L",
        ),
        **dict.fromkeys(("fe", "mn", "zn", "b", "cu", "mo"), "µmol/L"),
    }

    unlabelled_headers = tuple(
        "EC(" if index == 3 else header.split("(")[0]
        for index, header in enumerate(headers)
    )
    unlabelled_recipe = workbook_normalization._parse_recipe_rows(
        ({"row_index": 2, "values": unlabelled_headers}, source_rows[-1])
    )[0]
    assert unlabelled_recipe["ec_target"] == 2.0
    assert unlabelled_recipe["nutrient_units"] == {}

    explicit_headers = tuple("P(mg/L)" if header == "P" else header for header in headers)
    explicit_recipe = workbook_normalization._parse_recipe_rows(
        (source_rows[0], {"row_index": 2, "values": explicit_headers}, source_rows[-1])
    )[0]
    assert explicit_recipe["p"] == 1.25
    assert explicit_recipe["nutrient_units"]["p"] == "mg/L"

    write_workbook("0.7")
    assert workbook.stat().st_size == original_stat.st_size
    changed_mtime = original_stat.st_mtime_ns + 1_000_000_000
    os.utime(workbook, ns=(original_stat.st_atime_ns, changed_mtime))
    assert workbook_normalization.export_nutrient_reference_rows("cucumber")["recipes"][0]["mo"] == 0.7

    write_workbook("0.75")
    assert workbook.stat().st_size != original_stat.st_size
    os.utime(workbook, ns=(original_stat.st_atime_ns, changed_mtime))
    assert workbook_normalization.export_nutrient_reference_rows("cucumber")["recipes"][0]["mo"] == 0.75
