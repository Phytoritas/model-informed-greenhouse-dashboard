from pathlib import Path
import sqlite3

from model_informed_greenhouse_dashboard.backend.app.services import (
    knowledge_catalog,
    knowledge_database,
)
from model_informed_greenhouse_dashboard.backend.app.services.knowledge_catalog import (
    build_crop_knowledge_context,
    build_knowledge_catalog,
    rebuild_knowledge_catalog,
)
from model_informed_greenhouse_dashboard.backend.app.services.workbook_normalization import (
    clear_workbook_preview_cache,
)


def setup_function() -> None:
    clear_workbook_preview_cache()
    knowledge_catalog._build_knowledge_catalog_cached.cache_clear()


def test_rebuild_knowledge_catalog_creates_sqlite_database(
    monkeypatch,
    tmp_path: Path,
) -> None:
    monkeypatch.setattr(knowledge_catalog, "CATALOG_OUTPUT_DIR", tmp_path)
    monkeypatch.setattr(knowledge_database, "KNOWLEDGE_DB_DIR", tmp_path)

    payload = rebuild_knowledge_catalog("tomato")

    assert payload["database"]["status"] == "ready"
    assert payload["summary"]["database_status"] == "ready"
    db_path = Path(payload["database"]["path"])
    assert db_path.exists()
    assert payload["database"]["document_count"] >= 1
    assert payload["database"]["chunk_count"] >= 1
    assert payload["summary"]["pending_parsers"] == []
    assert payload["database"]["table_counts"]["greenhouse_measurements"] >= 1
    assert payload["database"]["table_counts"]["pesticide_products"] >= 1
    assert payload["database"]["table_counts"]["nutrient_recipes"] >= 1
    assert payload["database"]["table_counts"]["crop_profiles"] == 1

    with sqlite3.connect(db_path) as connection:
        pdf_document_count = connection.execute(
            "SELECT COUNT(*) FROM knowledge_documents WHERE source_type = 'pdf'"
        ).fetchone()[0]
        pdf_chunk_count = connection.execute(
            "SELECT COUNT(*) FROM knowledge_chunks WHERE chunk_type = 'pdf_paragraph'"
        ).fetchone()[0]
        crop_profile_count = connection.execute(
            "SELECT COUNT(*) FROM crop_profiles WHERE crop_scope = 'tomato'"
        ).fetchone()[0]
        assert pdf_document_count >= 1
        assert pdf_chunk_count >= 1
        assert crop_profile_count == 1


def test_build_knowledge_catalog_reports_existing_database_summary(
    monkeypatch,
    tmp_path: Path,
) -> None:
    monkeypatch.setattr(knowledge_catalog, "CATALOG_OUTPUT_DIR", tmp_path)
    monkeypatch.setattr(knowledge_database, "KNOWLEDGE_DB_DIR", tmp_path)

    rebuilt = rebuild_knowledge_catalog("cucumber")
    payload = build_knowledge_catalog("cucumber")
    context_payload = build_crop_knowledge_context("cucumber")

    assert payload["database"]["status"] == "ready"
    assert payload["database"]["path"] == rebuilt["database"]["path"]
    assert context_payload["knowledge_db"]["status"] == "ready"
    assert context_payload["knowledge_db"]["document_count"] == payload["database"]["document_count"]
    assert context_payload["knowledge_db"]["chunk_count"] == payload["database"]["chunk_count"]


def test_crop_scoped_catalog_falls_back_to_all_scope_database(
    monkeypatch,
    tmp_path: Path,
) -> None:
    monkeypatch.setattr(knowledge_catalog, "CATALOG_OUTPUT_DIR", tmp_path)
    monkeypatch.setattr(knowledge_database, "KNOWLEDGE_DB_DIR", tmp_path)

    rebuild_knowledge_catalog()
    payload = build_knowledge_catalog("tomato")

    assert payload["database"]["status"] == "ready"
    assert payload["database"]["resolved_scope"] == "all"


def test_inspect_knowledge_database_self_heals_missing_new_tables(
    monkeypatch,
    tmp_path: Path,
) -> None:
    monkeypatch.setattr(knowledge_catalog, "CATALOG_OUTPUT_DIR", tmp_path)
    monkeypatch.setattr(knowledge_database, "KNOWLEDGE_DB_DIR", tmp_path)

    rebuilt = rebuild_knowledge_catalog("tomato")
    db_path = Path(rebuilt["database"]["path"])

    with sqlite3.connect(db_path) as connection:
        connection.execute("DROP TABLE greenhouse_control_events")

    payload = build_knowledge_catalog("tomato")

    assert payload["database"]["status"] == "ready"
    assert payload["database"]["table_counts"]["greenhouse_control_events"] == 0
