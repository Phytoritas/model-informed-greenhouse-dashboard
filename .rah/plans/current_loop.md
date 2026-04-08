# Current Loop

## Active State
- Active issue: `none`
- Active branch: `main`
- Issue `#39` is merged and there is no active implementation branch on the baseline.
- The older issue `#3` remains intentionally `Blocked`, but only as the optional follow-up for real operator-approved windows and profile recalibration content, not as an implementation blocker.

## Latest Delivered Baseline
- `main` already includes the merged issue `#27` RTR optimizer lane:
  - internal-model-only RTR backend services under `backend/app/services/rtr/`
  - additive `/api/rtr/state|optimize|scenario|sensitivity|area-settings`
  - baseline-compatible `/api/rtr/profiles`
  - canonical m² plus actual-area projection through `AreaUnitContext`, `AreaUnitPanel`, and `RTROptimizerPanel`
- `main` now also includes the merged issue `#34` decision-surface follow-up:
  - stale telemetry keeps the last valid optimizer surface visible in read-only mode instead of collapsing the whole panel
  - the shared area panel labels actual-area provenance as `default`, `server`, or `local`
  - scenario compare rows carry confidence, risk flags, yield projections, and actual-area totals across baseline, optimizer, and custom cases
- `main` now also includes the merged issue `#37` calibration workspace lane:
  - additive `/api/rtr/calibration-state`, `/api/rtr/calibration-preview`, and `/api/rtr/calibration-save`
  - house-scoped grower-window normalization and persistence helpers in `rtr_profiles.py`
  - a new `RTRCalibrationWorkspace` inside `RTROptimizerPanel` so users can enter, preview, and save approved windows without editing YAML manually
  - profile refresh wiring so saving calibration windows immediately rehydrates `/api/rtr/profiles` plus the live optimizer surface
- `main` now also includes the merged issue `#39` control-surface follow-up:
  - fixed offset scenario compare rows for `baseline -0.3C`, `baseline +0.3C`, and `baseline +0.6C`
  - screen-bias finite-difference sensitivity rows for humidity-risk and disease-risk penalties
  - frontend RTR label/type updates so those new scenario/sensitivity surfaces render clearly in Korean and English
  - backend/frontend regression coverage that locks the new compare rows and sensitivity entries
- `configs/rtr_good_windows.yaml` still contains heuristic/demo windows until real approved windows are entered through the new workspace or config path
- `scripts/calibrate_rtr.py` already supports rerunning the baseline-prior fit from curated windows and remains the batch recalibration seam behind the new UI

## Latest Validation
- The merged issue `#39` lane was validated locally with:
  - `npm --prefix frontend run test`
  - `npm --prefix frontend run lint`
  - `npm --prefix frontend run build`
  - `poetry run ruff check .`
  - `poetry run pytest`
  - `git diff --check`
- PR `#40` GitHub Actions Backend/Frontend validation both completed successfully before merge.

## Exact Next Step
1. Keep `main` at the merged issue `#39` baseline until a new bounded issue is opened.
2. When real approved tomato/cucumber windows are available, resume a fresh issue-based branch for the optional calibration-content follow-up and use the landed workspace or config path to enter them.
3. Rerun RTR validation only after those real windows are supplied and the profiles are recalibrated from that content.
