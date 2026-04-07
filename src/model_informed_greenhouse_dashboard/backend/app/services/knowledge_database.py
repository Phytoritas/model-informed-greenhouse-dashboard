"""SQLite-backed SmartGrow knowledge database."""

from __future__ import annotations

import csv
import logging
import json
import re
import sqlite3
import warnings
from collections import defaultdict
from contextlib import contextmanager
from datetime import UTC, datetime
from pathlib import Path
from typing import Any, Iterable, Mapping

from pypdf import PdfReader

from ..config import settings
from .knowledge_query_router import route_knowledge_query, routed_relevance_bonus
from .workbook_normalization import (
    export_nutrient_reference_rows,
    export_pesticide_reference_rows,
)


DATA_ROOT = Path(settings.data_dir)
REPO_ROOT = DATA_ROOT.parent
KNOWLEDGE_DB_DIR = REPO_ROOT / "artifacts" / "knowledge"
SCHEMA_VERSION = "smartgrow-knowledge-db-v1"
_ALL_SCOPE = "all"
_CSV_ENCODINGS = ("utf-8-sig", "utf-8", "cp949", "euc-kr")
_PDF_CHUNK_CHARS = 1200
_PDF_WARNING_PATTERN = r"Advanced encoding .* not implemented yet"
_PDF_CMAP_LOGGER = "pypdf._cmap"
_QUERY_TOKEN_PATTERN = re.compile(r"[0-9A-Za-z가-힣]+")
_MAX_QUERY_LIMIT = 10

_SCHEMA_STATEMENTS = [
    """
    CREATE TABLE IF NOT EXISTS meta (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS catalog_runs (
        run_id INTEGER PRIMARY KEY AUTOINCREMENT,
        crop_scope TEXT NOT NULL,
        catalog_version TEXT NOT NULL,
        generated_at TEXT NOT NULL,
        asset_count INTEGER NOT NULL,
        pending_parsers_json TEXT NOT NULL,
        normalized_workbook_families_json TEXT NOT NULL,
        persisted_catalog_path TEXT,
        created_at TEXT NOT NULL
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS knowledge_documents (
        document_id INTEGER PRIMARY KEY AUTOINCREMENT,
        crop_scope TEXT NOT NULL,
        asset_id TEXT NOT NULL,
        filename TEXT NOT NULL,
        relative_path TEXT NOT NULL,
        title TEXT NOT NULL,
        crop_scopes_json TEXT NOT NULL,
        asset_family TEXT NOT NULL,
        source_type TEXT NOT NULL,
        readiness TEXT NOT NULL,
        parser_backend TEXT,
        topic_hints_json TEXT NOT NULL,
        stage_hints_json TEXT NOT NULL,
        limitations_json TEXT NOT NULL,
        inspection_json TEXT NOT NULL,
        metadata_json TEXT NOT NULL,
        file_size_bytes INTEGER,
        modified_at TEXT
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS workbook_previews (
        preview_id INTEGER PRIMARY KEY AUTOINCREMENT,
        crop_scope TEXT NOT NULL,
        family TEXT NOT NULL,
        status TEXT NOT NULL,
        workbook TEXT,
        preview_json TEXT NOT NULL,
        source_document_id INTEGER,
        created_at TEXT NOT NULL,
        FOREIGN KEY(source_document_id) REFERENCES knowledge_documents(document_id)
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS knowledge_chunks (
        chunk_id INTEGER PRIMARY KEY AUTOINCREMENT,
        document_id INTEGER NOT NULL,
        crop_scope TEXT NOT NULL,
        chunk_type TEXT NOT NULL,
        topic_major TEXT,
        topic_minor TEXT,
        source_locator TEXT,
        ordinal INTEGER NOT NULL,
        text_content TEXT NOT NULL,
        metadata_json TEXT NOT NULL,
        FOREIGN KEY(document_id) REFERENCES knowledge_documents(document_id)
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS knowledge_entities (
        entity_id INTEGER PRIMARY KEY AUTOINCREMENT,
        chunk_id INTEGER NOT NULL,
        entity_type TEXT NOT NULL,
        entity_value TEXT NOT NULL,
        normalized_value TEXT NOT NULL,
        FOREIGN KEY(chunk_id) REFERENCES knowledge_chunks(chunk_id)
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS greenhouse_measurements (
        measurement_id INTEGER PRIMARY KEY AUTOINCREMENT,
        crop TEXT NOT NULL,
        measured_at TEXT NOT NULL,
        t_air_c REAL,
        par_umol REAL,
        co2_ppm REAL,
        rh_percent REAL,
        wind_speed_ms REAL,
        source_document_id INTEGER NOT NULL,
        source_row INTEGER NOT NULL,
        FOREIGN KEY(source_document_id) REFERENCES knowledge_documents(document_id)
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS greenhouse_control_events (
        event_id INTEGER PRIMARY KEY AUTOINCREMENT,
        crop TEXT,
        event_at TEXT,
        control_domain TEXT NOT NULL,
        setpoint_key TEXT,
        previous_value REAL,
        next_value REAL,
        unit TEXT,
        payload_json TEXT NOT NULL
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS greenhouse_crop_state (
        state_id INTEGER PRIMARY KEY AUTOINCREMENT,
        crop TEXT NOT NULL,
        observed_at TEXT NOT NULL,
        state_kind TEXT NOT NULL,
        state_value TEXT,
        unit TEXT,
        payload_json TEXT NOT NULL
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS greenhouse_crop_work_events (
        work_event_id INTEGER PRIMARY KEY AUTOINCREMENT,
        crop TEXT NOT NULL,
        planned_for TEXT,
        work_category TEXT NOT NULL,
        action_text TEXT NOT NULL,
        status TEXT NOT NULL,
        payload_json TEXT NOT NULL
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS pesticide_products (
        product_id INTEGER PRIMARY KEY AUTOINCREMENT,
        crop_scope TEXT NOT NULL,
        category TEXT NOT NULL,
        product_name TEXT NOT NULL,
        active_ingredient TEXT NOT NULL,
        moa_code_group TEXT,
        registration_status TEXT,
        dilution TEXT,
        cycle_recommendation TEXT,
        mixing_caution TEXT,
        source_sheet TEXT NOT NULL,
        source_row INTEGER NOT NULL,
        source_document_id INTEGER NOT NULL,
        FOREIGN KEY(source_document_id) REFERENCES knowledge_documents(document_id)
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS pesticide_targets (
        target_id INTEGER PRIMARY KEY AUTOINCREMENT,
        crop_scope TEXT NOT NULL,
        target_name TEXT NOT NULL,
        reference_kind TEXT NOT NULL,
        product_name TEXT,
        moa_code_group TEXT,
        source_sheet TEXT NOT NULL,
        source_row INTEGER NOT NULL,
        source_document_id INTEGER NOT NULL,
        FOREIGN KEY(source_document_id) REFERENCES knowledge_documents(document_id)
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS pesticide_rotation_programs (
        rotation_id INTEGER PRIMARY KEY AUTOINCREMENT,
        crop_scope TEXT NOT NULL,
        target_name TEXT NOT NULL,
        rotation_theme TEXT NOT NULL,
        product_name TEXT,
        active_ingredient TEXT,
        moa_code_group TEXT,
        application_point TEXT,
        reason TEXT,
        notes TEXT,
        source_sheet TEXT NOT NULL,
        source_row INTEGER NOT NULL,
        source_document_id INTEGER NOT NULL,
        FOREIGN KEY(source_document_id) REFERENCES knowledge_documents(document_id)
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS nutrient_recipes (
        recipe_id INTEGER PRIMARY KEY AUTOINCREMENT,
        crop TEXT NOT NULL,
        medium TEXT NOT NULL,
        stage TEXT NOT NULL,
        ec_target REAL,
        n_no3 REAL,
        n_nh4 REAL,
        p REAL,
        k REAL,
        ca REAL,
        mg REAL,
        s REAL,
        fe REAL,
        mn REAL,
        zn REAL,
        b REAL,
        cu REAL,
        mo REAL,
        cl_max REAL,
        hco3_max REAL,
        na_max REAL,
        source_sheet TEXT NOT NULL,
        source_row INTEGER NOT NULL,
        source_document_id INTEGER NOT NULL,
        FOREIGN KEY(source_document_id) REFERENCES knowledge_documents(document_id)
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS nutrient_fertilizers (
        fertilizer_id INTEGER PRIMARY KEY AUTOINCREMENT,
        fertilizer_name TEXT NOT NULL,
        formula TEXT NOT NULL,
        molecular_weight REAL,
        tank_assignment TEXT,
        contribution_json TEXT NOT NULL,
        source_sheet TEXT NOT NULL,
        source_row INTEGER NOT NULL,
        source_document_id INTEGER NOT NULL,
        FOREIGN KEY(source_document_id) REFERENCES knowledge_documents(document_id)
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS nutrient_adjustment_rules (
        rule_id INTEGER PRIMARY KEY AUTOINCREMENT,
        crop TEXT,
        medium TEXT,
        stage TEXT,
        rule_kind TEXT NOT NULL,
        analyte TEXT,
        numeric_value REAL,
        payload_json TEXT NOT NULL,
        source_sheet TEXT NOT NULL,
        source_row INTEGER,
        source_document_id INTEGER NOT NULL,
        FOREIGN KEY(source_document_id) REFERENCES knowledge_documents(document_id)
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS advisory_sessions (
        advisory_session_id INTEGER PRIMARY KEY AUTOINCREMENT,
        crop_scope TEXT NOT NULL,
        entrypoint TEXT NOT NULL,
        created_at TEXT NOT NULL,
        context_json TEXT NOT NULL
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS advisory_recommendations (
        recommendation_id INTEGER PRIMARY KEY AUTOINCREMENT,
        advisory_session_id INTEGER NOT NULL,
        advisory_kind TEXT NOT NULL,
        status TEXT NOT NULL,
        summary TEXT,
        payload_json TEXT NOT NULL,
        created_at TEXT NOT NULL,
        FOREIGN KEY(advisory_session_id) REFERENCES advisory_sessions(advisory_session_id)
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS advisory_provenance (
        provenance_id INTEGER PRIMARY KEY AUTOINCREMENT,
        recommendation_id INTEGER NOT NULL,
        document_id INTEGER,
        chunk_id INTEGER,
        rule_type TEXT,
        rule_key TEXT,
        calculator_id TEXT,
        payload_json TEXT NOT NULL,
        FOREIGN KEY(recommendation_id) REFERENCES advisory_recommendations(recommendation_id),
        FOREIGN KEY(document_id) REFERENCES knowledge_documents(document_id),
        FOREIGN KEY(chunk_id) REFERENCES knowledge_chunks(chunk_id)
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS house_profiles (
        house_profile_id INTEGER PRIMARY KEY AUTOINCREMENT,
        house_name TEXT NOT NULL,
        crop_scope TEXT,
        payload_json TEXT NOT NULL,
        created_at TEXT NOT NULL
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS crop_profiles (
        crop_scope TEXT PRIMARY KEY,
        asset_count INTEGER NOT NULL,
        document_count INTEGER NOT NULL,
        workbook_families_json TEXT NOT NULL,
        advisory_surfaces_json TEXT NOT NULL,
        knowledge_context_json TEXT NOT NULL,
        created_at TEXT NOT NULL
    )
    """,
    "CREATE INDEX IF NOT EXISTS idx_documents_scope_source ON knowledge_documents(crop_scope, source_type, asset_family)",
    "CREATE INDEX IF NOT EXISTS idx_chunks_scope_topic ON knowledge_chunks(crop_scope, topic_major, topic_minor)",
    "CREATE INDEX IF NOT EXISTS idx_measurements_crop_time ON greenhouse_measurements(crop, measured_at)",
    "CREATE INDEX IF NOT EXISTS idx_pesticide_targets_lookup ON pesticide_targets(target_name, crop_scope, moa_code_group)",
    "CREATE INDEX IF NOT EXISTS idx_nutrient_recipe_lookup ON nutrient_recipes(crop, medium, stage)",
]


