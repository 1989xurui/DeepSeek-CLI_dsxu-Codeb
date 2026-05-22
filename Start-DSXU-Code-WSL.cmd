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

for /f "usebackq delims=" %%D in (`powershell -NoProfile -Command "$preferred=$env:DSXU_WSL_DISTRO; if($preferred){$preferred; exit}; $d=(wsl.exe -l -q 2>$null | ForEach-Object { ($_ -replace [char]0, '').Trim() } | Where-Object { $_ } | Select-Object -First 1); if($d){$d}"`) do set "DSXU_WSL_DISTRO=%%D"

if "%DSXU_WSL_DISTRO%"=="" (
  echo [DSXU] This is the optional WSL launcher, but no WSL distro is configured yet.
  echo [DSXU] Falling back to the Windows native DSXU launcher.
  echo [DSXU] To enable WSL later, install one from PowerShell:
  echo        wsl --install -d Ubuntu
  echo [DSXU] Reopen Windows Terminal after the distro first-run setup.
  call :fallback_native %*
  exit /b %ERRORLEVEL%
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
  wt.exe -w new new-tab --title "DSXU Code WSL" -- wsl.exe -d "%DSXU_WSL_DISTRO%" --cd "%DSXU_WSL_REPO%" -- bash -lc "exec bash ./bin/dsxu-code-wsl-launch"
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

exit /b %ERRORLEVEL%

:fallback_native
if exist "%DSXU_REPO_ROOT%Start-DSXU-Code.cmd" (
  call "%DSXU_REPO_ROOT%Start-DSXU-Code.cmd" %*
  exit /b %ERRORLEVEL%
)
echo [DSXU] Missing Start-DSXU-Code.cmd. Please reinstall from the source checkout.
pause
exit /b 1
