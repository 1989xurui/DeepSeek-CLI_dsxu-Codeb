@echo off
setlocal
chcp 65001 >nul
title DSXU Code

set "DSXU_REPO_ROOT=%~dp0"
cd /d "%DSXU_REPO_ROOT%"

if not exist "%DSXU_REPO_ROOT%scripts\start-dsxu-windows.ps1" (
  echo [DSXU] Missing scripts\start-dsxu-windows.ps1
  echo [DSXU] Please reinstall from the GitHub release package or source checkout.
  pause
  exit /b 1
)

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%DSXU_REPO_ROOT%scripts\start-dsxu-windows.ps1" %*
set "DSXU_EXIT=%ERRORLEVEL%"

echo.
if "%DSXU_EXIT%"=="0" (
  echo [DSXU] DSXU Code session ended.
) else (
  echo [DSXU] DSXU Code exited with status %DSXU_EXIT%.
)
pause
exit /b %DSXU_EXIT%
