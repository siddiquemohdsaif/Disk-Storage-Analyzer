$ErrorActionPreference = 'Stop'

$projectRoot = Resolve-Path (Join-Path $PSScriptRoot '..')
$electronDist = Join-Path $projectRoot 'node_modules\electron\dist'
$packageDir = Join-Path $projectRoot 'dist\package\Disk Storage Analyser-win32-x64'
$appDir = Join-Path $packageDir 'resources\app'
$exePath = Join-Path $packageDir 'Disk Storage Analyser.exe'

if (-not (Test-Path $electronDist)) {
  throw "Electron runtime not found. Run npm.cmd install first."
}

$resolvedProject = [System.IO.Path]::GetFullPath($projectRoot)
$resolvedPackage = [System.IO.Path]::GetFullPath($packageDir)
if (-not $resolvedPackage.StartsWith($resolvedProject, [System.StringComparison]::OrdinalIgnoreCase)) {
  throw "Refusing to write outside the project folder: $resolvedPackage"
}

New-Item -ItemType Directory -Force -Path $packageDir | Out-Null
Get-ChildItem -LiteralPath $packageDir -Force | Remove-Item -Recurse -Force
Copy-Item -Path (Join-Path $electronDist '*') -Destination $packageDir -Recurse -Force

if (Test-Path $appDir) {
  Remove-Item -LiteralPath $appDir -Recurse -Force
}

New-Item -ItemType Directory -Force -Path $appDir | Out-Null
Copy-Item -Path (Join-Path $projectRoot 'src') -Destination $appDir -Recurse -Force
Copy-Item -Path (Join-Path $projectRoot 'package.json') -Destination $appDir -Force
Copy-Item -Path (Join-Path $projectRoot 'package-lock.json') -Destination $appDir -Force
Copy-Item -Path (Join-Path $projectRoot 'README.md') -Destination $appDir -Force

$electronExe = Join-Path $packageDir 'electron.exe'
if (Test-Path $exePath) {
  Remove-Item -LiteralPath $exePath -Force
}
Rename-Item -LiteralPath $electronExe -NewName 'Disk Storage Analyser.exe'

Write-Host "Created: $exePath"
