"""Deterministic nutrient stock-tank solver for two-tank (A/B) concentrate systems.

The greenhouse runs one A tank and one B tank, each holding a fixed volume of
stock solution at a fixed concentration factor. A salt that must deliver an ion
at c mmol/L of final working solution therefore weighs

    grams = c_mmol_per_l * stock_ratio * stock_tank_volume_l * molecular_weight / 1000

Allocation follows a fixed, auditable sequence rather than a least-squares fit,
so every gram traces back to the step that asked for it and to the workbook row
that supplied the stoichiometry. Co-ions accumulate as the sequence runs:

  1. calcium, promoted to the front when the selected calcium salt also carries
     nitrate or ammonium, so that nitrogen arriving with calcium is credited
     before the ammonium step instead of being double-dosed;
  2. micronutrients (Fe, Mn, Zn, B, Cu, Mo), booking any sulfate they carry;
  3. ammonium, preferring ammonium nitrate and falling back to monoammonium
     phosphate, which also books phosphate;
  4. phosphorus, crediting phosphate already booked, balance as KH2PO4;
  5. magnesium as MgSO4 up to the sulfate budget, remainder as Mg(NO3)2;
  6. sulfate still owed as K2SO4 (two potassium per sulfate);
  7. potassium still owed as KNO3;
  8. calcium, if it was not already placed at the front;
  9. nitrate reconciliation, which reports the signed difference and never
     silently rebalances.

Salt roles are resolved from the supplied rows, never hardcoded to one product
list: macro roles match a ranked formula alias list, and micronutrient roles
match the contribution signature, so a sulfate set and an EDTA-chelate set both
work. A product declared as a percentage (Fe chelate 6%, Borax 11.3% B) uses the
mass-fraction path, where the molecular weight is the element atomic weight and
the coefficient is the product mass fraction.

Estimated EC is deliberately absent: converting an ion list into EC needs per-ion
conductivity coefficients that this function is never given, so the solver
reports composition and leaves EC to a caller that owns those constants.
"""

from __future__ import annotations

from collections.abc import Mapping, Sequence
from dataclasses import dataclass
from typing import Any

__all__ = [
    "MACRO_IONS",
    "MICRO_IONS",
    "SOLVER_ION_ORDER",
    "TankCompatibilityError",
    "solve_stock_tanks",
]


class TankCompatibilityError(ValueError):
    """Raised when a calcium salt would share a tank with a sulfate or phosphate salt."""


MACRO_IONS: tuple[str, ...] = ("n_no3", "n_nh4", "p", "k", "ca", "mg", "s")
MICRO_IONS: tuple[str, ...] = ("fe", "mn", "zn", "b", "cu", "mo")
# Ions a source-water analysis commonly reports. Only chloride is ever dosed, and
# only when the feed itself carries a chloride target.
_WATER_ONLY_IONS: tuple[str, ...] = ("cl", "na", "hco3")
SOLVER_ION_ORDER: tuple[str, ...] = MACRO_IONS + MICRO_IONS + _WATER_ONLY_IONS

_EPS = 1e-12
_MET_TOLERANCE = 1e-9

_MOL_PER_MOL = "mol_per_mol"
_MASS_FRACTION = "mass_fraction"

_UNIT_FACTORS_MMOL_PER_L: dict[str, float] = {
    "mmol/l": 1.0,
    "mmoll": 1.0,
    "mmol/liter": 1.0,
    "mmol.l-1": 1.0,
    "umol/l": 1e-3,
    "umoll": 1e-3,
    "umol/liter": 1e-3,
    "umol.l-1": 1e-3,
}

# Macro roles are resolved by formula, most preferred product first. Ranking (not
# supplied-list order) decides which product fills a role, so a list holding both
# calcium nitrate hydrates resolves the same way every time.
_MACRO_ROLE_FORMULAS: dict[str, tuple[str, ...]] = {
    "ca_nitrate": ("ca(no3)2.4h2o", "5[ca(no3)2.2h2o]nh4no3", "ca(no3)2"),
    "nh4_nitrate": ("nh4no3",),
    "nh4_phosphate": ("nh4h2po4",),
    "p_phosphate": ("kh2po4",),
    "mg_sulfate": ("mgso4.7h2o", "mgso4"),
    "mg_nitrate": ("mg(no3)2.6h2o", "mg(no3)2"),
    "k_sulfate": ("k2so4",),
    "k_nitrate": ("kno3",),
    "ca_chloride": ("cacl2.2h2o", "cacl2"),
    "k_chloride": ("kcl",),
}
# A micronutrient product is recognized by what it contributes, so MnSO4 and
# Mn-EDTA both fill the manganese role without being named here.
_MICRO_ROLE_SUFFIX = "_source"
_MICRO_ROLE_BLOCKING_IONS: tuple[str, ...] = ("n_no3", "n_nh4", "p", "k", "ca", "mg")
_AMMONIUM_ROLE_PREFERENCE: tuple[str, ...] = ("nh4_nitrate", "nh4_phosphate")

