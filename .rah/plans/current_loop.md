# Current Loop

## Active State
- Issue `#92` is the active product lane on branch `fix/92-overview`.
- The branch is in local `Validating` state with a green Python and frontend ladder.
- The remaining workflow step is commit/push/PR hygiene, not further scope expansion.

## Latest Delivered Baseline
- `main` retains the merged issue `#65` routed coral shell baseline:
  - visible navigation for `/overview`, `/control`, `/crop-work`, `/resources`, and `/alerts`
  - hidden compatibility routes for `/assistant`, `/settings`, and `/rtr`
  - a bounded `1320px` page canvas with the compact coral shell rhythm
- `main` retains the merged issue `#67` compact `/control` strategy surface and the issue `#69` / `#74` copy cleanup chain.
- `main` also retains the merged issue `#80` / `#82` layout overlap and narrow-rail clipping follow-ups, so the current shell baseline already includes the latest non-overlap fixes.
- `main` now also includes the merged issue `#84` control realtime recovery chain:
  - `frontend/src/config.ts` prefers `127.0.0.1:8000` before legacy local ports
  - stale standard-local backend overrides in `localStorage` are discarded instead of pinning the app to a dead port
  - grower-facing Korean request-error copy replaces raw `Failed to fetch` / `Not Found` strings in the control surfaces
  - launcher cleanup removes stale `uvicorn --port 8000` chains before port cleanup
  - `/control` can publish the optimize result before slower scenario and sensitivity calls finish

## Latest Validation
- The merged issue `#84` ladder is green with:
  - `npm --prefix frontend run lint`
  - `npm --prefix frontend run test -- --pool=threads`
  - `npm --prefix frontend run build`
  - `poetry run ruff check .`
  - `poetry run pytest`
  - `git diff --check`
- The current frontend result is `22 files, 86 passed`, and the repo Python ladder remains `149 passed, 34 warnings`.
- The freshest `/control` evidence is:
  - `artifacts/screenshots/issue84-control-realtime-recovered.png`
  - `artifacts/screenshots/issue84-control-live-no-fallback-final.png`
  - `artifacts/screenshots/issue84-control-early-hydration.png`

## Issue #92 Slice
- The current issue #92 worktree includes the overview/control restoration and shell cleanup slice:
  - overview now carries real-data signal history from `/api/overview/signals`, combining 3-day external irradiance and source-sink balance into a dual-axis trend card
  - RTR runtime snapshots are persisted from the backend simulation loop so the overview trend reflects actual model history instead of frontend fallback math
  - the routed shell and top bar were reworked around the grower-facing `PhytoSync` header/search flow, section routing, alert/settings actions, and assistant drawer entry points
  - control/overview/Crop-work/resources/alerts route pages were tightened, legacy dead surfaces were removed, and lazy loading/vendor splitting reduced the main frontend bundle pressure
  - RTR optimizer draft/committed state now survives section transitions, crop switches, and refreshes through App-owned crop-scoped UI state plus `localStorage`
  - produce price, search, RAG, and Korean copy follow-ups were integrated into the same issue #92 slice, along with the cucumber photo collage fill on overview

## Latest Validation For Issue #92
- `poetry run ruff check .`
- `poetry run pytest`
- `npm --prefix frontend run lint`
- `npm --prefix frontend run test`
- `npm --prefix frontend run build`

## Exact Next Step
1. Commit the validated issue `#92` slice on `fix/92-overview`.
2. Push the branch and create the PR that includes `Closes #92`.
3. Keep any new scope outside issue `#92` off this branch; start a fresh issue/branch from `main` for follow-up work.
