"""Deterministic advisory seams built on normalized SmartGrow workbook rows."""

from __future__ import annotations

import re
from collections import Counter
from itertools import product
from typing import Any

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
    for nutrient_key, target_mmol_l in effective_recipe_targets.items():
        if target_mmol_l is None:
            continue

        source_mmol_l, source_origin = _resolve_source_reference_value(
            nutrient_key,
            submitted_measurements=source_water_measurements,
            baseline_index=baseline_index,
        )
        supplemental_need_mmol_l = target_mmol_l - source_mmol_l
        batch_delta_mmol = (
            supplemental_need_mmol_l * working_solution_volume_l
            if working_solution_volume_l is not None
            else None
        )
        if supplemental_need_mmol_l > 0.01:
            status = "needs-supplement"
        elif supplemental_need_mmol_l < -0.01:
            status = "source-exceeds-target"
        else:
            status = "near-target"

        display_name = _NUTRIENT_ANALYTE_LABELS.get(nutrient_key, nutrient_key)
        recipe_target_mmol_l = recipe["nutrient_targets"].get(nutrient_key)
        target_adjustment = next(
            (
                row
                for row in (drain_feedback_plan or {}).get("adjustments", [])
                if row.get("canonical_key") == nutrient_key
            ),
            None,
        )
        balance_rows.append(
            {
                "nutrient": display_name,
                "canonical_key": nutrient_key,
                "recipe_target_mmol_l": recipe_target_mmol_l,
                "target_mmol_l": target_mmol_l,
                "target_origin": (
                    target_adjustment["target_origin"]
                    if target_adjustment
                    else "recipe-default"
                ),
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
            "현재는 양액 레시피 기준 조회까지만 제공합니다. 최종 원액 탱크 계산은 아직 포함되지 않습니다.",
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
            "현재는 양액 보정 초안과 제한된 범위의 배액 피드백, 단일 비료 기준 초안까지만 제공합니다. 최종 원액 탱크 계산은 아직 포함되지 않습니다.",
            "수동 보정을 적용하기 전에는 실제 원수·배액 분석값과 워크북 경계값을 함께 확인해 주세요.",
        ],
    }
