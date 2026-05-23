@echo off
setlocal EnableExtensions EnableDelayedExpansion
chcp 65001 >nul
title DSXU Code WSL Launcher

set "DSXU_REPO_ROOT=%~dp0"
if "%DSXU_REPO_ROOT:~-1%"=="\" set "DSXU_REPO_ROOT=%DSXU_REPO_ROOT:~0,-1%"
cd /d "%DSXU_REPO_ROOT%"

where wsl.exe >nul 2>nul
if not "%ERRORLEVEL%"=="0" (
  echo [DSXU] WSL is not available in this Windows session.
  echo [DSXU] Falling back to the Windows native DSXU launcher.
  call "%DSXU_REPO_ROOT%\Start-DSXU-Code.cmd" %*
  exit /b %ERRORLEVEL%
)

set "DSXU_SELECTED_DISTRO=%DSXU_WSL_DISTRO%"
if "%DSXU_SELECTED_DISTRO%"=="" (
  wsl.exe -d Ubuntu -- true >nul 2>nul
  if not errorlevel 1 set "DSXU_SELECTED_DISTRO=Ubuntu"
)

if "%DSXU_SELECTED_DISTRO%"=="" (
  for /f "usebackq delims=" %%D in (`wsl.exe -l -q 2^>nul`) do (
    if not defined DSXU_SELECTED_DISTRO (
      set "DSXU_CANDIDATE=%%D"
      wsl.exe -d !DSXU_CANDIDATE! -- true >nul 2>nul
      if "!ERRORLEVEL!"=="0" set "DSXU_SELECTED_DISTRO=!DSXU_CANDIDATE!"
    )
  )
)

if "%DSXU_SELECTED_DISTRO%"=="" (
  echo [DSXU] No configured WSL distro was found.
  echo [DSXU] Falling back to the Windows native DSXU launcher.
  call "%DSXU_REPO_ROOT%\Start-DSXU-Code.cmd" %*
  exit /b %ERRORLEVEL%
)

set "DSXU_DRIVE=%DSXU_REPO_ROOT:~0,1%"
set "DSXU_DRIVE_LC=%DSXU_DRIVE%"
if /I "%DSXU_DRIVE%"=="A" set "DSXU_DRIVE_LC=a"
if /I "%DSXU_DRIVE%"=="B" set "DSXU_DRIVE_LC=b"
if /I "%DSXU_DRIVE%"=="C" set "DSXU_DRIVE_LC=c"
if /I "%DSXU_DRIVE%"=="D" set "DSXU_DRIVE_LC=d"
if /I "%DSXU_DRIVE%"=="E" set "DSXU_DRIVE_LC=e"
if /I "%DSXU_DRIVE%"=="F" set "DSXU_DRIVE_LC=f"
if /I "%DSXU_DRIVE%"=="G" set "DSXU_DRIVE_LC=g"
if /I "%DSXU_DRIVE%"=="H" set "DSXU_DRIVE_LC=h"
if /I "%DSXU_DRIVE%"=="I" set "DSXU_DRIVE_LC=i"
if /I "%DSXU_DRIVE%"=="J" set "DSXU_DRIVE_LC=j"
if /I "%DSXU_DRIVE%"=="K" set "DSXU_DRIVE_LC=k"
if /I "%DSXU_DRIVE%"=="L" set "DSXU_DRIVE_LC=l"
if /I "%DSXU_DRIVE%"=="M" set "DSXU_DRIVE_LC=m"
if /I "%DSXU_DRIVE%"=="N" set "DSXU_DRIVE_LC=n"
if /I "%DSXU_DRIVE%"=="O" set "DSXU_DRIVE_LC=o"
if /I "%DSXU_DRIVE%"=="P" set "DSXU_DRIVE_LC=p"
if /I "%DSXU_DRIVE%"=="Q" set "DSXU_DRIVE_LC=q"
if /I "%DSXU_DRIVE%"=="R" set "DSXU_DRIVE_LC=r"
if /I "%DSXU_DRIVE%"=="S" set "DSXU_DRIVE_LC=s"
if /I "%DSXU_DRIVE%"=="T" set "DSXU_DRIVE_LC=t"
if /I "%DSXU_DRIVE%"=="U" set "DSXU_DRIVE_LC=u"
if /I "%DSXU_DRIVE%"=="V" set "DSXU_DRIVE_LC=v"
if /I "%DSXU_DRIVE%"=="W" set "DSXU_DRIVE_LC=w"
if /I "%DSXU_DRIVE%"=="X" set "DSXU_DRIVE_LC=x"
if /I "%DSXU_DRIVE%"=="Y" set "DSXU_DRIVE_LC=y"
if /I "%DSXU_DRIVE%"=="Z" set "DSXU_DRIVE_LC=z"
set "DSXU_REST=%DSXU_REPO_ROOT:~2%"
set "DSXU_REST=%DSXU_REST:\=/%"
set "DSXU_WSL_REPO=/mnt/%DSXU_DRIVE_LC%%DSXU_REST%"
set "DSXU_WSL_LF_REPAIR=for f in ./bin/dsxu-code ./bin/dsxu-code-wsl-launch ./install.sh ./scripts/install.sh ./scripts/install-vscode-extension.sh; do if [ -f $f ]; then sed -i 's/\r$//' $f 2>/dev/null || true; fi; done"

if "%DSXU_DRIVE_LC%"=="" (
  echo [DSXU] Could not convert this checkout path to WSL: %DSXU_REPO_ROOT%
  echo [DSXU] Falling back to the Windows native DSXU launcher.
  call "%DSXU_REPO_ROOT%\Start-DSXU-Code.cmd" %*
  exit /b %ERRORLEVEL%
)

wsl.exe -d %DSXU_SELECTED_DISTRO% -- bash -lc "test -f '%DSXU_WSL_REPO%/bin/dsxu-code-wsl-launch'"
if not "%ERRORLEVEL%"=="0" (
  echo [DSXU] WSL distro detected, but this checkout is not reachable inside WSL:
  echo        distro=%DSXU_SELECTED_DISTRO%
  echo        wslRepo=%DSXU_WSL_REPO%
  echo [DSXU] Falling back to the Windows native DSXU launcher.
  call "%DSXU_REPO_ROOT%\Start-DSXU-Code.cmd" %*
  exit /b %ERRORLEVEL%
)

if "%~1"=="" (
  echo [DSXU] Starting DSXU Code WSL in %DSXU_SELECTED_DISTRO%: %DSXU_WSL_REPO%
  wsl.exe -d %DSXU_SELECTED_DISTRO% -- bash -lc "cd '%DSXU_WSL_REPO%' && %DSXU_WSL_LF_REPAIR% && exec bash ./bin/dsxu-code-wsl-launch"
  exit /b %ERRORLEVEL%
)

wsl.exe -d %DSXU_SELECTED_DISTRO% -- bash -lc "cd '%DSXU_WSL_REPO%' && %DSXU_WSL_LF_REPAIR% && exec bash ./bin/dsxu-code-wsl-launch %*"
exit /b %ERRORLEVEL%
