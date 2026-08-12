# Product roadmap and release gates

## Product wedge

Moment Grid is football bingo powered by nine transparent pari-mutuel markets:
make nine match-moment calls, watch every square settle from validator-agreed
public evidence, and complete a horizontal row plus a diagonal to share the
rolling jackpot.

## Implemented in V2

- Contract-authoritative grids, marks, line counts, claims, and leaderboard.
- Future kickoff and post-match evidence windows.
- Minimum participants, gross liquidity, and unique-grid floors with full voids.
- Truth and evidence-coverage bitmaps; unknown selections refund.
- Permissionless resolution retry, callback redispatch, batched scoring,
  scoring-timeout recovery, refunds, and claims.
- Transparent live pool backing and exact stake allocation.
- Persistent rounds, wallet entries, real standings, finalization progress,
  wrong-network recovery, faucet access, integrity, and responsible-play pages.
- Two-step ownership and a pause that cannot block exits.

## Testnet launch gate

- [x] Deploy fresh V2 game and resolver contracts and verify both report
  version `2.0.0` with the expected schemas.
- Register a real upcoming fixture with two distinct authoritative URLs.
- Run two-wallet end-to-end rehearsal: enter distinct grids, resolve after full
  time, redispatch if needed, process, claim, and separately prove refund mode.
- [x] Record accepted deployment receipts in `deployments/genlayer/`.
- Record finality once Bradbury advances the accepted receipts beyond status 5.
- Update Vercel environment variables and visually verify mobile and desktop.

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
