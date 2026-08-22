@echo off
cd /d "%~dp0"
echo Starting Auction Training Dashboard...
echo Open http://localhost:8000/static/dashboard.html in your browser.
start "" http://localhost:8000/static/dashboard.html
python -m http.server 8000
