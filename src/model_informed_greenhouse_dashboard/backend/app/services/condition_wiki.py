"""Cached, condition-preserving views of the edited local field corpus.

No model compilation: source claims, editorial actions and limits travel together.
"""
from __future__ import annotations

from copy import deepcopy
from functools import lru_cache
import json
import os
from pathlib import Path
import re

from .knowledge_database import REPO_ROOT

_TOPICS = {
    "SITUATION-01": r"시들|시든|시듦|처지|wilting|wilt|활착|점적|드리퍼|뿌리|root",
    "SITUATION-02": r"습도|결로|물방울|제습|습배출|rh\b|vpd\b|humid|condens|젖음",
    "SITUATION-03": r"\bec\b|\bph\b|양액|배액|급액|원액|산액|비료|nutrient|fertili|drain",
    "SITUATION-04": r"\brtr\b|\bdli\b|적산광|평균온도|착과|화방|마디|약광|난방|일사|light|temperature",
    "SITUATION-05": r"co[2₂]|이산화탄소|기화기|탄산가스",
    "SITUATION-06": r"회복|조치|효과|여전히|아직도|그대로|악화|인력|작업량|recover|still|effect",
}


def wiki_directory() -> Path:
    return Path(os.getenv("CHAT_WIKI_DIR") or REPO_ROOT / "artifacts/knowledge/field-backbone-20260908")


def corpus_signature() -> tuple:
    paths = [wiki_directory() / name for name in (
        "knowledge-records.filtered.jsonl", "situation-playbooks.filtered.json", "second-pass-summary.json",
    )]
    return tuple((str(p), p.stat().st_mtime_ns, p.stat().st_size) if p.is_file() else (str(p), None, None) for p in paths)


@lru_cache(maxsize=2)
def _compile(signature: tuple) -> tuple:
    paths = [Path(entry[0]) for entry in signature]
    if not all(path.is_file() for path in paths):
        return (), ()
    try:
        summary = json.loads(paths[2].read_text(encoding="utf-8"))
        excluded = set(summary.get("withheld_ids", []))
        records = [json.loads(line) for line in paths[0].read_text(encoding="utf-8").splitlines() if line.strip()]
        records = [r for r in records if r.get("id") not in excluded and r.get("filter_decision") == "rewrite" and r.get("automatic_control_rule") is False]
        playbooks = json.loads(paths[1].read_text(encoding="utf-8"))
    except (OSError, ValueError, TypeError):
        return (), ()
    return tuple(records), tuple(playbooks)


def _applies(record: dict, crop: str) -> bool:
    scope = record.get("crop")
    return crop in scope if isinstance(scope, list) else scope in {crop, "shared"}


def select_condition_wiki(*, query: str, crop: str, limit: int = 3) -> list[dict]:
    records, playbooks = _compile(corpus_signature())
    selected_topics = {key: len(re.findall(pattern, query, re.IGNORECASE)) for key, pattern in _TOPICS.items()}
    selected_topics = {key: score for key, score in selected_topics.items() if score}
    if not selected_topics:
        return []
    limit = max(0, min(limit, 3))
    applicable = {r["id"]: r for r in records if _applies(r, crop)}
    candidates = [p for p in playbooks if p.get("id") in selected_topics and _applies(p, crop)]
    candidates.sort(key=lambda p: selected_topics[p["id"]], reverse=True)
    cards = []
    linked = []
    # One complete decision page; never truncate its branch conditions or watch-outs.
    for page in candidates[:1]:
        refs = [key for key in page.get("evidence_record_ids", []) if key in applicable]
        if not refs:
            continue
        compiled = deepcopy(page)
        compiled["evidence_record_ids"] = refs
        compiled["evidence_scope"] = "Editorial conditional guidance. Branches are alternatives, not current farm observations or demonstrated effects."
        cards.append({"wiki_id": page["id"], "kind": "conditional_playbook", "content": compiled})
        linked.extend(refs)
    # Retain complete edited records including null/contradictory follow-up outcomes.
    def score(record: dict) -> int:
        content = json.dumps(record, ensure_ascii=False)
        return sum(len(re.findall(_TOPICS[key], content, re.IGNORECASE)) * weight for key, weight in selected_topics.items())
    ranked = sorted((applicable[key] for key in dict.fromkeys(linked)), key=score, reverse=True)
    for record in ranked[:max(0, limit - len(cards))]:
        cards.append({"wiki_id": record["id"], "kind": "edited_source_record", "content": deepcopy(record)})
    return cards[:limit]
