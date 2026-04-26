# Workspace Audit

## Mode
- Harness mode: `hybrid`
- Setup scope: `project`
- Active issue: `#112`
- Active branch: `fix/112-backend-frontend-integration-audit-and-repair`
- Preserved merged baseline: post-issue106 `main` with the current SmartGrow runtime, routed shell, RTR optimizer, advisor, knowledge, weather, and market surfaces

## Target Repository Profile
- Repo type: Python-first greenhouse dashboard with Poetry packaging and a Vite frontend
- Current runtime maturity: backend/frontend runtime, model-first SmartGrow services, advisor routes, knowledge search, and RTR optimizer are already landed
- Active expansion mode: backend/frontend integration repair; no product IA rewrite
- Existing quality gates: `npm --prefix frontend run lint`, `npm --prefix frontend run test -- --pool=threads`, `npm --prefix frontend run build`, `poetry run pytest`, `poetry run ruff check .`

## Current Target Inventory
- `src/model_informed_greenhouse_dashboard/backend/app/main.py`: FastAPI route surface for simulation, settings, knowledge, advisor, RTR, weather, market, and WebSocket endpoints
- `frontend/src/config.ts`: runtime API and WebSocket base-url inference
- `frontend/src/hooks/useGreenhouse.ts`: status/start/settings/config/forecast/WebSocket integration
- `frontend/src/hooks/useRtrOptimizer.ts`: `/api/rtr/state|optimize|scenario|sensitivity|area-settings` integration
- `frontend/src/components/advisor/AdvisorTabs.tsx` plus `frontend/src/pages/advisor-lane-route-page.tsx`: advisor tab API client and route page
- `frontend/src/App.tsx` and `frontend/src/routes/phytosyncSections.ts`: route access to advisor lanes and preserved compatibility redirects
- `docs/architecture/` and `.rah/`: durable architecture and control-plane state

## Directive Inventory
- Primary requirement: find and repair backend/frontend integration gaps, not redesign the product shell
- Required preservation rules: no regression to `/api/models/*`, `/api/advisor/*`, `/api/rtr/*`, weather, market, crop switching, WebSocket simulation, or area-unit projection contracts
- Required route preservation: `/overview`, `/control`, `/trend`, `/crop-work`, `/resources`, `/alerts`, `/assistant`, `/settings`, `/rtr -> /control#control-strategy`, `/ask#... -> /assistant#...`
- Advisor lane requirement: existing AdvisorTabs backend integration must be reachable from app routes rather than remaining dead route-page code

## Gap Snapshot
- Confirmed: `useRtrOptimizer` persists `/api/rtr/area-settings` with frontend `CropType` casing while backend expects lowercase crop keys.
- Confirmed: RTR response types claim `CropType` even though backend RTR endpoints return normalized lowercase crop keys.
- Confirmed: RTR calibration-state/preview/save responses still exposed title-case profile crop keys while the new frontend API response type expects lowercase crop keys.
- Confirmed: frontend starts energy cost calculations with `0.15` while backend settings default to `120` KRW/kWh.
- Confirmed: `AdvisorLaneRoutePage` exists but `/growth`, `/nutrient`, `/protection`, and `/harvest` currently redirect away from the page, leaving `AdvisorTabs` backend calls unreachable from those routes.
- Confirmed: route helpers classify nested advisor aliases such as `/harvest/week`, but `App.tsx` only registered exact advisor paths.

## Earliest Gate Status
- AGENTS intake: passed
- Issue/branch linkage: passed
- Harness scaffold: passed
- Memento context/recall hydration: passed
- Backend/frontend interface recon: passed for phase 1
- Implementation gate: pass only for the confirmed repairs listed above

## Recommended Target Shape
- Normalize crop keys at backend/frontend boundaries where the API contract is lowercase.
- Keep frontend response types honest when backend payloads use lowercase API crop keys.
- Use KRW/kWh consistently for backend settings and frontend fallback calculations.
- Render the existing advisor lane route page for exact and nested advisor compatibility routes and protect the behavior with route tests.
