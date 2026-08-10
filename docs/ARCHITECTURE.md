# GenLayer-native architecture

Moment Grid separates real-world adjudication from deterministic game rules. GenLayer interprets public football evidence; ordinary TypeScript maps finalized facts to grid cells and counts completed lines.

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
@moment-grid/scoring applies the fact
                 |
                 v
     hit mask + completed lines
```

## Responsibilities

### Intelligent Contract

`contracts/match_moment_resolver.py` owns immutable match definitions, evidence policy, permissionless resolution, finality checks, consensus-safe structured output, and durable resolution history. It does not know about grids, rankings, or user-interface state.

### Web application

The Next.js app owns the playable replay, the reviewer route, public Studionet reads, and wallet-backed permissionless resolution requests. Read-only use does not require a wallet. The injected-wallet path targets GenLayer Studionet only.

### Scoring package

`@moment-grid/scoring` owns prediction definitions, event predicates, hit masks, and the eight row/column/diagonal combinations. This logic is pure and testable. The GenLayer adapter changes only a cell whose prediction ID matches a settled resolver record.

### Optional match API

The NestJS service is an optional replay and live-feed adapter. It stores match events and exposes replay controls; it has no chain keeper, payout engine, or settlement authority. The browser can run its bundled replay without this process.

## Resolution lifecycle

1. The contract owner registers a match identity, criterion, and two or three allowlisted HTTPS evidence URLs.
2. The definition becomes immutable and enumerable.
3. Any account may request resolution; the caller cannot provide an answer or replace the sources.
4. Validators fetch the registered sources and extract the bounded fact model.
5. The equivalence principle compares stable fields: result, reason code, match status, and decisive minute.
6. Deterministic contract code stores TRUE or FALSE. INVALID remains retryable.
7. The application reads the record and applies it to the matching prediction cell.

## Trust and failure model

- Registration is curated, but registered definitions cannot be overwritten.
- Resolution is permissionless and answer-free.
- Two configured sources must be available and materially consistent.
- Missing identity, disagreement, unavailable evidence, or insufficient finality produces INVALID instead of a guessed result.
- Settled records cannot be mutated.
- The LLM does not calculate grid scores.
- Private keys and account passwords are never accepted by repository scripts.

The exact source allowlist and disagreement policy are documented in [GENLAYER_SOURCE_POLICY.md](GENLAYER_SOURCE_POLICY.md).
