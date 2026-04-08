# Current Loop

## Active State
- There is no active non-trivial implementation loop on `main`.
- Issue `#3` remains open, but it is intentionally `Blocked` until grower-approved RTR good-production windows are supplied.
- PR `#29` merged the intake-prep slice, so the baseline now carries the intake contract without pretending that recalibration input already exists.

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
  - grower-window intake note in `docs/architecture/implementation/rtr_grower_window_intake.md`
  - curated-window YAML schema in `configs/rtr_good_windows.yaml`
  - calibration runner in `scripts/calibrate_rtr.py`
  - RTR profile merge/selection tests in `tests/test_rtr_profiles.py`
  - calibration-window rationale note in `docs/architecture/implementation/rtr_calibration_window_selection.md`
- Missing input:
  - grower-approved tomato and cucumber good-production periods
  - supporting rationale or operator sign-off for each replacement window

## Exact Restart Step
1. Use `docs/architecture/implementation/rtr_grower_window_intake.md` to gather grower-approved windows with dates, crop, reason, and evidence.
2. Start a fresh issue-based branch from `main` for the actual replacement slice after those inputs arrive.
3. Update `configs/rtr_good_windows.yaml` with approved windows only.
4. Run `poetry run python scripts/calibrate_rtr.py --windows configs/rtr_good_windows.yaml --output configs/rtr_profiles.json`.
5. Re-run targeted validation:
   - `poetry run pytest tests/test_rtr_profiles.py`
   - `poetry run pytest tests/test_smoke.py -k rtr`
6. Only after the profile payload changes should the broader validation ladder and RTR smoke/PR workflow resume.
