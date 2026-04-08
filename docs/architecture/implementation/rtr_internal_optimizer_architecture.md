# RTR Internal Optimizer Architecture Note

## Purpose
Record the issue `#27` RTR control redesign that replaces the old radiation-line-first interpretation with an internal-model-only optimizer while preserving `/api/rtr/profiles` compatibility.

## Baseline RTR vs Optimized RTR
- `configs/rtr_profiles.json` and `GET /api/rtr/profiles` remain the backward-compatible baseline prior and fallback surface.
- The active control path is now:
  1. build canonical RTR state from repository-internal model/runtime/energy services
  2. solve for the minimum sufficient day/night temperature targets that satisfy node progression and guardrails
  3. derive RTR-equivalent summary metrics from that optimizer result
- RTR ratio is therefore a derived summary metric, not the optimizer decision variable.

## Internal Model Components Used
- `services/rtr/internal_model_bridge.py`
  - normalizes crop/runtime snapshots into a canonical RTR state
- `services/rtr/node_target_engine.py`
  - converts user-entered target node development into optimizer-facing target terms
- `services/rtr/objective_terms.py`
  - decomposes assimilation gain, respiration cost, carbon margin, sink pressure, risk, energy, and labor terms
- `services/rtr/lagrangian_optimizer.py`
  - performs the bounded internal-model-only optimization
- `services/rtr/scenario_runner.py`
  - compares baseline and named operating modes around the optimized solution
- `services/rtr/rtr_deriver.py`
  - converts optimized temperatures back into narrow RTR-equivalent summaries
- `services/rtr/unit_projection.py`
  - keeps m² canonical and produces actual-area totals without changing the canonical model path
- `services/energy.py`
  - remains the energy-cost source instead of duplicating greenhouse energy formulas inside RTR

## Objective Function Summary
The optimizer minimizes a temperature-first objective with penalties for:
- node target deficit
- negative carbon margin
- sink overload
- respiration cost
- climate risk
- optional energy cost
- optional labor pressure

Operationally, the optimizer answers:
- what minimum day/night temperature is sufficient for the requested node-development rate
- whether that temperature still keeps carbon margin and crop balance acceptable
- how much extra respiration, energy, and labor pressure that choice implies

## Crop-Specific Logic Summary
### Cucumber
- uses leaf-rank aware canopy structure from the landed cucumber model wrapper
- carries source capacity, sink demand, remaining leaves, leaf-area-by-rank, and upper/middle/bottom activity into the RTR state
- interprets recent leaf-removal state as a source-side constraint rather than blindly raising temperature

### Tomato
- uses truss-cohort and fruit-load information from the landed tomato model wrapper
- carries source capacity, sink demand, active trusses, fruit partition ratio, and recent thinning state into the RTR state
- interprets thinning as sink relief that can reduce the need for temperature elevation under the same node target

## API Contracts
- `GET /api/rtr/profiles`
  - backward-compatible baseline profile payload with optimizer metadata
- `GET /api/rtr/state`
  - current canonical RTR state, baseline RTR, optimizer availability, and area-unit metadata
- `POST /api/rtr/optimize`
  - structured optimizer result including optimal targets, objective breakdown, feasibility, unit projection, and explanation payload
- `POST /api/rtr/scenario`
  - baseline plus named mode comparisons around the current optimizer lane
- `POST /api/rtr/sensitivity`
  - bounded local derivative and sensitivity explanation surface
- `POST /api/rtr/area-settings`
  - additive persistence seam for greenhouse or user area defaults

## UI Changes
- `RTROptimizerPanel` replaces the old RTR panel as the primary RTR decision surface
- `RTROutlookPanel` remains only as the baseline/fallback comparison card
- `AreaUnitContext` and `AreaUnitPanel` let the grower enter actual area while preserving canonical m² calculations
- the panel now emphasizes:
  - target vs predicted node rate
  - recommended mean/day/night temperature
  - delta vs baseline
  - gain/loss trade-off
  - crop-specific bottlenecks
  - scenario comparisons

## Unit Conversion Rule
- canonical computation remains in m²
- actual-area projection is deterministic display logic only
- `1 평 = 3.305785 m²`
- actual-area totals must never feed back into the canonical model calculations

## Validation Status
The landed issue `#27` slice is locally green with:
- `npm --prefix frontend run test`
- `npm --prefix frontend run lint`
- `npm --prefix frontend run build`
- `poetry run ruff check .`
- `poetry run pytest`

## Remaining Risks / Next Calibration Steps
- optimizer weights and bounds are still starter values
- grower-approved good-production windows still need to replace demo windows
- greenhouse/user area defaults still need promotion beyond the additive current seam
- actuator-depth and MPC-style sequencing remain separate follow-up work
