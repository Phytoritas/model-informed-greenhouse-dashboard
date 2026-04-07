"""Structured, summary-safe normalization previews for SmartGrow workbooks."""

from __future__ import annotations

import re
from collections import Counter
from functools import lru_cache
from pathlib import Path
from typing import Any
from zipfile import ZipFile
import xml.etree.ElementTree as ET

from ..config import settings


DATA_ROOT = Path(settings.data_dir)
PESTICIDE_WORKBOOK = "농약 솔루션_260326_v1.xlsx"
NUTRIENT_WORKBOOK = "양액처방_계산시트_V2.0.xlsx"

_SHEET_NS = {"main": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}
_OFFICE_REL_NS = "{http://schemas.openxmlformats.org/officeDocument/2006/relationships}"
_PACKAGE_REL = "{http://schemas.openxmlformats.org/package/2006/relationships}Relationship"
_DEFAULT_CROP = "all"

_PESTICIDE_MASTER_TOKENS = ("분류", "대상 작물", "주요 성분명")
_PESTICIDE_ROTATION_TOKENS = ("분류", "추천 제품", "원본 행")
_PESTICIDE_MOA_TOKENS = ("코드군", "대표 성분", "원본 행")
_NUTRIENT_RECIPE_TOKENS = ("Crop", "Medium", "Stage")
_WATER_ANALYSIS_TOKENS = ("구분", "항목", "입력값")
_FERTILIZER_TOKENS = ("비료명", "화학식", "권장 탱크")
_KOREAN_MOA_PREFIXES = "가나다라마바사아자차카타파하"


def clear_workbook_preview_cache() -> None:
    """Clear workbook parsing and preview caches."""
    _read_workbook_rows.cache_clear()
    _build_pesticide_preview.cache_clear()
    _build_nutrient_preview.cache_clear()


def build_workbook_previews(crop: str | None = None) -> dict[str, dict[str, Any]]:
    """Return crop-scoped workbook normalization previews."""
    crop_scope = crop or _DEFAULT_CROP
    return {
        "pesticide": _build_pesticide_preview(crop_scope),
        "nutrient": _build_nutrient_preview(crop_scope),
    }


def _normalize_text(value: Any) -> str:
    return re.sub(r"\s+", " ", str(value or "")).strip()


def _safe_float(value: Any) -> float | None:
    text = _normalize_text(value).replace(",", "")
    if not text:
        return None
    try:
        return float(text)
    except ValueError:
        return None


def _sample_strings(values: list[str], limit: int = 8) -> list[str]:
    seen: list[str] = []
    for value in values:
        clean = _normalize_text(value)
        if clean and clean not in seen:
            seen.append(clean)
        if len(seen) >= limit:
            break
    return seen


def _sample_dicts(rows: list[dict[str, Any]], limit: int = 5) -> list[dict[str, Any]]:
    return rows[:limit]


def _numeric_range(values: list[float | None]) -> dict[str, float] | None:
    cleaned = [value for value in values if value is not None]
    if not cleaned:
        return None
    return {"min": min(cleaned), "max": max(cleaned)}


def _normalize_lookup_key(value: str) -> str:
    return re.sub(r"[^0-9a-z가-힣]+", "", _normalize_text(value).lower())


def _match_score(query: str, candidate: str) -> int:
    query_key = _normalize_lookup_key(query)
    candidate_key = _normalize_lookup_key(candidate)
    if not query_key or not candidate_key:
        return 0
    if query_key == candidate_key:
        return 100
    if query_key in candidate_key or candidate_key in query_key:
        return 80

    candidate_norm = _normalize_text(candidate).lower()
    term_hits = sum(
        1
        for term in _normalize_text(query).lower().split()
        if term and term in candidate_norm
    )
    if term_hits:
        return 50 + (term_hits * 10)
    return 0


def _split_multi_value(text: str) -> list[str]:
    return [
        part
        for part in (
            _normalize_text(chunk)
            for chunk in re.split(r"[,\n/·;]|(?:\s+\+\s+)", text)
        )
        if part
    ]


def _col_letters_to_index(col_letters: str) -> int:
    value = 0
    for char in col_letters:
        if char.isalpha():
            value = value * 26 + (ord(char.upper()) - 64)
    return value - 1


