"""Deterministic advisory seams built on normalized SmartGrow workbook rows."""

from __future__ import annotations

import json
import re
from collections import Counter
from functools import lru_cache
from itertools import product
from pathlib import Path
from typing import Any

from .nutrient_solver import SOLVER_ION_ORDER, solve_stock_tanks
from .workbook_normalization import (
    export_nutrient_reference_rows,
    export_pesticide_reference_rows,
)


def _normalize_text(value: Any) -> str:
    return re.sub(r"\s+", " ", str(value or "")).strip()


def _normalize_lookup_key(value: str) -> str:
    return re.sub(r"[^0-9a-z가-힣]+", "", _normalize_text(value).lower())


def _match_score(query: str, candidate: str) -> int:
    query_key = _normalize_lookup_key(query)
    candidate_key = _normalize_lookup_key(candidate)
    if not query_key or not candidate_key:
        return 0
    if query_key == candidate_key:
        return 100
    if query_key in candidate_key or candidate_key in query_key:
        return 80

    candidate_norm = _normalize_text(candidate).lower()
    term_hits = sum(
        1
        for term in _normalize_text(query).lower().split()
        if term and term in candidate_norm
    )
    if term_hits:
        return 50 + (term_hits * 10)
    return 0


def _sample_strings(values: list[str], limit: int = 8) -> list[str]:
    seen: list[str] = []
    for value in values:
        clean = _normalize_text(value)
        if clean and clean not in seen:
            seen.append(clean)
        if len(seen) >= limit:
            break
    return seen


def _resolve_candidate(
    requested: str | None,
    candidates: list[str],
    *,
    default: str | None = None,
) -> tuple[str, str]:
    options = [candidate for candidate in candidates if _normalize_text(candidate)]
    if not options:
        raise LookupError("No deterministic candidates are available.")

    if not requested:
        if default and default in options:
            return default, "default"
        return options[0], "default"

    ranked = sorted(
        ((candidate, _match_score(requested, candidate)) for candidate in options),
        key=lambda item: (-item[1], item[0]),
    )
    best_candidate, score = ranked[0]
    if score <= 0:
        raise LookupError(f"No deterministic match found for '{requested}'.")
    if _normalize_lookup_key(requested) == _normalize_lookup_key(best_candidate):
        return best_candidate, "exact"
    return best_candidate, "fuzzy"


_PESTICIDE_STATUS_WEIGHT = {
    "new-registration": 3,
    "existing-registration": 2,
    "unknown": 1,
    "label-check-required": 0,
}
_PESTICIDE_READY_STATUSES = {"new-registration", "existing-registration"}
_PESTICIDE_MANUAL_REVIEW_STATUSES = {"unknown", "label-check-required"}
_PESTICIDE_PLACEHOLDER_PRODUCT_KEYS = {
    "1차",
    "2차",
    "3차",
    "4차",
    "5차",
    "추천포인트",
}
_CROP_QUERY_MARKERS = {
    "tomato": ("토마토", "tomato"),
    "cucumber": ("오이", "cucumber"),
}


def _target_is_crop_compatible(target_name: str, crop: str) -> bool:
    text = _normalize_text(target_name)
    text_lower = text.lower()
    if crop == "tomato":
        return "오이" not in text and "cucumber" not in text_lower
    if crop == "cucumber":
        return "토마토" not in text and "tomato" not in text_lower
    return True


def _validate_pesticide_target_scope(crop: str, target_query: str) -> None:
    normalized_crop = _normalize_text(crop).lower()
    target_norm = _normalize_text(target_query)
    target_lower = target_norm.lower()

    for crop_name, markers in _CROP_QUERY_MARKERS.items():
        if crop_name == normalized_crop:
            continue
        if any(marker in target_norm or marker in target_lower for marker in markers):
            raise LookupError(
                f"Target '{target_query}' does not align with crop '{crop}' in the current deterministic pesticide scope."
            )


def _filter_crop_targets(target_names: list[str], crop: str) -> list[str]:
    return [
        target_name
        for target_name in target_names
        if _normalize_text(target_name) and _target_is_crop_compatible(target_name, crop)
    ]


def _sanitize_pesticide_product_name(name: str) -> str:
    text = _normalize_text(name)
    without_annotations = _normalize_text(re.sub(r"\([^)]*\)", "", text))
    return without_annotations or text


def _pesticide_product_lookup_keys(product_names: list[str]) -> list[str]:
    keys: list[str] = []
    for product_name in product_names:
        for candidate in (
            _normalize_text(product_name),
            _sanitize_pesticide_product_name(product_name),
        ):
            normalized = _normalize_lookup_key(candidate)
            if normalized and normalized not in keys:
                keys.append(normalized)
    return keys


def _select_strongest_registration_status(*statuses: str | None) -> str:
    return max(
        (_normalize_text(status) for status in statuses if _normalize_text(status)),
        key=lambda status: _PESTICIDE_STATUS_WEIGHT.get(status, -1),
        default="unknown",
    )


def _build_pesticide_product_index(products: list[dict[str, Any]]) -> dict[str, dict[str, Any]]:
    product_index: dict[str, dict[str, Any]] = {}
    for row in products:
        for key in _pesticide_product_lookup_keys(row.get("product_names", [])):
            current = product_index.get(key)
            if current is None or (
                _PESTICIDE_STATUS_WEIGHT.get(row.get("registration_status", ""), -1),
                -int(row.get("source_row", 0)),
            ) > (
                _PESTICIDE_STATUS_WEIGHT.get(current.get("registration_status", ""), -1),
                -int(current.get("source_row", 0)),
            ):
                product_index[key] = row
    return product_index


def _is_placeholder_rotation_row(row: dict[str, Any]) -> bool:
    product_keys = _pesticide_product_lookup_keys(row.get("product_names", []))
    if not product_keys:
        return True
    if all(product_key in _PESTICIDE_PLACEHOLDER_PRODUCT_KEYS for product_key in product_keys):
        return True
    return _normalize_lookup_key(row.get("application_point", "")) == "추천포인트"


def _enrich_rotation_row(
    row: dict[str, Any],
    *,
    crop: str,
    product_index: dict[str, dict[str, Any]],
) -> dict[str, Any]:
    matched_product = next(
        (
            product_index[key]
            for key in _pesticide_product_lookup_keys(row.get("product_names", []))
            if key in product_index
        ),
        None,
    )
    target_names = _filter_crop_targets(
        matched_product.get("target_names", []) if matched_product else [],
        crop,
    )
    effective_registration_status = _select_strongest_registration_status(
        row.get("registration_status"),
        matched_product.get("registration_status") if matched_product else None,
    )
    effective_moa_group = _normalize_text(
        matched_product.get("moa_code_group") if matched_product else row.get("moa_code_group")
    )
    product_names = (
        matched_product.get("product_names")
        if matched_product and matched_product.get("product_names")
        else [
            _sanitize_pesticide_product_name(name)
            for name in row.get("product_names", [])
            if _sanitize_pesticide_product_name(name)
        ]
    )
    return {
        **row,
        "target_names": target_names,
        "active_ingredient": _normalize_text(
            matched_product.get("active_ingredient") if matched_product else row.get("active_ingredient")
        ),
        "product_names": product_names,
        "moa_code_group": effective_moa_group,
        "registration_status": effective_registration_status,
        "mixing_caution": _normalize_text(
            matched_product.get("mixing_caution") if matched_product else ""
        ),
        "dilution": _normalize_text(matched_product.get("dilution") if matched_product else ""),
        "cycle_recommendation": _normalize_text(
            matched_product.get("cycle_recommendation") if matched_product else ""
        ),
        "manual_review_required": effective_registration_status in _PESTICIDE_MANUAL_REVIEW_STATUSES,
        "matched_product_master": bool(matched_product),
    }


def _canonical_pesticide_moa_key(value: str) -> str:
    canonical = re.sub(r"^(FRAC|IRAC)\s+", "", _normalize_text(value), flags=re.IGNORECASE)
    return _normalize_lookup_key(canonical)


def _rotation_identity_key(row: dict[str, Any]) -> str:
    moa_key = _canonical_pesticide_moa_key(row.get("moa_code_group", ""))
    if moa_key:
        return moa_key
    product_names = row.get("product_names", [])
    if product_names:
        return _normalize_lookup_key(product_names[0])
    return _normalize_lookup_key(row.get("active_ingredient", ""))


def _select_rotation_rows(
    ranked_rotations: list[tuple[int, dict[str, Any]]],
    *,
    limit: int,
) -> tuple[list[dict[str, Any]], dict[str, int]]:
    ready_candidates = [row for _, row in ranked_rotations if not row["manual_review_required"]]
    manual_candidates = [row for _, row in ranked_rotations if row["manual_review_required"]]
    selected_rows: list[dict[str, Any]] = []
    seen_keys: set[str] = set()
    excluded_counts = Counter()
    selected_manual_review = 0

    def take_rows(candidates: list[dict[str, Any]], *, manual_review: bool) -> None:
        nonlocal selected_manual_review
        for row in candidates:
            if len(selected_rows) >= limit:
                return
            identity_key = _rotation_identity_key(row)
            if identity_key and identity_key in seen_keys:
                excluded_counts["duplicate_moa"] += 1
                continue
            selected_rows.append(row)
            if identity_key:
                seen_keys.add(identity_key)
            if manual_review:
                selected_manual_review += 1

    take_rows(ready_candidates, manual_review=False)
    take_rows(manual_candidates, manual_review=True)
    excluded_counts["manual_review_deferred"] = max(
        len(manual_candidates) - selected_manual_review,
        0,
    )
    return selected_rows, dict(excluded_counts)


def _parse_rotation_slot_index(value: Any) -> int | None:
    text = _normalize_text(value)
    if not text:
        return None
    match = re.search(r"(\d+)", text)
    if not match:
        return None
    return int(match.group(1))


def _format_rotation_slot_label(
    value: Any,
    *,
    fallback_index: int | None = None,
) -> str | None:
    text = _normalize_text(value)
    slot_index = _parse_rotation_slot_index(text)
    if text and slot_index is not None and _normalize_lookup_key(text).startswith("slot"):
        return f"{slot_index}차"
    if text:
        return text
    if fallback_index is not None:
        return f"{fallback_index}차"
    return None


def _collect_pesticide_product_reason_codes(row: dict[str, Any]) -> list[str]:
    codes: list[str] = []
    if _sample_strings(row.get("target_names", []), limit=3):
        codes.append("target-match")
    if _format_rotation_slot_label(row.get("rotation_slot")):
        codes.append("rotation-slot")
    if _normalize_text(row.get("cycle_recommendation")):
        codes.append("cycle-available")
    registration_status = _normalize_text(row.get("registration_status"))
    if registration_status in _PESTICIDE_READY_STATUSES:
        codes.append("registration-ready")
    elif registration_status in _PESTICIDE_MANUAL_REVIEW_STATUSES:
        codes.append("manual-review")
    return codes


def _collect_rotation_step_reason_codes(row: dict[str, Any]) -> list[str]:
    codes: list[str] = []
    if _normalize_text(row.get("application_point")):
        codes.append("application-point")
    if _normalize_text(row.get("reason")):
        codes.append("rotation-rationale")
    if _normalize_text(row.get("notes")):
        codes.append("field-note")
    if row.get("manual_review_required"):
        codes.append("manual-review")
    return codes


def _serialize_pesticide_product(row: dict[str, Any]) -> dict[str, Any]:
    product_names = _sample_strings(list(row.get("product_names", [])), limit=6)
    primary_name = product_names[0] if product_names else ""
    return {
        "product_name": primary_name,
        "product_names": product_names,
        "product_aliases": product_names[1:],
        "active_ingredient": row["active_ingredient"],
        "target_names": row["target_names"][:4],
        "matched_targets": row["target_names"][:4],
        "moa_code_group": row["moa_code_group"],
        "registration_status": row["registration_status"],
        "dilution": row["dilution"],
        "cycle_recommendation": row["cycle_recommendation"],
        "cycle_solution": row["cycle_recommendation"] or None,
        "rotation_slot": row.get("rotation_slot") or None,
        "rotation_slot_index": _parse_rotation_slot_index(row.get("rotation_slot")),
        "rotation_slot_label": _format_rotation_slot_label(row.get("rotation_slot")),
        "mixing_caution": row["mixing_caution"],
        "manual_review_required": row["registration_status"] in _PESTICIDE_MANUAL_REVIEW_STATUSES,
        "operational_status": (
            "manual-review-required"
            if row["registration_status"] in _PESTICIDE_MANUAL_REVIEW_STATUSES
            else "ready"
        ),
        "source_sheet": row["source_sheet"],
        "source_row": row["source_row"],
        "reason_codes": _collect_pesticide_product_reason_codes(row),
        "notes_farmer_friendly": None,
        "recommendation_reason": None,
        "application_method": None,
    }


def _serialize_rotation_step(
    row: dict[str, Any],
    *,
    step_index: int,
    alternative_reason_code: str | None = None,
) -> dict[str, Any]:
    product_names = _sample_strings(list(row.get("product_names", [])), limit=6)
    primary_name = product_names[0] if product_names else ""
    return {
        "rotation_theme": row["rotation_theme"],
        "rotation_slot": _format_rotation_slot_label(
            row.get("rotation_slot"),
            fallback_index=step_index,
        ),
        "rotation_slot_index": _parse_rotation_slot_index(row.get("rotation_slot")),
        "rotation_step_index": step_index,
        "rotation_step_label": f"{step_index}단계",
        "target_name": row["target_name"],
        "matched_targets": row.get("target_names", [])[:4],
        "product_name": primary_name,
        "product_names": product_names,
        "product_aliases": product_names[1:],
        "active_ingredient": row["active_ingredient"],
        "moa_code_group": row["moa_code_group"],
        "application_point": row["application_point"],
        "reason": row["reason"],
        "notes": row["notes"],
        "reason_codes": _collect_rotation_step_reason_codes(row),
        "reason_summary": None,
        "registration_status": row["registration_status"],
        "mixing_caution": row["mixing_caution"] or None,
        "dilution": row["dilution"] or None,
        "cycle_recommendation": row["cycle_recommendation"] or None,
        "cycle_solution": row["cycle_recommendation"] or None,
        "manual_review_required": row["manual_review_required"],
        "operational_status": (
            "manual-review-required" if row["manual_review_required"] else "ready"
        ),
        "source_sheet": row["source_sheet"],
        "source_row": row["source_row"],
        "alternative_reason_code": alternative_reason_code,
        "alternative_reason": None,
    }


def _resolve_rotation_alternative_reason_code(
    row: dict[str, Any],
    *,
    selected_identity_keys: set[str],
) -> str:
    identity_key = _rotation_identity_key(row)
    if identity_key and identity_key in selected_identity_keys:
        return "duplicate-moa"
    if row.get("manual_review_required"):
        return "manual-review"
    return "backup-option"


