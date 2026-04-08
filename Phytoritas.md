# Model-Informed Greenhouse Dashboard Blueprint

## Repository
- Repo root: `C:\Users\yhmoo\OneDrive\Phytoritas\projects\model-informed-greenhouse-dashboard`
- GitHub repo: `https://github.com/Phytoritas/model-informed-greenhouse-dashboard`
- Project name: `model-informed-greenhouse-dashboard`
- Package name: `model_informed_greenhouse_dashboard`
- Active issue: `#27`
- Active branch: `feat/27-overhaul-rtr-around-internal-model-optimizer-and-area-aware-projections`
- Preserved merged baselines: issues `#19`, `#23`, `#25`

## Identity
This repository now carries four simultaneous truths:
- the validated dashboard runtime, WebSocket telemetry flow, weather/RTR/market panels, crop switching, and current AI consult/chat experience
- the merged model-first SmartGrow runtime from issue `#19`, including crop models, model-runtime persistence, scenarios, sensitivities, and model-aware advisor shells
- the merged frontend stabilization and grower-facing copy baseline from issues `#23` and `#25`
- the new issue `#27` RTR directive that demotes the old radiation-line RTR into a baseline prior and replaces the main RTR recommendation path with an internal-model-only optimizer

The active mainline for this loop is:
- internal-model-only RTR optimization
- minimum sufficient temperature first
- RTR ratio as a derived summary, not a primary control target
- canonical m² computation with actual-area projection as a deterministic display layer

## Existing Baseline To Preserve
- Keep the current dashboard runtime, WebSocket rendering, weather/RTR/market panels, crop switching, and AI consult/chat flows stable
- Keep the landed model-first SmartGrow services and `/api/models/*` plus `/api/advisor/*` surfaces as the donor computation stack for RTR
- Keep `configs/rtr_profiles.json` and `/api/rtr/profiles` backward compatible for baseline lines and old profile consumers
- Keep the legacy `RTROutlookPanel` available only as a baseline/fallback comparison card rather than the primary RTR recommendation surface

## Directive Summary
Issue `#27` must overhaul RTR so that:
- the code uses only repository-internal crop, canopy, gas-exchange, growth, and energy services for RTR setpoint recommendations
- the user enters a target node-development rate per day
- the system finds the minimum feasible day/night temperature targets that satisfy node progression without violating carbon margin, sink balance, risk, and optional energy/labor penalties
- the optimizer output is then converted into a narrow RTR-equivalent summary for comparison only
- all canonical outputs remain in m² units, while grower-entered actual area is used only for parallel projection

## Source Of Truth
1. `Phytoritas.md`
2. GitHub issue `#27`
3. `README.md`
4. `docs/architecture/Phytoritas.md`
5. `docs/architecture/implementation/implementation_gate_checklist.md`
6. `docs/architecture/implementation/rtr_internal_optimizer_architecture.md`
7. `docs/architecture/gap_register.md`
8. `.rah/state/status.json`
9. `.rah/state/gates.json`
10. Repo code and tests

## Non-Negotiables
- Do not let RTR setpoints depend on external literature or RAG heuristics in the control path
- Do not break the current dashboard, weather panel, market panel, AI consult/chat, or crop switching
- Do not remove `/api/rtr/profiles` compatibility
- Do not treat RTR ratio as the optimization decision variable
- Do not mix canonical m² calculations with actual-area totals in the core model path
- Do not let AI invent setpoints that differ from the structured backend optimizer payload

## Target Architecture
### Backend RTR services
- `backend/app/services/rtr/internal_model_bridge.py`
- `backend/app/services/rtr/node_target_engine.py`
- `backend/app/services/rtr/objective_terms.py`
- `backend/app/services/rtr/lagrangian_optimizer.py`
- `backend/app/services/rtr/scenario_runner.py`
- `backend/app/services/rtr/rtr_deriver.py`
- `backend/app/services/rtr/unit_projection.py`
- `backend/app/services/rtr/controller_contract.py`

### Frontend RTR surfaces
- `frontend/src/context/AreaUnitContext.tsx`
- `frontend/src/components/AreaUnitPanel.tsx`
- `frontend/src/hooks/useRtrOptimizer.ts`
- `frontend/src/components/RTROptimizerPanel.tsx`
- existing `RTROutlookPanel.tsx` preserved as baseline/fallback compare

### API targets
- `GET /api/rtr/profiles`
- `GET /api/rtr/state`
- `POST /api/rtr/optimize`
- `POST /api/rtr/scenario`
- `POST /api/rtr/sensitivity`
- `POST /api/rtr/area-settings`

## Phased Delivery
### Phase 0. Intake and baseline lock
- bind issue `#27` and issue-based branch
- preserve `/api/rtr/profiles` compatibility and current dashboard runtime
- keep issue `#19` model runtime as the computation donor layer

### Phase 1. Backend optimizer lane
- add the internal-model bridge, node target engine, objective terms, optimizer, scenario runner, RTR derivation, and area projection
- normalize additive `/api/rtr/*` contracts without breaking older profile consumers

### Phase 2. Frontend optimizer lane
- replace the old RTR primary panel with an optimizer-driven surface
- add area-unit context and actual-area projection
- demote the legacy RTR panel to baseline/fallback compare

### Phase 3. Validation and calibration lane
- lock backend/frontend tests and smoke coverage
- tune weights and bounds against house data
- replace demo windows with grower-approved good-production windows

## Decision Gates
### Gate A. Compatibility lock
- `/api/rtr/profiles` and `configs/rtr_profiles.json` remain backward compatible

### Gate B. Internal-model lock
- optimization uses only repo-internal crop/runtime/energy services for control calculations

### Gate C. Area-unit lock
- m² remains canonical and actual-area totals stay projection-only

### Gate D. Optimizer-output lock
- the UI and AI describe structured optimizer outputs instead of recomputing setpoints from prose

### Gate E. Validation lock
- backend and frontend ladders plus RTR-targeted tests must pass before PR/merge

## Validation Loop
- `npm --prefix frontend run test`
- `npm --prefix frontend run lint`
- `npm --prefix frontend run build`
- `poetry run ruff check .`
- `poetry run pytest`

## Immediate Next Action
- Commit the landed issue `#27` backend/frontend optimizer slice
- Push the issue branch and open the PR
- Watch remote Backend/Frontend validation
- Use the next loop for calibration follow-up: grower-approved RTR windows, optimizer weight tuning, and deeper house-specific constraint alignment
