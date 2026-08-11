# GenLayer-native architecture

Moment Grid separates real-world adjudication from deterministic game rules. GenLayer interprets public football evidence; deterministic contract code scores entries and distributes native GEN, while shared TypeScript previews the same grid rules in the UI.

## System boundary

```text
Player builds and locks a 3×3 grid
                 |
                 v
Next.js application reads a registered criterion
                 |
                 v
MatchMomentResolver on GenLayer Studionet
        |                       |
        v                       v
    BBC Sport                 ESPN
        \                       /
         independent validators
                 |
                 v
      TRUE / FALSE / INVALID
                 |
                 v
MomentGridGame applies the finalized bitmaps
                 |
                 v
regular pools + horizontal/diagonal jackpot
```

## Responsibilities

### Intelligent Contract

`contracts/match_round_resolver.py` owns immutable match definitions, evidence policy, permissionless resolution, finality checks, consensus-safe three-window bitmaps, and the authenticated callback to the game. It does not calculate payouts.

`contracts/moment_grid_game.py` owns entries, rarity-weighted pools, jackpot rollover, protocol revenue, batched deterministic scoring, claims, and full timeout refunds. The owner and frontend cannot submit results.

### Web application

The Next.js app owns the playable replay, the reviewer route, read-only chain state, and wallet-backed entry, resolution, settlement, and claim transactions. Resolver proof remains on Studionet while the game flow targets persistent Testnet Bradbury. Read-only use does not require a wallet.

### Scoring package

`@moment-grid/scoring` owns prediction definitions, event predicates, hit masks, the eight row/column/diagonal combinations, and the matching jackpot preview rule. This logic is pure and testable, but the Intelligent Contract remains authoritative for money.

### Optional match API

The NestJS service is an optional replay and live-feed adapter. It stores match events and exposes replay controls; it has no chain keeper, payout engine, or settlement authority. The browser can run its bundled replay without this process.

## Resolution lifecycle

1. The contract owner creates a game round and registers its match identity plus two or three allowlisted HTTPS evidence URLs in the resolver.
2. The definition becomes immutable and enumerable.
3. Any account may request resolution; the caller cannot provide an answer or replace the sources.
4. Validators fetch the registered sources and extract the bounded fact model.
5. The equivalence principle compares stable fields: result, reason code, match status, and decisive minute.
6. Deterministic resolver code stores the accepted outcome bitmaps and sends them to the authenticated game callback. INVALID remains retryable.
7. Anyone processes bounded settlement batches. The game totals qualifying jackpot stake and opens regular and jackpot claims only when scoring is complete.

## Trust and failure model

- Registration is curated, but registered definitions cannot be overwritten.
- Resolution is permissionless and answer-free.
- Two configured sources must be available and materially consistent.
- Missing identity, disagreement, unavailable evidence, or insufficient finality produces INVALID instead of a guessed result.
- Settled records cannot be mutated.
- The LLM does not calculate grid scores.
- Private keys and account passwords are never accepted by repository scripts.

The exact source allowlist and disagreement policy are documented in [GENLAYER_SOURCE_POLICY.md](GENLAYER_SOURCE_POLICY.md).
