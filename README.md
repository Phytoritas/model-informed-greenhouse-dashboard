# model-informed-greenhouse-dashboard

## Purpose
- Build a model-informed greenhouse dashboard that combines greenhouse telemetry, crop-state model outputs, and decision-friendly summaries in one reproducible workspace.

## Inputs
- Greenhouse telemetry, environment and control logs, and derived feature tables.
- Model outputs, scenario runs, thresholds, and configuration files that define the dashboard contract.
- Local sample environment fixtures under `data/Tomato_Env.CSV` and `data/Cucumber_Env.CSV`.
- Frontend runtime configuration through `frontend/env.example` and an optional `frontend/.env`.
- Backend AI runtime configuration through the repo-root `.env` file, typically copied from `.env.example`.

## Outputs
- Dashboard-ready data products, model-context summaries, and validation-friendly artifacts.
- Documentation for canonical inputs, outputs, and operating assumptions.

## How to run
```bash
poetry install
cd frontend
npm install
cd ..
poetry run python -m model_informed_greenhouse_dashboard.backend.app.main
cd frontend
npm run dev
cd ..
npm run --prefix frontend build
npm run --prefix frontend lint
poetry run pytest
poetry run ruff check .
```

Quick launcher:

```powershell
.\start_all.bat
.\start_all.bat check
```

```bash
bash scripts/start_all.sh
bash scripts/start_all.sh check
```

- In PowerShell, use `.\start_all.bat`; PowerShell does not execute files from the current directory without the explicit `.\` prefix.
- `.\start_all.bat` opens separate backend/frontend windows on Windows and installs missing dependencies on first run.
- `bash scripts/start_all.sh` provides the same workflow for Git Bash, WSL, or Unix-like shells.
- `.\start_all.bat check` or `bash scripts/start_all.sh check` validates the launcher prerequisites without starting servers.
- If you switch between Windows and WSL/Git Bash, the launcher now tries to repair the current platform's Rollup native package automatically and only falls back to a clean `node_modules` reinstall when that repair is insufficient.
- The launcher now clears stale listeners on ports `8000` and `5173` before starting fresh backend/frontend processes, so route mismatches such as `/api/weather/daegu` returning `404 Not Found` from an older backend should not persist across relaunches.
- RTR steering profiles now live in `configs/rtr_profiles.json`, and you can recalibrate their baseline prior from local history with `poetry run python scripts/calibrate_rtr.py --windows configs/rtr_good_windows.yaml`.
- GitHub Actions CI now mirrors the local validation ladder in `.github/workflows/ci.yml` by running Poetry `ruff`/`pytest` plus frontend `lint`/`build` on pushes and pull requests.

## Current status
- Harness bootstrap is complete under `docs/architecture/` and `.rah/`.
- The backend runtime and legacy crop models from `dashboard-eng_1.1` now live under `src/model_informed_greenhouse_dashboard/`.
- The source `frontend/` Vite workspace has been migrated into `frontend/` and validated with typecheck, lint, and production build.
- Crop-scoped control/config endpoints now preserve per-crop state instead of falling back to the source project's shared-state assumptions.
- A live browser smoke passed against `http://127.0.0.1:8000` + `http://127.0.0.1:4173`, including crop switching, tomato config update, cucumber prune, and dashboard rendering.
- The production bundle has been split into smaller lazy/vendor chunks, the previous `>500 kB` Vite warning is gone, and a built-preview browser smoke passed with zero runtime console errors.
- The backend AI helper now uses the OpenAI Responses API, and live AI responses require `OPENAI_API_KEY` in the repo-root `.env` or backend process environment.
- `/api/status` now reports replay completion explicitly, and the frontend automatically restarts a crop simulation when the prior replay has already reached the end of its dataset.
- RTR baseline profiles remain available through `/api/rtr/profiles`, but the active RTR recommendation path now uses the internal-model-only optimizer exposed by `/api/rtr/state|optimize|scenario|sensitivity|area-settings`.
- The RTR dashboard surface now shows optimizer-derived minimum sufficient temperatures, baseline-vs-optimized RTR equivalent, crop-specific source/sink insight, scenario comparison, and actual-area projections while keeping the legacy `RTROutlookPanel` only as a baseline/fallback comparison card.
- Canonical RTR, yield, and energy calculations now stay in m² units, while the dashboard can project the same outputs onto grower-entered actual area through the shared area-unit context and `AreaUnitPanel`.
- Curated good-production windows still have a dedicated input contract at `configs/rtr_good_windows.yaml`, while `configs/rtr_profiles.json` remains the runtime/output artifact for baseline priors plus optimizer metadata.
- Live OpenAI validation passed for the current prompt contract, but RTR explanation is now expected to describe structured optimizer payloads rather than inventing setpoints from free-text heuristics.
- The KAMIS produce panel now overlays a trailing 14-day actual series plus forward 14-day seasonal normals computed from the prior 3, 5, and 10 years for tomato and cucumber retail items.
- The SmartGrow corpus now persists through `/api/knowledge/reindex` into a local SQLite knowledge DB under `artifacts/knowledge/`, with normalized document/chunk/entity tables plus telemetry, pesticide, and nutrient workbook tables.
- `/api/knowledge/status` and the crop-scoped AI knowledge context now surface database readiness, table counts, and chunk coverage in addition to the existing catalog and workbook-preview metadata.
- The landed `environment` and `work` advisor tabs now share a common `advisor_actions` horizon contract and expose richer deterministic `operating_mode` / `risk_flags` state so the next mainline can deepen rule-engine behavior before pushing denser retrieval.
- The deterministic pesticide seam now fails closed on cross-crop target queries, enriches rotation rows from the product master, returns registered-first unique-MOA rotation programs with explicit manual-review flags plus rotation-level mixing cautions, and surfaces that safety burden through `/api/knowledge/status`.
- The deterministic nutrient correction seam now rejects negative mmol/L inputs, keeps partial-input drafts provisional or blocked, rechecks guardrails after macro-bundle assembly, and surfaces bundle-execution review plus calculator defaults in the correction UI and `/api/knowledge/status`.
- The deterministic nutrient correction seam now also turns submitted drain deviations into bounded next-step nutrient targets for supported analytes, threads those effective targets into stock-tank preparation, and surfaces the drain-feedback planner state through both the correction UI and `/api/knowledge/status`.
- The deterministic nutrient correction seam now also surfaces a residual-safe macro-bundle alternative when the selected bundle overshoots modeled targets, so growers can compare the current bundle with a safer below-target alternative without silently changing the selected bundle.

## Next validation
- Replace the current demo RTR windows in `configs/rtr_good_windows.yaml` with grower-approved good-production periods, then recalibrate the baseline prior and optimizer bounds against those windows before tightening default temperature deltas.
- Tune crop-specific optimizer weights, risk bounds, and labor/energy coefficients against house data now that the internal-model-only RTR optimizer surface is live.
- Promote greenhouse/user area defaults from the current additive `area-settings` seam into the long-term house configuration path once grower-approved area metadata is available.
