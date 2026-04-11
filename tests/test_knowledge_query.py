from fastapi.testclient import TestClient

from model_informed_greenhouse_dashboard import get_app
from model_informed_greenhouse_dashboard.backend.app.services import (
    knowledge_catalog,
    knowledge_database,
)
from model_informed_greenhouse_dashboard.backend.app.services.knowledge_catalog import (
    build_crop_knowledge_context,
    build_knowledge_catalog,
    rebuild_knowledge_catalog,
)
from model_informed_greenhouse_dashboard.backend.app.services.workbook_normalization import (
    clear_workbook_preview_cache,
)


def setup_function() -> None:
    clear_workbook_preview_cache()
    knowledge_catalog._build_knowledge_catalog_cached.cache_clear()


def test_query_knowledge_database_returns_ranked_results(
    synthetic_knowledge_assets,
) -> None:
    rebuild_knowledge_catalog("tomato")
    payload = knowledge_database.query_knowledge_database(
        crop="tomato",
        query="nutrient recipe Ca guardrail",
        limit=4,
        filters={
            "source_types": ["xlsx"],
            "asset_families": ["nutrient_workbook"],
        },
    )

    assert payload["query_status"] == "ready"
    assert payload["query_mode"] in {"intent_routed_hybrid", "lexical_fallback"}
    assert payload["routing"]["intent"] == "nutrient_recipe"
    assert payload["returned_count"] >= 1
    first_result = payload["results"][0]
    assert first_result["document"]["asset_family"] == "nutrient_workbook"
    assert first_result["document"]["source_type"] == "xlsx"
    assert any(
        any(token in result["text"].lower() for token in ("ca", "cl", "source_water"))
        for result in payload["results"]
    )


def test_query_knowledge_database_clamps_limit(
    synthetic_knowledge_assets,
) -> None:
    rebuild_knowledge_catalog("tomato")
    payload = knowledge_database.query_knowledge_database(
        crop="tomato",
        query="tomato nutrient recipe",
        limit=99,
    )

    assert payload["query_status"] == "ready"
    assert payload["limit"] == 10
    assert payload["returned_count"] <= 10


def test_query_knowledge_database_routes_unfiltered_pesticide_and_nutrient_queries(
    synthetic_knowledge_assets,
) -> None:
    rebuild_knowledge_catalog("tomato")

    pesticide_payload = knowledge_database.query_knowledge_database(
        crop="tomato",
        query="powdery mildew rotation recommendation",
        limit=4,
    )
    nutrient_payload = knowledge_database.query_knowledge_database(
        crop="tomato",
        query="calcium guardrail drain feedback",
        limit=4,
    )

    assert pesticide_payload["routing"]["intent"] == "disease_pest"
    assert pesticide_payload["applied_filters"]["asset_families"] == ["pesticide_workbook"]
    assert pesticide_payload["results"][0]["document"]["asset_family"] == "pesticide_workbook"

    assert nutrient_payload["routing"]["intent"] == "nutrient_recipe"
    assert nutrient_payload["routing"]["sub_intent"] == "drain_feedback"
    assert nutrient_payload["applied_filters"]["asset_families"] == ["nutrient_workbook"]
    assert nutrient_payload["results"][0]["document"]["asset_family"] == "nutrient_workbook"


def test_query_knowledge_database_routes_environment_queries_to_pdf_and_csv(
    synthetic_knowledge_assets,
) -> None:
    rebuild_knowledge_catalog("cucumber")
    payload = knowledge_database.query_knowledge_database(
        crop="cucumber",
        query="vpd humidity control",
        limit=4,
    )

    assert payload["routing"]["intent"] == "environment_control"
    assert payload["applied_filters"]["topic_major"] == "environment"
    assert payload["applied_filters"]["source_types"] == ["pdf", "csv"]
    assert payload["results"]
    assert payload["results"][0]["document"]["source_type"] in {"pdf", "csv"}


def test_query_knowledge_database_keeps_symptom_and_work_queries_broad_enough(
    synthetic_knowledge_assets,
) -> None:
    rebuild_knowledge_catalog("cucumber")
    symptom_payload = knowledge_database.query_knowledge_database(
        crop="cucumber",
        query="leaf symptom diagnosis",
        limit=4,
    )
    work_payload = knowledge_database.query_knowledge_database(
        crop="cucumber",
        query="pruning checklist",
        limit=4,
    )

    assert symptom_payload["routing"]["intent"] == "disease_pest"
    assert symptom_payload["routing"]["sub_intent"] == "symptom_to_action"
    assert symptom_payload["applied_filters"]["source_types"] == ["pdf", "xlsx"]
    assert "asset_families" not in symptom_payload["applied_filters"]

    assert work_payload["routing"]["intent"] == "cultivation_work"
    assert work_payload["applied_filters"]["source_types"] == ["pdf"]
    assert "topic_major" not in work_payload["applied_filters"]


