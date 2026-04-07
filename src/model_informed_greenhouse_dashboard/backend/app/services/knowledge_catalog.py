"""Phase-1 SmartGrow knowledge catalog over local crop assets."""

from __future__ import annotations

import csv
import json
import logging
import warnings
from collections import Counter
from copy import deepcopy
from datetime import UTC, datetime
from functools import lru_cache
from pathlib import Path
from typing import Any, Iterable
from zipfile import ZipFile
import xml.etree.ElementTree as ET

from ..config import settings
from .knowledge_database import (
    inspect_knowledge_database,
    rebuild_knowledge_database,
)
from .workbook_normalization import (
    build_workbook_previews,
    clear_workbook_preview_cache,
)

try:  # pragma: no cover - optional dependency
    from pypdf import PdfReader
except ImportError:  # pragma: no cover - exercised when dependency is absent
    PdfReader = None


DATA_ROOT = Path(settings.data_dir)
REPO_ROOT = DATA_ROOT.parent
DIRECTIVE_FILE = REPO_ROOT / "codex_rag_advisor_prompt_smartgrow.md"
CATALOG_OUTPUT_DIR = REPO_ROOT / "artifacts" / "knowledge"
CATALOG_VERSION = "smartgrow-phase1-v1"
_PDF_WARNING_PATTERN = r"Advanced encoding .* not implemented yet"
_PDF_CMAP_LOGGER = "pypdf._cmap"

_TOPIC_MANUAL_CUCUMBER = [
    "physiology",
    "environment",
    "growth",
    "flowering",
    "fruiting",
    "diagnosis",
    "disorder",
    "management",
]

_TOPIC_MANUAL_TOMATO = [
    "physiology",
    "environment",
    "growth",
    "fruit_load",
    "harvest",
    "nutrition",
    "diagnosis",
    "management",
]

_PESTICIDE_TARGETS = [
    "pesticide_active_ingredients",
    "pesticide_products",
    "pesticide_targets",
    "pesticide_modes_of_action",
    "pesticide_rotation_programs",
    "pesticide_mixing_cautions",
    "pesticide_application_cycles",
    "pesticide_registration_meta",
]

_NUTRIENT_TARGETS = [
    "nutrient_recipes",
    "source_water_profiles",
    "drain_water_profiles",
    "fertilizer_catalog",
    "nutrient_adjustment_rules",
    "stock_tank_rules",
    "nutrient_guardrails",
]

