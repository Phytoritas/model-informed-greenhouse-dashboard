# Workspace Audit

## Mode
- Harness mode: `hybrid`
- Setup scope: `project`
- Active issue: `#114`
- Active branch: `fix/114-post-issue112-backend-frontend-integration-audit`
- Preserved merged baseline: post-issue112 `main` with SmartGrow runtime, routed shell, RTR optimizer, advisor, knowledge, weather, and market surfaces intact

## Target Repository Profile
- Repo type: Python-first greenhouse dashboard with Poetry packaging and a Vite frontend
- Current runtime maturity: backend/frontend runtime, model-first SmartGrow services, advisor routes, knowledge search, market price fallback, and RTR optimizer are already landed
- Active expansion mode: post-issue112 backend/frontend integration repair; no product IA rewrite
- Existing quality gates: `npm --prefix frontend run lint`, `npm --prefix frontend run test`, `npm --prefix frontend run build`, `poetry run ruff check .`, `poetry run pytest`

## Current Target Inventory
- `src/model_informed_greenhouse_dashboard/backend/app/main.py`: FastAPI route surface for simulation, settings, knowledge, advisor, RTR, weather, market, and WebSocket endpoints
- `src/model_informed_greenhouse_dashboard/backend/app/services/advisor_orchestration.py`: tab normalization and orchestration entrypoint metadata
- `src/model_informed_greenhouse_dashboard/backend/app/services/knowledge_catalog.py`: SmartGrow advisory surface catalog metadata
- `src/model_informed_greenhouse_dashboard/backend/app/services/produce_prices.py`: KAMIS live/sample/fallback source contract
- `frontend/src/App.tsx`: route access and compatibility redirects
- `frontend/src/components/advisor/advisorTabRegistry.ts` and `frontend/src/hooks/useSmartGrowAdvisor.ts`: advisor tab route vocabulary and API execution
- `frontend/src/components/ProducePricesPanel.tsx` and `frontend/src/types.ts`: produce price payload contract and fallback display
- `docs/architecture/` and `.rah/`: durable architecture and control-plane state

## Directive Inventory
- Primary requirement: find and repair backend/frontend integration gaps after issue `#112`, not redesign the product shell
- Required preservation rules: no regression to `/api/models/*`, `/api/advisor/*`, `/api/rtr/*`, weather, market, crop switching, WebSocket simulation, or area-unit projection contracts
- Required route preservation: `/overview`, `/control`, `/trend`, `/crop-work`, `/resources`, `/alerts`, `/assistant`, `/settings`, `/rtr -> /control#control-strategy`, `/ask#... -> /assistant#...`, `/ask/*#... -> /assistant#...`
- Advisor lane requirement: frontend and backend should advertise one canonical advisor-tab route vocabulary while preserving accepted aliases

## Gap Snapshot
- Confirmed: `/ask/search` and `/ask/history` were classified by route helpers but fell through to `/overview` because `App.tsx` only registered exact `/ask`.
- Confirmed: backend crop normalization was partly inline and route-specific, so title-case or whitespace crop inputs could pass one route and fail another.
- Confirmed: harvest-market advisor metadata used both `/api/advisor/tab/harvest-market` and `/api/advisor/tab/harvest_market`.
- Confirmed: frontend SmartGrow advisor execution duplicated tab endpoint maps instead of using the registry source of truth.
- Confirmed: backend produce-price fallback is a successful degraded payload, but frontend types and panel copy hid `auth_mode="fallback"` and fallback reason.

## Earliest Gate Status
- AGENTS intake: passed
- Issue/branch linkage: passed
- Harness scaffold: passed
- Memento context/recall hydration: passed
- Backend/frontend interface recon: passed for phase 1
- Implementation gate: pass only for the confirmed repairs listed above

## Recommended Target Shape
- Normalize crop keys once at backend API boundaries and use normalized keys for state lookup/service calls.
- Keep `/ask` compatibility broad enough to cover nested aliases while preserving assistant hash intent.
- Use canonical hyphenated harvest-market public routes in advertised metadata, with underscore retained only as an accepted backend alias.
- Surface market fallback/degraded state as an explicit UI source status rather than a normal live snapshot.
