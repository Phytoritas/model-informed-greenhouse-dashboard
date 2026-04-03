@echo off
setlocal

set "SCRIPT_DIR=%~dp0"
if exist "%SCRIPT_DIR%..\frontend" (
    for %%I in ("%SCRIPT_DIR%..") do set "REPO_ROOT=%%~fI"
) else (
    set "REPO_ROOT=%SCRIPT_DIR%"
)

set "BACKEND_HOST=127.0.0.1"
set "BACKEND_PORT=8000"
set "FRONTEND_HOST=127.0.0.1"
set "FRONTEND_PORT=5173"

if /I "%~1"=="check" goto :check_only
if /I "%~1"=="install" goto :install_only

echo.
echo ========================================
echo   Model-Informed Greenhouse Dashboard
echo ========================================
echo.

call :check_tooling
if errorlevel 1 exit /b 1

call :ensure_backend
if errorlevel 1 exit /b 1

call :ensure_frontend
if errorlevel 1 exit /b 1

echo [3/5] Clearing stale listeners...
call :clear_existing_listener %BACKEND_PORT% backend
call :clear_existing_listener %FRONTEND_PORT% frontend

echo [4/5] Starting backend server...
if "%DEV%"=="0" (
    start "Greenhouse Backend" cmd /k "cd /d ""%REPO_ROOT%"" && poetry run python -m uvicorn model_informed_greenhouse_dashboard.backend.app.main:app --host %BACKEND_HOST% --port %BACKEND_PORT%"
) else (
    start "Greenhouse Backend" cmd /k "cd /d ""%REPO_ROOT%"" && poetry run python -m uvicorn model_informed_greenhouse_dashboard.backend.app.main:app --host %BACKEND_HOST% --port %BACKEND_PORT% --reload"
)

timeout /t 3 /nobreak >nul

echo [5/5] Starting frontend server...
start "Greenhouse Frontend" cmd /k "cd /d ""%REPO_ROOT%\frontend"" && npm run dev -- --host %FRONTEND_HOST% --port %FRONTEND_PORT%"

timeout /t 2 /nobreak >nul

echo.
echo ========================================
echo   Dashboard is starting!
echo ========================================
echo.
echo   Backend API:  http://%BACKEND_HOST%:%BACKEND_PORT%
echo   API Docs:     http://%BACKEND_HOST%:%BACKEND_PORT%/docs
echo   Frontend:     http://%FRONTEND_HOST%:%FRONTEND_PORT%
echo.
echo   Two windows have opened:
echo   - Greenhouse Backend
echo   - Greenhouse Frontend
echo.
echo   Use `set DEV=0` before launch if you want backend without reload.
echo   Run `start_all.bat check` to validate dependencies only.
echo.
pause
exit /b 0

:check_only
echo Checking launcher prerequisites under %REPO_ROOT%
call :check_tooling
if errorlevel 1 exit /b 1
call :ensure_backend
if errorlevel 1 exit /b 1
call :ensure_frontend
if errorlevel 1 exit /b 1
echo Launcher prerequisite check passed.
exit /b 0

:install_only
echo Installing launcher prerequisites under %REPO_ROOT%
call :check_tooling
if errorlevel 1 exit /b 1
call :ensure_backend
if errorlevel 1 exit /b 1
call :ensure_frontend
if errorlevel 1 exit /b 1
echo Launcher prerequisite install completed.
exit /b 0

:check_tooling
where poetry >nul 2>&1
if errorlevel 1 (
    echo ERROR: poetry is not installed or not on PATH.
    exit /b 1
)

where npm >nul 2>&1
if errorlevel 1 (
    echo ERROR: npm is not installed or not on PATH.
    exit /b 1
)

where node >nul 2>&1
if errorlevel 1 (
    echo ERROR: node is not installed or not on PATH.
    exit /b 1
)
exit /b 0

:ensure_backend
echo [1/5] Checking backend environment...
if exist "%REPO_ROOT%\.venv\Scripts\python.exe" (
    echo      Poetry environment found.
) else (
    echo      Creating Poetry environment with `poetry install`...
    pushd "%REPO_ROOT%"
    call poetry install
    set "INSTALL_EXIT=%ERRORLEVEL%"
    popd
    if not "%INSTALL_EXIT%"=="0" (
        echo ERROR: poetry install failed.
        exit /b %INSTALL_EXIT%
    )
)
exit /b 0

:ensure_frontend
echo [2/5] Checking frontend dependencies...
if not exist "%REPO_ROOT%\frontend\node_modules" (
    echo      Frontend node_modules missing. Installing...
    pushd "%REPO_ROOT%\frontend"
    call npm install
    set "NPM_EXIT=%ERRORLEVEL%"
    popd
    if not "%NPM_EXIT%"=="0" (
        echo ERROR: npm install failed.
        exit /b %NPM_EXIT%
    )
)

pushd "%REPO_ROOT%\frontend"
call :validate_frontend_dependencies
set "FRONTEND_STATUS=%ERRORLEVEL%"
popd

if "%FRONTEND_STATUS%"=="0" (
    echo      Frontend dependencies match current runtime.
    exit /b 0
)

pushd "%REPO_ROOT%\frontend"
call :repair_frontend_native
set "FRONTEND_REPAIR=%ERRORLEVEL%"
popd

