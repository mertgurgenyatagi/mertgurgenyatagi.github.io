@echo off
REM Starts the Vite dev server and opens the site in your browser.
REM
REM Double-click to run, or call from a terminal with any of Vite's flags,
REM which are passed straight through:
REM
REM   run_dev.bat --port 5173
REM   run_dev.bat --host          (expose on the local network)
REM
REM Dependencies are installed on first run if node_modules is missing.
REM Stop the server with Ctrl+C.

cd /d "%~dp0"

if not exist "%~dp0node_modules" (
    echo Installing dependencies, one moment...
    call npm install
    if errorlevel 1 (
        echo.
        echo npm install failed.
        pause
        exit /b 1
    )
)

REM --open makes Vite launch the browser itself once it's actually listening,
REM which also means it uses whatever port it settled on if 5173 was taken.
call npm run dev -- --open %*

set EXITCODE=%ERRORLEVEL%

if %EXITCODE% neq 0 (
    echo.
    echo Dev server exited with code %EXITCODE%.
    pause
)

exit /b %EXITCODE%
