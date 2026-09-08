# THE RUNDOWN ENGINE — fixing the application, not the show
*2026-09-08, revising docs/POSTGAME-GAP-ANALYSIS.md after Robert's steer: "we're not just fixing our
show, we wanna fix how the application works... remember we got different show formats."*

## The discovery that changes the plan

The architecture the gap analysis calls for **already exists in this app as designed data**:

- **`lab/blocks.json`** — "the reusable segment library." 59 blocks (now 66), each with roles,
  claim modes, evidence requirements, duration, escalation, and a fallback. CITE-OR-CUT is already
  its law.
- **`lab/formats.json`** — 11 formats with series DNA distilled from real references (First Take,
  Maddow, The Daily Show, Last Week Tonight, Hot Ones, Real Time + house formats), each with an
  `episode_grammar.base_sequence` that orders blocks into a rundown. news-desk already reads
  `a-block → b-block → c-block → last-word`.
- **SHOWPLAN** — the pipeline stage that was designed to compile format + blocks into an episode.
  It is marked "wire-up next" from round 3 and was never wired.

What happened instead: we shipped the shortcut — `compile_beat → run_floor` builds exactly ONE
block type (the debate) per question — and the shortcut became the entire application. Every show
since has been the same block wearing different names. **"They all act like they're just talking
about one subject" is the sound of an app that can only perform one block.**

So the fix is not new architecture. It is WIRING THE ARCHITECTURE WE DESIGNED, upgraded with
everything three days of real shows taught us.

## The five builds

### 1. THE SHOWPLAN COMPILER (`compile_rundown.mjs`) — the centerpiece
Takes `(format, story packet, evidence, cast, ledger)` → an episode plan → builds each block with
the right BUILDER → stitches. The builder registry is the new execution layer:

| Builder | Blocks it runs | Engine |
|---|---|---|
| **collision** | opening-argument, rebuttal, cross-examination, floor, panel-collision… | `run_floor` (unchanged — it becomes ONE builder, not THE show) |
| **round** | ritual-round, instant-reactions, rapid-fire, final-response | one directed line per seat, answers must differ (cheap, per-seat calls) |
| **scripted-ritual** | reckoning, scorecard, cold-open, button, last-word | template + in-character fills (the postgame reckoning generator, generalized) |
| **mono** | monologue, thesis-plant, oddity, a-block lead-in | single voice, longer form (finally: turns over 27 words) |
| **read-react** | quote-dock, clip-reaction, other-side-wire, document-reveal | moderator reads sourced material verbatim, desk reacts |

Rundown compilation is also where the PRODUCER role card gets teeth: it decides which optional
blocks fire this episode (oddity only if the packet has an oddity; reckoning only if the ledger
has rows; other-side only if opponent media landed) — per its editable `lab/roles/producer.md`.

### 2. THE STORY PACKET (`story_packet.mjs`) — one structured input feeding every block
Per format FAMILY, a typed packet replaces "one question's evidence":
- **game packet** (sports): drives, scoring plays, player lines, injuries, penalties, weather,
  presser quotes, opponent-media reactions, next game + stakes.
- **story packet** (news/politics): timeline, actors + verbatim quotes, documents, both camps'
  reactions, what-happens-next with dates.
- **case packet** (battle rap / culture): the parties, the receipts, the history, the reactions.
Blocks declare what they need from the packet (`evidence_required` already carries this - the new
blocks reference `game_packet`, `verbatim_quotes`, `opponent_media`, `prediction_ledger`). No
packet field, no block - CITE-OR-CUT extended to structure.

### 3. THE DISTILLERY — "stealing" shows, systematized (Robert's question: yes, and here's how)
What we did by hand for the postgame becomes the standing method for EVERY format:
`real transcript in → thread inventory → map to existing blocks → propose NEW blocks + a format
base_sequence → producer approves → format goes live.`
One real exemplar per format family, mechanics only, never the brand. The steal list, in order:
1. ~~Sports postgame~~ ✓ done (Rattler Nation + Nightcap → 7 new blocks).
2. **Political roundtable/odds show** — for THE ODDS ROOM and the politics lane: distill a real
   politics week-in-review + a forecast-style show (calibration talk, "what would change my mind",
   the board of probabilities). Expect new blocks: probability-board, steelman-swap, what-changed.
3. **Sports pregame** (a real one) — our prep shows have the same one-subject disease.
4. **Morning drive / daily desk** — rundown pacing, recurring bits, audience letters.
5. **Interview show** — pressure-interview format exists; a real exemplar tightens its rounds.
6. **Kids news** — the architecture doc exists; distill one real kids' news episode for rhythm.

### 4. RENDER LAYER — block-aware sound (kills the metronome by construction)
The renderer reads block type + escalation: instant-reactions cuts fast (0.12s gaps), reckoning
breathes (0.5s), cross-examination overlaps on [interrupting] for real, backchannels mix UNDER
featured blocks, mono blocks get room to run long. The critic pass's timing fixes land HERE once,
for every format, instead of per-show.

### 5. THE GUARDS move down a layer
Opener-tic, vocative-cap, number-drumbeat, agreement-cap (the critic pass) live in the collision
builder where they belong; round/scripted builders enforce "answers must differ" structurally.
Framing variety stops being a prompt problem: cold-open is just a block with alternates.

## What this preserves
Everything proven stays and slots in: run_floor IS the collision builder; the reckoning IS a
scripted-ritual block (now in blocks.json); the prediction ledger feeds the reckoning block; the
graphics department reads the same packet; bootstrap validation gates the sources; the take flow
seats humans into any block that takes a W (witness) role. Nothing is thrown away - the app
finally becomes what round 3 drew.

## Order of execution
1. `story_packet.mjs` (game family first - the FAMU packet is the test data, its real shows the QA bar)
2. `compile_rundown.mjs` + round/scripted/mono/read-react builders (collision = existing run_floor)
3. Postgame v2 as the first SHOWPLAN-compiled show; A/B against the real Rattler show
4. Distill the political exemplar → politics format goes live on the same engine
5. Render layer block-awareness; guards migrate into the collision builder
6. FORMATS page in /command shows base_sequences and lets the producer reorder blocks per show
