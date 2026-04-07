from datetime import UTC, datetime

import pytest

from model_informed_greenhouse_dashboard.backend.app.services import (
    advisor_context_builder,
    advisor_orchestration,
)


def _catalog_stub() -> dict[str, object]:
    return {
        "catalog_version": "smartgrow-phase1-v1",
        "summary": {
            "pending_parsers": ["pdf"],
        },
        "advisory_surfaces": {
            "environment": {
                "status": "ready",
                "route": "/api/environment/recommend",
            },
            "pesticide": {
                "status": "ready",
                "route": "/api/pesticides/recommend",
            },
            "nutrient": {
                "status": "ready",
                "route": "/api/nutrients/recommend",
            },
            "nutrient_correction": {
                "status": "ready",
                "route": "/api/nutrients/correction",
            },
            "work": {
                "status": "ready",
                "route": "/api/work/recommend",
            },
        },
    }


def _seed_cucumber_runtime_state():
    from model_informed_greenhouse_dashboard.backend.app.adapters.cucumber import (
        CucumberAdapter,
    )

    adapter = CucumberAdapter()
    model = adapter.model
    model.nodes = 18
    model.remaining_leaves = 18
    model.cumulative_thermal_time = 640.0
    model.vegetative_dw = 82.0
    model.fruit_dw = 24.0
    model.reproductive_node_threshold = 15
    model.leaves_info = [
        {
            "Leaf Number": rank,
            "Date": model.start_date.date(),
            "Thermal Time": float((rank - 1) * 18),
        }
        for rank in range(1, 19)
    ]
    model.LAI = float(model.calculate_current_lai())
    adapter._last_state = {
        "LAI": model.LAI,
        "leaf_count": model.remaining_leaves,
        "fruit_dry_weight_g_m2": model.fruit_dw,
        "vegetative_dry_weight_g_m2": model.vegetative_dw,
        "gross_photosynthesis_umol_m2_s": 13.2,
        "net_assimilation_umol_m2_s": 8.4,
        "T_canopy_C": 23.5,
    }
    adapter._last_datetime = datetime(2026, 4, 7, 9, 0, tzinfo=UTC)
    return adapter


def _seed_tomato_runtime_state():
    from model_informed_greenhouse_dashboard.backend.app.adapters.tomato import TomatoAdapter

    adapter = TomatoAdapter()
    model = adapter.model
    model.truss_count = 3
    model.n_f = 4
    model.truss_cohorts = [
        {"tdvs": 0.55, "n_fruits": 4, "w_fr_cohort": 14.0, "active": True, "mult": 1.0},
        {"tdvs": 0.43, "n_fruits": 4, "w_fr_cohort": 11.0, "active": True, "mult": 1.0},
        {"tdvs": 0.21, "n_fruits": 4, "w_fr_cohort": 6.0, "active": True, "mult": 1.0},
    ]
    model.W_lv = 78.0
    model.W_st = 36.0
    model.W_rt = 18.0
    model.W_fr = sum(cohort["w_fr_cohort"] for cohort in model.truss_cohorts)
    model.W_fr_harvested = 9.0
    model.LAI = 2.35
    adapter._last_state = {
        "crop_efficiency": 1.18,
        "gross_photosynthesis_umol_m2_s": 12.4,
        "T_canopy_C": 24.1,
    }
    adapter._last_datetime = datetime(2026, 4, 7, 10, 0, tzinfo=UTC)
    return adapter


