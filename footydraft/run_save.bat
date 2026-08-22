@echo off
REM Half-manual image saver: for each player it opens the search, then waits
REM for you to click the image you want. Six seconds after your click, the
REM save sequence runs on its own.
REM
REM Players who already have an image in assets\ are skipped, so you can
REM just rerun this to mop up whatever is still missing.
REM
REM Double-click to run, or call from a terminal with any of the script's
REM flags, which are passed straight through:
REM
REM   run_save.bat --dry-run
REM   run_save.bat --limit 5
REM   run_save.bat --start 120
REM   run_save.bat --no-skip
REM   run_save.bat --test-click
REM
REM You get a 5 second countdown to focus the browser before it starts typing.
REM Abort with Ctrl+C, or by throwing the mouse into the top-left corner of
REM the screen.

cd /d "%~dp0"

if exist "%~dp0.venv\Scripts\python.exe" (
    set PY="%~dp0.venv\Scripts\python.exe"
) else (
    set PY=python
)

%PY% "%~dp0save_player_images.py" %*
set EXITCODE=%ERRORLEVEL%

if %EXITCODE% neq 0 (
    echo.
    echo Script exited with code %EXITCODE%.
)

echo.
pause
exit /b %EXITCODE%
