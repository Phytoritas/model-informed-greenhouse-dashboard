"""Golden-query retrieval evaluation for the SmartGrow knowledge base.

Runs a fixed set of grower questions against the live knowledge database and
reports, per query, whether a curated LLM Wiki section reaches the top results.
Intended to quantify the wiki ingest: run once before ingest (no wiki docs) and
once after, and compare ``wiki_top1`` / ``wiki_topk`` rates.

    poetry run python scripts/eval_knowledge_golden.py
    poetry run python scripts/eval_knowledge_golden.py --json out/knowledge_eval.json
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path

from model_informed_greenhouse_dashboard.backend.app.services.knowledge_catalog import (
    rebuild_knowledge_catalog,
)
from model_informed_greenhouse_dashboard.backend.app.services.knowledge_database import (
    query_knowledge_database,
)

GOLDEN_QUERIES: list[dict[str, str]] = [
    {"crop": "tomato", "query": "토마토 곁순 제거 절차와 시점"},
    {"crop": "tomato", "query": "토마토 화방과 착과 판단 기준"},
    {"crop": "tomato", "query": "토마토 적엽과 유인 관리"},
    {"crop": "tomato", "query": "토마토 생리장해와 환경관리"},
    {"crop": "tomato", "query": "약광기 착과량 조절과 누적광량"},
    {"crop": "tomato", "query": "토마토 수확 선별 저장 출하"},
    {"crop": "tomato", "query": "정식 후 활착 관리 포인트"},
    {"crop": "tomato", "query": "pH와 EC 해석과 기비 추비 판단"},
    {"crop": "cucumber", "query": "오이 유인망과 줄기 유인 방법"},
    {"crop": "cucumber", "query": "오이 마디와 곁가지 관리"},
    {"crop": "cucumber", "query": "오이 잎 정리와 통풍 관리"},
    {"crop": "cucumber", "query": "오이 수확 품질 기준"},
    {"crop": "cucumber", "query": "오이 재배관리 핵심"},
    {"crop": "cucumber", "query": "관수 시점 판단과 배액 읽기"},
    {"crop": "cucumber", "query": "과습과 건조 신호 진단"},
    {"crop": "cucumber", "query": "좋은 모종 고르기와 정식 전 준비"},
]


def _is_wiki(result: dict) -> bool:
    return str(result["document"]["asset_family"]).startswith("wiki")


def evaluate(limit: int = 5) -> dict:
    rows: list[dict] = []
    for item in GOLDEN_QUERIES:
        payload = query_knowledge_database(
            crop=item["crop"], query=item["query"], limit=limit
        )
        results = payload.get("results", [])
        wiki_ranks = [i + 1 for i, r in enumerate(results) if _is_wiki(r)]
        rows.append(
            {
                "crop": item["crop"],
                "query": item["query"],
                "intent": payload["routing"]["intent"],
                "returned": payload["returned_count"],
                "wiki_top1": bool(wiki_ranks and wiki_ranks[0] == 1),
                "wiki_topk": bool(wiki_ranks),
                "top_title": results[0]["document"]["title"] if results else None,
            }
        )

    total = len(rows)
    summary = {
        "query_count": total,
        "wiki_top1_rate": round(sum(r["wiki_top1"] for r in rows) / total, 3),
        "wiki_topk_rate": round(sum(r["wiki_topk"] for r in rows) / total, 3),
    }
    return {"summary": summary, "rows": rows}


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--limit", type=int, default=5)
    parser.add_argument("--json", type=Path, default=None, help="write full report to this path")
    parser.add_argument("--no-rebuild", action="store_true", help="skip catalog rebuild")
    args = parser.parse_args(argv)

    if not args.no_rebuild:
        for crop in ("tomato", "cucumber"):
            rebuild_knowledge_catalog(crop)

    report = evaluate(args.limit)
    summary = report["summary"]
    print(
        f"queries={summary['query_count']} "
        f"wiki_top1={summary['wiki_top1_rate']:.0%} "
        f"wiki_topk={summary['wiki_topk_rate']:.0%}"
    )
    for row in report["rows"]:
        flag = "T1" if row["wiki_top1"] else ("Tk" if row["wiki_topk"] else "--")
        print(f"  [{flag}] {row['crop']:8} {row['query'][:34]:34} -> {row['top_title']}")

    if args.json:
        args.json.parent.mkdir(parents=True, exist_ok=True)
        args.json.write_text(
            json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
        )
        print(f"wrote {args.json}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
