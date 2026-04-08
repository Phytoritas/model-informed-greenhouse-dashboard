"""RTR profile loading and calibration helpers."""

from __future__ import annotations

import copy
import json
from datetime import date, datetime, timezone
from pathlib import Path
from typing import Any, Dict

import numpy as np
import pandas as pd
import yaml

from ..config import settings


DEFAULT_RTR_PROFILES: Dict[str, Dict[str, Any]] = {
    "Tomato": {
        "crop": "Tomato",
        "strategyLabel": "Tomato RTR baseline",
        "sourceNote": (
            "Baseline steering line from the WUR RTR framing and the TomatoesNZ "
            "example graph. Recalibrate with house-specific good-production days."
        ),
        "baseTempC": 18.3,
        "slopeCPerMjM2": 0.15,
        "toleranceC": 1.0,
        "lightToRadiantDivisor": 4.57,
        "calibration": {
            "mode": "baseline",
            "sampleDays": 0,
            "fitStartDate": None,
            "fitEndDate": None,
            "minCoverageHours": 20.0,
            "rSquared": None,
            "meanAbsoluteErrorC": None,
            "selectionSource": "heuristic-fallback",
            "windowCount": 0,
        },
        "baseline": {
            "baseTempC": 18.3,
            "slopeCPerMjM2": 0.15,
            "toleranceC": 1.0,
            "baseline_target_C": 18.3,
        },
        "optimizer": {
            "enabled": True,
            "default_mode": "balanced",
            "max_delta_temp_C": 1.5,
            "max_rtr_ratio_delta": 0.04,
            "temp_slew_rate_C_per_step": 0.12,
            "weights": {
                "temp": 1.0,
                "node": 130.0,
                "carbon": 110.0,
                "sink": 90.0,
                "resp": 25.0,
                "risk": 120.0,
                "energy": 25.0,
                "labor": 18.0,
            },
        },
    },
    "Cucumber": {
        "crop": "Cucumber",
        "strategyLabel": "Cucumber RTR baseline",
        "sourceNote": (
            "Baseline steering line with cucumber interpretation anchored to "
            "24-hour mean-temperature guidance around 21 C. Recalibrate per house."
        ),
        "baseTempC": 18.3,
        "slopeCPerMjM2": 0.15,
        "toleranceC": 1.0,
        "lightToRadiantDivisor": 4.57,
        "calibration": {
            "mode": "baseline",
            "sampleDays": 0,
            "fitStartDate": None,
            "fitEndDate": None,
            "minCoverageHours": 20.0,
            "rSquared": None,
            "meanAbsoluteErrorC": None,
            "selectionSource": "heuristic-fallback",
            "windowCount": 0,
        },
        "baseline": {
            "baseTempC": 18.3,
            "slopeCPerMjM2": 0.15,
            "toleranceC": 1.0,
            "baseline_target_C": 18.3,
        },
        "optimizer": {
            "enabled": True,
            "default_mode": "balanced",
            "max_delta_temp_C": 1.2,
            "max_rtr_ratio_delta": 0.03,
            "temp_slew_rate_C_per_step": 0.12,
            "weights": {
                "temp": 1.0,
                "node": 150.0,
                "carbon": 120.0,
                "sink": 80.0,
                "resp": 20.0,
                "risk": 120.0,
                "energy": 25.0,
                "labor": 20.0,
            },
        },
    },
}

DEFAULT_RTR_PROFILE_PAYLOAD: Dict[str, Any] = {
    "version": 2,
    "updatedAt": "baseline",
    "availableModes": ["baseline", "optimizer"],
    "profiles": copy.deepcopy(DEFAULT_RTR_PROFILES),
}

DEFAULT_RTR_GOOD_WINDOWS_PAYLOAD: Dict[str, Any] = {
    "version": 1,
    "timezone": "Asia/Seoul",
    "updatedAt": "template",
    "crops": {
        "Tomato": [],
        "Cucumber": [],
    },
}

