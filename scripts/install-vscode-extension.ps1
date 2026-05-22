param(
  [string]$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")),
  [switch]$Insiders,
  [switch]$UseVsix
)

$ErrorActionPreference = "Stop"

$resolvedRepoRoot = (Resolve-Path -LiteralPath $RepoRoot).Path
$source = Join-Path $resolvedRepoRoot "integrations\vscode"
if (-not (Test-Path -LiteralPath (Join-Path $source "package.json"))) {
  throw "[DSXU] VS Code extension source not found: $source"
}

$package = Get-Content -LiteralPath (Join-Path $source "package.json") -Raw | ConvertFrom-Json
$extensionId = "$($package.publisher).$($package.name)"
$extensionFolderName = "$extensionId-$($package.version)"
$extensionsRootName = if ($Insiders) { ".vscode-insiders\extensions" } else { ".vscode\extensions" }
$extensionsRoot = Join-Path $HOME $extensionsRootName
$target = Join-Path $extensionsRoot $extensionFolderName

function Remove-DsxuVsCodeObsoleteMarker([string]$Root, [string]$FolderName) {
  $obsoletePath = Join-Path $Root ".obsolete"
  if (-not (Test-Path -LiteralPath $obsoletePath)) { return }
  try {
    $raw = Get-Content -LiteralPath $obsoletePath -Raw
    if (-not $raw.Trim()) { return }
    $obj = $raw | ConvertFrom-Json
    if ($obj.PSObject.Properties.Name -contains $FolderName) {
      $obj.PSObject.Properties.Remove($FolderName)
      $obj | ConvertTo-Json -Compress | Set-Content -LiteralPath $obsoletePath -Encoding ASCII
      Write-Host "[DSXU] Removed stale VS Code obsolete marker: $FolderName"
    }
  } catch {
    Write-Warning "[DSXU] Could not update VS Code obsolete marker: $($_.Exception.Message)"
  }
}

function Get-DsxuCodeCli([switch]$UseInsiders) {
  if ($UseInsiders) {
    $cmd = Get-Command code-insiders.cmd -ErrorAction SilentlyContinue
    if ($cmd) { return $cmd.Source }
    $cmd = Get-Command code-insiders -ErrorAction SilentlyContinue
    if ($cmd) { return $cmd.Source }
  }

  $command = Get-Command code.cmd -ErrorAction SilentlyContinue
  if ($command) { return $command.Source }
  $command = Get-Command code -ErrorAction SilentlyContinue
  if ($command) { return $command.Source }

  $candidates = @(
    "$env:LOCALAPPDATA\Programs\Microsoft VS Code\bin\code.cmd",
    "$env:LOCALAPPDATA\Programs\Microsoft VS Code\Code.exe",
    "$env:ProgramFiles\Microsoft VS Code\bin\code.cmd",
    "$env:ProgramFiles\Microsoft VS Code\Code.exe",
    "${env:ProgramFiles(x86)}\Microsoft VS Code\bin\code.cmd",
    "${env:ProgramFiles(x86)}\Microsoft VS Code\Code.exe"
  )
  foreach ($candidate in $candidates) {
    if ($candidate -and (Test-Path -LiteralPath $candidate)) { return $candidate }
  }
  return $null
}

function Test-DsxuVsCodeRunning([switch]$UseInsiders) {
  $names = if ($UseInsiders) { @("Code - Insiders", "Code - Insiders") } else { @("Code") }
  foreach ($name in $names) {
    if (Get-Process -Name $name -ErrorAction SilentlyContinue) { return $true }
  }
  return $false
}

function Install-DsxuVsCodeSourceCopy(
  [string]$SourceDir,
  [string]$TargetDir,
  [string]$ExtensionsRootDir,
  [string]$FolderName
) {
  New-Item -ItemType Directory -Force -Path $TargetDir | Out-Null
  $files = @("package.json", "extension.js", "README.md", "CHANGELOG.md", ".vscodeignore")
  foreach ($file in $files) {
    Copy-Item -LiteralPath (Join-Path $SourceDir $file) -Destination (Join-Path $TargetDir $file) -Force
  }
  Remove-DsxuVsCodeObsoleteMarker $ExtensionsRootDir $FolderName
  Write-Host "[DSXU] VS Code extension source-copied to: $TargetDir"
  Write-Host "[DSXU] Reload VS Code, then run: DSXU Code: Open"
  Write-Host "[DSXU] If your DSXU checkout is not the opened workspace, set dsxuCode.repoPath."
}

