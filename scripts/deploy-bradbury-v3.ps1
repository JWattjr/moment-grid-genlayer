param(
    [string]$AccountName = $env:GENLAYER_ACCOUNT_NAME
)

$ErrorActionPreference = "Stop"
if (-not $AccountName) { $AccountName = "moment-grid-studionet" }

$RepoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $RepoRoot
$env:PYTHONUTF8 = "1"

Write-Host "Validating Bradbury V3 contracts..."
& .\.venv\Scripts\genvm-lint.exe check .\contracts\moment_grid_game.py
if ($LASTEXITCODE -ne 0) { throw "Game contract lint failed." }
& .\.venv\Scripts\genvm-lint.exe check .\contracts\match_round_resolver.py
if ($LASTEXITCODE -ne 0) { throw "Round resolver lint failed." }
& .\.venv\Scripts\python.exe -m pytest .\tests\direct -q
if ($LASTEXITCODE -ne 0) { throw "Direct Mode tests failed." }

Write-Host "Selecting Bradbury and encrypted account $AccountName..."
& genlayer network set testnet-bradbury
if ($LASTEXITCODE -ne 0) { throw "Unable to select Bradbury." }
& genlayer account use $AccountName
if ($LASTEXITCODE -ne 0) { throw "Unable to select the deployment account." }

Write-Host "Deploying MomentGridGame V3..."
$gameOutput = & genlayer deploy --contract .\contracts\moment_grid_game.py 2>&1
$gameExitCode = $LASTEXITCODE
$gameOutput | ForEach-Object { Write-Host $_ }
if ($gameExitCode -ne 0 -or ($gameOutput -join "`n") -notmatch "txExecutionResultName:\s*'FINISHED_WITH_RETURN'") {
    throw "Game contract deployment did not produce a successful execution receipt."
}

Write-Host "Deploying MatchRoundResolver V3..."
$resolverOutput = & genlayer deploy --contract .\contracts\match_round_resolver.py 2>&1
$resolverExitCode = $LASTEXITCODE
$resolverOutput | ForEach-Object { Write-Host $_ }
if ($resolverExitCode -ne 0 -or ($resolverOutput -join "`n") -notmatch "txExecutionResultName:\s*'FINISHED_WITH_RETURN'") {
    throw "Round resolver deployment did not produce a successful execution receipt."
}

Write-Host "Record both successful execution receipts in deployments/genlayer/bradbury-v3.json before creating a round."
