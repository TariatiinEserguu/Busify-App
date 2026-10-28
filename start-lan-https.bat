@echo off
setlocal
title BUSIFY (local network, HTTPS)
cd /d "%~dp0"
if not exist node_modules (
  echo  Dependencies are missing. Run setup.bat first.
  pause
  exit /b 1
)
call npm run lan-info
echo  Starting BUSIFY with a self-signed HTTPS certificate so phones can use GPS.
echo  On the phone, open the https:// address and accept the security warning once.
call npm run lan -- --https
pause
