$ErrorActionPreference = 'Stop'

$webRoot = Resolve-Path (Join-Path $PSScriptRoot '..')
$packageDir = Join-Path $webRoot 'dist\native-light\disk_storage_analyzer-win32-x64'
$exePath = Join-Path $packageDir 'disk_storage_analyzer.exe'
$sourcePath = Join-Path $webRoot 'native-light\DiskStorageAnalyzerHelper.cs'
$embeddedSourcePath = Join-Path $webRoot 'native-light\EmbeddedAssets.generated.cs'
$csc = Join-Path $env:WINDIR 'Microsoft.NET\Framework64\v4.0.30319\csc.exe'

if (-not (Test-Path $csc)) {
  throw "C# compiler not found: $csc"
}

Push-Location $webRoot
npm.cmd run build
Pop-Location

$resolvedWeb = [System.IO.Path]::GetFullPath($webRoot)
$resolvedPackage = [System.IO.Path]::GetFullPath($packageDir)
if (-not $resolvedPackage.StartsWith($resolvedWeb, [System.StringComparison]::OrdinalIgnoreCase)) {
  throw "Refusing to write outside WebApp: $resolvedPackage"
}

New-Item -ItemType Directory -Force -Path $packageDir | Out-Null
Get-ChildItem -LiteralPath $packageDir -Force | Remove-Item -Recurse -Force

$assetFiles = @(
  @{ Source = Join-Path $webRoot 'helper\server.cjs'; Target = 'helper\server.cjs' },
  @{ Source = Join-Path $webRoot 'scripts\web-static-server.cjs'; Target = 'scripts\web-static-server.cjs' },
  @{ Source = Join-Path $webRoot 'dist\index.html'; Target = 'dist\index.html' }
)

Get-ChildItem -Path (Join-Path $webRoot 'dist\assets') -File | ForEach-Object {
  $assetFiles += @{ Source = $_.FullName; Target = "dist\assets\$($_.Name)" }
}

$builder = New-Object System.Text.StringBuilder
[void]$builder.AppendLine('using System;')
[void]$builder.AppendLine('using System.IO;')
[void]$builder.AppendLine('namespace DiskStorageAnalyzer')
[void]$builder.AppendLine('{')
[void]$builder.AppendLine('    public static class EmbeddedAssets')
[void]$builder.AppendLine('    {')
[void]$builder.AppendLine('        public static void WriteTo(string root)')
[void]$builder.AppendLine('        {')
[void]$builder.AppendLine('            if (Directory.Exists(root)) Directory.Delete(root, true);')
[void]$builder.AppendLine('            Directory.CreateDirectory(root);')

foreach ($asset in $assetFiles) {
  $bytes = [System.IO.File]::ReadAllBytes($asset.Source)
  $base64 = [Convert]::ToBase64String($bytes)
  $target = $asset.Target.Replace('\', '\\')
  [void]$builder.AppendLine("            WriteFile(root, @`"$target`", @`"$base64`");")
}

[void]$builder.AppendLine('        }')
[void]$builder.AppendLine('        private static void WriteFile(string root, string relativePath, string base64)')
[void]$builder.AppendLine('        {')
[void]$builder.AppendLine('            string path = Path.Combine(root, relativePath);')
[void]$builder.AppendLine('            Directory.CreateDirectory(Path.GetDirectoryName(path));')
[void]$builder.AppendLine('            File.WriteAllBytes(path, Convert.FromBase64String(base64));')
[void]$builder.AppendLine('        }')
[void]$builder.AppendLine('    }')
[void]$builder.AppendLine('}')

[System.IO.File]::WriteAllText($embeddedSourcePath, $builder.ToString(), [System.Text.Encoding]::UTF8)

& $csc /nologo /target:winexe /platform:x64 /optimize+ `
  /reference:System.dll `
  /reference:System.Drawing.dll `
  /reference:System.Windows.Forms.dll `
  /out:$exePath `
  $sourcePath `
  $embeddedSourcePath

Write-Host "Created: $exePath"
