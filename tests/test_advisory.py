import pytest
from fastapi import HTTPException

from model_informed_greenhouse_dashboard.backend.app.services import advisory, advisory_api
from model_informed_greenhouse_dashboard.backend.app.services.knowledge_catalog import (
    build_crop_knowledge_context,
    build_knowledge_catalog,
)
from model_informed_greenhouse_dashboard.backend.app.services.advisory import (
    _build_single_fertilizer_draft,
    recommend_nutrient_correction,
    recommend_nutrient_recipe,
    recommend_pesticides,
)
from model_informed_greenhouse_dashboard.backend.app.services.workbook_normalization import (
    clear_workbook_preview_cache,
)


def setup_function() -> None:
    clear_workbook_preview_cache()


def test_recommend_pesticides_returns_crop_scoped_candidates(
    synthetic_knowledge_assets,
) -> None:
    payload = recommend_pesticides(crop="cucumber", target="powdery mildew", limit=4)

    assert payload["family"] == "pesticide"
    assert payload["crop"] == "cucumber"
    assert isinstance(payload["matched_targets"], list)
    assert payload["product_recommendations"]
    assert payload["rotation_program"]
    assert payload["registration_gate"]["policy"] == "registered_first_manual_review_deferred"
    assert payload["rotation_hardening"]["policy"] == "registered_first_unique_moa"
    assert payload["candidate_registration_status_counts"].get(
        "new-registration",
        0,
    ) >= payload["registration_status_counts"].get("new-registration", 0)
    assert all(
        row["operational_status"] == "ready"
        for row in payload["product_recommendations"]
    )
    assert all(
        row["operational_status"] in {"ready", "manual-review-required"}
        for row in payload["rotation_program"]
    )
    assert all("차" not in row["product_names"][0] for row in payload["rotation_program"])
    returned_moa_groups = [
        row["moa_code_group"] for row in payload["rotation_program"] if row["moa_code_group"]
    ]
    assert len(returned_moa_groups) == len(set(returned_moa_groups))
    assert all(
        row["registration_status"] in payload["registration_status_counts"]
        for row in payload["product_recommendations"] + payload["rotation_program"]
        if row["registration_status"]
    )


def test_recommend_pesticides_rejects_cross_crop_target_queries() -> None:
    with pytest.raises(LookupError):
        recommend_pesticides(crop="cucumber", target="토마토 잎곰팡이", limit=4)