def _json_dumps(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, sort_keys=True)


def _normalize_text(value: Any) -> str:
    return re.sub(r"\s+", " ", str(value or "")).strip()


def _normalize_key(value: str) -> str:
    return re.sub(r"[^0-9a-z가-힣]+", "", _normalize_text(value).lower())


def _safe_float(value: Any) -> float | None:
    text = _normalize_text(value).replace(",", "")
    if not text:
        return None
    try:
        return float(text)
    except ValueError:
        return None


def _split_sentences(text: str) -> list[str]:
    return [chunk.strip() for chunk in re.split(r"(?<=[.!?])\s+", text) if chunk.strip()]


def _build_text_chunks(text: str, max_chars: int = _PDF_CHUNK_CHARS) -> list[str]:
    normalized = re.sub(r"\r\n?", "\n", text).strip()
    if not normalized:
        return []

    paragraphs = [
        _normalize_text(paragraph)
        for paragraph in re.split(r"\n\s*\n+", normalized)
        if _normalize_text(paragraph)
    ]
    if not paragraphs:
        paragraphs = [_normalize_text(normalized)]

    chunks: list[str] = []
    buffer = ""
    for paragraph in paragraphs:
        candidate = paragraph if not buffer else f"{buffer} {paragraph}"
        if len(candidate) <= max_chars:
            buffer = candidate
            continue

        if buffer:
            chunks.append(buffer)
            buffer = ""

        if len(paragraph) <= max_chars:
            buffer = paragraph
            continue

        sentence_buffer = ""
        for sentence in _split_sentences(paragraph):
            sentence_candidate = sentence if not sentence_buffer else f"{sentence_buffer} {sentence}"
            if len(sentence_candidate) <= max_chars:
                sentence_buffer = sentence_candidate
            else:
                if sentence_buffer:
                    chunks.append(sentence_buffer)
                sentence_buffer = sentence
        if sentence_buffer:
            chunks.append(sentence_buffer)

    if buffer:
        chunks.append(buffer)

    return chunks


def _scope_slug(crop_scope: str | None) -> str:
    return crop_scope or _ALL_SCOPE


def _public_path(path: Path | str) -> str:
    candidate = Path(path)
    if not candidate.is_absolute():
        return candidate.as_posix()
    try:
        return candidate.relative_to(REPO_ROOT).as_posix()
    except ValueError:
        return candidate.name


def knowledge_db_path(crop_scope: str | None) -> Path:
    return KNOWLEDGE_DB_DIR / f"knowledge_db_{_scope_slug(crop_scope)}.sqlite3"


def _connect(path: Path) -> sqlite3.Connection:
    connection = sqlite3.connect(path)
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA foreign_keys = ON")
    return connection


def _create_schema(connection: sqlite3.Connection) -> bool:
    for statement in _SCHEMA_STATEMENTS:
        connection.execute(statement)

    try:
        connection.execute(
            """
            CREATE VIRTUAL TABLE IF NOT EXISTS knowledge_chunks_fts
            USING fts5(
                chunk_id UNINDEXED,
                crop_scope,
                topic_major,
                topic_minor,
                text_content
            )
            """
        )
        return True
    except sqlite3.OperationalError:
        return False