ASSET_SPECS: list[dict[str, Any]] = [
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
        "filename": "오이_농업기술대계.pdf",
        "title": "Cucumber agronomy compendium",
        "crop_scopes": ["cucumber"],
        "asset_family": "manual",
        "source_type": "pdf",
        "topic_hints": _TOPIC_MANUAL_CUCUMBER,
        "stage_hints": [
            "nursery",
            "early",
            "vegetative",
            "flowering",
            "fruit_set",
            "harvest",
            "late_season",
        ],
    },
    {
        "filename": "농업기술길잡이-오이.PDF",
        "title": "Cucumber technology guide",
        "crop_scopes": ["cucumber"],
        "asset_family": "manual",
        "source_type": "pdf",
        "topic_hints": _TOPIC_MANUAL_CUCUMBER,
        "stage_hints": [
            "nursery",
            "vegetative",
            "flowering",
            "fruit_set",
            "harvest",
        ],
    },
    {
        "filename": "농업기술길잡이-토마토.PDF",
        "title": "Tomato technology guide",
        "crop_scopes": ["tomato"],
        "asset_family": "manual",
        "source_type": "pdf",
        "topic_hints": _TOPIC_MANUAL_TOMATO,
        "stage_hints": [
            "nursery",
            "vegetative",
            "flowering",
            "fruit_set",
            "harvest",
        ],
    },
    {
        "filename": "농업기술대계_토마토편.pdf",
        "title": "Tomato agronomy compendium",
        "crop_scopes": ["tomato"],
        "asset_family": "manual",
        "source_type": "pdf",
        "topic_hints": _TOPIC_MANUAL_TOMATO,
        "stage_hints": [
            "nursery",
            "vegetative",
            "flowering",
            "fruit_set",
            "harvest",
            "late_season",
        ],
    },
    {
        "filename": "토마토 스마트 온실 관리매뉴얼.PDF",
        "title": "Tomato smart greenhouse management manual",
        "crop_scopes": ["tomato"],
        "asset_family": "manual",
        "source_type": "pdf",
        "topic_hints": ["management", "environment", "control", "harvest"],
    },
    {
        "filename": "스마트팜 토마토_농촌진흥청 직원 교육자료(2023).PDF",
        "title": "Tomato smart farm training material",
        "crop_scopes": ["tomato"],
        "asset_family": "manual",
        "source_type": "pdf",
        "topic_hints": ["management", "education", "environment", "operations"],
    },
    {
        "filename": "코이어 배지조성과 급액횟수가 배액 EC 및 토마토 생육에 미치는 영향.pdf",
        "title": "Tomato coir substrate and drain EC paper",
        "crop_scopes": ["tomato"],
        "asset_family": "paper",
        "source_type": "pdf",
        "topic_hints": ["nutrition", "drainage", "substrate", "ec", "growth"],
    },
    {
        "filename": "농약 솔루션_260326_v1.xlsx",
        "title": "Pesticide solution workbook",
        "crop_scopes": ["tomato", "cucumber"],
        "asset_family": "pesticide_workbook",
        "source_type": "xlsx",
        "topic_hints": ["disease_pest", "rotation", "registration", "mixing"],
        "sheet_hints": [
            "성분별_통합",
            "흰가루병_교호추천",
            "토마토_전용_교호추천",
            "토마토_가루이_교호추천",
            "흰가루병_작용기작_전체",
            "토마토_온실가루이_전용",
        ],
        "normalization_targets": _PESTICIDE_TARGETS,
    },
    {
        "filename": "양액처방_계산시트_V2.0.xlsx",
        "title": "Nutrient recipe workbook",
        "crop_scopes": ["tomato", "cucumber"],
        "asset_family": "nutrient_workbook",
        "source_type": "xlsx",
        "topic_hints": ["nutrient_recipe", "drain_feedback", "fertilizer", "guardrails"],
        "sheet_hints": [
            "추천레시피_DB",
            "원수 분석",
            "처방전 계산",
            "배액 분석",
            "배액 기반 처방전",
            "비료_DB",
        ],
        "normalization_targets": _NUTRIENT_TARGETS,
    },
]


def _matches_crop(spec_crops: Iterable[str], crop: str | None) -> bool:
    if crop is None:
        return True
    return crop in spec_crops


def _slugify(value: str) -> str:
    chars: list[str] = []
    for char in value.lower():
        if char.isalnum():
            chars.append(char)
        elif chars and chars[-1] != "-":
            chars.append("-")
    return "".join(chars).strip("-")


def _path_for_spec(spec: dict[str, Any]) -> Path:
    return DATA_ROOT / spec["filename"]


def _open_csv_reader(path: Path):
    last_exc: Exception | None = None
    for encoding in ("utf-8-sig", "utf-8", "cp949", "euc-kr"):
        try:
            handle = path.open("r", encoding=encoding, newline="")
            return handle, csv.reader(handle), encoding
        except UnicodeDecodeError as exc:  # pragma: no cover - depends on local file encoding
            last_exc = exc
    if last_exc is not None:  # pragma: no cover - depends on local file encoding
        raise last_exc
    raise RuntimeError(f"Failed to open CSV file: {path}")


def _inspect_csv(path: Path) -> dict[str, Any]:
    handle, reader, encoding = _open_csv_reader(path)
    try:
        header = next(reader, [])
        row_count = 0
        sample_rows: list[list[str]] = []
        for row in reader:
            row_count += 1
            if len(sample_rows) < 2:
                sample_rows.append([str(value) for value in row[:8]])
    finally:
        handle.close()

    return {
        "parser_backend": "stdlib-csv",
        "encoding": encoding,
        "row_count": row_count,
        "column_count": len(header),
        "header": [str(value) for value in header[:20]],
        "sample_rows": sample_rows,
    }