# The one salt the grower may deliberately spread across both tanks.
_SPLITTABLE_ROLE = "k_nitrate"
_KNO3_TANK_A_FRACTION_OPTION = "kno3_tank_a_fraction"
_SUPPORTED_OPTIONS = frozenset({_KNO3_TANK_A_FRACTION_OPTION})


@dataclass(frozen=True)
class _Salt:
    fertilizer_name: str
    formula: str
    molecular_weight: float | None
    tank_assignment: str
    coefficients: dict[str, float]
    mass_fraction_ion: str | None
    mass_fraction: float | None
    source_sheet: str
    source_row: Any


@dataclass(frozen=True)
class _Dose:
    salt: _Salt
    role: str
    step: int
    driving_ion: str
    requested_mmol_per_l: float
    basis_mmol_per_l: float
    grams: float


def _normalize_unit(value: Any) -> str:
    text = str(value or "").strip().lower()
    text = text.replace("\u00b5", "u").replace("\u03bc", "u")
    return text.replace(" ", "").replace("_", "")


def _unit_factor(value: Any) -> float | None:
    """Return the mmol/L factor for a supplied unit, or None when unrecognized."""
    return _UNIT_FACTORS_MMOL_PER_L.get(_normalize_unit(value))


def _formula_key(value: Any) -> str:
    text = str(value or "").strip().lower()
    for separator in ("\u00b7", "\u2022", "\u2219", "\u30fb", "*"):
        text = text.replace(separator, ".")
    return "".join(character for character in text if not character.isspace())


def _coerce_float(value: Any) -> float | None:
    if value is None or isinstance(value, bool):
        return None
    if isinstance(value, (int, float)):
        number = float(value)
    else:
        text = str(value).strip().replace(",", "")
        if not text:
            return None
        try:
            number = float(text)
        except ValueError:
            return None
    if number != number or number in (float("inf"), float("-inf")):
        return None
    return number


def _normalize_tank(value: Any) -> str:
    for character in str(value or "").strip().upper():
        if character in ("A", "B"):
            return character
    return ""


def _round(value: float | None, digits: int) -> float | None:
    return None if value is None else round(float(value), digits)


def _format_amount(value: float) -> str:
    return "{0:g}".format(round(float(value), 9))


def _role_description(role: str) -> str:
    aliases = _MACRO_ROLE_FORMULAS.get(role)
    if aliases:
        return "a row with formula " + " or ".join(aliases)
    if role.endswith(_MICRO_ROLE_SUFFIX):
        ion = role[: -len(_MICRO_ROLE_SUFFIX)]
        return (
            "a row contributing " + ion + " and no other micronutrient or macronutrient"
        )
    return "a row for the " + role + " role"


def _micro_role_for(coefficients: Mapping[str, float]) -> str | None:
    """Return the micronutrient role a contribution signature fills, if exactly one."""
    present = [ion for ion in MICRO_IONS if coefficients.get(ion, 0.0) > 0]
    if len(present) != 1:
        return None
    if any(coefficients.get(ion, 0.0) > 0 for ion in _MICRO_ROLE_BLOCKING_IONS):
        return None
    return present[0] + _MICRO_ROLE_SUFFIX


def _parse_salt(row: Mapping[str, Any]) -> tuple[_Salt, list[str]] | None:
    formula = str(row.get("formula") or "").strip()
    if not formula:
        return None

    warnings: list[str] = []
    raw_contributions = row.get("nutrient_contribution_per_mol") or {}
    semantics = row.get("nutrient_contribution_semantics") or {}
    display_name = str(row.get("fertilizer_name") or formula)

    if not semantics and "%" in (formula + display_name):
        warnings.append(
            display_name
            + " declares a percentage but supplies no nutrient_contribution_semantics"
            + " map, so its coefficients were read as mol-per-mol. Declare"
            + " mass_fraction explicitly if that is wrong.",
        )

    coefficients: dict[str, float] = {}
    mass_fraction_ion: str | None = None
    mass_fraction: float | None = None

    for ion, raw_value in raw_contributions.items():
        number = _coerce_float(raw_value)
        if number is None or number <= 0:
            continue
        # The workbook publishes iron as a product mass fraction and every other
        # column as a mol-per-mol coefficient. Rows predating the semantics map
        # keep that same convention.
        kind = semantics.get(ion) or (_MASS_FRACTION if ion == "fe" else _MOL_PER_MOL)
        if kind == _MASS_FRACTION:
            if mass_fraction_ion is not None:
                warnings.append(
                    display_name
                    + " declares more than one mass-fraction column; only "
                    + mass_fraction_ion
                    + " was used.",
                )
                continue
            mass_fraction_ion = ion
            mass_fraction = number
            # One mole of the element per mole of the dosing basis; the product
            # mass is divided by the mass fraction when the grams are computed.
            coefficients[ion] = 1.0
        else:
            coefficients[ion] = number

    salt = _Salt(
        fertilizer_name=display_name,
        formula=formula,
        molecular_weight=_coerce_float(row.get("molecular_weight")),
        tank_assignment=_normalize_tank(row.get("tank_assignment")),
        coefficients=coefficients,
        mass_fraction_ion=mass_fraction_ion,
        mass_fraction=mass_fraction,
        source_sheet=str(row.get("source_sheet") or ""),
        source_row=row.get("source_row"),
    )
    return salt, warnings


