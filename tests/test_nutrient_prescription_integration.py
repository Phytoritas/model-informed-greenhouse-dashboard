"""Integration tests for the nutrient stock-tank prescription seam.

The solver's own arithmetic is covered by tests/test_nutrient_solver.py. What is
checked here is the seam around it: recipe resolution and primary-source provenance,
the unit each balance row reports, and the chat path that carries the computed tank
masses to the model instead of letting it write its own.
"""

from __future__ import annotations

import pytest

from model_informed_greenhouse_dashboard.backend.app.services import (
    advisor_orchestration,
    openai_service,
)
from model_informed_greenhouse_dashboard.backend.app.services.advisory import (
    recommend_nutrient_correction,
    recommend_nutrient_recipe,
    recommend_stock_tank_prescription,
)
from model_informed_greenhouse_dashboard.backend.app.services.workbook_normalization import (
    DATA_ROOT,
    NUTRIENT_WORKBOOK,
    clear_workbook_preview_cache,
)

requires_nutrient_workbook = pytest.mark.skipif(
    not (DATA_ROOT / NUTRIENT_WORKBOOK).exists(),
    reason="nutrient workbook is not present in this checkout",
)


def setup_function() -> None:
    clear_workbook_preview_cache()


@requires_nutrient_workbook
@pytest.mark.parametrize("crop", ["cucumber", "tomato"])
def test_prescription_returns_solver_output_with_source_provenance(crop: str) -> None:
    payload = recommend_stock_tank_prescription(crop=crop)

    assert payload["family"] == "nutrient_prescription"
    assert payload["crop"] == crop
    assert payload["resolved"]["stage"]
    assert payload["resolved"]["medium"]

    prescription = payload["prescription"]
    for key in (
        "stock_tank_volume_l",
        "stock_ratio",
        "working_solution_volume_l",
        "tanks",
        "allocation_steps",
        "achieved_working_solution",
        "residuals",
        "unfulfilled",
        "excluded_ions",
        "nitrate_reconciliation",
        "warnings",
    ):
        assert key in prescription, key
    # The solver publishes no EC, and this seam does not invent one.
    assert "ec" not in prescription

    # Tanks A and B hold 1000 L each at 100x, feeding 100,000 L of working solution.
    assert prescription["stock_tank_volume_l"] == 1000.0
    assert prescription["stock_ratio"] == 100.0
    assert prescription["working_solution_volume_l"] == 100_000.0
    assert payload["stock_tank_basis"]["stock_tank_volume_l"] == 1000.0
    assert payload["stock_tank_basis"]["stock_ratio"] == 100.0
    assert set(prescription["tanks"]) == {"A", "B", "unassigned"}
    assert prescription["tanks"]["A"]["total_kilograms"] > 0
    assert prescription["tanks"]["B"]["total_kilograms"] > 0

    provenance = payload["provenance"]
    assert provenance["status"] == "available"
    assert "van der Lugt" in provenance["source"]["citation"]
    assert provenance["crop_locator"]
    assert provenance["stage_adjustment"]["resolved_stage"] == payload["resolved"]["stage"]
    assert provenance["stage_adjustment"]["published_adjustment"]
    assert provenance["known_source_inconsistencies"]

    # The workbook calculator sheet sizes a 1000 L working batch at 100x, which implies
    # a 10 L stock tank. The disagreement with the published tank basis is stated in
    # the payload rather than silently resolved.
    assert payload["stock_tank_basis"]["implied_stock_tank_volume_l"] == 10.0
    assert payload["stock_tank_basis"]["agrees_with_calculator_defaults"] is False
    assert any("처방전 계산" in warning for warning in payload["warnings"])

    # A prescription never reads as farm-ready without naming the water it rests on.
    assert payload["source_water_basis"]["mode"] in {"submitted", "workbook_baseline", "none"}
    assert payload["source_water_basis"]["statement"] in payload["limitations"]


@requires_nutrient_workbook
def test_chloride_target_is_read_from_the_reference_file_and_never_invented() -> None:
    tomato = recommend_stock_tank_prescription(crop="tomato")
    chloride = tomato["targets"]["chloride_target"]

    assert chloride["origin"] == "reference_file"
    assert chloride["target"] == 1
    assert chloride["unit"] == "mmol/L"
    assert chloride["workbook_has_cl_target"] is False
    assert "nutrient_recipes_eurofins.json" in chloride["reference_path"]
    assert tomato["targets"]["values"]["cl"] == 1
    # Cl_max stays a ceiling to check, not a target.
    assert chloride["workbook_guardrail_cl_max"] is not None
    assert any(row["canonical_key"] == "cl" for row in tomato["guardrail_review"])

    cucumber = recommend_stock_tank_prescription(crop="cucumber")
    cucumber_chloride = cucumber["targets"]["chloride_target"]
    assert cucumber_chloride["origin"] == "absent"
    assert cucumber_chloride["target"] is None
    assert "cl" not in cucumber["targets"]["values"]