def _build_rotation_guidance(
    rotation_program: list[dict[str, Any]],
    rotation_alternatives: list[dict[str, Any]],
) -> dict[str, Any]:
    ready_steps = [
        row for row in rotation_program if row.get("operational_status") == "ready"
    ]
    manual_review_steps = [
        row
        for row in rotation_program
        if row.get("operational_status") == "manual-review-required"
    ]
    first_ready = ready_steps[0] if ready_steps else None
    return {
        "summary": None,
        "recommended_opening_step": first_ready.get("rotation_step_label")
        if first_ready
        else (rotation_program[0].get("rotation_step_label") if rotation_program else None),
        "recommended_opening_step_index": first_ready.get("rotation_step_index")
        if first_ready
        else (
            rotation_program[0].get("rotation_step_index")
            if rotation_program
            else None
        ),
        "rotation_step_count": len(rotation_program),
        "ready_step_count": len(ready_steps),
        "manual_review_step_count": len(manual_review_steps),
        "alternative_count": len(rotation_alternatives),
        "policy_code": "registered-first-unique-moa",
        "policy_label": None,
    }


_NUTRIENT_ANALYTE_LABELS = {
    "n_no3": "N-NO3",
    "n_nh4": "N-NH4",
    "p": "P",
    "k": "K",
    "ca": "Ca",
    "mg": "Mg",
    "s": "S",
    "fe": "Fe",
    "mn": "Mn",
    "zn": "Zn",
    "b": "B",
    "cu": "Cu",
    "mo": "Mo",
    "cl": "Cl",
    "hco3": "HCO3",
    "na": "Na",
    "si": "Si",
    "ec": "EC",
}

_NUTRIENT_ANALYTE_ALIASES = {
    "nno3": "n_no3",
    "no3": "n_no3",
    "nnh4": "n_nh4",
    "nh4": "n_nh4",
    "p": "p",
    "k": "k",
    "ca": "ca",
    "mg": "mg",
    "s": "s",
    "fe": "fe",
    "mn": "mn",
    "zn": "zn",
    "b": "b",
    "cu": "cu",
    "mo": "mo",
    "cl": "cl",
    "chloride": "cl",
    "hco3": "hco3",
    "bicarbonate": "hco3",
    "na": "na",
    "sodium": "na",
    "si": "si",
    "silicon": "si",
    "ec": "ec",
}

# A recipe row publishes macro targets in mmol/L and micro targets in µmol/L. Every
# arithmetic path that mixes a target with a mmol/L water analysis has to carry that
# unit with the number, so the reported unit always matches the reported value.
_UNIT_FACTORS_TO_MMOL_PER_L: dict[str, float] = {
    "mmol/l": 1.0,
    "mmoll": 1.0,
    "mmol/liter": 1.0,
    "mmol.l-1": 1.0,
    "umol/l": 1e-3,
    "umoll": 1e-3,
    "umol/liter": 1e-3,
    "umol.l-1": 1e-3,
}
_BALANCE_STATUS_TOLERANCE = 0.01

#: The published stock-tank basis: tanks A and B of 1000 L each at a concentration
#: factor of 100, feeding 100,000 L of working solution.
_STOCK_TANK_BASIS_VOLUME_L = 1000.0
_STOCK_TANK_BASIS_RATIO = 100.0
_EUROFINS_CONFIG_FILENAME = "nutrient_recipes_eurofins.json"
_CALCIUM_NITRATE_FORMULA_RANKING = (
    "ca(no3)2.4h2o",
    "5[ca(no3)2.2h2o]nh4no3",
    "ca(no3)2",
)
_SOLVER_FORWARDED_OPTIONS = ("kno3_tank_a_fraction",)
_PRESCRIPTION_OPTION_KEYS = _SOLVER_FORWARDED_OPTIONS + ("calcium_source_formula",)
_GUARDRAIL_ION_KEYS = (("cl", "cl_max"), ("hco3", "hco3_max"), ("na", "na_max"))


def _normalize_unit_key(value: Any) -> str:
    text = str(value or "").strip().lower()
    text = text.replace("\u00b5", "u").replace("\u03bc", "u")
    return text.replace(" ", "").replace("_", "")


def _unit_factor_to_mmol_per_l(value: Any) -> float | None:
    """Return the multiplier that turns one unit of *value* into mmol/L, or None."""
    return _UNIT_FACTORS_TO_MMOL_PER_L.get(_normalize_unit_key(value))


def _round_reported(value: float | None, digits: int = 9) -> float | None:
    return None if value is None else round(value, digits)


def _formula_lookup_key(value: Any) -> str:
    """Mirror the solver's formula key so product names resolve the same way."""
    text = str(value or "").strip().lower()
    for separator in ("\u00b7", "\u2022", "\u2219", "\u30fb", "*"):
        text = text.replace(separator, ".")
    return "".join(character for character in text if not character.isspace())


@lru_cache(maxsize=1)
def _load_nutrient_source_config() -> dict[str, Any]:
    """Load the primary-source provenance record that backs the recipe numbers."""
    path = Path(__file__).resolve().parents[5] / "configs" / _EUROFINS_CONFIG_FILENAME
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError:
        return {"unavailable": f"{_EUROFINS_CONFIG_FILENAME} was not found at {path}."}
    except (OSError, ValueError) as exc:
        return {"unavailable": f"{_EUROFINS_CONFIG_FILENAME} could not be read: {exc}"}
    if not isinstance(payload, dict):
        return {"unavailable": f"{_EUROFINS_CONFIG_FILENAME} does not hold a JSON object."}
    return payload


_STOCK_TANK_DRAFT_MODE = "single_fertilizer_stoichiometric"
_STOCK_TANK_DRAFT_DISCLAIMER = (
    "Single-fertilizer stoichiometric draft only; coupled multi-fertilizer balancing "
    "and operational label checks are still required."
)
_FORMULA_DRAFT_EXCLUSION_RULES = {
    "Na": (
        "Formula contains sodium but the current workbook contribution map does not "
        "model sodium side effects for this fertilizer reliably."
    ),
    "Si": (
        "Formula contains silicon but the current workbook contribution map does not "
        "model silicon side effects for this fertilizer reliably."
    ),
    "HCO3": (
        "Formula contains bicarbonate but the current workbook contribution map does not "
        "model bicarbonate side effects for this fertilizer reliably."
    ),
}
_STOCK_TANK_DRAFT_ELIGIBLE_ANALYTES = (
    "n_no3",
    "n_nh4",
    "p",
    "k",
    "ca",
    "mg",
    "s",
)
_STOCK_TANK_DRAFT_UNIT_CONTRACT = {
    "nutrient_targets": "mmol/L for currently eligible macro analytes",
    "molecular_weight": "g/mol",
    "direct_contribution_per_mol": "mol nutrient per mol fertilizer",
    "stock_ratio": "unitless multiplier",
}
_MACRO_BUNDLE_MODE = "macro_lane_bundle_candidate"
_MACRO_BUNDLE_LANE_KEYS = ("ca", "k", "mg", "n_nh4")
_MACRO_BUNDLE_OBJECTIVE_KEYS = ("ca", "k", "mg", "n_nh4", "n_no3")
_MACRO_BUNDLE_DISCLAIMER = (
    "Coupled macro bundle draft only; residual balancing and final stock-tank solving "
    "remain a later phase."
)
_MACRO_BUNDLE_RESIDUAL_POLICY = "prefer_no_objective_overshoot"
_DRAIN_FEEDBACK_TARGET_MODE = "bounded_drain_feedback_target_shift"
_DRAIN_FEEDBACK_STEP_CAP_RATIO = 0.15
_DRAIN_FEEDBACK_STEP_CAP_MIN_MMOL_L = 0.2
_DRAIN_FEEDBACK_STEP_CAP_MAX_MMOL_L = 1.5


def _canonical_nutrient_analyte_key(value: str) -> str:
    lookup_key = _normalize_lookup_key(value)
    return _NUTRIENT_ANALYTE_ALIASES.get(lookup_key, lookup_key)


def _display_nutrient_analyte(value: str) -> str:
    canonical_key = _canonical_nutrient_analyte_key(value)
    return _NUTRIENT_ANALYTE_LABELS.get(canonical_key, _normalize_text(value) or canonical_key)


def _summarize_water_reference(rows: list[dict[str, Any]]) -> dict[str, dict[str, Any]]:
    summary: dict[str, dict[str, Any]] = {}
    for row in rows:
        analyte = _normalize_text(row.get("analyte"))
        if not analyte:
            continue
        summary[analyte] = {
            "mmol_l": row.get("mmol_l"),
            "mg_l": row.get("mg_l"),
            "ec_contribution": row.get("ec_contribution"),
        }
    return summary


def _water_reference_index(rows: list[dict[str, Any]]) -> dict[str, dict[str, Any]]:
    index: dict[str, dict[str, Any]] = {}
    for row in rows:
        analyte = _normalize_text(row.get("analyte"))
        if not analyte:
            continue
        index[_canonical_nutrient_analyte_key(analyte)] = row
    return index


def _evaluate_water_measurements(
    measurements: dict[str, float],
    *,
    analysis_kind: str,
    baseline_index: dict[str, dict[str, Any]],
    guardrails: dict[str, float | None],
) -> list[dict[str, Any]]:
    reviews: list[dict[str, Any]] = []
    for analyte_name, observed_mmol_l in measurements.items():
        canonical_key = _canonical_nutrient_analyte_key(analyte_name)
        display_name = _display_nutrient_analyte(analyte_name)
        baseline_row = baseline_index.get(canonical_key)
        baseline_mmol_l = baseline_row.get("mmol_l") if baseline_row else None
        guardrail_max = guardrails.get(canonical_key)

        status = "reference-missing"
        guidance = (
            f"No workbook baseline is available for {display_name}; keep manual review in the loop."
        )
        delta_from_baseline = None
        delta_to_guardrail = None

        if baseline_mmol_l is not None:
            delta_from_baseline = observed_mmol_l - baseline_mmol_l
            tolerance = max(abs(baseline_mmol_l) * 0.15, 0.25)
            if delta_from_baseline > tolerance:
                status = "above-baseline"
                guidance = (
                    f"{display_name} is above the workbook {analysis_kind} baseline; review dilution or recipe correction before rollout."
                )
            elif delta_from_baseline < (-1 * tolerance):
                status = "below-baseline"
                guidance = (
                    f"{display_name} is below the workbook {analysis_kind} baseline; confirm whether supplementation is required before rollout."
                )
            else:
                status = "near-baseline"
                guidance = (
                    f"{display_name} remains close to the workbook {analysis_kind} baseline."
                )

        if guardrail_max is not None:
            delta_to_guardrail = observed_mmol_l - guardrail_max
            if delta_to_guardrail > 0:
                status = "above-guardrail"
                guidance = (
                    f"{display_name} exceeds the workbook guardrail; investigate dilution, source blending, or a manual recipe correction before use."
                )

        reviews.append(
            {
                "analysis_kind": analysis_kind,
                "analyte": display_name,
                "canonical_key": canonical_key,
                "observed_mmol_l": observed_mmol_l,
                "baseline_mmol_l": baseline_mmol_l,
                "delta_from_baseline_mmol_l": delta_from_baseline,
                "guardrail_max_mmol_l": guardrail_max,
                "delta_to_guardrail_mmol_l": delta_to_guardrail,
                "status": status,
                "guidance": guidance,
            }
        )

    severity_order = {
        "above-guardrail": 0,
        "above-baseline": 1,
        "below-baseline": 2,
        "near-baseline": 3,
        "reference-missing": 4,
    }
    reviews.sort(key=lambda row: (severity_order.get(row["status"], 9), row["analyte"]))
    return reviews


def _resolve_source_reference_value(
    canonical_key: str,
    *,
    submitted_measurements: dict[str, float],
    baseline_index: dict[str, dict[str, Any]],
) -> tuple[float, str]:
    for analyte_name, observed_value in submitted_measurements.items():
        if _canonical_nutrient_analyte_key(analyte_name) == canonical_key:
            return observed_value, "submitted"

    baseline_row = baseline_index.get(canonical_key)
    if baseline_row and baseline_row.get("mmol_l") is not None:
        return baseline_row["mmol_l"], "baseline"

    return 0.0, "missing"


def _format_stock_tank_draft_fit_status(delta_to_target_mmol_l: float | None) -> str:
    if delta_to_target_mmol_l is None:
        return "no-target-reference"
    if abs(delta_to_target_mmol_l) <= 0.01:
        return "meets-target"
    if delta_to_target_mmol_l < 0:
        return "above-target"
    return "below-target"


def _summarize_measurement_coverage(rows: list[dict[str, Any]]) -> dict[str, list[str]]:
    coverage = {
        "submitted_analytes": [],
        "baseline_analytes": [],
        "missing_analytes": [],
    }
    for row in rows:
        analyte = row.get("analyte")
        if not analyte:
            continue
        source_origin = row.get("source_origin")
        if source_origin == "submitted":
            coverage["submitted_analytes"].append(analyte)
        elif source_origin == "baseline":
            coverage["baseline_analytes"].append(analyte)
        else:
            coverage["missing_analytes"].append(analyte)
    for key in coverage:
        coverage[key] = sorted(dict.fromkeys(coverage[key]))
    return coverage


def _validate_water_measurement_inputs(
    measurements: dict[str, float] | None,
    *,
    analysis_kind: str,
) -> None:
    if not measurements:
        return
    for analyte_name, observed_mmol_l in measurements.items():
        if observed_mmol_l < 0:
            raise ValueError(
                f"{analysis_kind} measurement '{analyte_name}' must be greater than or equal to 0 mmol/L."
            )


def _build_source_reference_totals(
    *,
    submitted_measurements: dict[str, float],
    baseline_index: dict[str, dict[str, Any]],
    recipe_targets: dict[str, float | None],
    blocked_analytes: set[str],
) -> dict[str, float]:
    analyte_keys = set(baseline_index) | set(blocked_analytes)
    analyte_keys.update(
        _canonical_nutrient_analyte_key(analyte_name)
        for analyte_name in submitted_measurements
    )
    analyte_keys.update(
        key for key, target_mmol_l in recipe_targets.items() if target_mmol_l is not None
    )
    return {
        analyte_key: _resolve_source_reference_value(
            analyte_key,
            submitted_measurements=submitted_measurements,
            baseline_index=baseline_index,
        )[0]
        for analyte_key in analyte_keys
    }


def _build_drain_feedback_policy_summary() -> dict[str, Any]:
    return {
        "mode": _DRAIN_FEEDBACK_TARGET_MODE,
        "adjustable_analytes": [
            _NUTRIENT_ANALYTE_LABELS[key] for key in _STOCK_TANK_DRAFT_ELIGIBLE_ANALYTES
        ],
        "step_cap_ratio": _DRAIN_FEEDBACK_STEP_CAP_RATIO,
        "step_cap_min_mmol_l": _DRAIN_FEEDBACK_STEP_CAP_MIN_MMOL_L,
        "step_cap_max_mmol_l": _DRAIN_FEEDBACK_STEP_CAP_MAX_MMOL_L,
    }


