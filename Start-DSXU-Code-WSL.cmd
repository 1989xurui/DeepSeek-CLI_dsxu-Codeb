@echo off
chcp 65001 >nul
setlocal

title DSXU Code WSL Launcher
where wt.exe >nul 2>nul
if %ERRORLEVEL% EQU 0 (
  wt.exe -w new new-tab --title "DSXU Code WSL" -- wsl.exe -d Ubuntu --cd /mnt/d/DSXU-code -- bash -lc "exec bash ./bin/dsxu-code-wsl-launch"
  if %ERRORLEVEL% NEQ 0 (
    echo [DSXU] Windows Terminal failed to open. Falling back to this window.
    wsl.exe -d Ubuntu --cd /mnt/d/DSXU-code -- bash -lc "exec bash ./bin/dsxu-code-wsl-launch"
    pause
  )
) else (
  echo [DSXU] Windows Terminal not found, falling back to wsl.exe in this window.
  wsl.exe -d Ubuntu --cd /mnt/d/DSXU-code -- bash -lc "exec bash ./bin/dsxu-code-wsl-launch"
  pause
)
