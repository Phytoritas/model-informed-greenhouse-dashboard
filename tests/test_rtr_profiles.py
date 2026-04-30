import pandas as pd
import pytest

from model_informed_greenhouse_dashboard.backend.app.services.rtr_profiles import (
    aggregate_daily_rtr_metrics,
    filter_daily_points_by_windows,
    filter_rtr_good_windows_for_house,
    fit_rtr_profile,
    load_rtr_good_windows,
    load_rtr_profiles,
    normalize_rtr_good_windows,
    save_rtr_good_windows,
    upsert_rtr_good_windows,
)


def test_aggregate_daily_rtr_metrics_builds_daily_point() -> None:
    env_df = pd.DataFrame(
        {
            "datetime": [
                "2026-04-01 00:00",
                "2026-04-01 12:00",
                "2026-04-02 00:00",
            ],
            "T_air_C": [18.0, 22.0, 18.0],
            "PAR_umol": [0.0, 500.0, 0.0],
            "RH_percent": [80.0, 60.0, 82.0],
        }
    )

    daily_df = aggregate_daily_rtr_metrics(env_df, light_to_radiant_divisor=5.0)

    assert len(daily_df) == 2
    first_day = daily_df.iloc[0]
    assert first_day["date"] == "2026-04-01"
    assert round(first_day["coverageHours"], 1) == 24.0
    assert round(first_day["averageTempC"], 1) == 20.0
    assert round(first_day["dliMolM2"], 1) == 21.6
    assert round(first_day["radiationSumMjM2"], 1) == 4.3


def test_fit_rtr_profile_returns_fitted_mode_for_linear_days() -> None:
    daily_df = pd.DataFrame(
        {
            "date": [
                "2026-04-01",
                "2026-04-02",
                "2026-04-03",
                "2026-04-04",
                "2026-04-05",
                "2026-04-06",
            ],
            "coverageHours": [24.0] * 6,
            "averageTempC": [19.5, 20.1, 20.7, 21.3, 21.9, 22.5],
            "dliMolM2": [8.0, 10.0, 12.0, 14.0, 16.0, 18.0],
            "radiationSumMjM2": [8.0, 10.0, 12.0, 14.0, 16.0, 18.0],
            "averageRhPct": [70.0] * 6,
            "lightHours": [8.0] * 6,
            "sampleCount": [1440] * 6,
        }
    )

    profile = fit_rtr_profile("Tomato", daily_df)

    assert profile["calibration"]["mode"] == "fitted"
    assert profile["calibration"]["sampleDays"] == 6
    assert profile["baseTempC"] == 17.1
    assert profile["slopeCPerMjM2"] == 0.3


def test_filter_daily_points_by_windows_merges_overlapping_ranges() -> None:
    daily_df = pd.DataFrame(
        {
            "date": [
                "2026-04-01",
                "2026-04-02",
                "2026-04-03",
                "2026-04-04",
            ],
            "coverageHours": [24.0] * 4,
            "averageTempC": [20.0, 20.5, 21.0, 21.5],
            "dliMolM2": [10.0] * 4,
            "radiationSumMjM2": [10.0, 11.0, 12.0, 13.0],
            "averageRhPct": [70.0] * 4,
            "lightHours": [8.0] * 4,
            "sampleCount": [1440] * 4,
        }
    )

    filtered_df, window_count = filter_daily_points_by_windows(
        daily_df,
        calibration_windows=[
            {"startDate": "2026-04-01", "endDate": "2026-04-03", "enabled": True},
            {"startDate": "2026-04-02", "endDate": "2026-04-04", "enabled": True},
        ],
    )

    assert window_count == 2
    assert filtered_df["date"].tolist() == [
        "2026-04-01",
        "2026-04-02",
        "2026-04-03",
        "2026-04-04",
    ]


def test_load_rtr_good_windows_normalizes_lowercase_crop_keys(tmp_path) -> None:
    config_path = tmp_path / "rtr_good_windows.yaml"
    config_path.write_text(
        "\n".join(
            [
                "version: 1",
                "timezone: Asia/Seoul",
                "updatedAt: 2026-04-03T00:00:00Z",
                "crops:",
                "  tomato:",
                "    - label: tomato-q1",
                "      startDate: 2026-04-01",
                "      endDate: 2026-04-06",
                "      enabled: true",
                "  cucumber:",
                "    - label: cucumber-q1",
                "      startDate: 2026-02-10",
                "      endDate: 2026-03-05",
            ]
        ),
        encoding="utf-8",
    )

    payload = load_rtr_good_windows(config_path)

    assert payload["version"] == 1
    assert payload["crops"]["Tomato"][0]["startDate"] == "2026-04-01"
    assert payload["crops"]["Tomato"][0]["endDate"] == "2026-04-06"
    assert payload["crops"]["Cucumber"][0]["label"] == "cucumber-q1"
    assert payload["crops"]["Tomato"][0]["approvalStatus"] == "heuristic-demo"


