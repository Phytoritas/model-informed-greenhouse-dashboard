"""Integration tests: curated LLM Wiki sections are indexed and out-rank PDFs."""

from __future__ import annotations

import hashlib
import json
import sqlite3
from pathlib import Path

from model_informed_greenhouse_dashboard.backend.app.services import knowledge_database
from model_informed_greenhouse_dashboard.backend.app.services.knowledge_catalog import (
    rebuild_knowledge_catalog,
)
from model_informed_greenhouse_dashboard.backend.app.services.knowledge_database import (
    query_knowledge_database,
)

WIKI_PAGE = """# 토마토 재배관리

## 요약
토마토 곁순 제거와 착과 판단, 적엽 유인 관리를 정리한다.

## Teaching-Ready Evidence
- 곁순 제거는 주 1회, 상부 화방 착과 상태를 함께 확인한다.
- 적엽은 하엽 위주로 통풍과 광 투과를 확보한다.

## 현장 사용 주의
- 병해충 진단은 확정 전 재확인한다.

## Source Trace
- source_path=10_ByFarm/Farm-A/review.pptx; locator=slide 1
"""


def _seed_wiki(data_dir: Path) -> None:
    wiki_root = data_dir / "knowledge_wiki"
    pages = wiki_root / "pages"
    pages.mkdir(parents=True, exist_ok=True)
    page_path = pages / "027_토마토_재배관리.md"
    page_path.write_text(WIKI_PAGE, encoding="utf-8", newline="\n")
    digest = hashlib.sha256(WIKI_PAGE.encode("utf-8")).hexdigest()
    manifest = {
        "source_label": "consulting-llm-wiki-v2",
        "snapshot_at": "2026-07-05T00:00:00Z",
        "anonymized": True,
        "farm_label_count": 1,
        "file_count": 1,
        "files": [
            {"path": "pages/027_토마토_재배관리.md", "sha256": digest, "section": "pages"}
        ],
    }
    (wiki_root / "manifest.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8"
    )


def test_wiki_sections_are_indexed_as_chunks(synthetic_knowledge_assets) -> None:
    _seed_wiki(synthetic_knowledge_assets["data_dir"])
    payload = rebuild_knowledge_catalog("tomato")

    assert payload["database"]["status"] == "ready"
    db_path = knowledge_database.knowledge_db_path("tomato")
    with sqlite3.connect(db_path) as connection:
        wiki_docs = connection.execute(
            "SELECT COUNT(*) FROM knowledge_documents WHERE source_type = 'markdown'"
        ).fetchone()[0]
        wiki_chunks = connection.execute(
            "SELECT COUNT(*) FROM knowledge_chunks WHERE chunk_type = 'wiki_section'"
        ).fetchone()[0]
        # Machine-only sections are excluded from the retrievable body.
        trace_chunks = connection.execute(
            "SELECT COUNT(*) FROM knowledge_chunks WHERE source_locator = 'section:Source Trace'"
        ).fetchone()[0]

    assert wiki_docs == 1
    assert wiki_chunks >= 1
    assert trace_chunks == 0


def test_wiki_section_outranks_pdf_for_curated_topic(synthetic_knowledge_assets) -> None:
    _seed_wiki(synthetic_knowledge_assets["data_dir"])
    rebuild_knowledge_catalog("tomato")

    payload = query_knowledge_database(
        crop="tomato", query="토마토 곁순 제거 착과 판단", limit=5
    )

    assert payload["query_status"] == "ready"
    assert payload["results"]
    top = payload["results"][0]["document"]
    assert top["asset_family"] == "wiki_page"
    assert top["source_type"] == "markdown"


def test_wiki_provenance_metadata_records_source_label(synthetic_knowledge_assets) -> None:
    _seed_wiki(synthetic_knowledge_assets["data_dir"])
    rebuild_knowledge_catalog("tomato")

    db_path = knowledge_database.knowledge_db_path("tomato")
    with sqlite3.connect(db_path) as connection:
        row = connection.execute(
            """
            SELECT metadata_json FROM knowledge_chunks
            WHERE chunk_type = 'wiki_section' LIMIT 1
            """
        ).fetchone()
    metadata = json.loads(row[0])
    assert metadata["source_label"] == "consulting-llm-wiki-v2"
    assert "knowledge_wiki/" in metadata["wiki_path"]
