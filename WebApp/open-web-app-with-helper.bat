@echo off
setlocal
cd /d "%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\open-web-app.ps1"
echo.
echo Disk Storage Analyser helper launcher finished. Keep the helper and web server windows open.