CALIBRATION_FILTERS: Dict[str, Dict[str, float]] = {
    "Tomato": {
        "minCoverageHours": 20.0,
        "minRadiationMjM2": 2.0,
        "minTempC": 15.0,
        "maxTempC": 32.0,
        "minRhPct": 45.0,
        "maxRhPct": 95.0,
    },
    "Cucumber": {
        "minCoverageHours": 20.0,
        "minRadiationMjM2": 2.0,
        "minTempC": 16.0,
        "maxTempC": 34.0,
        "minRhPct": 45.0,
        "maxRhPct": 98.0,
    },
}


def rtr_profiles_path(config_path: str | Path | None = None) -> Path:
    """Return the canonical RTR profile config path."""
    if config_path is not None:
        return Path(config_path)

    return Path(settings.config_dir) / "rtr_profiles.json"


def rtr_good_windows_path(config_path: str | Path | None = None) -> Path:
    """Return the canonical curated RTR window config path."""
    if config_path is not None:
        return Path(config_path)

    return Path(settings.config_dir) / "rtr_good_windows.yaml"


def _deep_merge_dict(base: Dict[str, Any], override: Dict[str, Any]) -> Dict[str, Any]:
    merged = copy.deepcopy(base)
    for key, value in override.items():
        if isinstance(value, dict) and isinstance(merged.get(key), dict):
            merged[key] = _deep_merge_dict(merged[key], value)
        else:
            merged[key] = value

    return merged


def _normalize_crop_key(crop: str) -> str:
    normalized = crop.strip().lower()
    if normalized == "tomato":
        return "Tomato"
    if normalized == "cucumber":
        return "Cucumber"
    raise ValueError(f"Unsupported crop for RTR profile: {crop}")


def _normalize_iso_date(value: Any) -> str | None:
    if isinstance(value, datetime):
        return value.date().isoformat()
    if isinstance(value, date):
        return value.isoformat()
    if isinstance(value, str):
        try:
            return date.fromisoformat(value).isoformat()
        except ValueError:
            return None

    return None


def _normalize_good_window(raw_window: Any) -> Dict[str, Any] | None:
    if not isinstance(raw_window, dict):
        return None

    start_date = _normalize_iso_date(raw_window.get("startDate"))
    end_date = _normalize_iso_date(raw_window.get("endDate"))
    if start_date is None or end_date is None:
        return None
    if end_date < start_date:
        return None

    label = raw_window.get("label")
    notes = raw_window.get("notes")

    return {
        "label": label.strip() if isinstance(label, str) and label.strip() else None,
        "startDate": start_date,
        "endDate": end_date,
        "enabled": bool(raw_window.get("enabled", True)),
        "notes": notes.strip() if isinstance(notes, str) and notes.strip() else None,
    }


def _augment_profile_schema(canonical_crop: str, profile: Dict[str, Any]) -> Dict[str, Any]:
    normalized = copy.deepcopy(profile)
    normalized["baseline"] = _deep_merge_dict(
        DEFAULT_RTR_PROFILES[canonical_crop]["baseline"],
        normalized.get("baseline") or {},
    )
    normalized["baseline"]["baseTempC"] = round(float(normalized.get("baseTempC", normalized["baseline"]["baseTempC"])), 6)
    normalized["baseline"]["slopeCPerMjM2"] = round(
        float(normalized.get("slopeCPerMjM2", normalized["baseline"]["slopeCPerMjM2"])),
        6,
    )
    normalized["baseline"]["toleranceC"] = round(
        float(normalized.get("toleranceC", normalized["baseline"]["toleranceC"])),
        6,
    )
    normalized["baseline"]["baseline_target_C"] = round(
        float(normalized["baseline"].get("baseline_target_C", normalized["baseline"]["baseTempC"])),
        6,
    )
    normalized["optimizer"] = _deep_merge_dict(
        DEFAULT_RTR_PROFILES[canonical_crop]["optimizer"],
        normalized.get("optimizer") or {},
    )
    return normalized


