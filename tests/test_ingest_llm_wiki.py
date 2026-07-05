"""Tests for the anonymized LLM Wiki ingest script and the committed snapshot."""

from __future__ import annotations

import hashlib
import importlib.util
import json
import re
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
        "## Teaching-Ready Evidence\n"
        "- A2 생산량 리뷰 스위텔(계획대비 24% ↑ - 9,040kg) 경경 1.2mm 착과량 18.9ea\n"
        "- 5구역 대추 생산량 리뷰, 6,7구역 윰, 네덜란드 대비 80% 수준의 효율\n"
        "- 제A01088-217336 호 수료증 대표이사 성 명: 유현성 문의 foodcerti@kfri.re.kr 육묘값 29,486천원\n"
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
    assert manifest_a["fingerprint_redaction"] is True
    assert manifest_a["farm_label_count"] >= 3


def test_ingest_masks_reidentification_fingerprints(tmp_path: Path) -> None:
    source = _make_source(tmp_path)
    dest = tmp_path / "out"
    ingest.run(source, dest, "2026-07-05T00:00:00Z")
    page = (dest / "pages" / "001_topic.md").read_text(encoding="utf-8")

    # Fingerprints (physical zones, absolute scale, graded benchmark) are masked.
    assert "9,040kg" not in page
    assert "[생산량]kg" in page
    assert "5구역" not in page and "6,7구역" not in page
    assert "일부 구역" in page
    assert "A2 생산량" not in page
    assert "네덜란드 대비 80%" not in page
    assert "해외 선진 대비 [비율]" in page

    # Agronomy teaching metrics are preserved.
    assert "경경 1.2mm" in page
    assert "18.9ea" in page
    assert "계획대비 24%" in page


def _page(evidence_and_traces: list[tuple[str, str]]) -> str:
    ev = "\n".join(f"- {e}" for e, _ in evidence_and_traces)
    tr = "\n".join(f"- source_path={t}; locator=x" for _, t in evidence_and_traces)
    return (
        "# 제목\n\n## 요약\n요약 본문\n\n"
        f"## Teaching-Ready Evidence\n{ev}\n\n## Source Trace\n{tr}\n"
    )


def test_exclude_sources_drops_flagged_evidence(tmp_path: Path) -> None:
    # Mixed page: one 우일팜-sourced bullet is dropped, the other survives.
    mixed = _page(
        [
            ("우일팜 하계 리뷰 항목", "10_농가별(ByFarm)/09. 우일팜 자료/x.pptx"),
            ("공통 재배 지식 항목", "30_공통자료(Common)/30_참고자료/농업기술길잡이.pdf"),
        ]
    )
    out = ingest.exclude_sources(mixed)
    assert out is not None
    assert "공통 재배 지식 항목" in out
    assert "우일팜 하계 리뷰 항목" not in out
    assert "우일팜" not in out

    # Page sourced entirely from excluded farms -> dropped.
    only_excluded = _page(
        [
            ("우일팜 항목1", "10_농가별(ByFarm)/09. 우일팜 자료/a.pptx"),
            ("새봄 항목2", "30_공통자료(Common)/30_참고자료/새봄/b.pptx"),
        ]
    )
    assert ingest.exclude_sources(only_excluded) is None

    # A case dossier (no Evidence/Trace sections) sourced from 우일팜 -> dropped.
    case = "# 사례\n\nsourcePaths: 10_농가별(ByFarm)/09. 우일팜 자료/교육자료/x.pptx\n"
    assert ingest.exclude_sources(case) is None
    # A case from a non-excluded farm is kept.
    other_case = "# 사례\n\nsourcePaths: 10_농가별(ByFarm)/02. 영천/x.xlsx\n"
    assert ingest.exclude_sources(other_case) == other_case


def test_ingest_manifest_records_exclusion(tmp_path: Path) -> None:
    source = tmp_path / "llm_wiki_v2"
    pages = source / "wiki_pages"
    pages.mkdir(parents=True)
    (pages / "keep.md").write_text(
        _page([("공통 지식", "30_공통자료(Common)/x.pdf")]), encoding="utf-8"
    )
    (pages / "drop.md").write_text(
        _page([("우일팜 전용", "10_농가별(ByFarm)/09. 우일팜 자료/x.pptx")]),
        encoding="utf-8",
    )
    manifest = ingest.run(source, tmp_path / "out", "2026-07-05T00:00:00Z")

    assert manifest["excluded_sources"] == ["우일팜", "새봄"]
    assert manifest["dropped_page_count"] == 1
    assert manifest["file_count"] == 1
    assert not (tmp_path / "out" / "pages" / "drop.md").exists()
    assert (tmp_path / "out" / "pages" / "keep.md").exists()


def test_ingest_masks_personal_information(tmp_path: Path) -> None:
    source = _make_source(tmp_path)
    dest = tmp_path / "out"
    ingest.run(source, dest, "2026-07-05T00:00:00Z")
    page = (dest / "pages" / "001_topic.md").read_text(encoding="utf-8")

    assert "유현성" not in page
    assert "성 명: [성명]" in page
    assert "제A01088-217336 호" not in page
    assert "[증서번호]" in page
    assert "foodcerti@kfri.re.kr" not in page
    assert "[이메일]" in page
    assert "29,486천원" not in page
    assert "[금액]천원" in page


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
    banned = (
        "농가별(ByFarm)",
        "우일팜",
        "새봄",
        "고령 A 농가",
        "영천 통합",
        "장수 ",
        "상주 ",
    )
    for path in SNAPSHOT_DIR.rglob("*.md"):
        text = path.read_text(encoding="utf-8")
        for token in banned:
            assert token not in text, f"{token!r} leaked into {path.name}"


@pytest.mark.skipif(
    not (SNAPSHOT_DIR / "manifest.json").exists(),
    reason="committed wiki snapshot not present",
)
def test_committed_snapshot_has_no_reidentification_fingerprints() -> None:
    fingerprints = (
        re.compile(r"\d{1,3},\d{3}\s?kg"),  # absolute thousand-scale production
        re.compile(r"\d{1,3},\d{3}\s*천원"),  # thousand-scale monetary amount
        re.compile(r"\d+\s*구역"),  # physical zone id
        re.compile(r"[A-C]\d?\s*생산량"),  # lettered zone production label
        re.compile(r"네덜란드\s*대비\s*\d+\s*%"),  # graded farm benchmark
        re.compile(r"성\s*명\s*[:：]\s*[가-힣]{2,4}"),  # personal name field
        re.compile(r"제[A-Z]?\d{4,}[-\s]?\d*\s*호"),  # certificate number
        re.compile(r"[\w.+-]+@[\w-]+\.[\w.-]+"),  # email address
    )
    for path in SNAPSHOT_DIR.rglob("*.md"):
        text = path.read_text(encoding="utf-8")
        for pattern in fingerprints:
            match = pattern.search(text)
            assert match is None, f"{pattern.pattern!r} matched {match!r} in {path.name}"
