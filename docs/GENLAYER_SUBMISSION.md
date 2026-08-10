# GenLayer contribution drafts

These descriptions deliberately separate the reusable Intelligent Contract from the application that consumes it.

## Submission A — Intelligent Contract

### MatchMomentResolver

`MatchMomentResolver` is a reusable GenLayer Intelligent Contract for settling granular football events from public web evidence. It addresses an oracle gap that deterministic contracts cannot solve alone: reports from different publishers are unstructured, may arrive at different times, and require interpretation of match identity, finality, overturned events, and event windows.

An owner registers an immutable match identity, one constrained criterion, and two or three code-allowlisted evidence URLs. Registration is the only privileged operation. Any account may request resolution, and the requester cannot provide the answer or replace evidence. GenLayer validators independently fetch the registered pages, extract a bounded fact model, and compare the stable verdict fields under an equivalence principle. Only after consensus does deterministic code store `TRUE`, `FALSE`, or a retryable `INVALID` attempt.

Supported V1 criteria are `HOME_TEAM_SCORES_FIRST`, `BOTH_TEAMS_SCORE_FULL_TIME`, and `PENALTY_AWARDED` in a half-open minute interval. Safety properties include immutable definitions, duplicate-settlement prevention, criterion-specific finality, two-source availability, conflict rejection, and `INVALID` instead of guessing.

The contract is application-neutral. Prediction markets, fantasy games, bounties, settlement protocols, or sportsbook-adjacent products can read its structured result without adopting Moment Grid's UI or scoring.

Live Studionet proof records the durable contract `0x3a87Ee9a47f6B1d9d2298166a4a7cA4907780dd9`, a successful TRUE resolution (`0x647cb97c7363c542972dc4e35b525cbd67cdd8bb8e4dfe55b8626b139f64eee4`) and a successful FALSE resolution (`0xec06d204c260028a6889fe2a0e6885f02ee1084673111e78451050aaf8a1eb02`), both using BBC Sport and ESPN evidence. The repository includes GenVM linting, 20 Direct Mode tests, and hosted Studionet integration coverage.

## Submission B — Project

### Moment Grid

Moment Grid is a football prediction game built around a 3×3 grid. Players select nine granular calls across three match windows and rarity tiers, lock the grid, and try to complete rows, columns, and diagonals. Existing shared TypeScript scoring deterministically converts settled events into cell results and completed lines.

GenLayer supplies the real-world adjudication layer the product was missing. Instead of a centralized keeper deciding whether a first-goal, both-teams-score, or penalty-window prediction happened, Moment Grid registers the criterion and lets validators inspect public BBC Sport and ESPN reports. The accepted on-chain `TRUE`, `FALSE`, or retryable `INVALID` verdict then feeds the same deterministic scoring package used by the application. GenLayer interprets evidence; it does not calculate wins, rewards, or payouts.

The `/genlayer` reviewer route reads configured Studionet state and presents the match, criterion, lifecycle, consensus, evidence, transaction, resolution history, and scoring impact in the existing visual language. The browser E2E suite covers the normal grid lock flow plus deterministic TRUE/FALSE/INVALID reviewer states, with an opt-in live read-only Studionet check.

Moment Grid requires GenLayer because its most interesting predictions cannot be settled safely from caller-provided booleans or simple final-score feeds. Validator consensus turns messy public match evidence into an auditable fact boundary that the game can consume. This repository is the focused GenLayer-native version of the product.
