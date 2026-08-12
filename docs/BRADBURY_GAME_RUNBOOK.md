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

## 2. Validate and deploy the contracts

```powershell
.\scripts\deploy-onchain-game.ps1 -AccountName moment-grid-studionet
```

The script deploys both V2 contracts because the validity-bitmap callback is not
ABI-compatible with V1. Record both contract addresses and finalized deployment
transaction hashes.

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
  epl-example-round `
  2026-08-20T20:30:00Z `
  2026-08-22T18:00:00Z
```

Use real match URLs and dates. The resolver input never contains expected
answers.

## 4. Create the matching game round

The minimum stake and allocation percentages are contract constants, so round
creation does not accept an entry-fee argument:

```powershell
genlayer write <game-contract-address> create_round --args `
  epl-example-round `
  epl-example-match `
  <round-resolver-address> `
  epl-example-round `
  2026-08-20T17:55:00Z `
  2026-08-20T18:00:00Z `
  2026-08-20T20:30:00Z `
  2026-08-22T18:00:00Z `
  2 `
  20000000000000000000 `
  2
```

The contract enforces `lock < kickoff <= resolution opening < refund deadline`,
at least two participants, at least 20 GEN, and at least two unique grids.

## 5. Exercise the full path

1. A player calls payable `join_round(round_id, packed_grid)` with at least
   `10 GEN` (`10000000000000000000` wei). At exactly 10 GEN, the three Common
   cells receive 0.5 GEN each, the Medium cells 1 GEN each, the Rare cells 1.5
   GEN each, the jackpot 0.5 GEN, and pending protocol revenue 0.5 GEN.
2. After the match is final and `resolve_not_before`, anyone calls
   `resolve_round` on the resolver.
3. When that transaction finalizes, the resolver emits `accept_resolution` to
   the game with `on="finalized"`.
4. Anyone calls `process_settlement(round_id, max_entries)` until the round
   reaches `SETTLED`. Use batches no larger than 100 entries.
5. Read `get_entry` for the score, jackpot qualification, and claimable amount.
6. The player calls `claim`; verify the receipt execution and GEN balance.
7. If liquidity is under the configured floor after lock, or evidence/scoring
   misses `refund_at`, call `activate_refunds`, then
   each player calls `claim` for the full entry.

Always inspect execution output, not only lifecycle status:

```powershell
genlayer receipt <transaction-hash> --status FINALIZED
genlayer receipt <transaction-hash> --stdout --stderr
```
