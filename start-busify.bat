@echo off
setlocal
title BUSIFY (development)
cd /d "%~dp0"
if not exist node_modules (
  echo  Dependencies are missing. Run setup.bat first.
  pause
  exit /b 1
)
echo  Starting BUSIFY... the browser opens at http://localhost:5173
echo  Keep this window open. Press Ctrl+C to stop.
start "" /b cmd /c "timeout /t 6 /nobreak >nul && start http://localhost:5173"
call npm run dev
pause
