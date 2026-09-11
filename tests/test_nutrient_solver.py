"""Tests for the deterministic nutrient stock-tank solver.

Numbers in this file are anchored to two independent sources:

  * the farm hand calculation the grower confirmed (Ca 4.0 mmol/L through
    Ca(NO3)2 4H2O at 100x into a 1000 L tank weighs 94.46 kg), and
  * the worked A/B example published for cucumber on inert substrate in
    van der Lugt, G. (Ed.) 2016, Nutrient Solutions for Greenhouse Crops,
    cucumber page PDF41, which sizes the same 1000 L / 100x tanks.
"""

from __future__ import annotations

from typing import Any

import pytest

from model_informed_greenhouse_dashboard.backend.app.services import workbook_normalization
from model_informed_greenhouse_dashboard.backend.app.services.nutrient_solver import (
    TankCompatibilityError,
    solve_stock_tanks,
)


def _row(
    name: str,
    formula: str,
    molecular_weight: float,
    tank: str,
    contributions: dict[str, float],
    *,
    semantics: dict[str, str] | None = None,
    source_row: int | None = None,
) -> dict[str, Any]:
    return {
        "fertilizer_name": name,
        "formula": formula,
        "molecular_weight": molecular_weight,
        "tank_assignment": tank,
        "nutrient_contribution_per_mol": dict(contributions),
        "nutrient_contribution_semantics": semantics
        or {ion: "mol_per_mol" for ion in contributions},
        "source_sheet": "비료_DB",
        "source_row": source_row,
    }


# Mirrors 비료_DB rows 3-18 of 양액처방_계산시트_V2.0.xlsx. The real-workbook test
# below keeps this fixture honest.
WORKBOOK_SALTS: list[dict[str, Any]] = [
    _row("질산칼슘 10수염", "5[Ca(NO3)2·2H2O]NH4NO3", 1080.63516, "A",
         {"n_no3": 11.0, "n_nh4": 1.0, "ca": 5.0}, source_row=3),
    _row("질산칼슘 4수염", "Ca(NO3)2·4H2O", 236.14892, "A",
         {"n_no3": 2.0, "ca": 1.0}, source_row=4),
    _row("질산칼륨", "KNO3", 101.1032, "B", {"n_no3": 1.0, "k": 1.0}, source_row=5),
    _row("질산암모늄", "NH4NO3", 80.04336, "B", {"n_no3": 1.0, "n_nh4": 1.0}, source_row=6),
    _row("제1인산칼륨", "KH2PO4", 136.085542, "B", {"p": 1.0, "k": 1.0}, source_row=7),
    _row("황산마그네슘 7수염", "MgSO4·7H2O", 246.47456, "B", {"mg": 1.0, "s": 1.0}, source_row=8),
    _row("질산마그네슘 6수염", "Mg(NO3)2·6H2O", 256.40648, "B",
         {"n_no3": 2.0, "mg": 1.0}, source_row=9),
    _row("황산칼륨", "K2SO4", 174.2592, "B", {"k": 2.0, "s": 1.0}, source_row=10),
    _row("염화칼륨", "KCl", 74.5513, "B", {"k": 1.0, "cl": 1.0}, source_row=11),
    _row("염화칼슘", "CaCl2", 110.98, "A", {"ca": 1.0, "cl": 2.0}, source_row=12),
    _row("킬레이트철 13%", "Fe-EDTA 13%", 55.85, "B", {"fe": 0.13},
         semantics={"fe": "mass_fraction"}, source_row=13),
    _row("황산망간 1수염", "MnSO4·H2O", 169.015925, "B", {"s": 1.0, "mn": 1.0}, source_row=14),
    _row("황산아연 7수염", "ZnSO4·7H2O", 287.54956, "B", {"s": 1.0, "zn": 1.0}, source_row=15),
    _row("붕산", "H3BO3", 61.83302, "B", {"b": 1.0}, source_row=16),
    _row("황산구리 5수염", "CuSO4·5H2O", 249.685, "B", {"s": 1.0, "cu": 1.0}, source_row=17),
    _row("몰리브덴산나트륨 2수염", "Na2MoO4·2H2O", 241.95769856, "B", {"mo": 1.0}, source_row=18),
]

