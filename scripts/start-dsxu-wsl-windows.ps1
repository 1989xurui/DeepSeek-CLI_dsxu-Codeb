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
    Write-Warning "[DSXU] Could not set console encoding: $($_.Exception.Message)"
  }
  try { chcp.com 65001 > $null } catch {}
}

function Get-DsxuWindowsTerminalPath {
  if ($env:DSXU_TEST_DISABLE_WT_LOOKUP) { return $null }
  $cmd = Get-Command wt.exe -ErrorAction SilentlyContinue
  if ($cmd) { return $cmd.Source }
  $windowsAppsWt = Join-Path $env:LOCALAPPDATA "Microsoft\WindowsApps\wt.exe"
  if (Test-Path -LiteralPath $windowsAppsWt) { return $windowsAppsWt }
  return $null
}

function Start-DsxuNativeFallback([string]$ResolvedRepoRoot, [string[]]$ArgsToForward) {
  $native = Join-Path $ResolvedRepoRoot "Start-DSXU-Code.cmd"
  if (-not (Test-Path -LiteralPath $native)) {
    Write-Host "[DSXU] Missing native launcher: $native"
    return 1
  }

  Write-Host "[DSXU] Falling back to the Windows native DSXU launcher."
  & $native @ArgsToForward
  return $LASTEXITCODE
}

function Test-DsxuWslListLine([string]$Line) {
  if (-not $Line) { return $false }
  if ($Line -match '^(Usage:|Settings:|Launches or configures|Print usage|Install the|Run the provided|Configure settings|Sets the default|Do not create|<no args>|install \[|run <|config \[|help$)') {
    return $false
  }
  if ($Line -match 'Windows Subsystem for Linux|distributions|distribution|usage information') {
    return $false
  }
  return $true
}

function Test-DsxuWslDistroCandidate([string]$Distro) {
  if (-not $Distro) { return $false }
  & wsl.exe -d $Distro -- true > $null 2>&1
  return $LASTEXITCODE -eq 0
}

function Get-DsxuWslDistro {
  if ($env:DSXU_WSL_DISTRO) { return $env:DSXU_WSL_DISTRO }
  if ($env:DSXU_TEST_DISABLE_WSL) { return $null }
  if (-not (Get-Command wsl.exe -ErrorAction SilentlyContinue)) { return $null }

  $rawList = @(wsl.exe -l -q 2>$null)
  if ($LASTEXITCODE -ne 0) { return $null }
  $distros = @(
    $rawList |
      ForEach-Object { ($_ -replace "`0", "").Trim() } |
      Where-Object { Test-DsxuWslListLine $_ }
  )
  foreach ($candidate in $distros) {
    if (Test-DsxuWslDistroCandidate $candidate) {
      return $candidate
    }
  }
  return $null
}

function ConvertTo-DsxuWslPath([string]$WindowsPath) {
  $trimmed = $WindowsPath.TrimEnd('\')
  if ($trimmed -match '^([A-Za-z]):\\(.*)$') {
    return "/mnt/" + $matches[1].ToLowerInvariant() + "/" + (($matches[2]) -replace '\\','/')
  }
  return $null
}

function Quote-DsxuBashSingle([string]$Value) {
  return "'" + ($Value -replace "'", "'\''") + "'"
}

function Test-DsxuWslRepo([string]$Distro, [string]$WslRepo) {
  if (-not $Distro -or -not $WslRepo) { return $false }
  $quotedRepo = Quote-DsxuBashSingle $WslRepo
  $probe = "test -d $quotedRepo && test -f $quotedRepo/bin/dsxu-code-wsl-launch"
  & wsl.exe -d $Distro -- bash -lc $probe > $null 2>&1
  return $LASTEXITCODE -eq 0
}

function Start-DsxuWslInline([string]$Distro, [string]$WslRepo, [string[]]$ArgsToForward) {
  $quotedRepo = Quote-DsxuBashSingle $WslRepo
  $quotedArgs = ''
  if ($ArgsToForward.Count -gt 0) {
    $quotedArgs = ' ' + (($ArgsToForward | ForEach-Object { Quote-DsxuBashSingle $_ }) -join ' ')
  }
  $command = "cd $quotedRepo && exec bash ./bin/dsxu-code-wsl-launch$quotedArgs"
  $wslArgLine = "-d `"$Distro`" -- bash -lc `"$command`""
  $process = Start-Process -FilePath "wsl.exe" -ArgumentList $wslArgLine -NoNewWindow -Wait -PassThru
  return $process.ExitCode
}

function Start-DsxuWslInWindowsTerminal([string]$ResolvedRepoRoot, [string[]]$ArgsToForward) {
  if ($env:WT_SESSION -or $env:DSXU_WSL_FORCE_INLINE -or $ArgsToForward.Count -gt 0) { return $false }
  $wt = Get-DsxuWindowsTerminalPath
  if (-not $wt) { return $false }

  $script = Join-Path $ResolvedRepoRoot "scripts\start-dsxu-wsl-windows.ps1"
  $argTail = ''
  if ($ArgsToForward.Count -gt 0) {
    $argTail = ' ' + (($ArgsToForward | ForEach-Object { '"' + ($_ -replace '"', '\"') + '"' }) -join ' ')
  }
  $psCommand = "set DSXU_WSL_FORCE_INLINE=1&& powershell.exe -NoProfile -ExecutionPolicy Bypass -File `"$script`"$argTail"
  $arguments = "-w new new-tab --title `"DSXU Code WSL`" --startingDirectory `"$ResolvedRepoRoot`" -- cmd.exe /k `"$psCommand`""
  Start-Process -FilePath $wt -ArgumentList $arguments | Out-Null
  return $true
}

Set-DsxuUtf8Console
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
Set-Location -LiteralPath $repoRoot

Write-Host "[DSXU] WSL launcher repo: $repoRoot"

if (-not (Get-Command wsl.exe -ErrorAction SilentlyContinue) -or $env:DSXU_TEST_DISABLE_WSL) {
  Write-Host "[DSXU] WSL is not available in this Windows session."
  exit (Start-DsxuNativeFallback $repoRoot $DsxuArgs)
}

$distro = Get-DsxuWslDistro
if (-not $distro) {
  Write-Host "[DSXU] No configured WSL distro was found."
  Write-Host "[DSXU] Run from an elevated PowerShell if you want WSL:"
  Write-Host "       wsl --install -d Ubuntu"
  Write-Host "[DSXU] If Windows asks for a reboot or first-run Linux user setup, finish that before using the WSL launcher."
  exit (Start-DsxuNativeFallback $repoRoot $DsxuArgs)
}

$wslRepo = ConvertTo-DsxuWslPath $repoRoot
if (-not $wslRepo) {
  Write-Host "[DSXU] Could not convert this checkout path to a WSL /mnt path: $repoRoot"
  exit (Start-DsxuNativeFallback $repoRoot $DsxuArgs)
}

if (-not (Test-DsxuWslRepo $distro $wslRepo)) {
  Write-Host "[DSXU] WSL distro detected, but this checkout is not reachable inside WSL:"
  Write-Host "       distro=$distro"
  Write-Host "       wslRepo=$wslRepo"
  Write-Host "[DSXU] If WSL was just installed, complete the reboot/first-run Linux setup first."
  exit (Start-DsxuNativeFallback $repoRoot $DsxuArgs)
}

if (Start-DsxuWslInWindowsTerminal $repoRoot $DsxuArgs) {
  Write-Host "[DSXU] Relaunched DSXU Code WSL in Windows Terminal."
  exit 0
}

exit (Start-DsxuWslInline $distro $wslRepo $DsxuArgs)