def _inspect_xlsx(path: Path) -> dict[str, Any]:
    ns = {"main": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}
    with ZipFile(path) as archive:
        workbook_xml = ET.fromstring(archive.read("xl/workbook.xml"))
        sheet_names = [
            sheet.attrib["name"]
            for sheet in workbook_xml.findall("main:sheets/main:sheet", ns)
        ]

    return {
        "parser_backend": "zipfile-openxml",
        "sheet_count": len(sheet_names),
        "sheet_names": sheet_names,
    }


def _inspect_pdf(path: Path) -> dict[str, Any]:
    if PdfReader is None:
        return {
            "parser_backend": "unavailable",
            "page_count": None,
            "inspection_status": "pdf-reader-not-installed",
        }

    cmap_logger = logging.getLogger(_PDF_CMAP_LOGGER)
    original_disabled = cmap_logger.disabled
    with warnings.catch_warnings():
        warnings.filterwarnings("ignore", message=_PDF_WARNING_PATTERN, category=Warning)
        cmap_logger.disabled = True
        try:
            reader = PdfReader(str(path))
        finally:
            cmap_logger.disabled = original_disabled
    return {
        "parser_backend": "pypdf-available",
        "page_count": len(reader.pages),
        "inspection_status": "page-count-ready",
    }


def _inspect_asset(path: Path, source_type: str) -> dict[str, Any]:
    if source_type == "csv":
        return _inspect_csv(path)
    if source_type == "xlsx":
        return _inspect_xlsx(path)
    if source_type == "pdf":
        return _inspect_pdf(path)
    return {"parser_backend": "unknown"}


def _asset_readiness(exists: bool, inspection: dict[str, Any]) -> tuple[str, list[str]]:
    if not exists:
        return "missing", ["file-not-found"]

    if inspection.get("parser_backend") == "unavailable":
        return "present-awaiting-parser", ["optional-parser-missing"]

    if inspection.get("inspection_status") == "pdf-reader-not-installed":
        return "present-awaiting-parser", ["optional-parser-missing"]

    return "ready", []


def _build_asset_entry(spec: dict[str, Any]) -> dict[str, Any]:
    path = _path_for_spec(spec)
    exists = path.exists()
    inspection = _inspect_asset(path, spec["source_type"]) if exists else {}
    readiness, limitations = _asset_readiness(exists, inspection)

    entry = {
        "id": _slugify(Path(spec["filename"]).stem),
        "filename": spec["filename"],
        "relative_path": path.relative_to(REPO_ROOT).as_posix(),
        "title": spec["title"],
        "crop_scopes": spec["crop_scopes"],
        "asset_family": spec["asset_family"],
        "source_type": spec["source_type"],
        "topic_hints": spec.get("topic_hints", []),
        "stage_hints": spec.get("stage_hints", []),
        "normalization_targets": spec.get("normalization_targets", []),
        "sheet_hints": spec.get("sheet_hints", []),
        "exists": exists,
        "readiness": readiness,
        "limitations": limitations,
        "inspection": inspection,
    }

    if exists:
        stats = path.stat()
        entry["file_size_bytes"] = stats.st_size
        entry["modified_at"] = datetime.fromtimestamp(stats.st_mtime, UTC).isoformat()

    return entry


def _build_knowledge_catalog_uncached(crop: str | None = None) -> dict[str, Any]:
    assets = [
        _build_asset_entry(spec)
        for spec in ASSET_SPECS
        if _matches_crop(spec["crop_scopes"], crop)
    ]
    normalized_previews = build_workbook_previews(crop)

    readiness_counts = Counter(asset["readiness"] for asset in assets)
    source_counts = Counter(asset["source_type"] for asset in assets)

    pending_parsers = sorted(
        {
            asset["source_type"]
            for asset in assets
            if "optional-parser-missing" in asset["limitations"]
        }
    )
    advisory_surfaces = _build_advisory_surface_summary(normalized_previews)

    return {
        "catalog_version": CATALOG_VERSION,
        "generated_at": datetime.now(UTC).isoformat(),
        "crop_scope": crop or "all",
        "directive_file": str(DIRECTIVE_FILE),
        "data_root": str(DATA_ROOT),
        "summary": {
            "asset_count": len(assets),
            "by_source_type": dict(source_counts),
            "by_readiness": dict(readiness_counts),
            "pending_parsers": pending_parsers,
            "normalized_workbook_families": sorted(
                family
                for family, preview in normalized_previews.items()
                if preview.get("status") == "ready"
            ),
            "advisory_surface_names": sorted(advisory_surfaces),
        },
        "normalized_previews": normalized_previews,
        "advisory_surfaces": advisory_surfaces,
        "assets": assets,
    }


