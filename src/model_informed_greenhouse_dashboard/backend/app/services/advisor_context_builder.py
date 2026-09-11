"""Bounded retrieval-context builders for SmartGrow advisor surfaces."""

from __future__ import annotations

import re
from collections import OrderedDict
from copy import deepcopy
from threading import Lock
from time import monotonic, perf_counter
from typing import Any, Mapping, Sequence

from .knowledge_database import fetch_knowledge_neighbors, knowledge_db_path, query_knowledge_database
from .knowledge_query_router import caller_relevance_hits, route_knowledge_query
from .condition_wiki import corpus_signature, select_condition_wiki
from . import workbook_normalization


#: Evidence budget for a chat answer.
#:
#: Until 2026-07-17 this was 3 results x 240 chars = **720 characters** of unique
#: literature per answer, taken from chunks stored at 1,200 chars — i.e. ~80% of
#: every retrieved chunk was discarded before the model ever saw it, and an expert
#: agronomy answer was expected from roughly one page of pre-truncated prose.
#:
#: A 1,200-char excerpt is a complete chunk: `knowledge_database._PDF_CHUNK_CHARS`
#: builds chunks on paragraph/sentence boundaries at that size, so this passes whole
#: passages through instead of cutting them mid-sentence.
_MAX_CHAT_RESULTS = 6
_MAX_CHAT_EVIDENCE_CARDS = 12
#: Per-question retrieval budget, as (main results, evidence cards). A wider
#: question earns more ranked passages, up to the two ceilings above. The tier is
#: chosen in build_chat_advisor_context and reported as summary["budget"].
_CHAT_BUDGET_TIERS = {"brief": (3, 6), "standard": (4, 8), "deep": (6, 12)}
_MAX_SUMMARY_RESULTS = 2
_MAX_SUMMARY_QUERIES = 3
_MAX_EXCERPT_CHARS = 1200
_MAX_CHAT_QUERY_CHARS = 1200
_MAX_CHAT_USER_TURNS = 3
_FOLLOWUP_PATTERN = re.compile(
    r"^(?:그럼|그러면|그렇다면|그건|그걸|그때|그거|이때|이 경우|그 경우|좀 더|"
    r"밤에는|낮에는|야간에는|주간에는|왜\b|"
    r"then\b|so\b|and\b|what about\b|how about\b|what if\b|why\b)",
    re.IGNORECASE,
)
_FOLLOWUP_MODIFIERS = frozenset({
    "night", "day", "control", "management", "method", "cultivation",
    "current", "status", "next", "tomorrow", "지금", "내일",
})
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


def _explicit_query_crop(query: str) -> str | None:
    crops = {
        crop
        for crop, pattern in (
            ("tomato", r"토마토|\btomato(?:es)?\b"),
            ("cucumber", r"오이|\bcucumbers?\b"),
        )
        if re.search(pattern, query, re.IGNORECASE)
    }
    return next(iter(crops)) if len(crops) == 1 else None


def is_runtime_status_query(query: str) -> bool:
    """Recognize only standalone replay running/paused questions."""
    compact = re.sub(r"[\s,?.!？]+", "", query)
    state = r"(?:(?:실행|재생)중|(?:일시)?정지(?:상태)?)(?:이야|야|인가요|인가|인지|니)?"
    if re.fullmatch(
        r"(?:그럼|그러면)?(?:지금|현재)?(?:이)?(?:토마토|오이)?"
        r"(?:시뮬레이션|리플레이)(?:은|는|이|가)?"
        + state + r"(?:(?:아니면|또는)?" + state + r")?",
        compact,
    ):
        return True
    return bool(re.fullmatch(
        r"is\s+(?:(?:this|the|my|current)\s+)?(?:(?:tomato|cucumber)\s+)?"
        r"(?:simulation|replay)\s+(?:currently\s+)?(?:running|paused|playing|stopped)"
        r"(?:\s+or\s+(?:running|paused|playing|stopped))?(?:\s+(?:right\s+)?now)?[?.!]*",
        " ".join(query.split()),
        re.IGNORECASE,
    ))