def _build_salt_index(
    fertilizers: Sequence[Mapping[str, Any]] | None,
) -> tuple[dict[str, _Salt], list[str]]:
    """Resolve allocation roles from the supplied rows without hardcoding a product list."""
    parsed: list[_Salt] = []
    warnings: list[str] = []
    by_formula_key: dict[str, _Salt] = {}

    for row in fertilizers or ():
        if not isinstance(row, Mapping):
            continue
        result = _parse_salt(row)
        if result is None:
            continue
        salt, row_warnings = result
        parsed.append(salt)
        warnings.extend(row_warnings)
        by_formula_key.setdefault(_formula_key(salt.formula), salt)

    index: dict[str, _Salt] = {}
    for role, aliases in _MACRO_ROLE_FORMULAS.items():
        for alias in aliases:
            salt = by_formula_key.get(alias)
            if salt is not None:
                index[role] = salt
                break

    for salt in parsed:
        role = _micro_role_for(salt.coefficients)
        if role is not None:
            index.setdefault(role, salt)

    return index, warnings


def solve_stock_tanks(
    *,
    targets: Mapping[str, Any],
    target_units: Mapping[str, Any],
    source_water: Mapping[str, Any] | None = None,
    fertilizers: Sequence[Mapping[str, Any]],
    stock_tank_volume_l: float = 1000.0,
    stock_ratio: float = 100.0,
    options: Mapping[str, Any] | None = None,
) -> dict[str, Any]:
    """Size the A and B stock tanks for a working-solution nutrient target.

    targets and source_water share the ion keys in SOLVER_ION_ORDER and share the
    unit map target_units. A unit is never inferred: an ion whose unit is missing
    or unrecognized is dropped from the solve and listed under excluded_ions.

    Raises TankCompatibilityError when the resulting assignment would place a
    calcium salt in the same tank as a sulfate or phosphate salt, and ValueError
    for a non-positive tank volume or stock ratio or an out-of-range option.
    """
    volume_l = _coerce_float(stock_tank_volume_l)
    ratio = _coerce_float(stock_ratio)
    if volume_l is None or volume_l <= 0:
        raise ValueError("stock_tank_volume_l must be a positive number of litres.")
    if ratio is None or ratio <= 0:
        raise ValueError("stock_ratio must be a positive concentration factor.")

    option_map = dict(options or {})
    warnings: list[str] = []
    unsupported_options = sorted(set(option_map) - _SUPPORTED_OPTIONS)
    if unsupported_options:
        warnings.append("Ignored unsupported options: " + ", ".join(unsupported_options) + ".")

    kno3_tank_a_fraction = _coerce_float(option_map.get(_KNO3_TANK_A_FRACTION_OPTION, 0.5))
    if kno3_tank_a_fraction is None or not 0.0 <= kno3_tank_a_fraction <= 1.0:
        raise ValueError(_KNO3_TANK_A_FRACTION_OPTION + " must be a fraction between 0 and 1.")

    target_map = dict(targets or {})
    water_map = dict(source_water or {})
    unit_map = dict(target_units or {})

    excluded_ions: list[dict[str, Any]] = []
    unit_by_ion: dict[str, str] = {}
    factor_by_ion: dict[str, float] = {}
    target_mmol: dict[str, float] = {}
    water_mmol: dict[str, float] = {}
    need_mmol: dict[str, float] = {}
    excess_mmol: dict[str, float] = {}

    known = set(SOLVER_ION_ORDER)
    for ion in sorted((set(target_map) | set(water_map)) - known):
        excluded_ions.append(
            {
                "ion": ion,
                "reason": "unknown_ion",
                "detail": "Not a solver ion key; expected one of "
                + ", ".join(SOLVER_ION_ORDER)
                + ".",
            }
        )

    for ion in SOLVER_ION_ORDER:
        if ion not in target_map and ion not in water_map:
            continue

        supplied_unit = unit_map.get(ion)
        factor = _unit_factor(supplied_unit)
        if factor is None:
            excluded_ions.append(
                {
                    "ion": ion,
                    "reason": (
                        "unit_not_supplied"
                        if not str(supplied_unit or "").strip()
                        else "unit_not_recognized"
                    ),
                    "supplied_unit": supplied_unit,
                    "target": target_map.get(ion),
                    "source_water": water_map.get(ion),
                    "detail": "No usable unit was supplied for this ion, so it was"
                    + " excluded from the solve rather than assumed.",
                }
            )
            continue

        target_value = _coerce_float(target_map.get(ion))
        water_value = _coerce_float(water_map.get(ion))
        if (target_value is not None and target_value < 0) or (
            water_value is not None and water_value < 0
        ):
            excluded_ions.append(
                {
                    "ion": ion,
                    "reason": "negative_value",
                    "supplied_unit": supplied_unit,
                    "target": target_map.get(ion),
                    "source_water": water_map.get(ion),
                    "detail": "Concentrations cannot be negative.",
                }
            )
            continue

        unit_by_ion[ion] = str(supplied_unit)
        factor_by_ion[ion] = factor
        target_mmol[ion] = (target_value or 0.0) * factor
        water_mmol[ion] = (water_value or 0.0) * factor
        need_mmol[ion] = max(0.0, target_mmol[ion] - water_mmol[ion])
        excess_mmol[ion] = max(0.0, water_mmol[ion] - target_mmol[ion])

    salts, salt_warnings = _build_salt_index(fertilizers)
    warnings.extend(salt_warnings)

    plan: list[_Dose] = []
    accumulated: dict[str, float] = {ion: 0.0 for ion in SOLVER_ION_ORDER}
    unfulfilled: list[dict[str, Any]] = []
    counter = {"step": 0}

    def _apply(role: str, ion: str, amount_mmol_per_l: float) -> float:
        """Dose one salt for one ion and book its co-ions. Returns ion mmol/L delivered."""
        counter["step"] += 1
        step = counter["step"]
        if amount_mmol_per_l <= _EPS:
            return 0.0

        factor = factor_by_ion.get(ion, 1.0)

        def _shortfall(reason: str, detail: str) -> float:
            unfulfilled.append(
                {
                    "ion": ion,
                    "role": role,
                    "step": step,
                    "reason": reason,
                    "detail": detail,
                    "shortfall": _round(amount_mmol_per_l / factor, 9),
                    "shortfall_mmol_per_l": _round(amount_mmol_per_l, 9),
                    "unit": unit_by_ion.get(ion, "mmol/L"),
                }
            )
            return 0.0

        salt = salts.get(role)
        if salt is None:
            return _shortfall(
                "salt_not_supplied",
                "No supplied fertilizer row fills the " + role + " role; expected "
                + _role_description(role) + ".",
            )

        coefficient = salt.coefficients.get(ion, 0.0)
        if coefficient <= 0:
            return _shortfall(
                "salt_does_not_contribute_ion",
                salt.formula + " carries no usable " + ion + " coefficient in the supplied row.",
            )
        if salt.molecular_weight is None or salt.molecular_weight <= 0:
            return _shortfall(
                "molecular_weight_missing",
                salt.formula + " has no positive molecular weight, so a mass cannot be computed.",
            )
        if salt.mass_fraction_ion == ion and (salt.mass_fraction is None or salt.mass_fraction <= 0):
            return _shortfall(
                "mass_fraction_missing",
                salt.formula + " has no positive product mass fraction, so a mass cannot be computed.",
            )

        basis_mmol_per_l = amount_mmol_per_l / coefficient
        grams = basis_mmol_per_l * ratio * volume_l * salt.molecular_weight / 1000.0
        if salt.mass_fraction:
            grams = grams / salt.mass_fraction
        if grams < 0:
            raise ValueError("Computed a negative mass for " + salt.formula + ".")

        for co_ion, co_coefficient in salt.coefficients.items():
            accumulated[co_ion] = accumulated.get(co_ion, 0.0) + basis_mmol_per_l * co_coefficient

        plan.append(
            _Dose(
                salt=salt,
                role=role,
                step=step,
                driving_ion=ion,
                requested_mmol_per_l=amount_mmol_per_l,
                basis_mmol_per_l=basis_mmol_per_l,
                grams=grams,
            )
        )
        return amount_mmol_per_l

    calcium_salt = salts.get("ca_nitrate")
    calcium_carries_nitrogen = calcium_salt is not None and (
        calcium_salt.coefficients.get("n_no3", 0.0) > 0
        or calcium_salt.coefficients.get("n_nh4", 0.0) > 0
    )

    # Step 0: chloride, when the feed prescribes one. Calcium chloride carries it
    # without nitrate, which is how the source's own tomato prescription meets the
    # chloride target and still closes the nitrate balance; the calcium it delivers
    # is credited against the calcium step below. Any chloride beyond the calcium
    # budget falls to potassium chloride.
    chloride_need = need_mmol.get("cl", 0.0)
    if chloride_need > _EPS:
        chloride_salt = salts.get("ca_chloride")
        delivered_chloride = 0.0
        if chloride_salt is not None:
            chloride_per_mol = chloride_salt.coefficients.get("cl", 0.0)
            calcium_per_mol = chloride_salt.coefficients.get("ca", 0.0)
            affordable = chloride_need
            if chloride_per_mol > 0 and calcium_per_mol > 0:
                calcium_budget = max(0.0, need_mmol.get("ca", 0.0))
                affordable = min(chloride_need, calcium_budget * chloride_per_mol / calcium_per_mol)
            delivered_chloride = _apply("ca_chloride", "cl", affordable)
        _apply("k_chloride", "cl", max(0.0, chloride_need - delivered_chloride))

    # Step 1: calcium first when it also carries nitrogen, so the nitrate and
    # ammonium riding along with it are credited before the ammonium step.
    if calcium_carries_nitrogen:
        _apply("ca_nitrate", "ca", max(0.0, need_mmol.get("ca", 0.0) - accumulated["ca"]))

    # Step 2: micronutrients, booking whatever sulfate their carrier salts hold.
    for ion in MICRO_IONS:
        _apply(ion + _MICRO_ROLE_SUFFIX, ion, need_mmol.get(ion, 0.0))

    # Step 3: ammonium, crediting what the calcium salt already delivered.
    ammonium_role = next(
        (role for role in _AMMONIUM_ROLE_PREFERENCE if role in salts),
        _AMMONIUM_ROLE_PREFERENCE[0],
    )
    _apply(
        ammonium_role,
        "n_nh4",
        max(0.0, need_mmol.get("n_nh4", 0.0) - accumulated["n_nh4"]),
    )

    # Step 4: phosphorus, crediting phosphate that arrived with the ammonium salt.
    _apply("p_phosphate", "p", max(0.0, need_mmol.get("p", 0.0) - accumulated["p"]))

    # Step 5: magnesium sulfate up to the sulfate ceiling, remainder as nitrate.
    magnesium_need = need_mmol.get("mg", 0.0)
    sulfate_need = need_mmol.get("s", 0.0)
    sulfate_headroom = max(0.0, sulfate_need - accumulated["s"])
    magnesium_from_sulfate = (
        min(magnesium_need, sulfate_headroom) if "mg_sulfate" in salts else 0.0
    )
    delivered_magnesium = _apply("mg_sulfate", "mg", magnesium_from_sulfate)
    _apply("mg_nitrate", "mg", max(0.0, magnesium_need - delivered_magnesium))

    # Step 6: any sulfate still owed arrives as potassium sulfate (two K per S).
    _apply("k_sulfate", "s", max(0.0, sulfate_need - accumulated["s"]))

    # Step 7: the potassium balance arrives as potassium nitrate.
    _apply("k_nitrate", "k", max(0.0, need_mmol.get("k", 0.0) - accumulated["k"]))

    # Step 8: calcium last when its salt carries no nitrogen of its own.
    if not calcium_carries_nitrogen:
        _apply("ca_nitrate", "ca", max(0.0, need_mmol.get("ca", 0.0) - accumulated["ca"]))

    tanks, placed = _assign_tanks(plan, kno3_tank_a_fraction, volume_l)
    _validate_tank_compatibility(placed)

    unassigned = [entry["formula"] for entry in tanks["unassigned"]["fertilizers"]]
    if unassigned:
        warnings.append(
            "No tank assignment was supplied for "
            + ", ".join(sorted(set(unassigned)))
            + "; those masses sit in the unassigned bucket and were not checked"
            + " against the calcium and sulfate separation rule.",
        )

    achieved = _build_achieved(accumulated, water_mmol, unit_by_ion, factor_by_ion)
    residuals = _build_residuals(accumulated, water_mmol, target_mmol, unit_by_ion, factor_by_ion)
    nitrate = _reconcile_nitrate(
        plan=plan,
        accumulated=accumulated,
        need_mmol=need_mmol,
        target_mmol=target_mmol,
        water_mmol=water_mmol,
        unit_by_ion=unit_by_ion,
        factor_by_ion=factor_by_ion,
        salts=salts,
    )

    source_water_excess = [
        {
            "ion": ion,
            "unit": unit_by_ion[ion],
            "source_water": _round(water_mmol[ion] / factor_by_ion[ion], 9),
            "target": _round(target_mmol[ion] / factor_by_ion[ion], 9),
            "excess": _round(value / factor_by_ion[ion], 9),
            "excess_mmol_per_l": _round(value, 9),
            "detail": "Source water already exceeds the target for this ion;"
            + " no salt choice can remove it.",
        }
        for ion, value in excess_mmol.items()
        if value > _MET_TOLERANCE
    ]

    return {
        "stock_tank_volume_l": float(volume_l),
        "stock_ratio": float(ratio),
        "working_solution_volume_l": float(volume_l) * float(ratio),
        "options": {_KNO3_TANK_A_FRACTION_OPTION: float(kno3_tank_a_fraction)},
        "tanks": tanks,
        "allocation_steps": _build_allocation_steps(plan, unit_by_ion, factor_by_ion),
        "achieved_working_solution": achieved,
        "residuals": residuals,
        "unfulfilled": unfulfilled,
        "source_water_excess": source_water_excess,
        "excluded_ions": excluded_ions,
        "nitrate_reconciliation": nitrate,
        "warnings": warnings,
    }


