# Current Loop

## Active State
- Active issue: `none`
- Active branch: `main`
- The separate calibration follow-up in issue `#3` remains intentionally `Blocked` on grower-approved tomato/cucumber windows, so the baseline currently has no open implementation branch after issue `#34` merged.

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
- `configs/rtr_good_windows.yaml` still contains heuristic/demo windows
- `scripts/calibrate_rtr.py` already supports rerunning the baseline-prior fit from curated windows

## Latest Validation
- The merged issue `#34` lane was validated locally with:
  - `npm --prefix frontend run test`
  - `npm --prefix frontend run lint`
  - `npm --prefix frontend run build`
  - `poetry run ruff check .`
  - `poetry run pytest tests/test_rtr_optimizer.py`
  - `poetry run pytest tests/test_smoke.py -k rtr`
  - `poetry run pytest`
- PR `#35` GitHub Actions Backend/Frontend validation also completed successfully before merge.

## Exact Next Step
1. Keep issue `#3` blocked until grower-approved tomato/cucumber good-production windows are actually available.
2. When those windows arrive, resume a fresh issue-based calibration branch from `main`, update `configs/rtr_good_windows.yaml`, and rerun `scripts/calibrate_rtr.py`.
3. Reopen the RTR validation lane only after the calibrated profiles and grower-reviewed windows are ready to test against the landed optimizer surface.