def _is_contextual_followup(query: str, previous_query: str) -> bool:
    if not _FOLLOWUP_PATTERN.search(query):
        return False
    current_crop = _explicit_query_crop(query)
    previous_crop = _explicit_query_crop(previous_query)
    if current_crop and previous_crop and current_crop != previous_crop:
        return False
    current_terms = set(route_knowledge_query(query)["caller_terms"]) - _FOLLOWUP_MODIFIERS
    previous_terms = set(route_knowledge_query(previous_query)["caller_terms"]) - _FOLLOWUP_MODIFIERS
    water_relations = {"vpd", "humidity", "temperature", "stomatal", "transpiration", "condensation"}
    current_conditions = set(route_knowledge_query(query)["caller_terms"]) & {"night", "day"}
    if current_conditions and current_terms & water_relations and previous_terms & water_relations:
        return True
    # A connector alone must not attach an independent subject (e.g. market
    # prices after VPD) to an earlier question.
    return not current_terms or bool(current_terms & previous_terms)


def _chat_retrieval_query(
    *, crop: str, messages: Sequence[Mapping[str, str]]
) -> tuple[str, str | None]:
    user_queries: list[str] = []
    observation_replies: list[bool] = []
    preceding_question = False
    for message in messages:
        role = (message.get("role") or "user").strip().lower()
        content = (message.get("content") or "").strip()
        if role == "user" and content:
            user_queries.append(content)
            observation_replies.append(bool(message.get("reply_to")) or (preceding_question and _is_short_observation_reply(content)))
        preceding_question = role == "assistant" and bool(re.search(r"[?？]\s*$", content))
    if not user_queries:
        return crop, None

    latest = user_queries[-1]
    if is_runtime_status_query(latest):
        return _explicit_query_crop(latest) or crop, latest[:_MAX_CHAT_QUERY_CHARS]
    selected = [latest[:_MAX_CHAT_QUERY_CHARS]]
    remaining = _MAX_CHAT_QUERY_CHARS - len(selected[0])
    current = latest
    for index in range(len(user_queries) - 2, -1, -1):
        previous = user_queries[index]
        if len(selected) >= _MAX_CHAT_USER_TURNS or remaining <= 1:
            break
        current_crop, previous_crop = _explicit_query_crop(current), _explicit_query_crop(previous)
        if current_crop and previous_crop and current_crop != previous_crop:
            break
        if not observation_replies[index + 1] and not _is_contextual_followup(current, previous):
            break
        selected.append(previous[:remaining - 1])
        remaining -= len(selected[-1]) + 1
        current = previous

    query_crop = next(
        (explicit for query in selected if (explicit := _explicit_query_crop(query))),
        crop,
    )
    return query_crop, "\n".join(reversed(selected))


def _is_short_observation_reply(text: str) -> bool:
    """Recognize brief answers to a preceding question, without mining assistant claims."""
    if len(text) > 160 or re.search(r"[?？]|알려|설명|추천|비교|찾아|\b(?:what|why|how|show|tell|recommend)\b", text, re.IGNORECASE):
        return False
    return bool(re.fullmatch(
        r"(?:네|예|아니요|아니오|맞아요|모르겠어요|모름|미확인|젖음|건조|있음|없음|"
        r".*(?:아요|어요|돼요|예요|이에요|입니다|못했어요)|"
        r".*(?:발생|집중|국한|정상|미확인|못함|젖음|건조|없음|있음)|"
        r"(?:yes|no|wet|dry|moist|damp|unsure|not sure|not yet|not checked|I haven't checked)|"
        r"(?:it is|it's|the substrate is)\s+(?:wet|dry|moist|damp)|"
        r"(?:약\s*)?[+-]?\d[\d.,\s]*(?:%|°C|℃|도|kPa|ppm|mS/cm|dS/m|시간|분)?)"
        r"[.!。]*", text, re.IGNORECASE,
    ))


