#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

BACKEND_HOST="${BACKEND_HOST:-127.0.0.1}"
BACKEND_PORT="${BACKEND_PORT:-8000}"
FRONTEND_HOST="${FRONTEND_HOST:-127.0.0.1}"
FRONTEND_PORT="${FRONTEND_PORT:-5173}"
DEV="${DEV:-1}"
MODE="${1:-start}"
POETRY_BIN=""
NPM_BIN=""
NODE_BIN=""

pick_runner() {
  local target_var="$1"
  shift

  local candidate resolved
  for candidate in "$@"; do
    if resolved="$(command -v "${candidate}" 2>/dev/null)"; then
      if "${resolved}" --version >/dev/null 2>&1; then
        printf -v "${target_var}" '%s' "${resolved}"
        return 0
      fi
    fi
  done

  return 1
}

check_tooling() {
  pick_runner POETRY_BIN poetry.exe poetry poetry.cmd || {
    echo "ERROR: poetry is not installed or not on PATH."
    exit 1
  }

  pick_runner NPM_BIN npm npm.cmd || {
    echo "ERROR: npm is not installed or not on PATH."
    exit 1
  }

  pick_runner NODE_BIN node node.exe || {
    echo "ERROR: node is not installed or not on PATH."
    exit 1
  }
}

ensure_backend() {
  echo "[1/5] Checking backend environment..."
  if [[ -x "${REPO_ROOT}/.venv/bin/python" || -x "${REPO_ROOT}/.venv/Scripts/python.exe" ]]; then
    echo "      Poetry environment found."
    return 0
  fi

  echo "      Creating Poetry environment with poetry install..."
  (
    cd "${REPO_ROOT}"
    "${POETRY_BIN}" install
  )
}

ensure_frontend() {
  echo "[2/5] Checking frontend dependencies..."
  if [[ ! -d "${REPO_ROOT}/frontend/node_modules" ]]; then
    echo "      Frontend node_modules missing. Installing..."
    (
      cd "${REPO_ROOT}/frontend"
      "${NPM_BIN}" install
    )
  fi

  if validate_frontend_dependencies; then
    echo "      Frontend dependencies match current runtime."
    return 0
  fi

  if repair_frontend_native; then
    if validate_frontend_native_presence; then
      echo "      Frontend dependencies match current runtime after native repair."
      return 0
    fi
  fi

  echo "      Frontend dependencies still do not match. Falling back to clean reinstall..."
  rm -rf "${REPO_ROOT}/frontend/node_modules"
  (
    cd "${REPO_ROOT}/frontend"
    "${NPM_BIN}" install
  )
  repair_frontend_native || true
  validate_frontend_dependencies
  echo "      Frontend dependencies installed."
}

clear_port() {
  local port="$1"
  local label="$2"
  local pids=""

  if command -v lsof >/dev/null 2>&1; then
    pids="$(lsof -ti "tcp:${port}" -sTCP:LISTEN 2>/dev/null || true)"
  elif command -v fuser >/dev/null 2>&1; then
    pids="$(fuser "${port}/tcp" 2>/dev/null || true)"
  fi

  if [[ -z "${pids//[[:space:]]/}" ]]; then
    echo "      No existing ${label} listener detected on port ${port}."
    return 0
  fi

  echo "      Stopping existing ${label} listener on port ${port}: ${pids}"
  kill ${pids} 2>/dev/null || true
  sleep 1
}

validate_frontend_dependencies() {
  if [[ ! -d "${REPO_ROOT}/frontend/node_modules" ]]; then
    return 1
  fi

  (
    cd "${REPO_ROOT}/frontend"
    "${NODE_BIN}" <<'NODE'
const fs = require('node:fs');
const path = require('node:path');

let expectedPackage = '';

if (process.platform === 'win32' && process.arch === 'x64') {
  expectedPackage = '@rollup/rollup-win32-x64-msvc';
} else if (process.platform === 'linux' && process.arch === 'x64') {
  const report = process.report?.getReport?.();
  const glibcRuntime = report?.header?.glibcVersionRuntime;
  expectedPackage = glibcRuntime
    ? '@rollup/rollup-linux-x64-gnu'
    : '@rollup/rollup-linux-x64-musl';
}

if (expectedPackage) {
  const expectedDir = path.join(process.cwd(), 'node_modules', ...expectedPackage.split('/'));
  if (!fs.existsSync(expectedDir)) {
    process.exit(2);
  }
}

require('rollup');
NODE
  ) >/dev/null 2>&1
}

