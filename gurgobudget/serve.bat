@echo off
rem GurgoBudget — local dev server.
rem
rem ES modules will not load over file://, so the app needs a real HTTP origin.
rem Serves this folder, so http://localhost:PORT/ is index.html.
rem
rem   serve.bat        -> port 8000
rem   serve.bat 5173   -> port 5173
rem
rem Ctrl+C stops it.

setlocal
cd /d "%~dp0"

set "PORT=%~1"
if not defined PORT set "PORT=8000"

rem Open the browser a beat after the server has had time to bind.
start "" /b cmd /c ping -n 2 127.0.0.1 ^>nul ^& start "" http://localhost:%PORT%/

echo GurgoBudget  ^|  http://localhost:%PORT%/
echo.

where /q py
if %errorlevel% equ 0 (
    py -3 -m http.server %PORT%
    goto :done
)

where /q python
if %errorlevel% equ 0 (
    python -m http.server %PORT%
    goto :done
)

where /q npx
if %errorlevel% equ 0 (
    npx --yes serve -l %PORT% .
    goto :done
)

echo No server found. Needs Python or Node on PATH.
pause
exit /b 1

:done
endlocal
