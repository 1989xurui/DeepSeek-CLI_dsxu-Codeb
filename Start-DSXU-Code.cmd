@echo off
setlocal
chcp 65001 >nul
title DSXU Code

set "DSXU_REPO_ROOT=%~dp0"
cd /d "%DSXU_REPO_ROOT%"

if "%DSXU_FORCE_CONHOST%"=="" if "%WT_SESSION%"=="" (
  where wt.exe >nul 2>nul
  if "%ERRORLEVEL%"=="0" (
    wt.exe -w new new-tab --title "DSXU Code" --startingDirectory "%DSXU_REPO_ROOT%" cmd.exe /k "set DSXU_FORCE_CONHOST=1&& call ""%~f0"" %*"
    exit /b %ERRORLEVEL%
  )
)

if "%WT_SESSION%"=="" (
  if "%DSXU_ASCII_TUI%"=="" set "DSXU_ASCII_TUI=1"
  echo [DSXU] Windows Terminal was not detected. Using ASCII TUI fallback in classic console.
  echo [DSXU] For Chinese/Unicode UI, install Windows Terminal or rerun install.ps1.
)

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
