@echo off
setlocal
chcp 65001 >nul
title DSXU Code

set "DSXU_REPO_ROOT=%~dp0"
cd /d "%DSXU_REPO_ROOT%"

set "DSXU_HAS_ARGS=0"
if not "%~1"=="" set "DSXU_HAS_ARGS=1"

if "%DSXU_FORCE_CONHOST%"=="" if "%WT_SESSION%"=="" (
  where wt.exe >nul 2>nul
  if "%ERRORLEVEL%"=="0" (
    wt.exe -w new new-tab --title "DSXU Code" --startingDirectory "%DSXU_REPO_ROOT%" cmd.exe /k "set DSXU_FORCE_CONHOST=1&& call ""%~f0"" %*"
    exit /b %ERRORLEVEL%
  )
  if exist "%LOCALAPPDATA%\Microsoft\WindowsApps\wt.exe" (
    "%LOCALAPPDATA%\Microsoft\WindowsApps\wt.exe" -w new new-tab --title "DSXU Code" --startingDirectory "%DSXU_REPO_ROOT%" cmd.exe /k "set DSXU_FORCE_CONHOST=1&& call ""%~f0"" %*"
    exit /b %ERRORLEVEL%
  )
)

if "%WT_SESSION%"=="" (
  if "%DSXU_ALLOW_CONHOST%"=="" if "%DSXU_HAS_ARGS%"=="0" (
    echo [DSXU] Windows Terminal was not detected.
    echo [DSXU] DSXU Code needs Windows Terminal for interactive Chinese/Unicode input.
    echo [DSXU] Classic cmd/PowerShell can turn Chinese input into question marks before DSXU receives it.
    echo.
    echo [DSXU] Fix:
    echo   powershell -NoProfile -ExecutionPolicy Bypass -File "%DSXU_REPO_ROOT%install.ps1"
    echo.
    echo [DSXU] Or install Windows Terminal manually:
    echo   winget install --id Microsoft.WindowsTerminal -e
    echo.
    echo [DSXU] If you only want an English/ASCII emergency session:
    echo   set DSXU_ALLOW_CONHOST=1
    echo   "%~f0"
    echo.
    pause
    exit /b 2
  )
  if "%DSXU_ASCII_TUI%"=="" set "DSXU_ASCII_TUI=1"
  echo [DSXU] Classic console detected. Using ASCII TUI fallback for this non-interactive or explicitly allowed session.
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