@requires_nutrient_workbook
def test_micronutrient_balances_carry_their_own_unit_instead_of_mmol_per_litre() -> None:
    payload = recommend_nutrient_correction(crop="tomato")
    prep = payload["correction_outputs"]["stock_tank_prep"]
    rows = {row["canonical_key"]: row for row in prep["nutrient_balance"]}
    recipe_targets = payload["correction_context"]["recipe"]["nutrient_targets"]

    iron = rows["fe"]
    assert iron["unit"] == "µmol/L"
    assert iron["target_value"] == recipe_targets["fe"]
    # The mmol/L field now holds the converted number, so its label matches its value.
    assert iron["target_mmol_l"] == pytest.approx(recipe_targets["fe"] / 1000.0)
    assert iron["supplemental_need_mmol_l"] == pytest.approx(iron["supplemental_need"] / 1000.0)
    assert iron["target_mmol_l"] != recipe_targets["fe"]

    boron = rows["b"]
    assert boron["unit"] == "µmol/L"
    assert boron["target_mmol_l"] == pytest.approx(recipe_targets["b"] / 1000.0)

    calcium = rows["ca"]
    assert calcium["unit"] == "mmol/L"
    assert calcium["target_value"] == recipe_targets["ca"]
    assert calcium["target_mmol_l"] == pytest.approx(recipe_targets["ca"])
    assert calcium["supplemental_need_mmol_l"] == pytest.approx(calcium["supplemental_need"])

    assert prep["balance_basis"]["analyte_units"]["Fe"] == "µmol/L"
    assert prep["balance_basis"]["analyte_units"]["Ca"] == "mmol/L"
    assert prep["balance_basis"]["unit_policy"]["source_water_unit"] == "mmol/L"


def test_nutrient_prescription_survives_the_bounded_chat_context() -> None:
    dashboard = {
        "knowledge": {
            "deterministic_nutrient_prescription": {
                "source": "recommend_stock_tank_prescription",
                "prescription": {"tank_masses": {"A": {"total_kilograms": 139.392}}},
            },
            "deterministic_pesticide": {"source": "recommend_pesticides"},
            "advisor_retrieval_context": {"dropped": True},
        },
    }

    ctx = openai_service._dashboard_without_evidence_cards(dashboard)
    knowledge = ctx["knowledge"]

    assert (
        knowledge["deterministic_nutrient_prescription"]["prescription"]["tank_masses"]["A"][
            "total_kilograms"
        ]
        == 139.392
    )
    assert "deterministic_pesticide" in knowledge
    assert "advisor_retrieval_context" not in knowledge


@requires_nutrient_workbook
def test_chat_injects_the_computed_prescription_as_deterministic_evidence() -> None:
    context = advisor_orchestration._build_chat_nutrient_prescription_context(
        crop="tomato", question="토마토 양액 원액 탱크 배합량 알려줘"
    )
    assert context is not None
    assert context["status"] == "success"

    injected = advisor_orchestration._inject_nutrient_prescription_context({}, context)
    evidence = injected["knowledge"]["deterministic_nutrient_prescription"]
    assert evidence["source"] == "recommend_stock_tank_prescription"

    computed = evidence["prescription"]
    assert computed["tank_masses"]["A"]["fertilizers"]
    assert computed["tank_masses"]["B"]["fertilizers"]
    # Masses are rounded to what a farm scale can weigh before injection, because
    # the reply is told to repeat them without re-rounding. A sub-kilogram
    # micronutrient is therefore reported in grams only, with kilograms left out.
    rows = [
        row
        for tank in ("A", "B")
        for row in computed["tank_masses"][tank]["fertilizers"]
    ]
    assert all(
        row["formula"] and (row["kilograms"] is not None or row["grams"] is not None)
        for row in rows
    )
    assert all(
        row["kilograms"] is None for row in rows if row["grams"] is not None and row["grams"] < 1000
    )
    assert any(row["kilograms"] is not None for row in rows)
    assert "1000 L" in computed["stock_basis"]
    assert "van der Lugt" in computed["citation"]
    assert computed["source_water"]["statement"]
    assert computed["nitrate_policy"]["note"]

    # The evidence has to survive the bounded chat context to reach the model.
    bounded = openai_service._dashboard_without_evidence_cards(injected)
    assert "deterministic_nutrient_prescription" in bounded["knowledge"]

    # A question outside the nutrient intent leaves the chat path untouched.
    assert (
        advisor_orchestration._build_chat_nutrient_prescription_context(
            crop="tomato", question="오늘 밤 난방 온도를 몇 도로 둘까요?"
        )
        is None
    )


@requires_nutrient_workbook
def test_stale_stock_tank_note_is_replaced_by_the_prescription_entry_point() -> None:
    recipe = recommend_nutrient_recipe(crop="tomato")
    correction = recommend_nutrient_correction(crop="tomato")

    for limitations in (recipe["limitations"], correction["limitations"]):
        assert not any("아직 포함되지 않습니다" in line for line in limitations)
        assert any("recommend_stock_tank_prescription" in line for line in limitations)
