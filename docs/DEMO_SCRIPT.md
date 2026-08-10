# Moment Grid demo script (75 seconds)

## 0–10 seconds — Product

Open `/`. Say: “Moment Grid is a 3×3 football prediction game. Each cell is a granular match call in a time window.” Use Quick Fill, then Review and Lock to show that the prediction is fixed before resolution.

## 10–22 seconds — The hard problem

Open `/genlayer`. Select the Arsenal–Chelsea first-goal criterion. Say: “A normal contract cannot read two live web reports and decide which valid event happened first. The registered match, criterion, and evidence URLs are immutable; the answer is not in the fixture.”

## 22–38 seconds — Intelligent Contract

Show `contracts/match_moment_resolver.py`, briefly pointing to registration, permissionless resolution, and the validator equivalence comparison. Say: “GenLayer validators independently fetch BBC and ESPN, extract constrained match facts, and agree on stable result fields. Missing or conflicting evidence becomes INVALID, never a guess.”

## 38–55 seconds — Live proof

Return to `/genlayer`. Show `SETTLED TRUE`, `MAJORITY_AGREE`, the evidence summary, source links, and transaction hash. Switch to the penalty-window record and show the live `SETTLED FALSE` result. Expand Technical details to show the contract address and stored fields.

## 55–70 seconds — Product impact

Point to “Moment Grid impact.” Say: “The Intelligent Contract adjudicates the real-world fact; pure TypeScript maps that verdict into Won or Lost and recomputes grid lines. The model never calculates rewards.” Show the history list.

## 70–75 seconds — Close

Say: “Moment Grid now has a real, reusable on-chain football adjudication primitive: public evidence, multi-validator consensus, immutable settlement, and a product consuming the result.”

Recording note: use the live reviewer route for evidence and contract state. The deterministic mocked Playwright route is test infrastructure only and must not appear as the live demo.
