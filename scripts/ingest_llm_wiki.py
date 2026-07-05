"""Snapshot the consulting LLM Wiki into the repo as an anonymized knowledge source.

Deterministic ingest: reads curated markdown from an ``llm_wiki_v2`` export
(``wiki_pages/`` topic pages plus the vault ``Field Cases`` / ``Decisions &
Protocols`` pages), anonymizes farm identifiers, and writes the snapshot plus a
manifest under ``data/knowledge_wiki/``. No LLM/API calls; the same input tree
and ``--snapshot-at`` always produce byte-identical output.

Anonymization
-------------
1. ByFarm source paths ``10_농가별(ByFarm)/<NN>. <name>[ 자료]/`` are rewritten to
   ``10_ByFarm/Farm-<X>/`` with a stable label assigned by sorted farm name.
2. Proper-noun farm names that also leak into page bodies (e.g. a branded farm
   name) are replaced globally via ``SENSITIVE_NAME_TOKENS``.
3. The writer asserts no original farm token survives in any emitted file.

Usage
-----
    poetry run python scripts/ingest_llm_wiki.py \
        --source "<...>/90_데이터베이스(DB)/llm_wiki_v2" \
        --snapshot-at 2026-07-05T00:00:00Z
"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import sqlite3
import sys
import unicodedata
from dataclasses import dataclass, field
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_DEST = REPO_ROOT / "data" / "knowledge_wiki"

# Vault subfolders (relative to <source>/wiki) that carry field cases and
# decision protocols worth ingesting alongside the curated topic pages.
VAULT_CASE_DIRS = ("300 Field Cases", "500 Decisions & Protocols")

# Farm proper nouns that appear in page *bodies* (not only source paths) and so
# must be scrubbed globally. Path-only geographic identifiers are handled by the
# ByFarm path rewriter instead, to avoid clobbering ordinary place words.
SENSITIVE_NAME_TOKENS = ("우일팜",)

# Personal names of individuals (e.g. a farm owner named on a GAP certificate).
# These are direct PII and are replaced globally with a neutral placeholder.
PERSON_NAME_TOKENS = ("유현성",)

_BYFARM_RE = re.compile(r"10_농가별\(ByFarm\)/(\d+)\.\s*([^/]+?)(?:\s*자료)?/")


@dataclass
class FarmLabeler:
    """Assigns deterministic ``Farm-A``, ``Farm-B`` … labels to farm names."""

    _labels: dict[str, str] = field(default_factory=dict)

    def discover(self, text: str) -> None:
        for _, raw_name in _BYFARM_RE.findall(text):
            self._labels.setdefault(raw_name.strip(), "")

    def finalize(self) -> None:
        for index, name in enumerate(sorted(self._labels)):
            self._labels[name] = f"Farm-{chr(ord('A') + index)}"

    @property
    def mapping(self) -> dict[str, str]:
        return dict(self._labels)

    def rewrite_line(self, line: str) -> str:
        """Anonymize a path-bearing line: top-level segment first, then any farm
        name that leaks into sub-path segments (e.g. ``고령 A 농가 데이터``)."""

        def _sub(match: re.Match[str]) -> str:
            label = self._labels[match.group(2).strip()]
            return f"10_ByFarm/{label}/"

        rewritten = _BYFARM_RE.sub(_sub, line)
        # Longest names first so a name containing another as a prefix wins.
        for name in sorted(self._labels, key=len, reverse=True):
            rewritten = rewritten.replace(name, self._labels[name])
        return rewritten


_PATH_LINE_MARKERS = ("농가별(ByFarm)", "ByFarm", "source_path", "sourcePaths", "site:")

# Secondary redaction: mask re-identification *fingerprints* that survive name
# removal. These describe a specific farm's physical layout, scale, and graded
# performance, so an insider could recognize the farm from them. Agronomy
# metrics that teach method (cm growth, mm stem, % change, ea count, small kg)
# are intentionally kept. Applied to page bodies only, in order.
_REDACTION_RULES: tuple[tuple[re.Pattern[str], str], ...] = (
    # --- Direct PII -------------------------------------------------------
    # Email addresses (any actor).
    (re.compile(r"[\w.+-]+@[\w-]+\.[\w.-]+"), "[이메일]"),
    # Certificate / license numbers, e.g. "제A01088-217336 호".
    (re.compile(r"제[A-Z]?\d{4,}[-\s]?\d*\s*호"), "[증서번호]"),
    # A person's name recorded in a "성 명:" field (covers unlisted names too).
    (re.compile(r"(성\s*명\s*[:：]\s*)[가-힣]{2,4}"), r"\1[성명]"),
    # --- Re-identification fingerprints ----------------------------------
    # Monetary amounts in thousands of KRW (cost/scale fingerprint).
    (re.compile(r"[+\-]?\s?\d{1,3}(?:,\d{3})*\s*천원"), "[금액]천원"),
    # Absolute production/volume in the thousands (farm-scale fingerprint).
    (re.compile(r"[+\-]?\s?\d{1,3},\d{3}\s?kg"), "[생산량]kg"),
    # Farm-specific graded benchmark against an overseas leader.
    (re.compile(r"네덜란드\s*대비\s*\d+\s*%\s*수준"), "해외 선진 대비 [비율] 수준"),
    # Physical zone identifiers (layout fingerprint): "6,7구역", "5구역".
    (re.compile(r"\d+\s*,\s*\d+\s*구역"), "일부 구역"),
    (re.compile(r"\d+\s*구역"), "일부 구역"),
    # Lettered zone labels in production reviews: "A1 생산량", "A2 생산량", "C 생산량".
    (re.compile(r"[A-C]\d?\s*(생산량|대비)"), r"\1"),
)


def redact_fingerprints(text: str) -> str:
    for pattern, replacement in _REDACTION_RULES:
        text = pattern.sub(replacement, text)
    return text


def anonymize(text: str, labeler: FarmLabeler) -> str:
    lines = text.split("\n")
    out: list[str] = []
    for line in lines:
        if any(marker in line for marker in _PATH_LINE_MARKERS):
            out.append(labeler.rewrite_line(line))
        else:
            out.append(line)
    result = "\n".join(out)
    # Branded farm names also leak into page bodies; replace them globally with
    # the same label the path rewriter assigned, so paths and prose stay consistent.
    mapping = labeler.mapping
    for token in sorted(SENSITIVE_NAME_TOKENS, key=len, reverse=True):
        label = mapping.get(token, "Farm-Redacted")
        result = result.replace(token, label)
    # Personal names are direct PII: scrub globally to a neutral placeholder.
    for token in sorted(PERSON_NAME_TOKENS, key=len, reverse=True):
        result = result.replace(token, "[성명]")
    return redact_fingerprints(result)


def find_leaks(text: str, labeler: FarmLabeler) -> list[str]:
    """Return original identifiers that survived anonymization.

    Geographic farm names (고령, 영천 …) are homographs of ordinary words
    (고령 학습자 = elderly learner), so they only count as a leak inside a
    path-bearing line. Branded proper nouns must not survive anywhere.
    """

    leaks: set[str] = set()
    farm_names = sorted(labeler.mapping, key=len, reverse=True)
    for line in text.split("\n"):
        if any(marker in line for marker in _PATH_LINE_MARKERS):
            leaks.update(name for name in farm_names if name in line)
    for token in (*SENSITIVE_NAME_TOKENS, *PERSON_NAME_TOKENS):
        if token in text:
            leaks.add(token)
    return sorted(leaks)


# Sources to exclude entirely (owner consent): their evidence bullets and
# provenance traces are dropped fact-by-fact, and a page left with no evidence
# is removed from the snapshot. Matched against Source Trace source_path values.
EXCLUDED_SOURCE_RE = re.compile(r"우일팜|참고자료/새봄/")


def _bullets(section: str) -> list[str]:
    """Split a markdown section into top-level ``- `` bullets (with continuations)."""

    out: list[str] = []
    current: list[str] = []
    for line in section.split("\n"):
        if line.startswith("- "):
            if current:
                out.append("\n".join(current))
            current = [line]
        elif current:
            current.append(line)
    if current:
        out.append("\n".join(current))
    return out


_EVIDENCE_SECTION_RE = re.compile(
    r"(## Teaching-Ready Evidence\n)(.*?)(?=\n## |\Z)", re.S
)
_TRACE_SECTION_RE = re.compile(r"(## Source Trace\n)(.*?)(?=\n## |\Z)", re.S)


def exclude_sources(text: str) -> str | None:
    """Drop evidence + trace bullets sourced from excluded farms, in place.

    Evidence bullets and Source Trace bullets are 1:1 and ordered, so a trace
    bullet matching ``EXCLUDED_SOURCE_RE`` marks its paired evidence bullet for
    removal. Returns the rewritten page, or ``None`` if no evidence survives
    (the page was entirely sourced from excluded farms)."""

    ev_match = _EVIDENCE_SECTION_RE.search(text)
    tr_match = _TRACE_SECTION_RE.search(text)
    if not ev_match or not tr_match:
        # No pairable sections (e.g. a case dossier is a single case unit):
        # drop the whole file if it is sourced from an excluded farm.
        return None if EXCLUDED_SOURCE_RE.search(text) else text

    evidence = _bullets(ev_match.group(2))
    traces = _bullets(tr_match.group(2))
    if len(evidence) != len(traces) or not evidence:
        return text  # unexpected shape; do not risk mis-pairing

    kept = [
        (ev, tr)
        for ev, tr in zip(evidence, traces)
        if not EXCLUDED_SOURCE_RE.search(tr)
    ]
    if not kept:
        return None  # page had only excluded-farm evidence
    if len(kept) == len(evidence):
        return text  # nothing excluded on this page

    new_ev_body = "\n".join(ev for ev, _ in kept) + "\n"
    new_tr_body = "\n".join(tr for _, tr in kept) + "\n"
    result = _EVIDENCE_SECTION_RE.sub(
        lambda m: m.group(1) + new_ev_body, text, count=1
    )
    result = _TRACE_SECTION_RE.sub(
        lambda m: m.group(1) + new_tr_body, result, count=1
    )
    return result


def _sha256(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def _normalize_newlines(text: str) -> str:
    return text.replace("\r\n", "\n").replace("\r", "\n")


def _collect_inputs(source: Path) -> list[tuple[str, Path]]:
    """Return ``(relative_dest, absolute_source)`` pairs sorted for determinism."""

    inputs: list[tuple[str, Path]] = []

    pages_dir = source / "wiki_pages"
    for path in sorted(pages_dir.glob("*.md")):
        inputs.append((f"pages/{path.name}", path))

    vault = source / "wiki"
    for case_dir in VAULT_CASE_DIRS:
        base = vault / case_dir
        if not base.exists():
            continue
        for path in sorted(base.rglob("*.md")):
            slug = _slugify(case_dir)
            inputs.append((f"cases/{slug}/{path.name}", path))

    return inputs


def _clean_case_title(title: str) -> str:
    """Strip pipeline scaffolding from a dossier title -> a readable heading."""

    text = title.split("dossier:", 1)[-1].strip()
    text = re.sub(r"\s*\([^)]*\)\s*$", "", text).strip()
    return text or title.strip()


def _collect_sqlite_cases(db_path: Path, limit_evidence: int = 8) -> list[tuple[str, str]]:
    """Render teaching-ready case dossiers from the llm_wiki_v2 sqlite export.

    Only cases NOT sourced from excluded farms are included, and each case's
    evidence bullets exclude any excerpt whose source is an excluded farm, so the
    output is 1:1 pairable and drops cleanly through the anonymization pipeline.
    Returns ``(relative_dest, markdown_text)`` pairs sorted by case key."""

    connection = sqlite3.connect(db_path)
    connection.row_factory = sqlite3.Row
    try:
        dossiers = connection.execute(
            """
            SELECT id, case_key, case_title, crop_context, field_situation_ko,
                   problem_ko, management_judgment_ko, learner_takeaway_ko,
                   source_paths_json
            FROM case_dossiers
            WHERE quality_status = 'teaching_ready'
              AND case_readiness_status = 'case_ready'
            ORDER BY case_key
            """
        ).fetchall()

        rendered: list[tuple[str, str]] = []
        for dossier in dossiers:
            source_paths = " ".join(json.loads(dossier["source_paths_json"] or "[]"))
            if EXCLUDED_SOURCE_RE.search(source_paths):
                continue

            evidence = connection.execute(
                """
                SELECT excerpt, source_path, locator FROM case_evidence
                WHERE case_dossier_id = ?
                ORDER BY sort_order
                """,
                (dossier["id"],),
            ).fetchall()
            pairs = [
                (row["excerpt"], row["source_path"], row["locator"])
                for row in evidence
                if row["excerpt"]
                and not EXCLUDED_SOURCE_RE.search(row["source_path"] or "")
            ][:limit_evidence]
            if not pairs:
                continue

            rendered.append(
                (f"cases/dossiers/{dossier['case_key']}.md", _render_case(dossier, pairs))
            )
        return rendered
    finally:
        connection.close()


def _render_case(dossier: sqlite3.Row, pairs: list[tuple[str, str, str]]) -> str:
    title = _clean_case_title(dossier["case_title"] or dossier["case_key"])
    situation = _normalize_newlines(dossier["field_situation_ko"] or "").strip()
    problem = _normalize_newlines(dossier["problem_ko"] or "").strip()
    judgment = _normalize_newlines(dossier["management_judgment_ko"] or "").strip()
    takeaway = _normalize_newlines(dossier["learner_takeaway_ko"] or "").strip()

    ev_lines = "\n".join(f"- {excerpt.strip()}" for excerpt, _, _ in pairs)
    tr_lines = "\n".join(
        f"- source_path={sp}; locator={loc}" for _, sp, loc in pairs
    )
    parts = [f"# {title}", ""]
    if situation:
        parts += ["## 요약", situation, ""]
    if problem:
        parts += ["## 왜 중요한가", problem, ""]
    judgment_body = "\n".join(b for b in (judgment, takeaway) if b)
    if judgment_body:
        parts += ["## 판단과 시사점", judgment_body, ""]
    parts += ["## Teaching-Ready Evidence", ev_lines, ""]
    parts += ["## Source Trace", tr_lines, ""]
    return "\n".join(parts)


def _slugify(value: str) -> str:
    ascii_value = unicodedata.normalize("NFKD", value)
    out: list[str] = []
    for ch in ascii_value:
        if ch.isalnum():
            out.append(ch.lower())
        elif out and out[-1] != "-":
            out.append("-")
    return "".join(out).strip("-") or "case"


def run(source: Path, dest: Path, snapshot_at: str, sqlite_db: Path | None = None) -> dict:
    if not source.exists():
        raise SystemExit(f"source not found: {source}")

    inputs = _collect_inputs(source)
    if not inputs:
        raise SystemExit(f"no markdown inputs found under {source}")

    labeler = FarmLabeler()
    raw_by_dest: dict[str, str] = {}
    for rel_dest, abs_source in inputs:
        raw = _normalize_newlines(abs_source.read_text(encoding="utf-8"))
        raw_by_dest[rel_dest] = raw
        labeler.discover(raw)

    # Optional enrichment: teaching-ready case dossiers from the sqlite export.
    if sqlite_db is not None:
        for rel_dest, text in _collect_sqlite_cases(sqlite_db):
            raw_by_dest[rel_dest] = text
            labeler.discover(text)

    labeler.finalize()

    # Start from a clean snapshot so pages dropped by source exclusion do not
    # linger from a previous run.
    for stale in dest.rglob("*.md"):
        stale.unlink()
    dest.mkdir(parents=True, exist_ok=True)

    files_meta: list[dict] = []
    dropped_pages = 0
    for rel_dest, raw in raw_by_dest.items():
        # Fact-level exclusion runs on raw text (before farm names are relabeled).
        filtered = exclude_sources(raw)
        if filtered is None:
            dropped_pages += 1
            continue
        clean = anonymize(filtered, labeler)
        leaked = find_leaks(clean, labeler)
        if leaked:
            raise SystemExit(
                f"anonymization leak in {rel_dest}: {', '.join(leaked)}"
            )
        out_path = dest / rel_dest
        out_path.parent.mkdir(parents=True, exist_ok=True)
        out_path.write_text(clean, encoding="utf-8", newline="\n")
        files_meta.append(
            {
                "path": rel_dest,
                "sha256": _sha256(clean),
                "char_count": len(clean),
                "section": rel_dest.split("/", 1)[0],
            }
        )

    manifest = {
        "source_label": "consulting-llm-wiki-v2",
        "snapshot_at": snapshot_at,
        "anonymized": True,
        "fingerprint_redaction": True,
        "pii_redaction": True,
        "excluded_sources": ["우일팜", "새봄"],
        "dropped_page_count": dropped_pages,
        "case_dossier_count": sum(
            1 for entry in files_meta if entry["path"].startswith("cases/dossiers/")
        ),
        "farm_label_count": len(labeler.mapping),
        "sensitive_token_count": len(SENSITIVE_NAME_TOKENS),
        "file_count": len(files_meta),
        "files": sorted(files_meta, key=lambda entry: entry["path"]),
    }
    manifest_path = dest / "manifest.json"
    manifest_path.write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
        newline="\n",
    )
    return manifest


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", required=True, type=Path, help="llm_wiki_v2 export dir")
    parser.add_argument("--dest", type=Path, default=DEFAULT_DEST)
    parser.add_argument(
        "--snapshot-at",
        required=True,
        help="ISO-8601 timestamp recorded in the manifest (kept out of code for determinism)",
    )
    parser.add_argument(
        "--sqlite",
        type=Path,
        default=None,
        help="optional llm_wiki_v2.sqlite to enrich with teaching-ready case dossiers",
    )
    args = parser.parse_args(argv)

    manifest = run(args.source, args.dest, args.snapshot_at, sqlite_db=args.sqlite)
    print(
        f"ingested {manifest['file_count']} files "
        f"(dropped {manifest['dropped_page_count']} excluded-source pages), "
        f"{manifest['farm_label_count']} farm labels -> {args.dest}"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