def _trim_excerpt(text: str, limit: int = _MAX_EXCERPT_CHARS) -> str:
    normalized = " ".join((text or "").split())
    if len(normalized) <= limit:
        return normalized
    return f"{normalized[: limit - 3].rstrip()}..."


def _compact_result_card(result: Mapping[str, Any]) -> dict[str, Any]:
    document = result.get("document") or {}
    card = {
        "title": document.get("title"),
        "source_locator": result.get("source_locator"),
        "document_id": result.get("document_id"),
        "chunk_id": result.get("chunk_id"),
        "topic_major": result.get("topic_major"),
        "topic_minor": result.get("topic_minor"),
        "chunk_type": result.get("chunk_type"),
        "evidence_excerpt": _trim_excerpt(str(result.get("text") or "")),
    }
    for key in ("source_id", "source_context", "evidence_role", "context_for_chunk_id"):
        if result.get(key) is not None:
            card[key] = result[key]
    return card


def _application_query(query: str, crop: str) -> tuple[str | None, list[str]]:
    if not re.search(r"관리|조절|조정|해야|운영|진단|왜|원인|manage|adjust|diagnos|why|what should", query, re.IGNORECASE):
        return None, []
    terms = route_knowledge_query(query)["caller_terms"]
    conditions = [term for term in terms if term in {"night", "day"}]
    # Definitions and mechanisms remain the main search; this second query
    # specifically looks for management under the condition the user asked for.
    core = [term for term in terms if term not in {"night", "day", "management", "method"}]
    if not core:
        return None, conditions
    return " ".join([crop, *conditions, *core[:4], "management"]), conditions


def _diverse_main_results(results: Sequence[Mapping[str, Any]], limit: int, per_document_limit: int = 4) -> list[dict[str, Any]]:
    selected: list[dict[str, Any]] = []
    deferred: list[Mapping[str, Any]] = []
    per_document: dict[Any, int] = {}
    for result in results:
        document_id = result.get("document_id")
        if per_document.get(document_id, 0) >= per_document_limit:
            deferred.append(result)
            continue
        selected.append({**result, "evidence_role": "main"})
        per_document[document_id] = per_document.get(document_id, 0) + 1
        if len(selected) == limit:
            return selected
    for result in deferred:
        selected.append({**result, "evidence_role": "main"})
        if len(selected) == limit:
            break
    return selected


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


