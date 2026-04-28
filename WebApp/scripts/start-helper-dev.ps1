$ErrorActionPreference = "Stop"

Set-Location (Resolve-Path (Join-Path $PSScriptRoot ".."))
$env:DSA_HELPER_TOKEN = "local-dev-37891-token"
node helper/server.cjs *> helper.out.log
