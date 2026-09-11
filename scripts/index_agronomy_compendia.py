"""Cache and index only the two local Japanese agronomy compendia.

`extract` materializes source pages without opening any knowledge database.
`index` consumes those caches and replaces only the selected documents' derived
rows in existing tomato/cucumber databases and the all-scope database, if present.
Raw PDFs, observations, other documents, and Moon databases are never changed.
"""

from __future__ import annotations

import argparse
import json
import os
import sqlite3
import sys
import tempfile
from bisect import bisect_right
from datetime import UTC, datetime
from pathlib import Path
from typing import Any, Callable, Iterable

REPO_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(REPO_ROOT / "src"))

from model_informed_greenhouse_dashboard.backend.app.config import settings
from model_informed_greenhouse_dashboard.backend.app.services.pdf_quality import (
    assess_document,
    extract_pdf_page_text,
)

COMPENDIUM_FILES = {
    "tomato": "농업기술대계_토마토편.pdf",
    "cucumber": "오이_농업기술대계.pdf",
}
READING_ORDER = "two_column_bands_v1"


def _source_header(source: Path) -> dict[str, Any]:
    from pypdf import PdfReader

    stats = source.stat()
    return {
        "type": "source",
        "filename": source.name,
        "size": stats.st_size,
        "mtime_ns": stats.st_mtime_ns,
        "page_count": len(PdfReader(source).pages),
        "extractor": "pdfminer.six",
        "reading_order": READING_ORDER,
    }


def _read_cache(cache: Path, expected: dict[str, Any]) -> list[str]:
    with cache.open(encoding="utf-8") as handle:
        header = json.loads(next(handle, "{}"))
        if header != expected:
            raise ValueError(f"stale source metadata in {cache.name}")
        pages = []
        for page_number, line in enumerate(handle, start=1):
            row = json.loads(line)
            if row.get("page") != page_number or not isinstance(row.get("text"), str):
                raise ValueError(f"invalid page sequence in {cache.name}")
            pages.append(row["text"])
    if len(pages) != expected["page_count"] or not pages:
        raise ValueError(f"incomplete page cache: {cache.name}")
    assessment = assess_document(pages, expected_language="ja")
    if not assessment.passes:
        raise ValueError(f"unreadable page cache {cache.name}: {assessment.reason}")
    return pages


def _partial_pages(cache: Path, expected: dict[str, Any]) -> list[str]:
    """Recover a complete page prefix left by an interrupted extraction."""
    best: list[str] = []
    for partial in sorted(cache.parent.glob(f"{cache.stem}.*.tmp")):
        try:
            with partial.open("rb") as handle:
                if json.loads(next(handle, b"{}")) != expected:
                    continue
                pages = []
                for number, line in enumerate(handle, start=1):
                    try:
                        row = json.loads(line)
                    except ValueError:
                        break  # A terminated writer may leave an incomplete final line.
                    if not isinstance(row, dict) or number > expected["page_count"] or row.get("page") != number:
                        break
                    if not isinstance(row.get("text"), str):
                        break
                    pages.append(row["text"])
                if len(pages) > len(best):
                    best = pages
        except (OSError, ValueError, TypeError):
            continue
    return best


def _iter_source_pages(source: Path, *, start_page: int = 0) -> Iterable[str]:
    from pdfminer.high_level import extract_pages

    # pdfminer numbers pages from zero; skipped pages are parsed but their text
    # is not re-extracted. The JSONL cache keeps the original 1-based numbering.
    from pypdf import PdfReader

    total_pages = len(PdfReader(source).pages)
    for layout in extract_pages(str(source), page_numbers=range(start_page, total_pages)):
        yield extract_pdf_page_text(layout, reading_order=READING_ORDER)


def materialize_pages(
    *,
    crop: str,
    data_dir: Path,
    knowledge_dir: Path,
    progress: Callable[[dict[str, Any]], None] | None = None,
) -> Path:
    source = data_dir / COMPENDIUM_FILES[crop]
    header = _source_header(source)
    cache = knowledge_dir / "compendium_pages" / f"{crop}.jsonl"
    try:
        _read_cache(cache, header)
    except (OSError, ValueError, TypeError):
        pass
    else:
        if progress:
            progress({"crop": crop, "status": "cache_reused", "pages": header["page_count"]})
        return cache

    cache.parent.mkdir(parents=True, exist_ok=True)
    pages = _partial_pages(cache, header)
    if progress:
        progress({
            "crop": crop, "status": "extracting", "pages": header["page_count"],
            "resumed_pages": len(pages),
        })
    temporary: Path | None = None
    try:
        with tempfile.NamedTemporaryFile(
            mode="w", encoding="utf-8", newline="\n", dir=cache.parent,
            prefix=f"{crop}.", suffix=".tmp", delete=False,
        ) as handle:
            temporary = Path(handle.name)
            handle.write(json.dumps(header, ensure_ascii=False) + "\n")
            for number, text in enumerate(pages, start=1):
                handle.write(json.dumps({"page": number, "text": text}, ensure_ascii=False) + "\n")
            for number, text in enumerate(_iter_source_pages(source, start_page=len(pages)), start=len(pages) + 1):
                pages.append(text)
                handle.write(json.dumps({"page": number, "text": text}, ensure_ascii=False) + "\n")
                if progress and number % 100 == 0:
                    handle.flush()
                    progress({"crop": crop, "status": "extracting", "pages_done": number})
            handle.flush()
            os.fsync(handle.fileno())
        if len(pages) != header["page_count"] or not pages:
            raise ValueError(f"extraction page count mismatch for {source.name}")
        assessment = assess_document(pages, expected_language="ja")
        if not assessment.passes:
            raise ValueError(f"unreadable extraction for {source.name}: {assessment.reason}")
        if _source_header(source) != header:
            raise ValueError(f"source changed during extraction: {source.name}")
        temporary.replace(cache)
        if progress:
            progress({
                "crop": crop, "status": "cached", "pages": len(pages),
                "quality": assessment.to_dict(), "path": str(cache),
            })
        return cache
    finally:
        if temporary is not None:
            temporary.unlink(missing_ok=True)


