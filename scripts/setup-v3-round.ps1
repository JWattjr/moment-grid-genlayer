param(
    [string]$Network = "studionet",
    [Parameter(Mandatory = $true)][string]$AccountName,
    [Parameter(Mandatory = $true)][string]$GameAddress,
    [Parameter(Mandatory = $true)][string]$ResolverAddress,
    [Parameter(Mandatory = $true)][string]$RoundId,
    [Parameter(Mandatory = $true)][string]$MatchId,
    [Parameter(Mandatory = $true)][string]$HomeTeam,
    [Parameter(Mandatory = $true)][string]$AwayTeam,
    [Parameter(Mandatory = $true)][string]$Competition,
    [Parameter(Mandatory = $true)][string]$MatchDate,
    [Parameter(Mandatory = $true)][string]$SourceUrlsJson,
    [Parameter(Mandatory = $true)][string]$LockAt,
    [Parameter(Mandatory = $true)][string]$KickoffAt,
    [Parameter(Mandatory = $true)][string]$ResolveNotBefore,
    [Parameter(Mandatory = $true)][string]$RefundAt,
    [string]$MinimumStakeWei = "1000000000000000000",
    [int]$MinimumParticipants = 2,
    [string]$MinimumTotalStakeWei = "2000000000000000000",
    [int]$MinimumUniqueGrids = 2
)

$ErrorActionPreference = "Stop"
$times = @($LockAt, $KickoffAt, $ResolveNotBefore, $RefundAt) | ForEach-Object {
    [DateTimeOffset]::ParseExact($_, "yyyy-MM-ddTHH:mm:ssZ", [Globalization.CultureInfo]::InvariantCulture)
}
if (-not ($times[0] -lt $times[1] -and $times[1] -le $times[2] -and $times[2] -lt $times[3])) {
    throw "Timing must satisfy lock < kickoff <= resolve-not-before < refund."
}
$sources = $SourceUrlsJson | ConvertFrom-Json
if ($sources.Count -lt 2) { throw "At least two evidence URLs are required." }
$sourceStringArg = $SourceUrlsJson | ConvertTo-Json -Compress
$gameAddressArg = "addr#$($GameAddress.Substring(2))"
$resolverAddressArg = "addr#$($ResolverAddress.Substring(2))"

& genlayer network set $Network
if ($LASTEXITCODE -ne 0) { throw "Unable to select $Network." }
& genlayer account use $AccountName
if ($LASTEXITCODE -ne 0) { throw "Unable to select $AccountName." }

Write-Host "Registering immutable resolver evidence inputs..."
& genlayer write $ResolverAddress register_round --args $RoundId $MatchId $HomeTeam $AwayTeam $Competition $MatchDate $sourceStringArg $gameAddressArg $RoundId $ResolveNotBefore $RefundAt
if ($LASTEXITCODE -ne 0) { throw "Resolver registration failed." }

Write-Host "Creating the matching V3 game round with an immutable per-round stake floor..."
& genlayer write $GameAddress create_round --args $RoundId $MatchId $resolverAddressArg $RoundId $LockAt $KickoffAt $ResolveNotBefore $RefundAt $MinimumStakeWei $MinimumParticipants $MinimumTotalStakeWei $MinimumUniqueGrids
if ($LASTEXITCODE -ne 0) { throw "Game round creation failed." }

Write-Host "Round submitted. Verify both execution receipts and read both contract records before accepting entries."
