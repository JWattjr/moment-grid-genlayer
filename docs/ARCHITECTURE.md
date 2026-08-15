# GenLayer-native architecture

Moment Grid separates real-world adjudication from deterministic game rules. GenLayer validators interpret public football evidence. Deterministic Intelligent Contract code stores entries, scores accepted facts, and distributes native GEN. Shared TypeScript previews the same grid rules in the UI, but cannot decide money state.

## System boundary

```text
Player builds a 3×3 grid and reviews the stake split
                         |
                         v
Next.js + wallet sign one payable packed-grid transaction
                         |
                         v
MomentGridGame V3 on Bradbury
        |                                    |
        | escrow + nine pools                | registered callback only
        v                                    v
locked entries                      MatchRoundResolver V3
                                      |             |
                                      v             v
                                     BBC      TheSportsDB
                                       \       /
                                independent validators
                                           |
                                           v
                         truth + evidence-coverage bitmaps
                                           |
                                           v
                       separate permissionless dispatch message
                                           |
                                           v
                           batched score → claim / refund
```

The separate `MatchMomentResolver` deployment on StudioNet provides an immediately inspectable reusable TRUE/FALSE/INVALID adjudication proof. It is supplementary evidence, not the payout authority for the V3 game.

## Responsibilities

### Full-match resolver

[`contracts/match_round_resolver.py`](../contracts/match_round_resolver.py) owns immutable match definitions, source policy, permissionless resolution, post-match evidence windows, consensus-safe truth and evidence-coverage bitmaps, retryable dispatch, and the authenticated callback to the game. It does not calculate payouts.

### Game contract

[`contracts/moment_grid_game.py`](../contracts/moment_grid_game.py) owns payable entries, rarity-weighted pools, jackpot rollover, pending protocol revenue, liquidity and grid-diversity gates, bounded deterministic scoring, pull claims, and full timeout refunds. The owner and frontend cannot submit results.

### Reusable single-moment resolver

[`contracts/match_moment_resolver.py`](../contracts/match_moment_resolver.py) registers one constrained criterion and returns settled `TRUE`, `FALSE`, or retryable `INVALID`. Other games can consume it without adopting Moment Grid economics or UI. Its live Studionet records demonstrate the same evidence and validator-consensus boundary on completed matches.

### Web application

The Next.js app owns grid construction, readable stake allocation, wallet and wrong-network recovery, accepted/finalized transaction progress, round discovery, entry recovery, claim actions, leaderboard views, integrity disclosures, and the live reviewer route. It reads packed grids, marks, pool state, and claimable balances from contracts. The replay is presentation only.

### Shared scoring package

`@moment-grid/scoring` owns prediction definitions, event predicates, compact grid packing, parity vectors, and the eight row/column/diagonal combinations. It previews game behavior and cross-checks contract logic; `MomentGridGame` remains authoritative for money.

### Optional match API

The NestJS service is an optional replay/live-feed adapter. It stores normalized events and exposes replay controls. It has no chain keeper, payout engine, or settlement authority; the browser can run the bundled replay without it.

## Round lifecycle

1. Governance creates a game round and registers the same immutable match identity, two or three distinct allowlisted evidence URLs, callback address, resolution window, and refund deadline in the resolver.
2. Before `lock_at`, one wallet may submit one complete packed grid at or above that round's immutable floor (1 test GEN in the active round). The game accounts for every wei across nine isolated cell pools, jackpot, and pending revenue.
3. At lock, insufficient participants, liquidity, or unique grids make the round permissionlessly refundable.
4. After full time and `resolve_not_before`, any account may request resolution. The caller supplies no verdict and cannot replace sources.
5. Leader and validators fetch the registered pages and independently derive bounded final facts. The equivalence principle compares stable decision fields, not prose.
6. Resolver code stores agreed truth and evidence-coverage bitmaps. Missing coverage remains explicit; material identity/source conflict stays retryable.
7. After consensus is durably stored, anyone sends the bitmaps to the configured game callback in a separate `dispatch_resolution` transaction. If delivery fails, anyone may retry it.
8. Anyone processes entrants in batches. The game refunds unsupported cell choices, distributes regular pools, totals jackpot qualifiers, rolls or opens the jackpot, and releases protocol revenue only after successful settlement.
9. Each wallet pulls its own claim. If evidence or scoring misses `refund_at`, anyone may activate full refunds and each entrant reclaims the gross stake.

## Trust and failure model

- Registration is curated, but registered definitions cannot be overwritten.
- Resolution is permissionless, source-bound, and answer-free.
- Two distinct allowlisted publishers must be available and materially consistent.
- Missing evidence is never silently converted to FALSE.
- The resolver callback is authenticated; owner and frontend cannot inject bitmaps.
- Round liquidity and unique-grid floors prevent the one-player guaranteed-loss case. Two disclosed fixed-grid bots satisfy the baseline gate without being counted as organic users or human leaderboard entries.
- Accepted lifecycle status alone is not treated as execution success. Player entries verify `FINISHED_WITH_RETURN`, expose accepted state as provisional, and track finality in the background. Lifecycle operations retain finalized predecessor gates.
- The replay and local previews never produce claimable balances.
- Pause blocks new exposure but cannot block settlement, claims, refunds, or withdrawals.
- Owner transfer is two-step. Disclosed player bots and historical QA activity are publicly labeled.
- Private keys and account passwords are never accepted by repository scripts.

Exact payout accounting is in [ONCHAIN_GAME.md](ONCHAIN_GAME.md). Source allowlisting, disagreement, and finality policies are in [GENLAYER_SOURCE_POLICY.md](GENLAYER_SOURCE_POLICY.md).