def _cell_value(cell: ET.Element, shared_strings: list[str]) -> str:
    cell_type = cell.attrib.get("t")
    inline = cell.find("main:is/main:t", _SHEET_NS)
    if inline is not None:
        return _normalize_text(inline.text)

    value_elem = cell.find("main:v", _SHEET_NS)
    if value_elem is None:
        return ""

    raw = value_elem.text or ""
    if cell_type == "s":
        try:
            return _normalize_text(shared_strings[int(raw)])
        except (ValueError, IndexError):
            return _normalize_text(raw)

    return _normalize_text(raw)


def _load_shared_strings(archive: ZipFile) -> list[str]:
    if "xl/sharedStrings.xml" not in archive.namelist():
        return []

    root = ET.fromstring(archive.read("xl/sharedStrings.xml"))
    values: list[str] = []
    for shared in root.findall("main:si", _SHEET_NS):
        values.append(
            _normalize_text("".join(node.text or "" for node in shared.findall(".//main:t", _SHEET_NS)))
        )
    return values


def _load_sheet_targets(archive: ZipFile) -> list[tuple[str, str]]:
    workbook_root = ET.fromstring(archive.read("xl/workbook.xml"))
    rel_root = ET.fromstring(archive.read("xl/_rels/workbook.xml.rels"))
    rel_map = {
        rel.attrib["Id"]: rel.attrib["Target"]
        for rel in rel_root.findall(_PACKAGE_REL)
    }

    sheet_targets: list[tuple[str, str]] = []
    for sheet in workbook_root.findall("main:sheets/main:sheet", _SHEET_NS):
        rel_id = sheet.attrib[f"{_OFFICE_REL_NS}id"]
        target = rel_map[rel_id].replace("../", "")
        if not target.startswith("xl/"):
            target = f"xl/{target}"
        sheet_targets.append((sheet.attrib["name"], target))
    return sheet_targets


@lru_cache(maxsize=4)
def _read_workbook_rows(path_str: str) -> dict[str, tuple[dict[str, Any], ...]]:
    path = Path(path_str)
    if not path.exists():
        return {}

    with ZipFile(path) as archive:
        shared_strings = _load_shared_strings(archive)
        sheet_rows: dict[str, tuple[dict[str, Any], ...]] = {}
        for sheet_name, target in _load_sheet_targets(archive):
            root = ET.fromstring(archive.read(target))
            rows: list[dict[str, Any]] = []
            for row in root.findall("main:sheetData/main:row", _SHEET_NS):
                values_by_index: dict[int, str] = {}
                for cell in row.findall("main:c", _SHEET_NS):
                    ref = cell.attrib.get("r", "")
                    letters = "".join(char for char in ref if char.isalpha())
                    if not letters:
                        continue
                    values_by_index[_col_letters_to_index(letters)] = _cell_value(cell, shared_strings)

                if not values_by_index:
                    continue

                max_idx = max(values_by_index)
                rows.append(
                    {
                        "row_index": int(row.attrib.get("r", "0")),
                        "values": tuple(values_by_index.get(idx, "") for idx in range(max_idx + 1)),
                    }
                )
            sheet_rows[sheet_name] = tuple(rows)

    return sheet_rows


def _sheet_manifest(rows_by_sheet: dict[str, tuple[dict[str, Any], ...]]) -> list[dict[str, Any]]:
    manifest: list[dict[str, Any]] = []
    for sheet_name, rows in rows_by_sheet.items():
        row_numbers = [row["row_index"] for row in rows]
        manifest.append(
            {
                "sheet_name": sheet_name,
                "row_count": len(rows),
                "row_range": {
                    "start": min(row_numbers) if row_numbers else None,
                    "end": max(row_numbers) if row_numbers else None,
                },
            }
        )
    return manifest


def _row_has_tokens(values: tuple[str, ...], tokens: tuple[str, ...]) -> bool:
    normalized_values = [_normalize_text(value).lower() for value in values if value]
    return all(
        any(_normalize_text(token).lower() in value for value in normalized_values)
        for token in tokens
    )


def _sheet_records(
    sheet_rows: tuple[dict[str, Any], ...],
    header_tokens: tuple[str, ...],
) -> list[dict[str, Any]]:
    header_row: dict[str, Any] | None = None
    for row in sheet_rows:
        if _row_has_tokens(row["values"], header_tokens):
            header_row = row
            break

    if header_row is None:
        return []

    headers = [_normalize_text(value) for value in header_row["values"]]
    records: list[dict[str, Any]] = []
    for row in sheet_rows:
        if row["row_index"] <= header_row["row_index"]:
            continue

        values = list(row["values"])
        if not any(_normalize_text(value) for value in values):
            continue

        record: dict[str, Any] = {
            "__source_row": row["row_index"],
            "__source_header_row": header_row["row_index"],
        }
        for idx, header in enumerate(headers):
            if not header:
                continue
            record[header] = _normalize_text(values[idx] if idx < len(values) else "")
        records.append(record)

    return records


