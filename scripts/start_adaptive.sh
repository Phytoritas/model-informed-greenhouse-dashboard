#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
BACKEND_HOST="${BACKEND_HOST:-127.0.0.1}"
BACKEND_PORT="${BACKEND_PORT:-8000}"
FRONTEND_HOST="${FRONTEND_HOST:-127.0.0.1}"
FRONTEND_PORT="${FRONTEND_PORT:-5173}"
DEV="${DEV:-1}"

cd "${REPO_ROOT}"

if [[ ! -d .venv ]]; then
  poetry install
fi
if [[ ! -d frontend/node_modules ]]; then
  npm install --prefix frontend
fi

BACKEND_ARGS=(
  -m uvicorn
  model_informed_greenhouse_dashboard.backend.app.adaptive_main:app
  --host "${BACKEND_HOST}"
  --port "${BACKEND_PORT}"
)
if [[ "${DEV}" != "0" ]]; then
  BACKEND_ARGS+=(--reload --reload-dir "${REPO_ROOT}/src/model_informed_greenhouse_dashboard/backend/app")
fi

poetry run python "${BACKEND_ARGS[@]}" &
BACKEND_PID=$!

npm run dev --prefix frontend -- --host "${FRONTEND_HOST}" --port "${FRONTEND_PORT}" &
FRONTEND_PID=$!

cleanup() {
  kill "${BACKEND_PID}" "${FRONTEND_PID}" 2>/dev/null || true
}
trap cleanup INT TERM EXIT

echo "Adaptive backend: http://${BACKEND_HOST}:${BACKEND_PORT}"
echo "Adaptive API docs: http://${BACKEND_HOST}:${BACKEND_PORT}/docs"
echo "Frontend: http://${FRONTEND_HOST}:${FRONTEND_PORT}"

wait "${BACKEND_PID}" "${FRONTEND_PID}"
