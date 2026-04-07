"""Bounded retrieval-context builders for SmartGrow advisor surfaces."""

from __future__ import annotations

from typing import Any, Mapping, Sequence

from .knowledge_database import query_knowledge_database


_MAX_CHAT_RESULTS = 3
_MAX_SUMMARY_RESULTS = 2
_MAX_SUMMARY_QUERIES = 3
_MAX_EXCERPT_CHARS = 240
_TAB_DOMAIN_MAP = {
    "environment": ("environment_control",),
    "physiology": ("crop_physiology",),
    "work": ("cultivation_work",),
    "harvest_market": ("harvest_market",),
}
_SUMMARY_QUERY_TEMPLATES = {
    "environment_control": "{crop} greenhouse environment control temperature humidity vpd co2 steering",
    "crop_physiology": "{crop} crop physiology balance transpiration photosynthesis canopy growth",
    "cultivation_work": "{crop} cultivation work checklist pruning training harvest workflow",
    "harvest_market": "{crop} harvest market shipment strategy yield quality timing",
}


def _last_user_message(messages: Sequence[Mapping[str, str]]) -> str | None:
    for message in reversed(messages):
        role = (message.get("role") or "user").strip().lower()
        if role != "user":
            continue
        content = (message.get("content") or "").strip()
        if content:
            return content
    return None


def _trim_excerpt(text: str, limit: int = _MAX_EXCERPT_CHARS) -> str:
    normalized = " ".join((text or "").split())
    if len(normalized) <= limit:
        return normalized
    return f"{normalized[: limit - 3].rstrip()}..."


def _compact_result_card(result: Mapping[str, Any]) -> dict[str, Any]:
    return {
        "topic_major": result.get("topic_major"),
        "topic_minor": result.get("topic_minor"),
        "chunk_type": result.get("chunk_type"),
        "evidence_excerpt": _trim_excerpt(str(result.get("text") or "")),
    }


def _retrieval_unavailable_context(
    *,
    mode: str,
    queries: Sequence[str],
) -> dict[str, Any]:
    return {
        "status": "retrieval_unavailable",
        "summary": {
            "status": "retrieval_unavailable",
            "mode": mode,
            "query_count": len(queries),
            "returned_count": 0,
            "intent": None,
            "sub_intent": None,
            "query_mode": "retrieval_unavailable",
        },
        "llm_context": None,
        "internal_provenance": {
            "knowledge_queries": [
                {
                    "query": query,
                    "query_status": "retrieval_unavailable",
                    "query_mode": "retrieval_unavailable",
                    "routing": {},
                    "applied_filters": {},
                    "result_refs": [],
                }
                for query in queries
            ],
            "document_ids": [],
            "chunk_ids": [],
            "confidence_source": ["retrieval_unavailable"],
        },
    }


def _run_bounded_knowledge_query(
    *,
    crop: str,
    query: str,
    limit: int,
) -> dict[str, Any]:
    try:
        return query_knowledge_database(
            crop=crop,
            query=query,
            limit=limit,
        )
    except Exception:
        return {
            "query_status": "retrieval_unavailable",
            "query": query,
            "query_mode": "retrieval_unavailable",
            "applied_filters": {},
            "routing": {},
            "results": [],
        }


def build_chat_advisor_context(
    *,
    crop: str,
    messages: Sequence[Mapping[str, str]],
    limit: int = _MAX_CHAT_RESULTS,
) -> dict[str, Any]:
    user_query = _last_user_message(messages)
    query_limit = max(1, min(int(limit), _MAX_CHAT_RESULTS))
    empty_provenance = {
        "knowledge_queries": [],
        "document_ids": [],
        "chunk_ids": [],
        "confidence_source": ["not_requested"],
    }

    if not user_query:
        return {
            "status": "skipped",
            "summary": {
                "status": "skipped",
                "mode": "chat_first",
                "query_count": 0,
                "returned_count": 0,
                "intent": None,
                "sub_intent": None,
            },
            "llm_context": None,
            "internal_provenance": empty_provenance,
        }

    payload = _run_bounded_knowledge_query(
        crop=crop,
        query=user_query,
        limit=query_limit,
    )
    if payload.get("query_status") == "retrieval_unavailable":
        return _retrieval_unavailable_context(mode="chat_first", queries=[user_query])

    results = payload.get("results", [])
    query_status = payload.get("query_status", "unknown")
    status = "ready" if results else "no_matches"
    if query_status == "database_missing":
        status = "database_missing"

    routing = payload.get("routing", {})
    evidence_cards = [_compact_result_card(result) for result in results]
    document_ids = sorted({int(result["document_id"]) for result in results})
    chunk_ids = sorted({int(result["chunk_id"]) for result in results})
    focus_topics = sorted(
        {
            topic
            for result in results
            for topic in (result.get("topic_major"), result.get("topic_minor"))
            if topic
        }
    )

    return {
        "status": status,
        "summary": {
            "status": status,
            "mode": "chat_first",
            "query_count": 1,
            "returned_count": len(results),
            "intent": routing.get("intent"),
            "sub_intent": routing.get("sub_intent"),
            "query_mode": payload.get("query_mode"),
        },
        "llm_context": {
            "status": status,
            "mode": "chat_first",
            "user_query": payload.get("query", user_query),
            "focus_topics": focus_topics,
            "evidence_cards": evidence_cards,
        },
        "internal_provenance": {
            "knowledge_queries": [
                {
                    "query": payload.get("query", user_query),
                    "query_status": query_status,
                    "query_mode": payload.get("query_mode"),
                    "routing": routing,
                    "applied_filters": payload.get("applied_filters", {}),
                    "result_refs": [
                        {
                            "document_id": int(result["document_id"]),
                            "chunk_id": int(result["chunk_id"]),
                        }
                        for result in results
                    ],
                }
            ],
            "document_ids": document_ids,
            "chunk_ids": chunk_ids,
            "confidence_source": [payload.get("query_mode", query_status)],
        },
    }


