# Moment Grid web application

The Next.js client is the playable and reviewer-facing interface for Moment Grid. It connects to the V2 game and full-match resolver on Testnet Bradbury, and exposes settled reusable resolver records from Studionet.

## Run locally

From the repository root:

```bash
pnpm install
cp web/.env.example web/.env.local
pnpm --filter @moment-grid/scoring build
pnpm --filter web dev
```

Open `http://localhost:3003`.

## Public routes

- `/` — build, review, sign, replay, settle, and claim the configured round.
- `/rounds` — contract-read round lobby with liquidity and controlled-test disclosures.
- `/entries` — wallet-specific positions and claims.
- `/leaderboard` — contract-derived standings.
- `/rules` — grid, pool, and jackpot rules.
- `/integrity` — trust boundary, recovery behavior, source, and proof links.
- `/responsible-play` — testnet and real-value launch constraints.
- `/genlayer` — live settled TRUE/FALSE records from the reusable Studionet resolver.

The app never accepts a caller-provided result. It waits for transaction finalization, verifies execution success, and restores the packed grid and claim state from the game contract.

## Verification

```bash
pnpm --filter web lint
pnpm --filter web typecheck
pnpm --filter web build
pnpm --filter web test:e2e
```

The default E2E suite mocks only the read API for deterministic UI-state coverage. Set `E2E_LIVE_GENLAYER=1` for the additional read-only Studionet proof check.
