# System Brief

## Problem
The repository already contains a validated dashboard runtime and a landed issue `#18` SmartGrow baseline centered on knowledge ingestion, workbook-backed advisory seams, routed retrieval, and bounded advisor shells.
The new problem is different: the active mainline must move to model-actuated advisory, where crop physiology state, coupled gas exchange, bounded scenario simulation, local sensitivity, and constraint-aware logic drive recommendations while the existing knowledge layer becomes a supporting explanation surface.

## Goal
Extend the existing dashboard so that:
- cucumber and tomato recommendations are backed by explicit crop-model state and event transitions
- gas exchange, canopy integration, scenario, sensitivity, and constraint outputs become first-class backend surfaces
- environment, physiology, work-tradeoff, harvest, and assistant flows consume model outputs instead of knowledge-first heuristics
- the current dashboard and issue `#18` knowledge/RAG/advisor baseline remain stable throughout the migration

## Primary Actors
- greenhouse operator who needs actionable now/today/this-week recommendations
- model runtime that owns crop state, work events, scenarios, sensitivities, and constraints
- advisor layer that translates model outputs into actions and natural-language explanations
- retrieval layer that supplies bounded evidence and internal provenance without owning the primary recommendation
- frontend workspace that renders current tabs, action cards, and counterfactual comparisons without exposing raw provenance

## Source-To-Target Mapping
| Source surface | Target direction | Notes |
|---|---|---|
| `src/model_informed_greenhouse_dashboard/models/legacy/CucumberModel.py` | reusable cucumber crop-model service | donor logic for thermal time, LAI, canopy physiology, and defoliation effects; must be wrapped behind explicit state/event interfaces |
| `src/model_informed_greenhouse_dashboard/models/legacy/TomatoModel.py` | reusable tomato crop-model service | donor logic for truss development, source-sink behavior, canopy physiology, and fruit load; must be wrapped behind explicit cohort/event interfaces |
| `src/model_informed_greenhouse_dashboard/backend/app/services/advisory*.py` | preserved compatibility baseline | issue `#18` deterministic seams remain intact while the new advisor layer grows beside them |
| `src/model_informed_greenhouse_dashboard/backend/app/services/knowledge_*.py` | explanation and provenance sidecar | keep the landed knowledge DB, query routing, and context builders, but demote them from mainline recommendation ownership |
| `frontend/src/components/advisor/**` | model-aware advisor workspace shell | keep the existing tab shell, but replace pending and heuristic internals with model-backed payloads in later phases |
| `frontend/src/components/chat/RagAssistantDrawer.tsx` and `frontend/src/components/ChatAssistant.tsx` | model-aware assistant split | keep the current chat shell, but route explanation through model snapshots and scenario/sensitivity results |

## Target Module Boundary
- `crop_models`: cucumber and tomato model services plus reusable thermal-time, dry-matter, gas-exchange, stomatal, and canopy-integration helpers
- `model_runtime`: model-state store, event application, snapshot/replay, scenario runner, sensitivity engine, optimizer, and constraint engine
- `advisory`: physiology, environment, work-tradeoff, harvest, and explanation-builder services over model runtime outputs
- `rag`: bounded retriever/context-builder/router that augments explanation and provenance
- `frontend_model_surfaces`: environment, physiology, work-tradeoff, harvest, and assistant views fed by model-backed APIs

## Persistence And Contract Targets
### Tables
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

### APIs
- `POST /api/models/snapshot`
- `POST /api/models/replay`
- `POST /api/models/scenario`
- `POST /api/models/sensitivity`
- `POST /api/advisor/physiology`
- `POST /api/advisor/environment`
- `POST /api/advisor/work-tradeoff`
- `POST /api/advisor/harvest`
- `POST /api/advisor/chat`

## Major Risks
1. The current harness truth previously pointed to nutrient and retrieval follow-up work, so the architecture can drift unless the new issue `#19` state remains explicit.
2. Legacy crop-model code exists, but it is not yet exposed through the service boundaries, state schemas, or API contracts required by the new directive.
3. The existing frontend advisor tabs are useful shells, but they still reflect issue `#18` semantics and must not be mislabeled as model-backed until the runtime is real.
4. Recommendations that skip scenario agreement, local sensitivity, or constraint checks would violate the new directive even if the UI looks polished.

## First Bounded Delivery Slice For Issue #19
- keep issue `#18` knowledge/RAG/advisor seams as the preserved baseline
- add explicit `crop_models/` and `model_runtime/` package boundaries without rewriting the rest of the backend
- define canonical state payloads for cucumber and tomato, including `leaf_removal` and `fruit_thinning` event schemas
- add a bounded `model_state_store` contract plus a frozen choice for the phase-1 persistence adapter
- expose `/api/models/snapshot` and `/api/models/replay` contracts before scenario/sensitivity or UI expansion
- add targeted tests for state transitions and snapshot compatibility

## Phase-1 Landing Status
- The phase-1 persistence adapter is now frozen as a dedicated SQLite sidecar at `artifacts/models/model_runtime.sqlite3`.
- Raw adapter `dump_state()` payloads remain the authoritative migration seam, and versioned normalized snapshots are now stored beside them for replay and later advisor/runtime promotion.
- `POST /api/models/snapshot` and `POST /api/models/replay` are live additive contracts and are covered by targeted cucumber/tomato replay tests.

## Deferred Until Later Phases
- full scenario optimization and ranking across all control axes
- full UI counterfactual compare, sensitivity charts, and trust-region mini-graphs
- final Postgres/pgvector/Redis promotion
- broader nutrient/pesticide calculator expansion beyond the preserved issue `#18` baseline
