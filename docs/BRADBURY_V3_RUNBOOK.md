# Bradbury V3 playable deployment runbook

Bradbury is the production-like public testnet for Moment Grid. Use the CLI's
built-in `testnet-bradbury` definition and a funded encrypted account. Never put
an account password, private key, or keystore material in this repository.

## Active deployment

- Game: `0x4bff4e5b50E21D25988D8029A7535E8111Eb62eF`
- Full-match resolver: `0x901327a3D6D1d91baa57542bd27eAf336bC604d7`
- Round: `epl-2026-08-21-arsenal-coventry-bradbury-v3`
- Minimum entry: 1 test GEN
- Manifest: `deployments/genlayer/bradbury-v3.json`

The older contracts in `deployments/genlayer/bradbury.json` are recovery-only.
Never point new entries or bots at them.

## Deployment

```powershell
genlayer network set testnet-bradbury
genlayer account use moment-grid-studionet
.\scripts\deploy-bradbury-v3.ps1 -AccountName moment-grid-studionet
```

The helper lints both contracts and runs all Direct Mode tests before
deployment. A lifecycle state of `ACCEPTED` or `FINALIZED` is not enough on its
own: verify `AGREE`, successful execution, deployed schema, `get_version`, and a
state read. Bradbury's appeal window may keep a successful transaction accepted
for much longer than the interactive product journey.

## Acceptance-first player UX

The frontend waits for `ACCEPTED` on `join_round`, verifies successful
execution, reads the immutable entry from accepted state, and releases the UI.
It displays the entry as provisional and continues tracking `FINALIZED` in the
background. It never uses leader-only validation.

Do not describe an accepted transaction as irreversible. Resolution dispatch,
settlement, and claims must respect finalized predecessor state. Cross-contract
settlement messages use `on="finalized"`.

## Receipt checks

```powershell
genlayer receipt <transaction-hash> --status ACCEPTED
genlayer receipt <transaction-hash> --status ACCEPTED --stdout --stderr
genlayer receipt <transaction-hash> --status FINALIZED
genlayer schema <contract-address>
genlayer call <contract-address> get_version
```

If the receipt reports `FINISHED_WITH_ERROR`, no state was applied even if the
transaction lifecycle says accepted. Fix the input or contract error before
continuing.

## Round operation

```powershell
.\scripts\operate-v3-round.ps1 `
  -Network testnet-bradbury `
  -Mode Resolve `
  -AccountName moment-grid-studionet `
  -GameAddress 0x4bff4e5b50E21D25988D8029A7535E8111Eb62eF `
  -ResolverAddress 0x901327a3D6D1d91baa57542bd27eAf336bC604d7 `
  -RoundId epl-2026-08-21-arsenal-coventry-bradbury-v3
```

After `Resolve`, verify its receipt is finalized and the resolver record is
`SETTLED` before `Dispatch`. Then wait for dispatch finality before `Process`.
If the liquidity gate fails or the evidence deadline passes without settlement,
use `Refund`. Players call `Claim` themselves.

## Disclosed bots

Form Bot and Chaos Bot use separate unlocked test accounts, fixed public grids,
and 1 test GEN each. The bot runner requires explicit contract/round environment
values and `ALLOW_GENLAYER_BOTS=true`; it has no fallback to the recovery-only
V2 addresses. Bots are excluded from human standings.

## Finality watcher

An operator should monitor the deployment, resolver, dispatch, and scoring
receipts outside the browser. A closed browser must not stop settlement or
refund recovery. Never substitute `--leader-only` for Bradbury consensus; that
flag belongs to local/Studio integration testing.
