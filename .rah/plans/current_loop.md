# Current Loop

## Active State
- Active issue: `#32`
- Active branch: `feat/32-harden-rtr-optimizer-frontend-contract-and-loading-gates`
- The separate calibration follow-up in issue `#3` is still intentionally `Blocked` on grower-approved tomato/cucumber windows; this branch is a frontend hardening follow-up over the already-landed issue `#27` RTR optimizer surface.

## Latest Delivered Baseline
- `main` already includes the merged issue `#27` RTR optimizer lane:
  - internal-model-only RTR backend services under `backend/app/services/rtr/`
  - additive `/api/rtr/state|optimize|scenario|sensitivity|area-settings`
  - baseline-compatible `/api/rtr/profiles`
  - canonical m² plus actual-area projection through `AreaUnitContext`, `AreaUnitPanel`, and `RTROptimizerPanel`
- `configs/rtr_good_windows.yaml` still contains heuristic/demo windows
- `scripts/calibrate_rtr.py` already supports rerunning the baseline-prior fit from curated windows

## Current Issue #32 Delta
- Landed on this branch:
  - profile-loading gate so the RTR optimizer surface no longer opens with optimistic `enabled=true` assumptions before `/api/rtr/profiles` resolves
  - node-target hydration gate so `/api/rtr/state` must supply `predicted_node_rate_day` or the user must enter a target manually before optimizer/scenario/sensitivity requests fire
  - local-area persistence gate so localStorage-restored `source="local"` values are not immediately POSTed back to `/api/rtr/area-settings` on first mount
  - raw `/api/rtr/profiles` payload preservation in `useRtrProfiles`
  - Vitest coverage for the above hook/panel/profile behaviors
- Local validation is already green:
  - `npm --prefix frontend run test`
  - `npm --prefix frontend run lint`
  - `npm --prefix frontend run build`
  - `poetry run ruff check .`
  - `poetry run pytest tests/test_rtr_optimizer.py`
  - `poetry run pytest tests/test_smoke.py -k rtr`
  - `poetry run pytest`

## Exact Next Step
1. Watch PR `#33` GitHub Actions Backend/Frontend validation to completion.
2. If a remote-only failure appears, fix it on the same branch and rerun the local ladder before pushing again.
3. After PR `#33` merges, return to issue `#3` only when grower-approved calibration windows are actually available.
