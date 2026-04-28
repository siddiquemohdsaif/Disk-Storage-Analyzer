param(
  [int]$HelperPort = 37891,
  [int]$WebPort = 5173
)

$ErrorActionPreference = "Stop"

function Get-FreeLocalPort {
  param([int]$PreferredPort)

  for ($port = $PreferredPort; $port -lt ($PreferredPort + 100); $port++) {
    $listener = $null
    try {
      $listener = New-Object System.Net.Sockets.TcpListener([System.Net.IPAddress]::Parse("127.0.0.1"), $port)
      $listener.Start()
      $listener.Stop()
      return $port
    } catch {
      if ($listener -ne $null) {
        try {
          $listener.Stop()
        } catch {
        }
      }
    }
  }

  throw "Could not find a free localhost port near $PreferredPort."
}

function Open-AppBrowser {
  param([string]$Url)

  $browserCommands = @("msedge.exe", "chrome.exe", "firefox.exe")
  foreach ($browserCommand in $browserCommands) {
    $command = Get-Command $browserCommand -ErrorAction SilentlyContinue
    if ($command) {
      Start-Process $command.Source -ArgumentList $Url
      return
    }
  }

  Start-Process $Url
}

$webRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$requestedHelperPort = $HelperPort
$requestedWebPort = $WebPort
$HelperPort = Get-FreeLocalPort $HelperPort
$WebPort = Get-FreeLocalPort $WebPort
$helperUrl = "http://127.0.0.1:$HelperPort"
$webUrl = "http://127.0.0.1:$WebPort"
$tokenBytes = [byte[]]::new(18)
$rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
try {
  $rng.GetBytes($tokenBytes)
} finally {
  $rng.Dispose()
}
$token = [Convert]::ToBase64String($tokenBytes).TrimEnd("=").Replace("+", "-").Replace("/", "_")
$allowedOrigins = "http://localhost:$WebPort,http://127.0.0.1:$WebPort"

if (-not (Test-Path (Join-Path $webRoot "node_modules"))) {
  Write-Host "Installing web dependencies..."
  Push-Location $webRoot
  npm.cmd install
  Pop-Location
}

Write-Host "Building web app..."
Push-Location $webRoot
npm.cmd run build
Pop-Location

$helperCommand = @"
`$env:DSA_HELPER_PORT='$HelperPort'
`$env:DSA_HELPER_TOKEN='$token'
`$env:DSA_ALLOWED_ORIGINS='$allowedOrigins'
Set-Location '$webRoot'
npm.cmd run helper:start
"@

$webCommand = @"
Set-Location '$webRoot'
`$env:DSA_WEB_PORT='$WebPort'
node scripts/web-static-server.cjs
"@

Start-Process powershell.exe -ArgumentList "-NoExit", "-ExecutionPolicy", "Bypass", "-Command", $helperCommand
Start-Sleep -Seconds 1
Start-Process powershell.exe -ArgumentList "-NoExit", "-ExecutionPolicy", "Bypass", "-Command", $webCommand

Write-Host "Starting Disk Storage Analyser web app..."
if ($HelperPort -ne $requestedHelperPort) {
  Write-Host "Helper port $requestedHelperPort is busy, using $HelperPort instead."
}
if ($WebPort -ne $requestedWebPort) {
  Write-Host "Web port $requestedWebPort is busy, using $WebPort instead."
}
Write-Host "Helper: $helperUrl"
Write-Host "Web UI: $webUrl"
Write-Host "Pairing token: $token"

$deadline = (Get-Date).AddSeconds(25)
do {
  try {
    $response = Invoke-WebRequest -Uri $webUrl -UseBasicParsing -TimeoutSec 2
    if ($response.StatusCode -lt 500) {
      break
    }
  } catch {
    Start-Sleep -Milliseconds 600
  }
} while ((Get-Date) -lt $deadline)

$openUrl = "$webUrl/?helperUrl=$([System.Uri]::EscapeDataString($helperUrl))&token=$([System.Uri]::EscapeDataString($token))"
Open-AppBrowser $openUrl

Write-Host ""
Write-Host "Opened browser. Keep the helper and web server PowerShell windows open while using the app."
