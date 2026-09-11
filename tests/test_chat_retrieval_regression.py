from __future__ import annotations

import pytest
import json

from model_informed_greenhouse_dashboard.backend.app.services import (
    advisor_context_builder,
    knowledge_database,
)
from model_informed_greenhouse_dashboard.backend.app.services.knowledge_query_router import (
    route_knowledge_query,
)

#: A mixed or follow-up agronomy question is a "standard" question, so the query
#: carries that tier's main-result budget rather than the _MAX_CHAT_RESULTS
#: ceiling, which only a "deep" question reaches. tests/test_hybrid_chat.py pins
#: the tier selection itself.
_STANDARD_LIMIT = advisor_context_builder._CHAT_BUDGET_TIERS["standard"][0]


def _capture_query(monkeypatch, results=()):
    calls = []

    def query(**kwargs):
        calls.append(kwargs)
        return {
            "query": kwargs["query"],
            "query_status": "ready",
            "query_mode": "intent_routed_hybrid",
            "routing": route_knowledge_query(kwargs["query"]),
            "results": list(results),
        }

    monkeypatch.setattr(advisor_context_builder, "query_knowledge_database", query)
    monkeypatch.setattr(advisor_context_builder, "fetch_knowledge_neighbors", lambda **_: [])
    return calls


@pytest.mark.parametrize(
    ("question", "resolved_crop"),
    [
        ("지금 이 시뮬레이션은 실행 중이야, 일시정지 상태야?", "tomato"),
        ("Is this simulation running or paused?", "tomato"),
        ("Is the replay paused?", "tomato"),
        ("오이 시뮬레이션은 일시정지 상태야?", "cucumber"),
    ],
)
def test_chat_pure_runtime_status_skips_literature_retrieval(monkeypatch, question, resolved_crop):
    # Observed before fix: the exact Korean status question returned unrelated
    # Tomato guide sources at page:46/108/148/287 despite runtime being paused.
    calls = _capture_query(monkeypatch)
    context = advisor_context_builder.build_chat_advisor_context(
        crop="tomato",
        messages=[
            {"role": "user", "content": "토마토 VPD와 증산은 어떤 관계야?"},
            {"role": "assistant", "content": "이전 생리 설명"},
            {"role": "user", "content": question},
        ],
    )

    assert calls == []
    assert context["status"] == "skipped"
    assert context["summary"]["query_count"] == 0
    assert context["summary"]["returned_count"] == 0
    assert context["summary"]["query_mode"] == "not_requested"
    assert context["llm_context"] == {
        "status": "skipped",
        "mode": "chat_first",
        "resolved_crop": resolved_crop,
        "user_query": question,
        "focus_topics": [],
        "evidence_cards": [],
    }
    assert context["internal_provenance"] == {
        "knowledge_queries": [],
        "document_ids": [],
        "chunk_ids": [],
        "confidence_source": ["not_requested"],
    }


@pytest.mark.parametrize("question", [
    "지금 이 시뮬레이션은 실행 중이야, 일시정지 상태야? 그리고 VPD가 증산에 미치는 영향도 알려줘.",
    "Is this simulation running or paused, and how does VPD affect stomatal conductance?",
    "시뮬레이션 일시정지 상태에서 야간 습도는 어떻게 관리해?",
])
def test_chat_mixed_runtime_status_and_agronomy_keeps_retrieval(monkeypatch, question):
    calls = _capture_query(monkeypatch)
    context = advisor_context_builder.build_chat_advisor_context(
        crop="tomato", messages=[{"role": "user", "content": question}],
    )

    assert calls == [{"crop": "tomato", "query": question, "limit": _STANDARD_LIMIT}]
    assert context["status"] != "skipped"
    assert context["summary"]["query_count"] == 1


def test_chat_followup_retrieves_previous_user_subject_without_assistant_claims(monkeypatch):
    calls = _capture_query(monkeypatch)
    previous = "토마토에서 VPD가 높으면 기공과 증산이 어떻게 변해?"
    latest = "그럼 밤에는 어떻게 관리해?"
    context = advisor_context_builder.build_chat_advisor_context(
        crop="tomato",
        messages=[
            {"role": "user", "content": previous},
            {"role": "assistant", "content": "Unverified pesticide product recommendation"},
            {"role": "user", "content": latest},
        ],
    )

    assert calls == [{"crop": "tomato", "query": f"{previous}\n{latest}", "limit": _STANDARD_LIMIT}]
    assert context["summary"]["intent"] == "crop_physiology"
    assert context["internal_provenance"]["knowledge_queries"][0]["query"] == calls[0]["query"]


