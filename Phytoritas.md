# Model-Informed Greenhouse Dashboard Blueprint

## Repository
- Repo root: `C:\Users\yhmoo\OneDrive\Phytoritas\projects\model-informed-greenhouse-dashboard`
- GitHub repo: `https://github.com/Phytoritas/model-informed-greenhouse-dashboard`
- Project name: `model-informed-greenhouse-dashboard`
- Package name: `model_informed_greenhouse_dashboard`
- Active issue: `#19`
- Active branch: `feat/19-implement-model-first-smartgrow-advisor-with-crop-physiology-gas-exchange-and-sensitivity-engines`
- Preserved baseline issue: `#18`

## Identity
This repository now carries three simultaneous truths:
- the validated dashboard runtime, WebSocket telemetry flow, weather/RTR/market panels, crop switching, and current AI consult/chat experience
- the landed SmartGrow knowledge, workbook, routed retrieval, and bounded advisor-tab surfaces from issue `#18`
- the new April 7, 2026 SmartGrow directive that changes the mainline from knowledge-first expansion to model-actuated advisory

The new mainline is `model-first, RAG-explained`.
Numerical judgment must come from crop physiology models, gas exchange, scenario simulation, local sensitivity, and constraint-aware recommendation.
Retrieval remains useful, but only as explanation, guardrail, and provenance support.

## Existing Baseline To Preserve
- `src/model_informed_greenhouse_dashboard/backend/app/main.py` already exposes the running FastAPI surface and current advisor routes
- `src/model_informed_greenhouse_dashboard/backend/app/services/knowledge_*` and `advisor_*` already provide the issue `#18` knowledge/advisory baseline
- `src/model_informed_greenhouse_dashboard/models/legacy/TomatoModel.py` and `src/model_informed_greenhouse_dashboard/models/legacy/CucumberModel.py` contain donor logic for crop growth and canopy physiology
- `frontend/src/components/advisor/` and related hooks already provide the current tab shell and execution workspace
- `tests/test_advisory.py`, `tests/test_advisor_orchestration.py`, `tests/test_knowledge_*`, and `tests/test_smoke.py` lock the current contracts

Issue `#19` must preserve that baseline while redirecting the architecture toward reusable crop-model and model-runtime services.

## Directive Summary
The new SmartGrow lane must eventually provide:
- cucumber growth simulation with thermal time, node/leaf development, rank-specific leaf area, LAI, source capacity, sink demand, dry-matter partitioning, defoliation state transitions, and 14-day event effects
- tomato growth simulation with truss cohorts, temperature-driven development, source-sink competition, fruit thinning events, and yield/size tradeoff trajectories
- coupled FvCB + Ball-Berry gas exchange with canopy integration across upper/middle/bottom or rank-specific layers
- scenario simulation, local sensitivity, trust-region handling, optimizer/constraint logic, and recommendation scoring
- event-sourced work metadata for `leaf_removal`, `fruit_thinning`, `harvest`, `pruning`, `training`, `pollination`, irrigation and climate-strategy changes
- model-aware advisor APIs and frontend tabs that show actions, tradeoffs, confidence, and counterfactual comparison without exposing raw provenance in the UI

## Source Of Truth
1. `Phytoritas.md`
2. GitHub issue `#19`
3. `docs/architecture/architecture/adrs/ADR-001-adopt-model-first-smartgrow-advisory.md`
4. `docs/architecture/architecture/module_specs/module-001-model-first-smartgrow-runtime.md`
5. `docs/architecture/00_workspace_audit.md`
6. `docs/architecture/01_system_brief.md`
7. `docs/architecture/gap_register.md`
8. Repo code and tests

Conflict rule:
- issue `#19` defines the new mainline
- issue `#18` defines the preserved knowledge/RAG/advisory baseline, not the next architecture center
- current runtime contracts stay authoritative until a new model-first contract is explicitly landed and validated
- `.rah/` must report the real gate state honestly even when older issue `#18` phases remain landed in code

## Non-Negotiables
- Do not break the current dashboard, WebSocket rendering, weather/RTR/market panels, crop switching, or existing AI consult/chat flows
- Do not let the LLM invent pesticide, nutrient, environment, or work recommendations that should come from deterministic engines
- Do not surface source citations or raw provenance IDs in the user-facing UI
- Do not promote a recommendation unless bounded scenario results, local sensitivity direction, and constraints agree
- Do not silently impute missing work metadata; lower confidence and ask follow-up questions instead
- Treat `leaf_removal` and `fruit_thinning` as state-transition events, not static copy text

