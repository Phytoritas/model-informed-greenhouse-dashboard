# Current Loop

## Active State
- Active issue: `#39`
- Active branch: `feat/39-complete-rtr-scenario-and-sensitivity-control-surfaces`
- This loop is a bounded follow-up on top of the merged issue `#37` baseline, focused on RTR scenario compare and sensitivity control-surface gaps that remained after the earlier optimizer rollout.
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
- The active issue `#39` branch adds on top of that baseline:
  - fixed offset scenario compare rows for `baseline -0.3C`, `baseline +0.3C`, and `baseline +0.6C`
  - screen-bias finite-difference sensitivity rows for humidity-risk and disease-risk penalties
  - frontend RTR label/type updates so those new scenario/sensitivity surfaces render clearly in Korean and English
  - backend/frontend regression coverage that locks the new compare rows and sensitivity entries
- `configs/rtr_good_windows.yaml` still contains heuristic/demo windows until real approved windows are entered through the new workspace or config path
- `scripts/calibrate_rtr.py` already supports rerunning the baseline-prior fit from curated windows and remains the batch recalibration seam behind the new UI

## Latest Validation
- The active issue `#39` branch is locally green with:
  - `npm --prefix frontend run test`
  - `npm --prefix frontend run lint`
  - `npm --prefix frontend run build`
  - `poetry run ruff check .`
  - `poetry run pytest`
  - `git diff --check`

## Exact Next Step
1. Commit the issue `#39` control-surface follow-up on the active branch.
2. Push the branch and open the PR for remote Backend/Frontend validation.
3. After merge, reset the baseline to `main`; when real approved tomato/cucumber windows are available later, resume the optional issue `#3` calibration-content follow-up.
