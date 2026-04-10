# ─────────────────────────────────────────────────────────────
# DSxu V1 · Claude Code + DeepSeek 一键启动脚本
# 用法:PowerShell 里 cd D:\DSXU-code 然后 .\start-claude.ps1
# 或:右键 → Run with PowerShell
# ─────────────────────────────────────────────────────────────

$ErrorActionPreference = 'Stop'
Set-Location -Path 'D:\DSXU-code'

# ── 1. 环境变量(关键:让 Claude Code 走本地 proxy) ──
$env:ANTHROPIC_BASE_URL = 'http://localhost:8082'
$env:ANTHROPIC_API_KEY  = 'placeholder'
$env:DISABLE_TELEMETRY  = '1'
$env:DISABLE_ERROR_REPORTING = '1'

Write-Host '[start-claude] ANTHROPIC_BASE_URL =' $env:ANTHROPIC_BASE_URL -ForegroundColor Cyan
Write-Host '[start-claude] ANTHROPIC_API_KEY  = placeholder' -ForegroundColor Cyan

# ── 2. 检查 proxy 是否在跑 ──
$proxyOk = $false
try {
    $resp = Invoke-WebRequest -Uri 'http://localhost:8082/health' -TimeoutSec 2 -UseBasicParsing
    if ($resp.StatusCode -eq 200) {
        $proxyOk = $true
        Write-Host '[start-claude] Proxy health OK' -ForegroundColor Green
    }
} catch {
    Write-Host '[start-claude] Proxy not running, starting it in background...' -ForegroundColor Yellow
}

# ── 3. Proxy 没跑 → 后台启动 ──
if (-not $proxyOk) {
    Start-Process -FilePath 'bun' `
        -ArgumentList 'run','deepseek-proxy.ts' `
        -WorkingDirectory 'D:\DSXU-code' `
        -WindowStyle Minimized
    Write-Host '[start-claude] Waiting for proxy to come up...' -ForegroundColor Yellow
    $ready = $false
    for ($i = 0; $i -lt 15; $i++) {
        Start-Sleep -Milliseconds 500
        try {
            $r = Invoke-WebRequest -Uri 'http://localhost:8082/health' -TimeoutSec 1 -UseBasicParsing
            if ($r.StatusCode -eq 200) { $ready = $true; break }
        } catch {}
    }
    if (-not $ready) {
        Write-Host '[start-claude] ERROR: proxy did not start within 7.5s' -ForegroundColor Red
        Write-Host 'Run `bun run deepseek-proxy.ts` manually to see the error.' -ForegroundColor Red
        exit 1
    }
    Write-Host '[start-claude] Proxy is up' -ForegroundColor Green
}

# ── 4. 启动 Claude Code ──
Write-Host '[start-claude] Launching Claude Code...' -ForegroundColor Cyan
Write-Host ''
bun run ./src/entrypoints/cli.tsx $args