def _table_counts(connection: sqlite3.Connection) -> dict[str, int]:
    tables = [
        "catalog_runs",
        "knowledge_documents",
        "workbook_previews",
        "knowledge_chunks",
        "knowledge_entities",
        "greenhouse_measurements",
        "greenhouse_control_events",
        "greenhouse_crop_state",
        "greenhouse_crop_work_events",
        "pesticide_products",
        "pesticide_targets",
        "pesticide_rotation_programs",
        "nutrient_recipes",
        "nutrient_fertilizers",
        "nutrient_adjustment_rules",
        "advisory_sessions",
        "advisory_recommendations",
        "advisory_provenance",
        "house_profiles",
        "crop_profiles",
    ]
    counts: dict[str, int] = {}
    for table in tables:
        counts[table] = int(connection.execute(f"SELECT COUNT(*) FROM {table}").fetchone()[0])
    return counts


def inspect_knowledge_database(crop: str | None = None) -> dict[str, Any]:
    crop_scope = _scope_slug(crop)
    path = knowledge_db_path(crop_scope)
    resolved_scope = crop_scope
    if not path.exists() and crop_scope != _ALL_SCOPE:
        fallback_path = knowledge_db_path(_ALL_SCOPE)
        if fallback_path.exists():
            path = fallback_path
            resolved_scope = _ALL_SCOPE
    if not path.exists():
        return {
            "status": "missing",
            "crop_scope": crop_scope,
            "path": _public_path(path),
            "schema_version": SCHEMA_VERSION,
        }

    with _connect(path) as connection:
        fts_enabled = _create_schema(connection)
        connection.executemany(
            "INSERT OR REPLACE INTO meta(key, value) VALUES (?, ?)",
            [
                ("schema_version", SCHEMA_VERSION),
                ("fts_enabled", "1" if fts_enabled else "0"),
            ],
        )
        counts = _table_counts(connection)
        meta_rows = {
            row["key"]: row["value"]
            for row in connection.execute("SELECT key, value FROM meta")
        }
        last_run = connection.execute(
            """
            SELECT generated_at, persisted_catalog_path
            FROM catalog_runs
            ORDER BY run_id DESC
            LIMIT 1
            """
        ).fetchone()
        fts_enabled = bool(
            connection.execute(
                "SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name = 'knowledge_chunks_fts'"
            ).fetchone()[0]
        )
        chunk_gap_rows = connection.execute(
            """
            SELECT filename
            FROM knowledge_documents
            WHERE source_type = 'pdf'
              AND document_id NOT IN (
                  SELECT DISTINCT document_id FROM knowledge_chunks
              )
            ORDER BY filename
            """
        ).fetchall()

    return {
        "status": "ready",
        "crop_scope": crop_scope,
        "resolved_scope": resolved_scope,
        "path": _public_path(path),
        "schema_version": meta_rows.get("schema_version", SCHEMA_VERSION),
        "fts_enabled": fts_enabled,
        "document_count": counts["knowledge_documents"],
        "chunk_count": counts["knowledge_chunks"],
        "entity_count": counts["knowledge_entities"],
        "table_counts": counts,
        "last_built_at": last_run["generated_at"] if last_run else None,
        "persisted_catalog_path": (
            _public_path(last_run["persisted_catalog_path"])
            if last_run and last_run["persisted_catalog_path"]
            else None
        ),
        "documents_without_chunks": [row["filename"] for row in chunk_gap_rows],
    }


def clamp_knowledge_query_limit(limit: int) -> int:
    return max(1, min(int(limit), _MAX_QUERY_LIMIT))


def _normalize_query_tokens(query: str) -> list[str]:
    tokens: list[str] = []
    seen: set[str] = set()
    for token in _QUERY_TOKEN_PATTERN.findall(_normalize_text(query).lower()):
        if token not in seen:
            tokens.append(token)
            seen.add(token)
    return tokens[:8]


def _document_filter_sql(
    *,
    crop: str | None,
    filters: dict[str, Any] | None,
) -> tuple[str, list[Any]]:
    clauses: list[str] = []
    params: list[Any] = []
    filter_payload = filters or {}

    if crop:
        clauses.append("kd.crop_scopes_json LIKE ?")
        params.append(f'%"{crop}"%')

    source_types = [
        _normalize_text(value).lower()
        for value in filter_payload.get("source_types", [])
        if _normalize_text(value)
    ]
    if source_types:
        placeholders = ", ".join("?" for _ in source_types)
        clauses.append(f"LOWER(kd.source_type) IN ({placeholders})")
        params.extend(source_types)

    asset_families = [
        _normalize_text(value).lower()
        for value in filter_payload.get("asset_families", [])
        if _normalize_text(value)
    ]
    if asset_families:
        placeholders = ", ".join("?" for _ in asset_families)
        clauses.append(f"LOWER(kd.asset_family) IN ({placeholders})")
        params.extend(asset_families)

    topic_major = _normalize_text(filter_payload.get("topic_major"))
    if topic_major:
        clauses.append("LOWER(COALESCE(kc.topic_major, '')) = ?")
        params.append(topic_major.lower())

    topic_minor = _normalize_text(filter_payload.get("topic_minor"))
    if topic_minor:
        clauses.append("LOWER(COALESCE(kc.topic_minor, '')) = ?")
        params.append(topic_minor.lower())

    return (" AND ".join(clauses), params)


def _fts_query_expression(tokens: list[str]) -> str:
    return " OR ".join(f'"{token}"' for token in tokens)


def _fetch_fts_candidates(
    connection: sqlite3.Connection,
    *,
    crop: str | None,
    tokens: list[str],
    filters: dict[str, Any] | None,
    limit: int,
) -> list[sqlite3.Row]:
    if not tokens:
        return []

    where_sql, filter_params = _document_filter_sql(crop=crop, filters=filters)
    query = (
        """
        SELECT
            kc.chunk_id,
            kc.document_id,
            kc.crop_scope,
            kc.chunk_type,
            kc.topic_major,
            kc.topic_minor,
            kc.source_locator,
            kc.ordinal,
            kc.text_content,
            kd.title,
            kd.filename,
            kd.relative_path,
            kd.asset_family,
            kd.source_type,
            kd.crop_scopes_json,
            bm25(knowledge_chunks_fts, 6.0, 2.0, 1.0, 1.0) AS fts_rank
        FROM knowledge_chunks_fts
        JOIN knowledge_chunks AS kc ON kc.chunk_id = knowledge_chunks_fts.chunk_id
        JOIN knowledge_documents AS kd ON kd.document_id = kc.document_id
        WHERE knowledge_chunks_fts MATCH ?
        """
    )
    params: list[Any] = [_fts_query_expression(tokens)]
    if where_sql:
        query += f" AND {where_sql}"
        params.extend(filter_params)
    query += " ORDER BY fts_rank ASC, kc.ordinal ASC LIMIT ?"
    params.append(limit)
    return connection.execute(query, params).fetchall()


def _fetch_entity_hits(
    connection: sqlite3.Connection,
    *,
    crop: str | None,
    tokens: list[str],
    filters: dict[str, Any] | None,
) -> dict[int, int]:
    if not tokens:
        return {}

    where_sql, filter_params = _document_filter_sql(crop=crop, filters=filters)
    placeholders = ", ".join("?" for _ in tokens)
    query = (
        f"""
        SELECT kc.chunk_id, COUNT(*) AS entity_hits
        FROM knowledge_entities AS ke
        JOIN knowledge_chunks AS kc ON kc.chunk_id = ke.chunk_id
        JOIN knowledge_documents AS kd ON kd.document_id = kc.document_id
        WHERE ke.normalized_value IN ({placeholders})
        """
    )
    params: list[Any] = [_normalize_key(token) for token in tokens]
    if where_sql:
        query += f" AND {where_sql}"
        params.extend(filter_params)
    query += " GROUP BY kc.chunk_id"
    return {
        int(row["chunk_id"]): int(row["entity_hits"])
        for row in connection.execute(query, params).fetchall()
    }


