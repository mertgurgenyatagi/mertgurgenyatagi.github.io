@echo off
title Auction RL Training
cd /d "%~dp0"
echo ============================================================
echo  #footydraft ^| Auction Bot Training
echo ============================================================
echo.
echo  - Metrics : scripts\training\metrics\auction_metrics.json
echo  - Config  : scripts\training\live_config.json
echo  - Weights : src\data\botModels\auction_policy.json
echo.
echo  Edit live_config.json while training to hot-reload lr,
echo  c_entropy, etc.  Ctrl-C to stop.
echo ============================================================
echo.
C:\Users\Mert\AppData\Local\Programs\Python\Python313\python.exe train_auction.py
pause
