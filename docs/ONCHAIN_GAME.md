# On-chain game path

Moment Grid uses two GenLayer Intelligent Contracts with deliberately separate
responsibilities.

## Trust boundary

1. A player signs one payable `join_round` transaction. The fixed entry is
   divided equally across the nine grid-cell pools and the packed grid is stored
   on-chain.
2. `MatchRoundResolver` fetches the registered public match sources. Validators
   independently extract the final match facts and compare the three stable
   outcome bitmaps that cover all 27 supported moments.
3. After the resolver transaction is finalized, `MatchRoundResolver` emits an
   authenticated settlement message to `MomentGridGame`. No owner or frontend
   can submit a winning bitmap, and an accepted-but-appealable result cannot
   release claims.
4. Deterministic contract code scores each packed grid, calculates the nine
   pari-mutuel cell payouts, and exposes a pull-based claim.
5. A claim emits native GEN to the player's EOA only when that claim transaction
   is finalized.

The frontend owns wallet connection, transaction progress, readable pool odds,
and cached/indexed views. It is never the source of truth for entries, results,
or claimable balances.

## Version-one economics

- Every round has a fixed entry fee divisible by nine.
- One ninth of each entry goes to each cell pool.
- Every cell has three selectable moment buckets.
- If one or more backed moments in a cell are true, all winning stakes share the
  entire cell pool pro rata.
- If no backed moment is true, every player receives that cell's stake back.
- Integer-division dust is assigned to the last winning stake claimed in that
  cell, so no player funds become owner-withdrawable residue.
- There is no rake, admin withdrawal, multiplier, or line bonus in version one.
  Completed lines remain the public competitive score.
- If a match cannot settle by the configured refund time, anyone can activate
  refunds and each entrant can reclaim the full entry.

## Network progression

Local direct tests cover validation, packing, scoring, pool accounting, and
refund rules. Studionet is suitable for rehearsing signed transactions, but the
public money-like test flow belongs on persistent Testnet Bradbury with faucet
GEN.
