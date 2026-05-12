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

Windows PowerShell:

```powershell
.\start_all.bat
.\start_all.bat check
```

macOS, Linux, WSL, or Git Bash:

```bash
chmod +x scripts/start_all.sh
./scripts/start_all.sh
./scripts/start_all.sh check
```

- In PowerShell, use `.\start_all.bat`; PowerShell does not execute files from the current directory without the explicit `.\` prefix.
- `.\start_all.bat` opens separate backend/frontend windows on Windows and installs missing dependencies on first run.
- `./scripts/start_all.sh` provides the same workflow for macOS, Linux, WSL, or Git Bash. If execute permissions are unavailable, use `bash scripts/start_all.sh` instead.
- `.\start_all.bat check` or `./scripts/start_all.sh check` validates the launcher prerequisites without starting servers.
- If you switch between Windows and WSL/Git Bash, the launcher now tries to repair the current platform's Rollup native package automatically and only falls back to a clean `node_modules` reinstall when that repair is insufficient.
- The launcher now clears stale listeners on ports `8000` and `5173` before starting fresh backend/frontend processes, so route mismatches such as `/api/weather/daegu` returning `404 Not Found` from an older backend should not persist across relaunches.
- RTR steering profiles now live in `configs/rtr_profiles.json`, and you can recalibrate their baseline prior from local history with `poetry run python scripts/calibrate_rtr.py --windows configs/rtr_good_windows.yaml`.
