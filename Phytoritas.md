# Model-Informed Greenhouse Dashboard Blueprint

## Repository
- Repo root: `C:\Users\yhmoo\OneDrive\Phytoritas\projects\model-informed-greenhouse-dashboard`
- GitHub repo: `https://github.com/Phytoritas/model-informed-greenhouse-dashboard`
- Project name: `model-informed-greenhouse-dashboard`
- Package name: `model_informed_greenhouse_dashboard`
- Active issue: `#3`
- Active branch: `feat/3-replace-concept-demo-rtr-windows-with-grower-approved-periods`

## Identity
This repository hosts a model-informed greenhouse dashboard that combines greenhouse telemetry, crop-state model outputs, and decision-friendly summaries in one reproducible workspace.

The current refactor intake source is `C:\Users\yhmoo\OneDrive\Model\10_Projects\10_AI_Platform\dashboard-eng_1.1`, which provides a working greenhouse dashboard backend, legacy crop models, and a Vite-based frontend. The target repository must absorb that project into the current blueprint, package conventions, and validation ladder instead of copying the source tree verbatim.

The first objective is still not a production deployment. The first objective is to lock the dashboard scope, data contracts, model-context seams, migration boundaries, and validation loop before broad UI or integration work begins.

## Source Intake
- Source project: `dashboard-eng_1.1`
- Source runtime surfaces:
  - FastAPI backend for simulation, forecasting, irrigation, energy, and decision APIs
  - Standalone tomato and cucumber model implementations
  - Vite frontend for dashboard UI
  - Legacy Next.js frontend kept only as reference, not as the primary migration target
- Canonical frontend path: source `frontend/` (Vite React app)
- Migration principle:
  - preserve working service boundaries where they are defensible
  - isolate legacy model code behind adapters
  - translate pathing, config layout, and package imports into this repository's structure
  - localize presentation aliases so canonical model symbols stay at adapter boundaries

## Operating Boundary
Blueprint artifacts come before broad implementation. Until the first implementation gate passes, the repository may add:
- architecture and planning documents
- harness runtime state under `.rah/`
- glossary and canonical IO definitions
- package, API, and service scaffolds
- bounded smoke tests and fixtures

It may not:
- hard-code greenhouse-specific business logic without an explicit contract
- blindly mirror the source project directory layout if it conflicts with repo conventions
- mix core model symbols with UI-only aliases outside adapter boundaries
- promise live integrations, alerting workflows, or deployment behavior before the contracts exist

## Source Of Truth
1. `Phytoritas.md`
2. `docs/architecture/00_workspace_audit.md`
3. `docs/architecture/01_system_brief.md`
4. `docs/canonical_io.md`
5. `docs/variable_glossary.md`
6. Repo code and tests

Conflict rule:
- explicit data contracts override ad hoc notebook or dashboard assumptions
- model-layer canonical names override presentation aliases at the adapter boundary
- architecture artifacts under `docs/architecture/` explain migration intent; `.rah/` only tracks runtime control state

## Stage Goals
1. Audit the current scaffold repo and the source project, then record the migration deltas explicitly.
2. Establish the target package, API, config, and frontend boundaries before broad file import.
3. Migrate the Python backend runtime and legacy crop models into a package-safe structure.
4. Define canonical input and output contracts for telemetry, model results, thresholds, and summaries.
5. Land the first bounded dashboard slice with representative smoke coverage.
6. Land the canonical frontend workspace once the backend and contracts are stable enough to validate against.
7. Close the loop with browser-level integration smoke and any follow-up chunking or UI hardening that smoke reveals.

## Decision Gates
### Gate A. Source intake lock
- Do not treat the source project as ready to copy until its modules, configs, and runtime assumptions are inventoried.

### Gate B. Contract lock
- Do not begin broad implementation before telemetry, model, and dashboard contracts are explicit.

### Gate C. Naming lock
- Model-layer symbols follow the workspace glossary rules.
- Legacy model names may remain inside isolated legacy modules, but adapter outputs and public contracts must use the canonical vocabulary.
- UI aliases stay localized to adapter or presenter boundaries.

### Gate D. Boundary lock
- Model computation, aggregation, and presentation remain separated.
- Backend runtime migration must preserve explicit seams between ingestion, adapters, services, API schemas, and UI-facing payloads.

### Gate E. Validation lock
- Each bounded slice must ship with at least one smoke test or regression check.

## Validation Loop
- `frontend tsc -b`
- `frontend eslint`
- `frontend vite build`
- `poetry run pytest`
- `poetry run ruff check .`
- Add one representative dashboard smoke path before opening large UI work.
- Track browser-level UI smoke as a separate gate after frontend build validation lands.
- Update README and docs whenever the architecture or contract changes.

## Recursive Improvement Cycle
1. Compare the current repo state against the blueprint and the source-project intake delta.
2. Update docs, gate state, or glossary before broad code changes.
3. Implement the smallest deterministic slice that closes the earliest migration gap.
4. Add or expand smoke coverage.
5. Re-run quality checks and record the next unresolved gap.

## Immediate Next Action
- Issues `#6` / `#8` / `#10` and PRs `#7` / `#9` / `#11` are complete, so the active follow-up loop returns to issue `#3` and branch `feat/3-replace-concept-demo-rtr-windows-with-grower-approved-periods`.
- The synced issue `#3` branch now carries the merged KAMIS live produce price panel, the 14-day actual + 3y/5y/10y seasonal-normal trend overlay, the issue `#10` fallback/labeling hardening, and the latest CI/runtime maintenance.
- The earliest pending gate is still external input quality: wait for grower-approved good-production periods, then replace the concept-demo windows in `configs/rtr_good_windows.yaml` and rerun `poetry run python scripts/calibrate_rtr.py --windows configs/rtr_good_windows.yaml --output configs/rtr_profiles.json` with a syntactically valid grower window file.
- After the regenerated RTR profile payload lands, rerun a representative RTR browser smoke; if the AI prompt or dashboard context contract changes again during that follow-up slice, rerun a representative live consult/chat smoke as well.
