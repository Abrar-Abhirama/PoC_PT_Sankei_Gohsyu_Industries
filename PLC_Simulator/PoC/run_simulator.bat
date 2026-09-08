@echo off
title Keyence KV-8000 PLC Simulator
cd /d "%~dp0"
echo ========================================================
echo   Starting Keyence KV-8000 PLC Simulator...
echo ========================================================
"%LOCALAPPDATA%\Programs\Python\Python312\python.exe" -u plc_simulator.py
pause