def _build_raw_chat_context(
    *,
    crop: str,
    messages: Sequence[Mapping[str, str]],
    limit: int = _MAX_CHAT_RESULTS,
    evidence_budget: int = _MAX_CHAT_EVIDENCE_CARDS,
    query_override: tuple[str, str | None] | None = None,
) -> dict[str, Any]:
    query_crop, user_query = query_override or _chat_retrieval_query(crop=crop, messages=messages)
    query_limit = max(1, min(int(limit), _MAX_CHAT_RESULTS))
    empty_provenance = {
        "knowledge_queries": [],
        "document_ids": [],
        "chunk_ids": [],
        "confidence_source": ["not_requested"],
    }

    if not user_query or is_runtime_status_query(user_query):
        return {
            "status": "skipped",
            "summary": {
                "status": "skipped",
                "mode": "chat_first",
                "query_count": 0,
                "returned_count": 0,
                "intent": None,
                "sub_intent": None,
                "query_mode": "not_requested",
            },
            "llm_context": {
                "status": "skipped",
                "mode": "chat_first",
                "resolved_crop": query_crop,
                "user_query": user_query,
                "focus_topics": [],
                "evidence_cards": [],
            } if user_query else None,
            "internal_provenance": empty_provenance,
        }

    nutrient_question = route_knowledge_query(user_query)["intent"] == "nutrient_recipe"
    payload = _run_bounded_knowledge_query(
        crop=query_crop,
        query=user_query,
        limit=min(10, query_limit * 2) if nutrient_question else query_limit,
    )
    if payload.get("query_status") == "retrieval_unavailable":
        return _retrieval_unavailable_context(mode="chat_first", queries=[user_query])

    results = _diverse_main_results(payload.get("results", []), query_limit, per_document_limit=1 if nutrient_question else 4)
    query_status = payload.get("query_status", "unknown")
    status = "ready" if results else "no_matches"
    if query_status == "database_missing":
        status = "database_missing"

    routing = payload.get("routing", {})
    query_payloads = [("main", payload)]
    application_query, application_conditions = _application_query(user_query, query_crop)
    application_found = False
    if results and application_query and routing.get("intent") not in {"nutrient_recipe", "disease_pest", "harvest_market"}:
        application = _run_bounded_knowledge_query(crop=query_crop, query=application_query, limit=query_limit)
        query_payloads.append(("application", application))
        seen = {result["chunk_id"] for result in results}
        added = 0
        for result in application.get("results", []):
            if application_conditions and not caller_relevance_hits(result.get("text", ""), application_conditions):
                continue
            application_found = True
            if result["chunk_id"] in seen:
                continue
            results.append({**result, "evidence_role": "application"})
            seen.add(result["chunk_id"])
            added += 1
            if added == 2:
                break
    neighbor_status = "not_requested"
    if results:
        try:
            # Immediate continuation often contains the table's temperature,
            # growth-stage or light conditions missing from the ranked excerpt.
            neighbors = fetch_knowledge_neighbors(crop=query_crop, seeds=results,
                                                  limit=max(0, evidence_budget - len(results)))
            neighbor_status = "ready" if neighbors else "no_adjacent_passages"
            results.extend(neighbors)
        except Exception:
            neighbor_status = "unavailable"
    results = results[:evidence_budget]
    evidence_cards = [_compact_result_card({**result, "source_id": f"S{index}"})
                      for index, result in enumerate(results, start=1)]
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
            "query_count": len(query_payloads),
            "returned_count": len(results),
            "intent": routing.get("intent"),
            "sub_intent": routing.get("sub_intent"),
            "query_mode": payload.get("query_mode"),
        },
        "llm_context": {
            "status": status,
            "mode": "chat_first",
            "resolved_crop": query_crop,
            "user_query": payload.get("query", user_query),
            "focus_topics": focus_topics,
            "reading_context": {
                "approach": "principle_conditions_management",
                "application_conditions": application_conditions,
                "condition_passage_found": application_found,
                "adjacent_passages": neighbor_status,
                "source_priority": "Use relevant agronomy-compendium passages for mechanisms and retain source-specific conditions; compare with local guides when applicable.",
            },
            "evidence_cards": evidence_cards,
        },
        "internal_provenance": {
            "knowledge_queries": [
                {
                    "role": role,
                    "query": query_payload.get("query", user_query),
                    "query_status": query_payload.get("query_status"),
                    "query_mode": query_payload.get("query_mode"),
                    "routing": query_payload.get("routing", {}),
                    "applied_filters": query_payload.get("applied_filters", {}),
                    "result_refs": [
                        {
                            "document_id": int(result["document_id"]),
                            "chunk_id": int(result["chunk_id"]),
                        }
                        for result in query_payload.get("results", [])
                    ],
                }
                for role, query_payload in query_payloads
            ],
            "document_ids": document_ids,
            "chunk_ids": chunk_ids,
            "confidence_source": [payload.get("query_mode", query_status)],
        },
    }


_CHAT_RETRIEVAL_CACHE: OrderedDict = OrderedDict()
_CHAT_RETRIEVAL_LOCK = Lock()


def _retrieval_signature(crop: str) -> tuple:
    # Include SQLite WAL writes and fallback databases; an index refresh must not
    # keep serving a previous passage set. No conversation/model output is cached.
    paths = [knowledge_db_path(crop), knowledge_db_path("all")]
    paths += [path.with_name(path.name + "-wal") for path in paths]
    paths.append(workbook_normalization.DATA_ROOT / workbook_normalization.NUTRIENT_WORKBOOK)
    return tuple((str(p), p.stat().st_mtime_ns, p.stat().st_size) if p.is_file() else (str(p), None, None) for p in paths)