def test_recommend_pesticides_hardens_rotation_rows_and_manual_review_flags(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    def fake_export_pesticide_reference_rows(crop: str) -> dict[str, object]:
        assert crop == "tomato"
        return {
            "family": "pesticide",
            "crop": crop,
            "products": [
                {
                    "product_names": ["안전A"],
                    "active_ingredient": "ingredient-a",
                    "target_names": ["잿빛곰팡이병"],
                    "moa_code_group": "FRAC 다2",
                    "registration_status": "new-registration",
                    "dilution": "1000배",
                    "cycle_recommendation": "7일 간격",
                    "mixing_caution": "혼용주의 A",
                    "source_sheet": "성분별_통합",
                    "source_row": 1,
                },
                {
                    "product_names": ["안전B"],
                    "active_ingredient": "ingredient-b",
                    "target_names": ["잿빛곰팡이병"],
                    "moa_code_group": "FRAC 아4",
                    "registration_status": "existing-registration",
                    "dilution": "1200배",
                    "cycle_recommendation": "5~7일 간격",
                    "mixing_caution": "혼용주의 B",
                    "source_sheet": "성분별_통합",
                    "source_row": 2,
                },
                {
                    "product_names": ["보류C"],
                    "active_ingredient": "ingredient-c",
                    "target_names": ["잿빛곰팡이병"],
                    "moa_code_group": "FRAC 다4",
                    "registration_status": "label-check-required",
                    "dilution": "1500배",
                    "cycle_recommendation": "수동 확인",
                    "mixing_caution": "혼용주의 C",
                    "source_sheet": "성분별_통합",
                    "source_row": 3,
                },
            ],
            "rotations": [
                {
                    "rotation_theme": "program",
                    "target_name": "잿빛곰팡이병",
                    "application_point": "추천 포인트",
                    "product_names": ["1차"],
                    "active_ingredient": "",
                    "moa_code_group": "1차",
                    "registration_status": "unknown",
                    "reason": "적용 환경",
                    "notes": "주의사항",
                    "source_sheet": "교호추천",
                    "source_row": 10,
                },
                {
                    "rotation_theme": "program",
                    "target_name": "잿빛곰팡이병",
                    "application_point": "잿빛곰팡이병 초발생 구간",
                    "product_names": ["안전A (다2, 2025)"],
                    "active_ingredient": "",
                    "moa_code_group": "안전A (다2, 2025)",
                    "registration_status": "unknown",
                    "reason": "첫 카드",
                    "notes": "비고 A",
                    "source_sheet": "교호추천",
                    "source_row": 11,
                },
                {
                    "rotation_theme": "program",
                    "target_name": "잿빛곰팡이병",
                    "application_point": "잿빛곰팡이병 전환 구간",
                    "product_names": ["안전A"],
                    "active_ingredient": "",
                    "moa_code_group": "FRAC 다2",
                    "registration_status": "existing-registration",
                    "reason": "중복 카드",
                    "notes": "비고 중복",
                    "source_sheet": "교호추천",
                    "source_row": 12,
                },
                {
                    "rotation_theme": "program",
                    "target_name": "잿빛곰팡이병",
                    "application_point": "잿빛곰팡이병 확대 억제",
                    "product_names": ["안전B"],
                    "active_ingredient": "",
                    "moa_code_group": "안전B (아4, 2024)",
                    "registration_status": "unknown",
                    "reason": "둘째 카드",
                    "notes": "비고 B",
                    "source_sheet": "교호추천",
                    "source_row": 13,
                },
                {
                    "rotation_theme": "program",
                    "target_name": "잿빛곰팡이병",
                    "application_point": "등록 부족 시 참고안",
                    "product_names": ["보류C"],
                    "active_ingredient": "",
                    "moa_code_group": "FRAC 다4",
                    "registration_status": "label-check-required",
                    "reason": "수동 확인",
                    "notes": "비고 C",
                    "source_sheet": "교호추천",
                    "source_row": 14,
                },
            ],
            "moa_reference": [
                {
                    "moa_code_group": "FRAC 다2",
                    "representative_ingredient": "ingredient-a",
                    "representative_products": ["안전A"],
                    "notes": "",
                    "source_sheet": "흰가루병_작용기작_전체",
                    "source_row": 1,
                },
                {
                    "moa_code_group": "FRAC 아4",
                    "representative_ingredient": "ingredient-b",
                    "representative_products": ["안전B"],
                    "notes": "",
                    "source_sheet": "흰가루병_작용기작_전체",
                    "source_row": 2,
                },
                {
                    "moa_code_group": "FRAC 다4",
                    "representative_ingredient": "ingredient-c",
                    "representative_products": ["보류C"],
                    "notes": "",
                    "source_sheet": "흰가루병_작용기작_전체",
                    "source_row": 3,
                },
            ],
        }

    monkeypatch.setattr(
        advisory,
        "export_pesticide_reference_rows",
        fake_export_pesticide_reference_rows,
    )

    payload = recommend_pesticides(crop="tomato", target="잿빛곰팡이병", limit=3)

    assert [row["product_names"][0] for row in payload["rotation_program"]] == [
        "안전A",
        "안전B",
        "보류C",
    ]
    assert payload["rotation_program"][0]["registration_status"] == "new-registration"
    assert payload["rotation_program"][0]["mixing_caution"] == "혼용주의 A"
    assert payload["rotation_program"][1]["moa_code_group"] == "FRAC 아4"
    assert payload["rotation_program"][2]["manual_review_required"] is True
    assert payload["registration_gate"]["manual_review_candidate_count"] == 2
    assert payload["registration_gate"]["returned_manual_review_count"] == 2
    assert payload["rotation_hardening"]["excluded_counts"]["malformed_or_placeholder"] == 1
    assert payload["rotation_hardening"]["excluded_counts"]["duplicate_moa"] == 1
    assert payload["rotation_hardening"]["unique_moa_groups"] == [
        "FRAC 다2",
        "FRAC 아4",
        "FRAC 다4",
    ]


def test_recommend_nutrient_recipe_returns_exact_stage_recipe(
    synthetic_knowledge_assets,
) -> None:
    payload = recommend_nutrient_recipe(crop="tomato", stage="Fruit set")

    assert payload["family"] == "nutrient"
    assert payload["crop"] == "tomato"
    assert payload["resolved"]["stage"] == "Fruit set"
    assert payload["resolved"]["stage_match"] == "exact"
    assert payload["recipe"]["stage"] == "Fruit set"
    assert payload["recipe"]["ec_target"] == 2.6
    assert payload["recipe"]["guardrails"]["cl_max"] == 8.0
    assert payload["source_water_baseline"]
    assert payload["fertilizer_catalog"]


def test_recommend_nutrient_correction_returns_guardrail_findings(
    synthetic_knowledge_assets,
) -> None:
    payload = recommend_nutrient_correction(
        crop="tomato",
        stage="Fruit set",
        source_water_mmol_l={"Cl": 9.5},
        working_solution_volume_l=1500.0,
        stock_ratio=80.0,
    )

    assert payload["family"] == "nutrient_correction"
    assert payload["crop"] == "tomato"
    assert payload["resolved"]["stage"] == "Fruit set"
    assert payload["correction_inputs"]["working_solution_volume_l"]["effective"] == 1500.0
    assert payload["correction_inputs"]["stock_ratio"]["effective"] == 80.0
    assert payload["correction_context"]["calculator_defaults"]["working_solution_volume_l"] == 1000.0
    assert payload["correction_context"]["drain_feedback_defaults"]["cl_guardrail_mmol_l"] == 5.0
    assert payload["correction_context"]["drain_feedback_policy"]["mode"] == (
        "bounded_drain_feedback_target_shift"
    )
    assert payload["correction_outputs"]["priority_findings"]
    assert payload["correction_outputs"]["priority_findings"][0]["analyte"] == "Cl"
    assert payload["correction_outputs"]["priority_findings"][0]["status"] == "above-guardrail"
    assert "drain_water_mmol_l" in payload["correction_outputs"]["required_manual_inputs"]
    assert payload["correction_outputs"]["drain_feedback_plan"]["adjusted_analytes"] == []
    assert "K" in payload["correction_outputs"]["drain_feedback_plan"]["unreviewed_analytes"]
    stock_tank_prep = payload["correction_outputs"]["stock_tank_prep"]
    assert "Cl" in stock_tank_prep["balance_basis"]["blocked_analytes"]
    assert stock_tank_prep["balance_basis"]["draft_mode"] == "single_fertilizer_stoichiometric"
    assert stock_tank_prep["balance_basis"]["macro_bundle_mode"] == "macro_lane_bundle_candidate"
    assert stock_tank_prep["balance_basis"]["target_policy"]["mode"] == (
        "bounded_drain_feedback_target_shift"
    )
    assert "K" in stock_tank_prep["balance_basis"]["target_policy"]["unreviewed_analytes"]
    assert stock_tank_prep["balance_basis"]["draft_eligible_analytes"] == [
        "N-NO3",
        "N-NH4",
        "P",
        "K",
        "Ca",
        "Mg",
        "S",
    ]
    assert stock_tank_prep["balance_basis"]["draft_unit_contract"] == {
        "nutrient_targets": "mmol/L for currently eligible macro analytes",
        "molecular_weight": "g/mol",
        "direct_contribution_per_mol": "mol nutrient per mol fertilizer",
        "stock_ratio": "unitless multiplier",
    }
    assert stock_tank_prep["balance_basis"]["stock_solution_volume_l"] == 18.75
    assert stock_tank_prep["nutrient_balance"]
    calcium_balance = next(
        row for row in stock_tank_prep["nutrient_balance"] if row["canonical_key"] == "ca"
    )
    assert calcium_balance["status"] == "needs-supplement"
    calcium_candidates = stock_tank_prep["candidate_fertilizers"]["ca"]
    assert "calcium" in calcium_candidates[0]["fertilizer_name"].lower()
    assert calcium_candidates[0]["not_sized"] is True
    assert calcium_candidates[0]["operational_status"] == "manual-review-required"
    assert calcium_candidates[0]["single_fertilizer_draft"]["status"] in {"provisional", "blocked"}
    assert calcium_candidates[0]["single_fertilizer_draft"]["measurement_coverage"][
        "baseline_analytes"
    ]
    assert (
        calcium_candidates[0]["single_fertilizer_draft"]["estimated_batch_mass"][
            "fertilizer_grams"
        ]
        > 0
    )
    calcium_target_fit = calcium_candidates[0]["single_fertilizer_draft"]["projected_target_fit"][0]
    assert calcium_target_fit["analyte"] == "Ca"
    assert calcium_target_fit["canonical_key"] == "ca"
    assert calcium_target_fit["source_origin"] in {"baseline", "submitted"}
    assert calcium_target_fit["target_mmol_l"] == 5.9
    assert calcium_target_fit["projected_total_mmol_l"] >= calcium_target_fit["target_mmol_l"]
    assert calcium_target_fit["status"] in {"meets-target", "above-target"}
    assert any(
        candidate["single_fertilizer_draft"]["status"] in {"provisional", "blocked"}
        for candidate in calcium_candidates
    )
    assert any(
        row["canonical_key"] == "b"
        for row in stock_tank_prep["unsupported_analytes"]
    )
    macro_bundle_candidates = stock_tank_prep["macro_bundle_candidates"]
    if macro_bundle_candidates:
        macro_bundle = macro_bundle_candidates[0]
        assert macro_bundle["mode"] == "macro_lane_bundle_candidate"
        assert macro_bundle["status"] == "blocked"
        assert macro_bundle["lane_order"] == ["Ca", "K", "Mg", "N-NH4"]
        assert macro_bundle["objective_order"] == ["Ca", "K", "Mg", "N-NH4", "N-NO3"]
        assert {row["tank_assignment"] for row in macro_bundle["selected_fertilizers"]} == {"A", "B"}
        assert "N-NO3" in macro_bundle["residual_to_target_mmol_l"]
        assert macro_bundle["untargeted_contributions_mmol_l"]
        assert macro_bundle["tank_batch_mass_grams"]["A"] > 0
        assert macro_bundle["tank_batch_mass_grams"]["B"] > 0
        assert macro_bundle["measurement_coverage"]["baseline_analytes"]
        assert any(
            "baseline source-water values" in reason
            for reason in macro_bundle["provisional_reasons"]
        )
        assert macro_bundle["projected_guardrail_breaches"] == [
            {
                "analyte": "Cl",
                "projected_total_mmol_l": 9.5,
                "guardrail_max_mmol_l": 8.0,
            }
        ]
    else:
        assert macro_bundle_candidates == []
    residual_safe_alternative = stock_tank_prep["residual_safe_alternative"]
    assert residual_safe_alternative["status"] in {"available", "unavailable"}
    assert residual_safe_alternative["policy"] == "prefer_no_objective_overshoot"
    if residual_safe_alternative["status"] == "available":
        assert residual_safe_alternative["recommended_bundle"]["rank"] >= 1
        assert residual_safe_alternative["recommended_bundle"]["residual_review"]["below_target_analytes"]
    else:
        assert residual_safe_alternative["recommended_bundle"] is None
    execution_summary = stock_tank_prep["macro_bundle_execution"]
    assert execution_summary["status"] in {"blocked", "unavailable"}
    assert execution_summary["stock_solution_volume_l_per_tank"] == 18.75
    assert isinstance(execution_summary["tank_plan"], list)
    assert isinstance(execution_summary["readiness_reasons"], list)
    assert isinstance(execution_summary["residual_review"]["manual_only_analytes"], list)
    if execution_summary["status"] == "blocked":
        assert execution_summary["selected_bundle_rank"] >= 1
        assert {row["tank_assignment"] for row in execution_summary["tank_plan"]} == {"A", "B"}
        assert execution_summary["measurement_coverage"]["baseline_analytes"]
        assert execution_summary["residual_review"]["unresolved_targets"]
        assert execution_summary["residual_review"]["untargeted_additions"]
        assert execution_summary["residual_review"]["guardrail_breaches"] == [
            {
                "analyte": "Cl",
                "projected_total_mmol_l": 9.5,
                "guardrail_max_mmol_l": 8.0,
            }
        ]
        assert execution_summary["residual_review"]["blocked_analyte_additions"] == []
        assert any(
            "baseline source-water values" in reason
            for reason in execution_summary["readiness_reasons"]
        )
        assert any("manual-only" in reason for reason in execution_summary["readiness_reasons"])
    else:
        assert execution_summary["selected_bundle_rank"] is None
        assert execution_summary["tank_plan"] == []
        assert any(
            "No macro bundle candidate passed" in reason
            for reason in execution_summary["readiness_reasons"]
        )


def test_nutrient_correction_rejects_negative_water_measurements(
    synthetic_knowledge_assets,
) -> None:
    with pytest.raises(ValueError, match="source_water measurement 'Ca'"):
        recommend_nutrient_correction(
            crop="tomato",
            stage="Fruit set",
            source_water_mmol_l={"Ca": -1.0},
            working_solution_volume_l=1500.0,
            stock_ratio=80.0,
        )


def test_nutrient_correction_applies_bounded_drain_feedback_target_shift(
    synthetic_knowledge_assets,
) -> None:
    payload = recommend_nutrient_correction(
        crop="tomato",
        stage="Fruit set",
        source_water_mmol_l={"Cl": 9.5},
        drain_water_mmol_l={"K": 5.5, "Ca": 5.0, "Cl": 6.0},
        working_solution_volume_l=1500.0,
        stock_ratio=80.0,
    )

    drain_feedback_plan = payload["correction_outputs"]["drain_feedback_plan"]
    assert drain_feedback_plan["mode"] == "bounded_drain_feedback_target_shift"
    assert drain_feedback_plan["adjusted_analytes"] == ["K"]
    assert drain_feedback_plan["held_analytes"] == ["Ca"]
    potassium_plan = next(
        row for row in drain_feedback_plan["adjustments"] if row["canonical_key"] == "k"
    )
    assert potassium_plan["analyte"] == "K"
    assert potassium_plan["canonical_key"] == "k"
    assert potassium_plan["review_status"] == "below-baseline"
    assert potassium_plan["recipe_target_mmol_l"] == 8.5
    assert potassium_plan["effective_target_mmol_l"] == 9.775
    assert potassium_plan["observed_drain_mmol_l"] == 5.5
    assert potassium_plan["baseline_drain_mmol_l"] == 18.19002557544757
    assert potassium_plan["status"] == "increase-target"
    assert potassium_plan["target_origin"] == "drain-feedback-adjusted"
    assert potassium_plan["clamped"] is True
    assert potassium_plan["applied_step_mmol_l"] == potassium_plan["step_cap_mmol_l"]
    assert potassium_plan["delta_from_baseline_mmol_l"] < 0
    assert "below the workbook baseline" in potassium_plan["rationale"]
    calcium_plan = next(
        row for row in drain_feedback_plan["adjustments"] if row["canonical_key"] == "ca"
    )
    assert calcium_plan["status"] == "hold-target"
    assert calcium_plan["target_origin"] in {"recipe", "recipe-default"}
    assert calcium_plan["recipe_target_mmol_l"] == 5.9
    assert calcium_plan["effective_target_mmol_l"] == 5.9
    stock_tank_prep = payload["correction_outputs"]["stock_tank_prep"]
    assert stock_tank_prep["balance_basis"]["target_policy"]["adjusted_analytes"] == ["K"]
    potassium_balance = next(
        row for row in stock_tank_prep["nutrient_balance"] if row["canonical_key"] == "k"
    )
    assert potassium_balance["recipe_target_mmol_l"] == 8.5
    assert potassium_balance["target_mmol_l"] == 9.775
    assert potassium_balance["target_origin"] == "drain-feedback-adjusted"
    assert potassium_balance["supplemental_need_mmol_l"] > 0
    residual_safe_alternative = stock_tank_prep["residual_safe_alternative"]
    assert residual_safe_alternative["status"] in {"available", "unavailable"}
    if residual_safe_alternative["status"] == "available":
        assert residual_safe_alternative["recommended_bundle"]["rank"] >= 1
        residual_review = residual_safe_alternative["recommended_bundle"]["residual_review"]
        assert residual_review["below_target_analytes"]
        assert isinstance(residual_review["unresolved_targets"], list)
        assert isinstance(residual_review["untargeted_additions"], list)
    else:
        assert residual_safe_alternative["recommended_bundle"] is None


def test_macro_bundle_candidates_block_combined_guardrail_breaches() -> None:
    bundle_candidates = advisory._build_macro_bundle_candidates(
        balance_rows=[
            {
                "canonical_key": "ca",
                "nutrient": "Ca",
                "status": "needs-supplement",
                "source_mmol_l": 1.0,
                "target_mmol_l": 5.0,
            },
            {
                "canonical_key": "k",
                "nutrient": "K",
                "status": "needs-supplement",
                "source_mmol_l": 1.0,
                "target_mmol_l": 5.0,
            },
        ],
        candidate_map={
            "ca": [
                {
                    "fertilizer_name": "Synthetic calcium chloride",
                    "formula": "CaCl2",
                    "tank_assignment": "A",
                    "single_fertilizer_draft": {
                        "status": "draft",
                        "estimated_batch_mass": {"fertilizer_grams": 100.0},
                        "projected_target_fit": [
                            {"canonical_key": "ca", "projected_delta_mmol_l": 4.0},
                            {"canonical_key": "cl", "projected_delta_mmol_l": 1.5},
                        ],
                        "projected_contributions_mmol_l": {"Ca": 4.0, "Cl": 1.5},
                        "measurement_coverage": {
                            "submitted_analytes": ["Ca", "K", "Cl"],
                            "baseline_analytes": [],
                            "missing_analytes": [],
                        },
                    },
                }
            ],
            "k": [
                {
                    "fertilizer_name": "Synthetic potassium chloride",
                    "formula": "KCl",
                    "tank_assignment": "B",
                    "single_fertilizer_draft": {
                        "status": "draft",
                        "estimated_batch_mass": {"fertilizer_grams": 120.0},
                        "projected_target_fit": [
                            {"canonical_key": "k", "projected_delta_mmol_l": 4.0},
                            {"canonical_key": "cl", "projected_delta_mmol_l": 1.7},
                        ],
                        "projected_contributions_mmol_l": {"K": 4.0, "Cl": 1.7},
                        "measurement_coverage": {
                            "submitted_analytes": ["Ca", "K", "Cl"],
                            "baseline_analytes": [],
                            "missing_analytes": [],
                        },
                    },
                }
            ],
        },
        source_reference_totals={"ca": 1.0, "k": 1.0, "cl": 7.0},
        guardrails={"cl": 8.0, "na": None, "hco3": None},
        blocked_analytes={"cl"},
    )

    assert bundle_candidates
    assert bundle_candidates[0]["status"] == "blocked"
    assert bundle_candidates[0]["blocked_analyte_additions"] == [
        {
            "analyte": "Cl",
            "projected_delta_mmol_l": 3.2,
        }
    ]
    assert bundle_candidates[0]["projected_guardrail_breaches"] == [
        {
            "analyte": "Cl",
            "projected_total_mmol_l": 10.2,
            "guardrail_max_mmol_l": 8.0,
        }
    ]
    assert any(
        "blocked guardrail watchlist" in reason
        for reason in bundle_candidates[0]["provisional_reasons"]
    )


def test_nutrient_correction_blocks_unmodeled_formula_side_effects_from_draft_sizing(
    synthetic_knowledge_assets,
) -> None:
    payload = recommend_nutrient_correction(
        crop="tomato",
        stage="Fruit set",
        source_water_mmol_l={"Cl": 9.5},
        working_solution_volume_l=1500.0,
        stock_ratio=80.0,
    )

    stock_tank_prep = payload["correction_outputs"]["stock_tank_prep"]
    draft_eligible_analytes = stock_tank_prep["balance_basis"]["draft_eligible_analytes"]
    molybdate_candidates = stock_tank_prep["candidate_fertilizers"].get("mo", [])
    iron_candidates = stock_tank_prep["candidate_fertilizers"].get("fe", [])

    if molybdate_candidates:
        assert molybdate_candidates[0]["single_fertilizer_draft"]["status"] == "blocked"
        assert any(
            "sodium" in reason.lower()
            for reason in molybdate_candidates[0]["single_fertilizer_draft"]["blocked_reasons"]
        )
    else:
        assert "Mo" not in draft_eligible_analytes

    if iron_candidates:
        assert iron_candidates[0]["single_fertilizer_draft"]["status"] == "blocked"
        assert any(
            "percentage-style commercial product notation" in reason
            for reason in iron_candidates[0]["single_fertilizer_draft"]["blocked_reasons"]
        )
    else:
        assert "Fe" not in draft_eligible_analytes


def test_nutrient_correction_blocks_micronutrient_draft_sizing_until_unit_contract_is_hardened(
    synthetic_knowledge_assets,
) -> None:
    payload = recommend_nutrient_correction(
        crop="tomato",
        stage="Fruit set",
        source_water_mmol_l={"Cl": 9.5},
        working_solution_volume_l=1500.0,
        stock_ratio=80.0,
    )

    stock_tank_prep = payload["correction_outputs"]["stock_tank_prep"]
    draft_eligible_analytes = stock_tank_prep["balance_basis"]["draft_eligible_analytes"]
    manganese_candidates = stock_tank_prep["candidate_fertilizers"].get("mn", [])
    zinc_candidates = stock_tank_prep["candidate_fertilizers"].get("zn", [])

    if manganese_candidates:
        assert manganese_candidates[0]["single_fertilizer_draft"]["status"] == "blocked"
        assert any(
            "macro analytes" in reason
            for reason in manganese_candidates[0]["single_fertilizer_draft"]["blocked_reasons"]
        )
    else:
        assert "Mn" not in draft_eligible_analytes

    if zinc_candidates:
        assert zinc_candidates[0]["single_fertilizer_draft"]["status"] == "blocked"
        assert any(
            "macro analytes" in reason
            for reason in zinc_candidates[0]["single_fertilizer_draft"]["blocked_reasons"]
        )
    else:
        assert "Zn" not in draft_eligible_analytes


def test_single_fertilizer_draft_blocks_projected_guardrail_breaches() -> None:
    draft = _build_single_fertilizer_draft(
        {
            "fertilizer_name": "Synthetic potassium chloride",
            "formula": "KCl",
            "molecular_weight": 74.5513,
            "nutrient_contribution_per_mol": {"k": 1.0, "cl": 1.0},
        },
        nutrient_key="k",
        supplemental_need_mmol_l=5.0,
        submitted_measurements={},
        baseline_index={"k": {"mmol_l": 0.0}, "cl": {"mmol_l": 7.0}},
        recipe_targets={"k": 5.0, "cl": None},
        guardrails={"cl": 8.0},
        blocked_analytes=set(),
        working_solution_volume_l=1000.0,
        stock_ratio=100.0,
    )

    assert draft["status"] == "blocked"
    assert draft["projected_guardrail_breaches"] == [
        {
            "analyte": "Cl",
            "canonical_key": "cl",
            "guardrail_max_mmol_l": 8.0,
            "projected_total_mmol_l": 12.0,
        }
    ]
    assert any(
        "Projected Cl would exceed the workbook guardrail" in reason
        for reason in draft["blocked_reasons"]
    )


def test_knowledge_catalog_exposes_advisory_surfaces(synthetic_knowledge_assets) -> None:
    payload = build_knowledge_catalog("cucumber")

    assert payload["summary"]["advisory_surface_names"] == [
        "environment",
        "nutrient",
        "nutrient_correction",
        "pesticide",
        "work",
    ]
    assert payload["advisory_surfaces"]["environment"]["route"] == "/api/environment/recommend"
    assert (
        payload["advisory_surfaces"]["environment"]["delegate_route"]
        == "/api/advisor/tab/environment"
    )
    assert (
        payload["advisory_surfaces"]["environment"]["coverage"]["advisory_mode"]
        == "dashboard_fed_deterministic"
    )
    assert payload["advisory_surfaces"]["pesticide"]["route"] == "/api/pesticides/recommend"
    assert payload["advisory_surfaces"]["pesticide"]["coverage"]["target_names"]
    assert payload["advisory_surfaces"]["pesticide"]["coverage"]["registration_status_counts"]
    assert (
        payload["advisory_surfaces"]["pesticide"]["coverage"]["rotation_hardening_policy"]
        == "registered_first_unique_moa"
    )
    assert payload["advisory_surfaces"]["nutrient"]["route"] == "/api/nutrients/recommend"
    assert payload["advisory_surfaces"]["nutrient"]["coverage"]["stages"]
    assert (
        payload["advisory_surfaces"]["nutrient_correction"]["route"]
        == "/api/nutrients/correction"
    )
    assert payload["advisory_surfaces"]["nutrient_correction"]["coverage"]["source_water_analytes"]
    assert (
        payload["advisory_surfaces"]["nutrient_correction"]["coverage"]["stock_tank_draft_mode"]
        == "single_fertilizer_stoichiometric"
    )
    assert (
        payload["advisory_surfaces"]["nutrient_correction"]["coverage"]["macro_bundle_mode"]
        == "macro_lane_bundle_candidate"
    )
    assert (
        payload["advisory_surfaces"]["nutrient_correction"]["coverage"]["correction_policy"]
        == "partial_input_provisional_bundle_recheck"
    )
    assert (
        payload["advisory_surfaces"]["nutrient_correction"]["coverage"]["drain_feedback_policy"]
        == "bounded_drain_feedback_target_shift"
    )
    assert (
        payload["advisory_surfaces"]["nutrient_correction"]["coverage"]["residual_policy"]
        == "prefer_no_objective_overshoot"
    )
    assert payload["advisory_surfaces"]["nutrient_correction"]["coverage"]["calculator_defaults"][
        "working_solution_volume_l"
    ]
    assert payload["advisory_surfaces"]["work"]["route"] == "/api/work/recommend"
    assert payload["advisory_surfaces"]["work"]["delegate_route"] == "/api/advisor/tab/work"
    assert payload["advisory_surfaces"]["work"]["coverage"]["signals"]


def test_crop_knowledge_context_includes_deterministic_advisory_summary(synthetic_knowledge_assets) -> None:
    payload = build_crop_knowledge_context("tomato")

    assert payload["deterministic_advisory"]["environment"]["status"] == "ready"
    assert payload["deterministic_advisory"]["environment"]["request_contract"]["required"] == [
        "crop"
    ]
    assert payload["deterministic_advisory"]["pesticide"]["status"] == "ready"
    assert payload["deterministic_advisory"]["pesticide"]["request_contract"]["required"] == [
        "crop",
        "target",
    ]
    assert payload["deterministic_advisory"]["pesticide"]["coverage"]["manual_review_statuses"]
    assert payload["deterministic_advisory"]["nutrient"]["status"] == "ready"
    assert "stage" in payload["deterministic_advisory"]["nutrient"]["request_contract"]["optional"]
    assert payload["deterministic_advisory"]["nutrient_correction"]["status"] == "ready"
    assert (
        "source_water_mmol_l"
        in payload["deterministic_advisory"]["nutrient_correction"]["request_contract"]["optional"]
    )
    assert (
        payload["deterministic_advisory"]["nutrient_correction"]["coverage"]["correction_policy"]
        == "partial_input_provisional_bundle_recheck"
    )
    assert (
        payload["deterministic_advisory"]["nutrient_correction"]["coverage"]["drain_feedback_policy"]
        == "bounded_drain_feedback_target_shift"
    )
    assert (
        payload["deterministic_advisory"]["nutrient_correction"]["coverage"]["residual_policy"]
        == "prefer_no_objective_overshoot"
    )
    assert payload["deterministic_advisory"]["work"]["status"] == "ready"
    assert payload["deterministic_advisory"]["work"]["request_contract"]["required"] == ["crop"]


def test_recommendation_limit_helper_clamps_to_api_bounds() -> None:
    assert advisory_api.clamp_recommendation_limit(0) == 1
    assert advisory_api.clamp_recommendation_limit(4) == 4
    assert advisory_api.clamp_recommendation_limit(99) == 10


def test_pesticide_route_maps_lookup_errors_to_404(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    def fake_recommend_pesticides(*, crop: str, target: str, limit: int) -> dict[str, object]:
        raise LookupError(f"No deterministic pesticide match for {crop}:{target}:{limit}")

    monkeypatch.setattr(advisory_api, "recommend_pesticides", fake_recommend_pesticides)

    with pytest.raises(HTTPException) as exc_info:
        advisory_api.build_pesticide_recommendation_response(
            crop="tomato",
            target="unknown",
            limit=3,
        )

    assert exc_info.value.status_code == 404
    assert "No deterministic pesticide match" in exc_info.value.detail


def test_pesticide_route_maps_value_errors_to_400(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    def fake_recommend_pesticides(*, crop: str, target: str, limit: int) -> dict[str, object]:
        raise ValueError(f"Invalid target payload for {crop}:{target}:{limit}")

    monkeypatch.setattr(advisory_api, "recommend_pesticides", fake_recommend_pesticides)

    with pytest.raises(HTTPException) as exc_info:
        advisory_api.build_pesticide_recommendation_response(
            crop="tomato",
            target="",
            limit=3,
        )

    assert exc_info.value.status_code == 400
    assert "Invalid target payload" in exc_info.value.detail


def test_nutrient_route_maps_lookup_errors_to_404(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    def fake_recommend_nutrient_recipe(
        *,
        crop: str,
        stage: str | None = None,
        medium: str | None = None,
    ) -> dict[str, object]:
        raise LookupError(f"No nutrient recipe for {crop}:{stage}:{medium}")

    monkeypatch.setattr(advisory_api, "recommend_nutrient_recipe", fake_recommend_nutrient_recipe)

    with pytest.raises(HTTPException) as exc_info:
        advisory_api.build_nutrient_recommendation_response(
            crop="tomato",
            stage="does-not-exist",
            medium="bag",
        )

    assert exc_info.value.status_code == 404
    assert "No nutrient recipe" in exc_info.value.detail


def test_nutrient_correction_route_maps_value_errors_to_400(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    def fake_recommend_nutrient_correction(**_: object) -> dict[str, object]:
        raise ValueError("working_solution_volume_l must be greater than 0.")

    monkeypatch.setattr(
        advisory_api,
        "recommend_nutrient_correction",
        fake_recommend_nutrient_correction,
    )

    with pytest.raises(HTTPException) as exc_info:
        advisory_api.build_nutrient_correction_response(
            crop="tomato",
            working_solution_volume_l=0.0,
        )

    assert exc_info.value.status_code == 400
    assert "working_solution_volume_l" in exc_info.value.detail


def test_route_handlers_reject_invalid_crop_before_service_call(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    def fail_pesticide_service(**_: object) -> dict[str, object]:
        raise AssertionError("pesticide service should not be called for invalid crops")

    def fail_nutrient_service(**_: object) -> dict[str, object]:
        raise AssertionError("nutrient service should not be called for invalid crops")

    def fail_nutrient_correction_service(**_: object) -> dict[str, object]:
        raise AssertionError("nutrient correction service should not be called for invalid crops")

    monkeypatch.setattr(advisory_api, "recommend_pesticides", fail_pesticide_service)
    monkeypatch.setattr(advisory_api, "recommend_nutrient_recipe", fail_nutrient_service)
    monkeypatch.setattr(
        advisory_api,
        "recommend_nutrient_correction",
        fail_nutrient_correction_service,
    )

    with pytest.raises(HTTPException) as pesticide_exc:
        advisory_api.build_pesticide_recommendation_response(
            crop="pepper",
            target="흰가루병",
            limit=4,
        )
    with pytest.raises(HTTPException) as nutrient_exc:
        advisory_api.build_nutrient_recommendation_response(
            crop="pepper",
            stage="Fruit set",
        )
    with pytest.raises(HTTPException) as nutrient_correction_exc:
        advisory_api.build_nutrient_correction_response(
            crop="pepper",
            source_water_mmol_l={"Cl": 9.5},
        )

    assert pesticide_exc.value.status_code == 400
    assert nutrient_exc.value.status_code == 400
    assert nutrient_correction_exc.value.status_code == 400