## Target Architecture
### Backend services
- `backend/app/services/crop_models/`
  - `cucumber_growth_model.py`
  - `tomato_growth_model.py`
  - `gas_exchange_fvcb.py`
  - `stomatal_ball_berry.py`
  - `canopy_integration.py`
  - `dry_matter_partition.py`
  - `thermal_time.py`
- `backend/app/services/model_runtime/`
  - `model_state_store.py`
  - `scenario_runner.py`
  - `sensitivity_engine.py`
  - `optimizer.py`
  - `constraint_engine.py`
- `backend/app/services/advisory/`
  - `physiology_advisor.py`
  - `environment_advisor.py`
  - `work_tradeoff_advisor.py`
  - `harvest_advisor.py`
  - `explanation_builder.py`
- `backend/app/services/rag/`
  - `retriever.py`
  - `context_builder.py`
  - `assistant_router.py`

### Data and persistence targets
- `crop_model_states`
- `crop_model_snapshots`
- `crop_work_events`
- `gas_exchange_observations`
- `scenario_runs`
- `scenario_outputs`
- `sensitivity_outputs`
- `advisor_recommendations`
- `advisor_provenance`
- `assistant_sessions`

### API targets
- `POST /api/models/snapshot`
- `POST /api/models/replay`
- `POST /api/models/scenario`
- `POST /api/models/sensitivity`
- `POST /api/advisor/physiology`
- `POST /api/advisor/environment`
- `POST /api/advisor/work-tradeoff`
- `POST /api/advisor/harvest`
- `POST /api/advisor/chat`

## Phased Delivery
### Phase 0. Harness realignment
- open a new issue/branch for the model-first requirement
- rewrite blueprint, system brief, gap register, ADRs, module specs, and `.rah` state around issue `#19`
- freeze issue `#18` as a preserved baseline instead of the active architecture target

### Phase 1. Model state and work-event foundation
- wrap legacy tomato/cucumber models behind explicit service interfaces
- define canonical crop-model state payloads, snapshot contracts, and work-event schemas
- add a bounded `model_state_store` seam and explicit persistence-adapter contract
- define `leaf_removal` and `fruit_thinning` state transitions with confidence handling

### Phase 2. Gas exchange and runtime core
- extract reusable FvCB, Ball-Berry, and canopy-integration services
- add scenario runner, sensitivity engine, trust-region handling, and constraint surfaces
- expose `/api/models/*` routes and persist scenario/sensitivity outputs

### Phase 3. Advisor contract migration
- feed model runtime outputs into physiology, environment, work-tradeoff, harvest, and assistant flows
- keep current UI tabs as the shell, but replace pending or heuristic internals with model-backed payloads
- add counterfactual compare, sensitivity ranking, and action-card contracts

### Phase 4. Optimization and infrastructure promotion
- deepen optimizer/constraint logic
- promote persistence from the current bounded adapters toward the prompt's Postgres/pgvector/Redis target without invalidating earlier local validation
- expand regression coverage and operational docs

## Decision Gates
### Gate A. Issue and blueprint lock
- no new model-first implementation before issue `#19`, this blueprint, the new ADR, and the module spec all agree on scope

### Gate B. Baseline preservation lock
- issue `#18` knowledge/RAG/advisor surfaces are preserved as the compatibility baseline, not deleted or silently repurposed

### Gate C. Phase-1 foundation lock
- no scenario/sensitivity/UI expansion before canonical state payloads, work-event schemas, and the persistence-adapter contract exist

### Gate D. Model-first recommendation lock
- no recommendation is treated as production-ready until model outputs, bounded scenarios, local sensitivity, and constraint checks are all explicit

### Gate E. Validation lock
- every bounded slice must run the repo validation ladder and add targeted regression coverage for the new seam

## Validation Loop
- `poetry run ruff check .`
- `poetry run pytest`
- `npm --prefix frontend run lint`
- `npm --prefix frontend run build`
- targeted model/runtime tests for cucumber defoliation, tomato thinning, gas-exchange stability, sensitivity trust-region behavior, and advisor snapshot sharing

## Immediate Next Action
- Hold issue `#18` as the preserved knowledge/RAG baseline and do not continue its nutrient-calculator mainline on this issue
- Use ADR-001 and module-001 as the architecture boundary for issue `#19`
- Keep `implementation_blocked=true` until the phase-1 persistence-adapter choice and migration seam are frozen in code
- Then land the bounded phase-1 slice: `model_state_store`, crop snapshot schema, work-event schema, legacy model wrapper seams, and `/api/models/snapshot` plus `/api/models/replay` contracts before scenario/sensitivity or frontend expansion