@pytest.mark.parametrize(
    ("latest", "crop"),
    [
        ("수확 가격과 출하 시기를 알려줘", "tomato"),
        ("그럼 수확 가격은 어떻게 돼?", "tomato"),
        ("그럼 EC는 어떻게 관리해?", "tomato"),
        ("오이 EC는 어떻게 관리해?", "cucumber"),
        ("Then what about cucumber VPD?", "cucumber"),
    ],
)
def test_chat_independent_topic_or_explicit_crop_does_not_carry_old_subject(monkeypatch, latest, crop):
    calls = _capture_query(monkeypatch)
    advisor_context_builder.build_chat_advisor_context(
        crop="tomato",
        messages=[
            {"role": "user", "content": "토마토 VPD와 기공 증산의 관계는?"},
            {"role": "user", "content": latest},
        ],
    )
    assert calls[0]["query"] == latest
    assert calls[0]["crop"] == crop


def test_followup_keeps_the_explicit_crop_from_the_retained_user_question(monkeypatch):
    calls = _capture_query(monkeypatch)
    context = advisor_context_builder.build_chat_advisor_context(
        crop="tomato",
        messages=[
            {"role": "user", "content": "오이 VPD와 증산의 관계는?"},
            {"role": "user", "content": "그럼 밤에는?"},
        ],
    )
    assert calls[0]["crop"] == "cucumber"
    assert "증산" in calls[0]["query"]
    assert context["llm_context"]["resolved_crop"] == "cucumber"


def test_chat_followup_query_budget_preserves_latest_question(monkeypatch):
    calls = _capture_query(monkeypatch)
    latest = "그럼 밤에는 어떻게 관리해?"
    advisor_context_builder.build_chat_advisor_context(
        crop="tomato",
        messages=[
            {"role": "user", "content": "unrelated earlier question"},
            {"role": "user", "content": "VPD 증산 " + "details " * 300},
            {"role": "user", "content": latest},
        ],
    )
    assert len(calls[0]["query"]) <= 1200
    assert calls[0]["query"].endswith(latest)
    assert calls[0]["query"].startswith("VPD 증산")
    assert "unrelated earlier question" not in calls[0]["query"]


def test_chat_followup_history_has_a_fixed_user_turn_budget(monkeypatch):
    calls = _capture_query(monkeypatch)
    advisor_context_builder.build_chat_advisor_context(
        crop="tomato",
        messages=[
            {"role": "user", "content": "VPD와 증산"},
            {"role": "user", "content": "그럼 밤에는?"},
            {"role": "assistant", "content": "not a retrieval seed"},
            {"role": "user", "content": "그럼 야간에는?"},
            {"role": "user", "content": "그럼 주간에는?"},
        ],
    )
    assert calls[0]["query"] == "그럼 밤에는?\n그럼 야간에는?\n그럼 주간에는?"


def test_chat_compact_card_preserves_exact_source_identity_and_excerpt(monkeypatch):
    calls = _capture_query(monkeypatch, [{
        "document_id": 17,
        "chunk_id": 204,
        "source_locator": "page:42",
        "text": "VPD\n기공과  증산",
        "topic_major": "physiology",
        "topic_minor": "manual",
        "chunk_type": "pdf_paragraph",
        "document": {"title": "토마토 생리 설명서", "relative_path": "private/source.pdf"},
    }])
    context = advisor_context_builder.build_chat_advisor_context(
        crop="tomato", messages=[{"role": "user", "content": "VPD와 증산"}],
    )

    assert len(calls) == 1
    assert context["llm_context"]["evidence_cards"] == [{
        "title": "토마토 생리 설명서",
        "source_locator": "page:42",
        "document_id": 17,
        "chunk_id": 204,
        "topic_major": "physiology",
        "topic_minor": "manual",
        "chunk_type": "pdf_paragraph",
        "evidence_excerpt": "VPD 기공과 증산",
        "source_id": "S1",
        "evidence_role": "main",
    }]


