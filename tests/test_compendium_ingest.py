from __future__ import annotations

import importlib.util
import json
import sqlite3
from copy import deepcopy
from pathlib import Path

import pytest

from model_informed_greenhouse_dashboard.backend.app.services import (
    knowledge_catalog,
    knowledge_database,
    pdf_quality,
)
from model_informed_greenhouse_dashboard.backend.app.services.corpus_quarantine import (
    is_quarantined,
)


@pytest.fixture
def indexer():
    path = Path(__file__).resolve().parents[1] / "scripts" / "index_agronomy_compendia.py"
    spec = importlib.util.spec_from_file_location("compendium_index_test_module", path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def test_compendium_catalog_preserves_japanese_source_context(monkeypatch, tmp_path):
    monkeypatch.setattr(knowledge_catalog, "DATA_ROOT", tmp_path)
    for spec in knowledge_catalog.ASSET_SPECS:
        if "대계" not in spec["filename"]:
            continue
        entry = knowledge_catalog._build_asset_entry(spec)
        assert "농업기술대계" in entry["title"]
        assert entry["expected_language"] == "ja"
        assert entry["source_context"]["language"] == "ja"
        assert entry["source_context"]["region"] == "Japan"
        assert entry["source_context"]["reference_kind"] == "agronomy_compendium"
        assert "not the publication year" in entry["source_context"]["supplement_evidence"]["note"]
        assert "volume" not in entry["source_context"]
        assert not is_quarantined(filename=entry["filename"])
    assert is_quarantined(asset_family="wiki_page")
    assert is_quarantined(asset_family="wiki_case")


@pytest.mark.parametrize("text", ["", "\n\t  1234.56 %", "ɾ೥ʼר ʕ ɾ೥ʼר ʕ"])
def test_japanese_extraction_rejects_empty_or_undecoded_text(text):
    assert not pdf_quality.assess_extraction(text, expected_language="ja").passes


def test_japanese_extraction_accepts_readable_text_without_claiming_korean():
    text = "環境制御からみたキュウリの生理・生態的特性。光、温度、湿度と収量の関係。"
    result = pdf_quality.assess_extraction(text, expected_language="ja")
    assert result.passes
    assert result.to_dict()["japanese_share"] > 0.2
    assert not pdf_quality.assess_extraction(text, expected_language="ko").passes
    assert not pdf_quality.assess_extraction("", expected_language="any").passes


def test_compendium_cache_resumes_complete_pages_and_retains_original_text(indexer, monkeypatch, tmp_path):
    data_dir = tmp_path / "data"
    data_dir.mkdir()
    source = data_dir / indexer.COMPENDIUM_FILES["tomato"]
    source.write_bytes(b"unchanged raw fixture")
    header = {
        "type": "source", "filename": source.name, "size": source.stat().st_size,
        "mtime_ns": source.stat().st_mtime_ns, "page_count": 3, "extractor": "pdfminer.six",
    }
    original_pages = [
        "",
        "\n環境制御と気孔の反応。\n\n13～24℃。第2巻\n",
        "蒸散と光合成の説明。\n＜追録第35号・2010年＞\n",
    ]
    cache_dir = tmp_path / "knowledge" / "compendium_pages"
    cache_dir.mkdir(parents=True)
    partial = cache_dir / "tomato.interrupted.tmp"
    partial.write_bytes((
        json.dumps(header, ensure_ascii=False) + "\n"
        + "\n".join(json.dumps({"page": n, "text": text}, ensure_ascii=False)
                    for n, text in enumerate(original_pages[:2], start=1))
        + '\n{"page":3,"text":"'
    ).encode("utf-8") + b"\xe6\x97")
    monkeypatch.setattr(indexer, "_source_header", lambda _: dict(header))
    requested_pages = []

    def remaining_pages(_source, *, start_page):
        requested_pages.append(start_page)
        yield from original_pages[start_page:]

    monkeypatch.setattr(indexer, "_iter_source_pages", remaining_pages)
    cache = indexer.materialize_pages(
        crop="tomato", data_dir=data_dir, knowledge_dir=cache_dir.parent,
    )
    assert requested_pages == [2]
    assert indexer._read_cache(cache, header) == original_pages
    assert source.read_bytes() == b"unchanged raw fixture"
    indexer.materialize_pages(crop="tomato", data_dir=data_dir, knowledge_dir=cache_dir.parent)
    assert requested_pages == [2], "a complete current cache must avoid PDF extraction"
    with pytest.raises(ValueError, match="stale source metadata"):
        indexer._read_cache(cache, {**header, "mtime_ns": header["mtime_ns"] + 1})


@pytest.fixture
def existing_corpus(indexer, monkeypatch, tmp_path):
    specs = {
        crop: deepcopy(next(spec for spec in knowledge_catalog.ASSET_SPECS
                            if spec["filename"] == filename))
        for crop, filename in indexer.COMPENDIUM_FILES.items()
    }
    prepared = {
        crop: {
            "crop": crop,
            "spec": spec,
            "header": {"size": 1234, "mtime_ns": 1_750_000_000_000_000_000, "page_count": 2},
            "quality": {"passes": True, "expected_language": "ja"},
            "chunks": [
                {
                    "text_content": "気孔の反応と蒸散について説明する。13～24℃。",
                    "source_locator": "page:1",
                    "metadata": {"page": 1, "section_title": "生理、生態"},
                },
                {
                    "text_content": "夜間の環境条件と昼間の光合成について説明する。",
                    "source_locator": "page:2",
                    "metadata": {"page": 2, "section_title": "環境制御"},
                },
            ],
        }
        for crop, spec in specs.items()
    }
    monkeypatch.setattr(indexer, "_prepare_document", lambda **kwargs: prepared[kwargs["crop"]])
    document_ids = {}
    for scope in ("tomato", "cucumber", "all", "tomato-Moon"):
        path = tmp_path / f"knowledge_db_{scope}.sqlite3"
        with knowledge_database._connect(path) as connection:
            knowledge_database._create_schema(connection)
            selected_crops = ("tomato", "cucumber") if scope == "all" else (scope.replace("-Moon", ""),)
            for crop in selected_crops:
                spec = specs[crop]
                document_id = knowledge_database._insert_document(connection, scope, {
                    **spec, "id": crop, "relative_path": f"data/{spec['filename']}", "readiness": "ready",
                })
                document_ids[(scope, crop)] = document_id
                connection.execute(
                    "UPDATE knowledge_documents SET metadata_json=? WHERE document_id=?",
                    (json.dumps({"existing_note": "preserve", "source_context": {"obsolete": True}}), document_id),
                )
                old_chunk = knowledge_database._insert_chunk(
                    connection, document_id=document_id, crop_scope=scope,
                    chunk_type="pdf_paragraph", topic_major="physiology", topic_minor="manual",
                    source_locator="page:1", ordinal=1, text_content="ɾ೥ʼר old undecoded source", metadata={},
                )
                knowledge_database._insert_entities(connection, old_chunk, [("crop", crop)])
            other_document = knowledge_database._insert_document(connection, scope, {
                "id": "other", "filename": "other.pdf", "relative_path": "data/other.pdf",
                "title": "Unrelated guide", "crop_scopes": ["tomato", "cucumber"],
                "asset_family": "manual", "source_type": "pdf", "readiness": "ready",
            })
            other_chunk = knowledge_database._insert_chunk(
                connection, document_id=other_document, crop_scope=scope, chunk_type="pdf_paragraph",
                topic_major="environment", topic_minor="manual", source_locator="page:9", ordinal=1,
                text_content="Unrelated measurements and original guidance.", metadata={"original": True},
            )
            knowledge_database._insert_entities(connection, other_chunk, [("topic", "environment")])
            connection.execute(
                "INSERT INTO greenhouse_measurements(crop,measured_at,t_air_c,source_document_id,source_row) "
                "VALUES(?,?,?,?,?)", ("tomato", "2026-09-08T06:00:00Z", 27.5, other_document, 1),
            )
    return tmp_path, document_ids, specs


def _snapshot(path):
    with sqlite3.connect(path) as connection:
        return {
            table: connection.execute(f"SELECT * FROM {table} ORDER BY 1").fetchall()
            for table in (
                "knowledge_documents", "knowledge_chunks", "knowledge_entities",
                "knowledge_chunks_fts", "greenhouse_measurements",
            )
        }


def test_compendium_index_preserves_existing_data_and_is_idempotent(indexer, existing_corpus):
    directory, document_ids, specs = existing_corpus
    before = {path.name: _snapshot(path) for path in directory.glob("*.sqlite3")}
    result = indexer.index_cached_compendia(
        crops=["tomato", "cucumber"], data_dir=directory, knowledge_dir=directory,
    )
    assert {(row["scope"], row["crop"]) for row in result} == {
        ("tomato", "tomato"), ("cucumber", "cucumber"), ("all", "tomato"), ("all", "cucumber"),
    }
    assert all(row["status"] == "indexed" for row in result)
    for path in directory.glob("*.sqlite3"):
        after = _snapshot(path)
        if "Moon" in path.name:
            assert after == before[path.name]
            continue
        original = before[path.name]
        # Other document, chunk, entity, FTS rows and observations survive exactly.
        other_document = next(row for row in original["knowledge_documents"] if row[3] == "other.pdf")
        other_id = other_document[0]
        assert other_document in after["knowledge_documents"]
        other_chunks = [row for row in original["knowledge_chunks"] if row[1] == other_id]
        other_chunk_ids = {row[0] for row in other_chunks}
        assert all(row in after["knowledge_chunks"] for row in other_chunks)
        assert all(row in after["knowledge_entities"] for row in original["knowledge_entities"]
                   if row[1] in other_chunk_ids)
        assert all(row in after["knowledge_chunks_fts"] for row in original["knowledge_chunks_fts"]
                   if row[0] in other_chunk_ids)
        assert after["greenhouse_measurements"] == original["greenhouse_measurements"]
        scope = path.stem.removeprefix("knowledge_db_")
        with knowledge_database._connect(path) as connection:
            for row in result:
                if row["scope"] != scope:
                    continue
                crop = row["crop"]
                assert row["document_id"] == document_ids[(scope, crop)]
                document = connection.execute(
                    "SELECT * FROM knowledge_documents WHERE document_id=?", (row["document_id"],),
                ).fetchone()
                metadata = json.loads(document["metadata_json"])
                assert metadata["existing_note"] == "preserve"
                assert metadata["source_context"] == specs[crop]["source_context"]
                chunks = connection.execute(
                    "SELECT * FROM knowledge_chunks WHERE document_id=? ORDER BY ordinal", (row["document_id"],),
                ).fetchall()
                assert [chunk["source_locator"] for chunk in chunks] == ["page:1", "page:2"]
                assert "13～24℃" in chunks[0]["text_content"]
                assert json.loads(chunks[0]["metadata_json"])["section_title"] == "生理、生態"
                for chunk in chunks:
                    assert connection.execute(
                        "SELECT text_content FROM knowledge_chunks_fts WHERE chunk_id=?", (chunk["chunk_id"],),
                    ).fetchone()[0] == chunk["text_content"]
    first = {path.name: _snapshot(path) for path in directory.glob("*.sqlite3")}
    again = indexer.index_cached_compendia(
        crops=["tomato", "cucumber"], data_dir=directory, knowledge_dir=directory,
    )
    assert all(row["status"] == "unchanged" for row in again)
    assert {path.name: _snapshot(path) for path in directory.glob("*.sqlite3")} == first


def test_compendium_index_rolls_back_all_selected_databases_on_insert_failure(
    indexer, existing_corpus, monkeypatch,
):
    directory, _, _ = existing_corpus
    before = {path.name: _snapshot(path) for path in directory.glob("*.sqlite3")}

    def fail_insert(*args, **kwargs):
        raise RuntimeError("injected insert failure")

    monkeypatch.setattr(knowledge_database, "_insert_chunk", fail_insert)
    with pytest.raises(RuntimeError, match="injected insert failure"):
        indexer.index_cached_compendia(
            crops=["tomato", "cucumber"], data_dir=directory, knowledge_dir=directory,
        )
    assert {path.name: _snapshot(path) for path in directory.glob("*.sqlite3")} == before
