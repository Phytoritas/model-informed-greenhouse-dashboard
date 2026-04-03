# Module Spec: Architecture Pipeline

## Purpose
Define the first stable migration pipeline from source-project intake to package-owned dashboard runtime.

## Inputs
- source backend modules under `dashboard-eng_1.1/backend/app`
- source legacy crop models under `dashboard-eng_1.1/src`
- source greenhouse config under `dashboard-eng_1.1/config/greenhouse.yaml`
- target repo blueprint and canonical naming docs

## Outputs
- package-owned backend runtime inside `src/model_informed_greenhouse_dashboard/`
- tracked runtime config in the target repo
- smoke tests for the first migrated backend slice
- staged frontend migration plan

## Boundary Rules
- legacy model internals stay behind adapters
- package imports must replace `sys.path` mutation
- config loading must resolve through repo-owned paths
- public payloads must prefer canonical vocabulary where reasonable

## First Slice
1. migrate backend runtime and legacy models
2. verify config loading and import stability
3. add backend smoke coverage
4. record remaining frontend work as the next loop