def _tank_shares(dose: _Dose, kno3_tank_a_fraction: float) -> list[tuple[str, float]]:
    if dose.role == _SPLITTABLE_ROLE:
        shares: list[tuple[str, float]] = []
        if kno3_tank_a_fraction > _EPS:
            shares.append(("A", kno3_tank_a_fraction))
        if 1.0 - kno3_tank_a_fraction > _EPS:
            shares.append(("B", 1.0 - kno3_tank_a_fraction))
        return shares
    return [(dose.salt.tank_assignment or "unassigned", 1.0)]


def _tank_entry(dose: _Dose, tank: str, share: float, grams: float, volume_l: float) -> dict[str, Any]:
    return {
        "role": dose.role,
        "step": dose.step,
        "fertilizer_name": dose.salt.fertilizer_name,
        "formula": dose.salt.formula,
        "molecular_weight": dose.salt.molecular_weight,
        "tank": tank,
        "tank_assignment": dose.salt.tank_assignment,
        "driving_ion": dose.driving_ion,
        "dose_mmol_per_l_working": _round(dose.basis_mmol_per_l, 9),
        "share_of_dose": _round(share, 9),
        "grams": _round(grams, 3),
        "kilograms": _round(grams / 1000.0, 6),
        "grams_per_liter_of_stock": _round(grams / volume_l, 6),
        "contribution_basis": _MASS_FRACTION if dose.salt.mass_fraction else _MOL_PER_MOL,
        "product_mass_fraction": dose.salt.mass_fraction,
        "source_sheet": dose.salt.source_sheet,
        "source_row": dose.salt.source_row,
    }


