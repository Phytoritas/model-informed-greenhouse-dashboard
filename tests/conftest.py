from __future__ import annotations

from pathlib import Path
from typing import Any

import pytest

from model_informed_greenhouse_dashboard.backend.app.services import (
    knowledge_catalog,
    knowledge_database,
    workbook_normalization,
)


def _write_telemetry_csv(path: Path, crop_label: str) -> None:
    path.write_text(
        "\n".join(
            [
                "datetime,T_air_C,PAR_umol,CO2_ppm,RH_percent,wind_speed_ms",
                f"2026-04-01 06:00,{22.5 if crop_label == 'tomato' else 23.0},480,620,72,0.4",
                f"2026-04-01 12:00,{27.1 if crop_label == 'tomato' else 26.4},910,780,64,0.8",
            ]
        ),
        encoding="utf-8",
    )


def _sheet_rows(headers: list[str], rows: list[list[Any]]) -> tuple[dict[str, Any], ...]:
    payload: list[dict[str, Any]] = [{"row_index": 1, "values": tuple(str(value) for value in headers)}]
    for index, row in enumerate(rows, start=2):
        payload.append(
            {
                "row_index": index,
                "values": tuple("" if value is None else str(value) for value in row),
            }
        )
    return tuple(payload)


def _pesticide_workbook_rows() -> dict[str, tuple[dict[str, Any], ...]]:
    return {
        "성분별_통합": _sheet_rows(
            [
                "분류",
                "대상 작물",
                "대표 적용 병해충/병명",
                "주요 성분명",
                "국내 시판 제품명",
                "작용 기작",
                "권장 희석 배수",
                "혼용 시 주의사항",
                "추천 운용 순서",
                "방제 추천 사이클",
                "데이터 상태",
                "신규등록 여부",
            ],
            [
                ["살균", "토마토", "powdery mildew", "Azoxystrobin", "AzoxyGuard", "FRAC 11", "1000", "avoid alkaline", "slot-1", "7d", "기존등록", ""],
                ["살충", "토마토", "whitefly", "Spiromesifen", "WhiteflyStop", "IRAC 23", "1500", "none", "slot-2", "5d", "", ""],
                ["살균", "오이", "powdery mildew", "Boscalid", "CukeShield", "FRAC 7", "1200", "avoid copper", "slot-1", "7d", "기존등록", ""],
            ],
        ),
        "흰가루병_교호추천": _sheet_rows(
            ["분류", "추천 제품", "원본 행", "주요 성분", "적용 포인트", "FRAC", "신규등록", "비고", "추천 이유"],
            [
                ["살균", "AzoxyGuard", "2", "Azoxystrobin", "powdery mildew preventive spray", "FRAC 11", "", "", "alternate with FRAC 7"],
                ["살균", "LabelCheckOne", "3", "Boscalid", "powdery mildew curative step", "FRAC 7", "라벨 확인", "", "manual label check required"],
            ],
        ),
        "토마토_전용_교호추천": _sheet_rows(
            ["분류", "추천 제품", "원본 행", "주요 성분", "적용 포인트", "FRAC", "신규등록", "비고", "추천 이유"],
            [
                ["살균", "TomatoShield", "4", "Fluopyram", "tomato powdery mildew rotation", "FRAC 7", "", "", "tomato-specific rotation"],
            ],
        ),
        "토마토_가루이_교호추천": _sheet_rows(
            ["분류", "추천 제품", "원본 행", "주요 성분", "적용 포인트", "FRAC", "신규등록", "비고", "추천 이유"],
            [
                ["살충", "WhiteflyStop", "5", "Spiromesifen", "whitefly pressure relief", "IRAC 23", "", "", "break whitefly cycle"],
            ],
        ),
        "토마토_온실가루이_전용": _sheet_rows(
            ["분류", "추천 제품", "원본 행", "주요 성분", "적용 포인트", "FRAC", "신규등록", "비고", "추천 이유"],
            [
                ["살충", "GlasshouseClear", "6", "Flonicamid", "greenhouse whitefly rotation", "IRAC 29", "", "", "greenhouse-specific sequence"],
            ],
        ),
        "흰가루병_작용기작_전체": _sheet_rows(
            ["코드군", "대표 성분", "원본 행", "기작 설명", "대표 제품", "신규 포함 제품", "대표 작물", "비고"],
            [
                ["FRAC 11", "Azoxystrobin", "2", "QoI", "AzoxyGuard", "", "토마토", ""],
                ["FRAC 7", "Boscalid", "3", "SDHI", "CukeShield", "LabelCheckOne", "공통", ""],
            ],
        ),
    }