def _clamp_drain_feedback_delta(
    *,
    recipe_target_mmol_l: float,
    raw_delta_mmol_l: float,
) -> tuple[float, bool, float]:
    step_cap = min(
        max(float(recipe_target_mmol_l) * _DRAIN_FEEDBACK_STEP_CAP_RATIO, _DRAIN_FEEDBACK_STEP_CAP_MIN_MMOL_L),
        _DRAIN_FEEDBACK_STEP_CAP_MAX_MMOL_L,
    )
    bounded_step = min(abs(float(raw_delta_mmol_l)), step_cap)
    bounded_delta = bounded_step if float(raw_delta_mmol_l) >= 0 else (-1 * bounded_step)
    return bounded_delta, abs(float(raw_delta_mmol_l)) > (step_cap + 0.0001), round(step_cap, 4)


def _build_drain_feedback_target_plan(
    *,
    recipe_targets: dict[str, float | None],
    drain_reviews: list[dict[str, Any]],
) -> dict[str, Any]:
    review_index = {
        row["canonical_key"]: row
        for row in drain_reviews
        if row.get("canonical_key")
    }
    effective_targets = dict(recipe_targets)
    adjustments: list[dict[str, Any]] = []
    adjusted_analytes: list[str] = []
    held_analytes: list[str] = []
    manual_review_analytes: list[str] = []
    unreviewed_analytes: list[str] = []

    for nutrient_key, recipe_target_mmol_l in recipe_targets.items():
        if recipe_target_mmol_l is None:
            continue

        display_name = _NUTRIENT_ANALYTE_LABELS.get(nutrient_key, nutrient_key)
        review = review_index.get(nutrient_key)
        if not review:
            unreviewed_analytes.append(display_name)
            continue

        review_status = review.get("status")
        target_origin = "recipe-default"
        adjustment_status = "hold-target"
        rationale = (
            "Drain feedback is present but does not justify a bounded target shift under the current policy."
        )
        effective_target_mmol_l = float(recipe_target_mmol_l)
        applied_step_mmol_l = 0.0
        step_cap_mmol_l: float | None = None
        clamped = False

        if nutrient_key not in _STOCK_TANK_DRAFT_ELIGIBLE_ANALYTES:
            adjustment_status = "manual-review-only"
            target_origin = "manual-review"
            rationale = (
                "Drain-feedback target shifts are currently limited to analytes with a validated mmol/L calculator contract."
            )
            manual_review_analytes.append(display_name)
        elif review_status in {"reference-missing", "above-guardrail"}:
            adjustment_status = "manual-review-only"
            target_origin = "manual-review"
            rationale = (
                "Drain feedback stays manual-review-only when the workbook reference is missing or the observed analyte already breaches a guardrail."
            )
            manual_review_analytes.append(display_name)
        else:
            raw_delta_mmol_l = review.get("delta_from_baseline_mmol_l")
            if raw_delta_mmol_l is None or review_status == "near-baseline":
                held_analytes.append(display_name)
                rationale = (
                    "Observed drain remains close to the workbook baseline, so the recipe target stays unchanged."
                )
            elif review_status in {"above-baseline", "below-baseline"}:
                bounded_delta, clamped, step_cap_mmol_l = _clamp_drain_feedback_delta(
                    recipe_target_mmol_l=float(recipe_target_mmol_l),
                    raw_delta_mmol_l=float(raw_delta_mmol_l),
                )
                effective_target_mmol_l = max(float(recipe_target_mmol_l) - bounded_delta, 0.0)
                applied_step_mmol_l = abs(bounded_delta)
                if bounded_delta > 0:
                    adjustment_status = "decrease-target"
                    rationale = (
                        "Observed drain is above the workbook baseline, so the next target is reduced within the bounded drain-feedback step cap."
                    )
                else:
                    adjustment_status = "increase-target"
                    rationale = (
                        "Observed drain is below the workbook baseline, so the next target is increased within the bounded drain-feedback step cap."
                    )
                target_origin = "drain-feedback-adjusted"
                adjusted_analytes.append(display_name)
            else:
                held_analytes.append(display_name)

        effective_targets[nutrient_key] = round(effective_target_mmol_l, 4)
        adjustments.append(
            {
                "analyte": display_name,
                "canonical_key": nutrient_key,
                "review_status": review_status,
                "recipe_target_mmol_l": round(float(recipe_target_mmol_l), 4),
                "effective_target_mmol_l": round(effective_target_mmol_l, 4),
                "observed_drain_mmol_l": review.get("observed_mmol_l"),
                "baseline_drain_mmol_l": review.get("baseline_mmol_l"),
                "delta_from_baseline_mmol_l": (
                    None
                    if review.get("delta_from_baseline_mmol_l") is None
                    else round(float(review["delta_from_baseline_mmol_l"]), 4)
                ),
                "applied_step_mmol_l": round(applied_step_mmol_l, 4),
                "step_cap_mmol_l": step_cap_mmol_l,
                "status": adjustment_status,
                "target_origin": target_origin,
                "clamped": clamped,
                "rationale": rationale,
            }
        )

    adjustments.sort(key=lambda row: (row["status"], row["analyte"]))
    return {
        "mode": _DRAIN_FEEDBACK_TARGET_MODE,
        "adjustments": adjustments,
        "adjusted_analytes": sorted(adjusted_analytes),
        "held_analytes": sorted(held_analytes),
        "manual_review_analytes": sorted(manual_review_analytes),
        "unreviewed_analytes": sorted(unreviewed_analytes),
        "effective_targets": effective_targets,
    }


def _collect_draft_exclusion_reasons(
    fertilizer: dict[str, Any],
    *,
    blocked_analytes: set[str],
) -> list[str]:
    formula = _normalize_text(fertilizer.get("formula"))
    name = _normalize_text(fertilizer.get("fertilizer_name"))
    contributions = fertilizer["nutrient_contribution_per_mol"]
    reasons: list[str] = []

    if fertilizer.get("molecular_weight") in (None, 0):
        reasons.append(
            "Molecular weight is missing from the workbook row, so a stoichiometric mass draft cannot be generated."
        )

    if "%" in formula or "%" in name:
        reasons.append(
            "Formula uses a percentage-style commercial product notation, so stoichiometric draft sizing is not reliable from the current workbook fields."
        )

    for token, reason in _FORMULA_DRAFT_EXCLUSION_RULES.items():
        if token in formula:
            reasons.append(reason)

    for analyte_key in sorted(blocked_analytes):
        if contributions.get(analyte_key) not in (None, 0):
            reasons.append(
                f"Adds blocked guardrail analyte {_NUTRIENT_ANALYTE_LABELS.get(analyte_key, analyte_key)}."
            )

    return reasons


def _build_single_fertilizer_draft(
    fertilizer: dict[str, Any],
    *,
    nutrient_key: str,
    supplemental_need_mmol_l: float,
    submitted_measurements: dict[str, float],
    baseline_index: dict[str, dict[str, Any]],
    recipe_targets: dict[str, float | None],
    guardrails: dict[str, float | None],
    blocked_analytes: set[str],
    working_solution_volume_l: float | None,
    stock_ratio: float | None,
) -> dict[str, Any]:
    exclusion_reasons = _collect_draft_exclusion_reasons(
        fertilizer,
        blocked_analytes=blocked_analytes,
    )
    _, target_source_origin = _resolve_source_reference_value(
        nutrient_key,
        submitted_measurements=submitted_measurements,
        baseline_index=baseline_index,
    )
    if nutrient_key not in _STOCK_TANK_DRAFT_ELIGIBLE_ANALYTES:
        exclusion_reasons.append(
            "Automatic gram drafts are currently limited to macro analytes with a validated mmol/L workbook contract; this analyte remains manual-only."
        )
    if target_source_origin == "missing":
        exclusion_reasons.append(
            "No submitted or workbook baseline source-water reference is available for the requested analyte, so the draft stays manual-only."
        )
    if working_solution_volume_l is None:
        exclusion_reasons.append(
            "Working solution volume is missing, so total batch grams cannot be drafted."
        )
    if stock_ratio is None:
        exclusion_reasons.append(
            "Stock ratio is missing, so stock concentration cannot be drafted."
        )

    direct_contribution = fertilizer["nutrient_contribution_per_mol"].get(nutrient_key)
    if direct_contribution in (None, 0):
        exclusion_reasons.append(
            "The current workbook row has no direct contribution for the requested analyte."
        )

    if exclusion_reasons:
        return {
            "mode": _STOCK_TANK_DRAFT_MODE,
            "status": "blocked",
            "blocked_reasons": exclusion_reasons,
            "disclaimer": _STOCK_TANK_DRAFT_DISCLAIMER,
        }

    direct_contribution_value = float(direct_contribution)
    fertilizer_mol_per_l = supplemental_need_mmol_l / (1000.0 * direct_contribution_value)
    total_fertilizer_mol = fertilizer_mol_per_l * float(working_solution_volume_l)
    total_fertilizer_grams = total_fertilizer_mol * float(fertilizer["molecular_weight"])
    stock_solution_volume_l = float(working_solution_volume_l) / float(stock_ratio)
    stock_solution_concentration_g_l = total_fertilizer_grams / stock_solution_volume_l

    projected_contributions: dict[str, float] = {}
    projected_target_fit: list[dict[str, Any]] = []
    projected_guardrail_breaches: list[dict[str, Any]] = []
    for analyte_key, contribution in fertilizer["nutrient_contribution_per_mol"].items():
        if contribution in (None, 0):
            continue

        delta_mmol_l = supplemental_need_mmol_l * float(contribution) / direct_contribution_value
        display_name = _NUTRIENT_ANALYTE_LABELS.get(analyte_key, analyte_key)
        source_mmol_l, source_origin = _resolve_source_reference_value(
            analyte_key,
            submitted_measurements=submitted_measurements,
            baseline_index=baseline_index,
        )
        target_mmol_l = recipe_targets.get(analyte_key)
        guardrail_max_mmol_l = guardrails.get(analyte_key)
        projected_total_mmol_l = source_mmol_l + delta_mmol_l
        delta_to_target_mmol_l = (
            None if target_mmol_l is None else target_mmol_l - projected_total_mmol_l
        )
        projected_contributions[display_name] = round(delta_mmol_l, 4)
        projected_target_fit.append(
            {
                "analyte": display_name,
                "canonical_key": analyte_key,
                "source_mmol_l": round(source_mmol_l, 4),
                "source_origin": source_origin,
                "target_mmol_l": target_mmol_l,
                "guardrail_max_mmol_l": guardrail_max_mmol_l,
                "projected_delta_mmol_l": round(delta_mmol_l, 4),
                "projected_total_mmol_l": round(projected_total_mmol_l, 4),
                "delta_to_target_mmol_l": (
                    None if delta_to_target_mmol_l is None else round(delta_to_target_mmol_l, 4)
                ),
                "status": _format_stock_tank_draft_fit_status(delta_to_target_mmol_l),
            }
        )
        if guardrail_max_mmol_l is not None and projected_total_mmol_l > (guardrail_max_mmol_l + 0.01):
            projected_guardrail_breaches.append(
                {
                    "analyte": display_name,
                    "canonical_key": analyte_key,
                    "guardrail_max_mmol_l": round(guardrail_max_mmol_l, 4),
                    "projected_total_mmol_l": round(projected_total_mmol_l, 4),
                }
            )

    severity_order = {
        "above-target": 0,
        "meets-target": 1,
        "below-target": 2,
        "no-target-reference": 3,
    }
    projected_target_fit.sort(
        key=lambda row: (
            0 if row["canonical_key"] == nutrient_key else 1,
            severity_order.get(row["status"], 9),
            row["analyte"],
        )
    )
    measurement_coverage = _summarize_measurement_coverage(projected_target_fit)
    provisional_reasons: list[str] = []
    if measurement_coverage["baseline_analytes"]:
        provisional_reasons.append(
            "One or more analytes still rely on workbook baseline values because submitted source-water measurements are incomplete."
        )
    if measurement_coverage["missing_analytes"]:
        provisional_reasons.append(
            "One or more analytes still have no submitted or workbook source-water reference."
        )
    secondary_target_overshoots = [
        {
            "analyte": row["analyte"],
            "projected_total_mmol_l": row["projected_total_mmol_l"],
            "target_mmol_l": row["target_mmol_l"],
        }
        for row in projected_target_fit
        if row["canonical_key"] != nutrient_key and row["status"] == "above-target"
    ]
    if projected_guardrail_breaches:
        blocked_reasons = [
            (
                f"Projected {row['analyte']} would exceed the workbook guardrail "
                f"({row['projected_total_mmol_l']} > {row['guardrail_max_mmol_l']} mmol/L) "
                "under this single-fertilizer draft."
            )
            for row in projected_guardrail_breaches
        ]
        return {
            "mode": _STOCK_TANK_DRAFT_MODE,
            "status": "blocked",
            "blocked_reasons": blocked_reasons,
            "projected_target_fit": projected_target_fit,
            "projected_guardrail_breaches": projected_guardrail_breaches,
            "measurement_coverage": measurement_coverage,
            "secondary_target_overshoots": secondary_target_overshoots,
            "disclaimer": _STOCK_TANK_DRAFT_DISCLAIMER,
        }

    draft_status = "provisional" if provisional_reasons else "draft"
    return {
        "mode": _STOCK_TANK_DRAFT_MODE,
        "status": draft_status,
        "basis": {
            "supplemental_need_mmol_l": round(supplemental_need_mmol_l, 4),
            "working_solution_volume_l": round(float(working_solution_volume_l), 4),
            "stock_ratio": round(float(stock_ratio), 4),
            "stock_solution_volume_l": round(stock_solution_volume_l, 4),
        },
        "estimated_batch_mass": {
            "fertilizer_mol": round(total_fertilizer_mol, 6),
            "fertilizer_grams": round(total_fertilizer_grams, 4),
            "stock_solution_concentration_g_l": round(stock_solution_concentration_g_l, 4),
        },
        "projected_contributions_mmol_l": projected_contributions,
        "projected_target_fit": projected_target_fit,
        "measurement_coverage": measurement_coverage,
        "provisional_reasons": provisional_reasons,
        "secondary_target_overshoots": secondary_target_overshoots,
        "disclaimer": _STOCK_TANK_DRAFT_DISCLAIMER,
    }


