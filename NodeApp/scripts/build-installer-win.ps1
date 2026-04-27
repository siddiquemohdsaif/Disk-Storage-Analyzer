$ErrorActionPreference = 'Stop'

$projectRoot = Resolve-Path (Join-Path $PSScriptRoot '..')
$distRoot = Join-Path $projectRoot 'dist'
$appBundle = Join-Path $distRoot 'package\Disk Storage Analyser-win32-x64'
$outputDir = Join-Path $distRoot 'installer'
$issPath = Join-Path $distRoot 'installer\DiskStorageAnalyser.iss'
$iscc = 'C:\Program Files (x86)\Inno Setup 6\ISCC.exe'

if (-not (Test-Path $iscc)) {
  throw "Inno Setup compiler not found. Install Inno Setup 6, then rerun this script."
}

if (-not (Test-Path $appBundle)) {
  throw "Packaged app not found. Run npm.cmd run package:win first."
}

$exePath = Join-Path $appBundle 'Disk Storage Analyser.exe'
if (-not (Test-Path $exePath)) {
  throw "Packaged executable not found: $exePath"
}

New-Item -ItemType Directory -Force -Path $outputDir | Out-Null

$sourcePath = Join-Path $appBundle '*'
$escapedSource = $sourcePath -replace '\\', '\\'
$escapedOutput = $outputDir -replace '\\', '\\'

@"
#define MyAppName "Disk Storage Analyser"
#define MyAppVersion "1.0.0"
#define MyAppPublisher "Disk Storage Analyser"
#define MyAppExeName "Disk Storage Analyser.exe"

[Setup]
AppId={{7C4905D9-70D3-4C70-89C6-D2905500636B}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
DefaultDirName={autopf}\{#MyAppName}
DefaultGroupName={#MyAppName}
DisableProgramGroupPage=no
OutputDir=$escapedOutput
OutputBaseFilename=Disk Storage Analyser Setup
Compression=lzma2
SolidCompression=yes
WizardStyle=modern
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
PrivilegesRequired=admin
UninstallDisplayIcon={app}\{#MyAppExeName}

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"; GroupDescription: "{cm:AdditionalIcons}"; Flags: unchecked

[Files]
Source: "$escapedSource"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
Name: "{group}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; WorkingDir: "{app}"
Name: "{autodesktop}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; WorkingDir: "{app}"; Tasks: desktopicon

[Run]
Filename: "{app}\{#MyAppExeName}"; Description: "{cm:LaunchProgram,{#StringChange(MyAppName, '&', '&&')}}"; Flags: nowait postinstall skipifsilent
"@ | Set-Content -Path $issPath -Encoding UTF8

& $iscc $issPath

$setupExe = Join-Path $outputDir 'Disk Storage Analyser Setup.exe'
if (-not (Test-Path $setupExe)) {
  throw "Installer was not created: $setupExe"
}

Write-Host "Created: $setupExe"