def _lookup(record: dict[str, Any], *patterns: str) -> str:
    normalized_patterns = [_normalize_text(pattern).lower() for pattern in patterns]
    for key, value in record.items():
        if key.startswith("__"):
            continue
        key_norm = _normalize_text(key).lower()
        if any(pattern in key_norm for pattern in normalized_patterns):
            return _normalize_text(value)
    return ""


def _normalize_category(value: str) -> str:
    text = _normalize_text(value)
    if "살균" in text or "fung" in text.lower():
        return "fungicide"
    if "살충" in text or "insect" in text.lower():
        return "insecticide"
    return text.lower().replace(" ", "-") or "unknown"


def _normalize_crop_scope(value: str, fallback: str | None = None) -> str:
    text = _normalize_text(value)
    text_lower = text.lower()
    has_tomato = "토마토" in text or "tomato" in text_lower
    has_cucumber = "오이" in text or "cucumber" in text_lower

    if "공통" in text or "common" in text_lower or (has_tomato and has_cucumber):
        return "common"
    if has_tomato:
        return "tomato"
    if has_cucumber:
        return "cucumber"
    return fallback or "unknown"


def _normalize_code_token(token: str) -> str:
    clean = _normalize_text(token).upper()
    if not clean:
        return ""
    if clean.isdigit() and len(clean) >= 4:
        return ""
    if clean in {"미분류", "복합기작"}:
        return clean
    if re.fullmatch(r"\d+[A-Z]?(?!차)", clean):
        return clean
    if re.fullmatch(rf"[{_KOREAN_MOA_PREFIXES}]\d*[A-Z]?", clean):
        return clean
    return ""


def _extract_code_tokens(value: str) -> list[str]:
    tokens: list[str] = []
    for match in re.finditer(
        rf"(미분류|복합기작|[{_KOREAN_MOA_PREFIXES}]\d*[A-Za-z]?|\d+[A-Za-z]?(?!차))",
        _normalize_text(value),
        flags=re.IGNORECASE,
    ):
        normalized = _normalize_code_token(match.group(0))
        if normalized and normalized not in tokens:
            tokens.append(normalized)
    return tokens


def _parse_code_group(value: str) -> str:
    text = _normalize_text(value)
    if not text:
        return ""
    primary = _normalize_text(text.split("|", 1)[0])
    prefix_match = re.search(r"\b(FRAC|IRAC)\b", primary, flags=re.IGNORECASE)
    prefix = prefix_match.group(1).upper() if prefix_match else ""

    candidate_segments: list[str] = []
    if prefix_match:
        candidate_segments.append(primary[prefix_match.end() :])

    colon_tokens = re.findall(
        rf"(미분류|복합기작|[{_KOREAN_MOA_PREFIXES}]\d*[A-Za-z]?|\d+[A-Za-z]?)\s*:",
        primary,
        flags=re.IGNORECASE,
    )
    if colon_tokens:
        normalized_tokens = [
            _normalize_code_token(token)
            for token in colon_tokens
            if _normalize_code_token(token)
        ]
        if normalized_tokens:
            joined = "+".join(dict.fromkeys(normalized_tokens))
            return f"{prefix} {joined}" if prefix else joined

    candidate_segments.extend(re.findall(r"\(([^()]*)\)", primary))
    candidate_segments.append(primary)

    for segment in candidate_segments:
        tokens = _extract_code_tokens(segment)
        if not tokens:
            continue
        joined = "+".join(tokens)
        return f"{prefix} {joined}" if prefix else joined

    return primary


def _parse_target_names(value: str) -> list[str]:
    targets = _split_multi_value(value)
    return [
        target
        for target in targets
        if target not in {"공통", "오이", "토마토"}
    ]


def _normalize_registration_status(new_flag: str, fallback: str) -> str:
    joined = _normalize_text(f"{new_flag} {fallback}")
    if "신규" in joined:
        return "new-registration"
    if "기존" in joined or "기존등록" in joined:
        return "existing-registration"
    if "미등재" in joined or "라벨" in joined or "확인" in joined:
        return "label-check-required"
    return "unknown"