def _rank_fertilizer_candidates(
    fertilizers: list[dict[str, Any]],
    *,
    nutrient_key: str,
    blocked_analytes: set[str],
    submitted_measurements: dict[str, float],
    baseline_index: dict[str, dict[str, Any]],
    recipe_targets: dict[str, float | None],
    guardrails: dict[str, float | None],
    supplemental_need_mmol_l: float,
    working_solution_volume_l: float | None,
    stock_ratio: float | None,
    limit: int = 4,
) -> list[dict[str, Any]]:
    ranked: list[tuple[tuple[float, int, int, str], dict[str, Any]]] = []
    for fertilizer in fertilizers:
        contributions = fertilizer["nutrient_contribution_per_mol"]
        direct_contribution = contributions.get(nutrient_key)
        if direct_contribution in (None, 0):
            continue

        guardrail_side_effects = [
            _NUTRIENT_ANALYTE_LABELS.get(key, key)
            for key in sorted(blocked_analytes)
            if contributions.get(key) not in (None, 0)
        ]
        single_fertilizer_draft = _build_single_fertilizer_draft(
            fertilizer,
            nutrient_key=nutrient_key,
            supplemental_need_mmol_l=supplemental_need_mmol_l,
            submitted_measurements=submitted_measurements,
            baseline_index=baseline_index,
            recipe_targets=recipe_targets,
            guardrails=guardrails,
            blocked_analytes=blocked_analytes,
            working_solution_volume_l=working_solution_volume_l,
            stock_ratio=stock_ratio,
        )
        secondary_target_overshoots = single_fertilizer_draft.get(
            "secondary_target_overshoots", []
        )
        ranked.append(
            (
                (
                    -float(direct_contribution),
                    len(guardrail_side_effects),
                    len(secondary_target_overshoots),
                    fertilizer["fertilizer_name"],
                ),
                {
                    "target_analyte": _NUTRIENT_ANALYTE_LABELS.get(nutrient_key, nutrient_key),
                    "fertilizer_name": fertilizer["fertilizer_name"],
                    "formula": fertilizer["formula"],
                    "tank_assignment": fertilizer["tank_assignment"],
                    "direct_contribution_per_mol": direct_contribution,
                    "secondary_contributions": {
                        _NUTRIENT_ANALYTE_LABELS.get(key, key): value
                        for key, value in contributions.items()
                        if key != nutrient_key and value not in (None, 0)
                    },
                    "guardrail_side_effects": guardrail_side_effects,
                    "rank_reason": (
                        "Ranks by direct nutrient contribution while penalizing blocked guardrail analytes and secondary target overshoots."
                    ),
                    "operational_status": (
                        "blocked"
                        if single_fertilizer_draft["status"] == "blocked"
                        else "manual-review-required"
                        if single_fertilizer_draft["status"] == "provisional"
                        or secondary_target_overshoots
                        else "ready"
                    ),
                    "secondary_target_overshoots": secondary_target_overshoots,
                    "not_sized": True,
                    "single_fertilizer_draft": single_fertilizer_draft,
                    "source_sheet": fertilizer["source_sheet"],
                    "source_row": fertilizer["source_row"],
                },
            )
        )

    ranked.sort(key=lambda item: item[0])
    return [item[1] for item in ranked[:limit]]


def _single_draft_delta_index(candidate: dict[str, Any]) -> dict[str, float]:
    delta_index: dict[str, float] = {}
    for row in candidate.get("single_fertilizer_draft", {}).get("projected_target_fit", []):
        canonical_key = row.get("canonical_key")
        delta_mmol_l = row.get("projected_delta_mmol_l")
        if not canonical_key or delta_mmol_l in (None, 0):
            continue
        delta_index[canonical_key] = float(delta_mmol_l)
    return delta_index


def _display_amount_map(values: dict[str, float], *, tolerance: float = 0.0001) -> dict[str, float]:
    return {
        _NUTRIENT_ANALYTE_LABELS.get(key, key): round(value, 4)
        for key, value in values.items()
        if abs(value) > tolerance
    }


def _build_macro_bundle_candidates(
    *,
    balance_rows: list[dict[str, Any]],
    candidate_map: dict[str, list[dict[str, Any]]],
    source_reference_totals: dict[str, float],
    guardrails: dict[str, float | None],
    blocked_analytes: set[str],
    limit: int = 3,
) -> list[dict[str, Any]]:
    balance_index = {row["canonical_key"]: row for row in balance_rows}
    lane_keys = [
        key
        for key in _MACRO_BUNDLE_LANE_KEYS
        if balance_index.get(key, {}).get("status") == "needs-supplement" and candidate_map.get(key)
    ]
    if not lane_keys:
        return []

    lane_options: dict[str, list[dict[str, Any]]] = {}
    for lane_key in lane_keys:
        safe_candidates = [
            candidate
            for candidate in candidate_map[lane_key]
            if candidate["single_fertilizer_draft"]["status"] in {"draft", "provisional"}
        ][:3]
        if not safe_candidates:
            return []
        lane_options[lane_key] = safe_candidates

    objective_keys = [
        key
        for key in _MACRO_BUNDLE_OBJECTIVE_KEYS
        if balance_index.get(key, {}).get("target_mmol_l") is not None
    ]
    source_totals = dict(source_reference_totals)
    target_totals = {
        key: row.get("target_mmol_l")
        for key, row in balance_index.items()
    }

    ranked_bundles: list[
        tuple[tuple[int, float, float, float, tuple[str, ...]], dict[str, Any]]
    ] = []
    for combo in product(*(lane_options[key] for key in lane_keys)):
        formula_signature = tuple(candidate["formula"] for candidate in combo)
        if len(set(formula_signature)) != len(formula_signature):
            continue

        projected_totals = dict(source_totals)
        added_contributions: dict[str, float] = {}
        tank_batch_mass_grams: dict[str, float] = {}
        selected_fertilizers: list[dict[str, Any]] = []
        for lane_key, candidate in zip(lane_keys, combo):
            draft = candidate["single_fertilizer_draft"]
            for analyte_key, delta_mmol_l in _single_draft_delta_index(candidate).items():
                projected_totals[analyte_key] = projected_totals.get(analyte_key, 0.0) + delta_mmol_l
                added_contributions[analyte_key] = (
                    added_contributions.get(analyte_key, 0.0) + delta_mmol_l
                )

            estimated_batch_mass = dict(draft["estimated_batch_mass"])
            tank_key = candidate["tank_assignment"] or "unassigned"
            tank_batch_mass_grams[tank_key] = (
                tank_batch_mass_grams.get(tank_key, 0.0)
                + float(estimated_batch_mass["fertilizer_grams"])
            )
            selected_fertilizers.append(
                {
                    "lane_analyte": _NUTRIENT_ANALYTE_LABELS.get(lane_key, lane_key),
                    "canonical_key": lane_key,
                    "fertilizer_name": candidate["fertilizer_name"],
                    "formula": candidate["formula"],
                    "tank_assignment": candidate["tank_assignment"],
                    "estimated_batch_mass": estimated_batch_mass,
                    "projected_contributions_mmol_l": dict(draft["projected_contributions_mmol_l"]),
                }
            )

        residual_to_target: dict[str, float] = {}
        primary_lane_overshoot_mmol_l = 0.0
        objective_gap_abs_mmol_l = 0.0
        objective_above_target_mmol_l = 0.0
        objective_below_target_mmol_l = 0.0
        for objective_key in objective_keys:
            target_mmol_l = target_totals[objective_key]
            if target_mmol_l is None:
                continue
            projected_total_mmol_l = projected_totals.get(objective_key, source_totals.get(objective_key, 0.0))
            residual_mmol_l = float(target_mmol_l) - float(projected_total_mmol_l)
            residual_to_target[objective_key] = residual_mmol_l
            objective_gap_abs_mmol_l += abs(residual_mmol_l)
            objective_above_target_mmol_l += max(-1 * residual_mmol_l, 0.0)
            objective_below_target_mmol_l += max(residual_mmol_l, 0.0)
            if objective_key in lane_keys:
                primary_lane_overshoot_mmol_l += max(-1 * residual_mmol_l, 0.0)

        untargeted_contributions = {
            analyte_key: delta_mmol_l
            for analyte_key, delta_mmol_l in added_contributions.items()
            if target_totals.get(analyte_key) is None and abs(delta_mmol_l) > 0.01
        }
        untargeted_addition_mmol_l = sum(abs(value) for value in untargeted_contributions.values())
        projected_guardrail_breaches = [
            {
                "analyte": _NUTRIENT_ANALYTE_LABELS.get(analyte_key, analyte_key),
                "projected_total_mmol_l": round(float(projected_totals.get(analyte_key, 0.0)), 4),
                "guardrail_max_mmol_l": round(float(guardrail_max_mmol_l), 4),
            }
            for analyte_key, guardrail_max_mmol_l in guardrails.items()
            if guardrail_max_mmol_l is not None
            and float(projected_totals.get(analyte_key, 0.0)) > float(guardrail_max_mmol_l) + 0.01
        ]
        blocked_analyte_additions = [
            {
                "analyte": _NUTRIENT_ANALYTE_LABELS.get(analyte_key, analyte_key),
                "projected_delta_mmol_l": round(float(added_contributions.get(analyte_key, 0.0)), 4),
            }
            for analyte_key in sorted(blocked_analytes)
            if abs(float(added_contributions.get(analyte_key, 0.0))) > 0.01
        ]
        measurement_coverage = {
            "submitted_analytes": sorted(
                {
                    analyte
                    for candidate in combo
                    for analyte in candidate["single_fertilizer_draft"]
                    .get("measurement_coverage", {})
                    .get("submitted_analytes", [])
                }
            ),
            "baseline_analytes": sorted(
                {
                    analyte
                    for candidate in combo
                    for analyte in candidate["single_fertilizer_draft"]
                    .get("measurement_coverage", {})
                    .get("baseline_analytes", [])
                }
            ),
            "missing_analytes": sorted(
                {
                    analyte
                    for candidate in combo
                    for analyte in candidate["single_fertilizer_draft"]
                    .get("measurement_coverage", {})
                    .get("missing_analytes", [])
                }
            ),
        }
        provisional_reasons: list[str] = []
        if measurement_coverage["baseline_analytes"]:
            provisional_reasons.append(
                "The bundle still depends on workbook baseline source-water values for one or more analytes."
            )
        if measurement_coverage["missing_analytes"]:
            provisional_reasons.append(
                "The bundle still has analytes without submitted or workbook source-water references."
            )
        if any(candidate["single_fertilizer_draft"]["status"] == "provisional" for candidate in combo):
            provisional_reasons.append(
                "At least one fertilizer lane remains provisional under the current submitted measurement coverage."
            )
        if blocked_analyte_additions:
            provisional_reasons.append(
                "The bundle adds analytes that are already on the blocked guardrail watchlist."
            )
        if projected_guardrail_breaches:
            provisional_reasons.append(
                "The combined bundle would exceed at least one workbook guardrail after the lane drafts are merged."
            )
        bundle_status = (
            "blocked"
            if blocked_analyte_additions or projected_guardrail_breaches
            else "provisional"
            if provisional_reasons
            else "draft"
        )
        bundle = {
            "mode": _MACRO_BUNDLE_MODE,
            "status": bundle_status,
            "lane_order": [_NUTRIENT_ANALYTE_LABELS.get(key, key) for key in lane_keys],
            "objective_order": [_NUTRIENT_ANALYTE_LABELS.get(key, key) for key in objective_keys],
            "selected_fertilizers": selected_fertilizers,
            "projected_totals_mmol_l": _display_amount_map(
                {
                    key: projected_totals.get(key, source_totals.get(key, 0.0))
                    for key in objective_keys
                }
            ),
            "residual_to_target_mmol_l": _display_amount_map(residual_to_target),
            "untargeted_contributions_mmol_l": _display_amount_map(untargeted_contributions),
            "tank_batch_mass_grams": {
                tank_key: round(total_grams, 4)
                for tank_key, total_grams in tank_batch_mass_grams.items()
            },
            "measurement_coverage": measurement_coverage,
            "blocked_analyte_additions": blocked_analyte_additions,
            "projected_guardrail_breaches": projected_guardrail_breaches,
            "provisional_reasons": provisional_reasons,
            "scorecard": {
                "primary_lane_overshoot_mmol_l": round(primary_lane_overshoot_mmol_l, 4),
                "objective_gap_abs_mmol_l": round(objective_gap_abs_mmol_l, 4),
                "objective_above_target_mmol_l": round(objective_above_target_mmol_l, 4),
                "objective_below_target_mmol_l": round(objective_below_target_mmol_l, 4),
                "untargeted_addition_mmol_l": round(untargeted_addition_mmol_l, 4),
            },
            "disclaimer": _MACRO_BUNDLE_DISCLAIMER,
        }
        ranked_bundles.append(
            (
                (
                    0 if bundle_status == "draft" else 1 if bundle_status == "provisional" else 2,
                    bundle["scorecard"]["primary_lane_overshoot_mmol_l"],
                    bundle["scorecard"]["objective_gap_abs_mmol_l"],
                    bundle["scorecard"]["untargeted_addition_mmol_l"],
                    formula_signature,
                ),
                bundle,
            )
        )

    ranked_bundles.sort(key=lambda item: item[0])
    return [
        {**bundle, "rank": rank}
        for rank, (_, bundle) in enumerate(ranked_bundles[:limit], start=1)
    ]


def _build_bundle_residual_review(bundle: dict[str, Any]) -> dict[str, Any]:
    unresolved_targets = [
        {
            "analyte": analyte,
            "residual_mmol_l": round(float(residual_mmol_l), 4),
            "status": "above-target" if float(residual_mmol_l) < 0 else "below-target",
        }
        for analyte, residual_mmol_l in bundle["residual_to_target_mmol_l"].items()
        if abs(float(residual_mmol_l)) > 0.01
    ]
    untargeted_additions = [
        {
            "analyte": analyte,
            "projected_mmol_l": round(float(projected_mmol_l), 4),
        }
        for analyte, projected_mmol_l in bundle["untargeted_contributions_mmol_l"].items()
        if abs(float(projected_mmol_l)) > 0.01
    ]
    return {
        "unresolved_targets": unresolved_targets,
        "untargeted_additions": untargeted_additions,
        "above_target_analytes": [
            row["analyte"] for row in unresolved_targets if row["status"] == "above-target"
        ],
        "below_target_analytes": [
            row["analyte"] for row in unresolved_targets if row["status"] == "below-target"
        ],
    }


