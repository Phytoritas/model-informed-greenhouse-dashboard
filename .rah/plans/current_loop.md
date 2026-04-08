# Current Loop

## Active State
- Active issue: `#34`
- Active branch: `feat/34-complete-rtr-optimizer-decision-surface-warnings-and-scenario-detail`
- The separate calibration follow-up in issue `#3` is still intentionally `Blocked` on grower-approved tomato/cucumber windows; this branch is a decision-surface and scenario-detail follow-up over the already-landed issue `#27` and merged issue `#32` RTR optimizer surface.

## Latest Delivered Baseline
- `main` already includes the merged issue `#27` RTR optimizer lane:
  - internal-model-only RTR backend services under `backend/app/services/rtr/`
  - additive `/api/rtr/state|optimize|scenario|sensitivity|area-settings`
  - baseline-compatible `/api/rtr/profiles`
  - canonical m² plus actual-area projection through `AreaUnitContext`, `AreaUnitPanel`, and `RTROptimizerPanel`
- `configs/rtr_good_windows.yaml` still contains heuristic/demo windows
- `scripts/calibrate_rtr.py` already supports rerunning the baseline-prior fit from curated windows

## Current Issue #34 Delta
- Landed on this branch:
  - stale telemetry now keeps the last valid RTR optimizer surface visible in a read-only state instead of collapsing the panel unless telemetry is fully offline
  - the shared area panel now distinguishes `default`, `server`, and `local` actual-area sources so users can tell whether projections are placeholders, hydrated house defaults, or manual overrides
  - scenario rows now expose confidence, risk flags, yield projections, and actual-area energy/yield totals across baseline, optimizer, and custom compare cases
  - custom scenario compare and blocked-telemetry controls are covered by refreshed frontend hook/component tests plus richer backend scenario route contract tests
- Local validation is already green:
  - `npm --prefix frontend run test`
  - `npm --prefix frontend run lint`
  - `npm --prefix frontend run build`
  - `poetry run ruff check .`
  - `poetry run pytest tests/test_rtr_optimizer.py`
  - `poetry run pytest tests/test_smoke.py -k rtr`
  - `poetry run pytest`

## Exact Next Step
1. Watch PR `#35` GitHub Actions Backend/Frontend validation to completion.
2. If a remote-only failure appears, fix it on the same branch and rerun the local ladder before pushing again.
3. After PR `#35` merges, return to issue `#3` only when grower-approved calibration windows are actually available.
