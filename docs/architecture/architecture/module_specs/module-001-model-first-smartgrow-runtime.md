# Module-001: Model-First SmartGrow Runtime

## Purpose
Define the bounded phase-1 implementation boundary for issue `#19`.
This module spec is intentionally smaller than the full directive.
It freezes the first code slice needed before scenario, sensitivity, or frontend counterfactual work can begin safely.

## Phase-1 Scope
### Packages
- `backend/app/services/crop_models/`
- `backend/app/services/model_runtime/`

### Required files
- `crop_models/cucumber_growth_model.py`
- `crop_models/tomato_growth_model.py`
- `crop_models/thermal_time.py`
- `model_runtime/model_state_store.py`

### Current phase-1 landing
- `crop_models/cucumber_growth_model.py`
- `crop_models/tomato_growth_model.py`
- `model_runtime/model_state_store.py`
- additive `/api/models/snapshot` and `/api/models/replay` contracts in `backend/app/main.py`

### Canonical state responsibilities
- cucumber state tracks stage, days after transplant, cumulative thermal time, node count, leaf count, leaf area by rank, LAI, vegetative dry matter, fruit dry matter, harvested fruit dry matter, fruit load, crop growth efficiency, source capacity, and sink demand
- tomato state tracks stage, cumulative thermal time, truss cohort development, fruit load by cohort, source-sink balance, crop growth efficiency, and yield trajectory
- work events include `leaf_removal` and `fruit_thinning` with greenhouse, crop, event time, operator, confidence, and before/after snapshot linkage

## Interfaces
### `ModelStateStore`
- load latest state by greenhouse and crop
- persist state snapshot
- persist work event
- replay work events over a bounded horizon

### `CucumberGrowthModel`
- initialize state from telemetry and crop config
- apply `leaf_removal` event
- step state forward over a bounded horizon

### `TomatoGrowthModel`
- initialize state from telemetry and crop config
- apply `fruit_thinning` event
- step state forward over a bounded horizon

## API Boundary For Phase 1
- `POST /api/models/snapshot`
  - capture the current canonical crop-model state for a greenhouse and crop
- `POST /api/models/replay`
  - replay bounded state transitions over recorded work events

Phase 1 does not yet include:
- scenario ranking
- sensitivity outputs
- optimizer or constraint engines
- frontend counterfactual compare UI

## Persistence Strategy
The full directive targets PostgreSQL + pgvector + Redis.
Phase 1 is now frozen to a bounded local SQLite sidecar at `artifacts/models/model_runtime.sqlite3`.
The code keeps the target state/event tables and runtime contract explicit even though the first adapter is smaller than the final PostgreSQL/Redis target.

## Compatibility Rules
- do not break current `/api/ai/*`, `/api/advisor/*`, `/api/knowledge/*`, weather, RTR, market, or dashboard runtime flows
- do not delete or repurpose issue `#18` knowledge/RAG surfaces as part of the phase-1 foundation
- keep model outputs and provenance internal until a model-backed advisor layer is ready to consume them

## Validation Signals
- unit tests for cucumber `leaf_removal` state transitions
- unit tests for tomato `fruit_thinning` state transitions
- snapshot persistence and replay tests
- repo validation ladder: `poetry run ruff check .`, `poetry run pytest`, `npm --prefix frontend run lint`, `npm --prefix frontend run build`
