@echo off
chcp 65001 >nul
setlocal

title DSXU Code WSL Launcher
set "DSXU_REPO_ROOT=%~dp0"

where wsl.exe >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
  echo [DSXU] This is the optional WSL launcher, but WSL is not installed or wsl.exe is not on PATH.
  echo [DSXU] Falling back to the Windows native DSXU launcher.
  echo [DSXU] To enable WSL later, run from an elevated PowerShell:
  echo        wsl --install
  call :fallback_native %*
  exit /b %ERRORLEVEL%
)

for /f "usebackq delims=" %%P in (`powershell -NoProfile -Command "$p='%DSXU_REPO_ROOT%'.TrimEnd('\'); if($p -match '^([A-Za-z]):\\(.*)$'){ '/mnt/' + $matches[1].ToLowerInvariant() + '/' + (($matches[2]) -replace '\\','/') }"`) do set "DSXU_WSL_REPO=%%P"

if "%DSXU_WSL_REPO%"=="" (
  echo [DSXU] Could not convert repo path to WSL path:
  echo        %DSXU_REPO_ROOT%
  echo [DSXU] Falling back to the Windows native DSXU launcher.
  call :fallback_native %*
  exit /b %ERRORLEVEL%
)

if "%DSXU_WSL_NO_WT%"=="1" goto run_wsl_inline
if defined WT_SESSION goto run_wsl_inline

where wt.exe >nul 2>nul
if %ERRORLEVEL% EQU 0 (
  if "%DSXU_WSL_DISTRO%"=="" (
    wt.exe -w new new-tab --title "DSXU Code WSL" -- wsl.exe --cd "%DSXU_WSL_REPO%" -- bash ./bin/dsxu-code-wsl-launch %*
  ) else (
    wt.exe -w new new-tab --title "DSXU Code WSL" -- wsl.exe -d "%DSXU_WSL_DISTRO%" --cd "%DSXU_WSL_REPO%" -- bash ./bin/dsxu-code-wsl-launch %*
  )
  if %ERRORLEVEL% NEQ 0 (
    echo [DSXU] Windows Terminal failed to open. Falling back to this window.
    call :run_wsl_inline %*
    pause
  )
) else (
  echo [DSXU] Windows Terminal not found, falling back to wsl.exe in this window.
  call :run_wsl_inline %*
  pause
)

exit /b %ERRORLEVEL%

:run_wsl_inline
if "%DSXU_WSL_DISTRO%"=="" (
  wsl.exe --cd "%DSXU_WSL_REPO%" -- bash ./bin/dsxu-code-wsl-launch %*
) else (
  wsl.exe -d "%DSXU_WSL_DISTRO%" --cd "%DSXU_WSL_REPO%" -- bash ./bin/dsxu-code-wsl-launch %*
)
if %ERRORLEVEL% NEQ 0 (
  echo [DSXU] WSL launch failed with status %ERRORLEVEL%.
  echo [DSXU] If WSL was just installed, finish its first-run Linux setup or set DSXU_WSL_DISTRO.
  echo [DSXU] Falling back to the Windows native DSXU launcher.
  call :fallback_native %*
  exit /b %ERRORLEVEL%
)
exit /b 0

:fallback_native
if exist "%DSXU_REPO_ROOT%Start-DSXU-Code.cmd" (
  call "%DSXU_REPO_ROOT%Start-DSXU-Code.cmd" %*
  exit /b %ERRORLEVEL%
)
echo [DSXU] Missing Start-DSXU-Code.cmd. Please reinstall from the source checkout.
pause
exit /b 1