def _build_residual_safe_bundle_alternative(
    *,
    macro_bundle_candidates: list[dict[str, Any]],
) -> dict[str, Any]:
    if not macro_bundle_candidates:
        return {
            "status": "unavailable",
            "policy": _MACRO_BUNDLE_RESIDUAL_POLICY,
            "selected_bundle_rank": None,
            "selected_bundle_over_target_analytes": [],
            "recommended_bundle": None,
            "guidance": "No macro bundle candidate is available for residual-safe comparison.",
        }

    selected_bundle = macro_bundle_candidates[0]
    selected_review = _build_bundle_residual_review(selected_bundle)
    selected_over_target_analytes = selected_review["above_target_analytes"]
    if not selected_over_target_analytes:
        return {
            "status": "selected-bundle-already-safe",
            "policy": _MACRO_BUNDLE_RESIDUAL_POLICY,
            "selected_bundle_rank": selected_bundle["rank"],
            "selected_bundle_over_target_analytes": [],
            "recommended_bundle": None,
            "guidance": "The top-ranked macro bundle already avoids objective overshoot on modeled targets.",
        }

    safe_candidates = [
        candidate
        for candidate in macro_bundle_candidates[1:]
        if not _build_bundle_residual_review(candidate)["above_target_analytes"]
    ]
    if not safe_candidates:
        return {
            "status": "no-safe-alternative",
            "policy": _MACRO_BUNDLE_RESIDUAL_POLICY,
            "selected_bundle_rank": selected_bundle["rank"],
            "selected_bundle_over_target_analytes": selected_over_target_analytes,
            "recommended_bundle": None,
            "guidance": "No alternative macro bundle avoids modeled target overshoot under the current workbook constraints.",
        }

    recommended_bundle = min(
        safe_candidates,
        key=lambda candidate: (
            float(candidate["scorecard"]["objective_gap_abs_mmol_l"]),
            float(candidate["scorecard"]["untargeted_addition_mmol_l"]),
            int(candidate["rank"]),
        ),
    )
    recommended_review = _build_bundle_residual_review(recommended_bundle)
    return {
        "status": "available",
        "policy": _MACRO_BUNDLE_RESIDUAL_POLICY,
        "selected_bundle_rank": selected_bundle["rank"],
        "selected_bundle_over_target_analytes": selected_over_target_analytes,
        "recommended_bundle": {
            "rank": recommended_bundle["rank"],
            "status": recommended_bundle["status"],
            "lane_order": list(recommended_bundle["lane_order"]),
            "scorecard": dict(recommended_bundle["scorecard"]),
            "selected_fertilizers": [
                {
                    "lane_analyte": row["lane_analyte"],
                    "fertilizer_name": row["fertilizer_name"],
                    "formula": row["formula"],
                    "tank_assignment": row["tank_assignment"],
                }
                for row in recommended_bundle["selected_fertilizers"]
            ],
            "measurement_coverage": dict(recommended_bundle["measurement_coverage"]),
            "provisional_reasons": list(recommended_bundle.get("provisional_reasons", [])),
            "residual_review": recommended_review,
        },
        "guidance": (
            "The top-ranked bundle overshoots at least one modeled target, so this alternative keeps all modeled residuals at or below target even if the total gap increases."
        ),
    }


def _build_macro_bundle_execution_summary(
    *,
    macro_bundle_candidates: list[dict[str, Any]],
    stock_solution_volume_l: float | None,
    unsupported_analytes: list[dict[str, str]],
) -> dict[str, Any]:
    if not macro_bundle_candidates:
        readiness_reasons = [
            "No macro bundle candidate passed the current deterministic draft constraints."
        ]
        if unsupported_analytes:
            readiness_reasons.append(
                "Some analytes remain manual-only, so a bundle execution draft cannot be treated as complete."
            )
        return {
            "status": "unavailable",
            "selected_bundle_rank": None,
            "stock_solution_volume_l_per_tank": stock_solution_volume_l,
            "tank_plan": [],
            "measurement_coverage": {
                "submitted_analytes": [],
                "baseline_analytes": [],
                "missing_analytes": [],
            },
            "residual_review": {
                "unresolved_targets": [],
                "untargeted_additions": [],
                "manual_only_analytes": [row["nutrient"] for row in unsupported_analytes],
                "guardrail_breaches": [],
                "blocked_analyte_additions": [],
            },
            "readiness_reasons": readiness_reasons,
            "operator_guidance": [
                "Review the nutrient balance and candidate fertilizer lists manually before preparing stock tanks."
            ],
            "disclaimer": _MACRO_BUNDLE_DISCLAIMER,
        }

    selected_bundle = macro_bundle_candidates[0]
    tank_index: dict[str, dict[str, Any]] = {}
    unassigned_lines = 0
    for fertilizer_row in selected_bundle["selected_fertilizers"]:
        tank_key = fertilizer_row.get("tank_assignment") or "unassigned"
        if tank_key == "unassigned":
            unassigned_lines += 1
        tank_entry = tank_index.setdefault(
            tank_key,
            {
                "tank_assignment": tank_key,
                "total_batch_mass_g": 0.0,
                "stock_solution_concentration_g_l": None,
                "projected_contributions_mmol_l": {},
                "fertilizer_lines": [],
            },
        )
        fertilizer_grams = float(
            fertilizer_row.get("estimated_batch_mass", {}).get("fertilizer_grams") or 0.0
        )
        tank_entry["total_batch_mass_g"] += fertilizer_grams
        tank_entry["fertilizer_lines"].append(
            {
                "lane_analyte": fertilizer_row["lane_analyte"],
                "fertilizer_name": fertilizer_row["fertilizer_name"],
                "formula": fertilizer_row["formula"],
                "batch_mass_g": round(fertilizer_grams, 4),
                "stock_concentration_g_l": fertilizer_row["estimated_batch_mass"].get(
                    "stock_solution_concentration_g_l"
                ),
            }
        )
        for analyte, delta_mmol_l in fertilizer_row["projected_contributions_mmol_l"].items():
            tank_entry["projected_contributions_mmol_l"][analyte] = round(
                tank_entry["projected_contributions_mmol_l"].get(analyte, 0.0)
                + float(delta_mmol_l),
                4,
            )

    tank_plan: list[dict[str, Any]] = []
    for tank_key in sorted(tank_index):
        tank_entry = tank_index[tank_key]
        if stock_solution_volume_l not in (None, 0):
            tank_entry["stock_solution_concentration_g_l"] = round(
                tank_entry["total_batch_mass_g"] / float(stock_solution_volume_l),
                4,
            )
        tank_entry["total_batch_mass_g"] = round(tank_entry["total_batch_mass_g"], 4)
        tank_plan.append(tank_entry)

    residual_review = _build_bundle_residual_review(selected_bundle)
    unresolved_targets = residual_review["unresolved_targets"]
    untargeted_additions = residual_review["untargeted_additions"]
    manual_only_analytes = [row["nutrient"] for row in unsupported_analytes]
    readiness_reasons: list[str] = []
    if unassigned_lines:
        readiness_reasons.append(
            "One or more selected fertilizers still have no tank assignment in the workbook catalog."
        )
    if manual_only_analytes:
        readiness_reasons.append(
            "Some analytes remain manual-only and still need handoff outside the current macro bundle draft."
        )
    if unresolved_targets:
        readiness_reasons.append(
            "The top macro bundle still leaves target residuals that require manual review before rollout."
        )
    readiness_reasons.extend(selected_bundle.get("provisional_reasons", []))
    bundle_guardrail_breaches = selected_bundle.get("projected_guardrail_breaches", [])
    if bundle_guardrail_breaches:
        readiness_reasons.append(
            "The selected macro bundle breaches one or more workbook guardrails after bundle-level recheck."
        )
    bundle_blocked_additions = selected_bundle.get("blocked_analyte_additions", [])
    if bundle_blocked_additions:
        readiness_reasons.append(
            "The selected macro bundle adds analytes that are already blocked by the current guardrail state."
        )

    bundle_status = selected_bundle.get("status")
    if bundle_status == "blocked":
        status = "blocked"
    elif bundle_status == "provisional" or readiness_reasons:
        status = "manual-review-required"
    else:
        status = "draft-ready"
    operator_guidance = [
        "Prepare each tank as a separate stock solution using the listed fertilizer lines and batch masses."
    ]
    if unresolved_targets:
        operator_guidance.append(
            "Review unresolved target residuals before finalizing injector settings or recipe rollout."
        )
    if untargeted_additions:
        operator_guidance.append(
            "Check untargeted additions against crop tolerance and current guardrails before operational use."
        )
    if manual_only_analytes:
        operator_guidance.append(
            "Keep manual-only analytes in a separate review path; the current macro bundle does not size them."
        )
    if bundle_guardrail_breaches:
        operator_guidance.append(
            "Do not operationalize this bundle until the bundle-level guardrail breaches are resolved."
        )

    return {
        "status": status,
        "selected_bundle_rank": selected_bundle["rank"],
        "stock_solution_volume_l_per_tank": stock_solution_volume_l,
        "tank_plan": tank_plan,
        "measurement_coverage": selected_bundle.get("measurement_coverage", {}),
        "residual_review": {
            "unresolved_targets": unresolved_targets,
            "untargeted_additions": untargeted_additions,
            "manual_only_analytes": manual_only_analytes,
            "guardrail_breaches": bundle_guardrail_breaches,
            "blocked_analyte_additions": bundle_blocked_additions,
        },
        "readiness_reasons": readiness_reasons,
        "operator_guidance": operator_guidance,
        "disclaimer": selected_bundle["disclaimer"],
    }


def _build_stock_tank_prep(
    *,
    recipe: dict[str, Any],
    drain_feedback_plan: dict[str, Any] | None,
    source_water_measurements: dict[str, float],
    source_water_baseline: list[dict[str, Any]],
    fertilizers: list[dict[str, Any]],
    priority_findings: list[dict[str, Any]],
    working_solution_volume_l: float | None,
    stock_ratio: float | None,
) -> dict[str, Any]:
    baseline_index = _water_reference_index(source_water_baseline)
    effective_recipe_targets = (
        dict(drain_feedback_plan.get("effective_targets", {}))
        if drain_feedback_plan
        else dict(recipe["nutrient_targets"])
    )
    draft_guardrails = {
        "cl": recipe["guardrails"].get("cl_max"),
        "hco3": recipe["guardrails"].get("hco3_max"),
        "na": recipe["guardrails"].get("na_max"),
    }
    blocked_analytes = {
        finding["canonical_key"]
        for finding in priority_findings
        if finding["canonical_key"] in {"cl", "na", "hco3"}
    }

    balance_rows: list[dict[str, Any]] = []
    candidate_map: dict[str, list[dict[str, Any]]] = {}
    unsupported_analytes: list[dict[str, str]] = []
    recipe_units = dict(recipe.get("nutrient_units") or {})
    # A recipe that publishes no unit map at all is read as mmol/L, the way this
    # function always read it, and the fallback is declared in balance_basis.
    units_published = bool(recipe_units)
    analyte_units: dict[str, Any] = {}
    for nutrient_key, target_value in effective_recipe_targets.items():
        if target_value is None:
            continue

        display_name = _NUTRIENT_ANALYTE_LABELS.get(nutrient_key, nutrient_key)
        reported_unit = recipe_units.get(nutrient_key) if units_published else "mmol/L"
        analyte_units[nutrient_key] = reported_unit
        recipe_target_value = recipe["nutrient_targets"].get(nutrient_key)
        target_adjustment = next(
            (
                row
                for row in (drain_feedback_plan or {}).get("adjustments", [])
                if row.get("canonical_key") == nutrient_key
            ),
            None,
        )
        target_origin = (
            target_adjustment["target_origin"] if target_adjustment else "recipe-default"
        )
        unit_factor = _unit_factor_to_mmol_per_l(reported_unit)
        if unit_factor is None:
            # No usable unit means no arithmetic: a target whose unit is unknown is
            # never mixed with the mmol/L source-water analysis.
            balance_rows.append(
                {
                    "nutrient": display_name,
                    "canonical_key": nutrient_key,
                    "unit": reported_unit,
                    "recipe_target": recipe_target_value,
                    "target_value": target_value,
                    "source_value": None,
                    "supplemental_need": None,
                    "recipe_target_mmol_l": None,
                    "target_mmol_l": None,
                    "target_origin": target_origin,
                    "source_mmol_l": None,
                    "source_origin": "unit-unresolved",
                    "supplemental_need_mmol_l": None,
                    "batch_delta_mmol": None,
                    "status": "unit-unresolved",
                }
            )
            unsupported_analytes.append(
                {
                    "nutrient": display_name,
                    "canonical_key": nutrient_key,
                    "reason": (
                        "The recipe row supplies no recognized concentration unit for this "
                        "analyte, so its balance against the mmol/L source-water analysis "
                        "was not calculated."
                    ),
                }
            )
            continue

        source_mmol_l, source_origin = _resolve_source_reference_value(
            nutrient_key,
            submitted_measurements=source_water_measurements,
            baseline_index=baseline_index,
        )
        # Source water is analysed in mmol/L; the target may be µmol/L. Convert once,
        # then report each number beside the unit it is actually expressed in.
        target_mmol_l = float(target_value) * unit_factor
        recipe_target_mmol_l = (
            None if recipe_target_value is None else float(recipe_target_value) * unit_factor
        )
        supplemental_need_mmol_l = target_mmol_l - source_mmol_l
        source_value = _round_reported(source_mmol_l / unit_factor)
        supplemental_need_value = _round_reported(supplemental_need_mmol_l / unit_factor)
        batch_delta_mmol = (
            supplemental_need_mmol_l * working_solution_volume_l
            if working_solution_volume_l is not None
            else None
        )
        if supplemental_need_value > _BALANCE_STATUS_TOLERANCE:
            status = "needs-supplement"
        elif supplemental_need_value < -_BALANCE_STATUS_TOLERANCE:
            status = "source-exceeds-target"
        else:
            status = "near-target"

        balance_rows.append(
            {
                "nutrient": display_name,
                "canonical_key": nutrient_key,
                "unit": reported_unit,
                "recipe_target": recipe_target_value,
                "target_value": target_value,
                "source_value": source_value,
                "supplemental_need": supplemental_need_value,
                "recipe_target_mmol_l": recipe_target_mmol_l,
                "target_mmol_l": target_mmol_l,
                "target_origin": target_origin,
                "source_mmol_l": source_mmol_l,
                "source_origin": source_origin,
                "supplemental_need_mmol_l": supplemental_need_mmol_l,
                "batch_delta_mmol": batch_delta_mmol,
                "status": status,
            }
        )
        if status == "needs-supplement":
            candidates = _rank_fertilizer_candidates(
                fertilizers,
                nutrient_key=nutrient_key,
                blocked_analytes=blocked_analytes,
                submitted_measurements=source_water_measurements,
                baseline_index=baseline_index,
                recipe_targets=effective_recipe_targets,
                guardrails=draft_guardrails,
                supplemental_need_mmol_l=supplemental_need_mmol_l,
                working_solution_volume_l=working_solution_volume_l,
                stock_ratio=stock_ratio,
            )
            if candidates:
                candidate_map[nutrient_key] = candidates
            else:
                unsupported_analytes.append(
                    {
                        "nutrient": display_name,
                        "canonical_key": nutrient_key,
                        "reason": (
                            "No fertilizer contribution is available for this analyte in the current workbook catalog, so manual correction is still required."
                        ),
                    }
                )

    status_order = {
        "needs-supplement": 0,
        "source-exceeds-target": 1,
        "near-target": 2,
    }
    balance_rows.sort(key=lambda row: (status_order.get(row["status"], 9), row["nutrient"]))
    source_reference_totals = _build_source_reference_totals(
        submitted_measurements=source_water_measurements,
        baseline_index=baseline_index,
        recipe_targets=effective_recipe_targets,
        blocked_analytes=blocked_analytes,
    )
    macro_bundle_candidates = _build_macro_bundle_candidates(
        balance_rows=balance_rows,
        candidate_map=candidate_map,
        source_reference_totals=source_reference_totals,
        guardrails=draft_guardrails,
        blocked_analytes=blocked_analytes,
    )
    return {
        "balance_basis": {
            "draft_mode": _STOCK_TANK_DRAFT_MODE,
            "macro_bundle_mode": _MACRO_BUNDLE_MODE,
            "draft_eligible_analytes": [
                _NUTRIENT_ANALYTE_LABELS[key] for key in _STOCK_TANK_DRAFT_ELIGIBLE_ANALYTES
            ],
            "draft_unit_contract": dict(_STOCK_TANK_DRAFT_UNIT_CONTRACT),
            "analyte_units": {
                _NUTRIENT_ANALYTE_LABELS.get(key, key): unit
                for key, unit in analyte_units.items()
            },
            "unit_policy": {
                "target_unit_source": (
                    "recipe nutrient_units" if units_published else "assumed mmol/L"
                ),
                "source_water_unit": "mmol/L",
                "note": (
                    "Every balance row carries the unit its recipe publishes. The mmol/L "
                    "fields are converted from that unit, so a µmol/L analyte reads as "
                    "1/1000 of its reported value instead of being labelled mmol/L."
                ),
                "unresolved_unit_analytes": [
                    row["nutrient"]
                    for row in balance_rows
                    if row["status"] == "unit-unresolved"
                ],
            },
            "working_solution_volume_l": working_solution_volume_l,
            "stock_ratio": stock_ratio,
            "stock_solution_volume_l": (
                None
                if working_solution_volume_l is None or stock_ratio in (None, 0)
                else round(working_solution_volume_l / stock_ratio, 4)
            ),
            "target_policy": {
                "mode": (
                    drain_feedback_plan.get("mode")
                    if drain_feedback_plan
                    else "recipe_default"
                ),
                "adjusted_analytes": (
                    drain_feedback_plan.get("adjusted_analytes", [])
                    if drain_feedback_plan
                    else []
                ),
                "manual_review_analytes": (
                    drain_feedback_plan.get("manual_review_analytes", [])
                    if drain_feedback_plan
                    else []
                ),
                "unreviewed_analytes": (
                    drain_feedback_plan.get("unreviewed_analytes", [])
                    if drain_feedback_plan
                    else []
                ),
            },
            "blocked_analytes": [
                _NUTRIENT_ANALYTE_LABELS.get(key, key) for key in sorted(blocked_analytes)
            ],
        },
        "nutrient_balance": balance_rows,
        "candidate_fertilizers": candidate_map,
        "macro_bundle_candidates": macro_bundle_candidates,
        "residual_safe_alternative": _build_residual_safe_bundle_alternative(
            macro_bundle_candidates=macro_bundle_candidates
        ),
        "macro_bundle_execution": _build_macro_bundle_execution_summary(
            macro_bundle_candidates=macro_bundle_candidates,
            stock_solution_volume_l=(
                None
                if working_solution_volume_l is None or stock_ratio in (None, 0)
                else round(working_solution_volume_l / stock_ratio, 4)
            ),
            unsupported_analytes=unsupported_analytes,
        ),
        "unsupported_analytes": unsupported_analytes,
    }


