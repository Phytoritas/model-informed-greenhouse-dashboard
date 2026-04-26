# Current Loop

## Active State
- Issue `#112` is the active bounded backend/frontend integration repair lane.
- Active branch: `fix/112-backend-frontend-integration-audit-and-repair`.
- The only open tracked backlog issue is blocked issue `#3`, which still waits for grower-approved RTR windows.
- The post-issue106 `main` baseline remains the preserved product/runtime baseline.

## Stable Main Baseline
- PR `#105` merged issue `#104` into `main` at `854ef7c`.
- PR `#107` merged issue `#106` into `main` at `032df2e`.
- The merged baseline now includes:
  - live refresh responsiveness restored across status polling, websocket recovery, and runtime snapshot reads
  - overview hero metrics plus the 3-day source-sink surfaces consuming live values instead of stale advisor snapshots or flat zero history
  - Today operating-direction auto-refresh keyed off live receive time with market, weather, and RTR profile freshness gating
  - outside irradiance history appending the live shortwave point and exposing visible freshness labels on overview trend surfaces

## Latest Validation
- Issue `#112` is green on the full local ladder after the reviewer follow-up fixes:
  - `npm --prefix frontend run lint`
  - `npm --prefix frontend run test`
  - `npm --prefix frontend run build`
  - `poetry run ruff check .`
  - `poetry run pytest`
- Focused regressions also passed with `npm --prefix frontend run test -- src/App.routing.test.tsx src/hooks/useRtrCalibration.test.tsx` and `poetry run pytest tests/test_rtr_optimizer.py -k "rtr_calibration_state_and_preview_routes_return_house_scoped_windows or rtr_calibration_save_route_persists_windows_and_refreshes_profile"`.
- `git diff --check` passed with line-ending warnings only.
- RAH restart packet revalidation uses `automation/rah.py doctor|status|resume` after tracked `.rah` files are updated.

## Exact Next Step
1. Finalize issue `#112`: review the clean diff, commit, push, and open a PR with `Closes #112`.
2. Keep deferred API-client, response-model, actuator-control, and CSV allowlist work out of this issue.
3. Re-run validation only if the final PR packaging changes code or tracked RAH state.
4. Keep issue `#3` blocked until real grower-approved windows exist.
