# Product roadmap and release gates

## Product wedge

Moment Grid is football bingo powered by nine transparent pari-mutuel markets:
make nine match-moment calls, watch every square settle from validator-agreed
public evidence, and complete a horizontal row plus a diagonal to share the
rolling jackpot.

## Implemented in V3

- Contract-authoritative grids, marks, line counts, claims, and leaderboard.
- Future kickoff and post-match evidence windows.
- Minimum participants, gross liquidity, and unique-grid floors with full voids.
- Truth and evidence-coverage bitmaps; unknown selections refund.
- Permissionless resolution retry, callback redispatch, batched scoring,
  scoring-timeout recovery, refunds, and claims.
- Transparent live pool backing and exact stake allocation.
- Immutable per-round minimums down to 1 GEN and nine economically isolated
  cell ledgers; a cell can never subsidize a different cell.
- Two disclosed, precommitted fixed-grid player bots plus a separate
  permissionless keeper policy. Bots are excluded from human standings.
- Resolver consensus persists before a separate callback dispatch, removing
  the child-callback ordering flaw observed in the Bradbury V2 rehearsal.
- Persistent rounds, wallet entries, real standings, finalization progress,
  wrong-network recovery, faucet access, integrity, and responsible-play pages.
- Two-step ownership and a pause that cannot block exits.

## Testnet launch gate

- [x] Deploy fresh V3 game and resolver contracts on Bradbury and verify both
  report version `3.0.0` with accepted successful receipts and readable schemas.
- [x] Register the 21 August 2026 Arsenal–Coventry fixture with BBC and
  TheSportsDB URLs, a 1 GEN floor, and explicit post-match/refund windows.
- [x] Seed Form Bot and Chaos Bot at 1 test GEN each with public fixed grids;
  verify two participants, two unique grids, 2 GEN escrow, and liquidity ready.
- [x] Preserve and document the Bradbury V2 rehearsal discrepancy. The game
  settled and both controlled wallets claimed while the resolver record stayed
  pending, proving automatic child callbacks were unsafe. V3 requires a
  separate permissionless dispatch after durable consensus.
- [x] Record accepted deployment receipts in `deployments/genlayer/`.
- [x] Implement acceptance-first Bradbury entries with explicit provisional UI
  and background finality tracking; keep settlement and claims finality-gated.
- [ ] Record Bradbury finality for both V3 deployments after the appeal window.
- [ ] Update Vercel environment variables and visually verify the public game,
  rounds, entries, consensus proof, integrity, and responsible-play routes.
- [ ] Publish a 90-second reviewer recording after the Bradbury V3 release is live.

## Mainnet / real-value blockers

- Independent intelligent-contract and economic audit.
- Jurisdiction-specific legal advice, licensing analysis, age gating, sanctions
  controls, geofencing where required, privacy terms, and complaints process.
- Deposit/loss/time limits, self-exclusion, cooling-off, reality checks, and
  links to local support organizations.
- Multi-signature or governed owner, incident response, monitoring, source
  degradation alerts, and public postmortem policy.
- Indexer and notification service with availability objectives.
- Liquidity strategy, market-maker rules, anti-sybil analysis, and simulations
  of jackpot frequency, concentration, collusion, and fee/RTP outcomes.

## Product KPIs

- First-visit grid completion, review-to-sign conversion, and wallet/network
  failure recovery.
- Unique grids / participants, option concentration, and underfilled void rate.
- Settlement time after evidence window, redispatch rate, and claim completion.
- Return-to-next-fixture rate and share-to-visit conversion.
- Support contacts, mistaken-win reports, and responsible-play limit usage.