@pytest.fixture
def retrieval_rows(tmp_path, monkeypatch):
    """Build only temporary SQL rows; never parse or rebuild the real corpus."""
    monkeypatch.setattr(knowledge_database, "KNOWLEDGE_DB_DIR", tmp_path)
    path = knowledge_database.knowledge_db_path("tomato")
    with knowledge_database._connect(path) as connection:
        fts_enabled = knowledge_database._create_schema(connection)

    def add(
        text,
        *,
        title="Tomato greenhouse VPD manual",
        ordinal=1,
        crop="tomato",
        topic="environment",
        source_type="pdf",
        asset_family="manual",
    ):
        with knowledge_database._connect(path) as connection:
            document_id = knowledge_database._insert_document(connection, "tomato", {
                "id": f"fixture-{ordinal}-{crop}",
                "filename": f"fixture-{ordinal}-{crop}.{source_type}",
                "relative_path": f"fixtures/{ordinal}.{source_type}",
                "title": title,
                "crop_scopes": [crop],
                "asset_family": asset_family,
                "source_type": source_type,
                "readiness": "ready",
            })
            return knowledge_database._insert_chunk(
                connection,
                document_id=document_id,
                crop_scope="tomato",
                chunk_type="pdf_paragraph" if source_type == "pdf" else "table_row",
                topic_major=topic,
                topic_minor=asset_family,
                source_locator=f"page:{ordinal}",
                ordinal=ordinal,
                text_content=text,
                metadata={},
            )

    monkeypatch.setattr(knowledge_database, "inspect_knowledge_database", lambda _: {
        "status": "ready", "resolved_scope": "tomato", "fts_enabled": fts_enabled,
    })
    return add


@pytest.mark.parametrize("fts_enabled", [True, False])
def test_query_rejects_cover_and_expansion_only_hits_before_candidate_limit(
    retrieval_rows, monkeypatch, fts_enabled,
):
    add = retrieval_rows
    add("Tomato greenhouse VPD manual " * 6)
    for ordinal in range(2, 42):
        add(
            "Tomato greenhouse humidity temperature CO2 telemetry management with EC feeding.",
            ordinal=ordinal,
        )
    relevant_id = add(
        "VPD appears in this substantive paragraph with a specific explanation of vapour demand.",
        title="Greenhouse reference",
        ordinal=120,
    )
    # Force each candidate path independently, while all tables remain temporary.
    monkeypatch.setattr(knowledge_database, "inspect_knowledge_database", lambda _: {
        "status": "ready", "resolved_scope": "tomato", "fts_enabled": fts_enabled,
    })

    payload = knowledge_database.query_knowledge_database(crop="tomato", query="tomato VPD", limit=3)

    assert [result["chunk_id"] for result in payload["results"]] == [relevant_id]
    assert payload["results"][0]["source_locator"] == "page:120"
    assert payload["results"][0]["document"]["title"] == "Greenhouse reference"


def test_query_returns_no_grounding_for_generic_crop_or_expansion_only_matches(retrieval_rows):
    retrieval_rows("Tomato greenhouse temperature humidity telemetry controls.")
    for query in ("tomato VPD", "tomato"):
        context = advisor_context_builder.build_chat_advisor_context(
            crop="tomato", messages=[{"role": "user", "content": query}],
        )
        assert context["status"] == "no_matches"
        assert context["summary"]["returned_count"] == 0
        assert context["llm_context"]["evidence_cards"] == []


def test_caller_body_keywords_outrank_routing_metadata(retrieval_rows):
    partial_id = retrieval_rows(
        "기공에 대한 다른 설명과 여러 추가 문장이 포함된 자료입니다.",
        title="Tomato photosynthesis transpiration growth canopy manual",
        topic="physiology",
        ordinal=1,
    )
    relevant_id = retrieval_rows(
        "야간 VPD와 기공 반응 및 증산의 관계를 설명하는 본문 근거입니다.",
        title="작물 참고 자료",
        topic="physiology",
        ordinal=50,
    )

    payload = knowledge_database.query_knowledge_database(
        crop="tomato", query="토마토에서 VPD가 높으면 기공과 증산이 어떻게 변해?", limit=2,
    )
    assert [result["chunk_id"] for result in payload["results"]] == [relevant_id, partial_id]
    assert payload["results"][0]["score"] > payload["results"][1]["score"]