def build_chat_advisor_context(
    *, crop: str, messages: Sequence[Mapping[str, str]], limit: int = _MAX_CHAT_RESULTS,
) -> dict[str, Any]:
    from .chat_case_state import build_chat_case_state

    started = perf_counter()
    query_crop, query = _chat_retrieval_query(crop=crop, messages=messages)
    if not query or is_runtime_status_query(query):
        return _build_raw_chat_context(crop=crop, messages=messages, limit=limit)
    case = build_chat_case_state(crop=crop, messages=messages)
    # A brief observation reply answers the assistant's own question, so a long
    # run of them pushes the original symptom out of the retained user turns.
    # Restore the symptom for that case only: a chain of fresh follow-up questions
    # keeps the fixed _MAX_CHAT_USER_TURNS budget it was already selected under.
    answered_case = any(report["asked_about"] for report in case["reports"])
    if answered_case and case["issue"] not in query:
        query = case["issue"][:600] + "\n" + query[-599:]
        query_crop = case["crop"]
    # An unknown/no-new-information reply changes dialogue state, not evidence.
    # Keep the last material reports in the query so that same-case passages can
    # be reused without losing earlier wet/dry, day/night or measurement context.
    if len(case["reports"]) > 1 and case["reports"][-1]["status"] == "unknown":
        statements = [r["statement"] for r in case["reports"] if r["status"] != "unknown"]
        query = "\n".join(dict.fromkeys(statements))[:_MAX_CHAT_QUERY_CHARS]
    complex_query = bool(re.search(r"비교|상충|모순|상호작용|자세|상세|논문|근거|compare|contradic|detail|interaction", query, re.IGNORECASE))
    simple_query = bool(re.search(r"정의|뜻|뭐야|무엇|what is|define", query, re.IGNORECASE))
    tier = "deep" if complex_query else "brief" if simple_query else "standard"
    tier_limit, evidence_budget = _CHAT_BUDGET_TIERS[tier]
    main_limit = min(max(1, int(limit)), tier_limit)
    key = (query_crop, query, main_limit, evidence_budget, _retrieval_signature(query_crop), corpus_signature(), query_knowledge_database, fetch_knowledge_neighbors)
    with _CHAT_RETRIEVAL_LOCK:
        cached = _CHAT_RETRIEVAL_CACHE.get(key)
        reused = bool(cached and monotonic() - cached[0] < 300)
        context = deepcopy(cached[1]) if reused else None
    if context is None:
        context = _build_raw_chat_context(
            crop=crop, messages=messages, limit=main_limit,
            evidence_budget=evidence_budget, query_override=(query_crop, query),
        )
        wiki = select_condition_wiki(query=query, crop=query_crop, limit=3)
        if wiki:
            llm_context = context.get("llm_context") or {"resolved_crop": query_crop, "user_query": query, "evidence_cards": []}
            context["llm_context"] = {**llm_context, "condition_wiki": wiki}
            context["summary"]["wiki_count"] = len(wiki)
        # Never cache an unavailable retrieval; the next turn can recover.
        if context.get("status") in {"ready", "no_matches"}:
            with _CHAT_RETRIEVAL_LOCK:
                _CHAT_RETRIEVAL_CACHE[key] = (monotonic(), deepcopy(context))
                _CHAT_RETRIEVAL_CACHE.move_to_end(key)
                while len(_CHAT_RETRIEVAL_CACHE) > 64:
                    _CHAT_RETRIEVAL_CACHE.popitem(last=False)
    context["summary"].update({
        "retrieval_reused": reused, "budget": tier,
        "retrieval_ms": round((perf_counter() - started) * 1000, 2),
        "evidence_budget": evidence_budget,
    })
    return context


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