def test_query_knowledge_database_database_missing_still_reports_routing(
    synthetic_knowledge_assets,
) -> None:
    payload = knowledge_database.query_knowledge_database(
        crop="tomato",
        query="powdery mildew rotation",
        limit=3,
    )

    assert payload["query_status"] == "database_missing"
    assert payload["routing"]["intent"] == "disease_pest"
    assert payload["applied_filters"]["source_types"] == ["xlsx"]
    assert payload["applied_filters"]["asset_families"] == ["pesticide_workbook"]


def test_knowledge_catalog_exposes_retrieval_surface(
    synthetic_knowledge_assets,
) -> None:
    rebuild_knowledge_catalog("cucumber")
    payload = build_knowledge_catalog("cucumber")
    context_payload = build_crop_knowledge_context("cucumber")

    assert payload["retrieval_surface"]["route"] == "/api/knowledge/query"
    assert payload["retrieval_surface"]["coverage"]["query_modes"] == [
        "intent_routed_hybrid",
        "lexical_fallback",
    ]
    assert "disease_pest" in payload["retrieval_surface"]["coverage"]["routed_intents"]
    assert payload["summary"]["retrieval_surface_status"] == "ready"
    assert context_payload["knowledge_query"]["route"] == "/api/knowledge/query"
    assert context_payload["knowledge_query"]["status"] == "ready"


def test_knowledge_query_endpoint_returns_results(
    synthetic_knowledge_assets,
) -> None:
    rebuild_knowledge_catalog("tomato")
    client = TestClient(get_app())

    response = client.post(
        "/api/knowledge/query",
        json={
            "crop": "tomato",
            "query": "powdery mildew rotation",
            "limit": 3,
            "filters": {"source_types": ["xlsx"], "asset_families": ["pesticide_workbook"]},
        },
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "success"
    assert payload["query_status"] == "ready"
    assert payload["routing"]["intent"] == "disease_pest"
    assert payload["results"]
    assert payload["results"][0]["document"]["asset_family"] == "pesticide_workbook"


def test_knowledge_query_endpoint_clamps_limit_and_rejects_empty_query(
    synthetic_knowledge_assets,
) -> None:
    rebuild_knowledge_catalog("tomato")
    client = TestClient(get_app())

    clamped_response = client.post(
        "/api/knowledge/query",
        json={
            "crop": "tomato",
            "query": "calcium guardrail",
            "limit": 999,
        },
    )

    assert clamped_response.status_code == 200
    clamped_payload = clamped_response.json()
    assert clamped_payload["status"] == "success"
    assert clamped_payload["limit"] == 10

    empty_response = client.post(
        "/api/knowledge/query",
        json={
            "crop": "tomato",
            "query": "   ",
        },
    )

    assert empty_response.status_code == 400
    assert "query must not be empty" in empty_response.json()["detail"]


def test_knowledge_query_endpoint_bootstraps_catalog_when_database_is_empty(
    monkeypatch,
) -> None:
    from model_informed_greenhouse_dashboard.backend.app import main as backend_main

    calls = {"rebuild": 0}

    def _fake_build(_crop):
        return {
            "database": {
                "status": "ready",
                "document_count": 0,
                "chunk_count": 0,
            },
            "retrieval_surface": {"status": "unavailable"},
        }

    def _fake_rebuild(_crop):
        calls["rebuild"] += 1
        return {
            "database": {
                "status": "ready",
                "document_count": 4,
                "chunk_count": 120,
            },
            "retrieval_surface": {"status": "ready"},
        }

    def _fake_query_knowledge_database(**kwargs):
        return {
            "query_status": "ready",
            "crop_scope": kwargs.get("crop"),
            "resolved_scope": kwargs.get("crop"),
            "query": kwargs.get("query"),
            "query_mode": "intent_routed_hybrid",
            "limit": kwargs.get("limit"),
            "returned_count": 1,
            "filters": kwargs.get("filters") or {},
            "applied_filters": {},
            "routing": {"intent": "general_chat", "sub_intent": None, "rerank_profile": "general", "expanded_terms": []},
            "results": [
                {
                    "chunk_id": 1,
                    "document_id": 1,
                    "source_locator": "p1",
                    "score": 10.0,
                    "text": "sample",
                    "chunk_type": "paragraph",
                    "topic_major": "environment",
                    "topic_minor": "telemetry",
                    "document": {
                        "title": "sample doc",
                        "filename": "sample.pdf",
                        "relative_path": "data/sample.pdf",
                        "asset_family": "manual",
                        "source_type": "pdf",
                        "crop_scopes": ["tomato"],
                    },
                }
            ],
            "database": {"status": "ready"},
        }

    monkeypatch.setattr(backend_main, "build_knowledge_catalog", _fake_build)
    monkeypatch.setattr(backend_main, "rebuild_knowledge_catalog", _fake_rebuild)
    monkeypatch.setattr(backend_main, "query_knowledge_database", _fake_query_knowledge_database)

    client = TestClient(get_app())
    response = client.post(
        "/api/knowledge/query",
        json={"crop": "tomato", "query": "온실 상태", "limit": 3},
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "success"
    assert payload["catalog_bootstrapped"] is True
    assert payload["query_status"] == "ready"
    assert payload["returned_count"] == 1
    assert calls["rebuild"] == 1
