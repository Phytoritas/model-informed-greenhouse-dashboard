# Current Loop

## Active State
- `main` is now the truthful post-issue84 merged baseline.
- Issue `#84` is closed and PR `#85` is merged.
- Issue `#88` exists only as the blueprint/backlog sync record; it is not a new product implementation lane.

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

## Exact Next Step
1. Keep issue `#88` bounded to blueprint/backlog sync and do not reopen issue `#84`.
2. The only open known product backlog is issue `#3`, and it stays blocked until real grower-approved tomato/cucumber windows are supplied.
3. Any unrelated follow-up work still starts from a fresh issue/branch on top of `main`.
