# Studionet deployment and demo runbook

Studionet is the hosted, gasless development target. Use the CLI's built-in network definition so consensus metadata and Studio polling behavior remain correct.

## Owner model

The deployment account becomes the contract owner. The owner can register immutable moment definitions: match identity, criterion, and approved source URLs. It cannot change an existing definition, supply a result, or prevent another account from resolving a registered moment. `resolve_moment` is permissionless.

For the builder submission, `moment-grid-studionet` is a durable, developer-controlled encrypted CLI account. Its password/private key must never enter an environment file, script, repository, shell history, or chat. A future production deployment can place ownership behind a multisig without changing the public interface; multisig infrastructure is intentionally out of scope for Studionet.

## First-time account setup

```powershell
npm install -g genlayer
genlayer network set studionet
genlayer account create --name moment-grid-studionet
genlayer account use moment-grid-studionet
```

Creating an account is a one-time action. Existing developers should select, not recreate, the named account. A zero GEN balance is expected on gasless Studionet.

## Validated deployment

Copy `.env.example` to `.env` if desired and set only the non-secret account/network names. Then run from a visible interactive PowerShell:

```powershell
$env:GENLAYER_NETWORK = "studionet"
$env:GENLAYER_ACCOUNT_NAME = "moment-grid-studionet"
.\scripts\deploy-genlayer.ps1
```

The helper runs GenVM lint and Direct Mode tests, selects the named encrypted keystore, and invokes the CLI. Enter the keystore password only at the CLI prompt. Record the returned contract address and deployment transaction in `deployments/genlayer/studionet.json`; set `GENLAYER_CONTRACT_ADDRESS` only after success.

## Register demo definitions

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

`ACCEPTED` or `FINALIZED` alone is not proof of success. The receipt must show successful execution/validator agreement, stderr must have no relevant GenVM warning, and a state read must reflect the mutation. On 9 August 2026, successful Studionet writes remained `ACCEPTED` beyond 150 seconds; the app therefore treats `ACCEPTED + FINISHED_WITH_RETURN + readable state` as its development consensus boundary.

The service reported a 30 requests/minute limit during verification. Submit sequentially, poll at five seconds or slower, and wait for each receipt instead of batching.

## Reviewer configuration

Set `NEXT_PUBLIC_GENLAYER_RESOLVER_ADDRESS` in `web/.env.local` to the durable address. New contracts expose enumerable history via `get_resolution_count` and `get_resolution_id`. `GENLAYER_HISTORY_IDS` is a server-only compatibility fallback for the older Phase 2 proof contract.

Normally leave `NEXT_PUBLIC_GENLAYER_RPC_URL` blank so GenLayerJS uses the selected chain's built-in RPC. The reviewer route is `/genlayer`. It is read-only; wallet-backed permissionless writes remain a separate action.

The verified addresses, transaction hashes, verdicts, and known caveats live in `deployments/genlayer/studionet.json`.
