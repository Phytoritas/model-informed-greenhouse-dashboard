# Current Loop

## Active State
- Active product branch: `fix/106-restore-overview-solution-and-irradiance-live-updates`.
- Active issue: `#106` `[Bug] Restore overview solution and irradiance live updates`.
- This loop is a bounded follow-up on top of PR `#105`, scoped to stale Today operating-direction summaries and the non-updating outside irradiance trend on `/overview`.

## Current Slice
- Backend:
  - Open-Meteo shortwave history now has a dedicated 60-second cache TTL instead of sharing the 15-minute weather-outlook TTL.
  - regression coverage locks the weather-history cache expiry path so the outside irradiance chart can refresh on the existing 60-second frontend polling cadence.
- Frontend:
  - Today operating direction / TodayBoard auto-analysis now keys off real receive time (`receivedAtTimestamp`) instead of replay timestamps.
  - advisor auto-refresh also reacts to market-price updates, weather refreshes, and RTR profile metadata changes instead of only price updates.
  - overlap while an advisor request is already running is suppressed, and the new freshness gate is locked by dedicated unit coverage.

## Latest Validation
- The active issue106 branch is locally green on the full ladder:
  - `npm --prefix frontend run lint`
  - `npm --prefix frontend run test`
  - `npm --prefix frontend run build`
  - `poetry run ruff check .`
  - `poetry run pytest`
- Focused regressions also passed with `npm --prefix frontend run test -- src/utils/advisorAutoRefresh.test.ts src/hooks/useOverviewSignalTrends.test.tsx` and `poetry run pytest tests/test_weather.py`.
- No PR is open yet for the current issue106 branch; the stacked base remains issue104 / PR #105.

## Exact Next Step
1. Keep the diff bounded to issue `#106` and avoid reopening broader telemetry cleanup.
2. Commit the validated fix set on `fix/106-restore-overview-solution-and-irradiance-live-updates`.
3. Push the branch and open a stacked PR against `fix/104-restore-live-refresh-responsiveness-and-overview-source-sink-sync` while PR `#105` remains open.
