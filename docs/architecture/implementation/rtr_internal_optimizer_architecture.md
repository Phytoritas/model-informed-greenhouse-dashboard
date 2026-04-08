# RTR Internal Optimizer Architecture Note

## Purpose
Record the landed issue `#27` plus issue `#41` RTR control redesign that replaces the old radiation-line-first interpretation with an actuator-first internal crop-energy optimizer while preserving `/api/rtr/profiles` compatibility.

## Baseline RTR vs Optimized RTR
- `configs/rtr_profiles.json` and `GET /api/rtr/profiles` remain the backward-compatible baseline prior and fallback surface.
- The active control path is now:
  1. build canonical RTR state from repository-internal model/runtime/energy services
  2. choose actuator candidates for heating, cooling, ventilation, screen, circulation fan, and CO2
  3. derive a post-control greenhouse microclimate from those actuator candidates
  4. re-run crop, energy, labor, and yield terms against that post-control state
  5. solve for the minimum sufficient coordinated control that satisfies node progression and guardrails
  6. derive RTR-equivalent summary metrics from that optimizer result
- RTR ratio is therefore a derived summary metric, not the optimizer decision variable.

## Control Semantics Before / After
### Before
- day and night minimum temperature were the main optimizer variables
- vent and screen outputs were largely derived as auxiliary heuristics after the thermal solve
- scenario and sensitivity surfaces mostly explained temperature deltas around a baseline prior

### After
- heating, cooling, ventilation, thermal screen, circulation fan, and CO2 target are first-class actuator candidates
- every candidate passes through `actuator_bridge -> post_control_state -> crop_bridge -> objective_terms`
- the optimizer now chooses control recommendations on the basis of post-control microclimate, crop response, energy cost, labor pressure, and yield trend
- temperature delta versus baseline is still shown, but only as a summary of the chosen control lane rather than the control primitive itself

## Internal Model Components Used
- `services/rtr/internal_model_bridge.py`
  - normalizes crop/runtime snapshots into a canonical RTR state
- `services/rtr/actuator_bridge.py`
  - coordinates actuator candidates and builds the post-control control-effect trace
- `services/rtr/control_effects.py`
  - computes actuator-level microclimate deltas for heating, cooling, ventilation, screen, circulation, and CO2
- `services/rtr/post_control_state.py`
  - turns pre-control state plus actuator candidates into the post-control canonical environment and energy state
- `services/rtr/crop_bridge.py`
  - replays crop-specific internal model semantics against the post-control state
- `services/rtr/node_target_engine.py`
  - converts user-entered target node development into optimizer-facing target terms
- `services/rtr/objective_terms.py`
  - decomposes assimilation gain, respiration cost, carbon margin, sink pressure, humidity/disease/stress risk, energy, labor, and yield terms
- `services/rtr/labor_estimator.py`
  - converts post-control node, fruit-load, and canopy-management pressure into labor indices and optional cost terms
- `services/rtr/lagrangian_optimizer.py`
  - performs the bounded actuator-first two-stage optimization
- `services/rtr/scenario_runner.py`
  - compares baseline, HVAC, vent/screen, and optimizer-selected operating modes around the optimized solution
- `services/rtr/rtr_deriver.py`
  - converts optimized temperatures back into narrow RTR-equivalent summaries
- `services/rtr/unit_projection.py`
  - keeps m² canonical and produces actual-area totals without changing the canonical model path
- `services/energy.py`
  - remains the energy-cost source instead of duplicating greenhouse energy formulas inside RTR

## Objective Function Summary
The optimizer minimizes an actuator-first objective:

`J = -AssimGain + RespCost + NodePenalty + CarbonMarginPenalty + HeatingEnergyCost + CoolingEnergyCost + VentilationEnergyCost + LaborPenalty + YieldPenalty + HumidityPenalty + DiseasePenalty + StressPenalty`

Implemented weights and switches let the same structure run in:
- `balanced`
- `yield_priority`
- `energy_priority`
- `labor_priority`
- `cooling_saving`
- `heating_saving`

Operationally, the optimizer answers:
- what coordinated heating/cooling/vent/screen/fan/CO2 lane is sufficient for the requested node-development rate
- whether that lane still keeps carbon margin and crop balance acceptable
- how much extra respiration, energy, labor pressure, humidity risk, and yield opportunity cost that choice implies

## Crop-Specific Logic Summary
### Cucumber
- uses leaf-rank aware canopy structure from the landed cucumber model wrapper
- carries source capacity, sink demand, remaining leaves, leaf-area-by-rank, upper/middle/bottom activity, and leaf-rank absorption into the RTR state
- re-evaluates leaf-rank-aware canopy contribution after post-control temperature, humidity, VPD, and CO2 changes
- interprets recent leaf-removal state as a source-side constraint rather than blindly raising temperature

### Tomato
- uses truss-cohort and fruit-load information from the landed tomato model wrapper
- carries source capacity, sink demand, active trusses, fruit partition ratio, and recent thinning state into the RTR state
- keeps whole-canopy and truss-cohort semantics intact while replaying them against the post-control state
- interprets thinning as sink relief that can reduce the need for temperature elevation under the same node target

## API Contracts
- `GET /api/rtr/profiles`
  - backward-compatible baseline profile payload with optimizer metadata
- `GET /api/rtr/state`
  - current canonical RTR state, baseline RTR, actuator availability, optimizer defaults, control-effect trace, risk flags, and area-unit metadata
- `POST /api/rtr/optimize`
  - structured optimizer result including chosen controls, objective breakdown, feasibility, node/carbon/energy/labor/yield summaries, control-effect trace, unit projection, and explanation payload
- `POST /api/rtr/scenario`
  - baseline, HVAC, vent/screen, and optimizer-selected comparisons around the current control lane
- `POST /api/rtr/sensitivity`
  - finite-difference derivative surface across heating, cooling, vent, screen, circulation fan, CO2, and node target inputs
- `POST /api/rtr/area-settings`
  - additive persistence seam for greenhouse or user area defaults

## UI Changes
- `RTROptimizerPanel` replaces the old RTR panel as the primary RTR decision surface
- `RTROutlookPanel` remains only as the baseline/fallback comparison card
- `AreaUnitContext` and `AreaUnitPanel` let the grower enter actual area while preserving canonical m² calculations
- the panel now emphasizes:
  - target vs predicted node rate
  - recommended heating and cooling lane
  - delta vs baseline
  - gain/loss trade-off
  - crop-specific bottlenecks
  - grouped baseline, HVAC, vent/screen, and optimizer comparisons
  - control-effect traces, energy split, labor summary, and actual-area totals

## Unit Conversion Rule
- canonical computation remains in m²
- actual-area projection is deterministic display logic only
- `1 평 = 3.305785 m²`
- actual-area totals must never feed back into the canonical model calculations

## Validation Status
The landed issue `#41` actuator-first slice is locally green with:
- `npm --prefix frontend run test`
- `npm --prefix frontend run lint`
- `npm --prefix frontend run build`
- `poetry run ruff check .`
- `poetry run pytest`

## Remaining Risks / Next Calibration Steps
- optimizer weights and bounds are still starter values
- grower-approved good-production windows still need to replace demo windows
- greenhouse/user area defaults still need promotion beyond the additive current seam
- house-specific actuator availability and cooling-capability metadata still need calibration tightening
- a future MPC-style horizon controller remains optional follow-up work after the landed daily actuator-first controller is calibrated
