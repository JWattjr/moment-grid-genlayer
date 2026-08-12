# GenLayer Project contribution package

This is the ready-to-paste package for the Portal **Builder → Projects → Project** submission. Use the actual submission date shown by the Portal. Do not describe the isolated payout rehearsal as complete until both controlled wallets have claimed and the receipts are recorded.

## Form fields

### Title

```text
Moment Grid — GenLayer-Settled Football Prediction Game
```

### Notes / Description

The following copy is below the Portal's 1,000-character limit.

```text
Moment Grid is a 3×3 football prediction game running end-to-end on GenLayer Bradbury. Players sign one payable transaction to lock nine match calls and stake native GEN across nine rarity-weighted pari-mutuel pools plus a rolling jackpot. After full time, a permissionless Intelligent Contract asks validators to read registered ESPN/TheSportsDB evidence, agree on bounded truth and coverage bitmaps, and send the finalized result to the game contract. Deterministic on-chain code scores grids, refunds unsupported calls, opens payouts, or returns full stakes when liquidity or evidence deadlines fail. The Next.js frontend handles wallet recovery, stake allocation, finalized entries, settlement, claims, rounds, standings, integrity, and safer-play disclosures. V2 is live on Bradbury with 10 GEN entries and a disclosed two-wallet payout rehearsal; the repo also includes settled Studionet TRUE/FALSE consensus proof, 46 direct contract tests, deployment receipts, and runbooks.
```

Character count: **982** including spaces and punctuation.

## Evidence URLs

Add these as separate evidence items in this order:

1. Required GitHub Repository
   `https://github.com/JWattjr/moment-grid-genlayer`
2. Live application
   `https://moment-grid-genlayer.vercel.app`
3. Live GenLayer proof
   `https://moment-grid-genlayer.vercel.app/genlayer`
4. Bradbury game contract
   `https://explorer-bradbury.genlayer.com/address/0x1D87C32c1A0D65C083ce322608D284E5767b8408`
5. Bradbury round resolver
   `https://explorer-bradbury.genlayer.com/address/0x0aeBC87aBa11CA67945A73BcbC66AEEAA0D828FB`
6. Optional recording, after it exists
   Paste the public unlisted YouTube or Loom URL produced from `docs/DEMO_SCRIPT.md`.

Do not add localhost links, private Vercel deployment URLs, fixture-only screenshots, or a video URL that reviewers cannot open without signing in.

## Quality-bar mapping

| Portal criterion | Reviewer evidence |
| --- | --- |
| Solves a real trust problem | The owner/frontend cannot supply match results. Validators interpret independently registered public football evidence. |
| Uses live or authoritative data | Resolver definitions use distinct ESPN and TheSportsDB match pages; settled reusable proofs use BBC Sport and ESPN. |
| Complete source and accurate docs | Three Intelligent Contracts, Next.js client, pure scoring package, 46 direct tests, source policy, architecture, runbooks, deployment manifests, and receipts are public. |
| Frontend genuinely calls the contract | Wallet-backed payable entry, resolution/retry, callback redispatch, batched processing, refunds, and pull claims all wait for finalized successful execution. Read routes recover contract state. |
| Meaningfully different from boilerplate | Nine rarity-weighted pari-mutuel pools, evidence-coverage refunds, liquidity/unique-grid gates, horizontal-plus-diagonal jackpot, rollover, persistent positions, and permissionless recovery form one product loop. |
| Credible path to continued use | Future fixture registration, round lobby, entries, leaderboard, disclosed keeper/test bot, safer-play constraints, and product KPIs are implemented or documented. |

## Reviewer proof anchors

### Bradbury V2

- Game: `0x1D87C32c1A0D65C083ce322608D284E5767b8408`
- Full-match resolver: `0x0aeBC87aBa11CA67945A73BcbC66AEEAA0D828FB`
- Public round: `epl-2026-08-21-arsenal-coventry-v2`
- Public round at preparation time: 2 entries, 2 unique grids, 20 GEN escrow, 1 GEN jackpot, liquidity gate met.
- Controlled QA round: `qa-2026-08-13-motagua-cartagines-v1`; two controlled wallets, 20 GEN escrow, settlement rehearsal armed for the registered post-match evidence window.

### Studionet reusable contract

- Contract: `0x3a87Ee9a47f6B1d9d2298166a4a7cA4907780dd9`
- TRUE receipt: `0x647cb97c7363c542972dc4e35b525cbd67cdd8bb8e4dfe55b8626b139f64eee4`
- FALSE receipt: `0xec06d204c260028a6889fe2a0e6885f02ee1084673111e78451050aaf8a1eb02`
- Validator outcome: `MAJORITY_AGREE`, successful execution.

## Final pre-submit gate

- [x] Public GitHub repository opens while signed out.
- [x] Public live application opens while signed out.
- [x] Bradbury game and resolver are deployed and report `2.0.0`.
- [x] Public future round has two distinct grids and its liquidity gate is met.
- [x] Controlled accounts are labeled as test activity in UI and manifests.
- [x] Live reviewer route exposes settled TRUE and FALSE records.
- [x] All three contracts pass GenVM lint/validation.
- [x] Direct Mode suite passes 46/46 tests.
- [ ] Isolated Bradbury rehearsal resolves, scores, and records two successful claims with before/after balances.
- [ ] Optional 90-second public recording is uploaded and its URL is added as evidence.
- [ ] Final production build is deployed and visually rechecked after the documentation/UI polish commit.

The first unchecked item is the strongest remaining credibility gate. The video is optional but likely improves review speed and highlight potential. Do not spend a Portal Project slot until the production deployment and payout rehearsal evidence are current.

## Optional public post copy

```text
Moment Grid is now live on GenLayer Testnet Bradbury: a 3×3 football prediction game where players stake testnet GEN across nine pools and GenLayer validators settle granular match moments from public evidence. The frontend cannot submit the answer; finalized resolver state drives deterministic on-chain scoring, claims, partial evidence refunds, or full timeout recovery. Live demo: https://moment-grid-genlayer.vercel.app Source: https://github.com/JWattjr/moment-grid-genlayer
```