# The product set the manual prices its own worked example with: EDTA chelates and
# borax instead of micronutrient sulfates, and both MKP and MAP for phosphate.
MANUAL_SALTS: list[dict[str, Any]] = [
    _row("Calcium nitrate solid", "5[Ca(NO3)2·2H2O]NH4NO3", 1080.63516, "A",
         {"ca": 5.0, "n_no3": 11.0, "n_nh4": 1.0}),
    _row("Potassium nitrate", "KNO3", 101.1032, "B", {"k": 1.0, "n_no3": 1.0}),
    _row("Monopotassium phosphate", "KH2PO4", 136.085542, "B", {"k": 1.0, "p": 1.0}),
    _row("Monoammonium phosphate", "NH4H2PO4", 115.025622, "B", {"n_nh4": 1.0, "p": 1.0}),
    _row("Magnesium sulphate 16% MgO", "MgSO4·7H2O", 246.47456, "B", {"mg": 1.0, "s": 1.0}),
    _row("Fe chelate 6%", "Fe-EDTA 6%", 55.845, "A", {"fe": 0.06},
         semantics={"fe": "mass_fraction"}),
    _row("Mn-EDTA 12.8%", "Mn-EDTA 12.8%", 54.938, "A", {"mn": 0.128},
         semantics={"mn": "mass_fraction"}),
    _row("Zn-EDTA 14.8%", "Zn-EDTA 14.8%", 65.38, "A", {"zn": 0.148},
         semantics={"zn": "mass_fraction"}),
    _row("Cu-EDTA 14.8%", "Cu-EDTA 14.8%", 63.546, "A", {"cu": 0.148},
         semantics={"cu": "mass_fraction"}),
    _row("Borax 11.3% B", "Na2B4O7·10H2O", 10.811, "B", {"b": 0.113},
         semantics={"b": "mass_fraction"}),
    _row("Sodium molybdate 39.6%", "Na2MoO4·2H2O", 95.95, "B", {"mo": 0.396},
         semantics={"mo": "mass_fraction"}),
]

# Cucumber, inert substrate, Start stage: the base feed both the workbook recipe
# sheet and the manual publish for this crop.
CUCUMBER_START_TARGETS: dict[str, float] = {
    "n_no3": 16.0, "n_nh4": 1.25, "p": 1.25, "k": 8.0,
    "ca": 4.0, "mg": 1.375, "s": 1.375,
    "fe": 15.0, "mn": 10.0, "zn": 5.0, "b": 25.0, "cu": 0.75, "mo": 0.5,
}
CUCUMBER_START_UNITS: dict[str, str] = {
    "n_no3": "mmol/L", "n_nh4": "mmol/L", "p": "mmol/L", "k": "mmol/L",
    "ca": "mmol/L", "mg": "mmol/L", "s": "mmol/L",
    "fe": "umol/L", "mn": "umol/L", "zn": "umol/L",
    "b": "umol/L", "cu": "umol/L", "mo": "umol/L",
}


def _grams_by_formula(result: dict[str, Any]) -> dict[str, float]:
    """Total grams per product across both tanks, so a split salt sums back up."""
    totals: dict[str, float] = {}
    for bucket in result["tanks"].values():
        for entry in bucket["fertilizers"]:
            totals[entry["formula"]] = totals.get(entry["formula"], 0.0) + entry["grams"]
    return totals


def test_calcium_anchor_reproduces_the_confirmed_hand_calculation() -> None:
    result = solve_stock_tanks(
        targets={"ca": 4.0},
        target_units={"ca": "mmol/L"},
        source_water={},
        fertilizers=WORKBOOK_SALTS,
    )

    assert result["stock_tank_volume_l"] == 1000.0
    assert result["stock_ratio"] == 100.0
    assert result["working_solution_volume_l"] == 100_000.0

    entries = result["tanks"]["A"]["fertilizers"]
    assert [entry["formula"] for entry in entries] == ["Ca(NO3)2·4H2O"]
    calcium = entries[0]
    assert calcium["grams"] == pytest.approx(94_459.568, rel=1e-9)
    assert calcium["kilograms"] == pytest.approx(94.459568, rel=1e-9)
    assert calcium["grams_per_liter_of_stock"] == pytest.approx(94.459568, rel=1e-9)
    assert calcium["source_row"] == 4
    assert result["residuals"]["ca"]["status"] == "met"


