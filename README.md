# Moment Grid

**A 3×3 football prediction game with native-GEN pools settled from public match evidence by GenLayer validator consensus.**

[Play the Bradbury game](https://moment-grid-genlayer.vercel.app) · [Inspect live consensus proof](https://moment-grid-genlayer.vercel.app/genlayer) · [Review deployment receipts](deployments/genlayer/bradbury-v3.json)

## Reviewer quick path

1. Open the [live game](https://moment-grid-genlayer.vercel.app) and build nine calls across three time windows and rarity tiers.
2. Review the stake split before signing. The minimum 1 GEN entry allocates 0.05 GEN to each Common cell, 0.10 to each Medium cell, 0.15 to each Rare cell, 0.05 to the jackpot, and 0.05 to pending protocol revenue.
3. Open [Rounds](https://moment-grid-genlayer.vercel.app/rounds) to inspect contract-read liquidity, entries, and clearly disclosed controlled test accounts.
4. Open [Live proof](https://moment-grid-genlayer.vercel.app/genlayer) to inspect settled TRUE and FALSE results produced from BBC and ESPN evidence by the reusable Studionet resolver.
5. Review [Integrity](https://moment-grid-genlayer.vercel.app/integrity), the [Bradbury V3 deployment manifest](deployments/genlayer/bradbury-v3.json), and the [full game specification](docs/ONCHAIN_GAME.md).

No wallet is required to inspect rounds, contract state, consensus records, rules, or the trust model. A compatible wallet is required only to sign an entry or permissionless lifecycle action on Bradbury.

## The trust problem

Final-score markets can use ordinary feeds. Moment Grid asks granular questions—whether the home team scored first, whether both teams scored, or whether a penalty, shot, card, corner, substitution, VAR event, or late goal occurred in a particular window. Those facts live in changing, unstructured match reports. Letting a frontend or one keeper interpret them would recreate a trusted oracle.

Moment Grid registers the match and evidence policy before play. GenLayer validators independently read at least two public publishers and agree on bounded truth and evidence-coverage bitmaps. Only finalized resolver state can enter the game contract; the frontend and owner cannot submit a winning result.

## End-to-end on-chain lifecycle

```text
Player signs one payable packed grid on Bradbury
                         ↓
MomentGridGame escrows GEN across nine pools + jackpot
                         ↓
Entries lock before kickoff; definitions stay immutable
                         ↓
MatchRoundResolver reads registered BBC / TheSportsDB evidence
                         ↓
Independent validators agree on truth + coverage bitmaps
                         ↓
Stored consensus is dispatched to MomentGridGame in a second transaction
                         ↓
Permissionless batched scoring opens claims or full refunds
```

The LLM interprets public evidence; deterministic contract code scores grids, totals jackpot eligibility, and distributes GEN. Missing evidence is not treated as FALSE: unsupported selections refund their affected cell stake, while underfilled, unresolved, or timed-out rounds support full permissionless refunds.

## Game economy

- The minimum stake for the active round is 1 GEN; the testnet UI caps a single entry at 100 GEN.
- Every stake backs nine independent pari-mutuel cell pools: each Common cell receives 5%, each Medium cell 10%, and each Rare cell 15%. A cell's balance never pays another cell.
- The jackpot receives 5%; pending protocol revenue receives 5% and becomes withdrawable only after successful settlement.
- A player qualifies for the jackpot by completing at least one horizontal row and one diagonal. Qualifiers share it pro rata by gross stake; without a qualifier, it rolls into the next round.
- Each round requires configured minimum participant, liquidity, and unique-grid gates. Failure opens a full-stake refund path.

Detailed accounting and failure behavior are in [docs/ONCHAIN_GAME.md](docs/ONCHAIN_GAME.md).

## Live deployments

### Bradbury V3 — active playable round

| Item | Value |
| --- | --- |
| Network | Bradbury testnet · chain 4221 |
| Game | `0x4bff4e5b50E21D25988D8029A7535E8111Eb62eF` |
| Full-match resolver | `0x901327a3D6D1d91baa57542bd27eAf336bC604d7` |
| Contract version | `3.0.0` on both deployments |
| Public round | `epl-2026-08-21-arsenal-coventry-bradbury-v3` |
| Public round state | OPEN · 2 disclosed bots · 2 unique grids · 2 test GEN escrow · liquidity gate met |
| Minimum entry | 1 test GEN |

Form Bot and Chaos Bot each committed a distinct public fixed grid and exactly 1 test GEN before human play. They provide disclosed baseline liquidity, are never described as organic users, and are excluded from the human leaderboard. Every one of the nine cells keeps an independent pool and option ledger. Exact inputs, accepted receipts, and state are recorded in [deployments/genlayer/bradbury-v3.json](deployments/genlayer/bradbury-v3.json).

Player entries use an acceptance-first Bradbury experience: successful validator `ACCEPTED` state immediately reveals the immutable entry and pool position while the UI tracks the longer appeal/finality window in the background. Resolution dispatch, settlement, and claims still require finalized predecessor state.

### Preserved Bradbury V2

The prior Bradbury V2 contracts and positions remain recorded in [deployments/genlayer/bradbury.json](deployments/genlayer/bradbury.json), and the Integrity page links to the preserved V2 release for recovery. New public play uses fresh Bradbury V3 contracts. The earlier QA round exposed a callback-order failure: the game reached settlement while the resolver record remained pending. V3 removes automatic callback dispatch, so consensus must persist first and a separate permissionless transaction sends it to the game.

### Reusable Studionet resolver proof

| Item | Value |
| --- | --- |
| Network | Studionet · chain 61999 |
| Contract | `0x3a87Ee9a47f6B1d9d2298166a4a7cA4907780dd9` |
| TRUE transaction | `0x647cb97c7363c542972dc4e35b525cbd67cdd8bb8e4dfe55b8626b139f64eee4` |
| FALSE transaction | `0xec06d204c260028a6889fe2a0e6885f02ee1084673111e78451050aaf8a1eb02` |
| Consensus | `MAJORITY_AGREE` · successful execution |
| Evidence | BBC Sport + ESPN |

[`MatchMomentResolver`](contracts/match_moment_resolver.py) is a reusable, application-neutral contract for one constrained football criterion. Its settled StudioNet records give reviewers an immediately inspectable consensus proof while the active Bradbury fixture remains open.

## Repository map

- [`contracts/moment_grid_game.py`](contracts/moment_grid_game.py) — payable entries, nine pools, jackpot, deterministic scoring, claims, and refunds.
- [`contracts/match_round_resolver.py`](contracts/match_round_resolver.py) — full-match public-evidence resolution and authenticated game callback.
- [`contracts/match_moment_resolver.py`](contracts/match_moment_resolver.py) — reusable TRUE/FALSE/INVALID football adjudication primitive.
- [`web/`](web/) — Next.js wallet, transaction lifecycle, rounds, entries, standings, integrity, and reviewer proof.
- [`shared/scoring/`](shared/scoring/) — pure grid definitions, parity vectors, preview scoring, and line rules.
- [`tests/`](tests/) — Direct Mode and hosted-network contract coverage.
- [`docs/`](docs/) — architecture, source policy, runbooks, responsible-play constraints, roadmap, and submission assets.
- [`deployments/genlayer/`](deployments/genlayer/) — public deployment and transaction records.

## Local development

Requirements: Node 20+, pnpm 10, and Python 3.12+.

```bash
pnpm install
python -m venv .venv
# Activate .venv, then:
pip install -r requirements.txt

cp web/.env.example web/.env.local
pnpm --filter @moment-grid/scoring build
pnpm --filter web dev
```

Open `http://localhost:3003`. The checked-in environment example points at the public Bradbury V3 game and the reusable StudioNet resolver proof. Never add a private key, account password, or provider secret to an environment file.

## Verification

```bash
# Intelligent Contracts
genvm-lint check contracts/match_moment_resolver.py
genvm-lint check contracts/match_round_resolver.py
genvm-lint check contracts/moment_grid_game.py
pytest tests/direct -v
gltest tests/integration/test_deployed_studionet_resolver.py -v -s --network studionet

# Application
pnpm test
pnpm lint
pnpm typecheck
pnpm build
pnpm --filter web test:e2e
```

Current Direct Mode result: **49 passed** across registration, access control, web-evidence failure modes, consensus fields, one-GEN and per-round stake floors, nine isolated pool ledgers, liquidity gates, validity refunds, batched scoring, jackpot sharing/rollover, claims, and timeout recovery. All three Intelligent Contracts pass `genvm-lint check`.

## Security and launch status

- Registered definitions are immutable; resolution is permissionless and answer-free.
- At least two distinct allowlisted publishers must be available and materially consistent.
- Caller-supplied verdicts are rejected; only the configured resolver can deliver finalized bitmaps.
- Ownership transfer is two-step, and pausing cannot block exits, claims, or refunds.
- Form Bot, Chaos Bot, and historical controlled QA activity are publicly labeled in UI and manifests.
- This is unaudited testnet software. Mainnet or real-value launch remains blocked on independent contract/economic review, governed ownership, monitoring, legal and licensing analysis, age/location controls, self-exclusion and safer-play controls, and an incident/appeals process.

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md), [docs/GENLAYER_SOURCE_POLICY.md](docs/GENLAYER_SOURCE_POLICY.md), [docs/PRODUCT_ROADMAP.md](docs/PRODUCT_ROADMAP.md), and [docs/RESPONSIBLE_PLAY.md](docs/RESPONSIBLE_PLAY.md).

## Submission assets

- [Ready-to-paste Project contribution](docs/GENLAYER_SUBMISSION.md)
- [Reviewer demo recording script](docs/DEMO_SCRIPT.md)
- [Bradbury V3 operation](docs/BRADBURY_V3_RUNBOOK.md)
- [StudioNet V3 pre-production operation](docs/STUDIONET_RUNBOOK.md)
- [Preserved Bradbury V2 operation and payout rehearsal](docs/BRADBURY_GAME_RUNBOOK.md)
- [Studionet reusable resolver runbook](docs/STUDIONET_RUNBOOK.md)

Source is public for review. No open-source license has been granted yet; all rights remain reserved until the owner chooses a license.
