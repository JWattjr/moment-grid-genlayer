param(
    [string]$AccountName = $env:GENLAYER_ACCOUNT_NAME,
    [switch]$DeployResolver
)

$ErrorActionPreference = "Stop"

if (-not $AccountName) { $AccountName = "moment-grid-studionet" }

$RepoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $RepoRoot
$env:PYTHONUTF8 = "1"

Write-Host "Validating the full-match resolver and nine-pool game..."
& .\.venv\Scripts\genvm-lint.exe check .\contracts\match_round_resolver.py
if ($LASTEXITCODE -ne 0) { throw "Round resolver lint failed." }
& .\.venv\Scripts\genvm-lint.exe check .\contracts\moment_grid_game.py
if ($LASTEXITCODE -ne 0) { throw "Game contract lint failed." }
& .\.venv\Scripts\python.exe -m pytest .\tests\direct -q
if ($LASTEXITCODE -ne 0) { throw "Direct Mode tests failed." }

Write-Host "Selecting Testnet Bradbury and encrypted account $AccountName..."
& genlayer network set testnet-bradbury
if ($LASTEXITCODE -ne 0) { throw "Unable to select Testnet Bradbury." }
& genlayer account use $AccountName
if ($LASTEXITCODE -ne 0) { throw "Unable to select the deployment account." }
& genlayer account
if ($LASTEXITCODE -ne 0) { throw "Unable to read the Bradbury account balance." }

Write-Host "Deploying MomentGridGame first. Enter the keystore password only at the CLI prompt."
& genlayer deploy --contract .\contracts\moment_grid_game.py
if ($LASTEXITCODE -ne 0) { throw "Game contract deployment failed." }

if ($DeployResolver) {
    Write-Host "Deploying MatchRoundResolver. Enter the keystore password only at the CLI prompt."
    & genlayer deploy --contract .\contracts\match_round_resolver.py
    if ($LASTEXITCODE -ne 0) { throw "Round resolver deployment failed." }
} else {
    Write-Host "Keeping the existing compatible MatchRoundResolver. Pass -DeployResolver only when a new resolver is required."
}

Write-Host "Record the returned address and transaction hash, then follow docs/BRADBURY_GAME_RUNBOOK.md."
