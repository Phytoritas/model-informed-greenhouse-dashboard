# Current Loop

## Active State
- Issue `#84` is active on branch `fix/84-fix-control-realtime-failures-and-user-facing-fetch-errors`.
- The branch stays bounded to control realtime recovery on top of the merged issue `#82` baseline:
  - `frontend/src/config.ts` now prefers `8000` before `8003`
  - stale standard local backend overrides in `localStorage` are discarded instead of pinning the app to a dead port
  - user-facing request failures in the control strategy surfaces are rewritten into grower-facing Korean copy instead of exposing raw `Failed to fetch` / `Not Found`
- Local validation is green again; the next gate is commit/push/PR plus remote validation.

## Latest Delivered Baseline
- `main` still includes the merged issue `#65` shell bundle:
  - visible navigation for `/overview`, `/control`, `/crop-work`, `/resources`, and `/alerts`
  - hidden compatibility routes for `/assistant`, `/settings`, and `/rtr`
  - a bounded `1320px` page canvas with the compact coral shell rhythm
- `main` also includes the merged issue `#67` compact `/control` strategy surface:
  - short strategy summary
  - recommended setpoint tiles
  - baseline-vs-recommended comparison table
  - preserved optimizer hook and route wiring
- `main` now includes the merged issue `#69` and issue `#74` copy cleanup chain:
  - grower-facing control-route metadata and shell copy
  - cleaner `RTROutlookPanel` / `WeatherOutlookPanel` wording plus shorter `ControlPanel` English fallbacks
  - refreshed `phytosyncSections.ts` English section descriptions and tab labels without changing route ids or hashes
  - Vitest coverage for the updated section-tab metadata

## Latest Validation
- The issue `#84` local ladder is green with:
  - `npm --prefix frontend run lint`
  - `npm --prefix frontend run test -- --pool=threads`
  - `npm --prefix frontend run build`
  - `poetry run ruff check .`
  - `poetry run pytest`
  - `git diff --check`
- The current frontend result is `22 files, 84 passed`, and the repo Python ladder remains `149 passed, 34 warnings`.
- Fresh browser capture for the active slice is:
  - `artifacts/screenshots/issue84-control-realtime-recovered.png`
- Live browser verification showed:
  - `/control` now calls `http://127.0.0.1:8000/api/*` even when `smartgrow.backendOrigin=http://127.0.0.1:8003` was pre-seeded in localStorage
  - `smartgrow.backendOrigin` and `smartgrow.backendOriginPinned` are cleared after the page heals back to the standard local backend
  - raw `Failed to fetch` and `Not Found` strings no longer appear in the `/control` UI
  - the current local backend environment still has overlapping uvicorn listeners on `8000`, so `/api/rtr/state` remains unavailable in that environment and is now handled with bounded fallback copy instead of raw errors

## Exact Next Step
1. Commit the issue `#84` realtime-recovery slice, push `fix/84-fix-control-realtime-failures-and-user-facing-fetch-errors`, and open the PR with the repo helper script.
2. Move the project item to `Validating` and watch GitHub Actions Backend/Frontend validation to green.
3. If the overlapping local backend listeners on `8000` still need operational cleanup after the frontend fix lands, open a separate follow-up issue instead of widening issue `#84` beyond frontend recovery and grower-facing fallback copy.
