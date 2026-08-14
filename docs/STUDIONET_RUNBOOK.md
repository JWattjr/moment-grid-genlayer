# StudioNet deployment and playable V3 runbook

Studionet is the hosted, gasless development target. Use the CLI's built-in network definition so consensus metadata and Studio polling behavior remain correct.

## Owner model

The deployment account becomes the contract owner. The owner can register immutable match definitions and create aligned game rounds. It cannot change an existing definition, supply a result, or prevent another account from resolving, dispatching, processing, refunding, or claiming through the permissionless lifecycle.

For the builder submission, `moment-grid-studionet` is a durable, developer-controlled encrypted CLI account. Its password/private key must never enter an environment file, script, repository, shell history, or chat. A future production deployment can place ownership behind a multisig without changing the public interface; multisig infrastructure is intentionally out of scope for Studionet.

## First-time account setup

```powershell
npm install -g genlayer
genlayer network set studionet
genlayer account create --name moment-grid-studionet
genlayer account use moment-grid-studionet
```

Creating an account is a one-time action. Existing developers should select, not recreate, the named account. A zero GEN balance is expected on gasless Studionet.

## Validated V3 game deployment

Copy `.env.example` to `.env` if desired and set only the non-secret account/network names. Then run from a visible interactive PowerShell:

```powershell
$env:GENLAYER_ACCOUNT_NAME = "moment-grid-studionet"
.\scripts\deploy-studionet-v3.ps1
```

The helper lints both V3 contracts, runs the full Direct Mode suite, selects the named encrypted keystore, and deploys the game and full-match resolver. Enter the keystore password only at the CLI prompt. Record returned addresses and transactions in `deployments/genlayer/studionet.json` only after successful execution is verified.

The active verified deployments are:

- `MomentGridGame` V3: `0x9f95bDD3E4a2479b8f628599cc672E7a519C0920`
- `MatchRoundResolver` V3: `0xDa0569bE8c8d148D3F2f6Fba5aC00a39bFc64590`

## Create a playable round

Use `scripts/setup-v3-round.ps1`. The helper validates time ordering, requires two sources, forces source JSON to remain a calldata string, and encodes contract parameters as GenLayer address values. For the active round, use a 1 GEN floor, two participants, 2 GEN total liquidity, and two unique grids.

Never count controlled bot entries as organic users. Form Bot and Chaos Bot use immutable public grids committed before human play. Run `pnpm bot:test` before operating either profile. Execution requires the explicit `ALLOW_GENLAYER_BOTS=true` gate and a private key supplied only by the local OS keychain or deployment secret manager.

## Register reusable demo definitions

Registration must be signed by the owner. Use the answer-free JSON under `fixtures/genlayer/` to form `register_moment` arguments:

```powershell
genlayer write <address> register_moment --args <resolution-id> '<match-json>' <event-type> '<criteria-json>' '<evidence-json>'
```

Register three to five criteria spanning TRUE, FALSE, both-teams-score, and penalty-window behavior. Never insert an expected answer into the input. Allow the CLI to prompt securely if the keystore is locked.

Any account can then request adjudication:

```powershell
genlayer write <address> resolve_moment --args <resolution-id>
```

## Verify every write

```powershell
genlayer receipt <transaction-hash> --status ACCEPTED
genlayer receipt <transaction-hash> --stdout --stderr
genlayer call <contract-address> get_resolution --args <resolution-id>
```

`ACCEPTED` or `FINALIZED` alone is not proof of success. The receipt must show successful execution/validator agreement, stderr must have no relevant GenVM warning, and a state read must reflect the mutation. StudioNet may return either normalized SDK receipt fields or raw consensus receipt fields; V3 accepts either shape only when execution is explicitly successful.

The service currently enforces roughly 30 requests/minute. Submit sequentially, poll at five seconds or slower, and read the nine cell pools sequentially rather than in one burst.

## Resolve, dispatch, score, and recover

V3 intentionally separates resolver persistence from the game callback:

```powershell
.\scripts\operate-v3-round.ps1 -Mode Resolve  -AccountName <alias> -GameAddress <game> -ResolverAddress <resolver> -RoundId <id>
.\scripts\operate-v3-round.ps1 -Mode Dispatch -AccountName <alias> -GameAddress <game> -ResolverAddress <resolver> -RoundId <id>
.\scripts\operate-v3-round.ps1 -Mode Process  -AccountName <alias> -GameAddress <game> -ResolverAddress <resolver> -RoundId <id>
```

If the liquidity gate fails after lock or evidence/scoring misses the refund deadline, call `-Mode Refund`. Players then call `-Mode Claim` themselves. Never dispatch before the resolver read shows `SETTLED`.

## Reviewer configuration

Set the `NEXT_PUBLIC_GENLAYER_GAME_*` values in `web/.env.local` to the V3 addresses and active round. Keep `NEXT_PUBLIC_GENLAYER_RESOLVER_ADDRESS` pointed at the durable reusable proof contract for `/genlayer`. New contracts expose enumerable history via `get_resolution_count` and `get_resolution_id`.

Normally leave `NEXT_PUBLIC_GENLAYER_RPC_URL` blank so GenLayerJS uses the selected chain's built-in RPC. The reviewer route is `/genlayer`. It is read-only; wallet-backed permissionless writes remain a separate action.

The verified addresses, transaction hashes, verdicts, and known caveats live in `deployments/genlayer/studionet.json`.