def _nutrient_workbook_rows() -> dict[str, tuple[dict[str, Any], ...]]:
    return {
        "추천레시피_DB": _sheet_rows(
            [
                "Crop",
                "Medium",
                "Stage",
                "EC(",
                "N-NO3",
                "N-NH4",
                "P",
                "K",
                "Ca",
                "Mg",
                "S",
                "Fe",
                "Mn",
                "Zn",
                "B",
                "Cu",
                "Mo",
                "Cl_max",
                "HCO3_max",
                "Na_max",
                "Key",
                "Source",
            ],
            [
                ["Tomato", "Coconut coir", "Start", 2.6, 12.5, 1.0, 1.8, 7.2, 5.4, 2.1, 2.0, 0.04, 0.01, 0.01, 0.02, 0.001, 0.001, 4.0, 3.5, 2.0, "T-START", "synthetic"],
                ["Tomato", "Coconut coir", "Fruit set", 3.0, 14.0, 1.2, 2.0, 8.1, 5.8, 2.4, 2.3, 0.05, 0.01, 0.01, 0.02, 0.001, 0.001, 4.5, 3.8, 2.2, "T-FRUIT", "synthetic"],
                ["Cucumber", "Rockwool", "Start", 2.4, 11.2, 0.8, 1.6, 6.4, 4.9, 1.9, 1.8, 0.04, 0.01, 0.01, 0.02, 0.001, 0.001, 3.8, 3.2, 1.9, "C-START", "synthetic"],
            ],
        ),
        "원수 분석": _sheet_rows(
            ["구분", "항목", "입력값 or 산출값", "입력값 (mg/L)", "ppm", "원수 EC", "전도도계수", "비고"],
            [
                ["원수", "Cl", 1.2, 42.6, 42.6, 0.2, 1.0, ""],
                ["원수", "Ca", 2.8, 112.0, 112.0, 0.3, 1.0, ""],
            ],
        ),
        "배액 분석": _sheet_rows(
            ["구분", "항목", "입력값 or 산출값", "입력값 (mg/L)", "ppm", "원수 EC", "전도도계수", "비고"],
            [
                ["배액", "Cl", 1.6, 56.8, 56.8, 0.3, 1.0, ""],
            ],
        ),
        "비료_DB": _sheet_rows(
            ["비료명", "화학식", "분자량", "권장 탱크", "N-NO3", "N-NH4", "P", "K", "Ca", "Mg", "S", "Cl", "Mn", "Zn", "B", "Cu", "Mo", "Fe"],
            [
                ["Calcium Nitrate", "Ca(NO3)2", 164.1, "A", 2.0, 0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0],
                ["Potassium Nitrate", "KNO3", 101.1, "B", 1.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0],
            ],
        ),
        "처방전 계산": (
            {"row_index": 1, "values": ("작물", "Tomato")},
            {"row_index": 2, "values": ("배지", "Coconut coir")},
            {"row_index": 3, "values": ("생육시기", "Start")},
            {"row_index": 4, "values": ("작업 용액 부피", "1000")},
            {"row_index": 5, "values": ("Stock 배율", "100")},
            {"row_index": 6, "values": ("Cl 상한", "4.0")},
        ),
        "배액 기반 처방전": (
            {"row_index": 1, "values": ("작물", "Cucumber")},
            {"row_index": 2, "values": ("배지", "Rockwool")},
            {"row_index": 3, "values": ("생육시기", "Start")},
            {"row_index": 4, "values": ("작업 용액 부피", "800")},
            {"row_index": 5, "values": ("Stock 배율", "120")},
            {"row_index": 6, "values": ("Cl 상한", "3.8")},
        ),
    }


