# Implementation Gate Checklist

Implementation for issue `#112` is allowed only for confirmed backend/frontend connection gaps.

- [x] Active issue `#112` and issue-based branch `fix/112-backend-frontend-integration-audit-and-repair` exist.
- [x] Repo-local `AGENTS.md` and skill harness intake are complete.
- [x] Memento `context()` and narrow `recall()` were run before implementation.
- [x] Backend route inventory and frontend fetch/WebSocket inventory were reviewed.
- [x] Confirmed gap 1: RTR area-settings persistence sends frontend crop casing while backend expects lowercase crop keys.
- [x] Confirmed gap 2: RTR response crop fields are typed as UI `CropType` while backend returns lowercase API crop keys.
- [x] Confirmed gap 3: RTR calibration response envelopes returned title-case profile crop keys while frontend API response types expect lowercase crop keys.
- [x] Confirmed gap 4: frontend fallback energy price is `0.15` while backend settings default is `120` KRW/kWh.
- [x] Confirmed gap 5: `AdvisorLaneRoutePage` exists but advisor compatibility routes redirect away from it, making `AdvisorTabs` backend calls unreachable from those routes.
- [x] Confirmed gap 6: nested advisor aliases are recognized by route helpers but not registered in `App.tsx`.
- [x] Existing `/api/models/*`, `/api/advisor/*`, `/api/rtr/*`, weather, market, crop switching, WebSocket, `/ask`, `/rtr`, and `/legacy` compatibility contracts are preservation constraints.

## Pass Rule
The issue `#112` implementation gate passes for one bounded repair phase:

- normalize RTR area-settings crop casing at the frontend request boundary and tolerate frontend-style casing at the backend endpoint
- align RTR response crop typing, calibration response envelopes, and focused frontend/backend fixtures
- align frontend fallback `cost_per_kwh` with backend KRW/kWh defaults
- render existing advisor lane pages for exact and nested `/growth`, `/nutrient`, `/protection`, and `/harvest` aliases
- add focused frontend/backend tests for the repaired contracts

It does not authorize:

- broad FastAPI response-model conversion
- a generated OpenAPI client migration
- redesigning the shell or changing visible navigation hierarchy
- wiring local quick-control toggles to new actuator endpoints
- changing `/ask`, `/rtr`, or `/legacy` compatibility without explicit regression coverage

## Current Assessment
- Backend and frontend route paths mostly match.
- The most concrete live break is `/api/rtr/area-settings` persistence because crop casing can produce a backend `400`.
- The largest route-access break is the disconnected advisor lane page: backend advisor tab endpoints exist and the client hook exists, but app routes redirect away from the UI that calls them.
- The energy-cost mismatch is a unit drift that can cause displayed cost to jump when settings load.
- Validation must cover targeted frontend hooks, route tests, backend RTR endpoint behavior, then the repo ladder.
