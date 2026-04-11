@echo off
REM DSxu V1 - Claude Code + DeepSeek one-click launcher (ASCII only)
REM Usage:
REM   .\start-claude.cmd                 -> interactive mode
REM   .\start-claude.cmd --auto          -> fully autonomous mode (no confirmations)

cd /d "D:\DSXU-code"

set ANTHROPIC_BASE_URL=http://localhost:8082
set ANTHROPIC_API_KEY=placeholder
set DISABLE_TELEMETRY=1
set DISABLE_ERROR_REPORTING=1
set CLAUDE_CODE_SYNTAX_HIGHLIGHT=false

echo [start-claude] ANTHROPIC_BASE_URL=%ANTHROPIC_BASE_URL%
echo [start-claude] Syntax highlighting disabled (fixes color-diff-napi crash on Win)

curl -s -m 2 http://localhost:8082/health >nul 2>&1
if %errorlevel% equ 0 (
    echo [start-claude] Proxy already running on :8082
    goto launch
)

echo [start-claude] Proxy not running, starting in background...
start "DeepSeek Proxy" /min cmd /c "cd /d D:\DSXU-code && bun run deepseek-proxy.ts"

for /l %%i in (1,1,16) do (
    timeout /t 1 /nobreak >nul
    curl -s -m 1 http://localhost:8082/health >nul 2>&1
    if not errorlevel 1 goto proxyReady
)
echo [start-claude] ERROR: proxy did not start within 16s
pause
exit /b 1

:proxyReady
echo [start-claude] Proxy is up

:launch
REM Detect --auto flag for autonomous overnight mode
set AUTO_MODE=
if "%1"=="--auto" (
    set AUTO_MODE=--dangerously-skip-permissions
    echo [start-claude] AUTONOMOUS MODE: all tool calls auto-approved. Ctrl+C to abort.
    bun run ./src/entrypoints/cli.tsx %AUTO_MODE%
    goto :eof
)

bun run ./src/entrypoints/cli.tsx %*
