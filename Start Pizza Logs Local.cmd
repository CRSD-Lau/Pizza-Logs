@echo off
set "REPO=%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%REPO%scripts\start-local-test-server.ps1" -DisableScheduledTask
if errorlevel 1 (
  echo.
  echo Start failed. See %REPO%.next-local-test-server.log for details.
  pause
)
