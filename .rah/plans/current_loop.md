# Current Loop

## Active State
- `main` is the truthful post-issue106 merged baseline.
- No active product implementation branch is open in the repository.
- The only open tracked backlog issue is blocked issue `#3`, which still waits for grower-approved RTR windows.
- Issue `#108` is only the documentation-only harness-sync lane for tracked `.rah` state.

## Stable Main Baseline
- PR `#105` merged issue `#104` into `main` at `854ef7c`.
- PR `#107` merged issue `#106` into `main` at `032df2e`.
- The merged baseline now includes:
  - live refresh responsiveness restored across status polling, websocket recovery, and runtime snapshot reads
  - overview hero metrics plus the 3-day source-sink surfaces consuming live values instead of stale advisor snapshots or flat zero history
  - Today operating-direction auto-refresh keyed off live receive time with market, weather, and RTR profile freshness gating
  - outside irradiance history appending the live shortwave point and exposing visible freshness labels on overview trend surfaces

## Latest Validation
- The merged issue104/issue106 work stayed green on the full local ladder:
  - `npm --prefix frontend run lint`
  - `npm --prefix frontend run test`
  - `npm --prefix frontend run build`
  - `poetry run ruff check .`
  - `poetry run pytest`
- Focused regressions also passed with `npm --prefix frontend run test -- src/utils/advisorAutoRefresh.test.ts src/hooks/useOverviewSignalTrends.test.tsx` and `poetry run pytest tests/test_weather.py`.
- GitHub Actions Backend/Frontend validation succeeded before PR `#105` and PR `#107` were merged.
- This docs-sync lane revalidates the restart packet with `automation/rah.py doctor|status|resume` after the tracked `.rah` files are updated.

## Exact Next Step
1. Keep issue `#3` blocked until real grower-approved windows exist.
2. For new product work such as any remaining cold-load advisor investigation, open a fresh issue-based branch off clean `main`.
3. Keep docs issue `#108` limited to harness-sync work only.