def test_iron_arrives_through_the_mass_fraction_path() -> None:
    result = solve_stock_tanks(
        targets={"fe": 15.0},
        target_units={"fe": "umol/L"},
        source_water={},
        fertilizers=WORKBOOK_SALTS,
    )

    entries = result["tanks"]["B"]["fertilizers"]
    assert [entry["formula"] for entry in entries] == ["Fe-EDTA 13%"]
    iron = entries[0]
    assert iron["contribution_basis"] == "mass_fraction"
    assert iron["product_mass_fraction"] == pytest.approx(0.13)
    # 83.775 g of elemental iron divided by the 13 % product mass fraction.
    assert iron["grams"] * 0.13 == pytest.approx(83.775, rel=1e-6)
    assert iron["grams"] == pytest.approx(644.4230769, rel=1e-6)
    assert result["achieved_working_solution"]["fe"]["value"] == pytest.approx(15.0)
    assert result["achieved_working_solution"]["fe"]["unit"] == "umol/L"


def test_calcium_may_not_share_a_tank_with_sulfate_or_phosphate() -> None:
    misassigned = []
    for row in WORKBOOK_SALTS:
        candidate = dict(row)
        if candidate["formula"] == "Ca(NO3)2·4H2O":
            candidate["tank_assignment"] = "B"
        misassigned.append(candidate)

    with pytest.raises(TankCompatibilityError) as excinfo:
        solve_stock_tanks(
            targets={"ca": 4.0, "mg": 1.375, "s": 1.375},
            target_units={"ca": "mmol/L", "mg": "mmol/L", "s": "mmol/L"},
            source_water={},
            fertilizers=misassigned,
        )

    message = str(excinfo.value)
    assert "Tank B" in message
    assert "Ca(NO3)2·4H2O" in message
    assert "MgSO4·7H2O" in message


def test_nitrate_excess_is_reported_with_its_cause_and_a_named_swap() -> None:
    targets = dict(CUCUMBER_START_TARGETS)
    targets["n_no3"] = 12.0

    result = solve_stock_tanks(
        targets=targets,
        target_units=CUCUMBER_START_UNITS,
        source_water={},
        fertilizers=WORKBOOK_SALTS,
    )

    nitrate = result["nitrate_reconciliation"]
    assert nitrate["status"] == "excess"
    assert nitrate["difference"] == pytest.approx(4.0315, rel=1e-9)
    assert nitrate["unit"] == "mmol/L"
    assert result["residuals"]["n_no3"]["status"] == "over"

    # The excess is attributed, not hidden.
    contributors = {entry["formula"]: entry["n_no3_mmol_per_l"] for entry in nitrate["contributors"]}
    assert contributors["Ca(NO3)2·4H2O"] == pytest.approx(8.0)
    assert contributors["KNO3"] == pytest.approx(6.75)
    assert "Ca(NO3)2·4H2O" in nitrate["cause"]

    swaps = {entry["with"] for entry in nitrate["suggested_swaps"]}
    assert "K2SO4" in swaps
    potassium_swap = next(entry for entry in nitrate["suggested_swaps"] if entry["with"] == "K2SO4")
    assert potassium_swap["replace"] == "KNO3"
    assert potassium_swap["n_no3_change_mmol_per_l"] < 0
    assert potassium_swap["side_effect_ion"] == "s"
    assert potassium_swap["side_effect_change_mmol_per_l"] > 0