validate_frontend_native_presence() {
  if [[ ! -d "${REPO_ROOT}/frontend/node_modules" ]]; then
    return 1
  fi

  (
    cd "${REPO_ROOT}/frontend"
    "${NODE_BIN}" <<'NODE'
const fs = require('node:fs');
const path = require('node:path');

let expectedPackage = '';

if (process.platform === 'win32' && process.arch === 'x64') {
  expectedPackage = '@rollup/rollup-win32-x64-msvc';
} else if (process.platform === 'linux' && process.arch === 'x64') {
  const report = process.report?.getReport?.();
  const glibcRuntime = report?.header?.glibcVersionRuntime;
  expectedPackage = glibcRuntime
    ? '@rollup/rollup-linux-x64-gnu'
    : '@rollup/rollup-linux-x64-musl';
}

if (!expectedPackage) {
  process.exit(0);
}

const expectedDir = path.join(process.cwd(), 'node_modules', ...expectedPackage.split('/'));
if (!fs.existsSync(expectedDir)) {
  process.exit(2);
}
NODE
  ) >/dev/null 2>&1
}

repair_frontend_native() {
  local native_spec
  native_spec="$(frontend_native_spec 2>/dev/null || true)"
  if [[ -z "${native_spec}" ]]; then
    return 1
  fi

  echo "      Repairing Rollup native package for current runtime: ${native_spec}"
  (
    cd "${REPO_ROOT}/frontend"
    "${NPM_BIN}" install --no-save "${native_spec}"
  ) >/dev/null
}

frontend_native_spec() {
  if [[ ! -d "${REPO_ROOT}/frontend/node_modules/rollup" ]]; then
    return 1
  fi

  (
    cd "${REPO_ROOT}/frontend"
    "${NODE_BIN}" <<'NODE'
const rollupPkg = require('./node_modules/rollup/package.json');

let expectedPackage = '';
if (process.platform === 'win32' && process.arch === 'x64') {
  expectedPackage = '@rollup/rollup-win32-x64-msvc';
} else if (process.platform === 'linux' && process.arch === 'x64') {
  const report = process.report?.getReport?.();
  const glibcRuntime = report?.header?.glibcVersionRuntime;
  expectedPackage = glibcRuntime
    ? '@rollup/rollup-linux-x64-gnu'
    : '@rollup/rollup-linux-x64-musl';
}

if (!expectedPackage) {
  process.exit(1);
}

const version = rollupPkg.optionalDependencies?.[expectedPackage];
if (!version) {
  process.exit(2);
}

process.stdout.write(`${expectedPackage}@${version}`);
NODE
  )
}

case "${MODE}" in
  check)
    check_tooling
    ensure_backend
    ensure_frontend
    echo "Launcher prerequisite check passed."
    exit 0
    ;;
  install)
    check_tooling
    ensure_backend
    ensure_frontend
    echo "Launcher prerequisite install completed."
    exit 0
    ;;
  start)
    ;;
  *)
    echo "Usage: bash scripts/start_all.sh [start|check|install]"
    exit 1
    ;;
esac

echo
echo "========================================"
echo "  Model-Informed Greenhouse Dashboard"
echo "========================================"
echo

check_tooling
ensure_backend
ensure_frontend

echo "[3/5] Clearing stale listeners..."
clear_port "${BACKEND_PORT}" backend
clear_port "${FRONTEND_PORT}" frontend

echo "[4/5] Starting backend server..."
if [[ "${DEV}" == "0" ]]; then
  (
    cd "${REPO_ROOT}"
    "${POETRY_BIN}" run python -m uvicorn model_informed_greenhouse_dashboard.backend.app.main:app --host "${BACKEND_HOST}" --port "${BACKEND_PORT}"
  ) &
else
  (
    cd "${REPO_ROOT}"
    "${POETRY_BIN}" run python -m uvicorn model_informed_greenhouse_dashboard.backend.app.main:app --host "${BACKEND_HOST}" --port "${BACKEND_PORT}" --reload
  ) &
fi
BACKEND_PID=$!

sleep 3

echo "[5/5] Starting frontend server..."
(
  cd "${REPO_ROOT}/frontend"
  "${NPM_BIN}" run dev -- --host "${FRONTEND_HOST}" --port "${FRONTEND_PORT}"
) &
FRONTEND_PID=$!

cleanup() {
  echo
  echo "Stopping dashboard processes..."
  kill "${BACKEND_PID}" "${FRONTEND_PID}" 2>/dev/null || true
}

trap cleanup INT TERM EXIT

echo
echo "========================================"
echo "  Dashboard is starting!"
echo "========================================"
echo
echo "  Backend API:  http://${BACKEND_HOST}:${BACKEND_PORT}"
echo "  API Docs:     http://${BACKEND_HOST}:${BACKEND_PORT}/docs"
echo "  Frontend:     http://${FRONTEND_HOST}:${FRONTEND_PORT}"
echo
echo "  Press Ctrl+C to stop both processes."
echo "  Run \`bash scripts/start_all.sh check\` to validate dependencies only."
echo

wait "${BACKEND_PID}" "${FRONTEND_PID}"
