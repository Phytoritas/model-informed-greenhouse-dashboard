"""Calibrate house-specific RTR profiles from greenhouse environment CSV files."""

from __future__ import annotations

import argparse
from pathlib import Path

from model_informed_greenhouse_dashboard.backend.app.services.rtr_profiles import (
    calibrate_rtr_profiles_from_csvs,
    load_rtr_good_windows,
    load_rtr_profiles,
    save_rtr_profiles,
)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "Fit RTR steering coefficients from greenhouse environment CSV files and "
            "write the result to configs/rtr_profiles.json."
        )
    )
    parser.add_argument(
        "--crop",
        choices=["all", "tomato", "cucumber"],
        default="all",
        help="Crop profile to calibrate. Default: all",
    )
    parser.add_argument(
        "--tomato-csv",
        default="data/Tomato_Env.CSV",
        help="Path to the tomato environment CSV.",
    )
    parser.add_argument(
        "--cucumber-csv",
        default="data/Cucumber_Env.CSV",
        help="Path to the cucumber environment CSV.",
    )
    parser.add_argument(
        "--output",
        default="configs/rtr_profiles.json",
        help="Output JSON path for calibrated RTR profiles.",
    )
    parser.add_argument(
        "--windows",
        default="configs/rtr_good_windows.yaml",
        help="Path to the curated good-production window YAML.",
    )
    parser.add_argument(
        "--selection-mode",
        choices=["auto", "windows-only", "heuristic-only"],
        default="auto",
        help=(
            "How to choose daily points for fitting: auto=prefer curated windows when "
            "present, windows-only=use only the curated windows, heuristic-only=ignore "
            "the window file and use the built-in daily quality filters."
        ),
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    repo_root = Path(__file__).resolve().parents[1]
    crop_to_csv_path: dict[str, Path] = {}

    if args.crop in ("all", "tomato"):
        crop_to_csv_path["Tomato"] = (repo_root / args.tomato_csv).resolve()
    if args.crop in ("all", "cucumber"):
        crop_to_csv_path["Cucumber"] = (repo_root / args.cucumber_csv).resolve()

    existing_payload = load_rtr_profiles(repo_root / args.output)
    calibration_windows_payload = load_rtr_good_windows(repo_root / args.windows)
    calibrated_payload = calibrate_rtr_profiles_from_csvs(
        crop_to_csv_path=crop_to_csv_path,
        existing_payload=existing_payload,
        calibration_windows_payload=calibration_windows_payload,
        selection_mode=args.selection_mode,
    )
    output_path = save_rtr_profiles(calibrated_payload, repo_root / args.output)

    print(f"Saved calibrated RTR profiles to {output_path}")
    for crop_name, profile in calibrated_payload["profiles"].items():
        calibration = profile["calibration"]
        print(
            f"{crop_name}: base={profile['baseTempC']:.3f} C, "
            f"slope={profile['slopeCPerMjM2']:.4f} C per MJ m^-2, "
            f"mode={calibration['mode']}, sampleDays={calibration['sampleDays']}, "
            f"selection={calibration.get('selectionSource', 'heuristic-fallback')}, "
            f"windows={calibration.get('windowCount', 0)}"
        )

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