def _infer_target_from_sheet(sheet_name: str) -> str | None:
    if "흰가루병" in sheet_name:
        return "흰가루병"
    if "온실가루이" in sheet_name:
        return "온실가루이"
    if "가루이" in sheet_name:
        return "가루이"
    return None


def _parse_pesticide_products(sheet_rows: tuple[dict[str, Any], ...]) -> list[dict[str, Any]]:
    products: list[dict[str, Any]] = []
    for record in _sheet_records(sheet_rows, _PESTICIDE_MASTER_TOKENS):
        active_ingredient = _lookup(record, "주요 성분명")
        product_names = _split_multi_value(_lookup(record, "국내 시판 제품명"))
        if not active_ingredient or not product_names:
            continue

        data_state = _lookup(record, "데이터 상태", "출처")
        new_flag = _lookup(record, "신규등록 여부")
        products.append(
            {
                "category": _normalize_category(_lookup(record, "분류")),
                "crop_scope": _normalize_crop_scope(_lookup(record, "대상 작물")),
                "target_names": _parse_target_names(_lookup(record, "대표 적용 병해충/병명")),
                "active_ingredient": active_ingredient,
                "product_names": product_names,
                "moa_code_group": _parse_code_group(_lookup(record, "작용 기작")),
                "moa_description": _lookup(record, "작용 기작"),
                "efficacy_type": _lookup(record, "약효 유형/침투성"),
                "dilution": _lookup(record, "권장 희석 배수"),
                "mixing_caution": _lookup(record, "혼용 시 주의사항"),
                "rotation_slot": _lookup(record, "추천 운용 순서"),
                "cycle_recommendation": _lookup(record, "방제 추천 사이클"),
                "registration_status": _normalize_registration_status(new_flag, data_state),
                "new_registration_flag": "신규" in new_flag,
                "source_meta": data_state,
                "registration_note": new_flag,
                "source_sheet": "성분별_통합",
                "source_row": record["__source_row"],
            }
        )

    return products


def _parse_rotation_sheet(
    sheet_name: str,
    sheet_rows: tuple[dict[str, Any], ...],
) -> list[dict[str, Any]]:
    target_from_sheet = _infer_target_from_sheet(sheet_name)
    crop_fallback = _normalize_crop_scope(sheet_name, fallback="common")
    rotation_rows: list[dict[str, Any]] = []

    for record in _sheet_records(sheet_rows, _PESTICIDE_ROTATION_TOKENS):
        product_names = _split_multi_value(_lookup(record, "추천 제품", "대표 제품"))
        active_ingredient = _lookup(record, "주요 성분")
        application_point = _lookup(record, "적용 포인트", "토마토 기준 포인트", "온실가루이 활용 포인트")
        if not product_names and not active_ingredient:
            continue

        target_names = _parse_target_names(application_point)
        rotation_rows.append(
            {
                "category": _normalize_category(_lookup(record, "분류", "구분")),
                "crop_scope": _normalize_crop_scope(f"{sheet_name} {application_point}", fallback=crop_fallback),
                "target_name": target_from_sheet or (target_names[0] if target_names else "general-program"),
                "rotation_theme": sheet_name,
                "active_ingredient": active_ingredient,
                "product_names": product_names,
                "moa_code_group": _parse_code_group(_lookup(record, "FRAC", "IRAC")),
                "application_point": application_point,
                "registration_status": _normalize_registration_status(_lookup(record, "신규등록"), _lookup(record, "비고")),
                "new_registration_flag": "신규" in _lookup(record, "신규등록"),
                "reason": _lookup(record, "추천 이유"),
                "notes": _lookup(record, "비고"),
                "original_row_ref": _lookup(record, "원본 행"),
                "source_sheet": sheet_name,
                "source_row": record["__source_row"],
            }
        )

    return rotation_rows