def _fetch_lexical_candidates(
    connection: sqlite3.Connection,
    *,
    crop: str | None,
    tokens: list[str],
    query_text: str,
    filters: dict[str, Any] | None,
    limit: int,
) -> list[sqlite3.Row]:
    lexical_terms = tokens or [query_text.lower()]
    lexical_terms = [term for term in lexical_terms if term]
    if not lexical_terms:
        return []

    term_clauses: list[str] = []
    term_params: list[Any] = []
    for term in lexical_terms:
        pattern = f"%{term}%"
        term_clauses.append(
            "("
            "LOWER(kc.text_content) LIKE ? "
            "OR LOWER(kd.title) LIKE ? "
            "OR LOWER(kd.filename) LIKE ? "
            "OR LOWER(COALESCE(kc.topic_major, '')) LIKE ? "
            "OR LOWER(COALESCE(kc.topic_minor, '')) LIKE ?"
            ")"
        )
        term_params.extend([pattern, pattern, pattern, pattern, pattern])

    where_sql, filter_params = _document_filter_sql(crop=crop, filters=filters)
    query = (
        """
        SELECT
            kc.chunk_id,
            kc.document_id,
            kc.crop_scope,
            kc.chunk_type,
            kc.topic_major,
            kc.topic_minor,
            kc.source_locator,
            kc.ordinal,
            kc.text_content,
            kd.title,
            kd.filename,
            kd.relative_path,
            kd.asset_family,
            kd.source_type,
            kd.crop_scopes_json
        FROM knowledge_chunks AS kc
        JOIN knowledge_documents AS kd ON kd.document_id = kc.document_id
        WHERE (
        """
        + " OR ".join(term_clauses)
        + "\n)"
    )
    params: list[Any] = term_params
    if where_sql:
        query += f" AND {where_sql}"
        params.extend(filter_params)
    query += " ORDER BY kc.ordinal ASC LIMIT ?"
    params.append(limit)
    return connection.execute(query, params).fetchall()


def _merge_candidate_rows(*row_groups: Iterable[sqlite3.Row]) -> list[dict[str, Any]]:
    merged: dict[int, dict[str, Any]] = {}
    for source_name, rows in (("fts", row_groups[0]), ("lexical", row_groups[1])):
        for row in rows:
            chunk_id = int(row["chunk_id"])
            row_payload = dict(row)
            row_payload.setdefault("fts_rank", None)
            payload = merged.get(chunk_id)
            if payload is None:
                payload = row_payload
                payload["candidate_sources"] = [source_name]
                merged[chunk_id] = payload
                continue

            if source_name not in payload["candidate_sources"]:
                payload["candidate_sources"].append(source_name)
            if payload.get("fts_rank") is None and row_payload["fts_rank"] is not None:
                payload["fts_rank"] = row_payload["fts_rank"]

    return list(merged.values())


def _result_score(
    *,
    row: Mapping[str, Any],
    query_terms: list[str],
    entity_hits: int,
    query_mode: str,
    route: Mapping[str, Any],
) -> float:
    haystack = " ".join(
        [
            _normalize_text(row["text_content"]).lower(),
            _normalize_text(row["title"]).lower(),
            _normalize_text(row["filename"]).lower(),
            _normalize_text(row["topic_major"]).lower(),
            _normalize_text(row["topic_minor"]).lower(),
        ]
    )
    token_hits = sum(1 for token in query_terms if token.lower() in haystack)
    title_hits = sum(
        1
        for token in query_terms
        if token.lower() in _normalize_text(row["title"]).lower()
    )

    if query_mode == "intent_routed_hybrid":
        fts_rank = float(row["fts_rank"]) if row["fts_rank"] is not None else 20.0
        base = max(2.0, 32.0 - min(fts_rank, 29.0))
        return round(
            base
            + entity_hits * 14.0
            + title_hits * 5.0
            + token_hits * 1.75
            + routed_relevance_bonus(row=row, route=route, haystack=haystack),
            3,
        )

    if query_mode == "fts5_hybrid":
        fts_rank = float(row["fts_rank"]) if row["fts_rank"] is not None else 20.0
        base = max(1.0, 30.0 - min(fts_rank, 29.0))
        return round(base + entity_hits * 14.0 + title_hits * 5.0 + token_hits * 1.5, 3)

    return round(
        entity_hits * 14.0
        + title_hits * 6.0
        + token_hits * 4.0
        + routed_relevance_bonus(row=row, route=route, haystack=haystack),
        3,
    )


def _trim_chunk_text(text: str, max_chars: int = 360) -> str:
    normalized = _normalize_text(text)
    if len(normalized) <= max_chars:
        return normalized
    return normalized[: max_chars - 3].rstrip() + "..."


def query_knowledge_database(
    *,
    crop: str | None = None,
    query: str,
    limit: int = 5,
    filters: dict[str, Any] | None = None,
) -> dict[str, Any]:
    query_text = _normalize_text(query)
    if not query_text:
        raise ValueError("query must not be empty")

    route = route_knowledge_query(query_text, filters)
    applied_filters = route["search_filters"]
    database = inspect_knowledge_database(crop)
    query_limit = clamp_knowledge_query_limit(limit)
    if database.get("status") != "ready":
        return {
            "query_status": "database_missing",
            "crop_scope": crop or _ALL_SCOPE,
            "resolved_scope": database.get("resolved_scope", crop or _ALL_SCOPE),
            "query": query_text,
            "query_mode": "database_missing",
            "limit": query_limit,
            "returned_count": 0,
            "filters": filters or {},
            "applied_filters": applied_filters,
            "routing": {
                "intent": route["intent"],
                "sub_intent": route["sub_intent"],
                "rerank_profile": route["rerank_profile"],
                "expanded_terms": route["expanded_terms"],
            },
            "results": [],
            "database": {
                "status": database.get("status"),
                "path": database.get("path"),
                "fts_enabled": database.get("fts_enabled", False),
                "schema_version": database.get("schema_version", SCHEMA_VERSION),
            },
        }

    query_terms = route["query_terms"] or _normalize_query_tokens(query_text)
    candidate_limit = max(query_limit * 5, 20)
    resolved_scope = database.get("resolved_scope", crop or _ALL_SCOPE)
    actual_db_path = knowledge_db_path(
        None if resolved_scope == _ALL_SCOPE else resolved_scope
    )
    with _connect(actual_db_path) as connection:
        entity_hits = _fetch_entity_hits(
            connection,
            crop=crop,
            tokens=query_terms,
            filters=applied_filters,
        )
        fts_rows: list[sqlite3.Row] = []
        if database.get("fts_enabled"):
            try:
                fts_rows = _fetch_fts_candidates(
                    connection,
                    crop=crop,
                    tokens=query_terms,
                    filters=applied_filters,
                    limit=candidate_limit,
                )
            except sqlite3.OperationalError:
                fts_rows = []

        lexical_rows = _fetch_lexical_candidates(
            connection,
            crop=crop,
            tokens=query_terms,
            query_text=query_text,
            filters=applied_filters,
            limit=candidate_limit,
        )

    candidate_rows = _merge_candidate_rows(fts_rows, lexical_rows)
    query_mode = "intent_routed_hybrid" if fts_rows else "lexical_fallback"

    ranked_rows = sorted(
        candidate_rows,
        key=lambda row: (
            -_result_score(
                row=row,
                query_terms=query_terms,
                entity_hits=entity_hits.get(int(row["chunk_id"]), 0),
                query_mode=query_mode,
                route=route,
            ),
            float(row["fts_rank"])
            if query_mode in {"intent_routed_hybrid", "fts5_hybrid"}
            and row["fts_rank"] is not None
            else 0.0,
            int(row["ordinal"]),
        ),
    )[:query_limit]

    results = [
        {
            "chunk_id": int(row["chunk_id"]),
            "document_id": int(row["document_id"]),
            "source_locator": row["source_locator"],
            "score": _result_score(
                row=row,
                query_terms=query_terms,
                entity_hits=entity_hits.get(int(row["chunk_id"]), 0),
                query_mode=query_mode,
                route=route,
            ),
            "text": _trim_chunk_text(row["text_content"]),
            "chunk_type": row["chunk_type"],
            "topic_major": row["topic_major"],
            "topic_minor": row["topic_minor"],
            "document": {
                "title": row["title"],
                "filename": row["filename"],
                "relative_path": row["relative_path"],
                "asset_family": row["asset_family"],
                "source_type": row["source_type"],
                "crop_scopes": json.loads(row["crop_scopes_json"]),
            },
        }
        for row in ranked_rows
    ]

    return {
        "query_status": "ready",
        "crop_scope": crop or _ALL_SCOPE,
        "resolved_scope": database.get("resolved_scope", crop or _ALL_SCOPE),
        "query": query_text,
        "query_mode": query_mode,
        "limit": query_limit,
        "returned_count": len(results),
        "filters": filters or {},
        "applied_filters": applied_filters,
        "routing": {
            "intent": route["intent"],
            "sub_intent": route["sub_intent"],
            "rerank_profile": route["rerank_profile"],
            "expanded_terms": route["expanded_terms"],
        },
        "results": results,
        "database": {
            "status": database.get("status"),
            "path": database.get("path"),
            "fts_enabled": database.get("fts_enabled", False),
            "schema_version": database.get("schema_version", SCHEMA_VERSION),
        },
    }


