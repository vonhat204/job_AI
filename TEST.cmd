@echo off
cd /d "%~dp0"
set "JOBDESK_BUN=%USERPROFILE%\.bun\bin\bun.exe"
if not exist "%JOBDESK_BUN%" set "JOBDESK_BUN=bun"
"%JOBDESK_BUN%" run check
if errorlevel 1 goto failed
"%JOBDESK_BUN%" test
if errorlevel 1 goto failed
echo All checks passed.
pause
exit /b 0
:failed
echo Check failed. See the error above.
pause
exit /b 1
