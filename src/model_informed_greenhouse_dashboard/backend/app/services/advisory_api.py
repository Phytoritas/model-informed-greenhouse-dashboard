"""HTTP-facing advisory helpers that avoid importing the full backend runtime."""

from __future__ import annotations

import logging
from typing import Any

from fastapi import HTTPException

from .advisory import (
    recommend_nutrient_correction,
    recommend_nutrient_recipe,
    recommend_pesticides,
)

logger = logging.getLogger(__name__)

SUPPORTED_ADVISORY_CROPS = ("tomato", "cucumber")


def validate_advisory_crop(crop: str) -> str:
    if crop not in SUPPORTED_ADVISORY_CROPS:
        raise HTTPException(status_code=400, detail="crop must be 'tomato' or 'cucumber'")

    return crop


def clamp_recommendation_limit(limit: int) -> int:
    return min(max(limit, 1), 10)


def build_pesticide_recommendation_response(
    *,
    crop: str,
    target: str,
    limit: int,
) -> dict[str, Any]:
    try:
        validated_crop = validate_advisory_crop(crop)
        resolved_limit = clamp_recommendation_limit(limit)
        return {
            "status": "success",
            **recommend_pesticides(
                crop=validated_crop,
                target=target,
                limit=resolved_limit,
            ),
        }
    except HTTPException:
        raise
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except Exception as exc:
        logger.error("Pesticide recommendation failed: %s", exc, exc_info=True)
        raise HTTPException(
            status_code=500,
            detail="Pesticide recommendation failed.",
        ) from exc


def build_nutrient_recommendation_response(
    *,
    crop: str,
    stage: str | None = None,
    medium: str | None = None,
) -> dict[str, Any]:
    try:
        validated_crop = validate_advisory_crop(crop)
        return {
            "status": "success",
            **recommend_nutrient_recipe(
                crop=validated_crop,
                stage=stage,
                medium=medium,
            ),
        }
    except HTTPException:
        raise
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except Exception as exc:
        logger.error("Nutrient recommendation failed: %s", exc, exc_info=True)
        raise HTTPException(
            status_code=500,
            detail="Nutrient recommendation failed.",
        ) from exc


def build_nutrient_correction_response(
    *,
    crop: str,
    stage: str | None = None,
    medium: str | None = None,
    source_water_mmol_l: dict[str, float] | None = None,
    drain_water_mmol_l: dict[str, float] | None = None,
    working_solution_volume_l: float | None = None,
    stock_ratio: float | None = None,
) -> dict[str, Any]:
    try:
        validated_crop = validate_advisory_crop(crop)
        return {
            "status": "success",
            **recommend_nutrient_correction(
                crop=validated_crop,
                stage=stage,
                medium=medium,
                source_water_mmol_l=source_water_mmol_l,
                drain_water_mmol_l=drain_water_mmol_l,
                working_solution_volume_l=working_solution_volume_l,
                stock_ratio=stock_ratio,
            ),
        }
    except HTTPException:
        raise
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except Exception as exc:
        logger.error("Nutrient correction failed: %s", exc, exc_info=True)
        raise HTTPException(
            status_code=500,
            detail="Nutrient correction failed.",
        ) from exc
