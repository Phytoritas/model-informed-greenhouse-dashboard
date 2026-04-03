# Workspace Audit

## Mode
- Harness mode: `hybrid`
- Setup scope: `project`
- Active issue: `#1`
- Active branch: `feat/1-refactor-current-repo-around-dashboard-eng-1-1-architecture`

## Target Repository Profile
- Repo type: Python-first scaffold repository with Poetry packaging
- Current runtime maturity: backend and frontend migration slices landed, validated, and browser-smoked
- Existing quality gates: `frontend tsc -b`, `frontend eslint`, `frontend vite build`, `poetry run pytest`, `poetry run ruff check .`
- Existing executable code: package-owned FastAPI backend runtime, legacy model isolation layer, migrated Vite dashboard UI, and endpoint smoke tests

## Current Target Inventory
- `src/model_informed_greenhouse_dashboard/backend/app/**`: migrated backend runtime slice
- `src/model_informed_greenhouse_dashboard/models/legacy/**`: isolated legacy crop models
- `frontend/**`: migrated Vite React dashboard workspace
- `data/*.CSV`: local sample environment fixtures copied from the source project
- `tests/test_smoke.py`: backend root/status/config smoke coverage
- `docs/canonical_io.md`, `docs/variable_glossary.md`, `docs/legacy_name_mapping.md`: canonical vocabulary and I/O contract seeds
- `scripts/*.ps1`: GitHub helper scripts already aligned with the workspace
- `docs/architecture/`: present and acting as the architecture spine
- `.rah/`: present and acting as the harness control-plane sidecar

## Source Project Inventory
- Source root: `C:\Users\yhmoo\OneDrive\Model\10_Projects\10_AI_Platform\대시보드-eng_1.1`
- Backend: `backend/app/**` with FastAPI, adapters, services, schemas, and websocket manager
- Legacy models: `src/TomatoModel.py`, `src/CucumberModel.py`
- Config: `config/greenhouse.yaml`
- Frontend: `frontend/` Vite React app
- Legacy frontend reference: `frontend_legacy/` Next.js app

## Migration Delta
- Target repo has the correct project shell, naming docs, and GitHub workflow helpers.
- Source project had the actual dashboard runtime, but its layout was not package-safe for the target repo as-is.
- The migrated target adapters now use package imports instead of `sys.path` mutation.
- Runtime config now resolves through the target repo's `configs/` convention.
- The canonical UI path is now fixed to the source `frontend/` Vite app.
- The migrated UI now targets the package-owned backend URL contract and passes local typecheck/lint/build validation.
- Crop operations/config endpoints now keep per-crop state instead of relying on the source project's shared mutable defaults.

## Earliest Gate Status
- Issue/branch linkage: repaired
- Harness scaffold: initialized
- Architecture intake: recorded
- Implementation gate: passed for the first backend slice
- Frontend scope: canonical path selected as source `frontend/`
- Frontend migration: implemented and validated
- Browser integration smoke: passed
- Bundle review: passed

## Recommended Target Shape
- Keep the repo root blueprint as the primary decision document.
- Use `docs/architecture/` for durable migration reasoning and `/.rah/` for harness runtime state.
- Migrate the backend and legacy models into `src/model_informed_greenhouse_dashboard/` as package-owned code.
- Use the migrated `frontend/` Vite app as the canonical UI workspace.
- Treat optional AI credential wiring and minor frontend dependency hygiene as the next follow-up phase.