def load_rtr_profiles(config_path: str | Path | None = None) -> Dict[str, Any]:
    """Load RTR profiles from config, falling back to the baseline payload."""
    path = rtr_profiles_path(config_path)
    payload = copy.deepcopy(DEFAULT_RTR_PROFILE_PAYLOAD)

    if not path.exists():
        return payload

    with path.open("r", encoding="utf-8") as handle:
        raw = json.load(handle)

    if isinstance(raw.get("version"), int):
        payload["version"] = raw["version"]
    if isinstance(raw.get("updatedAt"), str):
        payload["updatedAt"] = raw["updatedAt"]
    if isinstance(raw.get("availableModes"), list):
        payload["availableModes"] = [str(item) for item in raw["availableModes"]]

    raw_profiles = raw.get("profiles", {})
    if not isinstance(raw_profiles, dict):
        return payload

    for crop_key, profile in raw_profiles.items():
        try:
            canonical_crop = _normalize_crop_key(crop_key)
        except ValueError:
            continue

        if isinstance(profile, dict):
            payload["profiles"][canonical_crop] = _deep_merge_dict(
                DEFAULT_RTR_PROFILES[canonical_crop], profile
            )
            payload["profiles"][canonical_crop] = _augment_profile_schema(
                canonical_crop,
                payload["profiles"][canonical_crop],
            )

    for canonical_crop, profile in list(payload["profiles"].items()):
        payload["profiles"][canonical_crop] = _augment_profile_schema(canonical_crop, profile)

    return payload


def load_rtr_good_windows(config_path: str | Path | None = None) -> Dict[str, Any]:
    """Load curated good-production windows for RTR calibration."""
    path = rtr_good_windows_path(config_path)
    payload = copy.deepcopy(DEFAULT_RTR_GOOD_WINDOWS_PAYLOAD)

    if not path.exists():
        return payload

    with path.open("r", encoding="utf-8") as handle:
        raw = yaml.safe_load(handle) or {}

    if isinstance(raw.get("version"), int):
        payload["version"] = raw["version"]
    if raw.get("timezone") is not None:
        payload["timezone"] = str(raw["timezone"])
    if raw.get("updatedAt") is not None:
        payload["updatedAt"] = str(raw["updatedAt"])

    raw_crops = raw.get("crops", {})
    if not isinstance(raw_crops, dict):
        return payload

    for crop_key, windows in raw_crops.items():
        try:
            canonical_crop = _normalize_crop_key(crop_key)
        except ValueError:
            continue

        if not isinstance(windows, list):
            continue

        normalized_windows = [
            normalized
            for raw_window in windows
            if (normalized := _normalize_good_window(raw_window)) is not None
        ]
        payload["crops"][canonical_crop] = normalized_windows

    return payload


def save_rtr_profiles(
    payload: Dict[str, Any],
    config_path: str | Path | None = None,
) -> Path:
    """Persist RTR profiles to JSON."""
    path = rtr_profiles_path(config_path)
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as handle:
        json.dump(payload, handle, ensure_ascii=False, indent=2)
        handle.write("\n")

    return path


