param(
  [Parameter(ValueFromRemainingArguments = $true)]
  [string[]]$DsxuArgs
)

$ErrorActionPreference = "Stop"

function Set-DsxuUtf8Console {
  try {
    $utf8NoBom = New-Object System.Text.UTF8Encoding $false
    [Console]::InputEncoding = $utf8NoBom
    [Console]::OutputEncoding = $utf8NoBom
    $script:OutputEncoding = $utf8NoBom
  } catch {
    Write-Warning "[DSXU] Could not set .NET console encoding: $($_.Exception.Message)"
  }

  try {
    chcp.com 65001 > $null
  } catch {
    Write-Warning "[DSXU] Could not switch console code page to UTF-8: $($_.Exception.Message)"
  }
}

function Add-DsxuBunPath {
  $candidates = @(
    (Join-Path $env:USERPROFILE ".bun\bin"),
    (Join-Path $env:LOCALAPPDATA "Programs\Bun\bin")
  )

  foreach ($candidate in $candidates) {
    if ($candidate -and (Test-Path -LiteralPath $candidate)) {
      $env:Path = "$candidate;$env:Path"
    }
  }
}

function Get-DsxuWindowsTerminalPath {
  if ($env:DSXU_TEST_DISABLE_WT_LOOKUP) { return $null }

  $cmd = Get-Command wt.exe -ErrorAction SilentlyContinue
  if ($cmd) { return $cmd.Source }

  $windowsAppsWt = Join-Path $env:LOCALAPPDATA "Microsoft\WindowsApps\wt.exe"
  if (Test-Path -LiteralPath $windowsAppsWt) { return $windowsAppsWt }

  $packageRoots = @(
    (Join-Path $env:LOCALAPPDATA "Microsoft\WindowsApps"),
    (Join-Path $env:ProgramFiles "WindowsApps")
  )
  foreach ($root in $packageRoots) {
    if (-not (Test-Path -LiteralPath $root)) { continue }
    $candidate = Get-ChildItem -LiteralPath $root -Filter "wt.exe" -Recurse -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($candidate) { return $candidate.FullName }
  }
  return $null
}

function Start-DsxuInWindowsTerminal([string]$ResolvedRepoRoot) {
  $wt = Get-DsxuWindowsTerminalPath
  if (-not $wt) { return $false }

  $launcher = Join-Path $ResolvedRepoRoot "Start-DSXU-Code.cmd"
  if (-not (Test-Path -LiteralPath $launcher)) { return $false }

  $cmdLine = "set `"DSXU_FORCE_CONHOST=1`" && call `"$launcher`""
  $arguments = @(
    '-w', 'new',
    'new-tab',
    '--title', 'DSXU Code',
    '--startingDirectory', $ResolvedRepoRoot,
    '--',
    'cmd.exe',
    '/k',
    $cmdLine
  )
  Start-Process -FilePath $wt -ArgumentList $arguments | Out-Null
  return $true
}

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location -LiteralPath $repoRoot

Set-DsxuUtf8Console
Add-DsxuBunPath

$isInteractiveLaunch = $DsxuArgs.Count -eq 0
$isTrustedTerminal = $env:WT_SESSION -or ($env:TERM_PROGRAM -and $env:TERM_PROGRAM.ToLowerInvariant() -eq "vscode") -or $env:VSCODE_PID

if (-not $isTrustedTerminal) {
  if ($isInteractiveLaunch -and -not $env:DSXU_ALLOW_CONHOST) {
    if (Start-DsxuInWindowsTerminal $repoRoot) {
      Write-Host "[DSXU] Relaunched DSXU Code in Windows Terminal for Chinese/Unicode input."
      exit 0
    }

    Write-Host "[DSXU] Windows Terminal was not detected."
    Write-Host "[DSXU] Interactive DSXU Code needs Windows Terminal or VS Code terminal for Chinese/Unicode input."
    Write-Host "[DSXU] Classic console can turn Chinese input into '?' before DSXU receives it."
    Write-Host "[DSXU] Run install.ps1 again or install Windows Terminal:"
    Write-Host "       winget install --id Microsoft.WindowsTerminal -e"
    Write-Host "[DSXU] For an English/ASCII emergency session only, set DSXU_ALLOW_CONHOST=1."
    exit 2
  }

  $env:DSXU_ASCII_TUI = if ($env:DSXU_ASCII_TUI) { $env:DSXU_ASCII_TUI } else { "1" }
}

$env:DSXU_CODE_MODE = "1"
$env:DSXU_PRODUCT_NAME = if ($env:DSXU_PRODUCT_NAME) { $env:DSXU_PRODUCT_NAME } else { "DSXU Code" }
$env:DSXU_MODEL_PROVIDER = if ($env:DSXU_MODEL_PROVIDER) { $env:DSXU_MODEL_PROVIDER } else { "deepseek" }
$env:DSXU_MODEL_GATEWAY = if ($env:DSXU_MODEL_GATEWAY) { $env:DSXU_MODEL_GATEWAY } else { "direct" }
$env:DSXU_MODEL = if ($env:DSXU_MODEL) { $env:DSXU_MODEL } else { "deepseek-v4-flash" }
$env:LANG = if ($env:LANG) { $env:LANG } else { "zh_CN.UTF-8" }
$env:LC_ALL = if ($env:LC_ALL) { $env:LC_ALL } else { "zh_CN.UTF-8" }
$env:PYTHONIOENCODING = if ($env:PYTHONIOENCODING) { $env:PYTHONIOENCODING } else { "utf-8" }
$env:TERM = if ($env:TERM) { $env:TERM } else { "xterm-256color" }
$env:COLORTERM = if ($env:COLORTERM) { $env:COLORTERM } else { "truecolor" }
$env:FORCE_COLOR = if ($env:FORCE_COLOR) { $env:FORCE_COLOR } else { "1" }

if (-not (Get-Command bun -ErrorAction SilentlyContinue)) {
  Write-Error "[DSXU] Bun was not found. Install Bun from https://bun.sh, reopen the terminal, then run Start-DSXU-Code.cmd again."
  exit 127
}

& bun --env-file=.env ./src/entrypoints/dsxu-code.tsx @DsxuArgs
exit $LASTEXITCODE
