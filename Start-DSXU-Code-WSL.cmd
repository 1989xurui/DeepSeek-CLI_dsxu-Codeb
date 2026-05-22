@echo off
chcp 65001 >nul
setlocal

title DSXU Code WSL Launcher
set "DSXU_REPO_ROOT=%~dp0"

where wsl.exe >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
  echo [DSXU] WSL is not installed or wsl.exe is not on PATH.
  echo [DSXU] Install WSL from an elevated PowerShell:
  echo        wsl --install
  echo [DSXU] Reopen Windows Terminal after WSL setup, then run this launcher again.
  pause
  exit /b 1
)

for /f "usebackq delims=" %%D in (`powershell -NoProfile -Command "$preferred=$env:DSXU_WSL_DISTRO; if($preferred){$preferred; exit}; $d=(wsl.exe -l -q 2>$null | Where-Object { $_.Trim() } | Select-Object -First 1); if($d){$d.Trim()}"`) do set "DSXU_WSL_DISTRO=%%D"

if "%DSXU_WSL_DISTRO%"=="" (
  echo [DSXU] No WSL distro is configured yet.
  echo [DSXU] Install one from PowerShell:
  echo        wsl --install -d Ubuntu
  echo [DSXU] Reopen Windows Terminal after the distro first-run setup.
  pause
  exit /b 1
)

for /f "delims=" %%P in ('wsl.exe -d "%DSXU_WSL_DISTRO%" wslpath -a "%DSXU_REPO_ROOT%"') do set "DSXU_WSL_REPO=%%P"

if "%DSXU_WSL_REPO%"=="" (
  echo [DSXU] Could not convert repo path to WSL path:
  echo        %DSXU_REPO_ROOT%
  pause
  exit /b 1
)

where wt.exe >nul 2>nul
if %ERRORLEVEL% EQU 0 (
  wt.exe -w 0 nt --title "DSXU Code WSL" -- wsl.exe -d "%DSXU_WSL_DISTRO%" --cd "%DSXU_WSL_REPO%" -- bash -lc "exec bash ./bin/dsxu-code-wsl-launch"
  if %ERRORLEVEL% NEQ 0 (
    echo [DSXU] Windows Terminal failed to open. Falling back to this window.
    wsl.exe -d "%DSXU_WSL_DISTRO%" --cd "%DSXU_WSL_REPO%" -- bash -lc "exec bash ./bin/dsxu-code-wsl-launch"
    pause
  )
) else (
  echo [DSXU] Windows Terminal not found, falling back to wsl.exe in this window.
  wsl.exe -d "%DSXU_WSL_DISTRO%" --cd "%DSXU_WSL_REPO%" -- bash -lc "exec bash ./bin/dsxu-code-wsl-launch"
  pause
)
