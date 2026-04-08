# Current Loop

## Active State
- Issue `#3` is active again on branch `data/3-rtr-grower-window-intake-prep`.
- The merged issue `#27` RTR optimizer remains the latest baseline on `main`.
- The actual replacement of heuristic/demo RTR windows is still blocked on grower-approved periods, so this loop is an intake-prep slice rather than a profile-regeneration slice.

## Latest Delivered Baseline
- `main` already includes the merged issue `#27` RTR optimizer lane:
  - internal-model-only RTR backend services under `backend/app/services/rtr/`
  - additive `/api/rtr/state|optimize|scenario|sensitivity|area-settings`
  - baseline-compatible `/api/rtr/profiles`
  - canonical m² plus actual-area projection through `AreaUnitContext`, `AreaUnitPanel`, and `RTROptimizerPanel`
- `configs/rtr_good_windows.yaml` still contains heuristic/demo windows
- `scripts/calibrate_rtr.py` already supports rerunning the baseline-prior fit from curated windows

## Current Issue #3 Delta
- Already in place:
  - curated-window YAML schema in `configs/rtr_good_windows.yaml`
  - calibration runner in `scripts/calibrate_rtr.py`
  - RTR profile merge/selection tests in `tests/test_rtr_profiles.py`
  - calibration-window rationale note in `docs/architecture/implementation/rtr_calibration_window_selection.md`
- Missing input:
  - grower-approved tomato and cucumber good-production periods
  - supporting rationale or operator sign-off for each replacement window

## Exact Restart Step
1. Use `docs/architecture/implementation/rtr_grower_window_intake.md` to gather grower-approved windows with dates, crop, reason, and evidence.
2. Update `configs/rtr_good_windows.yaml` with those approved windows only.
3. Run `poetry run python scripts/calibrate_rtr.py --windows configs/rtr_good_windows.yaml --output configs/rtr_profiles.json`.
4. Re-run targeted validation:
   - `poetry run pytest tests/test_rtr_profiles.py`
   - `poetry run pytest tests/test_smoke.py -k rtr`
5. Only after the profile payload changes should the broader validation ladder and RTR smoke/PR workflow resume.