def _synthetic_workbook_rows(path_str: str) -> dict[str, tuple[dict[str, Any], ...]]:
    workbook_name = Path(path_str).name
    if workbook_name == workbook_normalization.PESTICIDE_WORKBOOK:
        return _pesticide_workbook_rows()
    if workbook_name == workbook_normalization.NUTRIENT_WORKBOOK:
        return _nutrient_workbook_rows()
    return {}


_synthetic_workbook_rows.cache_clear = lambda: None  # type: ignore[attr-defined]


def _fake_inspect_asset(path: Path, source_type: str) -> dict[str, Any]:
    if source_type == "csv":
        return {
            "parser_backend": "stdlib-csv",
            "encoding": "utf-8",
            "row_count": 2,
            "column_count": 6,
            "header": ["datetime", "T_air_C", "PAR_umol", "CO2_ppm", "RH_percent", "wind_speed_ms"],
            "sample_rows": [["2026-04-01 06:00", "22.5", "480", "620", "72", "0.4"]],
        }
    if source_type == "xlsx":
        return {
            "parser_backend": "zipfile-openxml",
            "sheet_count": 6,
            "sheet_names": list(_synthetic_workbook_rows(path.name).keys()),
        }
    if source_type == "pdf":
        return {
            "parser_backend": "pypdf-available",
            "page_count": 1,
            "inspection_status": "page-count-ready",
        }
    return {"parser_backend": "unknown"}


class _FakePdfPage:
    def __init__(self, text: str) -> None:
        self._text = text

    def extract_text(self) -> str:
        return self._text


class _FakePdfReader:
    def __init__(self, text: str) -> None:
        self.pages = [_FakePdfPage(text)]


def _fake_open_pdf_reader(path: Path) -> _FakePdfReader:
    crop_label = "cucumber" if "오이" in path.name else "tomato"
    return _FakePdfReader(
        f"{crop_label} greenhouse manual covers humidity control, VPD control, leaf symptom diagnosis, pruning checklist, and harvest timing."
    )