def test_build_advisor_summary_response_wraps_consulting_and_context(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(
        advisor_orchestration,
        "build_knowledge_catalog",
        lambda crop: _catalog_stub(),
    )
    monkeypatch.setattr(
        advisor_orchestration,
        "generate_consulting",
        lambda **_: "## Executive Summary\n- bounded summary",
    )
    monkeypatch.setattr(
        advisor_orchestration,
        "build_summary_advisor_context",
        lambda **_: {
            "status": "skipped",
            "summary": {
                "status": "skipped",
                "mode": "summary_seeded",
                "query_count": 0,
                "returned_count": 0,
                "focus_domains": [],
            },
            "llm_context": None,
            "internal_provenance": {
                "knowledge_queries": [],
                "document_ids": [],
                "chunk_ids": [],
                "confidence_source": ["not_requested"],
            },
        },
    )

    payload = advisor_orchestration.build_advisor_summary_response(
        crop="tomato",
        dashboard={
            "data": {"temperature": 25.1},
            "metrics": {"growth": {"lai": 3.2}},
            "weather": {"current": {"temperature_c": 13.5}},
            "rtr": {"live": {"targetTempC": 22.0}},
            "knowledge": {"crop": "tomato"},
        },
        language="en",
    )

    assert payload["status"] == "success"
    assert payload["family"] == "advisor_summary"
    assert payload["text"].startswith("## Executive Summary")
    assert payload["machine_payload"]["domains"] == [
        "environment_control",
        "crop_physiology",
        "disease_pest",
        "nutrient_recipe",
        "drain_feedback",
    ]
    assert payload["machine_payload"]["context_completeness"] == 0.83
    assert payload["machine_payload"]["missing_data"] == ["recentSummary"]
    assert payload["machine_payload"]["retrieval_context"]["status"] == "skipped"
    assert (
        payload["machine_payload"]["internal_provenance"]["surface_routes"]["pesticide"]
        == "/api/pesticides/recommend"
    )


def test_build_summary_advisor_context_compacts_seeded_domain_queries(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    calls: list[dict[str, object]] = []

    def _fake_query(**kwargs):
        calls.append(kwargs)
        query = str(kwargs["query"])
        if "environment control" in query:
            return {
                "query_status": "ready",
                "query": query,
                "query_mode": "intent_routed_hybrid",
                "applied_filters": {"source_types": ["pdf", "csv"]},
                "routing": {"intent": "environment_control"},
                "results": [
                    {
                        "chunk_id": 11,
                        "document_id": 2,
                        "text": "Use RTR and outside weather together when steering humidity and temperature over the next 24 hours.",
                        "chunk_type": "paragraph",
                        "topic_major": "environment",
                        "topic_minor": "temperature",
                    }
                ],
            }
        return {
            "query_status": "ready",
            "query": query,
            "query_mode": "intent_routed_hybrid",
            "applied_filters": {"source_types": ["pdf"]},
            "routing": {"intent": "crop_physiology"},
            "results": [
                {
                    "chunk_id": 18,
                    "document_id": 5,
                    "text": "Balance transpiration and canopy temperature before pushing generative load.",
                    "chunk_type": "paragraph",
                    "topic_major": "physiology",
                    "topic_minor": "growth",
                }
            ],
        }

    monkeypatch.setattr(
        advisor_context_builder,
        "query_knowledge_database",
        _fake_query,
    )

    payload = advisor_context_builder.build_summary_advisor_context(
        crop="tomato",
        domains=["environment_control", "crop_physiology", "disease_pest"],
    )

    assert payload["status"] == "ready"
    assert payload["summary"]["query_count"] == 2
    assert payload["summary"]["focus_domains"] == [
        "environment_control",
        "crop_physiology",
    ]
    assert payload["llm_context"]["focus_topics"] == [
        "environment",
        "growth",
        "physiology",
        "temperature",
    ]
    assert payload["internal_provenance"]["chunk_ids"] == [11, 18]
    assert len(calls) == 2


def test_build_tab_advisor_context_reuses_seeded_queries_for_work(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    calls: list[dict[str, object]] = []

    def _fake_query(**kwargs):
        calls.append(kwargs)
        return {
            "query_status": "ready",
            "query": kwargs["query"],
            "query_mode": "intent_routed_hybrid",
            "applied_filters": {"source_types": ["pdf", "xlsx"]},
            "routing": {"intent": "cultivation_work"},
            "results": [
                {
                    "chunk_id": 31,
                    "document_id": 8,
                    "text": "Cluster pruning and harvest labor should be split when humidity stays elevated through the afternoon.",
                    "chunk_type": "paragraph",
                    "topic_major": "work",
                    "topic_minor": "labor",
                }
            ],
        }

    monkeypatch.setattr(
        advisor_context_builder,
        "query_knowledge_database",
        _fake_query,
    )

    payload = advisor_context_builder.build_tab_advisor_context(
        crop="tomato",
        tab_name="work",
    )

    assert payload["status"] == "ready"
    assert payload["summary"]["mode"] == "tab_seeded"
    assert payload["summary"]["tab_name"] == "work"
    assert payload["summary"]["focus_domains"] == ["cultivation_work"]
    assert payload["llm_context"]["mode"] == "tab_seeded"
    assert payload["llm_context"]["tab_name"] == "work"
    assert payload["llm_context"]["evidence_cards"][0]["domain"] == "cultivation_work"
    assert payload["internal_provenance"]["chunk_ids"] == [31]
    assert len(calls) == 1


def test_build_advisor_summary_response_injects_ready_retrieval_context_only(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    captured_dashboard: dict[str, object] = {}
    monkeypatch.setattr(
        advisor_orchestration,
        "build_knowledge_catalog",
        lambda crop: _catalog_stub(),
    )
    monkeypatch.setattr(
        advisor_orchestration,
        "build_summary_advisor_context",
        lambda **_: {
            "status": "ready",
            "summary": {
                "status": "ready",
                "mode": "summary_seeded",
                "query_count": 2,
                "returned_count": 2,
                "focus_domains": ["environment_control", "crop_physiology"],
            },
            "llm_context": {
                "status": "ready",
                "mode": "summary_seeded",
                "focus_domains": ["environment_control", "crop_physiology"],
                "focus_topics": ["environment", "physiology"],
                "evidence_cards": [
                    {
                        "domain": "environment_control",
                        "evidence_excerpt": "Use RTR and outside weather together.",
                    }
                ],
            },
            "internal_provenance": {
                "knowledge_queries": [
                    {
                        "query": "tomato greenhouse environment control temperature humidity vpd co2 steering",
                        "query_status": "ready",
                        "query_mode": "intent_routed_hybrid",
                        "routing": {"intent": "environment_control"},
                        "applied_filters": {"source_types": ["pdf", "csv"]},
                        "result_refs": [{"document_id": 2, "chunk_id": 11}],
                    }
                ],
                "document_ids": [2],
                "chunk_ids": [11],
                "confidence_source": ["intent_routed_hybrid"],
            },
        },
    )

    def _fake_generate_consulting(**kwargs):
        captured_dashboard.update(kwargs["dashboard"])
        return "## Executive Summary\n- bounded summary"

    monkeypatch.setattr(
        advisor_orchestration,
        "generate_consulting",
        _fake_generate_consulting,
    )

    payload = advisor_orchestration.build_advisor_summary_response(
        crop="tomato",
        dashboard={
            "data": {"temperature": 25.1},
            "metrics": {"growth": {"lai": 3.2}},
            "weather": {"current": {"temperature_c": 13.5}},
            "rtr": {"live": {"targetTempC": 22.0}},
            "knowledge": {"crop": "tomato"},
        },
        language="en",
    )

    assert payload["machine_payload"]["retrieval_context"]["status"] == "ready"
    assert (
        payload["machine_payload"]["internal_provenance"]["knowledge_query_turn"]["chunk_ids"]
        == [11]
    )
    assert captured_dashboard["knowledge"]["advisor_retrieval_context"]["focus_domains"] == [
        "environment_control",
        "crop_physiology",
    ]
    assert "document_ids" not in captured_dashboard["knowledge"]["advisor_retrieval_context"]


def test_build_advisor_summary_response_keeps_catalog_only_dashboard_on_retrieval_fallback(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    captured_dashboard: dict[str, object] = {}
    monkeypatch.setattr(
        advisor_orchestration,
        "build_knowledge_catalog",
        lambda crop: _catalog_stub(),
    )
    monkeypatch.setattr(
        advisor_context_builder,
        "query_knowledge_database",
        lambda **_: (_ for _ in ()).throw(RuntimeError("boom")),
    )
    monkeypatch.setattr(
        advisor_orchestration,
        "build_summary_advisor_context",
        advisor_context_builder.build_summary_advisor_context,
    )

    def _fake_generate_consulting(**kwargs):
        captured_dashboard.update(kwargs["dashboard"])
        return "## Executive Summary\n- bounded summary"

    monkeypatch.setattr(
        advisor_orchestration,
        "generate_consulting",
        _fake_generate_consulting,
    )

    payload = advisor_orchestration.build_advisor_summary_response(
        crop="tomato",
        dashboard={
            "data": {"temperature": 25.1},
            "metrics": {"growth": {"lai": 3.2}},
            "weather": {"current": {"temperature_c": 13.5}},
            "rtr": {"live": {"targetTempC": 22.0}},
            "knowledge": {"crop": "tomato"},
        },
        language="en",
    )

    assert payload["status"] == "success"
    assert payload["machine_payload"]["retrieval_context"]["status"] == "retrieval_unavailable"
    assert "advisor_retrieval_context" not in captured_dashboard["knowledge"]


def test_build_advisor_chat_response_wraps_generate_chat_reply(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(
        advisor_orchestration,
        "build_knowledge_catalog",
        lambda crop: _catalog_stub(),
    )
    monkeypatch.setattr(
        advisor_orchestration,
        "generate_chat_reply",
        lambda **_: "- chat reply",
    )
    monkeypatch.setattr(
        advisor_orchestration,
        "build_chat_advisor_context",
        lambda **_: {
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
            "internal_provenance": {
                "knowledge_queries": [],
                "document_ids": [],
                "chunk_ids": [],
                "confidence_source": ["not_requested"],
            },
        },
    )

    payload = advisor_orchestration.build_advisor_chat_response(
        crop="cucumber",
        messages=[{"role": "user", "content": "What should I watch today?"}],
        dashboard={
            "currentData": {"temperature": 24.4},
            "knowledge": {"crop": "cucumber"},
        },
        language="en",
    )

    assert payload["status"] == "success"
    assert payload["family"] == "advisor_chat"
    assert payload["text"] == "- chat reply"
    assert payload["machine_payload"]["domains"] == [
        "crop_physiology",
        "disease_pest",
        "nutrient_recipe",
        "drain_feedback",
    ]
    assert payload["machine_payload"]["missing_data"] == [
        "metrics",
        "recentSummary",
        "weather",
        "rtr",
    ]
    assert payload["machine_payload"]["retrieval_context"]["status"] == "skipped"


def test_build_chat_advisor_context_compacts_retrieved_evidence(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(
        advisor_context_builder,
        "query_knowledge_database",
        lambda **_: {
            "query_status": "ready",
            "query": "Why is powdery mildew pressure rising?",
            "query_mode": "intent_routed_hybrid",
            "applied_filters": {"source_types": ["pdf", "xlsx"]},
            "routing": {
                "intent": "disease_pest",
                "sub_intent": "symptom_to_action",
                "rerank_profile": "structured_pesticide",
            },
            "results": [
                {
                    "chunk_id": 91,
                    "document_id": 12,
                    "text": "Powdery mildew pressure rises when leaf wetness and overnight humidity remain elevated for multiple cycles.",
                    "chunk_type": "paragraph",
                    "topic_major": "disease_pest",
                    "topic_minor": "diagnosis",
                    "document": {
                        "title": "Cucumber agronomy compendium",
                        "filename": "오이_농업기술대계.pdf",
                        "asset_family": "manual_pdf",
                        "source_type": "pdf",
                    },
                },
                {
                    "chunk_id": 144,
                    "document_id": 3,
                    "text": "Rotate away from the same FRAC group when pressure remains active across consecutive scouting windows.",
                    "chunk_type": "table_summary",
                    "topic_major": "disease_pest",
                    "topic_minor": "pesticide_rotation",
                    "document": {
                        "title": "Pesticide solution workbook",
                        "filename": "농약 솔루션_260326_v1.xlsx",
                        "asset_family": "pesticide_workbook",
                        "source_type": "xlsx",
                    },
                },
            ],
        },
    )

    payload = advisor_context_builder.build_chat_advisor_context(
        crop="cucumber",
        messages=[
            {"role": "assistant", "content": "What changed?"},
            {"role": "user", "content": "Why is powdery mildew pressure rising?"},
        ],
    )

    assert payload["status"] == "ready"
    assert payload["summary"]["intent"] == "disease_pest"
    assert payload["summary"]["returned_count"] == 2
    assert payload["llm_context"]["focus_topics"] == [
        "diagnosis",
        "disease_pest",
        "pesticide_rotation",
    ]
    assert payload["llm_context"]["evidence_cards"][0]["evidence_excerpt"].startswith(
        "Powdery mildew pressure rises"
    )
    assert payload["internal_provenance"]["chunk_ids"] == [91, 144]
    assert payload["internal_provenance"]["knowledge_queries"][0]["result_refs"] == [
        {"document_id": 12, "chunk_id": 91},
        {"document_id": 3, "chunk_id": 144},
    ]


def test_build_advisor_chat_response_injects_ready_retrieval_context_only(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    captured_dashboard: dict[str, object] = {}
    monkeypatch.setattr(
        advisor_orchestration,
        "build_knowledge_catalog",
        lambda crop: _catalog_stub(),
    )
    monkeypatch.setattr(
        advisor_orchestration,
        "build_chat_advisor_context",
        lambda **_: {
            "status": "ready",
            "summary": {
                "status": "ready",
                "mode": "chat_first",
                "query_count": 1,
                "returned_count": 1,
                "intent": "disease_pest",
                "sub_intent": "symptom_to_action",
                "query_mode": "intent_routed_hybrid",
            },
            "llm_context": {
                "status": "ready",
                "mode": "chat_first",
                "user_query": "powdery mildew pressure",
                "focus_topics": ["disease_pest", "diagnosis"],
                "evidence_cards": [
                    {
                        "evidence_excerpt": "Keep overnight RH below the repeated high-risk band.",
                    }
                ],
            },
            "internal_provenance": {
                "knowledge_queries": [
                    {
                        "query": "powdery mildew pressure",
                        "query_status": "ready",
                        "query_mode": "intent_routed_hybrid",
                        "routing": {"intent": "disease_pest"},
                        "applied_filters": {"source_types": ["pdf", "xlsx"]},
                        "result_refs": [{"document_id": 12, "chunk_id": 91}],
                    }
                ],
                "document_ids": [12],
                "chunk_ids": [91],
                "confidence_source": ["intent_routed_hybrid"],
            },
        },
    )

    def _fake_generate_chat_reply(**kwargs):
        captured_dashboard.update(kwargs["dashboard"])
        return "- chat reply"

    monkeypatch.setattr(
        advisor_orchestration,
        "generate_chat_reply",
        _fake_generate_chat_reply,
    )

    payload = advisor_orchestration.build_advisor_chat_response(
        crop="cucumber",
        messages=[{"role": "user", "content": "What should I do for powdery mildew?"}],
        dashboard={
            "currentData": {"temperature": 24.4},
            "knowledge": {"crop": "cucumber"},
        },
        language="en",
    )

    assert payload["machine_payload"]["retrieval_context"]["status"] == "ready"
    assert (
        payload["machine_payload"]["internal_provenance"]["knowledge_query_turn"]["chunk_ids"]
        == [91]
    )
    assert captured_dashboard["knowledge"]["advisor_retrieval_context"]["focus_topics"] == [
        "disease_pest",
        "diagnosis",
    ]
    assert "routing" not in captured_dashboard["knowledge"]["advisor_retrieval_context"]
    assert (
        "document_title"
        not in captured_dashboard["knowledge"]["advisor_retrieval_context"]["evidence_cards"][0]
    )


def test_build_advisor_chat_response_keeps_catalog_only_dashboard_on_retrieval_fallback(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    captured_dashboard: dict[str, object] = {}
    monkeypatch.setattr(
        advisor_orchestration,
        "build_knowledge_catalog",
        lambda crop: _catalog_stub(),
    )
    monkeypatch.setattr(
        advisor_orchestration,
        "build_chat_advisor_context",
        lambda **_: {
            "status": "database_missing",
            "summary": {
                "status": "database_missing",
                "mode": "chat_first",
                "query_count": 1,
                "returned_count": 0,
                "intent": "crop_physiology",
                "sub_intent": "current_state_diagnosis",
                "query_mode": "database_missing",
            },
            "llm_context": {
                "status": "database_missing",
                "mode": "chat_first",
                "user_query": "How is canopy balance?",
                "evidence_cards": [],
            },
            "internal_provenance": {
                "knowledge_queries": [
                    {
                        "query": "How is canopy balance?",
                        "query_status": "database_missing",
                        "query_mode": "database_missing",
                        "routing": {"intent": "crop_physiology"},
                        "applied_filters": {"source_types": ["pdf"]},
                        "result_refs": [],
                    }
                ],
                "document_ids": [],
                "chunk_ids": [],
                "confidence_source": ["database_missing"],
            },
        },
    )

    def _fake_generate_chat_reply(**kwargs):
        captured_dashboard.update(kwargs["dashboard"])
        return "- chat reply"

    monkeypatch.setattr(
        advisor_orchestration,
        "generate_chat_reply",
        _fake_generate_chat_reply,
    )

    payload = advisor_orchestration.build_advisor_chat_response(
        crop="tomato",
        messages=[{"role": "user", "content": "How is canopy balance?"}],
        dashboard={
            "currentData": {"temperature": 24.4},
            "knowledge": {"crop": "tomato"},
        },
    )

    assert payload["machine_payload"]["retrieval_context"]["status"] == "database_missing"
    assert "advisor_retrieval_context" not in captured_dashboard["knowledge"]


def test_build_advisor_chat_response_falls_back_cleanly_when_retrieval_errors(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    captured_dashboard: dict[str, object] = {}
    monkeypatch.setattr(
        advisor_orchestration,
        "build_knowledge_catalog",
        lambda crop: _catalog_stub(),
    )
    monkeypatch.setattr(
        advisor_context_builder,
        "query_knowledge_database",
        lambda **_: (_ for _ in ()).throw(RuntimeError("boom")),
    )
    monkeypatch.setattr(
        advisor_orchestration,
        "build_chat_advisor_context",
        advisor_context_builder.build_chat_advisor_context,
    )

    def _fake_generate_chat_reply(**kwargs):
        captured_dashboard.update(kwargs["dashboard"])
        return "- chat reply"

    monkeypatch.setattr(
        advisor_orchestration,
        "generate_chat_reply",
        _fake_generate_chat_reply,
    )

    payload = advisor_orchestration.build_advisor_chat_response(
        crop="tomato",
        messages=[{"role": "user", "content": "How is canopy balance?"}],
        dashboard={
            "currentData": {"temperature": 24.4},
            "knowledge": {"crop": "tomato"},
        },
    )

    assert payload["status"] == "success"
    assert payload["machine_payload"]["retrieval_context"]["status"] == "retrieval_unavailable"
    assert "advisor_retrieval_context" not in captured_dashboard["knowledge"]


def test_build_advisor_tab_response_delegates_landed_tabs(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(
        advisor_orchestration,
        "build_pesticide_recommendation_response",
        lambda **_: {
            "status": "success",
            "family": "pesticide",
            "crop": "tomato",
            "matched_targets": ["powdery mildew"],
        },
    )
    monkeypatch.setattr(
        advisor_orchestration,
        "build_nutrient_correction_response",
        lambda **_: {
            "status": "success",
            "family": "nutrient_correction",
            "crop": "tomato",
            "correction_outputs": {},
        },
    )

    pesticide_payload = advisor_orchestration.build_advisor_tab_response(
        tab_name="pesticide",
        crop="tomato",
        target="powdery mildew",
        limit=3,
    )
    correction_payload = advisor_orchestration.build_advisor_tab_response(
        tab_name="nutrient_correction",
        crop="tomato",
    )

    assert pesticide_payload["tab_name"] == "pesticide"
    assert pesticide_payload["orchestration"]["entrypoint"] == "/api/advisor/tab/pesticide"
    assert correction_payload["tab_name"] == "correction"
    assert correction_payload["orchestration"]["entrypoint"] == "/api/advisor/tab/correction"


def test_build_environment_recommendation_response_rewrites_entrypoint(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(
        advisor_orchestration,
        "build_knowledge_catalog",
        lambda crop: _catalog_stub(),
    )

    payload = advisor_orchestration.build_environment_recommendation_response(
        crop="tomato",
        dashboard={
            "data": {
                "temperature": 23.4,
                "humidity": 86.0,
                "vpd": 0.52,
            },
            "weather": {
                "forecast": [
                    {
                        "date": "2026-04-07",
                        "temp_max": 24.0,
                    }
                ]
            },
            "rtr": {"live": {"targetTempC": 22.0}},
        },
    )

    assert payload["family"] == "environment_recommendation"
    assert payload["tab_name"] == "environment"
    assert payload["orchestration"]["entrypoint"] == "/api/environment/recommend"
    assert payload["orchestration"]["delegates_to"] == "/api/advisor/tab/environment"
    assert "environment_analysis" in payload["machine_payload"]


def test_build_work_recommendation_response_rewrites_entrypoint(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(
        advisor_orchestration,
        "build_knowledge_catalog",
        lambda crop: _catalog_stub(),
    )

    payload = advisor_orchestration.build_work_recommendation_response(
        crop="cucumber",
        dashboard={
            "metrics": {
                "growth": {
                    "activeTrusses": 8,
                }
            },
            "forecast": {
                "daily": [
                    {
                        "date": "2026-04-07",
                        "harvest_kg": 1.2,
                    }
                ]
            },
            "weather": {
                "forecast": [
                    {
                        "date": "2026-04-07",
                        "precip_probability": 40.0,
                    }
                ]
            },
            "rtr": {"live": {"targetTempC": 22.0}},
        },
    )

    assert payload["family"] == "work_recommendation"
    assert payload["tab_name"] == "work"
    assert payload["orchestration"]["entrypoint"] == "/api/work/recommend"
    assert payload["orchestration"]["delegates_to"] == "/api/advisor/tab/work"
    assert "work_analysis" in payload["machine_payload"]


def test_build_advisor_tab_response_lands_harvest_market_with_dashboard_context(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(
        advisor_orchestration,
        "build_knowledge_catalog",
        lambda crop: _catalog_stub(),
    )
    monkeypatch.setattr(
        advisor_orchestration,
        "build_tab_advisor_context",
        lambda **_: {
            "status": "ready",
            "summary": {
                "status": "ready",
                "mode": "tab_seeded",
                "query_count": 1,
                "returned_count": 1,
                "focus_domains": ["harvest_market"],
                "tab_name": "harvest_market",
            },
            "llm_context": {
                "status": "ready",
                "mode": "tab_seeded",
                "tab_name": "harvest_market",
                "focus_domains": ["harvest_market"],
                "focus_topics": ["harvest", "market"],
                "evidence_cards": [
                    {
                        "domain": "harvest_market",
                        "topic_major": "market",
                        "topic_minor": "shipment",
                        "chunk_type": "paragraph",
                        "evidence_excerpt": "Align shipment timing with both harvest volume and the current wholesale-retail direction before committing labor.",
                    }
                ],
            },
            "internal_provenance": {
                "knowledge_queries": [
                    {
                        "query": "tomato harvest market shipment strategy yield quality timing",
                        "query_status": "ready",
                        "query_mode": "intent_routed_hybrid",
                        "routing": {"intent": "harvest_market"},
                        "applied_filters": {"source_types": ["pdf", "csv"]},
                        "result_refs": [{"document_id": 12, "chunk_id": 41}],
                    }
                ],
                "document_ids": [12],
                "chunk_ids": [41],
                "confidence_source": ["intent_routed_hybrid"],
            },
        },
    )

    payload = advisor_orchestration.build_advisor_tab_response(
        tab_name="harvest-market",
        crop="tomato",
        dashboard={
            "data": {
                "humidity": 87.0,
                "vpd": 0.41,
            },
            "metrics": {
                "growth": {
                    "activeTrusses": 9,
                },
                "yield": {
                    "predictedWeekly": 9.8,
                    "harvestableFruits": 17,
                },
                "energy": {
                    "consumption": 1.2,
                },
            },
            "forecast": {
                "daily": [
                    {"date": "2026-04-07", "harvest_kg": 1.4},
                ],
                "total_harvest_kg": 3.6,
                "total_energy_kWh": 42.0,
            },
            "market": {
                "source": {
                    "provider": "KAMIS",
                    "latest_day": "2026-04-06",
                    "fetched_at": "2026-04-06T00:00:00Z",
                    "auth_mode": "sample",
                },
                "summary": "featured greenhouse produce",
                "retail_items": [
                    {
                        "display_name": "Tomato",
                        "market_label": "Retail",
                        "latest_day": "2026-04-06",
                        "current_price_krw": 4280,
                        "direction": "up",
                        "day_over_day_pct": 4.8,
                    }
                ],
                "wholesale_items": [
                    {
                        "display_name": "Tomato",
                        "market_label": "Wholesale",
                        "latest_day": "2026-04-06",
                        "current_price_krw": 3970,
                        "direction": "up",
                        "day_over_day_pct": 3.1,
                    }
                ],
                "trend_items": [
                    {
                        "display_name": "Tomato",
                        "reference_date": "2026-04-06",
                        "latest_actual_price_krw": 4280,
                        "seasonal_reference_price_krw": 3980,
                        "seasonal_bias": "above-seasonal-normal",
                    }
                ],
            },
            "weather": {
                "daily": [
                    {
                        "date": "2026-04-07",
                        "temperature_max_c": 31.2,
                        "precipitation_probability_max_pct": 70,
                        "weather_label": "Overcast",
                    }
                ]
            },
            "rtr": {
                "live": {
                    "deltaTempC": -0.8,
                    "balanceState": "cool-for-light",
                }
            },
        },
    )

    assert payload["status"] == "success"
    assert payload["family"] == "advisor_tab"
    assert payload["tab_name"] == "harvest_market"
    assert payload["available_tabs"] == [
        "environment",
        "physiology",
        "work",
        "pesticide",
        "nutrient",
        "correction",
        "harvest_market",
    ]
    assert payload["machine_payload"]["missing_data"] == []
    assert payload["machine_payload"]["retrieval_context"]["status"] == "ready"
    assert payload["machine_payload"]["knowledge_evidence"]["focus_domains"] == [
        "harvest_market"
    ]
    analysis = payload["machine_payload"]["harvest_market_analysis"]
    assert analysis["urgency"] == "high"
    assert analysis["current_state"]["tradeoff_focus"] == "quality_stability"
    assert analysis["market_watchlist"][0]["seasonal_bias"] == "above-seasonal-normal"
    assert analysis["priority_actions"]
    assert analysis["context_snapshot"]["retail_price_krw"] == pytest.approx(4280.0)
    assert analysis["summary"].startswith("Harvest/market advisor combined")
    assert (
        payload["machine_payload"]["internal_provenance"]["knowledge_query_turn"]["chunk_ids"]
        == [41]
    )


def test_build_advisor_tab_response_harvest_market_stays_monitoring_first_without_market_or_forecast(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(
        advisor_orchestration,
        "build_knowledge_catalog",
        lambda crop: _catalog_stub(),
    )

    payload = advisor_orchestration.build_advisor_tab_response(
        tab_name="harvest-market",
        crop="cucumber",
        dashboard={
            "metrics": {
                "growth": {
                    "nodeCount": 22,
                }
            }
        },
    )

    assert payload["status"] == "success"
    assert payload["machine_payload"]["missing_data"] == [
        "forecast",
        "yield_metrics",
        "market",
        "weather_forecast",
        "rtr_live",
        "inside_humidity",
        "inside_vpd",
    ]
    analysis = payload["machine_payload"]["harvest_market_analysis"]
    assert analysis["urgency"] == "low"
    assert analysis["summary"].startswith("Harvest/market advisor is in monitoring-first mode")
    assert "시장 가격 snapshot이 부족" in analysis["current_state"]["market_outlook"]
    assert analysis["priority_actions"][0]["title"] == "시장 데이터 복구"
    assert analysis["context_snapshot"]["retail_price_krw"] is None


def test_build_advisor_tab_response_lands_environment_with_dashboard_context(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(
        advisor_orchestration,
        "build_knowledge_catalog",
        lambda crop: _catalog_stub(),
    )
    monkeypatch.setattr(
        advisor_orchestration,
        "build_tab_advisor_context",
        lambda **_: {
            "status": "ready",
            "summary": {
                "status": "ready",
                "mode": "tab_seeded",
                "query_count": 1,
                "returned_count": 1,
                "focus_domains": ["environment_control"],
                "tab_name": "environment",
            },
            "llm_context": {
                "status": "ready",
                "mode": "tab_seeded",
                "tab_name": "environment",
                "focus_domains": ["environment_control"],
                "focus_topics": ["environment", "temperature"],
                "evidence_cards": [
                    {
                        "domain": "environment_control",
                        "topic_major": "environment",
                        "topic_minor": "temperature",
                        "chunk_type": "paragraph",
                        "evidence_excerpt": "Use RTR and outside weather together when steering humidity and temperature over the next 24 hours.",
                    }
                ],
            },
            "internal_provenance": {
                "knowledge_queries": [
                    {
                        "query": "cucumber greenhouse environment control temperature humidity vpd co2 steering",
                        "query_status": "ready",
                        "query_mode": "intent_routed_hybrid",
                        "routing": {"intent": "environment_control"},
                        "applied_filters": {"source_types": ["pdf", "csv"]},
                        "result_refs": [{"document_id": 2, "chunk_id": 11}],
                    }
                ],
                "document_ids": [2],
                "chunk_ids": [11],
                "confidence_source": ["intent_routed_hybrid"],
            },
        },
    )

    payload = advisor_orchestration.build_advisor_tab_response(
        tab_name="environment",
        crop="cucumber",
        dashboard={
            "data": {
                "timestamp": 1_775_430_000_000,
                "temperature": 25.2,
                "humidity": 89.0,
                "vpd": 0.33,
                "co2": 460.0,
                "light": 320.0,
            },
            "recentSummary": {
                "variables": {
                    "humidity": {"trend": "up"},
                    "vpd": {"trend": "down"},
                    "temperature": {"trend": "flat"},
                }
            },
            "weather": {
                "current": {
                    "time": "2026-04-06T09:00:00+09:00",
                    "temperature_c": 21.2,
                    "relative_humidity_pct": 78.0,
                    "cloud_cover_pct": 82.0,
                    "weather_label": "Overcast",
                    "is_day": True,
                },
                "daily": [
                    {
                        "date": "2026-04-07",
                        "temperature_max_c": 30.5,
                        "temperature_min_c": 17.0,
                        "precipitation_probability_max_pct": 75,
                        "shortwave_radiation_sum_mj_m2": 14.2,
                        "sunshine_duration_h": 3.5,
                        "weather_label": "Overcast",
                    },
                    {
                        "date": "2026-04-08",
                        "temperature_max_c": 28.0,
                        "temperature_min_c": 15.0,
                        "precipitation_probability_max_pct": 40,
                        "shortwave_radiation_sum_mj_m2": 16.8,
                        "sunshine_duration_h": 5.1,
                        "weather_label": "Partly cloudy",
                    },
                ],
            },
            "rtr": {
                "profile": {"toleranceC": 1.0},
                "live": {
                    "targetTempC": 23.0,
                    "deltaTempC": -1.4,
                    "balanceState": "cool-for-light",
                },
                "forecastTargets": [
                    {
                        "date": "2026-04-07",
                        "targetTempC": 22.8,
                        "radiationSumMjM2D": 14.2,
                        "weatherLabel": "Overcast",
                    }
                ],
            },
        },
    )

    assert payload["status"] == "success"
    assert payload["tab_name"] == "environment"
    assert payload["available_tabs"] == [
        "environment",
        "physiology",
        "work",
        "pesticide",
        "nutrient",
        "correction",
        "harvest_market",
    ]
    assert payload["machine_payload"]["missing_data"] == []
    assert payload["machine_payload"]["retrieval_context"]["status"] == "ready"
    assert payload["machine_payload"]["knowledge_evidence"]["focus_domains"] == [
        "environment_control"
    ]
    advisor_actions = payload["machine_payload"]["advisor_actions"]
    assert advisor_actions["mode"] == "actionable"
    assert set(advisor_actions.keys()) == {"mode", "now", "today", "next_3d"}
    assert advisor_actions["now"]
    assert advisor_actions["today"]
    assert advisor_actions["next_3d"]
    analysis = payload["machine_payload"]["environment_analysis"]
    assert analysis["mode"] == "actionable"
    assert analysis["urgency"] == "high"
    assert "co2_support" in analysis["focus_areas"]
    assert analysis["current_state"]["diagnosis"]
    assert analysis["current_state"]["operating_mode"] == "dehumidify-and-rtr-recovery"
    assert "humidity_control" in analysis["current_state"]["risk_flags"]
    assert "rtr_recovery" in analysis["current_state"]["risk_flags"]
    assert analysis["immediate_actions"]
    assert analysis["today_steering"]
    assert any(item["title"] == "주간 CO2 보강 유지" for item in analysis["today_steering"])
    assert analysis["three_day_plan"][0]["date"] == "2026-04-07"
    assert analysis["monitoring_checklist"]
    assert (
        payload["machine_payload"]["internal_provenance"]["knowledge_query_turn"]["chunk_ids"]
        == [11]
    )


def test_build_advisor_tab_response_environment_stays_monitoring_first_without_inside_telemetry(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(
        advisor_orchestration,
        "build_knowledge_catalog",
        lambda crop: _catalog_stub(),
    )

    payload = advisor_orchestration.build_advisor_tab_response(
        tab_name="environment",
        crop="tomato",
        dashboard={},
    )

    assert payload["status"] == "success"
    assert payload["machine_payload"]["missing_data"] == [
        "inside_temperature",
        "inside_humidity",
        "inside_vpd",
        "weather_current",
        "weather_forecast",
        "rtr_live",
        "rtr_forecast",
        "recentSummary",
    ]
    advisor_actions = payload["machine_payload"]["advisor_actions"]
    assert advisor_actions["mode"] == "monitoring-first"
    assert set(advisor_actions.keys()) == {"mode", "now", "today", "next_3d"}
    analysis = payload["machine_payload"]["environment_analysis"]
    assert analysis["mode"] == "monitoring-first"
    assert analysis["urgency"] == "low"
    assert "실내 환경 telemetry 부족" in analysis["current_state"]["diagnosis"]
    assert analysis["current_state"]["operating_mode"] == "monitoring-first"
    assert "inside-climate-missing" in analysis["current_state"]["risk_flags"]
    assert analysis["summary"].startswith("Environment advisor is in monitoring-first mode")
    assert analysis["context_snapshot"]["inside_vpd_kpa"] is None


def test_build_advisor_tab_response_environment_does_not_infer_low_vpd_from_missing_signal(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(
        advisor_orchestration,
        "build_knowledge_catalog",
        lambda crop: _catalog_stub(),
    )

    payload = advisor_orchestration.build_advisor_tab_response(
        tab_name="environment",
        crop="tomato",
        dashboard={
            "data": {
                "timestamp": 1_775_430_000_000,
                "temperature": 24.2,
                "humidity": 72.0,
                "co2": 620.0,
                "light": 180.0,
            },
            "weather": {
                "current": {
                    "time": "2026-04-06T09:00:00+09:00",
                    "temperature_c": 18.0,
                    "relative_humidity_pct": 62.0,
                    "cloud_cover_pct": 35.0,
                    "weather_label": "Clear",
                    "is_day": True,
                },
                "daily": [
                    {
                        "date": "2026-04-07",
                        "temperature_max_c": 26.0,
                        "temperature_min_c": 14.0,
                        "precipitation_probability_max_pct": 15,
                    }
                ],
            },
            "rtr": {
                "profile": {"toleranceC": 1.0},
                "live": {
                    "targetTempC": 23.0,
                    "deltaTempC": 0.2,
                    "balanceState": "on-target",
                },
                "forecastTargets": [
                    {
                        "date": "2026-04-07",
                        "targetTempC": 23.0,
                        "radiationSumMjM2D": 18.0,
                        "weatherLabel": "Clear",
                    }
                ],
            },
        },
    )

    assert payload["machine_payload"]["missing_data"] == [
        "inside_vpd",
        "recentSummary",
    ]
    analysis = payload["machine_payload"]["environment_analysis"]
    assert analysis["urgency"] == "low"
    assert "고습/저VPD 패턴" not in analysis["current_state"]["diagnosis"]
    assert analysis["context_snapshot"]["inside_humidity_pct"] == pytest.approx(72.0)
    assert analysis["context_snapshot"]["inside_vpd_kpa"] is None


def test_build_advisor_tab_response_lands_physiology_with_dashboard_context(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(
        advisor_orchestration,
        "build_knowledge_catalog",
        lambda crop: _catalog_stub(),
    )
    monkeypatch.setattr(
        advisor_orchestration,
        "build_tab_advisor_context",
        lambda **_: {
            "status": "ready",
            "summary": {
                "status": "ready",
                "mode": "tab_seeded",
                "query_count": 1,
                "returned_count": 1,
                "focus_domains": ["crop_physiology"],
                "tab_name": "physiology",
            },
            "llm_context": {
                "status": "ready",
                "mode": "tab_seeded",
                "tab_name": "physiology",
                "focus_domains": ["crop_physiology"],
                "focus_topics": ["physiology", "growth"],
                "evidence_cards": [
                    {
                        "domain": "crop_physiology",
                        "topic_major": "physiology",
                        "topic_minor": "growth",
                        "chunk_type": "paragraph",
                        "evidence_excerpt": "Balance canopy temperature, VPD, and transpiration together before pushing crop load or generative steering.",
                    }
                ],
            },
            "internal_provenance": {
                "knowledge_queries": [
                    {
                        "query": "tomato crop physiology balance transpiration photosynthesis canopy growth",
                        "query_status": "ready",
                        "query_mode": "intent_routed_hybrid",
                        "routing": {"intent": "crop_physiology"},
                        "applied_filters": {"source_types": ["pdf", "csv"]},
                        "result_refs": [{"document_id": 5, "chunk_id": 18}],
                    }
                ],
                "document_ids": [5],
                "chunk_ids": [18],
                "confidence_source": ["intent_routed_hybrid"],
            },
        },
    )

    payload = advisor_orchestration.build_advisor_tab_response(
        tab_name="physiology",
        crop="tomato",
        dashboard={
            "data": {
                "temperature": 26.2,
                "humidity": 74.0,
                "canopyTemp": 27.6,
                "vpd": 1.42,
                "transpiration": 0.11,
                "stomatalConductance": 0.16,
                "photosynthesis": 9.4,
                "co2": 640.0,
                "light": 360.0,
            },
            "metrics": {
                "growth": {
                    "lai": 3.3,
                    "biomass": 3180.0,
                    "growthRate": 7.4,
                    "developmentStage": "fruit_set",
                    "activeTrusses": 9,
                },
                "yield": {
                    "predictedWeekly": 10.8,
                    "harvestableFruits": 16,
                },
            },
            "recentSummary": {
                "variables": {
                    "temperature": {"trend": "up"},
                    "vpd": {"trend": "up"},
                    "transpiration": {"trend": "down"},
                    "photosynthesis": {"trend": "down"},
                }
            },
        },
    )

    assert payload["status"] == "success"
    assert payload["tab_name"] == "physiology"
    assert payload["available_tabs"] == [
        "environment",
        "physiology",
        "work",
        "pesticide",
        "nutrient",
        "correction",
        "harvest_market",
    ]
    assert payload["machine_payload"]["missing_data"] == []
    assert payload["machine_payload"]["retrieval_context"]["status"] == "ready"
    assert payload["machine_payload"]["knowledge_evidence"]["focus_domains"] == [
        "crop_physiology"
    ]
    analysis = payload["machine_payload"]["physiology_analysis"]
    assert analysis["urgency"] == "high"
    assert analysis["current_state"]["balance_state"] == "stress-watch"
    assert "active trusses 9" in analysis["current_state"]["crop_specific_context"]
    assert analysis["supporting_signals"]
    assert analysis["follow_up_actions"]
    assert analysis["context_snapshot"]["canopy_air_delta_c"] == pytest.approx(1.4)
    assert (
        payload["machine_payload"]["internal_provenance"]["knowledge_query_turn"]["chunk_ids"]
        == [18]
    )


def test_build_advisor_tab_response_physiology_stays_monitoring_first_without_core_signals(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(
        advisor_orchestration,
        "build_knowledge_catalog",
        lambda crop: _catalog_stub(),
    )

    payload = advisor_orchestration.build_advisor_tab_response(
        tab_name="physiology",
        crop="cucumber",
        dashboard={
            "metrics": {
                "growth": {
                    "nodeCount": 21,
                }
            }
        },
    )

    assert payload["status"] == "success"
    assert payload["machine_payload"]["missing_data"] == [
        "inside_temperature",
        "canopy_temperature",
        "inside_vpd",
        "transpiration",
        "stomatal_conductance",
        "photosynthesis",
        "inside_light",
        "inside_co2",
        "recentSummary",
    ]
    analysis = payload["machine_payload"]["physiology_analysis"]
    assert analysis["urgency"] == "low"
    assert analysis["current_state"]["balance_state"] == "monitoring-first"
    assert "생리 telemetry 부족" in analysis["current_state"]["diagnosis"]
    assert analysis["follow_up_actions"][0]["title"] == "핵심 생리 telemetry 복구"
    assert analysis["context_snapshot"]["canopy_temp_c"] is None


def test_build_advisor_tab_response_lands_work_with_dashboard_context(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(
        advisor_orchestration,
        "build_knowledge_catalog",
        lambda crop: _catalog_stub(),
    )
    monkeypatch.setattr(
        advisor_orchestration,
        "build_tab_advisor_context",
        lambda **_: {
            "status": "ready",
            "summary": {
                "status": "ready",
                "mode": "tab_seeded",
                "query_count": 1,
                "returned_count": 1,
                "focus_domains": ["cultivation_work"],
                "tab_name": "work",
            },
            "llm_context": {
                "status": "ready",
                "mode": "tab_seeded",
                "focus_domains": ["cultivation_work"],
                "focus_topics": ["labor", "work"],
                "tab_name": "work",
                "evidence_cards": [
                    {
                        "domain": "cultivation_work",
                        "topic_major": "work",
                        "topic_minor": "labor",
                        "evidence_excerpt": "Split pruning and harvest windows when humidity recovery is slow.",
                    }
                ],
            },
            "internal_provenance": {
                "knowledge_queries": [
                    {
                        "query": "tomato cultivation work checklist pruning training harvest workflow",
                        "query_status": "ready",
                        "query_mode": "intent_routed_hybrid",
                        "routing": {"intent": "cultivation_work"},
                        "applied_filters": {"source_types": ["pdf", "xlsx"]},
                        "result_refs": [{"document_id": 8, "chunk_id": 31}],
                    }
                ],
                "document_ids": [8],
                "chunk_ids": [31],
                "confidence_source": ["intent_routed_hybrid"],
            },
        },
    )

    payload = advisor_orchestration.build_advisor_tab_response(
        tab_name="work",
        crop="tomato",
        dashboard={
            "data": {
                "timestamp": 1_775_430_000_000,
                "temperature": 24.8,
                "humidity": 88.0,
                "light": 140.0,
                "vpd": 0.42,
                "transpiration": 0.21,
            },
            "metrics": {
                "growth": {
                    "lai": 3.4,
                    "growthRate": 7.8,
                    "activeTrusses": 9,
                    "nodeCount": 26,
                },
                "yield": {
                    "predictedWeekly": 8.4,
                    "harvestableFruits": 18,
                },
                "energy": {
                    "consumption": 11.0,
                },
            },
            "recentSummary": {
                "variables": {
                    "humidity": {"mean": 86.0, "trend": "up"},
                    "vpd": {"mean": 0.39, "trend": "down"},
                }
            },
            "forecast": {
                "daily": [
                    {"date": "2026-04-07", "harvest_kg": 1.4, "ETc_mm": 5.1},
                    {"date": "2026-04-08", "harvest_kg": 1.0, "ETc_mm": 4.7},
                ],
                "total_harvest_kg": 2.4,
                "total_ETc_mm": 9.8,
                "total_energy_kWh": 38.0,
            },
            "weather": {
                "current": {
                    "time": "2026-04-06T09:00:00+09:00",
                    "temperature_c": 23.5,
                    "relative_humidity_pct": 88.0,
                },
                "daily": [
                    {
                        "date": "2026-04-07",
                        "temperature_max_c": 31.4,
                        "temperature_min_c": 17.2,
                        "precipitation_probability_max_pct": 70,
                    }
                ],
            },
            "rtr": {
                "live": {"deltaTempC": -1.3},
                "forecastTargets": [{"date": "2026-04-07", "targetTempC": 23.0}],
            },
        },
    )

    assert payload["status"] == "success"
    assert payload["family"] == "advisor_tab"
    assert payload["tab_name"] == "work"
    assert payload["available_tabs"] == [
        "environment",
        "physiology",
        "work",
        "pesticide",
        "nutrient",
        "correction",
        "harvest_market",
    ]
    assert payload["machine_payload"]["missing_data"] == []
    assert payload["machine_payload"]["retrieval_context"]["status"] == "ready"
    assert payload["machine_payload"]["knowledge_evidence"]["focus_domains"] == [
        "cultivation_work"
    ]
    advisor_actions = payload["machine_payload"]["advisor_actions"]
    assert advisor_actions["mode"] == "actionable"
    assert set(advisor_actions.keys()) == {"mode", "now", "today", "next_3d"}
    assert advisor_actions["now"]
    assert advisor_actions["today"]
    assert advisor_actions["next_3d"]
    analysis = payload["machine_payload"]["work_analysis"]
    assert analysis["mode"] == "actionable"
    assert analysis["urgency"] == "high"
    assert "harvest_load" in analysis["focus_areas"]
    assert "touch_work_separation" in analysis["focus_areas"]
    assert analysis["current_state"]["workload_balance"] == "harvest-heavy"
    assert analysis["current_state"]["operating_mode"] == "protected-harvest-window"
    assert "humidity-sensitive-window" in analysis["current_state"]["risk_flags"]
    assert "harvest-window-open" in analysis["current_state"]["risk_flags"]
    assert analysis["priority_actions"]
    assert {
        action["title"] for action in analysis["priority_actions"]
    } >= {
        "수확·습기 민감 작업 분리",
        "급액·관수 확인 선행",
        "수확 창 우선 배치",
        "급액·고온 대응 선행 점검",
    }
    assert analysis["time_windows"][0]["window"] == "next_6h"
    assert analysis["expected_effects"]
    assert analysis["context_snapshot"]["harvestable_fruits"] == 18
    assert analysis["context_snapshot"]["next_day_harvest_kg"] == pytest.approx(1.4)
    assert (
        payload["machine_payload"]["internal_provenance"]["knowledge_query_turn"]["chunk_ids"]
        == [31]
    )


def test_build_advisor_tab_response_work_stays_monitoring_first_without_planning_visibility(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(
        advisor_orchestration,
        "build_knowledge_catalog",
        lambda crop: _catalog_stub(),
    )

    payload = advisor_orchestration.build_advisor_tab_response(
        tab_name="work",
        crop="cucumber",
        dashboard={},
    )

    assert payload["status"] == "success"
    assert payload["machine_payload"]["missing_data"] == [
        "forecast",
        "growth_metrics",
        "yield_metrics",
        "weather_current",
        "weather_forecast",
        "rtr_live",
        "inside_humidity",
        "inside_vpd",
    ]
    advisor_actions = payload["machine_payload"]["advisor_actions"]
    assert advisor_actions["mode"] == "monitoring-first"
    analysis = payload["machine_payload"]["work_analysis"]
    assert analysis["mode"] == "monitoring-first"
    compare = payload["machine_payload"]["work_event_compare"]
    assert compare["status"] == "history-unavailable"
    assert compare["options"] == []
    assert analysis["current_state"]["workload_balance"] == "monitoring-first"
    assert analysis["priority_actions"][0]["title"] == "핵심 작업 planning signal 복구"
    assert analysis["context_snapshot"]["missing_work_signals"] == [
        "forecast",
        "growth_metrics",
        "yield_metrics",
        "weather_current",
        "weather_forecast",
        "rtr_live",
        "inside_humidity",
        "inside_vpd",
    ]


def test_build_advisor_tab_response_work_adds_cucumber_work_event_compare_from_persisted_store(
    monkeypatch: pytest.MonkeyPatch,
    tmp_path,
) -> None:
    from model_informed_greenhouse_dashboard.backend.app.services.crop_models.cucumber_growth_model import (
        apply_cucumber_work_event,
        build_cucumber_snapshot,
    )
    from model_informed_greenhouse_dashboard.backend.app.services.model_runtime import (
        model_state_store,
    )

    monkeypatch.setattr(
        advisor_orchestration,
        "build_knowledge_catalog",
        lambda crop: _catalog_stub(),
    )
    monkeypatch.setattr(
        advisor_orchestration,
        "build_tab_advisor_context",
        lambda **_: {
            "status": "skipped",
            "summary": {"status": "skipped", "mode": "tab_seeded", "focus_domains": []},
            "llm_context": None,
            "internal_provenance": {"chunk_ids": [], "document_ids": []},
        },
    )
    monkeypatch.setattr(
        model_state_store,
        "DEFAULT_MODEL_RUNTIME_DB_PATH",
        tmp_path / "model_runtime.sqlite3",
    )

    greenhouse_id = "gh-1"
    store = model_state_store.ModelStateStore()
    before_adapter = _seed_cucumber_runtime_state()
    before_snapshot = store.persist_snapshot(
        greenhouse_id=greenhouse_id,
        crop="cucumber",
        snapshot_time=datetime(2026, 4, 7, 9, 0, tzinfo=UTC),
        adapter_name=before_adapter.name,
        adapter_version=before_adapter.version,
        normalized_snapshot=build_cucumber_snapshot(
            before_adapter,
            greenhouse_id=greenhouse_id,
            snapshot_time=datetime(2026, 4, 7, 9, 0, tzinfo=UTC),
        ),
        raw_adapter_state=before_adapter.dump_state(),
        source="test",
    )
    after_adapter = advisor_orchestration._clone_compare_adapter_from_raw_state(
        "cucumber",
        before_snapshot["raw_adapter_state"],
    )
    apply_cucumber_work_event(
        after_adapter,
        {
            "event_type": "leaf_removal",
            "leaves_removed_count": 2,
            "target_leaf_count": 16,
        },
    )
    after_snapshot = store.persist_snapshot(
        greenhouse_id=greenhouse_id,
        crop="cucumber",
        snapshot_time=datetime(2026, 4, 7, 11, 0, tzinfo=UTC),
        adapter_name=after_adapter.name,
        adapter_version=after_adapter.version,
        normalized_snapshot=build_cucumber_snapshot(
            after_adapter,
            greenhouse_id=greenhouse_id,
            snapshot_time=datetime(2026, 4, 7, 11, 0, tzinfo=UTC),
        ),
        raw_adapter_state=after_adapter.dump_state(),
        source="test",
    )
    event = store.persist_work_event(
        greenhouse_id=greenhouse_id,
        crop="cucumber",
        event_time=datetime(2026, 4, 7, 11, 0, tzinfo=UTC),
        event_type="leaf_removal",
        payload={
            "event_type": "leaf_removal",
            "leaves_removed_count": 2,
            "target_leaf_count": 16,
            "reason_code": "shade_reduction",
            "operator": "tester",
        },
        before_snapshot_id=before_snapshot["snapshot_id"],
        after_snapshot_id=after_snapshot["snapshot_id"],
        operator="tester",
        reason_code="shade_reduction",
        confidence=0.82,
    )
    store.upsert_current_state(
        greenhouse_id=greenhouse_id,
        crop="cucumber",
        latest_snapshot_id=after_snapshot["snapshot_id"],
        latest_event_id=event["event_id"],
    )

    payload = advisor_orchestration.build_advisor_tab_response(
        tab_name="work",
        crop="cucumber",
        greenhouse_id=greenhouse_id,
        dashboard={
            "forecast": {"total_harvest_kg": 2.4},
            "metrics": {
                "growth": {"nodeCount": 18},
                "yield": {"predictedWeekly": 11.2, "harvestableFruits": 17},
            },
            "weather": {
                "current": {"relative_humidity_pct": 84.0},
                "daily": [{"temperature_max_c": 29.0}],
            },
            "rtr": {"live": {"deltaTempC": -0.8}},
            "data": {"humidity": 84.0, "vpd": 0.64, "transpiration": 0.16},
        },
    )

    compare = payload["machine_payload"]["work_event_compare"]
    assert compare["status"] == "ready"
    assert compare["history"][0]["event_type"] == "leaf_removal"
    assert compare["history"][0]["action"] == "하위엽 2매 제거"
    assert compare["current_state"]["leaf_count"] == 16
    assert compare["recommended_action"] in {option["action"] for option in compare["options"]}
    candidate_event = next(
        option for option in compare["options"] if option["comparison_kind"] == "candidate_event"
    )
    assert candidate_event["event_type"] == "leaf_removal"
    assert "leaf_count_delta" in candidate_event["immediate_state_delta"]
    assert payload["machine_payload"]["internal_provenance"]["work_event_compare"][
        "baseline_snapshot_id"
    ] == after_snapshot["snapshot_id"]
    assert payload["machine_payload"]["internal_provenance"]["work_event_compare"][
        "greenhouse_id"
    ] == greenhouse_id


def test_build_advisor_tab_response_work_degrades_compare_when_logged_payload_is_malformed(
    monkeypatch: pytest.MonkeyPatch,
    tmp_path,
) -> None:
    from model_informed_greenhouse_dashboard.backend.app.services.crop_models.cucumber_growth_model import (
        build_cucumber_snapshot,
    )
    from model_informed_greenhouse_dashboard.backend.app.services.model_runtime import (
        model_state_store,
    )

    monkeypatch.setattr(
        advisor_orchestration,
        "build_knowledge_catalog",
        lambda crop: _catalog_stub(),
    )
    monkeypatch.setattr(
        advisor_orchestration,
        "build_tab_advisor_context",
        lambda **_: {
            "status": "skipped",
            "summary": {"status": "skipped", "mode": "tab_seeded", "focus_domains": []},
            "llm_context": None,
            "internal_provenance": {"chunk_ids": [], "document_ids": []},
        },
    )
    monkeypatch.setattr(
        model_state_store,
        "DEFAULT_MODEL_RUNTIME_DB_PATH",
        tmp_path / "model_runtime.sqlite3",
    )

    greenhouse_id = "gh-malformed"
    store = model_state_store.ModelStateStore()
    adapter = _seed_cucumber_runtime_state()
    snapshot = store.persist_snapshot(
        greenhouse_id=greenhouse_id,
        crop="cucumber",
        snapshot_time=datetime(2026, 4, 7, 9, 0, tzinfo=UTC),
        adapter_name=adapter.name,
        adapter_version=adapter.version,
        normalized_snapshot=build_cucumber_snapshot(
            adapter,
            greenhouse_id=greenhouse_id,
            snapshot_time=datetime(2026, 4, 7, 9, 0, tzinfo=UTC),
        ),
        raw_adapter_state=adapter.dump_state(),
        source="test",
    )
    malformed_event = store.persist_work_event(
        greenhouse_id=greenhouse_id,
        crop="cucumber",
        event_time=datetime(2026, 4, 7, 11, 0, tzinfo=UTC),
        event_type="leaf_removal",
        payload={
            "event_type": "leaf_removal",
            "leaves_removed_count": "two",
            "target_leaf_count": "sixteen",
            "reason_code": "operator_note_only",
        },
        before_snapshot_id=snapshot["snapshot_id"],
        after_snapshot_id=snapshot["snapshot_id"],
        operator="tester",
        reason_code="operator_note_only",
        confidence=0.41,
    )
    store.upsert_current_state(
        greenhouse_id=greenhouse_id,
        crop="cucumber",
        latest_snapshot_id=snapshot["snapshot_id"],
        latest_event_id=malformed_event["event_id"],
    )

    payload = advisor_orchestration.build_advisor_tab_response(
        tab_name="work",
        crop="cucumber",
        greenhouse_id=greenhouse_id,
        dashboard={
            "forecast": {"total_harvest_kg": 2.4},
            "metrics": {
                "growth": {"nodeCount": 18},
                "yield": {"predictedWeekly": 11.2, "harvestableFruits": 17},
            },
            "weather": {
                "current": {"relative_humidity_pct": 84.0},
                "daily": [{"temperature_max_c": 29.0}],
            },
            "rtr": {"live": {"deltaTempC": -0.8}},
            "data": {"humidity": 84.0, "vpd": 0.64, "transpiration": 0.16},
        },
    )

    compare = payload["machine_payload"]["work_event_compare"]
    assert payload["status"] == "success"
    assert compare["status"] == "ready"
    assert compare["history"][0]["action"] == "적엽 기록"
    assert compare["options"]
    assert payload["machine_payload"]["internal_provenance"]["work_event_compare"][
        "greenhouse_id"
    ] == greenhouse_id


def test_build_advisor_tab_response_work_degrades_compare_when_store_is_unavailable(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(
        advisor_orchestration,
        "build_knowledge_catalog",
        lambda crop: _catalog_stub(),
    )
    monkeypatch.setattr(
        advisor_orchestration,
        "build_tab_advisor_context",
        lambda **_: {
            "status": "skipped",
            "summary": {"status": "skipped", "mode": "tab_seeded", "focus_domains": []},
            "llm_context": None,
            "internal_provenance": {"chunk_ids": [], "document_ids": []},
        },
    )

    def _raise_store() -> None:
        raise OSError("read-only")

    monkeypatch.setattr(advisor_orchestration, "ModelStateStore", _raise_store)

    payload = advisor_orchestration.build_advisor_tab_response(
        tab_name="work",
        crop="cucumber",
        greenhouse_id="gh-readonly",
        dashboard={},
    )

    compare = payload["machine_payload"]["work_event_compare"]
    assert payload["status"] == "success"
    assert compare["status"] == "history-unavailable"
    assert compare["options"] == []
    assert "잠시 비활성화" in compare["summary"]
    assert payload["machine_payload"]["internal_provenance"]["work_event_compare"][
        "status"
    ] == "store-unavailable"


def test_build_work_event_compare_payload_supports_tomato_fruit_thinning_candidates(
    monkeypatch: pytest.MonkeyPatch,
    tmp_path,
) -> None:
    from model_informed_greenhouse_dashboard.backend.app.services.crop_models.tomato_growth_model import (
        build_tomato_snapshot,
    )
    from model_informed_greenhouse_dashboard.backend.app.services.model_runtime import (
        model_state_store,
    )

    monkeypatch.setattr(
        model_state_store,
        "DEFAULT_MODEL_RUNTIME_DB_PATH",
        tmp_path / "model_runtime.sqlite3",
    )

    store = model_state_store.ModelStateStore()
    adapter = _seed_tomato_runtime_state()
    snapshot = store.persist_snapshot(
        greenhouse_id="tomato",
        crop="tomato",
        snapshot_time=datetime(2026, 4, 7, 10, 0, tzinfo=UTC),
        adapter_name=adapter.name,
        adapter_version=adapter.version,
        normalized_snapshot=build_tomato_snapshot(
            adapter,
            greenhouse_id="tomato",
            snapshot_time=datetime(2026, 4, 7, 10, 0, tzinfo=UTC),
        ),
        raw_adapter_state=adapter.dump_state(),
        source="test",
    )
    store.upsert_current_state(
        greenhouse_id="tomato",
        crop="tomato",
        latest_snapshot_id=snapshot["snapshot_id"],
    )

    compare = advisor_orchestration._build_work_event_compare_payload("tomato")["payload"]

    assert compare["status"] == "ready"
    actions = {option["action"] for option in compare["options"]}
    assert actions >= {"현재 착과수 유지", "감과 보류"}
    thinning_option = next(
        option for option in compare["options"] if option["comparison_kind"] == "candidate_event"
    )
    assert thinning_option["event_type"] == "fruit_thinning"
    assert thinning_option["immediate_state_delta"]["fruit_load_delta"] < 0


def test_build_advisor_tab_response_rejects_unknown_tabs() -> None:
    with pytest.raises(ValueError, match="Unsupported advisor tab"):
        advisor_orchestration.build_advisor_tab_response(
            tab_name="unknown-tab",
            crop="tomato",
        )


def _runtime_ready_dashboard() -> dict[str, object]:
    return {
        "data": {
            "timestamp": 1_775_430_000_000,
            "temperature": 25.8,
            "canopyTemp": 26.7,
            "humidity": 78.0,
            "vpd": 1.02,
            "transpiration": 0.19,
            "stomatalConductance": 0.24,
            "photosynthesis": 12.8,
            "co2": 610.0,
            "light": 340.0,
        },
        "metrics": {
            "growth": {
                "lai": 3.1,
                "biomass": 2950.0,
                "growthRate": 6.8,
                "activeTrusses": 8,
            },
            "yield": {
                "predictedWeekly": 11.4,
                "harvestableFruits": 18,
            },
        },
        "forecast": {
            "total_harvest_kg": 4.1,
        },
        "recentSummary": {
            "variables": {
                "temperature": {"trend": "up"},
                "photosynthesis": {"trend": "flat"},
            }
        },
    }


def test_build_model_runtime_payload_stays_monitoring_first_when_live_signals_are_sparse() -> None:
    payload = advisor_orchestration._build_model_runtime_payload(
        crop="cucumber",
        dashboard={},
        tab_name="summary",
    )

    assert payload["status"] == "monitoring-first"
    assert payload["scenario"]["recommended"] is None
    assert payload["sensitivity"]["top_levers"] == []
    assert payload["provenance"]["source"] == "dashboard_synthesized_snapshot"


def test_build_model_runtime_payload_returns_ranked_runtime_options_for_rich_dashboard() -> None:
    payload = advisor_orchestration._build_model_runtime_payload(
        crop="tomato",
        dashboard=_runtime_ready_dashboard(),
        tab_name="environment",
    )

    assert payload["status"] == "ready"
    assert payload["state_snapshot"]["lai"] == pytest.approx(3.1)
    assert payload["sensitivity"]["target"] == "predicted_yield_14d"
    assert payload["sensitivity"]["top_levers"]
    assert payload["scenario"]["baseline_outputs"]
    assert payload["recommendations"]
    assert payload["scenario"]["recommended"] is not None


def test_build_advisor_summary_response_exposes_additive_model_runtime_block(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(
        advisor_orchestration,
        "build_knowledge_catalog",
        lambda crop: _catalog_stub(),
    )
    monkeypatch.setattr(
        advisor_orchestration,
        "generate_consulting",
        lambda **_: "## Executive Summary\n- bounded summary",
    )
    monkeypatch.setattr(
        advisor_orchestration,
        "build_summary_advisor_context",
        lambda **_: {
            "status": "skipped",
            "summary": {
                "status": "skipped",
                "mode": "summary_seeded",
                "query_count": 0,
                "returned_count": 0,
                "focus_domains": [],
            },
            "llm_context": None,
            "internal_provenance": {
                "knowledge_queries": [],
                "document_ids": [],
                "chunk_ids": [],
                "confidence_source": ["not_requested"],
            },
        },
    )

    payload = advisor_orchestration.build_advisor_summary_response(
        crop="tomato",
        dashboard=_runtime_ready_dashboard(),
        language="ko",
    )

    assert payload["family"] == "advisor_summary"
    assert payload["machine_payload"]["actions"] == []
    assert payload["machine_payload"]["model_runtime"]["status"] == "ready"
    assert payload["machine_payload"]["model_runtime"]["recommendations"]


def test_build_advisor_chat_response_keeps_legacy_text_and_adds_runtime_focus(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(
        advisor_orchestration,
        "build_knowledge_catalog",
        lambda crop: _catalog_stub(),
    )
    monkeypatch.setattr(
        advisor_orchestration,
        "generate_chat_reply",
        lambda **_: "CO2 response",
    )
    monkeypatch.setattr(
        advisor_orchestration,
        "build_chat_advisor_context",
        lambda **_: {
            "status": "skipped",
            "summary": {
                "status": "skipped",
                "mode": "chat_seeded",
                "query_count": 0,
                "returned_count": 0,
                "focus_domains": [],
            },
            "llm_context": None,
            "internal_provenance": {
                "knowledge_queries": [],
                "document_ids": [],
                "chunk_ids": [],
                "confidence_source": ["not_requested"],
            },
        },
    )

    payload = advisor_orchestration.build_advisor_chat_response(
        crop="tomato",
        messages=[{"role": "user", "content": "지금 CO2를 100ppm 더 올리면?"}],
        dashboard=_runtime_ready_dashboard(),
        language="ko",
    )

    assert payload["text"] == "CO2 response"
    assert payload["machine_payload"]["model_runtime"]["status"] == "ready"
    assert (
        payload["machine_payload"]["model_runtime"]["provenance"]["selected_controls"][0]
        == "co2_setpoint_day"
    )


def test_build_environment_recommendation_response_keeps_legacy_keys_and_carries_model_runtime(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(
        advisor_orchestration,
        "build_knowledge_catalog",
        lambda crop: _catalog_stub(),
    )

    payload = advisor_orchestration.build_environment_recommendation_response(
        crop="tomato",
        dashboard={
            **_runtime_ready_dashboard(),
            "weather": {
                "current": {
                    "time": "2026-04-07T09:00:00+09:00",
                    "temperature_c": 21.2,
                    "relative_humidity_pct": 78.0,
                    "cloud_cover_pct": 65.0,
                    "weather_label": "Partly cloudy",
                    "is_day": True,
                },
                "daily": [
                    {
                        "date": "2026-04-07",
                        "temperature_max_c": 29.5,
                        "temperature_min_c": 16.0,
                        "precipitation_probability_max_pct": 35,
                    }
                ],
            },
            "rtr": {
                "live": {
                    "targetTempC": 23.0,
                    "deltaTempC": -0.8,
                    "balanceState": "cool-for-light",
                },
                "forecastTargets": [
                    {
                        "date": "2026-04-07",
                        "targetTempC": 22.8,
                        "radiationSumMjM2D": 15.6,
                        "weatherLabel": "Partly cloudy",
                    }
                ],
            },
        },
    )

    advisor_actions = payload["machine_payload"]["advisor_actions"]
    assert payload["family"] == "environment_recommendation"
    assert set(advisor_actions.keys()) == {"mode", "now", "today", "next_3d"}
    assert payload["machine_payload"]["environment_analysis"]["current_state"]["diagnosis"]
    assert payload["machine_payload"]["model_runtime"]["status"] == "ready"
    assert payload["machine_payload"]["model_runtime"]["scenario"]["baseline_outputs"]
