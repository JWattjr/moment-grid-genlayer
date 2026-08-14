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

switch ($Mode) {
    "Resolve"  { & genlayer write $ResolverAddress resolve_round --args $RoundId }
    "Dispatch" { & genlayer write $ResolverAddress dispatch_resolution --args $RoundId }
    "Process"  { & genlayer write $GameAddress process_settlement --args $RoundId 100 }
    "Refund"   { & genlayer write $GameAddress activate_refunds --args $RoundId }
    "Claim"    { & genlayer write $GameAddress claim --args $RoundId }
}
if ($LASTEXITCODE -ne 0) { throw "$Mode transaction failed." }
Write-Host "$Mode submitted. Inspect execution success and then read both resolver and game state."