def test_inferred_topic_keeps_matching_management_passages(retrieval_rows):
    retrieval_rows(
        "환기 > 환기 > 습도의 이해 > 증산가능량(포차, VPD: Vapour Pressure Deficit) > "
        "온도별 적정 상대습도 및 포화수증기압차 > 온실 내 습도 관리 방법 > 온실 환경관리 제어 과정",
        topic="management", ordinal=2,
    )
    gas_id = retrieval_rows(
        "기공으로 가스가 들어가 피해를 주는 난방기 가스 장해 설명입니다.",
        topic="physiology", ordinal=1,
    )
    physiology_id = retrieval_rows(
        "VPD와 기공 반응 및 증산의 관계를 설명하는 재배 관리 본문입니다.",
        topic="management", ordinal=50,
    )
    query = "토마토 VPD 기공 증산"
    inferred = knowledge_database.query_knowledge_database(crop="tomato", query=query, limit=2)
    assert "topic_major" not in inferred["applied_filters"]
    assert [item["chunk_id"] for item in inferred["results"]] == [physiology_id, gas_id]

    explicit = knowledge_database.query_knowledge_database(
        crop="tomato", query=query, limit=2, filters={"topic_major": "physiology"},
    )
    assert explicit["applied_filters"]["topic_major"] == "physiology"
    assert [item["chunk_id"] for item in explicit["results"]] == [gas_id]


def test_query_respects_explicit_filters_crop_and_structured_pesticide_policy(retrieval_rows):
    relevant_id = retrieval_rows(
        "VPD is explained in this selected physiology reference passage.",
        topic="physiology",
        ordinal=10,
    )
    retrieval_rows("VPD is explained for a different crop here.", crop="cucumber", topic="physiology")
    retrieval_rows("VPD is explained in a different source type here.", source_type="csv", topic="physiology")
    filters = {"source_types": ["pdf"], "topic_major": "physiology"}
    payload = knowledge_database.query_knowledge_database(
        crop="tomato", query="VPD", filters=filters,
    )
    assert payload["applied_filters"] == filters
    assert [result["chunk_id"] for result in payload["results"]] == [relevant_id]

    for query in ("powdery mildew rotation", "fungicide product recommendation"):
        route = route_knowledge_query(query)
        assert route["search_filters"] == {
            "asset_families": ["pesticide_workbook"], "source_types": ["xlsx"],
        }


def test_caller_term_matches_do_not_treat_ec_or_ca_as_substrings(retrieval_rows):
    retrieval_rows("Recommended canopy measurements include leaf structure and growth.", topic="physiology")
    payload = knowledge_database.query_knowledge_database(
        crop="tomato", query="EC Ca", filters={"topic_major": "physiology", "source_types": ["pdf"]},
    )
    assert payload["results"] == []


