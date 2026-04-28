@echo off
setlocal
cd /d "%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\open-website.ps1"
echo.
echo Disk Storage Analyser website launcher finished. Keep the web server window open.