def _parse_moa_summary(sheet_rows: tuple[dict[str, Any], ...]) -> list[dict[str, Any]]:
    summaries: list[dict[str, Any]] = []
    for record in _sheet_records(sheet_rows, _PESTICIDE_MOA_TOKENS):
        code_group = _lookup(record, "코드군")
        representative = _lookup(record, "대표 성분")
        if not code_group or not representative:
            continue

        crop_scope = _normalize_crop_scope(_lookup(record, "대표 작물"), fallback="common")
        summaries.append(
            {
                "moa_code_group": code_group,
                "moa_description": _lookup(record, "기작 설명"),
                "representative_ingredient": representative,
                "representative_products": _split_multi_value(_lookup(record, "대표 제품")),
                "new_registration_products": _split_multi_value(_lookup(record, "신규 포함 제품")),
                "crop_scope": crop_scope,
                "notes": _lookup(record, "비고"),
                "original_row_ref": _lookup(record, "원본 행"),
                "source_sheet": "흰가루병_작용기작_전체",
                "source_row": record["__source_row"],
            }
        )

    return summaries


def _filter_pesticide_rows(rows: list[dict[str, Any]], crop_scope: str) -> list[dict[str, Any]]:
    if crop_scope == _DEFAULT_CROP:
        return rows
    return [
        row
        for row in rows
        if row.get("crop_scope") in {crop_scope, "common"}
    ]


@lru_cache(maxsize=4)
def _build_pesticide_preview(crop_scope: str) -> dict[str, Any]:
    path = DATA_ROOT / PESTICIDE_WORKBOOK
    if not path.exists():
        return {
            "family": "pesticide",
            "status": "missing",
            "workbook": PESTICIDE_WORKBOOK,
            "crop_view": {"crop": crop_scope},
        }

    rows_by_sheet = _read_workbook_rows(str(path))
    products = _parse_pesticide_products(rows_by_sheet.get("성분별_통합", ()))
    rotation_rows: list[dict[str, Any]] = []
    for sheet_name in (
        "흰가루병_교호추천",
        "토마토_전용_교호추천",
        "토마토_가루이_교호추천",
        "토마토_온실가루이_전용",
    ):
        rotation_rows.extend(_parse_rotation_sheet(sheet_name, rows_by_sheet.get(sheet_name, ())))
    moa_rows = _parse_moa_summary(rows_by_sheet.get("흰가루병_작용기작_전체", ()))

    filtered_products = _filter_pesticide_rows(products, crop_scope)
    filtered_rotations = _filter_pesticide_rows(rotation_rows, crop_scope)
    filtered_moa = _filter_pesticide_rows(moa_rows, crop_scope)

    target_names = sorted(
        {
            target
            for row in filtered_products
            for target in row["target_names"]
        }
        | {
            row["target_name"]
            for row in filtered_rotations
            if row["target_name"]
        }
    )
    moa_groups = sorted(
        {
            row["moa_code_group"]
            for row in filtered_products + filtered_rotations + filtered_moa
            if row["moa_code_group"]
        }
    )
    category_counts = Counter(row["category"] for row in filtered_products + filtered_rotations)
    registration_counts = Counter(
        row["registration_status"] for row in filtered_products + filtered_rotations
    )

    return {
        "family": "pesticide",
        "status": "ready",
        "workbook": path.name,
        "parser_backend": "zipfile-openxml",
        "sheet_manifest": _sheet_manifest(rows_by_sheet),
        "summary": {
            "product_row_count": len(products),
            "rotation_row_count": len(rotation_rows),
            "moa_summary_row_count": len(moa_rows),
            "crop_scopes": sorted({row["crop_scope"] for row in products + rotation_rows if row["crop_scope"]}),
        },
        "crop_view": {
            "crop": crop_scope,
            "product_count": len(filtered_products),
            "rotation_count": len(filtered_rotations),
            "moa_group_count": len(moa_groups),
            "category_counts": dict(category_counts),
            "registration_status_counts": dict(registration_counts),
            "target_names": _sample_strings(target_names),
            "moa_groups": _sample_strings(moa_groups),
            "sample_products": _sample_dicts(
                [
                    {
                        "product_name": row["product_names"][0],
                        "active_ingredient": row["active_ingredient"],
                        "crop_scope": row["crop_scope"],
                        "target_names": row["target_names"][:3],
                        "moa_code_group": row["moa_code_group"],
                        "registration_status": row["registration_status"],
                        "source_sheet": row["source_sheet"],
                        "source_row": row["source_row"],
                    }
                    for row in filtered_products
                ]
            ),
            "sample_rotations": _sample_dicts(
                [
                    {
                        "rotation_theme": row["rotation_theme"],
                        "target_name": row["target_name"],
                        "product_name": row["product_names"][0] if row["product_names"] else "",
                        "moa_code_group": row["moa_code_group"],
                        "application_point": row["application_point"],
                        "registration_status": row["registration_status"],
                        "source_sheet": row["source_sheet"],
                        "source_row": row["source_row"],
                    }
                    for row in filtered_rotations
                ]
            ),
        },
    }