def recommend_pesticides(
    *,
    crop: str,
    target: str,
    limit: int = 5,
) -> dict[str, Any]:
    target_query = _normalize_text(target)
    if not target_query:
        raise ValueError("target query is required.")
    _validate_pesticide_target_scope(crop, target_query)

    reference_rows = export_pesticide_reference_rows(crop)
    products = reference_rows["products"]
    rotations = reference_rows["rotations"]
    moa_reference = reference_rows["moa_reference"]
    product_index = _build_pesticide_product_index(products)

    ranked_products: list[tuple[int, dict[str, Any]]] = []
    for row in products:
        crop_target_names = _filter_crop_targets(row["target_names"], crop)
        score = max((_match_score(target_query, name) for name in crop_target_names), default=0)
        if score <= 0:
            continue
        ranked_products.append((score, {**row, "target_names": crop_target_names}))

    ranked_products.sort(
        key=lambda item: (
            -item[0],
            -_PESTICIDE_STATUS_WEIGHT.get(item[1]["registration_status"], 0),
            item[1]["source_row"],
        )
    )

    ranked_rotations: list[tuple[int, dict[str, Any]]] = []
    malformed_rotation_rows = 0
    for row in rotations:
        if _is_placeholder_rotation_row(row):
            malformed_rotation_rows += 1
            continue
        enriched_row = _enrich_rotation_row(row, crop=crop, product_index=product_index)
        score = max(
            (
                _match_score(target_query, candidate)
                for candidate in (
                    enriched_row["target_name"],
                    enriched_row["application_point"],
                    *enriched_row["target_names"],
                    " ".join(enriched_row["product_names"]),
                )
                if _normalize_text(candidate)
            ),
            default=0,
        )
        if score <= 0:
            continue
        ranked_rotations.append((score, enriched_row))

    ranked_rotations.sort(
        key=lambda item: (
            -item[0],
            -_PESTICIDE_STATUS_WEIGHT.get(item[1]["registration_status"], 0),
            -int(item[1]["matched_product_master"]),
            item[1]["source_row"],
        )
    )

    if not ranked_products and not ranked_rotations:
        raise LookupError(
            f"No deterministic pesticide match found for crop '{crop}' and target '{target_query}'."
        )

    selected_rotations, rotation_excluded_counts = _select_rotation_rows(
        ranked_rotations,
        limit=limit,
    )
    matched_targets = sorted(
        {
            target_name
            for _, row in ranked_products
            for target_name in row["target_names"]
            if _match_score(target_query, target_name) > 0
        }
        | {
            target_name
            for _, row in ranked_rotations
            for target_name in row["target_names"]
            if _match_score(target_query, target_name) > 0
        }
    )
    matched_moa_groups = {
        row["moa_code_group"]
        for row in [item[1] for item in ranked_products[:limit]] + selected_rotations
        if row.get("moa_code_group")
    }

    product_recommendations = [
        _serialize_pesticide_product(row)
        for _, row in ranked_products[:limit]
    ]
    rotation_program = [
        _serialize_rotation_step(row, step_index=index + 1)
        for index, row in enumerate(selected_rotations)
    ]
    selected_rotation_row_refs = {
        (row["source_sheet"], row["source_row"]) for row in selected_rotations
    }
    selected_identity_keys = {
        _rotation_identity_key(row)
        for row in selected_rotations
        if _rotation_identity_key(row)
    }
    rotation_alternatives = [
        _serialize_rotation_step(
            row,
            step_index=index + 1,
            alternative_reason_code=_resolve_rotation_alternative_reason_code(
                row,
                selected_identity_keys=selected_identity_keys,
            ),
        )
        for index, row in enumerate(
            [
                row
                for _, row in ranked_rotations
                if (row["source_sheet"], row["source_row"]) not in selected_rotation_row_refs
            ][:limit]
        )
    ]
    moa_rows = [
        {
            "moa_code_group": row["moa_code_group"],
            "representative_ingredient": row["representative_ingredient"],
            "representative_products": row["representative_products"][:4],
            "notes": row["notes"],
            "source_sheet": row["source_sheet"],
            "source_row": row["source_row"],
        }
        for row in moa_reference
        if row["moa_code_group"] in matched_moa_groups
    ][:limit]
    returned_status_counts = dict(
        Counter(
            row["registration_status"]
            for row in product_recommendations + rotation_program
            if row["registration_status"]
        )
    )
    candidate_status_counts = dict(
        Counter(
            row["registration_status"]
            for row in [item[1] for item in ranked_products] + [item[1] for item in ranked_rotations]
            if row["registration_status"]
        )
    )
    returned_manual_review_count = sum(
        1
        for row in product_recommendations + rotation_program
        if row["registration_status"] in _PESTICIDE_MANUAL_REVIEW_STATUSES
    )
    limitations = [
        "워크북 조회 결과를 참고하되, 실제 포장 사용 전에는 제품 라벨과 등록 여부를 최종 확인하세요."
    ]

    return {
        "family": "pesticide",
        "crop": reference_rows["crop"],
        "target_query": target_query,
        "matched_targets": _sample_strings(matched_targets, limit=12),
        "product_recommendations": product_recommendations,
        "rotation_program": rotation_program,
        "rotation_alternatives": rotation_alternatives,
        "rotation_guidance": _build_rotation_guidance(
            rotation_program,
            rotation_alternatives,
        ),
        "moa_reference": moa_rows,
        "registration_status_counts": returned_status_counts,
        "candidate_registration_status_counts": candidate_status_counts,
        "registration_gate": {
            "policy": "registered_first_manual_review_deferred",
            "manual_review_required": bool(returned_manual_review_count),
            "manual_review_candidate_count": sum(
                candidate_status_counts.get(status, 0)
                for status in _PESTICIDE_MANUAL_REVIEW_STATUSES
            ),
            "returned_manual_review_count": returned_manual_review_count,
        },
        "rotation_hardening": {
            "policy": "registered_first_unique_moa",
            "excluded_counts": {
                "malformed_or_placeholder": malformed_rotation_rows,
                **rotation_excluded_counts,
            },
            "unique_moa_groups": _sample_strings(
                [row["moa_code_group"] for row in rotation_program if row.get("moa_code_group")],
                limit=limit,
            ),
        },
        "limitations": limitations,
    }


def recommend_nutrient_recipe(
    *,
    crop: str,
    stage: str | None = None,
    medium: str | None = None,
) -> dict[str, Any]:
    reference_rows = export_nutrient_reference_rows(crop)
    recipes = reference_rows["recipes"]
    if not recipes:
        raise LookupError(f"No nutrient recipes are available for crop '{crop}'.")

    available_stages = sorted({row["stage"] for row in recipes})
    resolved_stage, stage_match = _resolve_candidate(
        stage,
        available_stages,
        default="Start" if "Start" in available_stages else None,
    )
    stage_filtered = [row for row in recipes if row["stage"] == resolved_stage]

    available_mediums = sorted({row["medium"] for row in stage_filtered})
    resolved_medium, medium_match = _resolve_candidate(
        medium,
        available_mediums,
    )
    selected_recipe = next(
        row
        for row in stage_filtered
        if row["medium"] == resolved_medium
    )

    return {
        "family": "nutrient",
        "crop": reference_rows["crop"],
        "requested": {"stage": stage, "medium": medium},
        "resolved": {
            "stage": resolved_stage,
            "medium": resolved_medium,
            "stage_match": stage_match,
            "medium_match": medium_match,
        },
        "available_stages": available_stages,
        "available_mediums": sorted({row["medium"] for row in recipes}),
        "recipe": {
            "crop": selected_recipe["crop"],
            "medium": selected_recipe["medium"],
            "stage": selected_recipe["stage"],
            "ec_target": selected_recipe["ec_target"],
            "nutrient_units": selected_recipe.get("nutrient_units", {}),
            "nutrient_targets": {
                "n_no3": selected_recipe["n_no3"],
                "n_nh4": selected_recipe["n_nh4"],
                "p": selected_recipe["p"],
                "k": selected_recipe["k"],
                "ca": selected_recipe["ca"],
                "mg": selected_recipe["mg"],
                "s": selected_recipe["s"],
                "fe": selected_recipe["fe"],
                "mn": selected_recipe["mn"],
                "zn": selected_recipe["zn"],
                "b": selected_recipe["b"],
                "cu": selected_recipe["cu"],
                "mo": selected_recipe["mo"],
            },
            "guardrails": {
                "cl_max": selected_recipe["cl_max"],
                "hco3_max": selected_recipe["hco3_max"],
                "na_max": selected_recipe["na_max"],
            },
            "source_key": selected_recipe["source_key"],
            "source_note": selected_recipe["source_note"],
            "source_sheet": selected_recipe["source_sheet"],
            "source_row": selected_recipe["source_row"],
        },
        "source_water_baseline": [
            {
                "analyte": row["analyte"],
                "mmol_l": row["mmol_l"],
                "mg_l": row["mg_l"],
                "ec_contribution": row["ec_contribution"],
                "source_sheet": row["source_sheet"],
                "source_row": row["source_row"],
            }
            for row in reference_rows["source_water"]
        ],
        "drain_water_baseline": [
            {
                "analyte": row["analyte"],
                "mmol_l": row["mmol_l"],
                "mg_l": row["mg_l"],
                "ec_contribution": row["ec_contribution"],
                "source_sheet": row["source_sheet"],
                "source_row": row["source_row"],
            }
            for row in reference_rows["drain_water"]
        ],
        "fertilizer_catalog": [
            {
                "fertilizer_name": row["fertilizer_name"],
                "formula": row["formula"],
                "tank_assignment": row["tank_assignment"],
                "source_sheet": row["source_sheet"],
                "source_row": row["source_row"],
            }
            for row in reference_rows["fertilizers"]
        ],
        "calculator_defaults": reference_rows["calculator_defaults"],
        "drain_feedback_defaults": reference_rows["drain_feedback_defaults"],
        "limitations": [
            "이 응답은 레시피 기준 조회입니다. 원액 탱크 배합량은 recommend_stock_tank_prescription"
            "(POST /api/nutrients/prescription)이 A·B 탱크 각 1000 L, 100배 기준으로 계산합니다.",
            "실제 적용 전에는 원수·배액 분석과 레시피 경계값을 함께 확인해 주세요.",
        ],
    }


