# On-chain game path

Moment Grid uses two GenLayer Intelligent Contracts with deliberately separate
responsibilities.

## Trust boundary

1. A player signs one payable `join_round` transaction with the round's immutable minimum stake (1 test GEN in the active V3 round).
   The contract allocates the stake across the rarity-weighted cell pools,
   round jackpot, and pending protocol revenue while storing the packed grid
   on-chain.
2. `MatchRoundResolver` fetches the registered public match sources. Validators
   independently extract the final match facts and compare the three stable
   outcome bitmaps plus evidence-coverage bitmaps. A missing statistic is never
   silently treated as FALSE.
3. The resolver transaction stores consensus first. A separate permissionless
   `dispatch_resolution` transaction then emits the authenticated settlement
   message to `MomentGridGame`. This ordering prevents a child callback from
   outrunning or surviving a failed parent transaction. No owner or frontend
   can submit a winning bitmap.
4. Permissionless callers process settlement in bounded batches. Deterministic
   contract code scores each packed grid, totals jackpot-qualifying stake, and
   then exposes pull-based regular-pool and jackpot claims.
5. A claim emits native GEN to the player's EOA only when that claim transaction
   is finalized.

The frontend owns wallet connection, transaction progress, readable pool odds,
and cached/indexed views. It is never the source of truth for entries, results,
or claimable balances.

## Stake allocation

- V3 supports immutable per-round floors from 1 to 100 GEN. The active round minimum is 1 test GEN.
- Each Common cell receives 5% of the gross stake (0.05 GEN per cell at 1 GEN).
- Each Medium cell receives 10% (0.10 GEN per cell at 1 GEN).
- Each Rare cell receives 15% (0.15 GEN per cell at 1 GEN).
- The jackpot receives 5% (0.05 GEN at 1 GEN).
- Protocol revenue receives 5% (0.05 GEN at 1 GEN). Rounding dust is assigned
  to revenue so all received wei are accounted for.

## Payout rules

- Every cell has three selectable moment buckets and its own total, option-stake,
  winner, refund, claimed-stake, and paid-pool ledger. There are exactly nine
  economic pools; balances never cross between cells.
- If one or more backed moments in a cell are true, the correct predictors in
  that cell share only that cell's entire loser-funded pool pro rata.
- If no backed moment is true, every player receives that cell's stake back.
- If the sources cannot prove a selected moment true or false, that selection's
  cell stake is refunded and removed from the distributable pool.
- A grid qualifies for the jackpot only when its correct cells contain at least
  one complete horizontal row and at least one complete diagonal.
- Jackpot qualifiers share the round jackpot pro rata by gross stake. If no
  grid qualifies, the entire jackpot rolls into the next created round.
- Protocol revenue becomes withdrawable only after a successful settlement.
- Settlement is processed in bounded batches so entrant growth cannot make the
  round impossible to finalize.
- A round requires at least two players, two unique grids, and the configured
  total liquidity. If the gate is missed at lock, anyone can activate refunds.
- If a match cannot settle by the configured refund time, or batched scoring
  times out, anyone can activate
  refunds and each entrant can reclaim the full gross stake. No jackpot or
  protocol fee is retained from a refunded round.

## Network progression

Local direct tests cover validation, packing, scoring, all nine independent pool
ledgers, and refund rules. The public playable V3 flow runs on fresh Bradbury
contracts with test GEN. Bradbury V2 remains preserved for historical position
recovery only; StudioNet V3 remains a pre-production deployment record.

## V3 lifecycle safety

`lock_at < kickoff_at <= resolve_not_before < refund_at` is enforced on-chain.
The owner can cancel only before lock. After lock, recovery is permissionless.
Contract pause stops new rounds and entries but never blocks scoring, refunds,
claims, or withdrawals. Ownership transfer uses a two-step proposal and
acceptance. Player entries wait for validator `ACCEPTED` state, verify successful
execution, expose a clearly provisional locked position, and track the Bradbury
appeal/finality window in the background. Resolution dispatch, settlement,
refund, and claim actions wait for finalized predecessor state. Both normalized
SDK and raw consensus receipt shapes are checked; lifecycle status alone is
never reported as execution success.
