param(
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
    [int]$MinimumParticipants = 2,
    [string]$MinimumTotalStakeWei = "20000000000000000000",
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

genlayer network set testnet-bradbury
genlayer account use $AccountName
genlayer account

Write-Host "Registering immutable resolver input. No expected answer is supplied."
genlayer write $ResolverAddress register_round --args $RoundId $MatchId $HomeTeam $AwayTeam $Competition $MatchDate $SourceUrlsJson $GameAddress $RoundId $ResolveNotBefore $RefundAt
if ($LASTEXITCODE -ne 0) { throw "Resolver registration failed." }

Write-Host "Creating the matching V2 game round."
genlayer write $GameAddress create_round --args $RoundId $MatchId $ResolverAddress $RoundId $LockAt $KickoffAt $ResolveNotBefore $RefundAt $MinimumParticipants $MinimumTotalStakeWei $MinimumUniqueGrids
if ($LASTEXITCODE -ne 0) { throw "Game round creation failed." }

Write-Host "Round submitted. Inspect both receipts through FINALIZED and verify get_round before enabling the Vercel round id."