def aggregate_daily_rtr_metrics(
    env_df: pd.DataFrame,
    light_to_radiant_divisor: float = 4.57,
) -> pd.DataFrame:
    """Aggregate environment rows into daily RTR points."""
    required_columns = {"datetime", "T_air_C", "PAR_umol"}
    missing_columns = required_columns.difference(env_df.columns)
    if missing_columns:
        missing = ", ".join(sorted(missing_columns))
        raise ValueError(f"Missing required environment columns: {missing}")

    working_df = env_df.copy()
    working_df["datetime"] = pd.to_datetime(working_df["datetime"])
    working_df = working_df.sort_values("datetime").reset_index(drop=True)
    if working_df.empty:
        return pd.DataFrame(
            columns=[
                "date",
                "coverageHours",
                "averageTempC",
                "dliMolM2",
                "radiationSumMjM2",
                "averageRhPct",
                "lightHours",
                "sampleCount",
            ]
        )

    delta_seconds = (
        working_df["datetime"].shift(-1) - working_df["datetime"]
    ).dt.total_seconds()
    median_delta = float(delta_seconds.dropna().median()) if delta_seconds.notna().any() else 60.0
    if not np.isfinite(median_delta) or median_delta <= 0:
        median_delta = 60.0

    working_df["dtSeconds"] = delta_seconds.fillna(median_delta).clip(lower=1.0)
    working_df["date"] = working_df["datetime"].dt.strftime("%Y-%m-%d")
    working_df["weightedTemp"] = working_df["T_air_C"] * working_df["dtSeconds"]
    working_df["photonMicromol"] = working_df["PAR_umol"] * working_df["dtSeconds"]
    working_df["radiantJ"] = (
        working_df["PAR_umol"] / light_to_radiant_divisor
    ) * working_df["dtSeconds"]

    if "RH_percent" in working_df.columns:
        working_df["weightedRh"] = working_df["RH_percent"] * working_df["dtSeconds"]
    else:
        working_df["weightedRh"] = np.nan

    working_df["lightSeconds"] = np.where(
        working_df["PAR_umol"] > 20.0,
        working_df["dtSeconds"],
        0.0,
    )

    daily_df = (
        working_df.groupby("date", dropna=False)
        .agg(
            totalSeconds=("dtSeconds", "sum"),
            weightedTemp=("weightedTemp", "sum"),
            photonMicromol=("photonMicromol", "sum"),
            radiantJ=("radiantJ", "sum"),
            weightedRh=("weightedRh", "sum"),
            lightSeconds=("lightSeconds", "sum"),
            sampleCount=("dtSeconds", "size"),
        )
        .reset_index()
    )

    daily_df["coverageHours"] = daily_df["totalSeconds"] / 3600.0
    daily_df["averageTempC"] = daily_df["weightedTemp"] / daily_df["totalSeconds"]
    daily_df["dliMolM2"] = daily_df["photonMicromol"] / 1_000_000.0
    daily_df["radiationSumMjM2"] = daily_df["radiantJ"] / 1_000_000.0
    daily_df["averageRhPct"] = daily_df["weightedRh"] / daily_df["totalSeconds"]
    daily_df["lightHours"] = daily_df["lightSeconds"] / 3600.0

    return daily_df[
        [
            "date",
            "coverageHours",
            "averageTempC",
            "dliMolM2",
            "radiationSumMjM2",
            "averageRhPct",
            "lightHours",
            "sampleCount",
        ]
    ]


def filter_daily_points_by_windows(
    daily_df: pd.DataFrame,
    calibration_windows: list[dict[str, Any]] | None = None,
) -> tuple[pd.DataFrame, int]:
    """Apply inclusive date windows to daily RTR points and de-duplicate overlaps."""
    if daily_df.empty:
        return daily_df.copy(), 0

    enabled_windows = [
        window
        for window in (calibration_windows or [])
        if isinstance(window, dict) and bool(window.get("enabled", True))
    ]
    if not enabled_windows:
        return daily_df.iloc[0:0].copy(), 0

    working_df = daily_df.copy()
    working_df["dateValue"] = pd.to_datetime(working_df["date"]).dt.date
    combined_mask = pd.Series(False, index=working_df.index)

    for window in enabled_windows:
        start_date = date.fromisoformat(window["startDate"])
        end_date = date.fromisoformat(window["endDate"])
        combined_mask |= (working_df["dateValue"] >= start_date) & (
            working_df["dateValue"] <= end_date
        )

    return (
        working_df.loc[combined_mask]
        .drop_duplicates(subset=["date"])
        .drop(columns=["dateValue"])
        .reset_index(drop=True),
        len(enabled_windows),
    )


