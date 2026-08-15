# Moment Grid — Portal submit-now sheet

Use this page while completing the GenLayer Portal form. It contains only the
fields that need to be pasted. The fuller reviewer rationale and proof anchors
remain in [`GENLAYER_SUBMISSION.md`](GENLAYER_SUBMISSION.md).

## Select

- Contribution type: **Builder**
- Category: **Projects**
- Item: **Project**
- Contribution date: use the Portal's current auto-filled date; do not backdate
  the contribution.

## Title

```text
Moment Grid — GenLayer-Settled Football Prediction Game
```

## Notes / Description

**888 characters — within the Portal's 1,000-character limit.**

```text
Moment Grid is a fully playable 3×3 football prediction game on GenLayer Bradbury. Players sign one payable transaction to lock nine match calls from a 1 test GEN minimum. Every square is a separate loser-funded pari-mutuel pool; rows set only allocation weight. The app shows validator-accepted entries immediately and tracks Bradbury finality in the background. After full time, a permissionless Intelligent Contract asks validators to read immutable BBC/TheSportsDB evidence and agree on truth plus coverage bitmaps. Consensus is stored first, then separately dispatched to the game. Deterministic on-chain code scores grids, refunds unsupported calls, distributes each cell independently, and opens jackpot claims or full recovery. Resolution dispatch, settlement, and claims stay finality-gated. V3 is live with two disclosed fixed-grid bots, 49 direct tests, and finalized receipts.
```

## Evidence — add in this order

1. **Required · GitHub Repository**
   `https://github.com/JWattjr/moment-grid-genlayer`
2. **Live application**
   `https://moment-grid-genlayer.vercel.app`
3. **Live GenLayer proof**
   `https://moment-grid-genlayer.vercel.app/genlayer`
4. **Bradbury V3 deployment manifest**
   `https://github.com/JWattjr/moment-grid-genlayer/blob/main/deployments/genlayer/bradbury-v3.json`
5. **Architecture and payout specification**
   `https://github.com/JWattjr/moment-grid-genlayer/blob/main/docs/ONCHAIN_GAME.md`
6. **Optional recording**
   Add the public Loom or unlisted YouTube URL only after confirming it opens
   without sign-in. Record from [`DEMO_SCRIPT.md`](DEMO_SCRIPT.md).

The first five URLs returned public HTTP 200 responses on 15 August 2026. Let
the Portal auto-detect each URL type. Do not add localhost, a private Vercel
preview, or a recording that requires reviewer authentication.

## Final visual check before Submit

- The live home screen says **Bradbury V3**, **Arsenal vs Coventry City**, and
  **1 GEN** minimum.
- Review shows nine independent pools: 0.05 GEN per Common cell, 0.10 per
  Medium cell, and 0.15 per Rare cell at the minimum stake.
- Rounds shows two entries, two unique disclosed bot grids, 0.1 GEN jackpot,
  and **Liquidity gate met**.
- Live proof shows a settled TRUE record and a settled FALSE record.
- No private key, keystore password, seed phrase, or private deployment URL is
  present anywhere in the submission.
- Submit only once. A Project submission consumes one of the Portal's weekly
  Project slots.

## Reviewer anchors if the Portal asks for clarification

- Bradbury game: `0x4bff4e5b50E21D25988D8029A7535E8111Eb62eF`
- Bradbury full-match resolver: `0x901327a3D6D1d91baa57542bd27eAf336bC604d7`
- Active round: `epl-2026-08-21-arsenal-coventry-bradbury-v3`
- Contract versions: `3.0.0`
- Bradbury finality: both deployments, round registration, round creation, and
  both disclosed bot entries are `FINALIZED` with successful execution.
- Validation: 49/49 Direct Mode tests; all three Intelligent Contracts pass
  GenVM lint; production TypeScript, ESLint, build, bot-policy, and live-page
  verification passed.

Do not describe Form Bot or Chaos Bot as organic users. They are disclosed,
fixed-grid test opponents that provide baseline testnet liquidity and are
excluded from the human leaderboard.
