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

## Deploying with the same answer quality (knowledge DB provisioning)

The advisor's answer quality is backed by a SmartGrow knowledge database at
`artifacts/knowledge/*.sqlite3` (plus `knowledge_catalog_*.json`). That directory is
**gitignored on purpose**: the DB is a large, license-bound build artifact (it is derived
from source material under `data/`), so committing it would redistribute copyrighted /
internal content and permanently bloat history. Because it is not in git, a fresh deploy
would start with no knowledge and give weaker answers than your local instance.

To give every deployed instance the *same* answers without committing the data, publish
the DB to a **private** store and pull it in at deploy time with
`scripts/provision_knowledge_db.py`.

1. Build the DB locally (the app rebuilds it from `data/` on demand), then hash it:

   ```bash
   poetry run python scripts/provision_knowledge_db.py build-manifest
   ```

   This writes `artifacts/knowledge/knowledge_db_manifest.json` (file names, sizes, and
   sha256 only — it does not describe the contents).

2. Upload the `knowledge_db_*.sqlite3` files, the `knowledge_catalog_*.json` files, and
   the manifest to a private store you control: a mounted secret volume, private object
   storage, or a **private** GitHub Release asset. Never a public URL.

3. On deploy, point the app at a provisioned directory and materialize the DB before the
   backend starts:

   ```bash
   export KNOWLEDGE_DB_DIR=/var/lib/smartgrow/knowledge
   # A mounted directory, a file:// path, or a private https base URL:
   export KNOWLEDGE_DB_SOURCE=https://private.example/knowledge
   export KNOWLEDGE_DB_TOKEN=...   # only for a private https source
   poetry run python scripts/provision_knowledge_db.py provision
   ```

   `provision` reads the manifest, downloads each listed file into `KNOWLEDGE_DB_DIR`,
   and verifies size + sha256. It is idempotent (an already-current file is skipped) and
   fail-closed (a checksum mismatch aborts and leaves no partial file).

`KNOWLEDGE_DB_DIR` defaults to `<repo>/artifacts/knowledge`, so local development is
unchanged. Regardless of what a provisioned DB contains, the runtime `corpus_quarantine`
layer still excludes quarantined families from served answers.

## macOS setup guide (step by step)

A detailed first-run walkthrough for Apple users. Every step is copy-paste ready for Terminal.

### 1. Install the toolchain (one time)

```bash
# Xcode command-line tools (compilers used by Python/Node packages)
xcode-select --install

# Homebrew (skip if `brew --version` already works)
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# pyenv for the pinned Python, plus Node.js
brew install pyenv node

# Poetry (dependency manager for the backend)
curl -sSL https://install.python-poetry.org | python3 -
```

Add pyenv to your shell profile once (`~/.zshrc` on modern macOS), then restart Terminal:

```bash
echo 'eval "$(pyenv init -)"' >> ~/.zshrc
```

Version notes: the repo pins Python `3.12.3` via `.python-version`, and the frontend (Vite 7) needs Node `20.19+` or `22.12+` — `brew install node` satisfies this.

### 2. Clone and install dependencies

```bash
git clone <repository-url>
cd model-informed-greenhouse-dashboard

# Python 3.12.3 exactly as pinned
pyenv install 3.12.3 --skip-existing

# Backend dependencies into an in-project .venv (poetry.toml already opts in)
poetry install

# Frontend dependencies
npm install --prefix frontend
```

### 3. Configure environment files (optional but recommended)

```bash
# Backend: AI assistant + KAMIS produce-price keys.
# The app runs without OPENAI_API_KEY; assistant answers are then unavailable.
cp .env.example .env

# Frontend: only needed if you want to override API endpoints.
cp frontend/env.example frontend/.env
```

### 4. Run it

Option A — one command (recommended):

```bash
chmod +x scripts/start_all.sh   # first time only
./scripts/start_all.sh
```

Option B — two Terminal tabs, manual control:

```bash
# Tab 1 — backend API + simulation on http://localhost:8000
poetry run python -m model_informed_greenhouse_dashboard.backend.app.main

# Tab 2 — frontend dev server on http://localhost:5173
npm run dev --prefix frontend
```

### 5. Open and verify

- Dashboard: <http://localhost:5173> (the landing page is `/overview`; the simulation starts automatically and live telemetry appears within a few seconds).
- Backend health: <http://localhost:8000/api/status> should return JSON with the greenhouse simulation state.
- Simulation pace: on the Control screen, the SPEED presets (10/20/30/60/600/6000 s per real second) adjust how fast simulated time advances; the choice persists across reloads.

### 6. Troubleshooting on macOS

- `pyenv: command not found` after install — the shell profile line from step 1 is missing or Terminal was not restarted.
- Port already in use — `./scripts/start_all.sh` clears stale listeners on `8000`/`5173` before starting; for manual runs use `lsof -ti:8000 | xargs kill` (same for `5173`).
- `./scripts/start_all.sh: Permission denied` — run `bash scripts/start_all.sh` instead, or re-run the `chmod +x` step.
- Apple Silicon note: Homebrew installs under `/opt/homebrew`; if `brew` is not found after install, run `eval "$(/opt/homebrew/bin/brew shellenv)"` and add it to `~/.zshrc`.
- Verify the gates any time with `poetry run pytest`, `poetry run ruff check .`, `npm run lint --prefix frontend`, and `npm test --prefix frontend`.
- If you switch between Windows and WSL/Git Bash, the launcher now tries to repair the current platform's Rollup native package automatically and only falls back to a clean `node_modules` reinstall when that repair is insufficient.
- The launcher now clears stale listeners on ports `8000` and `5173` before starting fresh backend/frontend processes, so route mismatches such as `/api/weather/daegu` returning `404 Not Found` from an older backend should not persist across relaunches.
- RTR steering profiles now live in `configs/rtr_profiles.json`, and you can recalibrate their baseline prior from local history with `poetry run python scripts/calibrate_rtr.py --windows configs/rtr_good_windows.yaml`.
