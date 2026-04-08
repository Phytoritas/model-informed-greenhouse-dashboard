# Current Loop

## Active State
- Active issue: `#37`
- Active branch: `feat/37-add-rtr-calibration-workspace-for-user-entered-grower-windows-and-house-tuning`
- PR `#38` is open and the local validation ladder is already green.
- The older issue `#3` remains intentionally `Blocked`, but now only as the follow-up for real operator-approved windows and profile recalibration content, not as an implementation blocker.

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
- Issue `#37` now adds the next missing calibration lane on top of that baseline:
  - additive `/api/rtr/calibration-state`, `/api/rtr/calibration-preview`, and `/api/rtr/calibration-save`
  - house-scoped grower-window normalization and persistence helpers in `rtr_profiles.py`
  - a new `RTRCalibrationWorkspace` inside `RTROptimizerPanel` so users can enter, preview, and save approved windows without editing YAML manually
  - profile refresh wiring so saving calibration windows immediately rehydrates `/api/rtr/profiles` plus the live optimizer surface
- `configs/rtr_good_windows.yaml` still contains heuristic/demo windows until real approved windows are entered through the new workspace or config path
- `scripts/calibrate_rtr.py` already supports rerunning the baseline-prior fit from curated windows and remains the batch recalibration seam behind the new UI

## Latest Validation
- The issue `#37` lane is validated locally with:
  - `npm --prefix frontend run test`
  - `npm --prefix frontend run lint`
  - `npm --prefix frontend run build`
  - `poetry run ruff check .`
  - `poetry run pytest`
- PR `#38` is now the remote validation gate.

## Exact Next Step
1. Watch PR `#38` GitHub Actions Backend/Frontend validation and fix only if a remote-only regression appears.
2. Merge issue `#37` once the PR is green, then sync `main` back to a no-active-loop baseline.
3. Keep issue `#3` as the later content-calibration follow-up for entering real approved tomato/cucumber windows and regenerating production-calibrated RTR profiles.
