# Moment Grid

**A 3×3 football prediction game with native-GEN pools settled from public match evidence by GenLayer validator consensus.**

[Play the Bradbury testnet demo](https://moment-grid-genlayer.vercel.app) · [Inspect live consensus proof](https://moment-grid-genlayer.vercel.app/genlayer) · [Browse deployed game contract](https://explorer-bradbury.genlayer.com/address/0x1D87C32c1A0D65C083ce322608D284E5767b8408)

## Reviewer quick path

1. Open the [live game](https://moment-grid-genlayer.vercel.app) and build nine calls across three time windows and rarity tiers.
2. Review the stake split before signing. The minimum 10 GEN entry allocates 1.5 GEN to Common pools, 3 GEN to Medium, 4.5 GEN to Rare, 0.5 GEN to the jackpot, and 0.5 GEN to pending protocol revenue.
3. Open [Rounds](https://moment-grid-genlayer.vercel.app/rounds) to inspect contract-read liquidity, entries, and clearly disclosed controlled test accounts.
4. Open [Live proof](https://moment-grid-genlayer.vercel.app/genlayer) to inspect settled TRUE and FALSE results produced from BBC and ESPN evidence by the reusable Studionet resolver.
5. Review [Integrity](https://moment-grid-genlayer.vercel.app/integrity), the [deployment manifest](deployments/genlayer/bradbury.json), and the [full game specification](docs/ONCHAIN_GAME.md).

No wallet is required to inspect rounds, contract state, consensus records, rules, or the trust model. A funded Bradbury wallet is required only to enter or operate the active testnet round.

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
MatchRoundResolver reads registered ESPN / TheSportsDB evidence
                         ↓
Independent validators agree on truth + coverage bitmaps
                         ↓
Authenticated finalized callback reaches MomentGridGame
                         ↓
Permissionless batched scoring opens claims or full refunds
```

The LLM interprets public evidence; deterministic contract code scores grids, totals jackpot eligibility, and distributes GEN. Missing evidence is not treated as FALSE: unsupported selections refund their affected cell stake, while underfilled, unresolved, or timed-out rounds support full permissionless refunds.

## Game economy

- The minimum stake is 10 GEN; the testnet UI caps a single entry at 100 GEN.
- Every stake backs nine transparent pari-mutuel cell pools: 15% Common, 30% Medium, and 45% Rare.
- The jackpot receives 5%; pending protocol revenue receives 5% and becomes withdrawable only after successful settlement.
- A player qualifies for the jackpot by completing at least one horizontal row and one diagonal. Qualifiers share it pro rata by gross stake; without a qualifier, it rolls into the next round.
- Each round requires configured minimum participant, liquidity, and unique-grid gates. Failure opens a full-stake refund path.

Detailed accounting and failure behavior are in [docs/ONCHAIN_GAME.md](docs/ONCHAIN_GAME.md).

## Live deployments

### Testnet Bradbury V2

| Item | Value |
| --- | --- |
| Network | Testnet Bradbury · chain 4221 |
| Game | [`0x1D87C32c1A0D65C083ce322608D284E5767b8408`](https://explorer-bradbury.genlayer.com/address/0x1D87C32c1A0D65C083ce322608D284E5767b8408) |
| Full-match resolver | [`0x0aeBC87aBa11CA67945A73BcbC66AEEAA0D828FB`](https://explorer-bradbury.genlayer.com/address/0x0aeBC87aBa11CA67945A73BcbC66AEEAA0D828FB) |
| Contract version | `2.0.0` on both deployments |
| Public round | `epl-2026-08-21-arsenal-coventry-v2` |
| Public round state | OPEN · 2 entries · 2 unique grids · 20 GEN escrow · liquidity gate met |
| Controlled QA round | `qa-2026-08-13-motagua-cartagines-v1` · two test wallets · source-failure/refund rehearsal in progress |

The public round contains one human-controlled entry and one explicitly labeled fixed-grid Test Bot. The QA round contains two controlled wallets and is never presented as organic liquidity. Its first post-match adjudications found only one of the two registered publishers reachable, returned `SOURCE_UNAVAILABLE`, and left the round unscored with all 20 GEN escrowed. The keeper is armed to activate full refunds at the deadline and claim both gross stakes. Exact addresses, inputs, receipts, failed-attempt audit history, and current state are recorded in [deployments/genlayer/bradbury.json](deployments/genlayer/bradbury.json).

### Reusable Studionet resolver proof

| Item | Value |
| --- | --- |
| Network | Studionet · chain 61999 |
| Contract | `0x3a87Ee9a47f6B1d9d2298166a4a7cA4907780dd9` |
| TRUE transaction | `0x647cb97c7363c542972dc4e35b525cbd67cdd8bb8e4dfe55b8626b139f64eee4` |
| FALSE transaction | `0xec06d204c260028a6889fe2a0e6885f02ee1084673111e78451050aaf8a1eb02` |
| Consensus | `MAJORITY_AGREE` · successful execution |
| Evidence | BBC Sport + ESPN |

[`MatchMomentResolver`](contracts/match_moment_resolver.py) is a reusable, application-neutral contract for one constrained football criterion. Its settled records give reviewers an immediately inspectable consensus proof while the future Bradbury fixture remains open.

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

Open `http://localhost:3003`. The checked-in environment example points at the public Bradbury V2 game and Studionet resolver proof. Never add a private key, account password, or provider secret to an environment file.

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

Current Direct Mode result: **46 passed** across registration, access control, web-evidence failure modes, consensus fields, payable stake accounting, liquidity gates, validity refunds, batched scoring, jackpot sharing/rollover, claims, and timeout recovery. All three Intelligent Contracts pass `genvm-lint check`.

## Security and launch status

- Registered definitions are immutable; resolution is permissionless and answer-free.
- At least two distinct allowlisted publishers must be available and materially consistent.
- Caller-supplied verdicts are rejected; only the configured resolver can deliver finalized bitmaps.
- Ownership transfer is two-step, and pausing cannot block exits, claims, or refunds.
- Test Bot and controlled QA activity are publicly labeled in both UI and manifests.
- This is unaudited testnet software. Mainnet or real-value launch remains blocked on independent contract/economic review, governed ownership, monitoring, legal and licensing analysis, age/location controls, self-exclusion and safer-play controls, and an incident/appeals process.

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md), [docs/GENLAYER_SOURCE_POLICY.md](docs/GENLAYER_SOURCE_POLICY.md), [docs/PRODUCT_ROADMAP.md](docs/PRODUCT_ROADMAP.md), and [docs/RESPONSIBLE_PLAY.md](docs/RESPONSIBLE_PLAY.md).

## Submission assets

- [Ready-to-paste Project contribution](docs/GENLAYER_SUBMISSION.md)
- [Reviewer demo recording script](docs/DEMO_SCRIPT.md)
- [Bradbury operation and payout rehearsal](docs/BRADBURY_GAME_RUNBOOK.md)
- [Studionet reusable resolver runbook](docs/STUDIONET_RUNBOOK.md)

Source is public for review. No open-source license has been granted yet; all rights remain reserved until the owner chooses a license.
