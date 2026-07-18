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
from model_informed_greenhouse_dashboard.backend.app.services.knowledge_query_router import (
    route_knowledge_query,
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
    # `markdown` is in the allowlist so a governed curated-wiki source stays
    # reachable; `xlsx` must stay out so environment queries never drift into the
    # pesticide/nutrient workbooks.
    assert payload["applied_filters"]["source_types"] == ["pdf", "csv", "markdown"]
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
    assert symptom_payload["applied_filters"]["source_types"] == ["pdf", "xlsx", "markdown"]
    assert "asset_families" not in symptom_payload["applied_filters"]

    assert work_payload["routing"]["intent"] == "cultivation_work"
    assert work_payload["applied_filters"]["source_types"] == ["pdf", "markdown"]
    assert "topic_major" not in work_payload["applied_filters"]


def test_query_knowledge_database_routes_cucumber_cultivation_terms_away_from_pesticides(
    synthetic_knowledge_assets,
) -> None:
    rebuild_knowledge_catalog("cucumber")

    route = route_knowledge_query("오이재배방법")
    assert route["intent"] == "cultivation_work"
    assert route["search_filters"]["source_types"] == ["pdf", "markdown"]
    assert {"오이", "재배", "방법"}.issubset(set(route["query_terms"]))

    payload = knowledge_database.query_knowledge_database(
        crop="cucumber",
        query="오이재배방법",
        limit=4,
    )
    short_payload = knowledge_database.query_knowledge_database(
        crop="cucumber",
        query="오이 방법",
        limit=4,
    )
    pesticide_payload = knowledge_database.query_knowledge_database(
        crop="cucumber",
        query="오이 방제 방법",
        limit=4,
    )

    assert payload["routing"]["intent"] == "cultivation_work"
    assert payload["applied_filters"]["source_types"] == ["pdf", "markdown"]
    assert payload["returned_count"] >= 1
    assert all(
        result["document"]["asset_family"] != "pesticide_workbook"
        for result in payload["results"]
    )

    assert short_payload["routing"]["intent"] == "cultivation_work"
    assert short_payload["results"]
    assert short_payload["results"][0]["document"]["asset_family"] != "pesticide_workbook"

    assert pesticide_payload["routing"]["intent"] == "disease_pest"
    assert pesticide_payload["applied_filters"]["source_types"] == ["pdf", "xlsx", "markdown"]


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


def test_naturally_phrased_korean_physiology_questions_route_to_crop_physiology() -> None:
    """Korean is agglutinative: the bare keyword never appears in a real question.

    Before 2026-07-17 all four of these fell through to `general_chat` because
    `_KOREAN_COMPOUND_TERMS` held no physiology vocabulary, which left the
    `crop_physiology` profile — and its topic filter and rerank profile —
    unreachable for anything a grower would actually type.
    """
    questions = [
        "토마토 생리장해 원인과 대책",
        "마디 증가 속도는 온도에 따라 어떻게 달라지나요",
        "광합성이 잘 안되는 것 같아요",
        "착과율이 떨어집니다",
        "화방 출현이 늦어요",
        "초세가 너무 강합니다",
    ]
    for question in questions:
        route = route_knowledge_query(question)
        assert route["intent"] == "crop_physiology", f"{question!r} -> {route['intent']}"
        assert route["rerank_profile"] == "physiology"


def test_physiology_vocabulary_does_not_steal_other_intents() -> None:
    """The added compounds must not pull unrelated questions into physiology."""
    for question, expected in (
        ("흰가루병 방제 농약과 안전사용기준", "disease_pest"),
        ("양액 처방 EC 보정", "nutrient_recipe"),
        ("온도 습도 환기 설정", "environment_control"),
        ("수확 시기와 출하 등급", "harvest_market"),
        ("적엽 유인 작업 체크리스트", "cultivation_work"),
        ("오이재배방법", "cultivation_work"),
    ):
        route = route_knowledge_query(question)
        assert route["intent"] == expected, f"{question!r} -> {route['intent']}"