def test_load_rtr_profiles_preserves_crop_labor_benchmark_defaults(tmp_path) -> None:
    config_path = tmp_path / "rtr_profiles.json"
    config_path.write_text(
        """
{
  "version": 2,
  "updatedAt": "2026-04-03T00:00:00Z",
  "profiles": {
    "cucumber": {
      "optimizer": {
        "labor_benchmark": {
          "reference_labor_hours_10a_year": 810,
          "default_labor_rate_krw_hour": 19000
        }
      }
    }
  }
}
""".strip(),
        encoding="utf-8",
    )

    payload = load_rtr_profiles(config_path)

    cucumber_benchmark = payload["profiles"]["Cucumber"]["optimizer"]["labor_benchmark"]
    tomato_benchmark = payload["profiles"]["Tomato"]["optimizer"]["labor_benchmark"]
    assert cucumber_benchmark["source_label_ko"] == "농업소득자료 기준"
    assert cucumber_benchmark["reference_labor_hours_10a_year"] == 810
    assert cucumber_benchmark["default_labor_rate_krw_hour"] == 19000
    assert tomato_benchmark["reference_labor_hours_10a_year"] == 687.0


def test_load_rtr_good_windows_preserves_approved_window_metadata(tmp_path) -> None:
    config_path = tmp_path / "rtr_good_windows.yaml"
    config_path.write_text(
        "\n".join(
            [
                "version: 1",
                "timezone: Asia/Seoul",
                "updatedAt: 2026-04-03T00:00:00Z",
                "crops:",
                "  Tomato:",
                "    - label: tomato-grower-window-a",
                "      startDate: 2026-04-01",
                "      endDate: 2026-04-06",
                "      enabled: true",
                "      approvalStatus: grower-approved",
                "      approvalSource: greenhouse-manager",
                "      approvalReason: stable harvest and acceptable quality",
                "      evidenceNotes: no major stress events during the period",
                "      houseId: house-a",
            ]
        ),
        encoding="utf-8",
    )

    payload = load_rtr_good_windows(config_path)

    window = payload["crops"]["Tomato"][0]
    assert window["approvalStatus"] == "grower-approved"
    assert window["approvalSource"] == "greenhouse-manager"
    assert window["approvalReason"] == "stable harvest and acceptable quality"
    assert window["evidenceNotes"] == "no major stress events during the period"
    assert window["houseId"] == "house-a"


def test_load_rtr_good_windows_rejects_approved_window_missing_metadata(tmp_path) -> None:
    config_path = tmp_path / "rtr_good_windows.yaml"
    config_path.write_text(
        "\n".join(
            [
                "version: 1",
                "timezone: Asia/Seoul",
                "updatedAt: 2026-04-03T00:00:00Z",
                "crops:",
                "  Tomato:",
                "    - label: tomato-grower-window-a",
                "      startDate: 2026-04-01",
                "      endDate: 2026-04-06",
                "      enabled: true",
                "      approvalStatus: grower-approved",
                "      approvalSource: greenhouse-manager",
            ]
        ),
        encoding="utf-8",
    )

    with pytest.raises(ValueError, match="missing required metadata"):
        load_rtr_good_windows(config_path)


def test_fit_rtr_profile_prefers_curated_windows_when_present() -> None:
    daily_df = pd.DataFrame(
        {
            "date": [
                "2026-04-01",
                "2026-04-02",
                "2026-04-03",
                "2026-04-04",
                "2026-04-05",
                "2026-04-06",
                "2026-04-07",
                "2026-04-08",
            ],
            "coverageHours": [24.0] * 8,
            "averageTempC": [19.5, 20.1, 20.7, 21.3, 21.9, 22.5, 24.0, 24.0],
            "dliMolM2": [8.0, 10.0, 12.0, 14.0, 16.0, 18.0, 20.0, 22.0],
            "radiationSumMjM2": [8.0, 10.0, 12.0, 14.0, 16.0, 18.0, 20.0, 22.0],
            "averageRhPct": [70.0] * 8,
            "lightHours": [8.0] * 8,
            "sampleCount": [1440] * 8,
        }
    )

    profile = fit_rtr_profile(
        "Tomato",
        daily_df,
        calibration_windows=[
            {
                "label": "stable-fruiting",
                "startDate": "2026-04-01",
                "endDate": "2026-04-06",
                "enabled": True,
            }
        ],
        selection_mode="auto",
    )

    assert profile["calibration"]["mode"] == "fitted"
    assert profile["calibration"]["sampleDays"] == 6
    assert profile["calibration"]["selectionSource"] == "curated-windows"
    assert profile["calibration"]["windowCount"] == 1
    assert profile["baseTempC"] == 17.1
    assert profile["slopeCPerMjM2"] == 0.3