function New-DsxuVsix([string]$SourceDir, [object]$Package, [string]$OutDir) {
  $staging = Join-Path $OutDir "vscode-vsix-staging"
  $extensionStaging = Join-Path $staging "extension"
  $vsixPath = Join-Path $OutDir "$($Package.name)-$($Package.version).vsix"
  $zipPath = Join-Path $OutDir "$($Package.name)-$($Package.version).zip"

  if (Test-Path -LiteralPath $staging) { Remove-Item -LiteralPath $staging -Recurse -Force }
  if (Test-Path -LiteralPath $vsixPath) { Remove-Item -LiteralPath $vsixPath -Force }
  if (Test-Path -LiteralPath $zipPath) { Remove-Item -LiteralPath $zipPath -Force }
  New-Item -ItemType Directory -Force -Path $extensionStaging | Out-Null

  $files = @("package.json", "extension.js", "README.md", "CHANGELOG.md", ".vscodeignore")
  foreach ($file in $files) {
    Copy-Item -LiteralPath (Join-Path $SourceDir $file) -Destination (Join-Path $extensionStaging $file) -Force
  }

  @"
<?xml version="1.0" encoding="utf-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="json" ContentType="application/json" />
  <Default Extension="js" ContentType="application/javascript" />
  <Default Extension="md" ContentType="text/markdown" />
  <Default Extension="vsixmanifest" ContentType="text/xml" />
  <Default Extension="xml" ContentType="text/xml" />
</Types>
"@ | Set-Content -LiteralPath (Join-Path $staging "[Content_Types].xml") -Encoding UTF8

  $description = [System.Security.SecurityElement]::Escape([string]$Package.description)
  $displayName = [System.Security.SecurityElement]::Escape([string]$Package.displayName)
  @"
<?xml version="1.0" encoding="utf-8"?>
<PackageManifest Version="2.0.0" xmlns="http://schemas.microsoft.com/developer/vsx-schema/2011">
  <Metadata>
    <Identity Language="en-US" Id="$($Package.name)" Version="$($Package.version)" Publisher="$($Package.publisher)" />
    <DisplayName>$displayName</DisplayName>
    <Description xml:space="preserve">$description</Description>
    <Categories>Other</Categories>
    <Tags>DSXU,DeepSeek,AI,Coding</Tags>
  </Metadata>
  <Installation>
    <InstallationTarget Id="Microsoft.VisualStudio.Code" />
  </Installation>
  <Dependencies />
  <Assets>
    <Asset Type="Microsoft.VisualStudio.Code.Manifest" Path="extension/package.json" Addressable="true" />
    <Asset Type="Microsoft.VisualStudio.Code.Content" Path="extension/extension.js" Addressable="true" />
    <Asset Type="Microsoft.VisualStudio.Code.Content" Path="extension/README.md" Addressable="true" />
    <Asset Type="Microsoft.VisualStudio.Code.Content" Path="extension/CHANGELOG.md" Addressable="true" />
  </Assets>
</PackageManifest>
"@ | Set-Content -LiteralPath (Join-Path $staging "extension.vsixmanifest") -Encoding UTF8

  Compress-Archive -Path (Join-Path $staging "*") -DestinationPath $zipPath -Force
  Move-Item -LiteralPath $zipPath -Destination $vsixPath -Force
  return $vsixPath
}

New-Item -ItemType Directory -Force -Path $extensionsRoot | Out-Null
if (-not $UseVsix) {
  Write-Host "[DSXU] Installing VS Code extension by source-copy for a stable source-checkout install."
  Install-DsxuVsCodeSourceCopy $source $target $extensionsRoot $extensionFolderName
  exit 0
}

if (Test-DsxuVsCodeRunning -UseInsiders:$Insiders) {
  Write-Host "[DSXU] VS Code is currently running; using source-copy install to avoid VSIX reinstall lock."
  Install-DsxuVsCodeSourceCopy $source $target $extensionsRoot $extensionFolderName
  exit 0
}

if (Test-Path -LiteralPath $target) {
  Remove-Item -LiteralPath $target -Recurse -Force
}
Remove-DsxuVsCodeObsoleteMarker $extensionsRoot $extensionFolderName

$dist = Join-Path $resolvedRepoRoot "dist"
New-Item -ItemType Directory -Force -Path $dist | Out-Null
$vsix = New-DsxuVsix $source $package $dist
$codeCli = Get-DsxuCodeCli -UseInsiders:$Insiders

if ($codeCli) {
  Write-Host "[DSXU] Installing VS Code extension via VSIX: $vsix"
  & $codeCli --install-extension $vsix --force
  if ($LASTEXITCODE -eq 0) {
    Remove-DsxuVsCodeObsoleteMarker $extensionsRoot $extensionFolderName
    Write-Host "[DSXU] VS Code extension installed through Code CLI: $extensionId@$($package.version)"
    Write-Host "[DSXU] Reload VS Code, then run: DSXU Code: Open"
    Write-Host "[DSXU] If your DSXU checkout is not the opened workspace, set dsxuCode.repoPath."
    exit 0
  }
  Write-Warning "[DSXU] Code CLI install failed with exit code $LASTEXITCODE; falling back to source-copy install."
}

Install-DsxuVsCodeSourceCopy $source $target $extensionsRoot $extensionFolderName
