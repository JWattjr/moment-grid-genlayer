# GenLayer football evidence policy

`MatchMomentResolver` requires two or three immutable HTTPS evidence URLs for each registered moment. V1 permits only code-reviewed public origins: BBC Sport, ESPN, and TheSportsDB.

## Why these sources

- **BBC Sport** provides stable, keyless match reports and timelines with recognizable match identity and event descriptions.
- **ESPN** provides an independent, keyless match report/timeline suitable for cross-checking teams, score, goals, penalties, and final status.
- **TheSportsDB** is allowlisted as a structured public alternative, but the committed reviewer fixtures currently use BBC and ESPN so every showcased decision has two human-readable reports.

No private API key is required. Source URLs are stored with the definition and cannot be replaced. A resolution caller cannot supply evidence, change teams, alter the criterion, or provide an answer.

## Demo fixture coverage

Fixtures under `fixtures/genlayer/` contain only immutable identity, criteria, and URLs; none embeds a result:

| Match | Date | Demonstrated criteria | Sources |
| --- | --- | --- | --- |
| Arsenal–Chelsea | 2023-05-02 | Home scores first; penalty 30–60 | BBC, ESPN |
| Argentina–France | 2022-12-18 | Home scores first; both teams score; penalty 0–30 | BBC, ESPN |
| Manchester United–Liverpool | 2024-09-01 | Home scores first; both teams score; penalty 30–60 | BBC, ESPN |
| Arsenal–Bournemouth | 2024-05-04 | Home scores first; both teams score; penalty 30–60 | BBC, ESPN |

These examples are not answer caches. GenLayer still fetches and adjudicates their reports.

## Consensus path

1. Every validator fetches the same registered URLs inside nondeterministic execution.
2. Large pages are sampled at stable positions so identity and match-report sections fit a bounded prompt.
3. The model extracts constrained facts: match identity/status, first valid goal, whether each team scored, penalty minutes, source availability, and conflict.
4. Deterministic contract code applies event-specific finality and derives TRUE, FALSE, or retryable INVALID.
5. The custom validator repeats the fetch/extraction and compares result, reason, match status, and decisive minute.
6. Storage changes occur only after consensus. TRUE/FALSE settles permanently; INVALID records the attempt but remains retryable.

Evidence-summary prose is audit context and need not match word-for-word. Stored references are the configured URLs available to the leader.

## Failure and disagreement behavior

- One failed source is tolerable only when at least two other configured sources remain available.
- Fewer than two available sources returns `INVALID / SOURCE_UNAVAILABLE`.
- Unestablished identity returns `INVALID / MATCH_NOT_FOUND`.
- Material disagreement about identity or decisive facts returns `INVALID / CONFLICTING_SOURCES`.
- A live/reversible outcome returns `INVALID / MATCH_NOT_FINAL` or `WINDOW_NOT_CLOSED`.
- Malformed model output fails execution rather than coercing a verdict.

Retryable INVALID preserves liveness during temporary publisher failures and prevents a convenient but unsafe guess.

## Event finality

| Event | TRUE is final when | FALSE is final when |
| --- | --- | --- |
| `HOME_TEAM_SCORES_FIRST` | First valid goal belongs to the home team | First valid goal belongs to the away team, or a finished match has no goals |
| `BOTH_TEAMS_SCORE_FULL_TIME` | Both teams have scored | Match is finished and at least one team did not score |
| `PENALTY_AWARDED` in `[from,to)` | A penalty award in the window is established | Match is finished, or live play has passed the window without one |

Disallowed or overturned goals do not count. Intervals are half-open: 30–60 includes minutes 30 through 59.

## Adding a source

Source governance is intentionally modular but curated in V1. Adding a publisher requires:

1. review its public accessibility, page stability, terms, identity fields, event coverage, and key requirements;
2. add the exact hostname to the contract allowlist;
3. add Direct Mode cases for accepted/rejected URLs and source-failure behavior;
4. run a hosted integration against representative completed matches;
5. deploy a new contract version, because deployed code and existing registered definitions are immutable;
6. document the origin and migrate clients deliberately.

An owner cannot bypass this review merely by registering a new hostname.

## Trust assumptions

V1 is not decentralized source governance. The owner curates questions and approved URLs, publishers control their pages, and GenLayer validators interpret the available evidence. Security comes from immutable definitions, independent publisher evidence, multiple validators, explicit conflict/finality rules, and auditable on-chain results—not from claiming the sources themselves are trustless. Production use should add durable governance, monitoring, publisher-diversity requirements, and an appeals/versioning policy.