def _assign_tanks(
    plan: list[_Dose],
    kno3_tank_a_fraction: float,
    volume_l: float,
) -> tuple[dict[str, dict[str, Any]], dict[str, list[_Dose]]]:
    tanks: dict[str, dict[str, Any]] = {
        name: {"tank": name, "fertilizers": [], "total_grams": 0.0, "total_kilograms": 0.0}
        for name in ("A", "B", "unassigned")
    }
    placed: dict[str, list[_Dose]] = {"A": [], "B": [], "unassigned": []}

    for dose in plan:
        for tank, share in _tank_shares(dose, kno3_tank_a_fraction):
            placed[tank].append(dose)
            tanks[tank]["fertilizers"].append(
                _tank_entry(dose, tank, share, dose.grams * share, volume_l)
            )

    for bucket in tanks.values():
        total = sum(entry["grams"] for entry in bucket["fertilizers"])
        bucket["total_grams"] = round(total, 3)
        bucket["total_kilograms"] = round(total / 1000.0, 6)

    return tanks, placed


def _validate_tank_compatibility(placed: Mapping[str, list[_Dose]]) -> None:
    """Fail loudly when calcium would share a tank with sulfate or phosphate."""
    for tank in ("A", "B"):
        doses = placed.get(tank, [])
        calcium = sorted(
            {dose.salt.formula for dose in doses if dose.salt.coefficients.get("ca", 0.0) > 0}
        )
        precipitating = sorted(
            {
                dose.salt.formula
                for dose in doses
                if dose.salt.coefficients.get("s", 0.0) > 0
                or dose.salt.coefficients.get("p", 0.0) > 0
            }
        )
        if calcium and precipitating:
            raise TankCompatibilityError(
                "Tank " + tank + " would hold calcium salt(s) " + ", ".join(calcium)
                + " together with sulfate or phosphate salt(s) " + ", ".join(precipitating)
                + ". Calcium sulfate and calcium phosphate precipitate at stock"
                + " concentration, so these must be split across the A and B tanks."
            )