def test_source_water_is_subtracted_and_its_excess_reported() -> None:
    units = dict(CUCUMBER_START_UNITS)
    units["cl"] = "mmol/L"

    result = solve_stock_tanks(
        targets=CUCUMBER_START_TARGETS,
        target_units=units,
        source_water={"ca": 1.5, "cl": 1.2},
        fertilizers=WORKBOOK_SALTS,
    )

    # Only the 2.5 mmol/L the water does not already carry is dosed.
    grams = _grams_by_formula(result)
    assert grams["Ca(NO3)2·4H2O"] == pytest.approx(59_037.23, rel=1e-9)
    assert result["achieved_working_solution"]["ca"]["from_source_water"] == pytest.approx(1.5)
    assert result["achieved_working_solution"]["ca"]["from_fertilizer"] == pytest.approx(2.5)
    assert result["residuals"]["ca"]["status"] == "met"

    # Chloride the water brings is surfaced instead of being quietly ignored.
    excess = {entry["ion"]: entry for entry in result["source_water_excess"]}
    assert excess["cl"]["excess"] == pytest.approx(1.2)
    assert excess["cl"]["unit"] == "mmol/L"
    assert result["residuals"]["cl"]["status"] == "over"


def test_ion_without_a_supplied_unit_is_excluded_not_guessed() -> None:
    units = dict(CUCUMBER_START_UNITS)
    del units["mg"]

    result = solve_stock_tanks(
        targets=CUCUMBER_START_TARGETS,
        target_units=units,
        source_water={},
        fertilizers=WORKBOOK_SALTS,
    )

    excluded = {entry["ion"]: entry for entry in result["excluded_ions"]}
    assert excluded["mg"]["reason"] == "unit_not_supplied"
    assert excluded["mg"]["target"] == 1.375

    assert "mg" not in result["residuals"]
    assert "mg" not in result["achieved_working_solution"]
    dosed = set(_grams_by_formula(result))
    assert "MgSO4·7H2O" not in dosed
    assert "Mg(NO3)2·6H2O" not in dosed


def test_cucumber_start_recipe_from_the_workbook_salt_set() -> None:
    result = solve_stock_tanks(
        targets=CUCUMBER_START_TARGETS,
        target_units=CUCUMBER_START_UNITS,
        source_water={},
        fertilizers=WORKBOOK_SALTS,
    )

    assert result["unfulfilled"] == []
    grams = _grams_by_formula(result)
    assert grams["Ca(NO3)2·4H2O"] == pytest.approx(94_459.568, rel=1e-9)
    assert grams["KH2PO4"] == pytest.approx(17_010.693, rel=1e-6)
    assert grams["NH4NO3"] == pytest.approx(10_005.42, rel=1e-6)
    assert grams["KNO3"] == pytest.approx(68_244.66, rel=1e-6)
    assert grams["H3BO3"] == pytest.approx(154.583, rel=1e-5)
    # Magnesium sulfate is capped by the sulfate target, so the remainder has to
    # arrive as magnesium nitrate.
    assert grams["MgSO4·7H2O"] == pytest.approx(33_502.055, rel=1e-6)
    assert grams["Mg(NO3)2·6H2O"] == pytest.approx(403.84, rel=1e-5)
    assert "K2SO4" not in grams

    achieved = result["achieved_working_solution"]
    for ion in ("n_nh4", "p", "k", "ca", "mg", "s", "fe", "mn", "zn", "b", "cu", "mo"):
        assert result["residuals"][ion]["status"] == "met", ion
        assert achieved[ion]["value"] == pytest.approx(CUCUMBER_START_TARGETS[ion])

    # That magnesium nitrate substitution is the whole nitrate overshoot, and it
    # is reported rather than rebalanced away.
    nitrate = result["nitrate_reconciliation"]
    assert nitrate["status"] == "excess"
    assert nitrate["difference"] == pytest.approx(0.0315, rel=1e-9)

    # Potassium nitrate is the only salt split across both tanks.
    tank_a = {entry["formula"] for entry in result["tanks"]["A"]["fertilizers"]}
    tank_b = {entry["formula"] for entry in result["tanks"]["B"]["fertilizers"]}
    assert tank_a == {"Ca(NO3)2·4H2O", "KNO3"}
    assert "KNO3" in tank_b and "MgSO4·7H2O" in tank_b and "KH2PO4" in tank_b
    assert result["tanks"]["unassigned"]["fertilizers"] == []
    split = [e for e in result["tanks"]["A"]["fertilizers"] if e["formula"] == "KNO3"][0]
    assert split["grams"] == pytest.approx(68_244.66 * 0.5, rel=1e-6)


