# Current Loop

## Active State
- Active issue: `#41`
- Active branch: `feat/41-introduce-actuator-first-post-control-rtr-seam`
- PR `#42` is the active validating lane for the actuator-first RTR follow-up.
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

## Active Delivery Slice
- Issue `#41` extends the live RTR surface from temperature-first guidance into an actuator-first control seam:
  - first-class heating, cooling, ventilation, thermal-screen, circulation-fan, and CO2 candidates
  - `actuator_bridge -> post_control_state -> crop_bridge -> objective_terms` control evaluation
  - grouped HVAC versus vent/screen scenario rows plus expanded finite-difference sensitivities
  - actual-area projections preserved as display-only totals over canonical m² metrics
- The latest blocker fix-up on PR `#42` also lands:
  - coherent energy decomposition so ventilation-induced cost is not charged twice
  - a shared baseline control candidate used by optimize and scenario surfaces
  - active-objective sensitivity weighting that respects `include_energy_cost` / `include_labor_cost`
  - explicit `circulation_fan_pct=0` preservation in custom scenarios

## Latest Validation
- The active issue `#41` lane is locally green with:
  - `npm --prefix frontend run test`
  - `npm --prefix frontend run lint`
  - `npm --prefix frontend run build`
  - `poetry run ruff check .`
  - `poetry run pytest`
  - `git diff --check`
- Latest local pytest result: `144 passed, 31 warnings`
- PR `#42` remote Backend/Frontend validation is the current open check surface.

## Exact Next Step
1. Watch PR `#42` GitHub Actions on the latest pushed issue `#41` branch head.
2. If any remote check fails, fix only that failing surface on the same issue `#41` branch and rerun the local ladder before pushing again.
3. If PR `#42` goes green, merge it, fast-forward `main`, and reset `.rah` back to a no-active-loop merged baseline while leaving issue `#3` blocked as the optional real-window calibration follow-up.