def _build_allocation_steps(
    plan: list[_Dose],
    unit_by_ion: Mapping[str, str],
    factor_by_ion: Mapping[str, float],
) -> list[dict[str, Any]]:
    steps: list[dict[str, Any]] = []
    for dose in plan:
        factor = factor_by_ion.get(dose.driving_ion, 1.0)
        steps.append(
            {
                "step": dose.step,
                "role": dose.role,
                "driving_ion": dose.driving_ion,
                "unit": unit_by_ion.get(dose.driving_ion, "mmol/L"),
                "requested": _round(dose.requested_mmol_per_l / factor, 9),
                "requested_mmol_per_l": _round(dose.requested_mmol_per_l, 9),
                "fertilizer_name": dose.salt.fertilizer_name,
                "formula": dose.salt.formula,
                "dose_mmol_per_l_working": _round(dose.basis_mmol_per_l, 9),
                "grams": _round(dose.grams, 3),
                "co_ions_mmol_per_l": {
                    ion: _round(dose.basis_mmol_per_l * coefficient, 9)
                    for ion, coefficient in dose.salt.coefficients.items()
                    if ion != dose.driving_ion and coefficient > 0
                },
                "source_row": dose.salt.source_row,
            }
        )
    return steps


def _build_achieved(
    accumulated: Mapping[str, float],
    water_mmol: Mapping[str, float],
    unit_by_ion: Mapping[str, str],
    factor_by_ion: Mapping[str, float],
) -> dict[str, dict[str, Any]]:
    achieved: dict[str, dict[str, Any]] = {}
    for ion in SOLVER_ION_ORDER:
        in_scope = ion in unit_by_ion
        booked = accumulated.get(ion, 0.0)
        if not in_scope and booked <= _MET_TOLERANCE:
            continue
        factor = factor_by_ion.get(ion, 1.0)
        from_water = water_mmol.get(ion, 0.0)
        achieved[ion] = {
            "value": _round((from_water + booked) / factor, 9),
            "unit": unit_by_ion.get(ion, "mmol/L"),
            "from_source_water": _round(from_water / factor, 9),
            "from_fertilizer": _round(booked / factor, 9),
            "value_mmol_per_l": _round(from_water + booked, 9),
        }
    return achieved


