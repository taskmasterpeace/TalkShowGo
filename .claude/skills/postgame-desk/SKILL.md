---
name: postgame-desk
description: Use after a real game is final to build the postgame show — result intake with the two-publisher score guard, grading the prep show's on-record predictions (THE RECKONING), the prediction ledger, and the postgame episode. Triggers on "postgame", "the game is over", "grade the predictions".
---

# The Postgame Desk (design: docs/THE-POSTGAME-DESK.md)

```
npm run show:postgame -- --beat=sc-state --opponent="Florida A&M" [--prep=<prep show slug>]
```
(auto-finds the newest stamped prep show on the beat via its episode.json)

## What it does, with the laws baked in
1. **RESULT INTAKE** — researches the final itself. **PHANTOM-SCORE GUARD: a score counts only when ≥2 distinct publishers carry the SAME score** (claims AND source titles; scores arrive as "31-13" and "Team 31, Team 13" — both parsed). No agreement = refuses to grade, exit 2. Never weaken this: it exists because a build once hallucinated a 48-3 loss.
2. **THE RECKONING** — parses the prep episode's `(closing prediction)` lines, grades each HIT / MISS / PUSH / **UNGRADED** (= the honest verdict when the stat isn't in evidence — a sack-count prediction went UNGRADED because no source printed one; NEVER let a grader guess).
3. **THE LEDGER** — appends to `lab/ledger/<beat>.predictions.jsonl` (append-only, dupe-guarded by prep+host+prediction; running records COMPUTED from the file, never stored).
4. **THE SHOW** — segment 1 = the reckoning ritual (Renee reads each host their own words verbatim + the verdict; host answers in character; ledger standings close it), segment 2 = "what actually decided it" with the question ANCHORED to the verified score. New predictions land for next week.

## QA points specific to postgame (each shipped once)
- Hosts confusing which team is theirs in a flex line.
- "That is a ungraded"-style verdict phrasing (templates now handle it; verify).
- Renee's opener saying the score twice (one_line restated it; now stripped).
- New predictions naming an opponent the show didn't establish (Bethune-Cookman was invented once — now banned at the prompt, still check).
- The reckoning is NOT a "last show" callback violation — the ritual deliberately avoids that phrasing.

## The pair law
Prep episode + postgame episode are linked by `episode.json` (`answers: <prep slug>`). A season = a chain of promises and reckonings. Ledger view: `/command/ledger`.
