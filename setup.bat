@echo off
setlocal
title BUSIFY setup
cd /d "%~dp0"
echo.
echo  === BUSIFY setup ===
echo.
where node >nul 2>nul
if errorlevel 1 (
  echo  Node.js is not installed. Download Node.js 22 LTS from https://nodejs.org and run this file again.
  pause
  exit /b 1
)
echo  Installing dependencies (first run takes a few minutes)...
call npm install
if errorlevel 1 goto failed
call npm run setup
if errorlevel 1 goto failed
echo.
echo  Done. Double-click start-busify.bat to start BUSIFY.
pause
exit /b 0

:failed
echo.
echo  Setup failed. Read the messages above, fix the problem and run setup.bat again.
pause
exit /b 1