if "%FRONTEND_REPAIR%"=="0" (
    pushd "%REPO_ROOT%\frontend"
    call :validate_frontend_native_presence
    set "FRONTEND_STATUS=%ERRORLEVEL%"
    popd
    if "%FRONTEND_STATUS%"=="0" (
        echo      Frontend dependencies match current runtime after native repair.
        exit /b 0
    )
)

echo      Frontend dependencies still do not match. Falling back to clean reinstall...
if exist "%REPO_ROOT%\frontend\node_modules" rmdir /s /q "%REPO_ROOT%\frontend\node_modules"

pushd "%REPO_ROOT%\frontend"
call npm install
set "NPM_EXIT=%ERRORLEVEL%"
if "%NPM_EXIT%"=="0" call :repair_frontend_native
set "FRONTEND_REPAIR=%ERRORLEVEL%"
popd
if not "%NPM_EXIT%"=="0" (
    echo ERROR: npm install failed.
    exit /b %NPM_EXIT%
)

pushd "%REPO_ROOT%\frontend"
call :validate_frontend_dependencies
set "FRONTEND_STATUS=%ERRORLEVEL%"
popd
if not "%FRONTEND_STATUS%"=="0" (
    echo ERROR: frontend dependency validation failed after reinstall.
    exit /b %FRONTEND_STATUS%
)

echo      Frontend dependencies installed.
exit /b 0

:clear_existing_listener
set "TARGET_PORT=%~1"
set "TARGET_LABEL=%~2"
set "FOUND_LISTENER="
for /f "tokens=5" %%P in ('netstat -ano ^| findstr /R /C:":%TARGET_PORT% .*LISTENING"') do (
    set "FOUND_LISTENER=1"
    echo      Stopping existing %TARGET_LABEL% listener on port %TARGET_PORT% ^(PID %%P^)...
    taskkill /PID %%P /F >nul 2>&1
)
if not defined FOUND_LISTENER echo      No existing %TARGET_LABEL% listener detected on port %TARGET_PORT%.
set "TARGET_PORT="
set "TARGET_LABEL="
set "FOUND_LISTENER="
exit /b 0

:validate_frontend_dependencies
if not exist "node_modules" exit /b 1

node -e "const fs=require('fs'); const path=require('path'); let expectedPackage=''; if (process.platform==='win32' && process.arch==='x64') { expectedPackage='@rollup/rollup-win32-x64-msvc'; } else if (process.platform==='linux' && process.arch==='x64') { const report=process.report&&process.report.getReport?process.report.getReport():null; const glibcRuntime=report&&report.header?report.header.glibcVersionRuntime:null; expectedPackage=glibcRuntime?'@rollup/rollup-linux-x64-gnu':'@rollup/rollup-linux-x64-musl'; } if (expectedPackage) { const expectedDir=path.join(process.cwd(),'node_modules',...expectedPackage.split('/')); if (!fs.existsSync(expectedDir)) { process.exit(2); } } require('rollup');"
exit /b %ERRORLEVEL%

:validate_frontend_native_presence
if not exist "node_modules" exit /b 1

node -e "const fs=require('fs'); const path=require('path'); let expectedPackage=''; if (process.platform==='win32' && process.arch==='x64') { expectedPackage='@rollup/rollup-win32-x64-msvc'; } else if (process.platform==='linux' && process.arch==='x64') { const report=process.report&&process.report.getReport?process.report.getReport():null; const glibcRuntime=report&&report.header?report.header.glibcVersionRuntime:null; expectedPackage=glibcRuntime?'@rollup/rollup-linux-x64-gnu':'@rollup/rollup-linux-x64-musl'; } if (!expectedPackage) { process.exit(0); } const expectedDir=path.join(process.cwd(),'node_modules',...expectedPackage.split('/')); if (!fs.existsSync(expectedDir)) { process.exit(2); }"
exit /b %ERRORLEVEL%

:repair_frontend_native
set "FRONTEND_NATIVE_SPEC="
for /f "delims=" %%I in ('node -e "const rollupPkg=require('./node_modules/rollup/package.json'); let expectedPackage=''; if (process.platform==='win32' && process.arch==='x64') { expectedPackage='@rollup/rollup-win32-x64-msvc'; } else if (process.platform==='linux' && process.arch==='x64') { const report=process.report&&process.report.getReport?process.report.getReport():null; const glibcRuntime=report&&report.header?report.header.glibcVersionRuntime:null; expectedPackage=glibcRuntime?'@rollup/rollup-linux-x64-gnu':'@rollup/rollup-linux-x64-musl'; } if (!expectedPackage) { process.exit(1); } const version=rollupPkg.optionalDependencies&&rollupPkg.optionalDependencies[expectedPackage]; if (!version) { process.exit(2); } process.stdout.write(expectedPackage + '@' + version);" 2^>nul') do set "FRONTEND_NATIVE_SPEC=%%I"
if not defined FRONTEND_NATIVE_SPEC exit /b 1

echo      Repairing Rollup native package for current runtime: %FRONTEND_NATIVE_SPEC%
cmd /c "npm install --no-save %FRONTEND_NATIVE_SPEC%" >nul
set "REPAIR_EXIT=%ERRORLEVEL%"
set "FRONTEND_NATIVE_SPEC="
exit /b %REPAIR_EXIT%
