# System Brief

## Problem
The repository already has a functional FastAPI backend and a Vite frontend, but several backend/frontend connection seams drifted after the routed-shell work.
The active issue is not a visual redesign; it is contract alignment between frontend hooks/routes and backend API behavior.

## Goal
Repair issue `#112` so that:
- frontend calls use the backend's lowercase crop contract for RTR persistence
- RTR response typing reflects backend payloads instead of pretending all crop fields are UI `CropType`
- RTR calibration responses expose lowercase API crop keys while preserving title-case profile display fields inside profile objects
- frontend fallback energy-cost calculations use the same KRW/kWh unit as backend settings
- the existing advisor tab backend integration is reachable through exact and nested app routes

## Primary Actors
- greenhouse operator who needs direct page navigation and clear operating lanes
- frontend hooks that call backend simulation, RTR, advisor, knowledge, weather, and market endpoints
- FastAPI backend route handlers that own runtime state and response payloads
- route shell that decides whether advisor backend surfaces are reachable or dead code
- `.rah` harness state that must describe the active issue truth

## Source-To-Target Mapping
| Source surface | Target direction | Notes |
|---|---|---|
| `frontend/src/hooks/useRtrOptimizer.ts` area persistence | POST lowercase `crop` to `/api/rtr/area-settings` | all other RTR request payloads already use `cropKey` |
| `src/.../backend/app/main.py` area-settings route | tolerate frontend-style crop casing at this boundary | keeps old local UI state from failing silently |
| `frontend/src/types.ts` RTR response crop fields | type backend RTR crop fields as lowercase API keys | avoids latent type drift |
| `src/.../backend/app/main.py` RTR calibration routes | return lowercase API crop keys for state/preview/save envelopes | profile payloads can still keep title-case profile labels |
| `frontend/src/hooks/useGreenhouse.ts` cost fallback | KRW/kWh default aligned with backend `GET /api/settings` | prevents unit jump before settings load |
| `frontend/src/App.tsx` advisor compatibility routes | render `AdvisorLaneRoutePage` for exact and nested advisor aliases | makes `AdvisorTabs` API calls reachable |

## Target Module Boundary
- `api_contract`: `backend/app/main.py`, `frontend/src/config.ts`, `frontend/src/types.ts`
- `runtime_hooks`: `useGreenhouse.ts`, `useRtrOptimizer.ts`, `useSmartGrowAdvisor.ts`
- `advisor_route_access`: `App.tsx`, `phytosyncSections.ts`, `advisor-lane-route-page.tsx`, `AdvisorTabs.tsx`
- `tests`: `useRtrOptimizer.test.tsx`, `useGreenhouse.test.tsx`, `App.routing.test.tsx`, backend smoke/RTR tests

## Contract Targets
- `/api/rtr/area-settings` accepts saved area overrides from frontend area-unit state and returns lowercase `crop`.
- `/api/rtr/state|optimize|scenario|sensitivity|calibration-state|calibration-preview|calibration-save` response crop fields are treated as backend API crop keys.
- `cost_per_kwh` is interpreted as KRW/kWh across backend defaults and frontend fallback calculations.
- `/growth`, `/growth/*`, `/nutrient`, `/nutrient/*`, `/protection`, `/protection/*`, `/harvest`, and `/harvest/*` expose advisor lane tabs instead of bypassing them.
- Existing `/ask#...`, `/rtr`, and `/legacy` redirects remain preserved.

## Major Risks
1. Fixing advisor routes can accidentally break old compatibility expectations if `/ask`, `/rtr`, or `/legacy` redirects are touched.
2. Changing RTR crop response typing can expose existing test fixtures that used UI crop names for backend payloads.
3. Backend tolerance for uppercase crop inputs should stay narrow and not hide invalid crop names.
4. Full response-model hardening is larger than this phase and should not be mixed into the bounded repair.

## Current Bounded Delivery Slice
- update architecture/control-plane state to issue `#112`
- patch RTR area-settings crop casing on frontend and backend
- align RTR response crop typing, calibration envelopes, and focused fixtures
- align frontend fallback energy-cost unit with backend settings
- reconnect exact and nested advisor lane routes and add route regressions

## Deferred Until Later Phases
- response models for every large backend payload
- a complete generated OpenAPI-to-TypeScript contract
- wiring quick control toggles to real backend actuator endpoints
- replacing `alert()`-style local error handling in legacy crop config components