@lru_cache(maxsize=8)
def _build_knowledge_catalog_cached(crop_scope: str) -> dict[str, Any]:
    crop = None if crop_scope == "__all__" else crop_scope
    return _build_knowledge_catalog_uncached(crop)


def build_knowledge_catalog(crop: str | None = None) -> dict[str, Any]:
    crop_scope = "__all__" if crop is None else crop
    payload = deepcopy(_build_knowledge_catalog_cached(crop_scope))
    payload["database"] = inspect_knowledge_database(payload.get("crop_scope"))
    payload["retrieval_surface"] = _build_retrieval_surface_summary(payload["database"])
    payload["summary"]["database_status"] = payload["database"]["status"]
    payload["summary"]["retrieval_surface_status"] = payload["retrieval_surface"]["status"]
    return payload


def persist_knowledge_catalog(payload: dict[str, Any]) -> str:
    CATALOG_OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    scope = payload.get("crop_scope", "all")
    output_path = CATALOG_OUTPUT_DIR / f"knowledge_catalog_{scope}.json"
    output_path.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    return str(output_path)


def rebuild_knowledge_catalog(crop: str | None = None) -> dict[str, Any]:
    _build_knowledge_catalog_cached.cache_clear()
    clear_workbook_preview_cache()
    crop_scope = "__all__" if crop is None else crop
    payload = deepcopy(_build_knowledge_catalog_cached(crop_scope))
    payload["persisted_to"] = persist_knowledge_catalog(payload)
    payload["database"] = rebuild_knowledge_database(payload)
    payload["retrieval_surface"] = _build_retrieval_surface_summary(payload["database"])
    payload["summary"]["database_status"] = payload["database"]["status"]
    payload["summary"]["retrieval_surface_status"] = payload["retrieval_surface"]["status"]
    payload["persisted_to"] = persist_knowledge_catalog(payload)
    return payload


def _compact_preview_for_context(preview: dict[str, Any] | None) -> dict[str, Any]:
    if not preview:
        return {}

    family = preview.get("family")
    crop_view = preview.get("crop_view", {})

    if family == "pesticide":
        return {
            "family": family,
            "status": preview.get("status"),
            "target_names": crop_view.get("target_names", []),
            "moa_groups": crop_view.get("moa_groups", []),
            "registration_status_counts": crop_view.get("registration_status_counts", {}),
            "sample_products": [
                {
                    "product_name": row.get("product_name"),
                    "active_ingredient": row.get("active_ingredient"),
                    "moa_code_group": row.get("moa_code_group"),
                }
                for row in crop_view.get("sample_products", [])
            ],
        }

    if family == "nutrient":
        return {
            "family": family,
            "status": preview.get("status"),
            "stages": crop_view.get("stages", []),
            "mediums": crop_view.get("mediums", []),
            "guardrail_ranges": crop_view.get("guardrail_ranges", {}),
            "source_water_analytes": crop_view.get("source_water_analytes", []),
            "drain_water_analytes": crop_view.get("drain_water_analytes", []),
            "fertilizer_names": crop_view.get("fertilizer_names", []),
        }

    return {"family": family, "status": preview.get("status")}