def build_summary_advisor_context(
    *,
    crop: str,
    domains: Sequence[str],
) -> dict[str, Any]:
    supported_domains = [
        domain
        for domain in domains
        if domain in _SUMMARY_QUERY_TEMPLATES
    ][: _MAX_SUMMARY_QUERIES]

    empty_provenance = {
        "knowledge_queries": [],
        "document_ids": [],
        "chunk_ids": [],
        "confidence_source": ["not_requested"],
    }
    if not supported_domains:
        return {
            "status": "skipped",
            "summary": {
                "status": "skipped",
                "mode": "summary_seeded",
                "query_count": 0,
                "returned_count": 0,
                "focus_domains": [],
            },
            "llm_context": None,
            "internal_provenance": empty_provenance,
        }

    queries = [
        _SUMMARY_QUERY_TEMPLATES[domain].format(crop=crop)
        for domain in supported_domains
    ]
    payloads = [
        _run_bounded_knowledge_query(
            crop=crop,
            query=query,
            limit=_MAX_SUMMARY_RESULTS,
        )
        for query in queries
    ]
    if any(payload.get("query_status") == "retrieval_unavailable" for payload in payloads):
        return _retrieval_unavailable_context(mode="summary_seeded", queries=queries)

    evidence_cards: list[dict[str, Any]] = []
    knowledge_queries: list[dict[str, Any]] = []
    document_ids: set[int] = set()
    chunk_ids: set[int] = set()
    all_focus_topics: set[str] = set()
    returned_count = 0
    all_database_missing = True

    for domain, query, payload in zip(supported_domains, queries, payloads, strict=False):
        results = payload.get("results", [])
        query_status = payload.get("query_status", "unknown")
        if query_status != "database_missing":
            all_database_missing = False
        returned_count += len(results)
        routing = payload.get("routing", {})
        knowledge_queries.append(
            {
                "query": payload.get("query", query),
                "query_status": query_status,
                "query_mode": payload.get("query_mode"),
                "routing": routing,
                "applied_filters": payload.get("applied_filters", {}),
                "result_refs": [
                    {
                        "document_id": int(result["document_id"]),
                        "chunk_id": int(result["chunk_id"]),
                    }
                    for result in results
                ],
            }
        )
        for result in results:
            document_ids.add(int(result["document_id"]))
            chunk_ids.add(int(result["chunk_id"]))
            if result.get("topic_major"):
                all_focus_topics.add(str(result["topic_major"]))
            if result.get("topic_minor"):
                all_focus_topics.add(str(result["topic_minor"]))
            card = _compact_result_card(result)
            card["domain"] = domain
            evidence_cards.append(card)

    status = "ready" if evidence_cards else "no_matches"
    if all_database_missing:
        status = "database_missing"

    return {
        "status": status,
        "summary": {
            "status": status,
            "mode": "summary_seeded",
            "query_count": len(queries),
            "returned_count": returned_count,
            "focus_domains": supported_domains,
        },
        "llm_context": {
            "status": status,
            "mode": "summary_seeded",
            "focus_domains": supported_domains,
            "focus_topics": sorted(all_focus_topics),
            "evidence_cards": evidence_cards,
        }
        if evidence_cards
        else None,
        "internal_provenance": {
            "knowledge_queries": knowledge_queries,
            "document_ids": sorted(document_ids),
            "chunk_ids": sorted(chunk_ids),
            "confidence_source": [
                payload.get("query_mode", payload.get("query_status", "unknown"))
                for payload in payloads
            ],
        },
    }


def build_tab_advisor_context(
    *,
    crop: str,
    tab_name: str,
) -> dict[str, Any]:
    normalized_tab = (tab_name or "").strip().lower().replace("-", "_")
    domains = _TAB_DOMAIN_MAP.get(normalized_tab, ())
    payload = build_summary_advisor_context(
        crop=crop,
        domains=domains,
    )

    summary = dict(payload.get("summary") or {})
    llm_context = payload.get("llm_context")

    if summary:
        summary["mode"] = "tab_seeded"
        summary["tab_name"] = normalized_tab

    if isinstance(llm_context, Mapping):
        llm_context = dict(llm_context)
        llm_context["mode"] = "tab_seeded"
        llm_context["tab_name"] = normalized_tab

    return {
        **payload,
        "summary": summary,
        "llm_context": llm_context,
    }
