# Wakeup Packet

## Identity
- workspace: `model-informed-greenhouse-dashboard`
- topic: `frontend-ui-system`
- sessionId: `model-informed-greenhouse-dashboard#118:overview-ui-system-redesign`
- caseId: `case/model-informed-greenhouse-dashboard/118/overview-ui-system-redesign`
- active product issue: `#118`
- branch: `feat/118-redesign-overview-decision-dashboard-ui-system`
- blocked backlog issue: `#3`

## Current State
- current_stage: `issue118-overview-ui-system-redesign`
- implementation_gate: `pass`
- scope: image-informed `/overview` landing UI system redesign using `docs/design/design_system_ui_ux_dashboard_mockup.png` and `docs/design/codex_image_based_greenhouse_ui_prompt.md`; `docs/design/UIUX_example.png` remains the original imported source copy
- validation_baseline: frontend lint, 154-test Vitest suite, production build, and Playwright overview/dashboard screenshots passed locally
- route_contract: `/`, `/overview`, and `/overview/legacy` render outside `AppShell`; `/rtr`, `/assistant`, and `/settings` are first-class shell navigation routes
- live_forecast_contract: frontend uses `FORECAST_WS_URL` for `/ws/forecast/{crop}` snapshots and keeps `/api/forecast/{crop}` polling as fallback
- visual_fidelity_delta: Overview Command hero uses `frontend/src/assets/overview-greenhouse-hero.jpg`, a compressed crop derived from the existing greenhouse photo, instead of the previous CSS-only greenhouse illustration
- dashboard_delta: Overview Dashboard fills the empty slot beside electrical demand with `RtrTrendCard` and adds `ConsultingTrendCard` under source-sink trends without changing backend/API contracts
- command_delta: Overview Command first-screen cards now use tighter PNG-like section density, bottom status chips on Today Action Board, a compact baseline-vs-RTR scenario strip, compact Weather/Market/Knowledge bridge cards, active cucumber labeling, and a smaller assistant FAB that avoids covering the board.
- data_flow_delta: Command freshness and metric chips now reflect actual telemetry/KPI state; the hero preview uses live PAR and soil moisture instead of fabricated DLI or irrigation-minute values.
- watch_delta: Overview Watch now reuses the warm sg-panel/status-chip visual system for AlertRail and TodayBoard, neutralizes zero-count critical/warning summaries, and removes the transparent/absolute overview tab overlap.
- assistant_delta: Assistant/Ask now uses the same warm UI system, book-like knowledge result pages, farmer-friendly answer summaries, and pesticide focus-target buttons for common cucumber protection problems.

## Read First
1. nearest `AGENTS.md`
2. `Phytoritas.md`
3. `docs/architecture/Phytoritas.md`
4. `docs/design/codex_image_based_greenhouse_ui_prompt.md`
5. `.rah/state/status.json`
6. `.rah/plans/current_loop.md`

## Memento Start Recipe
```python
context(types=["preference", "procedure", "error", "decision"], workspace="model-informed-greenhouse-dashboard", sessionId="model-informed-greenhouse-dashboard#118:overview-ui-system-redesign")
recall(
    keywords=["model-informed-greenhouse-dashboard", "frontend-ui-system", "issue118", "overview", "dashboard", "landing", "forecast-websocket", "integration-inventory", "validation"],
    topic="frontend-ui-system",
    workspace="model-informed-greenhouse-dashboard",
    sessionId="model-informed-greenhouse-dashboard#118:overview-ui-system-redesign",
    caseMode=True,
    depth="detail",
    contextText="resume from locally validated issue118 overview UI, first-class workspace nav, forecast websocket, and integration inventory"
)
```

## Feedback Reminder
If recall results are useful or misleading, record `tool_feedback()` and update `.rah/memory/memento_feedback.json`.

## Exact Next Step
- Use `docs/design/current-overview-command-1440x810.png`, `docs/design/current-overview-command-tablet-768x1024.png`, `docs/design/current-overview-command-mobile-390x844.png`, and `docs/design/current-overview-dashboard-fullpage.png` as the latest visual regression evidence.
- Use `docs/design/current-overview-command-fullpage.png` as the latest full-page evidence for the compact cucumber Overview Command pass.
- Use `docs/design/current-overview-watch-1440x810.png` and `docs/design/current-overview-watch-fullpage.png` as the latest Watch tab evidence.
- Review the final diff for unrelated dirty worktree changes before commit/PR packaging.
- Do not alter backend/API contracts as part of issue `#118`; keep issue `#3` blocked until grower-approved windows exist.