def test_missing_micronutrient_row_is_reported_not_raised() -> None:
    without_boron = [row for row in WORKBOOK_SALTS if row["formula"] != "H3BO3"]

    result = solve_stock_tanks(
        targets={"b": 25.0},
        target_units={"b": "umol/L"},
        source_water={},
        fertilizers=without_boron,
    )

    assert [(entry["ion"], entry["reason"]) for entry in result["unfulfilled"]] == [
        ("b", "salt_not_supplied")
    ]
    assert result["unfulfilled"][0]["shortfall"] == pytest.approx(25.0)
    assert result["unfulfilled"][0]["unit"] == "umol/L"
    assert result["residuals"]["b"]["status"] == "short"


def test_manual_published_ab_tanks_are_reproduced() -> None:
    """van der Lugt 2016, cucumber PDF41: 1000 L per tank at 100x, zero source water.

    The manual rounds its macro salts to whole kilograms and its micro products to
    whole grams, so agreement is asserted at 5 % rather than exactly.
    """
    result = solve_stock_tanks(
        targets=CUCUMBER_START_TARGETS,
        target_units=CUCUMBER_START_UNITS,
        source_water={},
        fertilizers=MANUAL_SALTS,
        options={"kno3_tank_a_fraction": 18.0 / 73.0},
    )

    published_grams = {
        "5[Ca(NO3)2·2H2O]NH4NO3": 86_000.0,
        "KNO3": 73_000.0,
        "KH2PO4": 11_000.0,
        "NH4H2PO4": 5_000.0,
        "MgSO4·7H2O": 34_000.0,
        "Fe-EDTA 6%": 1_396.0,
        "Mn-EDTA 12.8%": 429.0,
        "Zn-EDTA 14.8%": 221.0,
        "Cu-EDTA 14.8%": 32.0,
        "Na2B4O7·10H2O": 239.0,
        "Na2MoO4·2H2O": 12.0,
    }
    grams = _grams_by_formula(result)
    assert set(grams) == set(published_grams)
    for formula, expected in published_grams.items():
        assert grams[formula] == pytest.approx(expected, rel=0.05), formula

    # The published tank split is reproduced by the KNO3 option alone.
    tank_a = {entry["formula"]: entry["grams"] for entry in result["tanks"]["A"]["fertilizers"]}
    tank_b = {entry["formula"]: entry["grams"] for entry in result["tanks"]["B"]["fertilizers"]}
    assert tank_a["KNO3"] == pytest.approx(18_000.0, rel=0.05)
    assert tank_b["KNO3"] == pytest.approx(55_000.0, rel=0.05)
    assert "5[Ca(NO3)2·2H2O]NH4NO3" in tank_a
    assert {"KH2PO4", "NH4H2PO4", "MgSO4·7H2O"} <= set(tank_b)

    # Crediting the ammonium and nitrate that ride along with the calcium salt is
    # what makes this feed land exactly on target.
    for ion in CUCUMBER_START_TARGETS:
        assert result["residuals"][ion]["status"] == "met", ion
    assert result["nitrate_reconciliation"]["status"] == "balanced"
    assert result["unfulfilled"] == []
    assert result["warnings"] == []

    steps = [(entry["step"], entry["role"]) for entry in result["allocation_steps"]]
    assert steps[0][1] == "ca_nitrate"
    roles = [role for _, role in steps]
    assert roles.index("nh4_phosphate") < roles.index("p_phosphate")