def _apply_daily_quality_filters(crop: str, daily_df: pd.DataFrame) -> pd.DataFrame:
    """Apply conservative quality filters after any date-window selection."""
    canonical_crop = _normalize_crop_key(crop)
    filters = CALIBRATION_FILTERS[canonical_crop]
    if daily_df.empty:
        return daily_df.copy()

    filtered_df = daily_df.copy()
    mask = (
        (filtered_df["coverageHours"] >= filters["minCoverageHours"])
        & (filtered_df["radiationSumMjM2"] >= filters["minRadiationMjM2"])
        & (filtered_df["averageTempC"] >= filters["minTempC"])
        & (filtered_df["averageTempC"] <= filters["maxTempC"])
    )

    if "averageRhPct" in filtered_df.columns and filtered_df["averageRhPct"].notna().any():
        mask &= (
            (filtered_df["averageRhPct"] >= filters["minRhPct"])
            & (filtered_df["averageRhPct"] <= filters["maxRhPct"])
        )

    return filtered_df.loc[mask].reset_index(drop=True)


def select_rtr_calibration_days(
    crop: str,
    daily_df: pd.DataFrame,
    calibration_windows: list[dict[str, Any]] | None = None,
    selection_mode: str = "auto",
) -> tuple[pd.DataFrame, Dict[str, Any]]:
    """Select candidate days for RTR calibration from curated windows and/or heuristics."""
    normalized_mode = selection_mode.strip().lower()
    if normalized_mode not in {"auto", "windows-only", "heuristic-only"}:
        raise ValueError(f"Unsupported RTR selection mode: {selection_mode}")

    windowed_df, window_count = filter_daily_points_by_windows(daily_df, calibration_windows)

    if normalized_mode == "heuristic-only":
        base_df = daily_df.copy()
        selection_source = "heuristic-fallback"
    elif normalized_mode == "windows-only":
        base_df = windowed_df
        selection_source = "curated-windows"
    elif window_count > 0:
        base_df = windowed_df
        selection_source = "curated-windows"
    else:
        base_df = daily_df.copy()
        selection_source = "heuristic-fallback"

    filtered_df = _apply_daily_quality_filters(crop, base_df)
    return filtered_df, {
        "selectionSource": selection_source,
        "windowCount": window_count if selection_source == "curated-windows" else 0,
        "preFilterDays": int(len(base_df)),
    }


