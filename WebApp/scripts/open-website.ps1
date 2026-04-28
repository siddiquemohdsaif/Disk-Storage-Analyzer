param(
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
$requestedWebPort = $WebPort
$WebPort = Get-FreeLocalPort $WebPort
$webUrl = "http://127.0.0.1:$WebPort"

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

$webCommand = @"
Set-Location '$webRoot'
`$env:DSA_WEB_PORT='$WebPort'
node scripts/web-static-server.cjs
"@

Start-Process powershell.exe -ArgumentList "-NoExit", "-ExecutionPolicy", "Bypass", "-Command", $webCommand

if ($WebPort -ne $requestedWebPort) {
  Write-Host "Web port $requestedWebPort is busy, using $WebPort instead."
}

Write-Host "Opening Disk Storage Analyser web app..."
Write-Host "Web UI: $webUrl"

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

Open-AppBrowser $webUrl

Write-Host ""
Write-Host "Opened website only. Use the Helper Script button in the web app to start disk support."