def _insert_document(
    connection: sqlite3.Connection,
    crop_scope: str,
    asset: dict[str, Any],
) -> int:
    metadata = {
        "normalization_targets": asset.get("normalization_targets", []),
        "sheet_hints": asset.get("sheet_hints", []),
    }
    cursor = connection.execute(
        """
        INSERT INTO knowledge_documents (
            crop_scope,
            asset_id,
            filename,
            relative_path,
            title,
            crop_scopes_json,
            asset_family,
            source_type,
            readiness,
            parser_backend,
            topic_hints_json,
            stage_hints_json,
            limitations_json,
            inspection_json,
            metadata_json,
            file_size_bytes,
            modified_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            crop_scope,
            asset["id"],
            asset["filename"],
            asset["relative_path"],
            asset["title"],
            _json_dumps(asset.get("crop_scopes", [])),
            asset["asset_family"],
            asset["source_type"],
            asset["readiness"],
            asset.get("inspection", {}).get("parser_backend"),
            _json_dumps(asset.get("topic_hints", [])),
            _json_dumps(asset.get("stage_hints", [])),
            _json_dumps(asset.get("limitations", [])),
            _json_dumps(asset.get("inspection", {})),
            _json_dumps(metadata),
            asset.get("file_size_bytes"),
            asset.get("modified_at"),
        ),
    )
    return int(cursor.lastrowid)


def _insert_chunk(
    connection: sqlite3.Connection,
    *,
    document_id: int,
    crop_scope: str,
    chunk_type: str,
    topic_major: str | None,
    topic_minor: str | None,
    source_locator: str | None,
    ordinal: int,
    text_content: str,
    metadata: dict[str, Any],
) -> int:
    cursor = connection.execute(
        """
        INSERT INTO knowledge_chunks (
            document_id,
            crop_scope,
            chunk_type,
            topic_major,
            topic_minor,
            source_locator,
            ordinal,
            text_content,
            metadata_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            document_id,
            crop_scope,
            chunk_type,
            topic_major,
            topic_minor,
            source_locator,
            ordinal,
            text_content,
            _json_dumps(metadata),
        ),
    )
    chunk_id = int(cursor.lastrowid)
    try:
        connection.execute(
            """
            INSERT INTO knowledge_chunks_fts (
                chunk_id,
                crop_scope,
                topic_major,
                topic_minor,
                text_content
            ) VALUES (?, ?, ?, ?, ?)
            """,
            (chunk_id, crop_scope, topic_major or "", topic_minor or "", text_content),
        )
    except sqlite3.OperationalError:
        pass
    return chunk_id


def _insert_entities(
    connection: sqlite3.Connection,
    chunk_id: int,
    entities: Iterable[tuple[str, str]],
) -> None:
    rows = [
        (chunk_id, entity_type, entity_value, _normalize_key(entity_value))
        for entity_type, entity_value in entities
        if _normalize_text(entity_value)
    ]
    if not rows:
        return
    connection.executemany(
        """
        INSERT INTO knowledge_entities (
            chunk_id,
            entity_type,
            entity_value,
            normalized_value
        ) VALUES (?, ?, ?, ?)
        """,
        rows,
    )


def _open_csv_reader(path: Path):
    last_exc: Exception | None = None
    for encoding in _CSV_ENCODINGS:
        try:
            handle = path.open("r", encoding=encoding, newline="")
            return handle, csv.DictReader(handle), encoding
        except UnicodeDecodeError as exc:
            last_exc = exc
    if last_exc is not None:
        raise last_exc
    raise RuntimeError(f"Failed to open CSV file: {path}")


@contextmanager
def _suppress_pdf_noise():
    cmap_logger = logging.getLogger(_PDF_CMAP_LOGGER)
    original_disabled = cmap_logger.disabled
    with warnings.catch_warnings():
        warnings.filterwarnings("ignore", message=_PDF_WARNING_PATTERN, category=Warning)
        cmap_logger.disabled = True
        try:
            yield
        finally:
            cmap_logger.disabled = original_disabled


def _open_pdf_reader(path: Path) -> PdfReader:
    with _suppress_pdf_noise():
        return PdfReader(str(path))


def _extract_pdf_text(page: Any) -> str:
    with _suppress_pdf_noise():
        return page.extract_text() or ""