def recommend_nutrient_correction(
    *,
    crop: str,
    stage: str | None = None,
    medium: str | None = None,
    source_water_mmol_l: dict[str, float] | None = None,
    drain_water_mmol_l: dict[str, float] | None = None,
    working_solution_volume_l: float | None = None,
    stock_ratio: float | None = None,
) -> dict[str, Any]:
    reference_rows = export_nutrient_reference_rows(crop)
    recipe_payload = recommend_nutrient_recipe(crop=crop, stage=stage, medium=medium)
    calculator_defaults = dict(recipe_payload["calculator_defaults"])
    drain_feedback_defaults = dict(recipe_payload["drain_feedback_defaults"])

    default_working_solution_volume_l = calculator_defaults.get("working_solution_volume_l")
    default_stock_ratio = calculator_defaults.get("stock_ratio")
    effective_working_solution_volume_l = (
        working_solution_volume_l
        if working_solution_volume_l is not None
        else default_working_solution_volume_l
    )
    effective_stock_ratio = (
        stock_ratio if stock_ratio is not None else default_stock_ratio
    )

    if effective_working_solution_volume_l is not None and effective_working_solution_volume_l <= 0:
        raise ValueError("working_solution_volume_l must be greater than 0.")
    if effective_stock_ratio is not None and effective_stock_ratio <= 0:
        raise ValueError("stock_ratio must be greater than 0.")
    _validate_water_measurement_inputs(
        source_water_mmol_l,
        analysis_kind="source_water",
    )
    _validate_water_measurement_inputs(
        drain_water_mmol_l,
        analysis_kind="drain_water",
    )

    recipe = recipe_payload["recipe"]
    guardrails = {
        "cl": recipe["guardrails"].get("cl_max"),
        "hco3": recipe["guardrails"].get("hco3_max"),
        "na": recipe["guardrails"].get("na_max"),
    }
    source_reviews = _evaluate_water_measurements(
        source_water_mmol_l or {},
        analysis_kind="source_water",
        baseline_index=_water_reference_index(recipe_payload["source_water_baseline"]),
        guardrails=guardrails,
    )
    drain_reviews = _evaluate_water_measurements(
        drain_water_mmol_l or {},
        analysis_kind="drain_water",
        baseline_index=_water_reference_index(recipe_payload["drain_water_baseline"]),
        guardrails=guardrails,
    )
    drain_feedback_plan = _build_drain_feedback_target_plan(
        recipe_targets=recipe["nutrient_targets"],
        drain_reviews=drain_reviews,
    )

    priority_findings = [
        finding
        for finding in source_reviews + drain_reviews
        if finding["status"] in {"above-guardrail", "above-baseline", "below-baseline"}
    ]
    required_manual_inputs: list[str] = []
    if not source_water_mmol_l:
        required_manual_inputs.append("source_water_mmol_l")
    if not drain_water_mmol_l:
        required_manual_inputs.append("drain_water_mmol_l")
    stock_tank_prep = _build_stock_tank_prep(
        recipe=recipe,
        drain_feedback_plan=drain_feedback_plan,
        source_water_measurements=source_water_mmol_l or {},
        source_water_baseline=recipe_payload["source_water_baseline"],
        fertilizers=reference_rows["fertilizers"],
        priority_findings=priority_findings,
        working_solution_volume_l=effective_working_solution_volume_l,
        stock_ratio=effective_stock_ratio,
    )

    return {
        "family": "nutrient_correction",
        "crop": recipe_payload["crop"],
        "requested": recipe_payload["requested"],
        "resolved": recipe_payload["resolved"],
        "correction_inputs": {
            "submitted_source_water_analytes": sorted((source_water_mmol_l or {}).keys()),
            "submitted_drain_water_analytes": sorted((drain_water_mmol_l or {}).keys()),
            "working_solution_volume_l": {
                "requested": working_solution_volume_l,
                "default": default_working_solution_volume_l,
                "effective": effective_working_solution_volume_l,
            },
            "stock_ratio": {
                "requested": stock_ratio,
                "default": default_stock_ratio,
                "effective": effective_stock_ratio,
            },
        },
        "correction_context": {
            "recipe": recipe,
            "calculator_defaults": calculator_defaults,
            "drain_feedback_defaults": drain_feedback_defaults,
            "drain_feedback_policy": _build_drain_feedback_policy_summary(),
            "source_water_baseline": _summarize_water_reference(
                recipe_payload["source_water_baseline"]
            ),
            "drain_water_baseline": _summarize_water_reference(
                recipe_payload["drain_water_baseline"]
            ),
            "fertilizer_names": _sample_strings(
                [row["fertilizer_name"] for row in recipe_payload["fertilizer_catalog"]],
                limit=10,
            ),
        },
        "correction_outputs": {
            "source_water_review": source_reviews,
            "drain_water_review": drain_reviews,
            "drain_feedback_plan": drain_feedback_plan,
            "priority_findings": priority_findings,
            "required_manual_inputs": required_manual_inputs,
            "stock_tank_prep": stock_tank_prep,
        },
        "limitations": [
            "이 응답은 양액 보정 초안과 제한된 범위의 배액 피드백, 단일 비료 기준 초안입니다. 확정 원액 탱크 "
            "배합량은 recommend_stock_tank_prescription(POST /api/nutrients/prescription)에서 계산합니다.",
            "수동 보정을 적용하기 전에는 실제 원수·배액 분석값과 워크북 경계값을 함께 확인해 주세요.",
        ],
    }


def _stage_config_key(stage: Any) -> str:
    return _normalize_text(stage).lower().replace(" ", "_").replace("-", "_")


def _positive_float(value: Any) -> float | None:
    if value is None or isinstance(value, bool):
        return None
    try:
        number = float(value)
    except (TypeError, ValueError):
        return None
    return number if number > 0 else None


def _prescription_target_units(recipe: dict[str, Any]) -> dict[str, str]:
    """Unit per solver ion, taking the guardrail unit for the water-only ions."""
    published = dict(recipe.get("nutrient_units") or {})
    units = {ion: published[ion] for ion in SOLVER_ION_ORDER if published.get(ion)}
    for ion, guardrail_key in _GUARDRAIL_ION_KEYS:
        if ion not in units and published.get(guardrail_key):
            units[ion] = published[guardrail_key]
    return units


def _prescription_source_water(
    *,
    submitted_mmol_l: dict[str, float] | None,
    baseline_rows: list[dict[str, Any]],
) -> tuple[dict[str, float], dict[str, str], str]:
    """Source-water analysis in mmol/L per solver ion, with the origin of each value."""
    solver_ions = set(SOLVER_ION_ORDER)
    values: dict[str, float] = {}
    origin: dict[str, str] = {}

    for row in baseline_rows or ():
        canonical_key = _canonical_nutrient_analyte_key(row.get("analyte"))
        if canonical_key not in solver_ions or row.get("mmol_l") is None:
            continue
        values[canonical_key] = float(row["mmol_l"])
        origin[canonical_key] = "workbook_baseline"

    for analyte_name, observed in (submitted_mmol_l or {}).items():
        canonical_key = _canonical_nutrient_analyte_key(analyte_name)
        if canonical_key not in solver_ions or observed is None:
            continue
        values[canonical_key] = float(observed)
        origin[canonical_key] = "submitted"

    if submitted_mmol_l:
        mode = "submitted"
    elif values:
        mode = "workbook_baseline"
    else:
        mode = "none"
    return values, origin, mode


def _resolve_chloride_target(
    *,
    crop: str,
    recipe: dict[str, Any],
    crop_config: dict[str, Any],
) -> dict[str, Any]:
    """Chloride is a real feed target the workbook recipe sheet does not carry.

    추천레시피_DB publishes Cl only as the Cl_max guardrail, so a chloride target is
    read from the reference file when the workbook row has none. A blank cell in the
    reference file stays blank; no chloride target is invented for it.
    """
    guardrail_unit = (recipe.get("nutrient_units") or {}).get("cl_max")
    resolution: dict[str, Any] = {
        "target": None,
        "unit": "mmol/L",
        "origin": "absent",
        "workbook_has_cl_target": recipe["nutrient_targets"].get("cl") is not None,
        "workbook_guardrail_cl_max": recipe["guardrails"].get("cl_max"),
        "workbook_guardrail_unit": guardrail_unit,
        "note": (
            "워크북 추천레시피_DB에는 Cl 목표 열이 없고 Cl_max 상한만 있습니다. Cl_max는 "
            "목표가 아니라 배합 후 확인해야 할 상한입니다."
        ),
    }

    if resolution["workbook_has_cl_target"]:
        resolution["target"] = recipe["nutrient_targets"]["cl"]
        resolution["unit"] = (recipe.get("nutrient_units") or {}).get("cl") or "mmol/L"
        resolution["origin"] = "workbook_recipe_row"
        return resolution

    feed_solution = crop_config.get("feed_solution") or {}
    reference_chloride = feed_solution.get("cl") if isinstance(feed_solution, dict) else None
    if reference_chloride is None:
        resolution["note"] = (
            "참고자료의 feed_solution.cl이 빈칸이라 염화물 목표를 만들지 않았습니다. 워크북 "
            "추천레시피_DB에도 Cl 목표 열이 없으며, Cl_max는 목표가 아니라 배합 후 확인해야 할 "
            "상한입니다."
        )
        return resolution

    resolution["target"] = reference_chloride
    resolution["origin"] = "reference_file"
    resolution["reference_locator"] = crop_config.get("locator")
    resolution["reference_path"] = f"configs/{_EUROFINS_CONFIG_FILENAME} crops.{crop}.feed_solution.cl"
    resolution["note"] = (
        "워크북 추천레시피_DB에는 Cl 목표 열이 없어 이 처방의 염화물 목표는 참고자료 "
        f"configs/{_EUROFINS_CONFIG_FILENAME}의 crops.{crop}.feed_solution.cl에서 가져왔습니다. "
        "워크북의 Cl_max는 목표가 아니라 배합 후 확인해야 할 상한입니다."
    )
    return resolution


def _relevant_source_inconsistencies(config: dict[str, Any], crop: str) -> list[str]:
    """Source inconsistencies that touch this crop or any stock-tank decision."""
    entries = config.get("known_source_inconsistencies") or []
    crop_token = _normalize_text(crop).lower()
    selected: list[str] = []
    for entry in entries:
        text = str(entry).lower()
        if (crop_token and crop_token in text) or "chelate" in text or "tank" in text:
            selected.append(str(entry))
    return selected


def _build_prescription_provenance(
    *,
    crop: str,
    resolved_stage: str,
    resolved_medium: str,
    chloride_resolution: dict[str, Any],
) -> dict[str, Any]:
    """Primary-source provenance for the numbers this prescription rests on."""
    config = _load_nutrient_source_config()
    if config.get("unavailable"):
        return {
            "status": "unavailable",
            "detail": config["unavailable"],
            "chloride_target": chloride_resolution,
        }

    crop_config = (config.get("crops") or {}).get(crop) or {}
    stage_key = _stage_config_key(resolved_stage)
    adjustments = crop_config.get("adjustments") or {}
    stage_adjustment = adjustments.get(stage_key)
    return {
        "status": "available",
        "basis": config.get("basis"),
        "source": dict(config.get("source") or {}),
        "units": dict(config.get("units") or {}),
        "crop_locator": crop_config.get("locator"),
        "crop_display_name": crop_config.get("display_name"),
        "species": crop_config.get("species"),
        "substrate": crop_config.get("substrate"),
        "stage_adjustment": {
            "resolved_stage": resolved_stage,
            "resolved_medium": resolved_medium,
            "config_key": stage_key,
            "published_adjustment": stage_adjustment,
            "available_stage_keys": sorted(adjustments),
            "applied_by": (
                "워크북 추천레시피_DB 행이 이미 기준 조성 + 해당 단계 조정값으로 저장되어 있습니다. "
                "여기 실린 조정값은 그 행에 반영된 원자료의 인쇄값입니다."
            ),
            "notes": dict(crop_config.get("adjustment_notes") or {}),
        },
        "feed_solution_reference": dict(crop_config.get("feed_solution") or {}),
        "worked_stock_example": dict(crop_config.get("worked_stock_example") or {}),
        "stock_tank_rules": dict(config.get("stock_tank_rules") or {}),
        "acid_and_bicarbonate": dict(config.get("acid_and_bicarbonate") or {}),
        "chloride_target": chloride_resolution,
        "known_source_inconsistencies": _relevant_source_inconsistencies(config, crop),
    }


def _prescription_guardrail_review(
    *,
    prescription: dict[str, Any],
    recipe: dict[str, Any],
    target_units: dict[str, str],
) -> list[dict[str, Any]]:
    achieved = prescription.get("achieved_working_solution") or {}
    published_units = dict(recipe.get("nutrient_units") or {})
    rows: list[dict[str, Any]] = []
    for ion, guardrail_key in _GUARDRAIL_ION_KEYS:
        guardrail_max = recipe["guardrails"].get(guardrail_key)
        if guardrail_max is None:
            continue
        entry = achieved.get(ion) or {}
        projected = entry.get("value")
        rows.append(
            {
                "analyte": _NUTRIENT_ANALYTE_LABELS.get(ion, ion),
                "canonical_key": ion,
                "unit": target_units.get(ion) or published_units.get(guardrail_key) or "mmol/L",
                "guardrail_max": guardrail_max,
                "projected_value": projected,
                "status": (
                    "not-evaluated"
                    if projected is None
                    else "above-guardrail"
                    if float(projected) > float(guardrail_max)
                    else "within-guardrail"
                ),
                "basis": "원수 + 비료 기여를 합한 작업 양액 예상값",
            }
        )
    return rows


