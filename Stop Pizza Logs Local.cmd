@echo off
set "REPO=%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%REPO%scripts\stop-local-test-server.ps1" -DisableScheduledTask -StopPostgres
if errorlevel 1 (
  echo.
  echo Stop had errors. If PostgreSQL did not stop, right-click this script and choose Run as administrator.
  pause
)
