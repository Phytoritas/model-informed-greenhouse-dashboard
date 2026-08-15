@echo off
setlocal

set "SCRIPT_DIR=%~dp0"
for %%I in ("%SCRIPT_DIR%..") do set "REPO_ROOT=%%~fI"
if not defined BACKEND_HOST set "BACKEND_HOST=127.0.0.1"
if not defined BACKEND_PORT set "BACKEND_PORT=8000"
if not defined FRONTEND_HOST set "FRONTEND_HOST=127.0.0.1"
if not defined FRONTEND_PORT set "FRONTEND_PORT=5173"

cd /d "%REPO_ROOT%"
if not exist ".venv\Scripts\python.exe" call poetry install
if not exist "frontend\node_modules" call npm install --prefix frontend

set "RELOAD_ARGS=--reload --reload-dir src/model_informed_greenhouse_dashboard/backend/app"
if "%DEV%"=="0" set "RELOAD_ARGS="

start "Adaptive Greenhouse Backend" cmd /k "cd /d ""%REPO_ROOT%"" && poetry run python -m uvicorn model_informed_greenhouse_dashboard.backend.app.adaptive_main:app --host %BACKEND_HOST% --port %BACKEND_PORT% %RELOAD_ARGS%"
timeout /t 3 /nobreak >nul
start "Greenhouse Frontend" cmd /k "cd /d ""%REPO_ROOT%\frontend"" && npm run dev -- --host %FRONTEND_HOST% --port %FRONTEND_PORT%"

echo Adaptive backend: http://%BACKEND_HOST%:%BACKEND_PORT%
echo Adaptive API docs: http://%BACKEND_HOST%:%BACKEND_PORT%/docs
echo Frontend: http://%FRONTEND_HOST%:%FRONTEND_PORT%
