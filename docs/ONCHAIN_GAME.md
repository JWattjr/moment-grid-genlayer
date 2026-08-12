# On-chain game path

Moment Grid uses two GenLayer Intelligent Contracts with deliberately separate
responsibilities.

## Trust boundary

1. A player signs one payable `join_round` transaction with at least 10 GEN.
   The contract allocates the stake across the rarity-weighted cell pools,
   round jackpot, and pending protocol revenue while storing the packed grid
   on-chain.
2. `MatchRoundResolver` fetches the registered public match sources. Validators
   independently extract the final match facts and compare the three stable
   outcome bitmaps plus evidence-coverage bitmaps. A missing statistic is never
   silently treated as FALSE.
3. After the resolver transaction is finalized, `MatchRoundResolver` emits an
   authenticated settlement message to `MomentGridGame` only after the
   registered post-match evidence window. No owner or frontend
   can submit a winning bitmap, and an accepted-but-appealable result cannot
   release claims.
4. Permissionless callers process settlement in bounded batches. Deterministic
   contract code scores each packed grid, totals jackpot-qualifying stake, and
   then exposes pull-based regular-pool and jackpot claims.
5. A claim emits native GEN to the player's EOA only when that claim transaction
   is finalized.

The frontend owns wallet connection, transaction progress, readable pool odds,
and cached/indexed views. It is never the source of truth for entries, results,
or claimable balances.

## Stake allocation

- The minimum stake is 10 GEN; players may stake more.
- Each Common cell receives 5% of the gross stake (1.5 GEN total at 10 GEN).
- Each Medium cell receives 10% (3 GEN total at 10 GEN).
- Each Rare cell receives 15% (4.5 GEN total at 10 GEN).
- The jackpot receives 5% (0.5 GEN at 10 GEN).
- Protocol revenue receives 5% (0.5 GEN at 10 GEN). Rounding dust is assigned
  to revenue so all received wei are accounted for.

## Payout rules

- Every cell has three selectable moment buckets.
- If one or more backed moments in a cell are true, all winning stakes share the
  entire cell pool pro rata.
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

Local direct tests cover validation, packing, scoring, pool accounting, and
refund rules. Studionet is suitable for rehearsing signed transactions, but the
public money-like test flow belongs on persistent Testnet Bradbury with faucet
GEN.

## V2 lifecycle safety

`lock_at < kickoff_at <= resolve_not_before < refund_at` is enforced on-chain.
The owner can cancel only before lock. After lock, recovery is permissionless.
Contract pause stops new rounds and entries but never blocks scoring, refunds,
claims, or withdrawals. Ownership transfer uses a two-step proposal and
acceptance. All wallet writes wait for `FINALIZED` and verify successful
execution before the UI reports completion.