def _section_starts(source: Path) -> list[tuple[int, str]]:
    from pypdf import PdfReader

    reader = PdfReader(source)
    sections = []
    for entry in reader.outline:
        if isinstance(entry, dict) and entry.get("/Title"):
            page = reader.get_destination_page_number(entry)
            if page is not None and page >= 0:
                sections.append((page + 1, str(entry["/Title"])))
    return sorted(sections, key=lambda section: section[0])


def _prepare_document(*, crop: str, data_dir: Path, knowledge_dir: Path) -> dict[str, Any]:
    from model_informed_greenhouse_dashboard.backend.app.services import knowledge_database as kd
    from model_informed_greenhouse_dashboard.backend.app.services.knowledge_catalog import ASSET_SPECS

    source = data_dir / COMPENDIUM_FILES[crop]
    header = _source_header(source)
    pages = _read_cache(knowledge_dir / "compendium_pages" / f"{crop}.jsonl", header)
    spec = next(spec for spec in ASSET_SPECS if spec["filename"] == source.name)
    sections = _section_starts(source)
    starts = [page for page, _ in sections]
    chunks = []
    for page_number, text in enumerate(pages, start=1):
        section_index = bisect_right(starts, page_number) - 1
        metadata: dict[str, Any] = {"page": page_number}
        if section_index >= 0:
            metadata["section_title"] = sections[section_index][1]
        for chunk in kd._build_text_chunks(text):
            chunks.append({
                "text_content": chunk,
                "source_locator": f"page:{page_number}",
                "metadata": metadata,
            })
    if not chunks:
        raise ValueError(f"no usable chunks in {source.name}")
    return {
        "crop": crop,
        "spec": spec,
        "header": header,
        "chunks": chunks,
        "quality": assess_document(pages, expected_language="ja").to_dict(),
    }