@pytest.mark.skipif(
    not (workbook_normalization.DATA_ROOT / workbook_normalization.NUTRIENT_WORKBOOK).exists(),
    reason="nutrient workbook is not present in this checkout",
)
def test_boron_is_parsed_from_the_real_workbook() -> None:
    """Locks the 비료_DB header fix: a substring lookup for "B" used to return the
    tank letter from 권장 탱크(A/B), leaving every fertilizer with b = None.
    """
    rows = workbook_normalization._read_workbook_rows(
        str(workbook_normalization.DATA_ROOT / workbook_normalization.NUTRIENT_WORKBOOK)
    )
    fertilizers = workbook_normalization._parse_fertilizer_rows(rows.get("비료_DB", ()))
    assert fertilizers

    by_formula = {row["formula"]: row for row in fertilizers}
    boric_acid = by_formula["H3BO3"]
    assert boric_acid["nutrient_contribution_per_mol"]["b"] == pytest.approx(1.0)
    assert boric_acid["nutrient_contribution_semantics"]["b"] == "mol_per_mol"

    # No row may fall back to the tank letter, and no row may lose its column.
    for row in fertilizers:
        assert row["nutrient_contribution_per_mol"]["b"] is not None, row["formula"]

    # Iron stays a product mass fraction, and says so.
    iron = by_formula["Fe-EDTA 13%"]
    assert iron["nutrient_contribution_per_mol"]["fe"] == pytest.approx(0.13)
    assert iron["nutrient_contribution_semantics"]["fe"] == "mass_fraction"

    # The hermetic fixture above must keep matching the workbook it mirrors.
    for fixture in WORKBOOK_SALTS:
        actual = by_formula[fixture["formula"]]
        assert actual["molecular_weight"] == pytest.approx(fixture["molecular_weight"])
        assert actual["tank_assignment"] == fixture["tank_assignment"]
        assert actual["source_row"] == fixture["source_row"]
        expected = fixture["nutrient_contribution_per_mol"]
        observed = {
            ion: value
            for ion, value in actual["nutrient_contribution_per_mol"].items()
            if value
        }
        assert observed == pytest.approx(expected), fixture["formula"]
def test_chloride_target_uses_calcium_chloride_and_closes_the_nitrate_balance():
    """The source's tomato feed prescribes Cl 1 mmol/L and prints CaCl2 in tank A.

    Calcium arriving as chloride rather than nitrate is what keeps the tomato
    nitrate balance closed; without this step the solver over-supplies nitrate by
    a full 1 mmol/L on every tomato stage.
    """
    targets = {
        "n_no3": 15.0, "n_nh4": 1.2, "p": 1.5, "k": 9.5,
        "ca": 5.4, "mg": 2.4, "s": 4.4, "cl": 1.0,
    }
    units = {ion: "mmol/L" for ion in targets}

    with_chloride = solve_stock_tanks(
        targets=targets, target_units=units, fertilizers=WORKBOOK_SALTS,
        stock_tank_volume_l=1000.0, stock_ratio=100.0,
    )
    without_chloride = solve_stock_tanks(
        targets={ion: value for ion, value in targets.items() if ion != "cl"},
        target_units=units, fertilizers=WORKBOOK_SALTS,
        stock_tank_volume_l=1000.0, stock_ratio=100.0,
    )

    tank_a = {entry["formula"]: entry for entry in with_chloride["tanks"]["A"]["fertilizers"]}
    assert any(formula.lower().startswith("cacl2") for formula in tank_a)
    assert with_chloride["achieved_working_solution"]["cl"]["value"] == pytest.approx(1.0)
    assert with_chloride["achieved_working_solution"]["ca"]["value"] == pytest.approx(5.4)

    closed = abs(with_chloride["nitrate_reconciliation"]["difference_mmol_per_l"])
    open_balance = abs(without_chloride["nitrate_reconciliation"]["difference_mmol_per_l"])
    assert closed < 0.1 < open_balance

    # Calcium chloride must not land in a tank holding sulfate or phosphate.
    tank_b = {entry["formula"].lower() for entry in with_chloride["tanks"]["B"]["fertilizers"]}
    assert not any(formula.startswith("cacl2") for formula in tank_b)
