param(
    [string]$Network = $env:GENLAYER_NETWORK,
    [string]$AccountName = $env:GENLAYER_ACCOUNT_NAME
)

$ErrorActionPreference = "Stop"

if (-not $Network) { $Network = "studionet" }
if (-not $AccountName) { $AccountName = "moment-grid-studionet" }

$RepoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $RepoRoot

Write-Host "Validating MatchMomentResolver before deployment..."
& .\.venv\Scripts\genvm-lint.exe check .\contracts\match_moment_resolver.py
if ($LASTEXITCODE -ne 0) { throw "GenVM lint failed." }

& .\.venv\Scripts\python.exe -m pytest .\tests\direct -q
if ($LASTEXITCODE -ne 0) { throw "Direct Mode tests failed." }

Write-Host "Selecting $Network and encrypted account $AccountName..."
& genlayer network set $Network
if ($LASTEXITCODE -ne 0) { throw "Unable to select network." }
& genlayer account use $AccountName
if ($LASTEXITCODE -ne 0) { throw "Unable to select account." }

Write-Host "Deploying. Enter the keystore password only at the CLI prompt; it is never stored by this script."
& genlayer deploy --contract .\contracts\match_moment_resolver.py
if ($LASTEXITCODE -ne 0) { throw "Deployment failed." }

Write-Host "Record the returned address and transaction hash in deployments/genlayer/studionet.json."