def recommend_stock_tank_prescription(
    *,
    crop: str,
    stage: str | None = None,
    medium: str | None = None,
    source_water_mmol_l: dict[str, float] | None = None,
    drain_water_mmol_l: dict[str, float] | None = None,
    stock_tank_volume_l: float | None = None,
    stock_ratio: float | None = None,
    options: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Size the A and B stock tanks for a resolved workbook recipe.

    The recipe is resolved through recommend_nutrient_recipe, so stage and medium
    matching stay identical to the lookup surface. Targets, their units, the workbook
    fertilizer catalog and the tank volumes go to solve_stock_tanks, which owns the
    allocation. Provenance for the numbers comes from the primary-source record in
    configs/nutrient_recipes_eurofins.json.
    """
    reference_rows = export_nutrient_reference_rows(crop)
    recipe_payload = recommend_nutrient_recipe(crop=crop, stage=stage, medium=medium)
    recipe = recipe_payload["recipe"]
    resolved_stage = recipe_payload["resolved"]["stage"]
    resolved_medium = recipe_payload["resolved"]["medium"]

    _validate_water_measurement_inputs(source_water_mmol_l, analysis_kind="source_water")
    _validate_water_measurement_inputs(drain_water_mmol_l, analysis_kind="drain_water")

    option_map = dict(options or {})
    unsupported_options = sorted(set(option_map) - set(_PRESCRIPTION_OPTION_KEYS))
    if unsupported_options:
        raise ValueError(
            "Unsupported prescription options: "
            + ", ".join(unsupported_options)
            + ". Supported options are "
            + ", ".join(_PRESCRIPTION_OPTION_KEYS)
            + "."
        )

    config = _load_nutrient_source_config()
    crop_config = (config.get("crops") or {}).get(crop) or {}
    worked_example = crop_config.get("worked_stock_example") or {}
    basis_volume_l = _positive_float(worked_example.get("stock_tank_volume_l")) or _STOCK_TANK_BASIS_VOLUME_L
    basis_ratio = _positive_float(worked_example.get("stock_ratio")) or _STOCK_TANK_BASIS_RATIO

    calculator_defaults = dict(recipe_payload["calculator_defaults"])
    workbook_ratio = _positive_float(calculator_defaults.get("stock_ratio"))
    workbook_working_volume_l = _positive_float(calculator_defaults.get("working_solution_volume_l"))

    if stock_tank_volume_l is not None and _positive_float(stock_tank_volume_l) is None:
        raise ValueError("stock_tank_volume_l must be greater than 0.")
    if stock_ratio is not None and _positive_float(stock_ratio) is None:
        raise ValueError("stock_ratio must be greater than 0.")

    effective_ratio = (
        float(stock_ratio) if stock_ratio is not None else (workbook_ratio or basis_ratio)
    )
    effective_volume_l = (
        float(stock_tank_volume_l) if stock_tank_volume_l is not None else basis_volume_l
    )
    implied_stock_tank_volume_l = (
        workbook_working_volume_l / (workbook_ratio or effective_ratio)
        if workbook_working_volume_l is not None
        else None
    )
    basis_agrees = (
        implied_stock_tank_volume_l is not None
        and abs(implied_stock_tank_volume_l - effective_volume_l) <= 1e-6
    )

    warnings: list[str] = []
    if stock_tank_volume_l is None and implied_stock_tank_volume_l is not None and not basis_agrees:
        warnings.append(
            "워크북 '"
            + str(calculator_defaults.get("sheet_name") or "처방전 계산")
            + f"' 시트는 작업 양액 {workbook_working_volume_l:g} L를 "
            + f"{(workbook_ratio or effective_ratio):g}배로 두어 원액 탱크 "
            + f"{implied_stock_tank_volume_l:g} L를 뜻합니다. 이 처방은 원자료에 published된 탱크 기준인 "
            + f"탱크당 {effective_volume_l:g} L, {effective_ratio:g}배로 계산했습니다. 시트 기준으로 보려면 "
            + f"stock_tank_volume_l={implied_stock_tank_volume_l:g}로 다시 요청하세요."
        )

    target_units = _prescription_target_units(recipe)
    solver_targets: dict[str, Any] = {
        ion: value
        for ion, value in recipe["nutrient_targets"].items()
        if value is not None and ion in set(SOLVER_ION_ORDER)
    }

    chloride_resolution = _resolve_chloride_target(
        crop=crop, recipe=recipe, crop_config=crop_config
    )
    if chloride_resolution["target"] is not None:
        solver_targets["cl"] = chloride_resolution["target"]
        target_units.setdefault("cl", chloride_resolution["unit"] or "mmol/L")

    sulfate_policy: dict[str, Any] = {
        "mode": "workbook_s_target",
        "s_target_supplied": solver_targets.get("s") is not None,
        "s_target": solver_targets.get("s"),
        "unit": target_units.get("s"),
        "synthesized_s_target_mmol_l": None,
        "unbudgeted_sulfate": None,
        "note": "S 목표가 레시피에 있으므로 황산은 목표 범위 안에서 배분했습니다.",
    }
    if solver_targets.get("s") is None and solver_targets.get("mg") is not None:
        magnesium_factor = _unit_factor_to_mmol_per_l(target_units.get("mg")) or 1.0
        sulfate_unit = target_units.get("s") or "mmol/L"
        sulfate_factor = _unit_factor_to_mmol_per_l(sulfate_unit) or 1.0
        magnesium_target_mmol_l = float(solver_targets["mg"]) * magnesium_factor
        synthesized_target = _round_reported(magnesium_target_mmol_l / sulfate_factor)
        solver_targets["s"] = synthesized_target
        target_units.setdefault("s", sulfate_unit)
        sulfate_policy = {
            "mode": "mgso4_preferred_without_published_s_target",
            "s_target_supplied": False,
            "s_target": synthesized_target,
            "unit": sulfate_unit,
            "synthesized_s_target_mmol_l": _round_reported(magnesium_target_mmol_l),
            "unbudgeted_sulfate": None,
            "note": (
                "이 레시피에는 S 목표가 없습니다. 마그네슘은 관행대로 황산마그네슘으로 넣고, 그때 "
                "함께 들어가는 황산은 목표에 없는 추가분으로 표시합니다. 질산마그네슘으로 바꿔 질산을 "
                "늘리는 방식은 쓰지 않았습니다."
            ),
        }
        warnings.append(
            "S 목표가 없는 레시피라 마그네슘을 황산마그네슘으로 넣었고, 그만큼의 황산("
            + f"{synthesized_target:g} {sulfate_unit})은 목표에 없는 추가분입니다."
        )

    water_mmol_l, water_origin, water_mode = _prescription_source_water(
        submitted_mmol_l=source_water_mmol_l,
        baseline_rows=recipe_payload["source_water_baseline"],
    )
    solver_source_water: dict[str, float] = {}
    unconvertible_water: list[dict[str, Any]] = []
    for ion, mmol_value in water_mmol_l.items():
        factor = _unit_factor_to_mmol_per_l(target_units.get(ion))
        if factor is None:
            unconvertible_water.append(
                {
                    "analyte": _NUTRIENT_ANALYTE_LABELS.get(ion, ion),
                    "canonical_key": ion,
                    "source_water_mmol_l": mmol_value,
                    "reason": (
                        "이 이온에는 레시피가 제시한 단위가 없어 원수 분석값을 목표 단위로 옮기지 "
                        "않았습니다."
                    ),
                }
            )
            continue
        solver_source_water[ion] = _round_reported(mmol_value / factor)

    fertilizers = [dict(row) for row in reference_rows["fertilizers"]]
    calcium_formula_keys = set(_CALCIUM_NITRATE_FORMULA_RANKING)
    available_calcium = [
        row for row in fertilizers if _formula_lookup_key(row.get("formula")) in calcium_formula_keys
    ]
    calcium_source: dict[str, Any] = {
        "mode": "solver_default_ranking",
        "ranking": list(_CALCIUM_NITRATE_FORMULA_RANKING),
        "available_formulas": [row.get("formula") for row in available_calcium],
        "requested_formula": option_map.get("calcium_source_formula"),
        "excluded_formulas": [],
        "note": (
            "기본값은 솔버가 가진 순위 그대로 질산칼슘 4수염을 먼저 씁니다. 농가 '처방전 계산' 시트의 "
            "선택과 같습니다."
        ),
    }
    requested_calcium = option_map.get("calcium_source_formula")
    if requested_calcium:
        wanted_key = _formula_lookup_key(requested_calcium)
        if wanted_key not in calcium_formula_keys:
            raise ValueError(
                "calcium_source_formula must name one of: "
                + ", ".join(_CALCIUM_NITRATE_FORMULA_RANKING)
                + "."
            )
        if wanted_key not in {_formula_lookup_key(row.get("formula")) for row in available_calcium}:
            raise LookupError(
                f"The workbook fertilizer catalog has no row for calcium source '{requested_calcium}'."
            )
        calcium_source["excluded_formulas"] = [
            row.get("formula")
            for row in available_calcium
            if _formula_lookup_key(row.get("formula")) != wanted_key
        ]
        fertilizers = [
            row
            for row in fertilizers
            if _formula_lookup_key(row.get("formula")) == wanted_key
            or _formula_lookup_key(row.get("formula")) not in calcium_formula_keys
        ]
        calcium_source["mode"] = "caller_selected"
        calcium_source["note"] = (
            "요청한 칼슘 원료만 남기고 다른 질산칼슘 제품을 후보에서 제외한 뒤 계산했습니다."
        )

    solver_options = {
        key: value for key, value in option_map.items() if key in _SOLVER_FORWARDED_OPTIONS
    }
    prescription = solve_stock_tanks(
        targets=solver_targets,
        target_units=target_units,
        source_water=solver_source_water or None,
        fertilizers=fertilizers,
        stock_tank_volume_l=effective_volume_l,
        stock_ratio=effective_ratio,
        options=solver_options,
    )
    warnings.extend(str(entry) for entry in prescription.get("warnings") or ())

    achieved_sulfate = (prescription.get("achieved_working_solution") or {}).get("s") or {}
    if sulfate_policy["mode"] == "mgso4_preferred_without_published_s_target":
        sulfate_policy["unbudgeted_sulfate"] = {
            "value": achieved_sulfate.get("from_fertilizer"),
            "unit": achieved_sulfate.get("unit") or sulfate_policy["unit"],
            "status": "unbudgeted_addition",
        }

    magnesium_nitrate_steps = [
        step
        for step in prescription.get("allocation_steps") or ()
        if step.get("role") == "mg_nitrate" and float(step.get("grams") or 0.0) > 0.0
    ]
    magnesium_policy = {
        "preferred_source": "mg_sulfate",
        "magnesium_nitrate_used": bool(magnesium_nitrate_steps),
        "magnesium_nitrate_grams": _round_reported(
            sum(float(step.get("grams") or 0.0) for step in magnesium_nitrate_steps), 3
        ),
        "steps": magnesium_nitrate_steps,
        "note": (
            "황산 예산이 마그네슘을 덮지 못해 남은 마그네슘이 질산마그네슘으로 들어갔습니다. 그만큼 "
            "질산이 함께 늘어납니다."
            if magnesium_nitrate_steps
            else "마그네슘은 전량 황산마그네슘으로 들어갔습니다."
        ),
    }

    nitrate = dict(prescription.get("nitrate_reconciliation") or {})
    nitrate_policy = {
        "status": nitrate.get("status"),
        "unit": nitrate.get("unit"),
        "target": nitrate.get("target"),
        "source_water": nitrate.get("source_water"),
        "supplied_by_fertilizer": nitrate.get("supplied_by_fertilizer"),
        "difference": nitrate.get("difference"),
        "cause": nitrate.get("cause"),
        "suggested_swaps": nitrate.get("suggested_swaps") or [],
        "note": (
            "질산이 모자라면 부족분과 교체 후보를 그대로 보고하고 임의의 질산 공급원을 만들지 "
            "않습니다. 실제 농가에서 중탄산 중화에 쓰는 질산(HNO3)은 질산 공급원이지만 워크북 "
            "비료_DB에 없어 이 계산에 포함되지 않았습니다."
        ),
    }
    if nitrate.get("status") == "deficit":
        warnings.append(
            "질산이 목표에 미치지 못합니다. 부족분은 교체 후보와 함께 보고하며, 워크북 비료_DB에 없는 "
            "질산(HNO3)은 계산에 넣지 않았습니다."
        )

    guardrails = {
        "cl": recipe["guardrails"].get("cl_max"),
        "hco3": recipe["guardrails"].get("hco3_max"),
        "na": recipe["guardrails"].get("na_max"),
    }
    guardrail_review = _prescription_guardrail_review(
        prescription=prescription, recipe=recipe, target_units=target_units
    )
    for row in guardrail_review:
        if row["status"] == "above-guardrail":
            warnings.append(
                f"{row['analyte']} 예상값 {row['projected_value']} {row['unit']}는 워크북 상한 "
                f"{row['guardrail_max']} {row['unit']}를 넘습니다."
            )

    if water_mode == "submitted":
        water_statement = (
            "제출된 원수 분석값을 사용했습니다(제출 항목: "
            + ", ".join(sorted(source_water_mmol_l or {}))
            + "). 나머지 항목은 워크북 '원수 분석' 시트 값을 사용했습니다."
        )
    elif water_mode == "workbook_baseline":
        water_statement = (
            "제출된 원수 분석이 없어 워크북 '원수 분석' 시트의 기준값으로 계산했습니다. 농가에 적용하기 "
            "전에 실제 원수 분석값으로 다시 계산해 주세요."
        )
    else:
        water_statement = (
            "원수 분석값이 전혀 없어 원수 성분을 0으로 두고 계산했습니다. 이 상태의 결과는 농가 "
            "처방으로 쓸 수 없습니다."
        )

    source_water_basis = {
        "mode": water_mode,
        "statement": water_statement,
        "submitted_analytes": sorted((source_water_mmol_l or {}).keys()),
        "workbook_sheet": "원수 분석",
        "analytes_mmol_l": water_mmol_l,
        "analytes_in_target_units": solver_source_water,
        "origin_by_analyte": water_origin,
        "unconvertible_analytes": unconvertible_water,
    }

    drain_reviews = _evaluate_water_measurements(
        drain_water_mmol_l or {},
        analysis_kind="drain_water",
        baseline_index=_water_reference_index(recipe_payload["drain_water_baseline"]),
        guardrails=guardrails,
    )
    drain_water_context = {
        "submitted_analytes": sorted((drain_water_mmol_l or {}).keys()),
        "review": drain_reviews,
        "applied_to_targets": False,
        "note": (
            "배액 분석은 이 배합량의 목표 조성에 자동 반영하지 않았습니다. 원자료가 이온별 보정계수를 "
            "싣지 않았기 때문이며, 범위를 제한한 배액 피드백은 recommend_nutrient_correction에 있습니다."
        ),
    }

    return {
        "family": "nutrient_prescription",
        "crop": recipe_payload["crop"],
        "requested": {"stage": stage, "medium": medium},
        "resolved": recipe_payload["resolved"],
        "available_stages": recipe_payload["available_stages"],
        "available_mediums": recipe_payload["available_mediums"],
        "recipe": recipe,
        "targets": {
            "values": solver_targets,
            "units": target_units,
            "chloride_target": chloride_resolution,
        },
        "stock_tank_basis": {
            "stock_tank_volume_l": effective_volume_l,
            "stock_ratio": effective_ratio,
            "tanks": ["A", "B"],
            "working_solution_volume_l": prescription["working_solution_volume_l"],
            "statement": (
                f"A·B 탱크 각 {effective_volume_l:g} L를 {effective_ratio:g}배로 채워 작업 양액 "
                f"{prescription['working_solution_volume_l']:g} L를 만드는 기준입니다."
            ),
            "requested": {
                "stock_tank_volume_l": stock_tank_volume_l,
                "stock_ratio": stock_ratio,
            },
            "published_basis": {
                "stock_tank_volume_l": basis_volume_l,
                "stock_ratio": basis_ratio,
                "locator": worked_example.get("locator"),
            },
            "calculator_defaults": calculator_defaults,
            "implied_stock_tank_volume_l": implied_stock_tank_volume_l,
            "agrees_with_calculator_defaults": basis_agrees,
            "resolved_from": {
                "stock_tank_volume_l": (
                    "caller" if stock_tank_volume_l is not None else "published_stock_tank_basis"
                ),
                "stock_ratio": (
                    "caller"
                    if stock_ratio is not None
                    else "calculator_defaults"
                    if workbook_ratio is not None
                    else "published_stock_tank_basis"
                ),
            },
        },
        "source_water_basis": source_water_basis,
        "drain_water_context": drain_water_context,
        "guardrail_review": guardrail_review,
        "sulfate_policy": sulfate_policy,
        "magnesium_policy": magnesium_policy,
        "nitrate_policy": nitrate_policy,
        "options": {
            "requested": dict(option_map),
            "forwarded_to_solver": solver_options,
            "solver_effective": dict(prescription.get("options") or {}),
            "calcium_source": calcium_source,
        },
        "prescription": prescription,
        "provenance": _build_prescription_provenance(
            crop=crop,
            resolved_stage=resolved_stage,
            resolved_medium=resolved_medium,
            chloride_resolution=chloride_resolution,
        ),
        "warnings": warnings,
        "limitations": [
            water_statement,
            "이 값은 A·B 원액 탱크에 넣는 비료 무게입니다. 작업 양액에 직접 넣는 양이 아닙니다.",
            "EC는 계산하지 않습니다. 이온별 전기전도도 계수를 입력받지 않으므로 EC를 만들어내지 않습니다.",
            "pH 조정용 산과 중탄산 중화는 워크북 비료_DB에 없어 이 배합량에 포함되지 않았습니다.",
        ],
    }