@pytest.fixture
def synthetic_knowledge_assets(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> dict[str, Path]:
    data_dir = tmp_path / "data"
    data_dir.mkdir(parents=True, exist_ok=True)

    _write_telemetry_csv(data_dir / "Tomato_Env.CSV", "tomato")
    _write_telemetry_csv(data_dir / "Cucumber_Env.CSV", "cucumber")
    for filename in (
        "농업기술길잡이-토마토.PDF",
        "농업기술길잡이-오이.PDF",
        workbook_normalization.PESTICIDE_WORKBOOK,
        workbook_normalization.NUTRIENT_WORKBOOK,
    ):
        (data_dir / filename).touch()

    directive_path = tmp_path / "codex_rag_advisor_prompt_smartgrow.md"
    directive_path.write_text("Synthetic SmartGrow directive", encoding="utf-8")
    artifacts_dir = tmp_path / "artifacts" / "knowledge"
    artifacts_dir.mkdir(parents=True, exist_ok=True)

    synthetic_specs = [
        {
            "filename": "Tomato_Env.CSV",
            "title": "Tomato environment telemetry fixture",
            "crop_scopes": ["tomato"],
            "asset_family": "telemetry",
            "source_type": "csv",
            "topic_hints": ["environment", "telemetry", "history"],
        },
        {
            "filename": "Cucumber_Env.CSV",
            "title": "Cucumber environment telemetry fixture",
            "crop_scopes": ["cucumber"],
            "asset_family": "telemetry",
            "source_type": "csv",
            "topic_hints": ["environment", "telemetry", "history"],
        },
        {
            "filename": "농업기술길잡이-토마토.PDF",
            "title": "Tomato technology guide",
            "crop_scopes": ["tomato"],
            "asset_family": "manual",
            "source_type": "pdf",
            "topic_hints": ["environment", "management", "diagnosis", "harvest"],
            "stage_hints": ["vegetative", "fruit_set", "harvest"],
        },
        {
            "filename": "농업기술길잡이-오이.PDF",
            "title": "Cucumber technology guide",
            "crop_scopes": ["cucumber"],
            "asset_family": "manual",
            "source_type": "pdf",
            "topic_hints": ["environment", "management", "diagnosis", "harvest"],
            "stage_hints": ["vegetative", "fruit_set", "harvest"],
        },
        {
            "filename": workbook_normalization.PESTICIDE_WORKBOOK,
            "title": "Pesticide solution workbook",
            "crop_scopes": ["tomato", "cucumber"],
            "asset_family": "pesticide_workbook",
            "source_type": "xlsx",
            "topic_hints": ["disease_pest", "rotation", "registration", "mixing"],
            "sheet_hints": list(_pesticide_workbook_rows().keys()),
            "normalization_targets": [
                "pesticide_active_ingredients",
                "pesticide_products",
                "pesticide_targets",
                "pesticide_modes_of_action",
                "pesticide_rotation_programs",
            ],
        },
        {
            "filename": workbook_normalization.NUTRIENT_WORKBOOK,
            "title": "Nutrient recipe workbook",
            "crop_scopes": ["tomato", "cucumber"],
            "asset_family": "nutrient_workbook",
            "source_type": "xlsx",
            "topic_hints": ["nutrient_recipe", "drain_feedback", "fertilizer", "guardrails"],
            "sheet_hints": list(_nutrient_workbook_rows().keys()),
            "normalization_targets": [
                "nutrient_recipes",
                "source_water_profiles",
                "drain_water_profiles",
                "fertilizer_catalog",
                "nutrient_adjustment_rules",
            ],
        },
    ]

    monkeypatch.setattr(workbook_normalization, "DATA_ROOT", data_dir)
    monkeypatch.setattr(workbook_normalization, "_read_workbook_rows", _synthetic_workbook_rows)

    monkeypatch.setattr(knowledge_catalog, "DATA_ROOT", data_dir)
    monkeypatch.setattr(knowledge_catalog, "REPO_ROOT", tmp_path)
    monkeypatch.setattr(knowledge_catalog, "DIRECTIVE_FILE", directive_path)
    monkeypatch.setattr(knowledge_catalog, "CATALOG_OUTPUT_DIR", artifacts_dir)
    monkeypatch.setattr(knowledge_catalog, "ASSET_SPECS", synthetic_specs)
    monkeypatch.setattr(knowledge_catalog, "_inspect_asset", _fake_inspect_asset)

    monkeypatch.setattr(knowledge_database, "DATA_ROOT", data_dir)
    monkeypatch.setattr(knowledge_database, "REPO_ROOT", tmp_path)
    monkeypatch.setattr(knowledge_database, "KNOWLEDGE_DB_DIR", artifacts_dir)
    monkeypatch.setattr(knowledge_database, "_open_pdf_reader", _fake_open_pdf_reader)

    workbook_normalization.clear_workbook_preview_cache()
    knowledge_catalog._build_knowledge_catalog_cached.cache_clear()

    yield {
        "repo_root": tmp_path,
        "data_dir": data_dir,
        "artifacts_dir": artifacts_dir,
    }

    workbook_normalization.clear_workbook_preview_cache()
    knowledge_catalog._build_knowledge_catalog_cached.cache_clear()
