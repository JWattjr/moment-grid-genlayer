# GenLayer Project contribution package

This is the ready-to-paste package for the Portal **Builder → Projects → Project** submission. Use the actual submission date shown by the Portal. The package documents disclosed automation as test activity, never organic liquidity.

## Form fields

### Title

```text
Moment Grid — Football Prediction Game on GenLayer
```

### Notes / Description

The following copy is written in plain English and stays below the Portal's 1,000-character limit.

```text
Moment Grid is a 3×3 football prediction game running on GenLayer Bradbury. Players choose nine events they think will happen during a football match and stake from 1 test GEN. Each square has its own prize pool, and players with the correct pick share that pool. After the match, GenLayer validators check public reports from BBC and TheSportsDB and agree on what happened. The game then scores every grid, pays winners, refunds any square that cannot be verified, and allows full refunds if a round cannot be completed. Completing a correct row and diagonal also wins a share of the jackpot. The live app supports wallet entry, results, claims, and round history. Two clearly labelled bots provide testnet opponents. The code, tests, live app, and deployment records are public.
```

Keep this copy below the Portal's 1,000-character limit when editing.

## Evidence URLs

Add only these three evidence items:

1. Required GitHub Repository
   `https://github.com/JWattjr/moment-grid-genlayer`
2. Live game
   `https://moment-grid-genlayer.vercel.app`
3. Live GenLayer result
   `https://moment-grid-genlayer.vercel.app/genlayer`

The repository already contains the contracts, tests, deployment records, and detailed documentation. A short public video can be added later, but it is optional.

For a minimal field-by-field paste sheet, use [`SUBMIT_NOW.md`](SUBMIT_NOW.md).

## Quality-bar mapping

| Portal criterion | Reviewer evidence |
| --- | --- |
| Solves a real trust problem | The owner/frontend cannot supply match results. Validators interpret independently registered public football evidence. |
| Uses live or authoritative data | The active resolver uses immutable BBC Sport and TheSportsDB match pages; settled reusable proofs use BBC Sport and ESPN. |
| Complete source and accurate docs | Three Intelligent Contracts, Next.js client, pure scoring package, 49 direct tests, source policy, architecture, runbooks, deployment manifests, and receipts are public. |
| Frontend genuinely calls the contract | Wallet-backed payable entry reports successful validator acceptance immediately and tracks finality; resolution/retry, callback redispatch, batched processing, refunds, and pull claims verify their required finalized state. Read routes recover contract state. |
| Meaningfully different from boilerplate | Nine economically isolated rarity-weighted pools, evidence-coverage refunds, liquidity/unique-grid gates, horizontal-plus-diagonal jackpot, rollover, persistent positions, and permissionless recovery form one product loop. |
| Credible path to continued use | A real future fixture, round lobby, entries, leaderboard, two disclosed player bots, separate keeper policy, safer-play constraints, and product KPIs are implemented or documented. |

## Reviewer proof anchors

### Bradbury V3

- Game: `0x4bff4e5b50E21D25988D8029A7535E8111Eb62eF`
- Full-match resolver: `0x901327a3D6D1d91baa57542bd27eAf336bC604d7`
- Public round: `epl-2026-08-21-arsenal-coventry-bradbury-v3`
- Public round at preparation time: OPEN, 2 disclosed fixed-grid bots, 2 unique grids, 2 test GEN escrow, 0.1 test GEN jackpot, liquidity gate met.
- Both deployments, round registration, round creation, and both bot entries are `FINALIZED` with successful execution. Both contracts expose readable schemas and report version `3.0.0`; the round and all nine pool ledgers were verified from contract reads.

### Studionet reusable contract

- Contract: `0x3a87Ee9a47f6B1d9d2298166a4a7cA4907780dd9`
- TRUE receipt: `0x647cb97c7363c542972dc4e35b525cbd67cdd8bb8e4dfe55b8626b139f64eee4`
- FALSE receipt: `0xec06d204c260028a6889fe2a0e6885f02ee1084673111e78451050aaf8a1eb02`
- Validator outcome: `MAJORITY_AGREE`, successful execution.

## Final pre-submit gate

- [x] Public GitHub repository opens while signed out.
- [x] Public live application opens while signed out.
- [x] Fresh Bradbury game and resolver are deployed and report `3.0.0`.
- [x] Public future round has two distinct disclosed bot grids, a 1 GEN floor, and its liquidity gate is met.
- [x] Controlled accounts are labeled as test activity in UI and manifests.
- [x] Live reviewer route exposes settled TRUE and FALSE records.
- [x] All three contracts pass GenVM lint/validation.
- [x] Direct Mode suite passes 49/49 tests, including an exact nine-independent-pool payout case.
- [x] The Bradbury V2 callback-order discrepancy is documented and removed in V3 through separate resolve and dispatch transactions.
- [ ] Optional 90-second public recording is uploaded and its URL is added as evidence.
- [x] Final Bradbury production build is deployed and visually rechecked after the acceptance-first UI commit.

The video is optional but likely improves review speed and highlight potential. Do not spend a Portal Project slot until the production deployment and evidence links are rechecked while signed out.

## Optional public post copy

```text
Moment Grid V3 is live on GenLayer Bradbury: a 3×3 football prediction game where players stake from 1 test GEN across nine independent cell pools. Validator-accepted entries appear immediately while finality continues in the background. GenLayer consensus settles granular match moments from immutable public evidence; deterministic code drives payouts, partial evidence refunds, or full timeout recovery. Two fixed-grid bots are publicly disclosed so a player can always join a liquid round. Live: https://moment-grid-genlayer.vercel.app Source: https://github.com/JWattjr/moment-grid-genlayer
```
