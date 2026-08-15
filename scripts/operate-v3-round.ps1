param(
    [string]$Network = "studionet",
    [Parameter(Mandatory = $true)][ValidateSet("Resolve", "Dispatch", "Process", "Refund", "Claim")][string]$Mode,
    [Parameter(Mandatory = $true)][string]$AccountName,
    [Parameter(Mandatory = $true)][string]$GameAddress,
    [Parameter(Mandatory = $true)][string]$ResolverAddress,
    [Parameter(Mandatory = $true)][string]$RoundId
)

$ErrorActionPreference = "Stop"
& genlayer network set $Network
if ($LASTEXITCODE -ne 0) { throw "Unable to select $Network." }
& genlayer account use $AccountName
if ($LASTEXITCODE -ne 0) { throw "Unable to select $AccountName." }

$contractAddress = $GameAddress
$methodArgs = @($RoundId)
switch ($Mode) {
    "Resolve"  { $contractAddress = $ResolverAddress; $method = "resolve_round" }
    "Dispatch" { $contractAddress = $ResolverAddress; $method = "dispatch_resolution" }
    "Process"  { $method = "process_settlement"; $methodArgs = @($RoundId, 100) }
    "Refund"   { $method = "activate_refunds" }
    "Claim"    { $method = "claim" }
}
$output = & genlayer write $contractAddress $method --args @methodArgs 2>&1
$exitCode = $LASTEXITCODE
$output | ForEach-Object { Write-Host $_ }
if ($exitCode -ne 0 -or ($output -join "`n") -notmatch "txExecutionResultName:\s*'FINISHED_WITH_RETURN'") {
    throw "$Mode did not produce a successful execution receipt."
}
Write-Host "$Mode accepted with successful execution. Wait for required finality, then read both resolver and game state before the next lifecycle action."