def _build_retrieval_surface_summary(
    database: dict[str, Any],
) -> dict[str, Any]:
    ready = database.get("status") == "ready" and int(database.get("chunk_count") or 0) > 0
    return {
        "status": "ready" if ready else "unavailable",
        "route": "/api/knowledge/query",
        "request_contract": {
            "required": ["query"],
            "optional": [
                "crop",
                "limit",
                "filters.source_types",
                "filters.asset_families",
                "filters.topic_major",
                "filters.topic_minor",
            ],
            "limit_range": {"min": 1, "max": 10},
        },
        "coverage": {
            "document_count": database.get("document_count"),
            "chunk_count": database.get("chunk_count"),
            "fts_enabled": database.get("fts_enabled", False),
            "query_modes": ["intent_routed_hybrid", "lexical_fallback"],
            "routed_intents": [
                "environment_control",
                "crop_physiology",
                "disease_pest",
                "nutrient_recipe",
                "cultivation_work",
                "harvest_market",
                "general_chat",
            ],
        },
        "limitations": [
            "The route now applies heuristic query routing plus DB-backed hybrid reranking over persisted chunks, while dense vector retrieval remains a later phase.",
        ],
    }


def _build_advisory_surface_summary(
    normalized_previews: dict[str, dict[str, Any]],
) -> dict[str, dict[str, Any]]:
    pesticide_preview = normalized_previews.get("pesticide", {})
    pesticide_view = pesticide_preview.get("crop_view", {})
    nutrient_preview = normalized_previews.get("nutrient", {})
    nutrient_view = nutrient_preview.get("crop_view", {})

    return {
        "environment": {
            "status": "ready",
            "route": "/api/environment/recommend",
            "delegate_route": "/api/advisor/tab/environment",
            "request_contract": {
                "required": ["crop"],
                "optional": ["dashboard"],
            },
            "coverage": {
                "dashboard_domains": ["data", "currentData", "metrics", "weather", "rtr"],
                "signals": ["temperature", "humidity", "co2", "vpd", "forecast", "rtr"],
                "advisory_mode": "dashboard_fed_deterministic",
            },
            "limitations": [
                "The route reuses the landed environment tab payload and stays monitoring-first when inside telemetry is incomplete.",
            ],
        },
        "pesticide": {
            "status": "ready" if pesticide_preview.get("status") == "ready" else "unavailable",
            "route": "/api/pesticides/recommend",
            "request_contract": {
                "required": ["crop", "target"],
                "optional": ["limit"],
                "limit_range": {"min": 1, "max": 10},
            },
            "coverage": {
                "target_names": pesticide_view.get("target_names", [])[:8],
                "moa_groups": pesticide_view.get("moa_groups", [])[:8],
                "registration_status_counts": pesticide_view.get("registration_status_counts", {}),
                "manual_review_statuses": [
                    status
                    for status in ("unknown", "label-check-required")
                    if pesticide_view.get("registration_status_counts", {}).get(status, 0)
                ],
                "rotation_hardening_policy": "registered_first_unique_moa",
            },
            "limitations": [
                "Deterministic lookup is available, but final product-label verification is still mandatory before operational use.",
                "Workbook coverage can still contain unknown or label-check-required rows, so the route now returns registered rows first and keeps manual-review burden explicit.",
            ],
        },
        "nutrient": {
            "status": "ready" if nutrient_preview.get("status") == "ready" else "unavailable",
            "route": "/api/nutrients/recommend",
            "request_contract": {
                "required": ["crop"],
                "optional": ["stage", "medium"],
            },
            "coverage": {
                "stages": nutrient_view.get("stages", [])[:8],
                "mediums": nutrient_view.get("mediums", [])[:6],
                "guardrail_ranges": nutrient_view.get("guardrail_ranges", {}),
            },
            "limitations": [
                "Deterministic recipe lookup is available as a stable seam, while the final stock-tank calculation engine remains a later phase.",
            ],
        },
        "nutrient_correction": {
            "status": "ready" if nutrient_preview.get("status") == "ready" else "unavailable",
            "route": "/api/nutrients/correction",
            "request_contract": {
                "required": ["crop"],
                "optional": [
                    "stage",
                    "medium",
                    "source_water_mmol_l",
                    "drain_water_mmol_l",
                    "working_solution_volume_l",
                    "stock_ratio",
                ],
            },
            "coverage": {
                "stages": nutrient_view.get("stages", [])[:8],
                "mediums": nutrient_view.get("mediums", [])[:6],
                "source_water_analytes": nutrient_view.get("source_water_analytes", [])[:12],
                "drain_water_analytes": nutrient_view.get("drain_water_analytes", [])[:12],
                "guardrail_ranges": nutrient_view.get("guardrail_ranges", {}),
                "fertilizer_names": nutrient_view.get("fertilizer_names", [])[:10],
                "calculator_defaults": nutrient_view.get("calculator_defaults", {}),
                "drain_feedback_defaults": nutrient_view.get("drain_feedback_defaults", {}),
                "stock_tank_draft_mode": "single_fertilizer_stoichiometric",
                "macro_bundle_mode": "macro_lane_bundle_candidate",
                "correction_policy": "partial_input_provisional_bundle_recheck",
                "drain_feedback_policy": "bounded_drain_feedback_target_shift",
                "residual_policy": "prefer_no_objective_overshoot",
            },
            "limitations": [
                "The correction route currently returns a deterministic correction draft plus macro-only single-fertilizer and macro-bundle stock-tank drafts, not the final stock-tank calculation engine.",
                "Partial source-water coverage now keeps bundle drafts provisional and rechecks blocked analytes plus guardrails after bundle assembly.",
                "Drain observations now shift next-step nutrient targets only through a bounded clamp policy before macro-bundle planning.",
                "Residual-safe bundle alternatives are additive guidance only and do not yet replace the selected macro bundle automatically.",
            ],
        },
        "work": {
            "status": "ready",
            "route": "/api/work/recommend",
            "delegate_route": "/api/advisor/tab/work",
            "request_contract": {
                "required": ["crop"],
                "optional": ["dashboard"],
            },
            "coverage": {
                "dashboard_domains": ["data", "currentData", "metrics", "weather", "rtr"],
                "signals": ["forecast", "weather", "rtr", "energy", "recentSummary"],
                "advisory_mode": "dashboard_fed_deterministic",
            },
            "limitations": [
                "The route reuses the landed work tab payload and prioritizes tasks from the current dashboard instead of historical work-log replay.",
            ],
        },
    }


