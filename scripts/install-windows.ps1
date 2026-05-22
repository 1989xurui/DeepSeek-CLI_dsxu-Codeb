param(
  [string]$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")),
  [string]$WslDistro = "Ubuntu",
  [switch]$InstallWsl,
  [switch]$NoDependencies,
  [switch]$NoDesktopShortcut,
  [switch]$NoWslShortcut,
  [switch]$CreateWslShortcut,
  [switch]$NoWindowsTerminalInstall,
  [switch]$NoPathShim,
  [switch]$NoLaunch,
  [switch]$InstallVsCodeExtension
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

function Add-UserPathIfMissing([string]$PathToAdd) {
  if (-not $PathToAdd) { return }
  $current = [Environment]::GetEnvironmentVariable("Path", "User")
  $parts = @()
  if ($current) {
    $parts = $current -split ";" | Where-Object { $_ -ne "" }
  }
  if ($parts -notcontains $PathToAdd) {
    $newPath = if ($current) { "$current;$PathToAdd" } else { $PathToAdd }
    try {
      [Environment]::SetEnvironmentVariable("Path", $newPath, "User")
      Write-Host "[DSXU] Added to user PATH: $PathToAdd"
    } catch {
      Write-Warning "[DSXU] Could not update user PATH: $($_.Exception.Message)"
      Write-Warning "[DSXU] The dsxu-code.cmd shim was still created at: $PathToAdd"
      Write-Warning "[DSXU] You can use the desktop shortcut or Start-DSXU-Code.cmd without PATH."
    }
  }
}

function Get-DsxuWslDistro {
  $preferred = $env:DSXU_WSL_DISTRO
  if ($preferred) { return $preferred }
  if (-not (Get-Command wsl.exe -ErrorAction SilentlyContinue)) { return $null }
  $distros = @(wsl.exe -l -q 2>$null | ForEach-Object { ($_ -replace "`0", "").Trim() } | Where-Object { $_ })
  if ($distros.Count -gt 0) { return $distros[0] }
  return $null
}

function Get-DsxuWindowsTerminal {
  $cmd = Get-Command wt.exe -ErrorAction SilentlyContinue
  if ($cmd) { return $cmd }

  $windowsAppsWt = Join-Path $env:LOCALAPPDATA "Microsoft\WindowsApps\wt.exe"
  if (Test-Path -LiteralPath $windowsAppsWt) {
    return [pscustomobject]@{ Source = $windowsAppsWt }
  }

  $packageRoots = @(
    (Join-Path $env:LOCALAPPDATA "Microsoft\WindowsApps"),
    (Join-Path $env:ProgramFiles "WindowsApps")
  )
  foreach ($root in $packageRoots) {
    if (-not (Test-Path -LiteralPath $root)) { continue }
    $candidate = Get-ChildItem -LiteralPath $root -Filter "wt.exe" -Recurse -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($candidate) { return [pscustomobject]@{ Source = $candidate.FullName } }
  }
  return $null
}

function Install-DsxuWindowsTerminalIfMissing {
  if (Get-DsxuWindowsTerminal) { return }
  if ($NoWindowsTerminalInstall) {
    Write-Warning "[DSXU] Windows Terminal was not found. The launcher will use ASCII fallback mode in classic console."
    return
  }
  $winget = Get-Command winget.exe -ErrorAction SilentlyContinue
  if (-not $winget) {
    Write-Warning "[DSXU] Windows Terminal was not found and winget is unavailable. The launcher will use ASCII fallback mode in classic console."
    return
  }

  Write-Host "[DSXU] Windows Terminal was not found. Installing Microsoft Windows Terminal with winget..."
  & $winget.Source install --id Microsoft.WindowsTerminal -e --accept-package-agreements --accept-source-agreements --disable-interactivity
  if ($LASTEXITCODE -ne 0) {
    Write-Warning "[DSXU] Windows Terminal install failed with exit code $LASTEXITCODE. The launcher will use ASCII fallback mode in classic console."
    return
  }
  Write-Host "[DSXU] Windows Terminal install finished. If Windows does not expose wt.exe immediately, reopen PowerShell and launch DSXU Code again."
  if (-not (Get-DsxuWindowsTerminal)) {
    Write-Warning "[DSXU] Windows Terminal installed, but wt.exe is not visible to this shell yet. Reopen PowerShell or sign out/in before launching DSXU Code."
  }
}

function Ensure-DsxuWsl([string]$DistroName) {
  if (-not (Get-Command wsl.exe -ErrorAction SilentlyContinue)) {
    throw "[DSXU] wsl.exe was not found. Enable WSL from an elevated PowerShell: wsl --install -d $DistroName"
  }

  $existing = Get-DsxuWslDistro
  if ($existing) {
    Write-Host "[DSXU] WSL distro detected: $existing"
    return
  }

  Write-Host "[DSXU] Installing WSL distro: $DistroName"
  Write-Host "[DSXU] This may require administrator approval, Microsoft Store access, or a reboot."
  wsl.exe --install -d $DistroName
  if ($LASTEXITCODE -ne 0) {
    throw "[DSXU] WSL install command failed with exit code $LASTEXITCODE. You can retry later with: wsl --install -d $DistroName"
  }
  Write-Host "[DSXU] WSL install command finished. If Windows asks for a reboot or first-run Linux user setup, complete that before launching DSXU Code WSL."
}

function New-DsxuShortcut(
  [string]$ShortcutName,
  [string]$ResolvedRepoRoot,
  [string]$Target,
  [string]$Arguments,
  [string]$Description
) {
  $desktop = [Environment]::GetFolderPath("Desktop")
  if (-not $desktop) {
    Write-Warning "[DSXU] Desktop folder not found; shortcut skipped."
    return
  }

  $shortcutPath = Join-Path $desktop $ShortcutName
  $shell = New-Object -ComObject WScript.Shell
  $shortcut = $shell.CreateShortcut($shortcutPath)
  $shortcut.TargetPath = $Target
  $shortcut.Arguments = $Arguments
  $shortcut.WorkingDirectory = $ResolvedRepoRoot
  $shortcut.Description = $Description
  $shortcut.Save()
  Write-Host "[DSXU] Desktop shortcut created: $shortcutPath"
}

function New-DsxuDesktopShortcut([string]$ResolvedRepoRoot) {
  $launcher = Join-Path $ResolvedRepoRoot "Start-DSXU-Code.cmd"
  $wt = Get-DsxuWindowsTerminal

  if ($wt) {
    $target = $wt.Source
    $arguments = "-w new new-tab --title `"DSXU Code`" --startingDirectory `"$ResolvedRepoRoot`" cmd.exe /k `"$launcher`""
  } else {
    $target = "cmd.exe"
    $arguments = "/k `"$launcher`""
  }

  New-DsxuShortcut "DSXU Code.lnk" $ResolvedRepoRoot $target $arguments "Launch DSXU Code with UTF-8 terminal setup"
}

function New-DsxuWslDesktopShortcut([string]$ResolvedRepoRoot) {
  $launcher = Join-Path $ResolvedRepoRoot "Start-DSXU-Code-WSL.cmd"
  if (-not (Test-Path -LiteralPath $launcher)) {
    Write-Warning "[DSXU] WSL launcher not found; WSL shortcut skipped."
    return
  }

  $wt = Get-DsxuWindowsTerminal
  if ($wt) {
    $target = $wt.Source
    $arguments = "-w new new-tab --title `"DSXU Code WSL`" --startingDirectory `"$ResolvedRepoRoot`" cmd.exe /k `"$launcher`""
  } else {
    $target = "cmd.exe"
    $arguments = "/k `"$launcher`""
  }

  New-DsxuShortcut "DSXU Code WSL.lnk" $ResolvedRepoRoot $target $arguments "Launch DSXU Code through WSL with auto-detected distro/path"
}

function New-DsxuPathShim([string]$ResolvedRepoRoot) {
  $binDir = Join-Path $env:LOCALAPPDATA "DSXU Code\bin"
  New-Item -ItemType Directory -Force -Path $binDir | Out-Null
  $shimPath = Join-Path $binDir "dsxu-code.cmd"
  $startPs1 = Join-Path $ResolvedRepoRoot "scripts\start-dsxu-windows.ps1"
  @"
@echo off
setlocal
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "$startPs1" %*
exit /b %ERRORLEVEL%
"@ | Set-Content -LiteralPath $shimPath -Encoding ASCII
  Add-UserPathIfMissing $binDir
  Write-Host "[DSXU] Command shim created: $shimPath"
}

function Install-DsxuVsCodeExtension([string]$ResolvedRepoRoot) {
  $installer = Join-Path $ResolvedRepoRoot "scripts\install-vscode-extension.ps1"
  if (-not (Test-Path -LiteralPath $installer)) {
    throw "[DSXU] Missing VS Code extension installer: $installer"
  }
  & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $installer -RepoRoot $ResolvedRepoRoot
  if ($LASTEXITCODE -ne 0) {
    throw "[DSXU] VS Code extension install failed with exit code $LASTEXITCODE"
  }
}

function Start-DsxuCliWindow([string]$ResolvedRepoRoot) {
  $launcher = Join-Path $ResolvedRepoRoot "Start-DSXU-Code.cmd"
  if (-not (Test-Path -LiteralPath $launcher)) {
    Write-Warning "[DSXU] CLI launcher not found; auto-open skipped: $launcher"
    return
  }

  $wt = Get-DsxuWindowsTerminal
  if ($wt) {
    $arguments = "-w new new-tab --title `"DSXU Code`" --startingDirectory `"$ResolvedRepoRoot`" cmd.exe /k `"$launcher`""
    Start-Process -FilePath $wt.Source -ArgumentList $arguments | Out-Null
  } else {
    Start-Process -FilePath "cmd.exe" -WorkingDirectory $ResolvedRepoRoot -ArgumentList @("/k", $launcher) | Out-Null
  }

  Write-Host "[DSXU] DSXU Code CLI window opened. First launch without a key shows the DeepSeek key setup flow."
}

Set-DsxuUtf8Console
$resolvedRepoRoot = (Resolve-Path -LiteralPath $RepoRoot).Path
Set-Location -LiteralPath $resolvedRepoRoot

if (-not (Get-Command bun -ErrorAction SilentlyContinue)) {
  throw "[DSXU] Bun was not found. Install Bun first: powershell -c `"irm https://bun.sh/install.ps1 | iex`", reopen PowerShell, then rerun scripts\install-windows.ps1."
}

Install-DsxuWindowsTerminalIfMissing

if ($InstallWsl) {
  Ensure-DsxuWsl $WslDistro
}

if (-not $NoDependencies) {
  Write-Host "[DSXU] Installing dependencies with Bun..."
  bun install --frozen-lockfile
  if ($LASTEXITCODE -ne 0) {
    throw "[DSXU] bun install failed with exit code $LASTEXITCODE"
  }
}

if (-not $NoPathShim) {
  New-DsxuPathShim $resolvedRepoRoot
}

if (-not $NoDesktopShortcut) {
  New-DsxuDesktopShortcut $resolvedRepoRoot
  $wslDistroForShortcut = Get-DsxuWslDistro
  $shouldCreateWslShortcut = (-not $NoWslShortcut) -and ($CreateWslShortcut -or $InstallWsl -or [bool]$wslDistroForShortcut)
  if ($shouldCreateWslShortcut) {
    New-DsxuWslDesktopShortcut $resolvedRepoRoot
  } else {
    Write-Host "[DSXU] WSL shortcut skipped: no WSL distro was requested or detected. Use -CreateWslShortcut or -InstallWsl if you want the optional WSL entry."
  }
}

if ($InstallVsCodeExtension) {
  Install-DsxuVsCodeExtension $resolvedRepoRoot
}

if (-not $NoLaunch) {
  Start-DsxuCliWindow $resolvedRepoRoot
} else {
  Write-Host "[DSXU] Auto-open skipped because -NoLaunch was specified."
}

Write-Host ""
Write-Host "[DSXU] Install complete."
Write-Host "[DSXU] Start from desktop shortcut, Start-DSXU-Code.cmd, or: dsxu-code"
Write-Host "[DSXU] Windows default is the native DSXU Code shortcut. WSL is optional and never required for first launch."
Write-Host "[DSXU] Windows Terminal is recommended for Chinese/Unicode TUI. Classic console falls back to ASCII TUI mode."
Write-Host "[DSXU] First launch without a key opens the DeepSeek key setup flow."
Write-Host "[DSXU] Optional VS Code adapter: powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\install-vscode-extension.ps1"
