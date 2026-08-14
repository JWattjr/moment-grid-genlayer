param(
    [string]$AccountName = $env:GENLAYER_ACCOUNT_NAME
)

$ErrorActionPreference = "Stop"
if (-not $AccountName) { $AccountName = "moment-grid-studionet" }

$RepoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $RepoRoot
$env:PYTHONUTF8 = "1"

Write-Host "Validating StudioNet V3 contracts..."
& .\.venv\Scripts\genvm-lint.exe check .\contracts\moment_grid_game.py
if ($LASTEXITCODE -ne 0) { throw "Game contract lint failed." }
& .\.venv\Scripts\genvm-lint.exe check .\contracts\match_round_resolver.py
if ($LASTEXITCODE -ne 0) { throw "Round resolver lint failed." }
& .\.venv\Scripts\python.exe -m pytest .\tests\direct -q
if ($LASTEXITCODE -ne 0) { throw "Direct Mode tests failed." }

Write-Host "Selecting StudioNet and encrypted account $AccountName..."
& genlayer network set studionet
if ($LASTEXITCODE -ne 0) { throw "Unable to select StudioNet." }
& genlayer account use $AccountName
if ($LASTEXITCODE -ne 0) { throw "Unable to select the deployment account." }

Write-Host "Deploying MomentGridGame V3..."
& genlayer deploy --contract .\contracts\moment_grid_game.py
if ($LASTEXITCODE -ne 0) { throw "Game contract deployment failed." }

Write-Host "Deploying MatchRoundResolver V3..."
& genlayer deploy --contract .\contracts\match_round_resolver.py
if ($LASTEXITCODE -ne 0) { throw "Round resolver deployment failed." }

Write-Host "Record both successful execution receipts in deployments/genlayer/studionet.json before creating a round."