def _normalize_stage(value: str) -> str:
    return _normalize_text(value)


def _parse_recipe_rows(sheet_rows: tuple[dict[str, Any], ...]) -> list[dict[str, Any]]:
    recipes: list[dict[str, Any]] = []
    for record in _sheet_records(sheet_rows, _NUTRIENT_RECIPE_TOKENS):
        crop = _normalize_crop_scope(_lookup(record, "Crop"), fallback="unknown")
        medium = _lookup(record, "Medium")
        stage = _normalize_stage(_lookup(record, "Stage"))
        if crop == "unknown" or not medium or not stage:
            continue

        recipes.append(
            {
                "crop": crop,
                "medium": medium,
                "stage": stage,
                "ec_target": _safe_float(_lookup(record, "EC(")),
                "n_no3": _safe_float(_lookup(record, "N-NO3")),
                "n_nh4": _safe_float(_lookup(record, "N-NH4")),
                "p": _safe_float(_lookup(record, "P")),
                "k": _safe_float(_lookup(record, "K")),
                "ca": _safe_float(_lookup(record, "Ca")),
                "mg": _safe_float(_lookup(record, "Mg")),
                "s": _safe_float(_lookup(record, "S")),
                "fe": _safe_float(_lookup(record, "Fe")),
                "mn": _safe_float(_lookup(record, "Mn")),
                "zn": _safe_float(_lookup(record, "Zn")),
                "b": _safe_float(_lookup(record, "B")),
                "cu": _safe_float(_lookup(record, "Cu")),
                "mo": _safe_float(_lookup(record, "Mo")),
                "cl_max": _safe_float(_lookup(record, "Cl_max")),
                "hco3_max": _safe_float(_lookup(record, "HCO3_max")),
                "na_max": _safe_float(_lookup(record, "Na_max")),
                "source_key": _lookup(record, "Key"),
                "source_note": _lookup(record, "Source"),
                "source_sheet": "추천레시피_DB",
                "source_row": record["__source_row"],
            }
        )
    return recipes


def _parse_water_analysis(
    sheet_name: str,
    sheet_rows: tuple[dict[str, Any], ...],
    analysis_kind: str,
) -> list[dict[str, Any]]:
    analytes: list[dict[str, Any]] = []
    for record in _sheet_records(sheet_rows, _WATER_ANALYSIS_TOKENS):
        analyte = _lookup(record, "항목")
        if not analyte:
            continue
        analytes.append(
            {
                "analysis_kind": analysis_kind,
                "analyte": analyte,
                "classification": _lookup(record, "구분"),
                "mmol_l": _safe_float(_lookup(record, "입력값 or 산출값")),
                "mg_l": _safe_float(_lookup(record, "입력값 (mg/L)")),
                "ppm_ref": _safe_float(_lookup(record, "ppm")),
                "ec_contribution": _safe_float(_lookup(record, "원수 EC")),
                "coefficient": _safe_float(_lookup(record, "전도도계수")),
                "note": _lookup(record, "비고"),
                "source_sheet": sheet_name,
                "source_row": record["__source_row"],
            }
        )
    return analytes


def _parse_fertilizer_rows(sheet_rows: tuple[dict[str, Any], ...]) -> list[dict[str, Any]]:
    fertilizers: list[dict[str, Any]] = []
    for record in _sheet_records(sheet_rows, _FERTILIZER_TOKENS):
        fertilizer_name = _lookup(record, "비료명")
        formula = _lookup(record, "화학식")
        if not fertilizer_name or not formula:
            continue

        fertilizers.append(
            {
                "fertilizer_name": fertilizer_name,
                "formula": formula,
                "molecular_weight": _safe_float(_lookup(record, "분자량")),
                "tank_assignment": _lookup(record, "권장 탱크"),
                "nutrient_contribution_per_mol": {
                    "n_no3": _safe_float(_lookup(record, "N-NO3")),
                    "n_nh4": _safe_float(_lookup(record, "N-NH4")),
                    "p": _safe_float(_lookup(record, "P")),
                    "k": _safe_float(_lookup(record, "K")),
                    "ca": _safe_float(_lookup(record, "Ca")),
                    "mg": _safe_float(_lookup(record, "Mg")),
                    "s": _safe_float(_lookup(record, "S")),
                    "cl": _safe_float(_lookup(record, "Cl")),
                    "mn": _safe_float(_lookup(record, "Mn")),
                    "zn": _safe_float(_lookup(record, "Zn")),
                    "b": _safe_float(_lookup(record, "B")),
                    "cu": _safe_float(_lookup(record, "Cu")),
                    "mo": _safe_float(_lookup(record, "Mo")),
                    "fe": _safe_float(_lookup(record, "Fe")),
                },
                "source_sheet": "비료_DB",
                "source_row": record["__source_row"],
            }
        )

    return fertilizers