def _ingest_telemetry_asset(
    connection: sqlite3.Connection,
    *,
    crop_scope: str,
    document_id: int,
    asset: dict[str, Any],
) -> None:
    path = REPO_ROOT / asset["relative_path"]
    handle, reader, encoding = _open_csv_reader(path)
    daily_stats: dict[str, dict[str, float | int | str | None]] = defaultdict(
        lambda: {
            "count": 0,
            "t_min": None,
            "t_max": None,
            "rh_min": None,
            "rh_max": None,
            "co2_min": None,
            "co2_max": None,
            "par_max": None,
            "start": None,
            "end": None,
        }
    )
    try:
        measurement_rows: list[tuple[Any, ...]] = []
        for source_index, row in enumerate(reader, start=2):
            measured_at = _normalize_text(row.get("datetime"))
            t_air_c = _safe_float(row.get("T_air_C"))
            par_umol = _safe_float(row.get("PAR_umol"))
            co2_ppm = _safe_float(row.get("CO2_ppm"))
            rh_percent = _safe_float(row.get("RH_percent"))
            wind_speed_ms = _safe_float(row.get("wind_speed_ms"))

            measurement_rows.append(
                (
                    crop_scope,
                    measured_at,
                    t_air_c,
                    par_umol,
                    co2_ppm,
                    rh_percent,
                    wind_speed_ms,
                    document_id,
                    source_index,
                )
            )

            day_key = measured_at.split(" ", 1)[0] if measured_at else f"row-{source_index}"
            day = daily_stats[day_key]
            day["count"] = int(day["count"]) + 1
            day["start"] = day["start"] or measured_at
            day["end"] = measured_at or day["end"]
            for key, value in (
                ("t", t_air_c),
                ("rh", rh_percent),
                ("co2", co2_ppm),
            ):
                if value is None:
                    continue
                min_key = f"{key}_min"
                max_key = f"{key}_max"
                day[min_key] = value if day[min_key] is None else min(float(day[min_key]), value)
                day[max_key] = value if day[max_key] is None else max(float(day[max_key]), value)
            if par_umol is not None:
                day["par_max"] = par_umol if day["par_max"] is None else max(float(day["par_max"]), par_umol)

        connection.executemany(
            """
            INSERT INTO greenhouse_measurements (
                crop,
                measured_at,
                t_air_c,
                par_umol,
                co2_ppm,
                rh_percent,
                wind_speed_ms,
                source_document_id,
                source_row
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            measurement_rows,
        )
    finally:
        handle.close()

    for ordinal, (day_key, stats) in enumerate(sorted(daily_stats.items()), start=1):
        text = (
            f"{crop_scope} telemetry on {day_key}: {int(stats['count'])} measurements, "
            f"temperature {stats['t_min']} to {stats['t_max']} C, "
            f"humidity {stats['rh_min']} to {stats['rh_max']} %, "
            f"CO2 {stats['co2_min']} to {stats['co2_max']} ppm, "
            f"PAR max {stats['par_max']} umol."
        )
        chunk_id = _insert_chunk(
            connection,
            document_id=document_id,
            crop_scope=crop_scope,
            chunk_type="telemetry_day_summary",
            topic_major="environment",
            topic_minor="telemetry",
            source_locator=day_key,
            ordinal=ordinal,
            text_content=text,
            metadata={
                "encoding": encoding,
                "time_range": {"start": stats["start"], "end": stats["end"]},
            },
        )
        _insert_entities(
            connection,
            chunk_id,
            (
                ("crop", crop_scope),
                ("date", day_key),
                ("asset_family", "telemetry"),
            ),
        )


def _ingest_pdf_asset(
    connection: sqlite3.Connection,
    *,
    crop_scope: str,
    document_id: int,
    asset: dict[str, Any],
) -> None:
    path = REPO_ROOT / asset["relative_path"]
    reader = _open_pdf_reader(path)
    topic_major = asset.get("topic_hints", [asset["asset_family"]])[0]
    ordinal = 1
    for page_index, page in enumerate(reader.pages, start=1):
        text = _extract_pdf_text(page)
        for chunk in _build_text_chunks(text):
            chunk_id = _insert_chunk(
                connection,
                document_id=document_id,
                crop_scope=crop_scope,
                chunk_type="pdf_paragraph",
                topic_major=topic_major,
                topic_minor=asset["asset_family"],
                source_locator=f"page:{page_index}",
                ordinal=ordinal,
                text_content=chunk,
                metadata={"page": page_index},
            )
            _insert_entities(
                connection,
                chunk_id,
                (
                    ("crop", crop_scope),
                    *(
                        ("topic", hint)
                        for hint in asset.get("topic_hints", [])[:4]
                    ),
                ),
            )
            ordinal += 1


def _ingest_workbook_previews(
    connection: sqlite3.Connection,
    *,
    crop_scope: str,
    payload: dict[str, Any],
    document_ids: dict[str, int],
) -> None:
    for family, preview in payload.get("normalized_previews", {}).items():
        workbook_name = preview.get("workbook")
        source_document_id = document_ids.get(workbook_name) if workbook_name else None
        connection.execute(
            """
            INSERT INTO workbook_previews (
                crop_scope,
                family,
                status,
                workbook,
                preview_json,
                source_document_id,
                created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (
                crop_scope,
                family,
                preview.get("status", "unknown"),
                workbook_name,
                _json_dumps(preview),
                source_document_id,
                datetime.now(UTC).isoformat(),
            ),
        )


def _product_chunk_text(row: dict[str, Any]) -> str:
    targets = ", ".join(row.get("target_names", [])[:6])
    products = ", ".join(row.get("product_names", [])[:6])
    return (
        f"{row.get('crop_scope')} {row.get('category')} product candidates for {targets or 'general protection'}: "
        f"active ingredient {row.get('active_ingredient')}, products {products}, "
        f"MOA {row.get('moa_code_group')}, dilution {row.get('dilution')}, "
        f"rotation slot {row.get('rotation_slot')}, mixing caution {row.get('mixing_caution')}."
    )


def _rotation_chunk_text(row: dict[str, Any]) -> str:
    products = ", ".join(row.get("product_names", [])[:6])
    return (
        f"{row.get('crop_scope')} rotation program for {row.get('target_name')}: "
        f"theme {row.get('rotation_theme')}, products {products}, active ingredient {row.get('active_ingredient')}, "
        f"MOA {row.get('moa_code_group')}, application point {row.get('application_point')}, "
        f"reason {row.get('reason')}."
    )


def _recipe_chunk_text(row: dict[str, Any]) -> str:
    return (
        f"{row.get('crop')} nutrient recipe for {row.get('stage')} on {row.get('medium')}: "
        f"EC target {row.get('ec_target')}, K {row.get('k')}, Ca {row.get('ca')}, Mg {row.get('mg')}, "
        f"Cl guardrail {row.get('cl_max')}, HCO3 guardrail {row.get('hco3_max')}, Na guardrail {row.get('na_max')}."
    )


def _fertilizer_chunk_text(row: dict[str, Any]) -> str:
    return (
        f"Fertilizer {row.get('fertilizer_name')} ({row.get('formula')}) belongs to tank {row.get('tank_assignment')} "
        f"with nutrient contributions {_normalize_text(row.get('nutrient_contribution_per_mol'))}."
    )


def _water_chunk_text(kind: str, row: dict[str, Any]) -> str:
    return (
        f"{kind} reference for analyte {row.get('analyte')}: mmol/L {row.get('mmol_l')}, mg/L {row.get('mg_l')}, "
        f"ppm reference {row.get('ppm_ref')}, EC contribution {row.get('ec_contribution')}."
    )


def _ingest_pesticide_rows(
    connection: sqlite3.Connection,
    *,
    crop_scope: str,
    document_id: int,
) -> None:
    export_crop = None if crop_scope == _ALL_SCOPE else crop_scope
    exported = export_pesticide_reference_rows(export_crop)

    for ordinal, row in enumerate(exported["products"], start=1):
        for product_name in row.get("product_names", []):
            connection.execute(
                """
                INSERT INTO pesticide_products (
                    crop_scope,
                    category,
                    product_name,
                    active_ingredient,
                    moa_code_group,
                    registration_status,
                    dilution,
                    cycle_recommendation,
                    mixing_caution,
                    source_sheet,
                    source_row,
                    source_document_id
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    row.get("crop_scope"),
                    row.get("category"),
                    product_name,
                    row.get("active_ingredient"),
                    row.get("moa_code_group"),
                    row.get("registration_status"),
                    row.get("dilution"),
                    row.get("cycle_recommendation"),
                    row.get("mixing_caution"),
                    row.get("source_sheet"),
                    row.get("source_row"),
                    document_id,
                ),
            )
            for target_name in row.get("target_names", []):
                connection.execute(
                    """
                    INSERT INTO pesticide_targets (
                        crop_scope,
                        target_name,
                        reference_kind,
                        product_name,
                        moa_code_group,
                        source_sheet,
                        source_row,
                        source_document_id
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        row.get("crop_scope"),
                        target_name,
                        "product",
                        product_name,
                        row.get("moa_code_group"),
                        row.get("source_sheet"),
                        row.get("source_row"),
                        document_id,
                    ),
                )

        chunk_id = _insert_chunk(
            connection,
            document_id=document_id,
            crop_scope=crop_scope,
            chunk_type="pesticide_product_row",
            topic_major="disease_pest",
            topic_minor="pesticide_product",
            source_locator=f"{row.get('source_sheet')}:{row.get('source_row')}",
            ordinal=ordinal,
            text_content=_product_chunk_text(row),
            metadata=row,
        )
        _insert_entities(
            connection,
            chunk_id,
            [
                ("crop", row.get("crop_scope", "")),
                ("active_ingredient", row.get("active_ingredient", "")),
                ("moa_code_group", row.get("moa_code_group", "")),
                *[("target_name", value) for value in row.get("target_names", [])],
                *[("product_name", value) for value in row.get("product_names", [])],
            ],
        )

    for ordinal, row in enumerate(exported["rotations"], start=1):
        product_names = row.get("product_names") or [None]
        for product_name in product_names:
            connection.execute(
                """
                INSERT INTO pesticide_rotation_programs (
                    crop_scope,
                    target_name,
                    rotation_theme,
                    product_name,
                    active_ingredient,
                    moa_code_group,
                    application_point,
                    reason,
                    notes,
                    source_sheet,
                    source_row,
                    source_document_id
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    row.get("crop_scope"),
                    row.get("target_name"),
                    row.get("rotation_theme"),
                    product_name,
                    row.get("active_ingredient"),
                    row.get("moa_code_group"),
                    row.get("application_point"),
                    row.get("reason"),
                    row.get("notes"),
                    row.get("source_sheet"),
                    row.get("source_row"),
                    document_id,
                ),
            )
            connection.execute(
                """
                INSERT INTO pesticide_targets (
                    crop_scope,
                    target_name,
                    reference_kind,
                    product_name,
                    moa_code_group,
                    source_sheet,
                    source_row,
                    source_document_id
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    row.get("crop_scope"),
                    row.get("target_name"),
                    "rotation",
                    product_name,
                    row.get("moa_code_group"),
                    row.get("source_sheet"),
                    row.get("source_row"),
                    document_id,
                ),
            )

        chunk_id = _insert_chunk(
            connection,
            document_id=document_id,
            crop_scope=crop_scope,
            chunk_type="pesticide_rotation_row",
            topic_major="disease_pest",
            topic_minor="pesticide_rotation",
            source_locator=f"{row.get('source_sheet')}:{row.get('source_row')}",
            ordinal=ordinal,
            text_content=_rotation_chunk_text(row),
            metadata=row,
        )
        _insert_entities(
            connection,
            chunk_id,
            [
                ("crop", row.get("crop_scope", "")),
                ("target_name", row.get("target_name", "")),
                ("moa_code_group", row.get("moa_code_group", "")),
                *[("product_name", value) for value in row.get("product_names", [])],
            ],
        )

    for ordinal, row in enumerate(exported["moa_reference"], start=1):
        chunk_id = _insert_chunk(
            connection,
            document_id=document_id,
            crop_scope=crop_scope,
            chunk_type="pesticide_moa_reference",
            topic_major="disease_pest",
            topic_minor="moa_reference",
            source_locator=f"{row.get('source_sheet')}:{row.get('source_row')}",
            ordinal=ordinal,
            text_content=(
                f"MOA group {row.get('moa_code_group')} for {row.get('crop_scope')}: representative ingredient "
                f"{row.get('representative_ingredient')}, products {', '.join(row.get('representative_products', [])[:6])}."
            ),
            metadata=row,
        )
        _insert_entities(
            connection,
            chunk_id,
            [
                ("crop", row.get("crop_scope", "")),
                ("moa_code_group", row.get("moa_code_group", "")),
                ("ingredient", row.get("representative_ingredient", "")),
            ],
        )


def _ingest_nutrient_rows(
    connection: sqlite3.Connection,
    *,
    crop_scope: str,
    document_id: int,
) -> None:
    export_crop = None if crop_scope == _ALL_SCOPE else crop_scope
    exported = export_nutrient_reference_rows(export_crop)

    for ordinal, row in enumerate(exported["recipes"], start=1):
        connection.execute(
            """
            INSERT INTO nutrient_recipes (
                crop,
                medium,
                stage,
                ec_target,
                n_no3,
                n_nh4,
                p,
                k,
                ca,
                mg,
                s,
                fe,
                mn,
                zn,
                b,
                cu,
                mo,
                cl_max,
                hco3_max,
                na_max,
                source_sheet,
                source_row,
                source_document_id
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                row.get("crop"),
                row.get("medium"),
                row.get("stage"),
                row.get("ec_target"),
                row.get("n_no3"),
                row.get("n_nh4"),
                row.get("p"),
                row.get("k"),
                row.get("ca"),
                row.get("mg"),
                row.get("s"),
                row.get("fe"),
                row.get("mn"),
                row.get("zn"),
                row.get("b"),
                row.get("cu"),
                row.get("mo"),
                row.get("cl_max"),
                row.get("hco3_max"),
                row.get("na_max"),
                row.get("source_sheet"),
                row.get("source_row"),
                document_id,
            ),
        )
        for analyte_key in ("cl_max", "hco3_max", "na_max"):
            if row.get(analyte_key) is None:
                continue
            connection.execute(
                """
                INSERT INTO nutrient_adjustment_rules (
                    crop,
                    medium,
                    stage,
                    rule_kind,
                    analyte,
                    numeric_value,
                    payload_json,
                    source_sheet,
                    source_row,
                    source_document_id
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    row.get("crop"),
                    row.get("medium"),
                    row.get("stage"),
                    "guardrail_max",
                    analyte_key.replace("_max", "").upper(),
                    row.get(analyte_key),
                    _json_dumps({"recipe_key": row.get("source_key"), "source_note": row.get("source_note")}),
                    row.get("source_sheet"),
                    row.get("source_row"),
                    document_id,
                ),
            )

        chunk_id = _insert_chunk(
            connection,
            document_id=document_id,
            crop_scope=crop_scope,
            chunk_type="nutrient_recipe_row",
            topic_major="nutrient_recipe",
            topic_minor="recipe",
            source_locator=f"{row.get('source_sheet')}:{row.get('source_row')}",
            ordinal=ordinal,
            text_content=_recipe_chunk_text(row),
            metadata=row,
        )
        _insert_entities(
            connection,
            chunk_id,
            [
                ("crop", row.get("crop", "")),
                ("stage", row.get("stage", "")),
                ("medium", row.get("medium", "")),
            ],
        )

    for ordinal, row in enumerate(exported["fertilizers"], start=1):
        connection.execute(
            """
            INSERT INTO nutrient_fertilizers (
                fertilizer_name,
                formula,
                molecular_weight,
                tank_assignment,
                contribution_json,
                source_sheet,
                source_row,
                source_document_id
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                row.get("fertilizer_name"),
                row.get("formula"),
                row.get("molecular_weight"),
                row.get("tank_assignment"),
                _json_dumps(row.get("nutrient_contribution_per_mol", {})),
                row.get("source_sheet"),
                row.get("source_row"),
                document_id,
            ),
        )
        chunk_id = _insert_chunk(
            connection,
            document_id=document_id,
            crop_scope=crop_scope,
            chunk_type="nutrient_fertilizer_row",
            topic_major="nutrient_recipe",
            topic_minor="fertilizer",
            source_locator=f"{row.get('source_sheet')}:{row.get('source_row')}",
            ordinal=ordinal,
            text_content=_fertilizer_chunk_text(row),
            metadata=row,
        )
        _insert_entities(
            connection,
            chunk_id,
            [
                ("fertilizer_name", row.get("fertilizer_name", "")),
                ("formula", row.get("formula", "")),
                ("tank_assignment", row.get("tank_assignment", "")),
            ],
        )

    water_rows = [
        ("source_water_reference", "source_water", exported["source_water"]),
        ("drain_feedback_reference", "drain_water", exported["drain_water"]),
    ]
    for rule_kind, topic_minor, rows in water_rows:
        for ordinal, row in enumerate(rows, start=1):
            connection.execute(
                """
                INSERT INTO nutrient_adjustment_rules (
                    crop,
                    medium,
                    stage,
                    rule_kind,
                    analyte,
                    numeric_value,
                    payload_json,
                    source_sheet,
                    source_row,
                    source_document_id
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    crop_scope if crop_scope != _ALL_SCOPE else None,
                    None,
                    None,
                    rule_kind,
                    row.get("analyte"),
                    row.get("mmol_l"),
                    _json_dumps(row),
                    row.get("source_sheet"),
                    row.get("source_row"),
                    document_id,
                ),
            )
            chunk_id = _insert_chunk(
                connection,
                document_id=document_id,
                crop_scope=crop_scope,
                chunk_type=topic_minor,
                topic_major="drain_feedback" if "drain" in topic_minor else "nutrient_recipe",
                topic_minor=topic_minor,
                source_locator=f"{row.get('source_sheet')}:{row.get('source_row')}",
                ordinal=ordinal,
                text_content=_water_chunk_text(topic_minor, row),
                metadata=row,
            )
            _insert_entities(
                connection,
                chunk_id,
                [
                    ("analyte", row.get("analyte", "")),
                    ("analysis_kind", row.get("analysis_kind", "")),
                ],
            )

    for rule_kind, snapshot in (
        ("calculator_default", exported["calculator_defaults"]),
        ("drain_feedback_default", exported["drain_feedback_defaults"]),
    ):
        connection.execute(
            """
            INSERT INTO nutrient_adjustment_rules (
                crop,
                medium,
                stage,
                rule_kind,
                analyte,
                numeric_value,
                payload_json,
                source_sheet,
                source_row,
                source_document_id
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                snapshot.get("selected_crop"),
                snapshot.get("selected_medium"),
                snapshot.get("selected_stage"),
                rule_kind,
                None,
                snapshot.get("cl_guardrail_mmol_l"),
                _json_dumps(snapshot),
                snapshot.get("sheet_name", ""),
                None,
                document_id,
            ),
        )


def _insert_crop_profile(connection: sqlite3.Connection, payload: dict[str, Any]) -> None:
    crop_scope = _scope_slug(payload.get("crop_scope"))
    assets = payload.get("assets", [])
    knowledge_context = {
        "database_status": payload.get("summary", {}).get("database_status", "ready"),
        "advisory_surface_names": payload.get("summary", {}).get("advisory_surface_names", []),
        "pending_parsers": payload.get("summary", {}).get("pending_parsers", []),
        "normalized_workbook_families": payload.get("summary", {}).get("normalized_workbook_families", []),
    }
    connection.execute(
        """
        INSERT OR REPLACE INTO crop_profiles (
            crop_scope,
            asset_count,
            document_count,
            workbook_families_json,
            advisory_surfaces_json,
            knowledge_context_json,
            created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
        """,
        (
            crop_scope,
            len(assets),
            len(assets),
            _json_dumps(payload.get("summary", {}).get("normalized_workbook_families", [])),
            _json_dumps(payload.get("advisory_surfaces", {})),
            _json_dumps(knowledge_context),
            datetime.now(UTC).isoformat(),
        ),
    )


def rebuild_knowledge_database(payload: dict[str, Any]) -> dict[str, Any]:
    crop_scope = _scope_slug(payload.get("crop_scope"))
    db_path = knowledge_db_path(crop_scope)
    temp_path = db_path.with_suffix(".tmp")

    KNOWLEDGE_DB_DIR.mkdir(parents=True, exist_ok=True)
    if temp_path.exists():
        temp_path.unlink()

    connection = _connect(temp_path)
    try:
        fts_enabled = _create_schema(connection)
        connection.executemany(
            "INSERT OR REPLACE INTO meta(key, value) VALUES (?, ?)",
            [
                ("schema_version", SCHEMA_VERSION),
                ("crop_scope", crop_scope),
                ("generated_at", payload.get("generated_at", datetime.now(UTC).isoformat())),
                ("fts_enabled", "1" if fts_enabled else "0"),
            ],
        )

        connection.execute(
            """
            INSERT INTO catalog_runs (
                crop_scope,
                catalog_version,
                generated_at,
                asset_count,
                pending_parsers_json,
                normalized_workbook_families_json,
                persisted_catalog_path,
                created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                crop_scope,
                payload.get("catalog_version", "unknown"),
                payload.get("generated_at", datetime.now(UTC).isoformat()),
                payload.get("summary", {}).get("asset_count", 0),
                _json_dumps(payload.get("summary", {}).get("pending_parsers", [])),
                _json_dumps(payload.get("summary", {}).get("normalized_workbook_families", [])),
                payload.get("persisted_to"),
                datetime.now(UTC).isoformat(),
            ),
        )

        document_ids: dict[str, int] = {}
        for asset in payload.get("assets", []):
            document_ids[asset["filename"]] = _insert_document(connection, crop_scope, asset)

        _ingest_workbook_previews(
            connection,
            crop_scope=crop_scope,
            payload=payload,
            document_ids=document_ids,
        )
        _insert_crop_profile(connection, payload)

        for asset in payload.get("assets", []):
            document_id = document_ids[asset["filename"]]
            if asset.get("readiness") != "ready":
                continue
            if asset["source_type"] == "csv":
                _ingest_telemetry_asset(
                    connection,
                    crop_scope=crop_scope,
                    document_id=document_id,
                    asset=asset,
                )
            elif asset["source_type"] == "pdf":
                _ingest_pdf_asset(
                    connection,
                    crop_scope=crop_scope,
                    document_id=document_id,
                    asset=asset,
                )

        pesticide_document_id = document_ids.get("농약 솔루션_260326_v1.xlsx")
        pesticide_asset = next(
            (asset for asset in payload.get("assets", []) if asset["filename"] == "농약 솔루션_260326_v1.xlsx"),
            None,
        )
        if pesticide_document_id and pesticide_asset and pesticide_asset.get("readiness") == "ready":
            _ingest_pesticide_rows(
                connection,
                crop_scope=crop_scope,
                document_id=pesticide_document_id,
            )

        nutrient_document_id = document_ids.get("양액처방_계산시트_V2.0.xlsx")
        nutrient_asset = next(
            (asset for asset in payload.get("assets", []) if asset["filename"] == "양액처방_계산시트_V2.0.xlsx"),
            None,
        )
        if nutrient_document_id and nutrient_asset and nutrient_asset.get("readiness") == "ready":
            _ingest_nutrient_rows(
                connection,
                crop_scope=crop_scope,
                document_id=nutrient_document_id,
            )

        connection.commit()
    finally:
        connection.close()

    temp_path.replace(db_path)
    return inspect_knowledge_database(crop_scope)
