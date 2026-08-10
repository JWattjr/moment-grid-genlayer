# MatchMomentResolver

`MatchMomentResolver` is a reusable GenLayer Intelligent Contract that resolves granular real-world football events from web evidence using validator consensus.

## Why it exists

Traditional deterministic smart contracts cannot independently open changing match reports, interpret unstructured descriptions, distinguish valid events from overturned ones, reconcile publishers, or decide whether a match window is final. Passing a caller-supplied boolean on-chain merely moves trust to that caller.

This contract instead registers the question before resolution and makes the evidence-reading request permissionless. GenLayer validators independently inspect the registered public sources and reach consensus on a constrained verdict.

## Supported events

- `HOME_TEAM_SCORES_FIRST`
- `BOTH_TEAMS_SCORE_FULL_TIME`
- `PENALTY_AWARDED` within a registered half-open interval `[from_minute, to_minute)`

## Architecture

```text
Registered immutable criterion
        ↓
Permissionless resolution request
        ↓
Validators fetch registered evidence
        ↓
Structured fact extraction
        ↓
Equivalence / consensus
        ↓
TRUE / FALSE / INVALID
        ↓
Deterministic on-chain state mutation
```

The nondeterministic stage fetches evidence and extracts a bounded fact model. Event-specific deterministic functions apply the criterion and finality policy. The equivalence principle compares only stable decision fields—result, reason, match status, and decisive minute—not volatile page text or generated prose.

## Contract interface

### Writes

- `register_moment(resolution_id, match_json, event_type, criteria_json, evidence_json)` — owner only; creates one immutable definition and appends its ID to history.
- `resolve_moment(resolution_id)` — permissionless; performs the GenLayer evidence task and records a settled verdict or retryable invalid attempt.

### Views

- `get_owner()`
- `get_resolution(resolution_id)`
- `get_resolution_count()`
- `get_resolution_id(index)`

Definitions and resolutions are JSON at the public boundary so clients can evolve without mirroring GenVM storage classes. Inputs are validated and normalized before storage.

## Safety properties

- **Immutable registered criteria.** A resolution ID cannot be overwritten, so teams, kickoff, event type, time window, and source URLs cannot change after registration.
- **Owner-only registration.** The deployment owner curates what questions and evidence origins enter V1. The owner does not submit answers.
- **Permissionless resolution.** Any caller can trigger the registered evidence task; callers cannot replace sources or facts.
- **INVALID rather than guessing.** Unavailable evidence, an unidentified match, material conflict, or insufficient finality leaves the record pending and retryable.
- **Duplicate settlement protection.** A settled TRUE or FALSE result cannot be resolved or mutated again.
- **Match finality.** FALSE uses criterion-specific finality; for example, both-teams-score cannot settle FALSE before the match ends.
- **Source policy.** Two or three HTTPS URLs are required and origins must be code-allowlisted. V1 supports BBC Sport, ESPN, and TheSportsDB.
- **Deterministic mutation after consensus.** Storage writes occur only after GenLayer returns an agreed structured output.
- **Consensus-safe closure.** Nondeterministic execution captures plain immutable input rather than contract storage objects.

The owner is a governance role, not an oracle. A production integrator can place that role behind a multisig without changing the contract interface; the prepared builder deployment workflow uses a durable encrypted developer keystore.

## Reusability

The resolver contains no Moment Grid scoring, UI, wallet, reward, or payout logic. Another football prediction market can settle an outcome token; a fantasy app can validate a bonus condition; a bounty system can unlock a claim; and a settlement protocol can consume the structured verdict through `get_resolution`. Integrators choose their own economics and decide how to handle retryable INVALID records.

## Evidence governance and finality

See [`../docs/GENLAYER_SOURCE_POLICY.md`](../docs/GENLAYER_SOURCE_POLICY.md) for supported origins, publisher failure and disagreement behavior, trust assumptions, and the reviewed process for adding sources.

## Development

The runner is pinned to a concrete GenVM hash in the source. From the repository root:

```powershell
.\.venv\Scripts\genvm-lint.exe check .\contracts\match_moment_resolver.py
.\.venv\Scripts\python.exe -m pytest .\tests\direct -v
uv run --with-requirements requirements.txt gltest tests\integration\test_deployed_studionet_resolver.py -m integration -v -s --network studionet
```

Use [`../scripts/deploy-genlayer.ps1`](../scripts/deploy-genlayer.ps1) from an interactive terminal for deployment. It never accepts or stores a password/private key.

## Live proof

The deployment manifest at [`../deployments/genlayer/studionet.json`](../deployments/genlayer/studionet.json) records a real Studionet deployment plus successful TRUE and FALSE resolutions from BBC Sport and ESPN evidence.