def test_fit_rtr_profile_windows_only_requires_enabled_windows() -> None:
    daily_df = pd.DataFrame(
        {
            "date": [
                "2026-04-01",
                "2026-04-02",
                "2026-04-03",
                "2026-04-04",
                "2026-04-05",
                "2026-04-06",
            ],
            "coverageHours": [24.0] * 6,
            "averageTempC": [19.5, 20.1, 20.7, 21.3, 21.9, 22.5],
            "dliMolM2": [8.0, 10.0, 12.0, 14.0, 16.0, 18.0],
            "radiationSumMjM2": [8.0, 10.0, 12.0, 14.0, 16.0, 18.0],
            "averageRhPct": [70.0] * 6,
            "lightHours": [8.0] * 6,
            "sampleCount": [1440] * 6,
        }
    )

    profile = fit_rtr_profile(
        "Tomato",
        daily_df,
        calibration_windows=[
            {
                "label": "disabled-window",
                "startDate": "2026-04-01",
                "endDate": "2026-04-06",
                "enabled": False,
            }
        ],
        selection_mode="windows-only",
    )

    assert profile["calibration"]["mode"] == "insufficient-data"
    assert profile["calibration"]["selectionSource"] == "curated-windows"
    assert profile["calibration"]["windowCount"] == 0
    assert profile["baseTempC"] == 18.3
    assert profile["slopeCPerMjM2"] == 0.15


def test_normalize_rtr_good_windows_applies_greenhouse_id_and_sorts() -> None:
    windows = normalize_rtr_good_windows(
        [
            {
                "label": "late-window",
                "startDate": "2026-04-10",
                "endDate": "2026-04-14",
                "approvalStatus": "grower-approved",
                "approvalSource": "lead-grower",
                "approvalReason": "stable growth",
                "evidenceNotes": "daily harvest recovered",
            },
            {
                "label": "early-window",
                "startDate": "2026-04-01",
                "endDate": "2026-04-05",
                "approvalStatus": "grower-approved",
                "approvalSource": "lead-grower",
                "approvalReason": "stable growth",
                "evidenceNotes": "leaf removal settled",
            },
        ],
        greenhouse_id="house-a",
    )

    assert [window["label"] for window in windows] == ["early-window", "late-window"]
    assert all(window["houseId"] == "house-a" for window in windows)


def test_upsert_and_save_rtr_good_windows_replaces_house_scope(tmp_path) -> None:
    payload = {
        "version": 1,
        "timezone": "Asia/Seoul",
        "updatedAt": "2026-04-08T00:00:00Z",
        "crops": {
            "Tomato": [
                {
                    "label": "house-a-old",
                    "startDate": "2026-03-01",
                    "endDate": "2026-03-05",
                    "enabled": True,
                    "houseId": "house-a",
                    "approvalStatus": "grower-approved",
                    "approvalSource": "grower-a",
                    "approvalReason": "stable harvest",
                    "evidenceNotes": "good fruit size",
                    "notes": None,
                },
                {
                    "label": "house-b-keep",
                    "startDate": "2026-03-10",
                    "endDate": "2026-03-16",
                    "enabled": True,
                    "houseId": "house-b",
                    "approvalStatus": "grower-approved",
                    "approvalSource": "grower-b",
                    "approvalReason": "stable harvest",
                    "evidenceNotes": "good fruit size",
                    "notes": None,
                },
            ],
            "Cucumber": [],
        },
    }

    updated = upsert_rtr_good_windows(
        payload,
        crop="tomato",
        greenhouse_id="house-a",
        windows=[
            {
                "label": "house-a-new",
                "startDate": "2026-04-01",
                "endDate": "2026-04-07",
                "enabled": True,
                "approvalStatus": "grower-approved",
                "approvalSource": "grower-a",
                "approvalReason": "node progression on target",
                "evidenceNotes": "harvest and vigor both acceptable",
            }
        ],
    )

    tomato_windows = updated["crops"]["Tomato"]
    assert [window["label"] for window in tomato_windows] == ["house-b-keep", "house-a-new"]

    config_path = tmp_path / "rtr_good_windows.yaml"
    save_rtr_good_windows(updated, config_path)
    roundtrip = load_rtr_good_windows(config_path)
    house_a_windows = filter_rtr_good_windows_for_house(roundtrip, "tomato", "house-a")
    house_b_windows = filter_rtr_good_windows_for_house(roundtrip, "tomato", "house-b")

    assert [window["label"] for window in house_a_windows] == ["house-a-new"]
    assert [window["label"] for window in house_b_windows] == ["house-b-keep"]
