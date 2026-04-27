# Current Loop

## Active State
- Product implementation issue `#124` is active on branch `fix/124-restore-tab-integrations-ui`.
- PR `#125` is open for restoring tabbed workspace integrations and backend-backed solution visibility.
- Issue `#118` remains closed and merged into `main` at `dfd68cdc2da0acd13bd37f2d47558e12757602f7`; do not reopen it for this slice.
- The blocked calibration backlog remains issue `#3`, waiting for grower-approved RTR windows.

## Current Issue 124 Slice
- Design tokens in `theme.css`, `index.css`, and `tailwind.config.js` now reflect the warm agriculture-tech palette with accessible red/green semantics.
- Shared UI primitives were added or updated for buttons, card/panel patterns, metric cards, alert cards, trend cards, status chips, inputs, select, section headers, and responsive grids.
- `/overview` now assembles the reference Command screen from `TopNavigation`, `HeroDecisionBrief`, `LiveMetricStrip`, `TodayActionBoard`, `ScenarioOptimizerPreview`, `WeatherMarketKnowledgeBridge`, `FinalCTA`, and `Footer`.
- `/`, `/overview`, and `/overview/legacy` render the reference landing surface outside `AppShell`, while detailed backend-backed features remain in dedicated workspace routes.
- `/control`, `/rtr`, `/scenarios`, `/crop-work`, `/resources`, `/alerts`, and `/assistant` expose in-page workspace tabs instead of hiding restored features behind sidebar-only actions.
- `/growth/*`, `/nutrient/*`, `/protection/*`, and `/harvest/*` now redirect into canonical workspace tabs that use the full connected panels.
- `useGreenhouse` connects to `/ws/forecast/{crop}` through `FORECAST_WS_URL` while retaining `/api/forecast/{crop}` polling as the cold-start and fallback hydrator.
- `frontend/src/app/backend-integration-inventory.ts` records required backend surfaces and tests that they remain represented in frontend routes or panels, including hidden compatibility endpoints intentionally delegated through `/api/advisor/tab/*`.
- Overview Dashboard fills the chart gap with RTR trend and consulting workload cards.
- Overview Command defaults visible landing copy to cucumber context and keeps PNG-like Today Action Board, Scenario Optimizer, and Weather/Market/Knowledge Bridge density.
- Overview Watch uses the current ivory/sage/tomato panel system and no longer has transparent tab overlap.
- Assistant/Ask uses the warm UI system, book-like knowledge search navigation, farmer-friendly answer summaries, and pesticide focus-target buttons for common cucumber protection problems.

## Validation
- `npm run --prefix frontend lint` passed.
- `npm run --prefix frontend build` passed.
- `npm run --prefix frontend test -- --maxWorkers=1 --no-file-parallelism` passed: 39 files, 163 tests. npm printed non-blocking unknown-config warnings for those passthrough flags.
- `.\.venv\Scripts\ruff.exe check src tests scripts` passed. `poetry run ruff check ...` timed out in this Windows session, so direct venv execution was used after verifying the same venv.
- `.\.venv\Scripts\pytest.exe -q` passed: 184 tests, 44 warnings. `poetry run pytest` timed out in this Windows session, so direct venv execution was used after collection succeeded.
- Focused `npx vitest run src/App.routing.test.tsx src/app/backend-integration-inventory.test.ts --maxWorkers=1 --no-file-parallelism` passed: 43 tests.
- Visual evidence was captured under `docs/design/` for Command, Dashboard, Watch, tablet, and mobile overview states.

## Exact Next Step
1. Review the PR `#125` diff and avoid including unrelated local edits.
2. Push the current validation-backed commit on `fix/124-restore-tab-integrations-ui`.
3. Keep issue `#3` blocked until real grower-approved windows exist.
