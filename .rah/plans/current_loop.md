# Current Loop

## Active State
- Product implementation issue `#118` is active on branch `feat/118-redesign-overview-decision-dashboard-ui-system`.
- Scope: redesign the `/overview` landing/overview UI system from `docs/design/design_system_ui_ux_dashboard_mockup.png` while preserving existing backend/API data flows. `docs/design/UIUX_example.png` remains the original imported source copy.
- The blocked calibration backlog remains issue `#3`, waiting for grower-approved RTR windows.

## Completed Slice
- Design tokens in `theme.css`, `index.css`, and `tailwind.config.js` now reflect the warm agriculture-tech palette with accessible red/green semantics.
- Shared UI primitives were added or updated for buttons, card/panel patterns, metric cards, alert cards, trend cards, status chips, inputs, select, section headers, and responsive grids.
- `/overview` now assembles TopNavigation, HeroDecisionBrief, LiveMetricStrip, TodayActionBoard, ScenarioOptimizerPreview, WeatherMarketKnowledgeBridge, FinalCTA, and Footer from existing frontend data contracts.
- `/`, `/overview`, and `/overview/legacy` now render the reference landing surface outside `AppShell`, removing the legacy topbar/sidebar/floating assistant residue from the first viewport while keeping other app routes on the existing shell.
- `/rtr`, `/assistant`, and `/settings` are now first-class workspace navigation entries instead of hidden routes folded into Overview/Control.
- `useGreenhouse` now connects to `/ws/forecast/{crop}` through `FORECAST_WS_URL` while retaining `/api/forecast/{crop}` polling as the cold-start and fallback hydrator.
- `frontend/src/app/backend-integration-inventory.ts` records the required backend surfaces and tests that they remain represented in frontend routes or panels.
- Reviewer findings were resolved for optimizer-data provenance, overview hash/action scrolling, weather/market/knowledge error states, Korean landing copy, and stale issue #116 gate state.
- `useGreenhouse` no longer logs expected abort cleanup as `console.error`, so frontend smoke checks distinguish aborted startup requests from real API failures.
- The obsolete `.rah/runtime/issue-coral-stay-redesign.md` residue was removed because it conflicted with the issue #118 sage/olive/ivory reference direction.
- The Overview Command hero now uses a cropped/compressed repo-native greenhouse JPG asset instead of the CSS-only greenhouse illustration, keeping the dashboard preview card and all API-backed data flow unchanged.
- Overview Dashboard now fills the odd chart-grid gap next to electrical demand with the recent RTR temperature trend card.
- Overview Dashboard now places an advisor consulting workload chart under the source-sink trend card; confidence is displayed as a single observed reference line, not as fabricated trend data.
- Overview Command first-screen cards were tightened toward the PNG center mockup: Today Action Board uses bottom status chips, Scenario Optimizer is a lower baseline-vs-RTR comparison strip, and Weather/Market/Knowledge Bridge is a compact 3-card row.
- Overview Command now defaults visible landing copy to cucumber context: the hero preview title uses the active crop label and the market bridge falls back to `오이`/`Cucumber` instead of tomato copy.
- Reviewer follow-up removed hard-coded Command freshness/metric claims: telemetry labels now follow actual status, Live Overview freshness comes from KPI timestamps/availability, hero preview uses PAR and soil moisture instead of fabricated DLI/irrigation minutes, and missing/offline KPI states no longer render as green growth chips.
- The latest first-screen fidelity pass makes low VPD surface as a higher-priority action, further compresses Today/Scenario/Bridge card density, and shrinks the assistant FAB so it no longer covers the Weather/Market/Knowledge board.
- Overview Watch now uses the same PNG-derived panel system as Command/Dashboard: AlertRail and TodayBoard were moved off the old DashboardCard residue, empty critical/warning buckets render neutral instead of red, and the nested overview tab strip is no longer absolute/transparent over underlying content.
- Assistant/Ask now uses the warm ivory/sage/tomato UI system, book-like knowledge search navigation, farmer-friendly answer summaries, and pesticide focus-target buttons for common cucumber protection problems.

## Validation
- `npm run --prefix frontend lint` passed.
- `npm run --prefix frontend test` passed: 37 files, 155 tests.
- `npm run --prefix frontend build` passed.
- `http://127.0.0.1:4178/overview` rendered in Playwright from a Vite dev server managed by `webapp-testing` `with_server.py`.
- `docs/design/current-overview-command-1440x810.png` was refreshed from a 1440x810 Playwright screenshot.
- `docs/design/current-overview-command-1440x810.png` was refreshed again after the lower-section density and assistant FAB pass.
- `docs/design/current-overview-command-tablet-768x1024.png` and `docs/design/current-overview-command-mobile-390x844.png` were refreshed after the hero photo asset pass.
- `docs/design/current-overview-dashboard-fullpage.png` was refreshed after the dashboard gap-fill pass.
- `docs/design/current-overview-command-fullpage.png` was refreshed after the cucumber and compact lower-section pass.
- `docs/design/current-overview-watch-1440x810.png` and `docs/design/current-overview-watch-fullpage.png` were refreshed after the Watch tab visual-system pass.
- `git diff --check` passed; it reported only Windows line-ending normalization warnings.
- `npm run --prefix frontend test -- AskKnowledgeBoard AdvisorTabs.pesticide` passed for the book-like knowledge result pages and pesticide target buttons.
- Playwright MCP screenshots were captured under `artifacts/screenshots/issue118-visual-fidelity/` for desktop, full-page, tablet, and mobile overview viewports with 0 browser console errors. Backend-offline WebSocket/startup warnings remain expected in frontend-only review.

## Exact Next Step
1. Use the captured Command/Dashboard/Watch screenshots as visual evidence before opening a PR.
2. Review the final diff for unrelated dirty worktree changes before commit/PR packaging.
3. Keep backend/API contracts unchanged unless a separate issue is opened.
