"""Keep grower reports separate from questions and model interpretations."""
from __future__ import annotations

import re
from typing import Mapping, Sequence


def build_chat_case_state(*, crop: str, messages: Sequence[Mapping[str, str]]) -> dict:
    # Import locally to keep the retrieval builder usable by older callers.
    from .advisor_context_builder import (
        _explicit_query_crop, _is_contextual_followup, _is_short_observation_reply,
    )

    reports: list[dict] = []
    pending_question = None
    previous_user = ""
    issue = ""
    resolved_crop = crop
    for index, message in enumerate(messages[-64:]):
        content = str(message.get("content") or "").strip()
        if message.get("role") == "assistant":
            # Only the question is a context label, never the assistant's claims.
            match = re.search(r"([^\n.!?。！？]*[?？])\s*$", content)
            pending_question = match.group(1).strip() if match else None
            continue
        if message.get("role", "user") != "user" or not content:
            continue
        named_crop = _explicit_query_crop(content)
        explicit_question = str(message.get("reply_to") or "").strip()
        if explicit_question:
            pending_question = explicit_question
        answer = bool(explicit_question or (pending_question and _is_short_observation_reply(content)))
        continuation = bool(previous_user and _is_contextual_followup(content, previous_user))
        if (named_crop and named_crop != resolved_crop) or not (answer or continuation):
            reports = []
            issue = content
            resolved_crop = named_crop or crop
            pending_question = None
        if named_crop:
            resolved_crop = named_crop
        unknown = bool(re.search(
            r"모르|모름|미확인|못\s*(?:했|함)|확인하지|not\s+(?:sure|yet|checked)|haven't\s+checked|unsure",
            content, re.IGNORECASE,
        ))
        # A mixed reply may report wet substrate while root condition is unknown.
        # Preserve the entire statement for reasoning and retrieval in that case.
        partial_report = bool(re.search(r"젖|건조|말라|확인했|나와|나오|\d|\b(?:wet|dry|measured)\b", content, re.IGNORECASE))
        reports.append({
            "turn": index, "statement": content, "asked_about": pending_question,
            "status": "partly_unknown" if unknown and partial_report else "unknown" if unknown else "grower_report",
        })
        previous_user = content
        pending_question = None
    return {
        "crop": resolved_crop, "issue": issue,
        "reports": reports,
        "unknown_conditions": [r["asked_about"] or r["statement"] for r in reports if r["status"] in {"unknown", "partly_unknown"}],
        "interpretation": "Reports are attributed to the grower, not verified measurements. Questions are labels, not facts. Later corrections supersede earlier reports only for the same condition/time. Advice is not evidence of execution or recovery.",
    }
