param(
    [Parameter(Mandatory = $true)][ValidateSet("Resolve", "Dispatch", "Process", "Refund", "Claim")][string]$Mode,
    [Parameter(Mandatory = $true)][string]$AccountName,
    [Parameter(Mandatory = $true)][string]$GameAddress,
    [Parameter(Mandatory = $true)][string]$ResolverAddress,
    [Parameter(Mandatory = $true)][string]$RoundId
)

$ErrorActionPreference = "Stop"
genlayer network set testnet-bradbury
genlayer account use $AccountName

switch ($Mode) {
    "Resolve"  { genlayer write $ResolverAddress resolve_round --args $RoundId }
    "Dispatch" { genlayer write $ResolverAddress dispatch_resolution --args $RoundId }
    "Process"  { genlayer write $GameAddress process_settlement --args $RoundId 100 }
    "Refund"   { genlayer write $GameAddress activate_refunds --args $RoundId }
    "Claim"    { genlayer write $GameAddress claim --args $RoundId }
}
if ($LASTEXITCODE -ne 0) { throw "$Mode transaction failed." }
Write-Host "$Mode submitted. Verify FINALIZED execution and read the resulting contract state."