def _value_after_token(values: tuple[str, ...], token: str) -> str:
    token_norm = _normalize_text(token).lower()
    normalized_values = [_normalize_text(value) for value in values]
    for idx, value in enumerate(normalized_values):
        if token_norm in value.lower():
            for candidate in normalized_values[idx + 1:]:
                if candidate:
                    return candidate
    return ""


def _parse_calculator_snapshot(
    sheet_name: str,
    sheet_rows: tuple[dict[str, Any], ...],
) -> dict[str, Any]:
    snapshot = {"sheet_name": sheet_name}
    for row in sheet_rows[:12]:
        values = row["values"]
        first = _normalize_text(values[0] if values else "")
        second = _normalize_text(values[1] if len(values) > 1 else "")

        if first == "작물" and second:
            snapshot["selected_crop"] = _normalize_crop_scope(second, fallback=second)
        elif first == "배지" and second:
            snapshot["selected_medium"] = second
        elif first == "생육시기" and second:
            snapshot["selected_stage"] = second
        elif "작업 용액 부피" in first and second:
            snapshot["working_solution_volume_l"] = _safe_float(second)
        elif "Stock 배율" in first and second:
            snapshot["stock_ratio"] = _safe_float(second)

        cl_guardrail = _value_after_token(values, "Cl 상한")
        if cl_guardrail:
            snapshot["cl_guardrail_mmol_l"] = _safe_float(cl_guardrail)

    return snapshot


def _filter_recipe_rows(rows: list[dict[str, Any]], crop_scope: str) -> list[dict[str, Any]]:
    if crop_scope == _DEFAULT_CROP:
        return rows
    return [row for row in rows if row["crop"] == crop_scope]


def _resolve_candidate(
    requested: str | None,
    candidates: list[str],
    *,
    default: str | None = None,
) -> tuple[str, str]:
    options = [candidate for candidate in candidates if _normalize_text(candidate)]
    if not options:
        raise LookupError("No deterministic candidates are available.")

    if not requested:
        if default and default in options:
            return default, "default"
        return options[0], "default"

    ranked = sorted(
        ((candidate, _match_score(requested, candidate)) for candidate in options),
        key=lambda item: (-item[1], item[0]),
    )
    best_candidate, score = ranked[0]
    if score <= 0:
        raise LookupError(f"No deterministic match found for '{requested}'.")
    if _normalize_lookup_key(requested) == _normalize_lookup_key(best_candidate):
        return best_candidate, "exact"
    return best_candidate, "fuzzy"


