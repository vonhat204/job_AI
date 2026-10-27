@echo off
cd /d "%~dp0"
set "JOBDESK_BUN=%USERPROFILE%\.bun\bin\bun.exe"
if not exist "%JOBDESK_BUN%" set "JOBDESK_BUN=bun"
"%JOBDESK_BUN%" run tools/launch.ts
if errorlevel 1 (
  pause
  exit /b 1
)
