# Implementation Gate Checklist

Implementation for issue `#27` is allowed only when the following items are explicit:

- [x] Active issue and issue-based branch exist for the RTR optimizer overhaul
- [x] Root blueprint and architecture mirror are realigned around issue `#27`
- [x] `/api/rtr/profiles` compatibility and `configs/rtr_profiles.json` preservation rules are explicit
- [x] Internal-model-only RTR bridge, objective, optimizer, scenario, derivation, and area-projection boundaries are explicit in code
- [x] Canonical m² plus actual-area projection rules are explicit
- [x] Additive `/api/rtr/state|optimize|scenario|sensitivity|area-settings` contracts are landed or spike-validated
- [x] Frontend fallback plan keeps the legacy RTR panel as baseline comparison instead of deleting it
- [x] Validation ladder and RTR-targeted backend/frontend tests are explicit

## Pass Rule
The issue `#27` implementation gate now passes for the bounded internal-model-only RTR optimizer slice.
That pass authorizes:

- optimizer-backed RTR setpoint calculation through repo-internal model/runtime/energy services
- canonical m² + actual-area projection UI
- additive `/api/rtr/*` contracts and frontend optimizer rendering
- structured optimizer explanation payloads that AI can only describe, not recompute

It does not yet authorize:

- claiming grower-approved calibration of the optimizer weights or bounds
- replacing the demo good-production windows with production-ready window selections
- promoting the current day/night setpoint optimizer into a full MPC or actuator-execution controller

## Current Assessment
- The backend RTR lane is landed through `services/rtr/`, `/api/rtr/*`, and compatible `rtr_profiles` loading.
- The frontend RTR lane is landed through `AreaUnitContext`, `AreaUnitPanel`, `useRtrOptimizer`, and `RTROptimizerPanel`, while preserving `RTROutlookPanel` as the baseline/fallback compare card.
- Canonical area math no longer depends on the old hardcoded `AREA_M2 = 3305.8` path for RTR-facing projections.
- The local validation ladder is now fully green for issue `#27`: `npm --prefix frontend run test`, `npm --prefix frontend run lint`, `npm --prefix frontend run build`, `poetry run ruff check .`, and `poetry run pytest`.
- The next bounded phase is delivery and calibration, not more foundational implementation: commit/push/PR first, then grower-approved window tuning and house-specific optimizer calibration.
