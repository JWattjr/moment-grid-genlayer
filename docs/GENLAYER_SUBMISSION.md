# GenLayer Project contribution package

This is the ready-to-paste package for the Portal **Builder → Projects → Project** submission. Use the actual submission date shown by the Portal. The package documents disclosed automation as test activity, never organic liquidity.

## Form fields

### Title

```text
Moment Grid — GenLayer-Settled Football Prediction Game
```

### Notes / Description

The following copy is below the Portal's 1,000-character limit.

```text
Moment Grid is a fully playable 3×3 football prediction game on GenLayer StudioNet. Players sign one payable transaction to lock nine match calls from a 1 test GEN minimum. Every square is a separate loser-funded pari-mutuel pool; Common, Medium, and Rare rows set only the allocation weight. After full time, a permissionless Intelligent Contract asks validators to read immutable BBC/TheSportsDB evidence and agree on truth plus coverage bitmaps. Consensus is stored first, then separately dispatched to the game. Deterministic on-chain code scores grids, refunds unsupported calls, distributes each cell independently, and opens jackpot claims or full recovery. The Next.js app handles wallet signing, finalized transaction state, rounds, entries, claims, standings, integrity, and safer-play disclosures. V3 is live with two clearly labeled fixed-grid bots, 49 direct tests, and public deployment receipts.
```

Keep this copy below the Portal's 1,000-character limit when editing.

## Evidence URLs

Add these as separate evidence items in this order:

1. Required GitHub Repository
   `https://github.com/JWattjr/moment-grid-genlayer`
2. Live application
   `https://moment-grid-genlayer.vercel.app`
3. Live GenLayer proof
   `https://moment-grid-genlayer.vercel.app/genlayer`
4. StudioNet V3 deployment manifest
   `https://github.com/JWattjr/moment-grid-genlayer/blob/main/deployments/genlayer/studionet.json`
5. Architecture and payout specification
   `https://github.com/JWattjr/moment-grid-genlayer/blob/main/docs/ONCHAIN_GAME.md`
6. Optional recording, after it exists
   Paste the public unlisted YouTube or Loom URL produced from `docs/DEMO_SCRIPT.md`.

Do not add localhost links, private Vercel deployment URLs, fixture-only screenshots, or a video URL that reviewers cannot open without signing in.

## Quality-bar mapping

| Portal criterion | Reviewer evidence |
| --- | --- |
| Solves a real trust problem | The owner/frontend cannot supply match results. Validators interpret independently registered public football evidence. |
| Uses live or authoritative data | The active resolver uses immutable BBC Sport and TheSportsDB match pages; settled reusable proofs use BBC Sport and ESPN. |
| Complete source and accurate docs | Three Intelligent Contracts, Next.js client, pure scoring package, 49 direct tests, source policy, architecture, runbooks, deployment manifests, and receipts are public. |
| Frontend genuinely calls the contract | Wallet-backed payable entry, resolution/retry, callback redispatch, batched processing, refunds, and pull claims all wait for finalized successful execution. Read routes recover contract state. |
| Meaningfully different from boilerplate | Nine economically isolated rarity-weighted pools, evidence-coverage refunds, liquidity/unique-grid gates, horizontal-plus-diagonal jackpot, rollover, persistent positions, and permissionless recovery form one product loop. |
| Credible path to continued use | A real future fixture, round lobby, entries, leaderboard, two disclosed player bots, separate keeper policy, safer-play constraints, and product KPIs are implemented or documented. |

## Reviewer proof anchors

### StudioNet V3

- Game: `0x9f95bDD3E4a2479b8f628599cc672E7a519C0920`
- Full-match resolver: `0xDa0569bE8c8d148D3F2f6Fba5aC00a39bFc64590`
- Public round: `epl-2026-08-21-arsenal-coventry-studionet-v3`
- Public round at preparation time: OPEN, 2 disclosed fixed-grid bots, 2 unique grids, 2 test GEN escrow, 0.1 test GEN jackpot, liquidity gate met.
- Both deployment receipts finalized with `MAJORITY_AGREE` and successful execution. The round registration and creation also finalized successfully.

### Studionet reusable contract

- Contract: `0x3a87Ee9a47f6B1d9d2298166a4a7cA4907780dd9`
- TRUE receipt: `0x647cb97c7363c542972dc4e35b525cbd67cdd8bb8e4dfe55b8626b139f64eee4`
- FALSE receipt: `0xec06d204c260028a6889fe2a0e6885f02ee1084673111e78451050aaf8a1eb02`
- Validator outcome: `MAJORITY_AGREE`, successful execution.

## Final pre-submit gate

- [x] Public GitHub repository opens while signed out.
- [x] Public live application opens while signed out.
- [x] StudioNet game and resolver are deployed and report `3.0.0`.
- [x] Public future round has two distinct disclosed bot grids, a 1 GEN floor, and its liquidity gate is met.
- [x] Controlled accounts are labeled as test activity in UI and manifests.
- [x] Live reviewer route exposes settled TRUE and FALSE records.
- [x] All three contracts pass GenVM lint/validation.
- [x] Direct Mode suite passes 49/49 tests, including an exact nine-independent-pool payout case.
- [x] The Bradbury V2 callback-order discrepancy is documented and removed in V3 through separate resolve and dispatch transactions.
- [ ] Optional 90-second public recording is uploaded and its URL is added as evidence.
- [x] Final production build is deployed and visually rechecked after the documentation/UI polish commit.

The video is optional but likely improves review speed and highlight potential. Do not spend a Portal Project slot until the production deployment and evidence links are rechecked while signed out.

## Optional public post copy

```text
Moment Grid V3 is live on GenLayer StudioNet: a 3×3 football prediction game where players stake from 1 test GEN across nine independent cell pools. GenLayer validators settle granular match moments from immutable public evidence; deterministic on-chain code drives payouts, partial evidence refunds, or full timeout recovery. Two fixed-grid bots are publicly disclosed so a player can always join a liquid round. Live: https://moment-grid-genlayer.vercel.app Source: https://github.com/JWattjr/moment-grid-genlayer
```
