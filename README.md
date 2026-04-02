# model-informed-greenhouse-dashboard

## Purpose
- Build a model-informed greenhouse dashboard that combines greenhouse telemetry, crop-state model outputs, and decision-friendly summaries in one reproducible workspace.

## Inputs
- Greenhouse telemetry, environment and control logs, and derived feature tables.
- Model outputs, scenario runs, thresholds, and configuration files that define the dashboard contract.

## Outputs
- Dashboard-ready data products, model-context summaries, and validation-friendly artifacts.
- Documentation for canonical inputs, outputs, and operating assumptions.

## How to run
```bash
poetry install
poetry run pytest
poetry run ruff check .
```

## Current status
- Bootstrapped with Poetry, workspace GitHub helpers, and the initial project blueprint.

## Next validation
- Define the first bounded data contract and add one representative smoke test for the initial dashboard slice.