def build_crop_knowledge_context(crop: str) -> dict[str, Any]:
    payload = build_knowledge_catalog(crop)
    assets = payload["assets"]
    titles = [asset["title"] for asset in assets]
    topics = sorted({topic for asset in assets for topic in asset["topic_hints"]})
    source_types = payload["summary"]["by_source_type"]
    normalized_previews = payload.get("normalized_previews", {})
    workbook_assets = [
        {
            "title": asset["title"],
            "asset_family": asset["asset_family"],
            "sheet_names": asset["inspection"].get("sheet_names", asset["sheet_hints"]),
            "normalization_targets": asset["normalization_targets"][:6],
            "preview": _compact_preview_for_context(
                normalized_previews.get(
                    "pesticide" if asset["asset_family"] == "pesticide_workbook" else "nutrient"
                )
            ),
        }
        for asset in assets
        if asset["source_type"] == "xlsx"
    ]

    return {
        "catalog_version": payload["catalog_version"],
        "crop": crop,
        "asset_count": payload["summary"]["asset_count"],
        "source_types": source_types,
        "titles": titles[:8],
        "topics": topics[:12],
        "telemetry_assets": [
            asset["filename"] for asset in assets if asset["source_type"] == "csv"
        ],
        "structured_workbooks": workbook_assets,
        "knowledge_db": {
            "status": payload.get("database", {}).get("status"),
            "document_count": payload.get("database", {}).get("document_count"),
            "chunk_count": payload.get("database", {}).get("chunk_count"),
            "table_counts": payload.get("database", {}).get("table_counts", {}),
        },
        "knowledge_query": payload.get("retrieval_surface", {}),
        "deterministic_advisory": payload.get("advisory_surfaces", {}),
        "limitations": sorted(
            {limitation for asset in assets for limitation in asset["limitations"]}
        ),
        "provenance_policy": (
            "Backend keeps document, sheet, and future chunk provenance internal; the UI should not expose raw provenance IDs."
        ),
    }
