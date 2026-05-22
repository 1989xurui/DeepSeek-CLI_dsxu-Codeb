param(
  [switch]$InstallWsl,
  [string]$WslDistro = "Ubuntu",
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

if (-not $IsWindows -and $PSVersionTable.PSEdition -eq "Core") {
  Write-Host "[DSXU] Non-Windows PowerShell detected."
  Write-Host "[DSXU] Use the Unix installer instead:"
  Write-Host "       bash ./scripts/install.sh"
  exit 0
}

$repoRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$installer = Join-Path $repoRoot "scripts\install-windows.ps1"

if (-not (Test-Path -LiteralPath $installer)) {
  throw "[DSXU] Missing Windows installer: $installer"
}

$installParams = @{
  RepoRoot = $repoRoot
  WslDistro = $WslDistro
}
if ($InstallWsl) { $installParams.InstallWsl = $true }
if ($NoDependencies) { $installParams.NoDependencies = $true }
if ($NoDesktopShortcut) { $installParams.NoDesktopShortcut = $true }
if ($NoWslShortcut) { $installParams.NoWslShortcut = $true }
if ($CreateWslShortcut) { $installParams.CreateWslShortcut = $true }
if ($NoWindowsTerminalInstall) { $installParams.NoWindowsTerminalInstall = $true }
if ($NoPathShim) { $installParams.NoPathShim = $true }
if ($NoLaunch) { $installParams.NoLaunch = $true }
if ($InstallVsCodeExtension) { $installParams.InstallVsCodeExtension = $true }

& $installer @installParams
exit $LASTEXITCODE
