# Model-Informed Greenhouse Dashboard Blueprint

## Repository
- Repo root: `C:\Users\yhmoo\OneDrive\Phytoritas\projects\model-informed-greenhouse-dashboard`
- GitHub repo: `https://github.com/Phytoritas/model-informed-greenhouse-dashboard`
- Project name: `model-informed-greenhouse-dashboard`
- Package name: `model_informed_greenhouse_dashboard`
- Active issue: none yet
- Active branch: `main`

## Identity
This repository hosts a model-informed greenhouse dashboard that combines greenhouse telemetry, crop-state model outputs, and decision-friendly summaries in one reproducible workspace.

The first objective is not a production deployment. The first objective is to lock the dashboard scope, data contracts, model-context seams, and validation loop before broad UI or integration work begins.

## Operating Boundary
Blueprint artifacts come before broad implementation. Until the first implementation gate passes, the repository may add:
- architecture and planning documents
- glossary and canonical IO definitions
- package and module scaffolds
- bounded smoke tests and fixtures

It may not:
- hard-code greenhouse-specific business logic without an explicit contract
- mix core model symbols with UI-only aliases outside adapter boundaries
- promise live integrations, alerting workflows, or deployment behavior before the contracts exist

## Source Of Truth
1. `Phytoritas.md`
2. `README.md`
3. `docs/canonical_io.md`
4. `docs/variable_glossary.md`
5. Repo code and tests

Conflict rule:
- explicit data contracts override ad hoc notebook or dashboard assumptions
- model-layer canonical names override presentation aliases at the adapter boundary

## Stage Goals
1. Lock dashboard scope, user workflow, and model-context surfaces.
2. Define canonical input and output contracts for telemetry, model results, thresholds, and summaries.
3. Build the first bounded ingestion and normalization slice.
4. Add a model-context service layer that turns raw outputs into dashboard-ready summaries.
5. Implement the initial dashboard slice around one core workflow.
6. Add smoke checks, representative fixtures, and deployment notes.

## Decision Gates
### Gate A. Contract lock
- Do not begin broad implementation before telemetry, model, and dashboard contracts are explicit.

### Gate B. Naming lock
- Model-layer symbols follow the workspace glossary rules.
- UI aliases stay localized to adapter or presenter boundaries.

### Gate C. Boundary lock
- Model computation, aggregation, and presentation remain separated.

### Gate D. Validation lock
- Each bounded slice must ship with at least one smoke test or regression check.

## Validation Loop
- `poetry run pytest`
- `poetry run ruff check .`
- Add one representative dashboard smoke path before opening large UI work.
- Update README and docs whenever the architecture or contract changes.

## Recursive Improvement Cycle
1. Compare the current repo state against the blueprint and the next missing contract.
2. Update docs or glossary before broad code changes.
3. Implement the smallest deterministic slice that closes the earliest gap.
4. Add or expand smoke coverage.
5. Re-run quality checks and record the next unresolved gap.

## Immediate Next Action
Define the first architecture slice: dashboard user story, canonical data contracts, and the minimum smoke-testable ingestion and presentation path.
