@echo off
setlocal
title BUSIFY (local network)
cd /d "%~dp0"
if not exist node_modules (
  echo  Dependencies are missing. Run setup.bat first.
  pause
  exit /b 1
)
call npm run lan-info
echo  Starting BUSIFY for phones on your Wi-Fi (plain HTTP).
echo  For real GPS on phones use start-lan-https.bat instead.
call npm run lan
pause