@lru_cache(maxsize=4)
def _build_nutrient_preview(crop_scope: str) -> dict[str, Any]:
    path = DATA_ROOT / NUTRIENT_WORKBOOK
    if not path.exists():
        return {
            "family": "nutrient",
            "status": "missing",
            "workbook": NUTRIENT_WORKBOOK,
            "crop_view": {"crop": crop_scope},
        }

    rows_by_sheet = _read_workbook_rows(str(path))
    recipes = _parse_recipe_rows(rows_by_sheet.get("추천레시피_DB", ()))
    source_water = _parse_water_analysis("원수 분석", rows_by_sheet.get("원수 분석", ()), "source_water")
    drain_water = _parse_water_analysis("배액 분석", rows_by_sheet.get("배액 분석", ()), "drain_water")
    fertilizers = _parse_fertilizer_rows(rows_by_sheet.get("비료_DB", ()))
    calculator_snapshot = _parse_calculator_snapshot("처방전 계산", rows_by_sheet.get("처방전 계산", ()))
    drain_snapshot = _parse_calculator_snapshot("배액 기반 처방전", rows_by_sheet.get("배액 기반 처방전", ()))

    filtered_recipes = _filter_recipe_rows(recipes, crop_scope)
    stage_names = sorted({row["stage"] for row in filtered_recipes})
    medium_names = sorted({row["medium"] for row in filtered_recipes})

    return {
        "family": "nutrient",
        "status": "ready",
        "workbook": path.name,
        "parser_backend": "zipfile-openxml",
        "sheet_manifest": _sheet_manifest(rows_by_sheet),
        "summary": {
            "recipe_row_count": len(recipes),
            "source_water_row_count": len(source_water),
            "drain_water_row_count": len(drain_water),
            "fertilizer_row_count": len(fertilizers),
            "available_crops": sorted({row["crop"] for row in recipes}),
        },
        "crop_view": {
            "crop": crop_scope,
            "recipe_count": len(filtered_recipes),
            "stages": stage_names[:8],
            "mediums": medium_names[:6],
            "ec_target_range": _numeric_range([row["ec_target"] for row in filtered_recipes]),
            "guardrail_ranges": {
                "cl_max": _numeric_range([row["cl_max"] for row in filtered_recipes]),
                "hco3_max": _numeric_range([row["hco3_max"] for row in filtered_recipes]),
                "na_max": _numeric_range([row["na_max"] for row in filtered_recipes]),
            },
            "source_water_analytes": _sample_strings([row["analyte"] for row in source_water]),
            "drain_water_analytes": _sample_strings([row["analyte"] for row in drain_water]),
            "fertilizer_names": _sample_strings([row["fertilizer_name"] for row in fertilizers], limit=10),
            "sample_recipes": _sample_dicts(
                [
                    {
                        "crop": row["crop"],
                        "medium": row["medium"],
                        "stage": row["stage"],
                        "ec_target": row["ec_target"],
                        "cl_max": row["cl_max"],
                        "hco3_max": row["hco3_max"],
                        "na_max": row["na_max"],
                        "source_sheet": row["source_sheet"],
                        "source_row": row["source_row"],
                    }
                    for row in filtered_recipes
                ]
            ),
            "calculator_defaults": calculator_snapshot,
            "drain_feedback_defaults": drain_snapshot,
        },
    }


def export_pesticide_reference_rows(crop: str | None = None) -> dict[str, Any]:
    crop_scope = crop or _DEFAULT_CROP
    path = DATA_ROOT / PESTICIDE_WORKBOOK
    if not path.exists():
        raise FileNotFoundError(f"Missing workbook: {path.name}")

    rows_by_sheet = _read_workbook_rows(str(path))
    products = _filter_pesticide_rows(
        _parse_pesticide_products(rows_by_sheet.get("성분별_통합", ())),
        crop_scope,
    )
    rotation_rows: list[dict[str, Any]] = []
    for sheet_name in rows_by_sheet:
        if "추천" not in sheet_name:
            continue
        rotation_rows.extend(_parse_rotation_sheet(sheet_name, rows_by_sheet.get(sheet_name, ())))

    return {
        "family": "pesticide",
        "crop": crop_scope,
        "products": products,
        "rotations": _filter_pesticide_rows(rotation_rows, crop_scope),
        "moa_reference": _filter_pesticide_rows(
            _parse_moa_summary(rows_by_sheet.get("흰가루병_작용기작_전체", ())),
            crop_scope,
        ),
    }


def export_nutrient_reference_rows(crop: str | None = None) -> dict[str, Any]:
    crop_scope = crop or _DEFAULT_CROP
    path = DATA_ROOT / NUTRIENT_WORKBOOK
    if not path.exists():
        raise FileNotFoundError(f"Missing workbook: {path.name}")

    rows_by_sheet = _read_workbook_rows(str(path))
    recipes = _filter_recipe_rows(
        _parse_recipe_rows(rows_by_sheet.get("추천레시피_DB", ())),
        crop_scope,
    )

    return {
        "family": "nutrient",
        "crop": crop_scope,
        "recipes": recipes,
        "source_water": _parse_water_analysis("원수 분석", rows_by_sheet.get("원수 분석", ()), "source_water"),
        "drain_water": _parse_water_analysis("배액 분석", rows_by_sheet.get("배액 분석", ()), "drain_water"),
        "fertilizers": _parse_fertilizer_rows(rows_by_sheet.get("비료_DB", ())),
        "calculator_defaults": _parse_calculator_snapshot("처방전 계산", rows_by_sheet.get("처방전 계산", ())),
        "drain_feedback_defaults": _parse_calculator_snapshot(
            "배액 기반 처방전",
            rows_by_sheet.get("배액 기반 처방전", ()),
        ),
    }