def test_nutrient_recipe_chat_retains_manual_tables_and_current_workbook(tmp_path, monkeypatch):
    """Exercise the UI wording, late split table and legacy workbook metadata."""
    db = knowledge_database
    wb = db.workbook_normalization
    monkeypatch.setattr(db, "KNOWLEDGE_DB_DIR", tmp_path / "db")
    monkeypatch.setattr(db, "REPO_ROOT", tmp_path)
    monkeypatch.setattr(wb, "DATA_ROOT", tmp_path / "data")
    wb.DATA_ROOT.mkdir()
    source = wb.DATA_ROOT / wb.NUTRIENT_WORKBOOK
    source.write_text("source revision one", encoding="utf-8")
    path = db.knowledge_db_path("cucumber")
    path.parent.mkdir()
    recipe = {"crop": "cucumber", "medium": "무기배지(암면 등)", "stage": "Start",
              "source_sheet": "추천레시피_DB", "source_row": 7, "source_key": "cucumber-start",
              "ec_target": 2.2, "n_no3": 16, "p": 1.25, "s": 1.375, "mo": 0.5,
              "nutrient_units": {"ec_target": "mS/cm", "n_no3": "mmol/L", "p": "mmol/L",
                                 "s": "mmol/L", "mo": "µmol/L"}}
    monkeypatch.setattr(db, "export_nutrient_reference_rows", lambda _: {"recipes": [recipe]})
    with db._connect(path) as connection:
        enabled = db._create_schema(connection)
        def document(name, kind="pdf", crop="cucumber"):
            return db._insert_document(connection, "cucumber", {
                "id": name, "filename": name, "relative_path": f"data/{name}", "title": name,
                "crop_scopes": [crop], "asset_family": "nutrient_workbook" if kind == "xlsx" else "manual",
                "source_type": kind, "readiness": "ready",
            })
        def chunk(doc, text, ordinal, page, kind="pdf_paragraph", metadata=None):
            return db._insert_chunk(connection, document_id=doc, crop_scope="cucumber",
                chunk_type=kind, topic_major="management", topic_minor="recipe",
                source_locator=page, ordinal=ordinal, text_content=text, metadata=metadata or {})
        manual = document("오이_농업기술대계.pdf")
        for ordinal in range(1, 46):
            chunk(manual, "育苗の養液と培養液の配合について一般的な説明。", ordinal, f"page:{ordinal}")
        table = chunk(manual, "第1表 栽培に使用する肥料の成分組成（単位：％）", 100, "page:815")
        values = chunk(manual, "養液土耕1号 TN 15 P2O5 8 K2O 16。土耕で使用する肥料。", 101, "page:815")
        guide = document("오이_길잡이.pdf")
        guide_id = chunk(guide, "양액 조성 참고표 다량원소 mmol/L; 이 표의 재배 조건에 한정한다.", 1, "page:100")
        wrong_crop = document("토마토.pdf", crop="tomato")
        wrong_id = chunk(wrong_crop, "양액 조성 표 mmol/L 토마토 전용", 1, "page:144")
        workbook = document(wb.NUTRIENT_WORKBOOK, "xlsx")
        stale = {**recipe, "p": None, "s": None, "mo": 15}
        recipe_id = chunk(workbook, "cucumber nutrient recipe Start EC 2.2 K 8 Ca 4", 1,
                          "추천레시피_DB:7", "nutrient_recipe_row", stale)
    monkeypatch.setattr(db, "inspect_knowledge_database", lambda _: {
        "status": "ready", "resolved_scope": "cucumber", "fts_enabled": enabled})
    query = "오이 현재 단계 양액 레시피와 경계 조건을 정리해줘"
    route = route_knowledge_query(query)
    assert {"nutrient", "recipe"}.issubset(route["caller_terms"])
    assert "asset_families" not in route["search_filters"]
    assert "pdf" in route["search_filters"]["source_types"]
    context = advisor_context_builder._build_raw_chat_context(
        crop="cucumber", messages=[{"role": "user", "content": query}], limit=4)
    cards = context["llm_context"]["evidence_cards"]
    ids = {card["chunk_id"] for card in cards}
    assert {table, values, recipe_id, guide_id}.issubset(ids)
    assert wrong_id not in ids
    text = next(card["evidence_excerpt"] for card in cards if card["chunk_id"] == recipe_id)
    assert "P 1.25 mmol/L" in text and "S 1.375 mmol/L" in text and "Mo 0.5 µmol/L" in text
    assert "not a farm-adjusted" in text
    # Ion-only recall must work even though the old chunk has no Mo text.
    ion = db.query_knowledge_database(crop="cucumber", query="Mo", limit=3)
    assert recipe_id in {item["chunk_id"] for item in ion["results"]}
    explicit = db.query_knowledge_database(crop="cucumber", query=query,
        filters={"source_types": ["xlsx"], "asset_families": ["nutrient_workbook"]})
    assert [item["chunk_id"] for item in explicit["results"]] == [recipe_id]
    signature = advisor_context_builder._retrieval_signature("cucumber")
    source.write_text("source revision changed in size", encoding="utf-8")
    assert advisor_context_builder._retrieval_signature("cucumber") != signature
    # Read-through does not overwrite the source-index snapshot.
    with db._connect(path) as connection:
        stored = connection.execute("SELECT metadata_json FROM knowledge_chunks WHERE chunk_id=?", (recipe_id,)).fetchone()[0]
    assert json.loads(stored)["mo"] == 15


