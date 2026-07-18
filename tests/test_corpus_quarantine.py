"""Corpus quarantine must be structurally impossible for a caller to bypass."""

from __future__ import annotations

import sqlite3

from model_informed_greenhouse_dashboard.backend.app.services import knowledge_database
from model_informed_greenhouse_dashboard.backend.app.services.corpus_quarantine import (
    QUARANTINED_ASSET_FAMILIES,
    QUARANTINED_FILENAMES,
    is_quarantined,
    quarantine_filter_sql,
    quarantine_reasons,
)


def test_orphaned_wiki_families_are_quarantined() -> None:
    # The LLM Wiki was removed from main on 2026-07-05 for PII/source exposure,
    # but its rows outlived the ingest code in already-built indexes.
    assert is_quarantined(asset_family="wiki_page")
    assert is_quarantined(asset_family="wiki_case")
    assert is_quarantined(asset_family="WIKI_PAGE")
    assert not is_quarantined(asset_family="manual")


def test_japanese_compendia_are_quarantined() -> None:
    # 農業技術大系: Japanese-language books; agronomic transfer unverified and
    # the 農文協 licence is unresolved.
    assert is_quarantined(filename="농업기술대계_토마토편.pdf")
    assert is_quarantined(filename="오이_농업기술대계.pdf")
    assert not is_quarantined(filename="농업기술길잡이-토마토.PDF")


def test_every_quarantine_entry_states_a_reason() -> None:
    reasons = quarantine_reasons()
    for entry in (*QUARANTINED_ASSET_FAMILIES, *QUARANTINED_FILENAMES):
        assert reasons.get(entry), f"quarantined without a stated reason: {entry}"


def test_quarantine_clause_is_never_empty() -> None:
    # An empty clause would be silently treated as "nothing to exclude".
    sql, params = quarantine_filter_sql()
    assert sql.strip()
    assert "NOT IN" in sql
    assert params


def test_document_filter_always_carries_the_quarantine_clause() -> None:
    """The guarantee: no caller-supplied filter can opt out of quarantine."""
    for crop, filters in (
        (None, None),
        (None, {}),
        ("tomato", None),
        ("tomato", {"source_types": ["pdf", "markdown"]}),
        # A caller explicitly asking for quarantined content still must not get it.
        ("tomato", {"asset_families": ["wiki_page"]}),
        ("cucumber", {"asset_families": ["wiki_case"], "source_types": ["markdown"]}),
    ):
        where_sql, params = knowledge_database._document_filter_sql(crop=crop, filters=filters)
        assert "asset_family" in where_sql and "NOT IN" in where_sql, (
            f"quarantine clause missing for crop={crop!r} filters={filters!r}"
        )
        for family in QUARANTINED_ASSET_FAMILIES:
            assert family in params
        for filename in QUARANTINED_FILENAMES:
            assert filename.lower() in params


def test_quarantine_clause_actually_excludes_rows_in_sqlite() -> None:
    """Execute the real clause against a real SQLite table."""
    connection = sqlite3.connect(":memory:")
    connection.execute(
        "CREATE TABLE kd (document_id INTEGER, asset_family TEXT, filename TEXT)"
    )
    connection.executemany(
        "INSERT INTO kd VALUES (?, ?, ?)",
        [
            (1, "manual", "농업기술길잡이-토마토.PDF"),
            (2, "wiki_page", "001_작물기초.md"),
            (3, "wiki_case", "case_001.md"),
            (4, "manual", "농업기술대계_토마토편.pdf"),
            (5, "manual", "오이_농업기술대계.pdf"),
            (6, "pesticide_workbook", "농약 솔루션_260326_v1.xlsx"),
        ],
    )
    where_sql, params = quarantine_filter_sql(document_alias="kd")
    rows = connection.execute(
        f"SELECT document_id FROM kd WHERE {where_sql} ORDER BY document_id", params
    ).fetchall()
    connection.close()

    assert [row[0] for row in rows] == [1, 6], "quarantined documents leaked into results"


def _pages_from_text(text: str) -> list[str]:
    return [text]


def test_quality_gate_passes_korean_prose() -> None:
    from model_informed_greenhouse_dashboard.backend.app.services.pdf_quality import (
        assess_document,
    )

    korean = "토마토 생육 관리와 환경 제어에 관한 실제 한국어 본문 문장입니다. " * 5
    result = assess_document(_pages_from_text(korean), expected_language="ko")
    assert result.passes
    assert result.hangul_share > 0.20


def test_quality_gate_fails_japanese_text_for_a_korean_document() -> None:
    """The compendia's recovered text is Japanese; a ko-expected doc must fail on it."""
    from model_informed_greenhouse_dashboard.backend.app.services.pdf_quality import (
        assess_document,
    )

    japanese = "果重は地温が高めで気温が組合わせのとき最もすぐれている。生理障害の防止策。" * 5
    result = assess_document(_pages_from_text(japanese), expected_language="ko")
    assert not result.passes
    assert result.hangul_share == 0.0
    assert "Hangul share" in result.reason


def test_quality_gate_ignores_language_for_structured_documents() -> None:
    from model_informed_greenhouse_dashboard.backend.app.services.pdf_quality import (
        assess_document,
    )

    latin = "product active_ingredient FRAC group registration status " * 5
    result = assess_document(_pages_from_text(latin), expected_language="any")
    assert result.passes


def test_quality_gate_flags_junk_characters() -> None:
    from model_informed_greenhouse_dashboard.backend.app.services.pdf_quality import (
        assess_document,
    )

    junk = "����� 토마토 �����" * 20
    result = assess_document(_pages_from_text(junk), expected_language="ko")
    assert not result.passes
    assert "junk" in result.reason