def _replace_document(connection: sqlite3.Connection, *, scope: str, prepared: dict[str, Any]) -> dict[str, Any]:
    from model_informed_greenhouse_dashboard.backend.app.services import knowledge_database as kd

    spec = prepared["spec"]
    documents = connection.execute(
        "SELECT * FROM knowledge_documents WHERE filename = ?", (spec["filename"],),
    ).fetchall()
    if len(documents) != 1:
        raise ValueError(f"expected one registered {spec['filename']} document in {scope}, found {len(documents)}")
    document = documents[0]
    document_id = int(document["document_id"])
    if prepared["crop"] not in json.loads(document["crop_scopes_json"]):
        raise ValueError(f"crop scope mismatch for document {document_id} in {scope}")
    existing = connection.execute(
        "SELECT * FROM knowledge_chunks WHERE document_id = ? ORDER BY ordinal, chunk_id",
        (document_id,),
    ).fetchall()
    chunks = prepared["chunks"]
    topic_major = spec["topic_hints"][0]
    same_chunks = len(existing) == len(chunks) and all(
        old["text_content"] == chunk["text_content"]
        and old["source_locator"] == chunk["source_locator"]
        and old["chunk_type"] == "pdf_paragraph"
        and old["topic_major"] == topic_major
        and old["topic_minor"] == spec["asset_family"]
        and json.loads(old["metadata_json"]) == chunk["metadata"]
        for old, chunk in zip(existing, chunks, strict=True)
    )
    if not same_chunks:
        # Historical advice must continue to refer to the original evidence. Do
        # not delete or silently redirect its references when replacing a source.
        if connection.execute(
            "SELECT 1 FROM sqlite_master WHERE type='table' AND name='advisory_provenance'"
        ).fetchone() and connection.execute(
            "SELECT 1 FROM advisory_provenance WHERE chunk_id IN "
            "(SELECT chunk_id FROM knowledge_chunks WHERE document_id=?) LIMIT 1",
            (document_id,),
        ).fetchone():
            raise ValueError(f"document {document_id} in {scope} has referenced chunks; preserved without replacement")
        if connection.execute(
            "SELECT 1 FROM sqlite_master WHERE type='table' AND name='knowledge_chunks_fts'"
        ).fetchone():
            connection.execute(
                "DELETE FROM knowledge_chunks_fts WHERE chunk_id IN "
                "(SELECT chunk_id FROM knowledge_chunks WHERE document_id=?)", (document_id,),
            )
        connection.execute(
            "DELETE FROM knowledge_entities WHERE chunk_id IN "
            "(SELECT chunk_id FROM knowledge_chunks WHERE document_id=?)", (document_id,),
        )
        connection.execute("DELETE FROM knowledge_chunks WHERE document_id=?", (document_id,))
        for ordinal, chunk in enumerate(chunks, start=1):
            chunk_id = kd._insert_chunk(
                connection,
                document_id=document_id,
                crop_scope=scope,
                chunk_type="pdf_paragraph",
                topic_major=topic_major,
                topic_minor=spec["asset_family"],
                source_locator=chunk["source_locator"],
                ordinal=ordinal,
                text_content=chunk["text_content"],
                metadata=chunk["metadata"],
            )
            kd._insert_entities(connection, chunk_id, [
                ("crop", prepared["crop"]),
                *(("topic", topic) for topic in spec["topic_hints"][:4]),
            ])

    metadata = json.loads(document["metadata_json"])
    metadata["source_context"] = spec["source_context"]
    inspection = json.loads(document["inspection_json"])
    inspection.update({
        "parser_backend": "pdfminer.six",
        "page_count": prepared["header"]["page_count"],
        "extraction_quality": prepared["quality"],
    })
    connection.execute(
        "UPDATE knowledge_documents SET title=?, metadata_json=?, inspection_json=?, "
        "file_size_bytes=?, modified_at=? WHERE document_id=?",
        (
            spec["title"], kd._json_dumps(metadata), kd._json_dumps(inspection),
            prepared["header"]["size"],
            datetime.fromtimestamp(prepared["header"]["mtime_ns"] / 1_000_000_000, UTC).isoformat(),
            document_id,
        ),
    )
    return {
        "scope": scope,
        "crop": prepared["crop"],
        "document_id": document_id,
        "status": "unchanged" if same_chunks else "indexed",
        "old_chunks": len(existing),
        "chunks": len(chunks),
    }


def index_cached_compendia(
    *, crops: list[str], data_dir: Path, knowledge_dir: Path,
) -> list[dict[str, Any]]:
    if not crops or any(crop not in COMPENDIUM_FILES for crop in crops):
        raise ValueError("only tomato and cucumber compendia can be indexed")
    prepared = {
        crop: _prepare_document(crop=crop, data_dir=data_dir, knowledge_dir=knowledge_dir)
        for crop in dict.fromkeys(crops)
    }
    targets = [(crop, [document]) for crop, document in prepared.items()]
    if (knowledge_dir / "knowledge_db_all.sqlite3").is_file():
        targets.append(("all", list(prepared.values())))
    paths = [(scope, knowledge_dir / f"knowledge_db_{scope}.sqlite3", documents)
             for scope, documents in targets]
    for _, path, _ in paths:
        if not path.is_file():
            raise FileNotFoundError(f"existing database required: {path}")

    connections = []
    reports = []
    try:
        # Acquire all selected write locks before changing any source. A busy DB
        # produces a normal SQLite error; this script never stops another process.
        for scope, path, documents in paths:
            connection = sqlite3.connect(path.resolve().as_uri() + "?mode=rw", uri=True, timeout=5.0)
            connections.append(connection)
            connection.row_factory = sqlite3.Row
            connection.execute("PRAGMA foreign_keys=ON")
            connection.execute("BEGIN IMMEDIATE")
        for (scope, _, documents), connection in zip(paths, connections, strict=True):
            for document in documents:
                reports.append(_replace_document(connection, scope=scope, prepared=document))
        for connection in connections:
            connection.commit()
    except Exception:
        for connection in connections:
            connection.rollback()
        raise
    finally:
        for connection in connections:
            connection.close()
    # The caller emits progress only after every write lock has been released.
    return reports


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("action", choices=["extract", "index"])
    parser.add_argument("--crop", choices=["all", *COMPENDIUM_FILES], default="all")
    parser.add_argument("--data-dir", type=Path, default=Path(settings.data_dir))
    parser.add_argument("--knowledge-dir", type=Path, default=Path(settings.knowledge_dir))
    args = parser.parse_args(argv)
    crops = list(COMPENDIUM_FILES) if args.crop == "all" else [args.crop]

    def report(payload: dict[str, Any]) -> None:
        print(json.dumps(payload, ensure_ascii=False), flush=True)

    if args.action == "extract":
        for crop in crops:
            materialize_pages(
                crop=crop, data_dir=args.data_dir, knowledge_dir=args.knowledge_dir, progress=report,
            )
    else:
        for payload in index_cached_compendia(
            crops=crops, data_dir=args.data_dir, knowledge_dir=args.knowledge_dir,
        ):
            report(payload)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
