"""Tests for the anonymized LLM Wiki ingest script and the committed snapshot."""

from __future__ import annotations

import hashlib
import importlib.util
import json
import sys
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parents[1]
SNAPSHOT_DIR = REPO_ROOT / "data" / "knowledge_wiki"


def _load_ingest_module():
    path = REPO_ROOT / "scripts" / "ingest_llm_wiki.py"
    spec = importlib.util.spec_from_file_location("ingest_llm_wiki", path)
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module  # let @dataclass resolve its module
    spec.loader.exec_module(module)
    return module


ingest = _load_ingest_module()


def _make_source(tmp_path: Path) -> Path:
    source = tmp_path / "llm_wiki_v2"
    pages = source / "wiki_pages"
    pages.mkdir(parents=True)
    (pages / "001_topic.md").write_text(
        "# 토마토 재배관리\n\n## 요약\n우일팜 하계작 리뷰.\n\n"
        "## Source Trace\n- source_path=10_농가별(ByFarm)/09. 우일팜 자료/x.pptx; locator=slide 1\n"
        "- source_path=10_농가별(ByFarm)/01. 고령/고령 A 농가 데이터/47주차.xlsx; locator=sheet 1\n",
        encoding="utf-8",
    )
    cases = source / "wiki" / "300 Field Cases"
    cases.mkdir(parents=True)
    (cases / "Case Dossier - 1.md").write_text(
        "# 사례\n\nsite: ByFarm\nsourcePaths: 10_농가별(ByFarm)/02. 영천/영천 통합문서.xlsx\n",
        encoding="utf-8",
    )
    return source


def test_ingest_anonymizes_and_is_deterministic(tmp_path: Path) -> None:
    source = _make_source(tmp_path)
    dest_a = tmp_path / "out_a"
    dest_b = tmp_path / "out_b"

    manifest_a = ingest.run(source, dest_a, "2026-07-05T00:00:00Z")
    manifest_b = ingest.run(source, dest_b, "2026-07-05T00:00:00Z")

    page = (dest_a / "pages" / "001_topic.md").read_text(encoding="utf-8")
    # No real farm identifier survives anywhere in the page.
    assert "우일팜" not in page
    assert "농가별(ByFarm)" not in page
    assert "고령 A 농가 데이터" not in page
    assert "Farm-" in page  # farm names are replaced by stable labels

    # Deterministic: same input + timestamp -> identical hashes.
    hashes_a = {f["path"]: f["sha256"] for f in manifest_a["files"]}
    hashes_b = {f["path"]: f["sha256"] for f in manifest_b["files"]}
    assert hashes_a == hashes_b
    assert manifest_a["anonymized"] is True
    assert manifest_a["farm_label_count"] >= 3


def test_ingest_redacts_unmapped_sensitive_token(tmp_path: Path, monkeypatch) -> None:
    source = _make_source(tmp_path)
    # A branded token that never appears in a path cannot be mapped to a farm
    # label, so it must still be scrubbed to the fail-safe redaction label.
    monkeypatch.setattr(ingest, "SENSITIVE_NAME_TOKENS", ("우일팜", "비밀농장"))
    (source / "wiki_pages" / "002_leak.md").write_text(
        "# 유출\n\n비밀농장 방문 기록.\n", encoding="utf-8"
    )
    ingest.run(source, tmp_path / "out", "2026-07-05T00:00:00Z")

    leaked = (tmp_path / "out" / "pages" / "002_leak.md").read_text(encoding="utf-8")
    assert "비밀농장" not in leaked
    assert "Farm-Redacted" in leaked


@pytest.mark.skipif(
    not (SNAPSHOT_DIR / "manifest.json").exists(),
    reason="committed wiki snapshot not present",
)
def test_committed_snapshot_matches_manifest_hashes() -> None:
    manifest = json.loads((SNAPSHOT_DIR / "manifest.json").read_text(encoding="utf-8"))
    assert manifest["anonymized"] is True
    assert manifest["file_count"] == len(manifest["files"])
    for entry in manifest["files"]:
        content = (SNAPSHOT_DIR / entry["path"]).read_text(encoding="utf-8")
        digest = hashlib.sha256(content.encode("utf-8")).hexdigest()
        assert digest == entry["sha256"], f"hash drift in {entry['path']}"


@pytest.mark.skipif(
    not (SNAPSHOT_DIR / "manifest.json").exists(),
    reason="committed wiki snapshot not present",
)
def test_committed_snapshot_has_no_real_farm_identifiers() -> None:
    banned = ("농가별(ByFarm)", "우일팜", "고령 A 농가", "영천 통합", "장수 ", "상주 ")
    for path in SNAPSHOT_DIR.rglob("*.md"):
        text = path.read_text(encoding="utf-8")
        for token in banned:
            assert token not in text, f"{token!r} leaked into {path.name}"
