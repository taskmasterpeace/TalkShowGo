# THE POSTGAME DESK — result intake, the reckoning, the graphics department, role cards
*Designed 2026-09-07, the morning after SC State at FAMU — the first game our desk called on the record
before it was played. This is the design for what the system does when a game ENDS.*

The prep show made promises: Cassius said FAMU stays under 20; Andrew said the O-line gives up fewer
than two sacks. The whole brand is "the comments can hold us to it." This system is how the SHOW holds
itself to it — automatically, every game, with receipts.

---

## 1. THE POSTGAME PIPELINE (`postgame.mjs`)

One command, run when a game is final:

```
npm run show:postgame -- --beat=sc-state --opponent="Florida A&M"
```

**Stage A — RESULT INTAKE.** A current-mode stringer run through the beat (web on) asking one narrow
question: final score + the three deciding facts of the game. **The phantom-score guard:** the result
is accepted only when **two or more distinct publishers agree on the same final score** — this system
was designed the same week a build hallucinated a 48-3 loss that never happened, and a postgame desk
that grades predictions against a phantom score is worse than no desk at all. No agreement = the run
stops and says so.

**Stage B — THE RECKONING.** Read the prep episode's `episode.json` (the build stamp knows which
episode preceded this game) and parse its `(closing prediction)` lines — they're already structured.
Grade each prediction against the result dossier (gpt-4.1-mini, receipts attached): **HIT / MISS /
PUSH**, one sentence of why, citing the evidence line that decides it. A prediction that can't be
graded from the receipts is UNGRADED, never guessed.

**Stage C — THE LEDGER.** Append one row per graded call to `lab/ledger/<beat>.predictions.jsonl`:
`{episode, host, prediction, game, verdict, why, evidence, graded_at}`. Running accuracy per host is
computed from this file, never stored — the file IS the record. (This is the Prediction Ledger from
the war board, born as a by-product of the first postgame.)

**Stage D — THE SHOW.** Build the postgame episode with the reckoning woven in:

- **Segment 1 — THE RECKONING.** Renee reads each host their own words back — verbatim, from the prep
  transcript — then the verdict. The host answers for it in character: winners get one clean flex
  (catchphrase law still applies), losers eat it without excuses (or WITH excuses, if that's their
  print). This is not a "last show" callback (the cap targets the lazy tic); it is the designed ritual
  the outro template promised.
- **Segment 2 — WHAT ACTUALLY DECIDED IT.** The prep show asked "trenches, quarterbacks, or coaching?"
  Reality answered. The desk debates what the game proved, receipts from the result dossier.
- **Closing round — NEW predictions** for the next game, straight onto the ledger.

The prep episode and the postgame episode form a pair; `episode.json` links them (`answers: <prep slug>`),
so a season becomes a chain of promises and reckonings.

---

## 2. THE GRAPHICS DEPARTMENT (images only — video stays parked)

Robert's call, 2026-09-07: don't turn on video yet; a graphics department is the play. GPT-image-class
generation is near-free, and a package of REAL-NUMBER cards does two jobs: it's the visual identity on
YouTube/social, and it's something the HOSTS can refer to on air — "look at the board" — so the
audience knows the desk and the graphics are looking at the same thing.

**The package** (`make_graphics.mjs`, per episode, from `episode.json` + `evidence.json`):

| Card | Content | Rule |
|---|---|---|
| TITLE CARD | show logo + matchup + date | one per episode |
| STAT CARDS (2-4) | one real number each, big | **every number traces to an evidence id — no receipt, no card** |
| PREDICTION CARDS | host portrait + their on-record call, stamped ON THE RECORD | prep shows |
| VERDICT CARDS | the same card RESTAMPED HIT/MISS | postgame — same layout, new stamp, so the pair reads as one story |
| FINAL CARD | the score + the one-line story | postgame |

**House style is a file, not a vibe:** `lab/graphics/style.json` — palette (ink `#12151a`, bone,
signal gold `#eab332`, on-air red; **never purple**), type rules, layout templates, logo placement.
Every card generator reads it; changing the style file restyles the whole network. Generation via
GPT-image or the Ad Lab pipeline — whichever, the style file governs.

**Hosts refer to the board — the wiring that makes it real:** the graphics manifest feeds the floor.
`compile_beat --graphics=<manifest>` injects one or two "board waypoints" — the moderator is directed
to send the room to a specific card ("the board's got the number up right now — 632 yards") and the
transcript line carries a `[BOARD:card-2]` marker. Audio listeners hear a desk that has a board.
Video/YouTube assembly (whenever video un-parks) cuts to exactly that card at exactly that line. One
manifest, one waypoint injection, one timed overlay — not a department of people, a department of one
script and one style file.

---

## 3. ROLE CARDS (`lab/roles/*.md`) — every position's direction, inspectable and editable

The ask: "if it was skills, you can see exactly what direction everybody's getting and what tools they
have access to." Standalone answer (no external dependency — TSG remains its own application): one
markdown card per position, in the repo, loaded by the engine at build time.

```
lab/roles/
  producer.md              what the showrunner optimizes for; segment count; when to cut a topic
  research-desk.md         the stringer's sourcing laws (excluded publishers, era rules, 2-publisher score rule)
  showrunner.md            the director: role assignment, moderator law, collision engineering
  statistician.md          the reckoning grader: HIT/MISS/PUSH definitions, "ungradable is honest"
  graphics-department.md   the card list, the receipt rule, the style file's authority
  janitor.md               what gets repaired automatically vs flagged to a human
```

Each card: **MISSION** (one paragraph) · **DIRECTION** (the literal prompt text the engine injects) ·
**TOOLS** (which scripts/models this role may use) · **LAWS** (the bright lines it may never cross).
Robert opens the file, edits the DIRECTION, the next build obeys — the same way personality prints
already work for on-air talent, extended to the off-air staff.

Rollout: phase 1, the two NEW roles (statistician, graphics-department) read their cards from day one.
Phase 2, existing hardcoded direction (director prompt, closing-ritual clauses) migrates into cards —
one at a time, verified by transcript, never a big-bang rewrite.

---

## 4. THE SHOT-LENGTH POLICY (for whenever video un-parks)

Measured 2026-09-07 across 416 real speaking turns from 27 builds (rate 2.71 words/sec calibrated on
five rendered episodes): **median turn 8.8s · p90 11.8s · longest turn ever 14.4s · zero turns over 15s.**

So the 5-7s clip cap is not a wall — the room's own guard stack already produces TV-length sound bites:

- 1 shot covers a quarter of turns; **2 chained shots cover ~95%; no turn in history has needed more than 3.**
- Shot seams are where the grammar lives anyway: cut to a REACTION (the other debater, the moderator)
  or to THE BOARD (a graphics card the line just referenced), then come back. That's not a workaround —
  that's how real sports TV shoots a 10-second answer.
- Reaction shots are cheap stills-with-motion; board cuts are free (the cards exist). A full video
  episode needs speaking shots for only ~60-70% of runtime.

Parked until wanted; the graphics department builds the exact assets the video cut will need on day one.

---

## Order of build (when green-lit)

1. `postgame.mjs` stages A-C (intake + reckoning + ledger) — the FAMU game is the live test case.
2. Reckoning segment in the episode builder (stage D) — first postgame show ships.
3. `lab/roles/statistician.md` + `graphics-department.md` — the first two role cards, read by their stages.
4. `make_graphics.mjs` + `lab/graphics/style.json` — title/stat/prediction cards for the postgame.
5. Board waypoints (`--graphics` into compile_beat) — the desk starts referring to the board.