def fit_rtr_profile(
    crop: str,
    daily_df: pd.DataFrame,
    calibration_windows: list[dict[str, Any]] | None = None,
    selection_mode: str = "auto",
) -> Dict[str, Any]:
    """Fit an RTR profile from daily points, falling back to baseline when data are weak."""
    canonical_crop = _normalize_crop_key(crop)
    baseline_profile = copy.deepcopy(DEFAULT_RTR_PROFILES[canonical_crop])
    candidate_df, selection_metadata = select_rtr_calibration_days(
        canonical_crop,
        daily_df,
        calibration_windows=calibration_windows,
        selection_mode=selection_mode,
    )
    sample_days = int(len(candidate_df))
    baseline_profile["calibration"]["sampleDays"] = sample_days
    baseline_profile["calibration"]["minCoverageHours"] = CALIBRATION_FILTERS[canonical_crop][
        "minCoverageHours"
    ]
    baseline_profile["calibration"]["selectionSource"] = selection_metadata["selectionSource"]
    baseline_profile["calibration"]["windowCount"] = selection_metadata["windowCount"]

    if sample_days < 5:
        if selection_metadata["selectionSource"] == "curated-windows":
            baseline_profile["sourceNote"] = (
                f"Curated RTR windows are configured for {canonical_crop}, but only "
                f"{sample_days} quality-filtered day(s) remained. Expand or adjust the "
                "window spec before replacing the literature baseline."
            )
        baseline_profile["calibration"]["mode"] = "insufficient-data"
        return baseline_profile

    x_values = candidate_df["radiationSumMjM2"].to_numpy(dtype=float)
    y_values = candidate_df["averageTempC"].to_numpy(dtype=float)

    slope, intercept = np.polyfit(x_values, y_values, 1)
    residuals = y_values - (intercept + slope * x_values)
    residual_center = float(np.median(residuals))
    residual_mad = float(np.median(np.abs(residuals - residual_center)))
    if residual_mad > 1e-9:
        robust_scale = 1.4826 * residual_mad
        inlier_mask = np.abs(residuals - residual_center) <= 3.0 * robust_scale
        if int(inlier_mask.sum()) >= 5:
            x_values = x_values[inlier_mask]
            y_values = y_values[inlier_mask]
            slope, intercept = np.polyfit(x_values, y_values, 1)

    prediction = intercept + slope * x_values
    residuals = y_values - prediction
    total_variance = float(np.sum((y_values - np.mean(y_values)) ** 2))
    residual_variance = float(np.sum(residuals**2))
    r_squared = None
    if total_variance > 0:
        r_squared = 1.0 - (residual_variance / total_variance)

    fitted_profile = copy.deepcopy(DEFAULT_RTR_PROFILES[canonical_crop])
    fitted_profile["strategyLabel"] = f"{canonical_crop} house-fit RTR line"
    if selection_metadata["selectionSource"] == "curated-windows":
        fitted_profile["sourceNote"] = (
            f"Calibrated from {sample_days} quality-filtered daily RTR points across "
            f"{selection_metadata['windowCount']} curated good-production window(s). "
            "Keep refining the window spec as higher-confidence operating periods become available."
        )
    else:
        fitted_profile["sourceNote"] = (
            f"Calibrated from {sample_days} quality-filtered daily RTR points in this house "
            "using heuristic daily filters. Replace this with curated good-production windows "
            "for a stronger operating line."
        )
    fitted_profile["baseTempC"] = round(float(intercept), 3)
    fitted_profile["slopeCPerMjM2"] = round(float(slope), 4)
    fitted_profile["calibration"] = {
        "mode": "fitted",
        "sampleDays": sample_days,
        "fitStartDate": str(candidate_df["date"].min()),
        "fitEndDate": str(candidate_df["date"].max()),
        "minCoverageHours": CALIBRATION_FILTERS[canonical_crop]["minCoverageHours"],
        "rSquared": round(float(r_squared), 4) if r_squared is not None else None,
        "meanAbsoluteErrorC": round(float(np.mean(np.abs(residuals))), 4),
        "selectionSource": selection_metadata["selectionSource"],
        "windowCount": selection_metadata["windowCount"],
    }
    fitted_profile = _augment_profile_schema(canonical_crop, fitted_profile)

    return fitted_profile


def calibrate_rtr_profiles_from_csvs(
    crop_to_csv_path: Dict[str, str | Path],
    existing_payload: Dict[str, Any] | None = None,
    calibration_windows_payload: Dict[str, Any] | None = None,
    selection_mode: str = "auto",
) -> Dict[str, Any]:
    """Calibrate one or more RTR profiles from environment CSV files."""
    payload = copy.deepcopy(existing_payload or DEFAULT_RTR_PROFILE_PAYLOAD)
    profiles = payload.setdefault("profiles", copy.deepcopy(DEFAULT_RTR_PROFILES))
    windows_payload = calibration_windows_payload or DEFAULT_RTR_GOOD_WINDOWS_PAYLOAD

    for crop_key, csv_path in crop_to_csv_path.items():
        canonical_crop = _normalize_crop_key(crop_key)
        env_df = pd.read_csv(csv_path)
        daily_df = aggregate_daily_rtr_metrics(
            env_df,
            light_to_radiant_divisor=profiles.get(canonical_crop, {}).get(
                "lightToRadiantDivisor",
                DEFAULT_RTR_PROFILES[canonical_crop]["lightToRadiantDivisor"],
            ),
        )
        profiles[canonical_crop] = fit_rtr_profile(
            canonical_crop,
            daily_df,
            calibration_windows=windows_payload.get("crops", {}).get(canonical_crop, []),
            selection_mode=selection_mode,
        )

    payload["updatedAt"] = datetime.now(timezone.utc).isoformat()
    payload["profiles"] = profiles
    return payload
