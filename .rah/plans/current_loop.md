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
- `/crop-work`, `/resources`, `/alerts`, `/growth/*`, `/nutrient/*`, `/protection/*`, and `/harvest/*` now render in the standalone PNG-style product frame instead of falling through to `AppShell` + `WorkspaceNav`.
- `/rtr` remains a compatibility URL into Dashboard > climate strategy, but it is no longer duplicated as a visible top-level route item.
- Crop Work, Resources, and Protection now use `FeatureLandingFrame` summaries with metric strips, action boards, baseline-vs-recommended comparisons, and bridge cards before their full backend-backed panels.
- Resources and Protection summary cards now include compact visual trend/timeline bars so energy/weather/market and alert-history signals are not text-only.
- The old `AppShell` / `WorkspaceNav` / `TopBar` fallback was removed from production routing, so unknown URLs now redirect inside the standalone PNG-style frame instead of briefly rendering the side-panel shell.
- Unused legacy wrappers for resources, crop work, alerts, RTR, advisor lanes, and phyto shell re-exports were deleted after route tests confirmed the connected standalone pages still render.
- The model What-if workspace now pairs backend scenario and sensitivity results with horizon-level effect bars and derivative bars before the detailed result table.
- `useGreenhouse` connects to `/ws/forecast/{crop}` through `FORECAST_WS_URL` while retaining `/api/forecast/{crop}` polling as the cold-start and fallback hydrator.
- `frontend/src/app/backend-integration-inventory.ts` records required backend surfaces and tests that they remain represented in frontend routes or panels, including hidden compatibility endpoints intentionally delegated through `/api/advisor/tab/*`.
- Overview Dashboard fills the chart gap with RTR trend and consulting workload cards.
- Overview Command defaults visible landing copy to cucumber context and keeps PNG-like Today Action Board, Scenario Optimizer, and Weather/Market/Knowledge Bridge density.
- Overview Watch uses the current ivory/sage/tomato panel system and no longer has transparent tab overlap.
- Assistant/Ask uses the warm UI system, book-like knowledge search navigation, farmer-friendly answer summaries, and pesticide focus-target buttons for common cucumber protection problems.

## Validation
- `npm run --prefix frontend lint` passed.
- `npm run --prefix frontend build` passed.
- `npm run --prefix frontend test` passed: 36 files, 166 tests.
- `.\.venv\Scripts\ruff.exe check src tests scripts` passed.
- `.\.venv\Scripts\pytest.exe -q` passed: 186 tests, 46 warnings.
- Focused `npm run --prefix frontend test -- src/App.routing.test.tsx --maxWorkers=1 --no-file-parallelism` passed: 50 tests. npm printed non-blocking unknown-config warnings for those passthrough flags.
- Visual evidence was captured under `docs/design/` for Command, Dashboard, Watch, tablet, and mobile overview states.
- Current browser smoke used Vite on `127.0.0.1:5174` and Playwright MCP for `/overview`, `/trend#trend-weather`, `/trend#trend-market`, `/scenarios#scenario-model`, `/assistant#assistant-search`, `/resources`, `/alerts`, and `/unknown-route`; each rendered the standalone product frame with no `app-sidebar` route chrome and 0 console errors.
- A viewport screenshot was captured as `docs/design/overview-standalone-smoke.png`.

## Exact Next Step
1. Review the PR `#125` diff and avoid including unrelated local edits.
2. Push the current validation-backed commit on `fix/124-restore-tab-integrations-ui`.
3. Keep issue `#3` blocked until real grower-approved windows exist.
