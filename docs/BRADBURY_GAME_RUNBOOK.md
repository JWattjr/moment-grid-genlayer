# Bradbury on-chain game runbook

Testnet Bradbury is the persistent, production-like target for the native-GEN
game flow. Keep the existing Studionet deployment intact as the reviewer proof.

## 1. Fund the deployment wallet

The current deployment address is:

`0xdb433ff614bdd1ece21aa97221c3e0a7ecf79c92`

Claim test GEN from <https://testnet-faucet.genlayer.foundation/> and verify:

```powershell
genlayer network set testnet-bradbury
genlayer account
```

Never put the keystore password or private key in a script, environment file,
shell history, repository, or chat.

## 2. Validate and deploy both contracts

```powershell
.\scripts\deploy-onchain-game.ps1 -AccountName moment-grid-studionet
```

The game must be deployed before the round resolver because the resolver's
registered match includes the game callback address. Record both contract
addresses and both deployment transaction hashes.

## 3. Register one resolver round

Register the final-match evidence, the deployed game callback, and the game
round id on `MatchRoundResolver`:

```powershell
genlayer write <round-resolver-address> register_round --args `
  epl-example-round `
  epl-example-match `
  Arsenal `
  Chelsea `
  "Premier League" `
  2026-08-20 `
  '["https://www.bbc.co.uk/...","https://www.espn.com/..."]' `
  <game-contract-address> `
  epl-example-round
```

Use real match URLs and dates. The resolver input never contains expected
answers.

## 4. Create the matching game round

The example entry is `0.09 GEN`, represented as `90000000000000000` wei and
split into nine `0.01 GEN` cell stakes:

```powershell
genlayer write <game-contract-address> create_round --args `
  epl-example-round `
  epl-example-match `
  <round-resolver-address> `
  epl-example-round `
  90000000000000000 `
  2026-08-20T18:00:00Z `
  2026-08-22T18:00:00Z
```

The lock must be in the future and the refund time must be later than the lock.

## 5. Exercise the full path

1. A player calls payable `join_round(round_id, packed_grid)` with the exact
   entry value.
2. After the match is final, anyone calls `resolve_round` on the resolver.
3. When that transaction finalizes, the resolver emits `accept_resolution` to
   the game with `on="finalized"`.
4. Read `get_entry` for the grid score and `claimable` amount.
5. The player calls `claim`; verify the receipt execution and GEN balance.
6. If evidence never settles, call `activate_refunds` after `refund_at`, then
   each player calls `claim` for the full entry.

Always inspect execution output, not only lifecycle status:

```powershell
genlayer receipt <transaction-hash> --status FINALIZED
genlayer receipt <transaction-hash> --stdout --stderr
```