def _build_residuals(
    accumulated: Mapping[str, float],
    water_mmol: Mapping[str, float],
    target_mmol: Mapping[str, float],
    unit_by_ion: Mapping[str, str],
    factor_by_ion: Mapping[str, float],
) -> dict[str, dict[str, Any]]:
    residuals: dict[str, dict[str, Any]] = {}
    for ion in SOLVER_ION_ORDER:
        if ion not in unit_by_ion:
            continue
        factor = factor_by_ion[ion]
        achieved_mmol = water_mmol.get(ion, 0.0) + accumulated.get(ion, 0.0)
        residual_mmol = target_mmol[ion] - achieved_mmol
        if abs(residual_mmol) <= _MET_TOLERANCE:
            status = "met"
        elif residual_mmol > 0:
            status = "short"
        else:
            status = "over"
        residuals[ion] = {
            "unit": unit_by_ion[ion],
            "target": _round(target_mmol[ion] / factor, 9),
            "achieved": _round(achieved_mmol / factor, 9),
            "residual": _round(residual_mmol / factor, 9),
            "residual_mmol_per_l": _round(residual_mmol, 9),
            "status": status,
        }
    return residuals


def _nitrate_cause(
    status: str,
    difference_mmol: float,
    factor: float,
    unit: str,
    contributors: list[dict[str, Any]],
    roles_in_plan: set[str],
) -> str:
    if status == "balanced":
        return "Accumulated nitrate matches the fertilizer nitrate requirement within tolerance."

    amount = _format_amount(abs(difference_mmol) / factor) + " " + unit
    largest = "; ".join(
        entry["formula"] + " contributes " + _format_amount(entry["n_no3_mmol_per_l"]) + " mmol/L"
        for entry in contributors[:3]
    )

    if status == "excess":
        text = "Accumulated nitrate exceeds the fertilizer nitrate requirement by " + amount + "."
        if largest:
            text += " Largest nitrate contributors: " + largest + "."
        if "ca_nitrate" in roles_in_plan and "k_nitrate" in roles_in_plan:
            text += (
                " Calcium and potassium both arrive as nitrates with this salt set,"
                " so the nitrate ceiling is passed while their own targets are being met."
            )
        return text

    text = "Accumulated nitrate falls short of the fertilizer nitrate requirement by " + amount + "."
    if largest:
        text += " Current nitrate contributors: " + largest + "."
    text += (
        " No nitrate-only salt exists in this set, so nitrate can only rise by moving"
        " potassium or magnesium off their sulfate forms."
    )
    return text


def _nitrate_swaps(
    *,
    status: str,
    difference_mmol: float,
    plan: list[_Dose],
    salts: Mapping[str, _Salt],
    factor: float,
    unit: str,
) -> list[dict[str, Any]]:
    """Name the substitutions that would move nitrate, with their cost in another ion."""
    if status == "balanced":
        return []

    plan_by_role = {dose.role: dose for dose in plan}
    swaps: list[dict[str, Any]] = []

    def _swap(
        replace: _Dose,
        replacement: _Salt,
        moved_ion: str,
        moved: float,
        nitrate_change: float,
        side_effect_ion: str,
        side_effect_change: float,
        detail: str,
    ) -> None:
        swaps.append(
            {
                "replace": replace.salt.formula,
                "with": replacement.formula,
                "moves_ion": moved_ion,
                "moved_mmol_per_l": _round(moved, 9),
                "n_no3_change": _round(nitrate_change / factor, 9),
                "n_no3_change_mmol_per_l": _round(nitrate_change, 9),
                "side_effect_ion": side_effect_ion,
                "side_effect_change_mmol_per_l": _round(side_effect_change, 9),
                "unit": unit,
                "detail": detail,
            }
        )

    if status == "excess":
        potassium = plan_by_role.get("k_nitrate")
        sulfate_source = salts.get("k_sulfate")
        if potassium is not None and sulfate_source is not None:
            moved = min(difference_mmol, potassium.basis_mmol_per_l)
            _swap(
                potassium,
                sulfate_source,
                "k",
                moved,
                -moved,
                "s",
                moved / 2.0,
                "Moving potassium off KNO3 removes one nitrate per potassium and adds"
                " half a sulfate per potassium, pushing sulfate above its target.",
            )

        calcium = plan_by_role.get("ca_nitrate")
        chloride_source = salts.get("ca_chloride")
        if calcium is not None and chloride_source is not None:
            calcium_nitrate_per_mol = calcium.salt.coefficients.get("n_no3", 0.0)
            calcium_per_mol = calcium.salt.coefficients.get("ca", 0.0)
            nitrate_per_calcium = (
                calcium_nitrate_per_mol / calcium_per_mol if calcium_per_mol > 0 else 0.0
            )
            if nitrate_per_calcium > 0:
                delivered_calcium = calcium.basis_mmol_per_l * calcium_per_mol
                reduction = min(difference_mmol, delivered_calcium * nitrate_per_calcium)
                moved_calcium = reduction / nitrate_per_calcium
                _swap(
                    calcium,
                    chloride_source,
                    "ca",
                    moved_calcium,
                    -reduction,
                    "cl",
                    moved_calcium * 2.0,
                    "Moving calcium onto CaCl2 removes the nitrate that rides with"
                    " calcium nitrate and adds two chloride per calcium, which the"
                    " chloride ceiling has to absorb.",
                )
        return swaps

    potassium_sulfate = plan_by_role.get("k_sulfate")
    nitrate_source = salts.get("k_nitrate")
    if potassium_sulfate is not None and nitrate_source is not None:
        available = potassium_sulfate.basis_mmol_per_l * potassium_sulfate.salt.coefficients.get("k", 0.0)
        moved = min(difference_mmol, available)
        _swap(
            potassium_sulfate,
            nitrate_source,
            "k",
            moved,
            moved,
            "s",
            -moved / 2.0,
            "Moving potassium off K2SO4 adds one nitrate per potassium and gives up"
            " half a sulfate per potassium.",
        )

    magnesium_sulfate = plan_by_role.get("mg_sulfate")
    magnesium_nitrate = salts.get("mg_nitrate")
    if magnesium_sulfate is not None and magnesium_nitrate is not None:
        nitrate_per_magnesium = magnesium_nitrate.coefficients.get("n_no3", 0.0)
        if nitrate_per_magnesium > 0:
            available = magnesium_sulfate.basis_mmol_per_l * nitrate_per_magnesium
            gain = min(difference_mmol, available)
            moved_magnesium = gain / nitrate_per_magnesium
            _swap(
                magnesium_sulfate,
                magnesium_nitrate,
                "mg",
                moved_magnesium,
                gain,
                "s",
                -moved_magnesium,
                "Moving magnesium off MgSO4 adds two nitrate per magnesium and gives"
                " up one sulfate per magnesium.",
            )

    return swaps


