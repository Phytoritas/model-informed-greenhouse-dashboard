# Current Loop

## Active State
- `main` is now the truthful post-issue84 merged baseline.
- Issue `#84` is closed and PR `#85` is merged.
- Issue `#86` exists only as the post-merge `.rah` sync record; it is not a new product implementation lane.

## Latest Delivered Baseline
- `main` retains the merged issue `#65` routed coral shell baseline:
  - visible navigation for `/overview`, `/control`, `/crop-work`, `/resources`, and `/alerts`
  - hidden compatibility routes for `/assistant`, `/settings`, and `/rtr`
  - a bounded `1320px` page canvas with the compact coral shell rhythm
- `main` retains the merged issue `#67` compact `/control` strategy surface and the issue `#69` / `#74` copy cleanup chain.
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
1. Start the next non-trivial change from a fresh issue/branch instead of reopening issue `#84`.
2. If follow-up work is still needed, keep it bounded:
   - local backend listener hygiene
   - control latency profiling
   - remaining panel-overlap cleanup
