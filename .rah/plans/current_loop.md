# Current Loop

## Active State
- Active product branch: `fix/104-restore-live-refresh-responsiveness-and-overview-source-sink-sync`.
- Active issue: `#104` `[Bug] Restore live refresh responsiveness and overview source-sink sync`.
- This loop is bounded to telemetry recovery, overview source-sink history correctness, and the non-moving source-sink graph on `/overview`.

## Current Slice
- Backend:
  - `/api/overview/signals` uses recent live-created runtime snapshots instead of stale replay timestamps.
  - `ModelStateStore` now has created-at/source lookup indexes plus WAL and busy-timeout tuning for the overview-history query path.
  - WebSocket broadcast fan-out is bounded so a slow client cannot hold the simulation loop open.
- Frontend:
  - inactive-crop RTR optimizer fan-out is suppressed so `/control` no longer saturates the backend in the background.
  - overview hero metrics prefer live stream values over stale advisor snapshots.
  - the 3-day source-sink graph overlays live source-sink trail values from stream/metric history instead of showing a flat API-only line.

## Latest Validation
- The active issue104 branch is locally green on the full ladder:
  - `npm --prefix frontend run lint`
  - `npm --prefix frontend run test -- --run`
  - `npm --prefix frontend run build`
  - `poetry run ruff check .`
  - `poetry run pytest`
- Local runtime checks confirmed that `/api/status?crop=Cucumber` returns immediately again and `/api/overview/signals?crop=cucumber&window_hours=72` returns live source-sink points instead of flat zero-only history.
- No PR is open yet for the current branch.

## Exact Next Step
1. Keep the diff bounded to issue `#104` and avoid unrelated cleanup.
2. Commit the validated fix set on `fix/104-restore-live-refresh-responsiveness-and-overview-source-sink-sync`.
3. Open the issue104 PR and move the project item from `Running` to `Validating` once GitHub Actions begin.
