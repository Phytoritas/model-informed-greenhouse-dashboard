# System Brief

## Problem
Issue `#112` closed the first backend/frontend integration repair phase. A post-merge audit found smaller but concrete drifts where route helpers, backend crop handling, advisor metadata, and market fallback presentation no longer described the same contract.

## Goal
Repair issue `#114` so that:
- nested `/ask/*` compatibility links reach the assistant instead of falling through to overview
- backend route handlers normalize crop keys consistently before runtime state lookup or service calls
- advisor tab metadata uses one canonical frontend/backend route vocabulary for landed tabs
- the backend market-price fallback contract is represented in frontend types and visible UI state
- issue `#112` repairs stay preserved

## Primary Actors
- greenhouse operator who expects old assistant links and advisor lanes to stay navigable
- frontend route shell and hooks that call backend simulation, RTR, advisor, knowledge, weather, and market endpoints
- FastAPI backend route handlers that own runtime state and response payloads
- SmartGrow catalog/orchestration metadata that may be consumed by UI or assistant tooling
- `.rah` harness state that must describe the active issue truth

## Source-To-Target Mapping
| Source surface | Target direction | Notes |
|---|---|---|
| `frontend/src/App.tsx` `/ask` route | register `/ask/*` redirect to `/assistant` | preserves `ask-chat`, `ask-search`, and nested legacy links |
| `src/.../backend/app/main.py` crop validator | normalize `strip().lower()` once and use returned crop keys | keeps valid title-case/whitespace inputs from producing inconsistent state lookups |
| `frontend/src/components/advisor/advisorTabRegistry.ts` | expose the canonical advisor tab endpoint map | avoids duplicate planned-tab route maps in hooks |
| `frontend/src/hooks/useSmartGrowAdvisor.ts` | execute planned tabs from registry endpoints | locks harvest-market to the public hyphenated route |
| `src/.../advisor_orchestration.py` | advertise `/api/advisor/tab/harvest-market` for harvest-market | underscore remains accepted through tab normalization |
| `src/.../knowledge_catalog.py` | add delegate routes for quick tools and canonical harvest-market route | catalog metadata now matches frontend execution routes |
| `frontend/src/types.ts` and `ProducePricesPanel.tsx` | model and display `auth_mode="fallback"` with reason/status | degraded fallback payloads no longer look like normal live KAMIS data |

## Target Module Boundary
- `api_contract`: `backend/app/main.py`, `frontend/src/types.ts`
- `route_compatibility`: `frontend/src/App.tsx`, `frontend/src/App.routing.test.tsx`
- `advisor_route_metadata`: `advisorTabRegistry.ts`, `useSmartGrowAdvisor.ts`, `advisor_orchestration.py`, `knowledge_catalog.py`
- `market_fallback_ui`: `ProducePricesPanel.tsx`, `ProducePricesPanel.test.tsx`, `useProducePrices.ts`
- `tests`: focused frontend route/hook/component tests and backend smoke/advisory/RTR/model-runtime tests

## Contract Targets
- `/ask`, `/ask/search`, and `/ask/history` redirect to `/assistant` while preserving hash intent.
- `/api/knowledge/status`, `/api/advisor/tab/*`, `/api/overview/signals`, `/api/rtr/state`, and related backend surfaces accept valid title-case/whitespace crop inputs and operate on normalized lowercase crop keys.
- `/api/advisor/tab/harvest-market` is the canonical advertised public harvest-market route; `/api/advisor/tab/harvest_market` remains accepted as an alias.
- SmartGrow catalog entries expose `delegate_route` values that match the tab execution surface.
- `ProducePricesPayload.source.auth_mode` includes `fallback`, and the UI shows fallback/degraded source status with the backend reason.

## Major Risks
1. Broad crop normalization can introduce hidden behavior changes if a handler validates but still uses raw crop strings.
2. Advisor route metadata must keep existing direct endpoint compatibility while clarifying tab delegate routes.
3. Produce fallback UI should not imply live KAMIS data when the backend deliberately returned cached/sample fallback.
4. Generated API-client or response-model work is larger than this phase and should not be mixed into the bounded repair.

## Current Bounded Delivery Slice
- update architecture/control-plane state to issue `#114`
- patch `/ask/*` route compatibility
- centralize backend crop normalization and assign normalized values before state access
- align advisor registry/hook/catalog/orchestration route metadata
- extend produce price fallback frontend typing and source-status display
- add focused frontend/backend regression coverage

## Deferred Until Later Phases
- generated OpenAPI-to-TypeScript client
- complete FastAPI response-model hardening
- real actuator quick-control endpoints and rollback-aware mutation state
- backend-provided simulation default dataset/timestep endpoint
