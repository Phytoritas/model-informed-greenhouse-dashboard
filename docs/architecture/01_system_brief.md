# System Brief

## Problem
The target repository is now the correct long-lived home for a model-informed greenhouse dashboard, the absorbed runtime has passed browser smoke, and the production bundle has been explicitly split into stable sub-500 kB chunks. The next architectural question is no longer bundle feasibility, but whether live OpenAI-backed behavior and minor frontend dependency hygiene matter for the next slice.

## Goal
Refactor the source dashboard into the target repository so that:

- Python backend runtime lives under the package-owned `src/` tree
- legacy crop models are isolated behind adapters
- config and data contracts are explicit
- API payloads and future frontend boundaries can speak in canonical dashboard terms
- validation can progress through bounded smoke tests instead of ad hoc manual checks

## Primary Actors
- greenhouse operator viewing current KPIs and forecast summaries
- backend service that ingests telemetry and runs crop-model-backed simulation steps
- adapter layer that translates legacy crop models into dashboard-facing state and KPI payloads
- future frontend workspace consuming backend payloads without importing model internals

## Source-To-Target Mapping
| Source surface | Target direction | Notes |
|---|---|---|
| `backend/app/main.py` | package-owned API runtime | keep FastAPI boundary, adapt import roots |
| `backend/app/adapters/*` | package-owned adapter layer | remove `sys.path` mutation and isolate legacy model imports |
| `backend/app/services/*` | package-owned service layer | preserve ingest, forecast, irrigation, energy, decision seams |
| `backend/app/schemas.py` | package-owned API schema module | keep response/request structure explicit |
| `src/TomatoModel.py`, `src/CucumberModel.py` | legacy model isolation layer | no blind rename; protect with adapter boundary |
| `config/greenhouse.yaml` | repo config contract | align with target repo config layout |
| `frontend/` | canonical UI workspace | source Vite app migrated into the target repo and validated locally |
| `frontend_legacy/` | reference only | keep out of the canonical migration path unless a specific UI surface is needed later |

## Target Module Boundary
- `legacy_models`: imported legacy crop models with minimal mechanical changes
- `adapters`: canonical bridge between legacy model state and dashboard payloads
- `services`: ingestion, forecasting, irrigation, energy, and decision logic
- `api`: FastAPI app, schemas, and websocket surfaces
- `configs`: tracked config contract used by the runtime
- `frontend`: canonical Vite consumer workspace now wired to the migrated backend contract

## Major Risks
1. Legacy model code may expose inconsistent symbol names that cannot leak into public contracts.
2. Optional OpenAI-backed features currently degrade gracefully without credentials, but a later slice may require explicit API-key provisioning and regression coverage for the live AI path.
3. Frontend dependency hygiene still includes a non-blocking `baseline-browser-mapping` update notice during lint/build.

## Delivered Migration Slice
- bootstrap harness files and architecture artifacts
- migrate backend runtime and legacy models into the package tree
- align config loading to the target repo conventions
- add backend-oriented smoke coverage for root, status, and crop-config/control contracts
- migrate the source `frontend/` Vite app into `frontend/`
- validate the frontend with local typecheck, lint, and production build
- pass a live browser smoke of the migrated FastAPI + Vite path, including crop switching and crop-config/control interactions
- split the frontend into lazy and vendor chunks so the Vite `>500 kB` warning is removed and the built preview still runs cleanly