def _reconcile_nitrate(
    *,
    plan: list[_Dose],
    accumulated: Mapping[str, float],
    need_mmol: Mapping[str, float],
    target_mmol: Mapping[str, float],
    water_mmol: Mapping[str, float],
    unit_by_ion: Mapping[str, str],
    factor_by_ion: Mapping[str, float],
    salts: Mapping[str, _Salt],
) -> dict[str, Any]:
    ion = "n_no3"
    supplied_mmol = accumulated.get(ion, 0.0)

    contributors: list[dict[str, Any]] = []
    for dose in plan:
        contribution = dose.basis_mmol_per_l * dose.salt.coefficients.get(ion, 0.0)
        if contribution <= _MET_TOLERANCE:
            continue
        contributors.append(
            {
                "step": dose.step,
                "role": dose.role,
                "formula": dose.salt.formula,
                "n_no3_mmol_per_l": _round(contribution, 9),
                "source_row": dose.salt.source_row,
            }
        )
    contributors.sort(key=lambda entry: (-entry["n_no3_mmol_per_l"], entry["step"]))

    if ion not in unit_by_ion:
        return {
            "ion": ion,
            "unit": "mmol/L",
            "status": "not_evaluated",
            "target": None,
            "source_water": None,
            "need_from_fertilizer": None,
            "supplied_by_fertilizer": _round(supplied_mmol, 9),
            "supplied_by_fertilizer_mmol_per_l": _round(supplied_mmol, 9),
            "difference": None,
            "difference_mmol_per_l": None,
            "contributors": contributors,
            "cause": "No usable nitrate unit was supplied, so accumulated nitrate could"
            + " not be compared against a target.",
            "suggested_swaps": [],
        }

    factor = factor_by_ion[ion]
    need = need_mmol.get(ion, 0.0)
    difference_mmol = supplied_mmol - need
    if abs(difference_mmol) <= _MET_TOLERANCE:
        status = "balanced"
    elif difference_mmol > 0:
        status = "excess"
    else:
        status = "deficit"

    return {
        "ion": ion,
        "unit": unit_by_ion[ion],
        "status": status,
        "target": _round(target_mmol[ion] / factor, 9),
        "source_water": _round(water_mmol.get(ion, 0.0) / factor, 9),
        "need_from_fertilizer": _round(need / factor, 9),
        "supplied_by_fertilizer": _round(supplied_mmol / factor, 9),
        "supplied_by_fertilizer_mmol_per_l": _round(supplied_mmol, 9),
        "difference": _round(difference_mmol / factor, 9),
        "difference_mmol_per_l": _round(difference_mmol, 9),
        "contributors": contributors,
        "cause": _nitrate_cause(
            status,
            difference_mmol,
            factor,
            unit_by_ion[ion],
            contributors,
            {dose.role for dose in plan},
        ),
        "suggested_swaps": _nitrate_swaps(
            status=status,
            difference_mmol=abs(difference_mmol),
            plan=plan,
            salts=salts,
            factor=factor,
            unit=unit_by_ion[ion],
        ),
    }
