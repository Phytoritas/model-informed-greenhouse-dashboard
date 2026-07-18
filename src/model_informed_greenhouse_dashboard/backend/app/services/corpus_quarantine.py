"""Corpus quarantine: documents that must never reach a grower-facing answer.

Quarantine is enforced at the SQL layer inside :mod:`knowledge_database`, on the
shared document-filter clause that every retrieval path (FTS, entity, lexical)
goes through. It is therefore *structurally* impossible for a caller to opt out
by passing different filters — which is the point. A deny-list that depends on
callers remembering to apply it is not a deny-list.

Each entry below records **why** the document is quarantined and **what would
lift it**, because a quarantine with no exit condition is just silent data loss.

Reference: docs/research/20260717-advisor-answer-quality-architecture/
"""

from __future__ import annotations

from typing import Any


#: Asset families that are quarantined wholesale.
#:
#: ``wiki_page`` / ``wiki_case`` — the LLM Wiki feature was removed from ``main``
#: on 2026-07-05 (commit ``f01a242``) because it exposed PII and raw source
#: provenance. The removal deleted the ingest code and ``data/knowledge_wiki/``
#: but **not** the rows already built into ``artifacts/knowledge/*.sqlite3``, so
#: 50 documents / 202 chunks outlived both their code and their governance. They
#: are unreviewable (no source, no ingest, no regeneration path on ``main``), so
#: they must not be retrievable.
#:
#: Exit condition: restore ``data/knowledge_wiki/`` as a PII-scanned,
#: version-controlled source with a regeneration script and an explicit exposure
#: boundary, then remove this entry. Re-enabling retrieval without that
#: governance would re-create the exact failure the 07-05 removal fixed.
QUARANTINED_ASSET_FAMILIES: frozenset[str] = frozenset({"wiki_page", "wiki_case"})

#: Individual source documents that are quarantined, keyed by lowercase filename.
#:
#: The two 農業技術大系 volumes are **Japanese-language books**, not corrupt Korean
#: ones: their fonts declare ``CIDSystemInfo Registry=Adobe / Ordering=Japan1``
#: (a CID collection that contains no Hangul glyphs at all) and the text extracts
#: as ~65% Japanese script with zero Hangul. They are quarantined for two
#: independent reasons, either of which is sufficient:
#:
#: 1. **Agronomic transfer is unverified.** Retrieval judges "relevant to the
#:    question", never "applicable in a 2026 Korean greenhouse". These are books
#:    about Japanese cultivars, Japanese climate, Japanese cropping calendars and
#:    period-specific facilities/materials. In an advisory system the cost of a
#:    confident wrong prescription exceeds the cost of a miss.
#: 2. **Licensing is unresolved.** 農文協 sells 大系 commercially as an
#:    annually-supplemented loose-leaf (加除式) encyclopedia. Berne makes
#:    reproduction *and translation* exclusive rights; Japan's Copyright Act
#:    Art. 30-4 (non-enjoyment data analysis) and Art. 47-5 (book-search
#:    snippets) do not plainly reach advisory RAG that serves the work's content
#:    to users as translated advice.
#:
#: Exit condition: (a) confirm with the publisher/licence that full-text local
#: indexing and serving answers to users are permitted, and (b) have a Korean
#: protected-horticulture consultant whitelist specific passages with Korean
#: annotations. Only then remove entries here — and even then, prefer
#: passage-level whitelisting over lifting the whole document.
QUARANTINED_FILENAMES: frozenset[str] = frozenset(
    {
        "농업기술대계_토마토편.pdf",
        "오이_농업기술대계.pdf",
    }
)


def quarantine_reasons() -> dict[str, str]:
    """Human-readable reasons, for diagnostics and the catalog surface."""
    reasons = {
        family: "ungoverned-orphan: source and ingest removed 2026-07-05 (PII/source exposure)"
        for family in sorted(QUARANTINED_ASSET_FAMILIES)
    }
    reasons.update(
        {
            filename: "japanese-source: agronomic transfer unverified and licence unresolved"
            for filename in sorted(QUARANTINED_FILENAMES)
        }
    )
    return reasons


def quarantine_filter_sql(*, document_alias: str = "kd") -> tuple[str, list[Any]]:
    """Return an AND-able SQL clause excluding every quarantined document.

    The clause is always non-empty so callers cannot accidentally skip it by
    treating an empty string as "nothing to do".
    """
    clauses: list[str] = []
    params: list[Any] = []

    if QUARANTINED_ASSET_FAMILIES:
        families = sorted(QUARANTINED_ASSET_FAMILIES)
        placeholders = ", ".join("?" for _ in families)
        clauses.append(
            f"LOWER(COALESCE({document_alias}.asset_family, '')) NOT IN ({placeholders})"
        )
        params.extend(families)

    if QUARANTINED_FILENAMES:
        filenames = sorted(name.lower() for name in QUARANTINED_FILENAMES)
        placeholders = ", ".join("?" for _ in filenames)
        clauses.append(
            f"LOWER(COALESCE({document_alias}.filename, '')) NOT IN ({placeholders})"
        )
        params.extend(filenames)

    if not clauses:
        return ("1=1", [])
    return (" AND ".join(clauses), params)


def is_quarantined(*, filename: str | None = None, asset_family: str | None = None) -> bool:
    """Whether a document would be excluded from retrieval."""
    if asset_family and asset_family.strip().lower() in QUARANTINED_ASSET_FAMILIES:
        return True
    if filename and filename.strip().lower() in {
        name.lower() for name in QUARANTINED_FILENAMES
    }:
        return True
    return False