@pytest.mark.parametrize("crop,crop_name", [("tomato", "토마토"), ("cucumber", "오이")])
def test_compendium_followup_recovers_japanese_principles_and_adjacent_conditions(
    tmp_path, monkeypatch, crop, crop_name,
):
    monkeypatch.setattr(knowledge_database, "KNOWLEDGE_DB_DIR", tmp_path)
    path = knowledge_database.knowledge_db_path(crop)
    with knowledge_database._connect(path) as connection:
        fts_enabled = knowledge_database._create_schema(connection)
        document_id = knowledge_database._insert_document(connection, crop, {
            "id": f"compendium-{crop}", "filename": f"{crop}-compendium.pdf",
            "relative_path": f"fixtures/{crop}-compendium.pdf",
            "title": f"농업기술대계 {crop_name}편", "crop_scopes": [crop],
            "asset_family": "manual", "source_type": "pdf", "readiness": "ready",
            "source_context": {"language": "ja", "region": "Japan",
                               "reference_kind": "agronomy_compendium"},
        })
        ids = []
        for ordinal, page, section, text in [
            (1, 10, "other", "夜間の作業時間と器具の配置を説明する。"),
            (2, 76, "physiology", "飽差と気孔の開閉は蒸散と湿度に関係する。" if crop == "tomato"
             else "光合成により生産した同化産物は果実肥大と乾物分配に関係する。"),
            (3, 77, "physiology", "この試験では短日条件と特定の品種を用いた。適用にはこれらの条件を考慮する。"),
            (4, 84, "management", "夜間には湿度と気孔の反応を考慮して管理する。" if crop == "tomato"
             else "夜間の温度と呼吸は同化産物の利用と果実肥大に影響する。"),
        ]:
            ids.append(knowledge_database._insert_chunk(
                connection, document_id=document_id, crop_scope=crop,
                chunk_type="pdf_paragraph", topic_major="physiology", topic_minor="manual",
                source_locator=f"page:{page}", ordinal=ordinal, text_content=text,
                metadata={"section_title": section},
            ))
    monkeypatch.setattr(knowledge_database, "inspect_knowledge_database", lambda _: {
        "status": "ready", "resolved_scope": crop, "fts_enabled": fts_enabled,
    })
    context = advisor_context_builder.build_chat_advisor_context(crop=crop, messages=[
        {"role": "user", "content": "토마토에서 VPD가 높아질 때 기공과 증산이 어떻게 달라지는지 농업기술대계를 바탕으로 설명해줘."
         if crop == "tomato" else f"{crop_name} 광합성·동화산물·과실 비대·건물 분배의 관계는?"},
        {"role": "assistant", "content": "이전 답변은 새 근거가 아니다."},
        {"role": "user", "content": "그럼 밤에는 습도를 어떻게 관리해야 해? 원리와 관리 판단을 연결해서 알려줘."
         if crop == "tomato" else "그럼 밤에는 어떻게 관리해야 해? 원리와 관리 판단을 연결해서 알려줘."},
    ])
    cards = context["llm_context"]["evidence_cards"]
    by_id = {card["chunk_id"]: card for card in cards}
    assert set(by_id) == set(ids[1:])
    assert by_id[ids[1]]["evidence_role"] == "main"
    assert by_id[ids[1]]["source_context"]["language"] == "ja"
    assert by_id[ids[1]]["source_locator"] == "page:76"
    assert by_id[ids[2]]["evidence_role"] == "adjacent"
    assert by_id[ids[2]]["context_for_chunk_id"] == ids[1]
    assert "短日条件と特定の品種" in by_id[ids[2]]["evidence_excerpt"]
    assert by_id[ids[2]]["source_locator"] == "page:77"
    assert context["llm_context"]["reading_context"]["condition_passage_found"] is True
    assert context["summary"]["query_count"] == 2
    assert [card["source_id"] for card in cards] == ["S1", "S2", "S3"]
