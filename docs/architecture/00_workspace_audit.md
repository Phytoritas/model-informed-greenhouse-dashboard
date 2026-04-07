# Workspace Audit

## Mode
- Harness mode: `hybrid`
- Setup scope: `project`
- Active issue: `#19`
- Active branch: `feat/19-implement-model-first-smartgrow-advisor-with-crop-physiology-gas-exchange-and-sensitivity-engines`
- Preserved baseline issue: `#18`

## Target Repository Profile
- Repo type: Python-first greenhouse dashboard with Poetry packaging and a migrated Vite frontend
- Current runtime maturity: backend/frontend runtime, knowledge database, routed retrieval, bounded advisor orchestration, and deterministic workbook-backed seams are already landed
- Active expansion mode: model-first SmartGrow harness realignment for crop physiology, gas exchange, scenario/sensitivity, and work-event state
- Existing quality gates: `npm --prefix frontend run lint`, `npm --prefix frontend run build`, `poetry run pytest`, `poetry run ruff check .`

## Current Target Inventory
- `src/model_informed_greenhouse_dashboard/backend/app/**`: current FastAPI runtime and landed knowledge/advisory seams
- `src/model_informed_greenhouse_dashboard/models/legacy/**`: tomato and cucumber donor logic for physiology and canopy modeling
- `frontend/**`: current dashboard UI, existing advisor tabs, and execution workspace shells
- `data/*.CSV`: local tomato/cucumber telemetry fixtures
- `data/*.PDF`: tomato and cucumber agronomy references
- `data/*.xlsx`: pesticide and nutrient workbooks from issue `#18`
- `tests/test_advisory.py`, `tests/test_advisor_orchestration.py`, `tests/test_knowledge_*`, `tests/test_smoke.py`: current baseline contract coverage
- `docs/variable_glossary.md`, `docs/legacy_name_mapping.md`, `docs/canonical_io.md`: canonical naming and I/O references
- `docs/architecture/` and `.rah/`: durable architecture and control-plane surfaces

## New Directive Inventory
- Primary requirement: model-actuated SmartGrow advisor where recommendations come from crop models, gas exchange, bounded scenarios, local sensitivity, and constraints
- Required crop-model state surfaces: cucumber source/sink and defoliation events, tomato truss/cohort and fruit-thinning events
- Required runtime surfaces: scenario runner, sensitivity engine, optimizer/constraint engine, model state store, work-event history
- Required UI surfaces: environment, physiology, work-tradeoff, harvest, and model-aware assistant with counterfactual comparison and confidence handling
- Required persistence targets: crop-model state/snapshot/event/scenario/sensitivity/advisor tables

## Gap Snapshot
- Landed and reusable: current dashboard context, legacy models, knowledge/advisory baseline, bounded advisor tab shells
- Missing as first-class services: `crop_models/`, `model_runtime/`, dedicated model-state/event store, `/api/models/*` contracts, trust-region sensitivity logic, and model-aware tradeoff UI contracts
- Misalignment repaired in this loop: the old issue `#18` blueprint and `.rah` state no longer represent the active architecture target

## Earliest Gate Status
- AGENTS intake: passed
- New issue/branch linkage: passed
- Harness scaffold: passed
- Model-first prompt intake: passed
- Blueprint/system-brief/ADR/module-spec alignment: passed
- Existing runtime baseline preservation: passed
- Implementation gate for issue `#19`: blocked

## Recommended Target Shape
- Keep the issue `#18` code as the preserved compatibility baseline
- Use legacy tomato/cucumber models as donor logic, but wrap them behind new `crop_models/` interfaces
- Use `docs/architecture/` for durable design reasoning and `.rah/` for honest runtime state
- Make model state higher priority than retrieval context
- Keep retrieval as explanation/provenance support, not as the primary recommendation engine
- Land the phase-1 model-state and work-event foundation before scenario/sensitivity or frontend counterfactual expansion
