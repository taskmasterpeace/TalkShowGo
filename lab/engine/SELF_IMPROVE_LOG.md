# TalkShowGo — Self-Improving Loop (started 2026-09-04)

Robert's mandate (`/loop 30m`): **obsess over a talk-show engine that works with SEGMENTS** — multi-story
episodes chained with smooth transitions — that **WOWS a producer**. Audio only (no video). **Polish +
efficiency.** Cheap models OK (gpt-4o-mini / gpt-4.1-mini) if they help cost/speed. **Robert can't listen —
judge quality by the TRANSCRIPT** (`segment_final.md`) + the blind Codex judge, never by ear.

## The cycle (run ONE per iteration, ~30 min)
1. Read this log; pick the next step from the roadmap (or the biggest weakness the last judge found).
2. Make ONE targeted change.
3. Verify: build a show (or re-floor an existing beatcard), READ `lab/shows/<slug>/floor/segment_final.md`,
   run the blind Codex judge (strip speaker labels → `scratchpad/blind_*.txt` → codex).
4. Append an entry: change · judge score (before→after) · verdict · next step.
5. If verified better (or neutral + clearly correct), `git -C /d/git/talkshowgo` commit it. Never commit a regression.

## Roadmap (in priority order)
- **P1 — Collision quality (single segment).** First Take debaters must take OPPOSING sides (A argues yes, B
  argues no). Kill co-signing/agreement, metaphor-loops, empty turns, end-name tics. Verify: judge "heat" up.
- **P2 — SEGMENTS (the headline).** One episode = several story-segments (e.g. captains → QB → roster),
  each a mini-floor, stitched with a host-written transition ("Alright, that's the captains. Now the QB room…"),
  show intro on front + outro on back, leveled into one mp3. Generalize to any show's segment lineup.
- **P3 — Efficiency + polish.** Cheap models where they don't hurt the transcript (test gpt-4o-mini / 4.1-mini
  per seat, keep what the judge says is >= current). Faster pipeline, fewer wasted calls. Per-show cast/format
  auto-default so builds never grab the wrong lineup.

## Ops notes
- Dev server: `preview_start name=talkshowgo` (port 3000). It has died mid-session before — restart if curls refuse.
- Floor/brief run on OpenRouter; reasoning models (sonnet-5) need `reasoning:{effort:'low'}` (already wired in
  run_floor `call` + agent-brief `tryOR`) or they burn the token budget and return empty/malformed.
- Voice work needs cupcake gateway `running:false && queue_depth:0` (poll `:8700/v1/health`). Voices are text —
  Robert can't listen — so voicing is OPTIONAL for the loop; prioritize the TRANSCRIPT. Only voice a keeper.
- Key files: `run_floor.mjs` (the argument engine), `agent-brief.ts` (stances), `compile_beat.mjs` (seats +
  roles + stances), `render_breeze.mjs` (voice). Beats carry `show.hosts` (per-show cast) + `show.show_type`.
- Blind judge = the honesty check. Never grade your own writing; always route the transcript to Codex blind.

## Iterations
| # | change | judge (before→after) | verdict | next |
|---|--------|----------------------|---------|------|
| 1 | Forced "opposing sides on a yes/no" in the showrunner (compile_beat director) prompt | baseline: debaters fully agreed → PARTIAL | More tension, but the two DEBATERS (Big Mike+Andrew) still co-sign; the MODERATOR (Renee) ended up carrying the dissent. Root cause: the showrunner has no ROLE-awareness (mod vs A vs B). | iter 2 |
| 2 | Role-aware collision: showrunner (compile_beat director) now gets show_type + host lanes; for moderated-collision the moderator gets NO side and the two debaters split FOR vs AGAINST | 4 → **5** | WIN — real First Take now: Renee referees, Big Mike FOR vs Andrew AGAINST (blind judge: distinctness 7/10, moderator + opposing sides confirmed). Residual: moderator tilts toward the against-side; Big Mike's all-caps slogans repeat; the against-case is thin. | iter 3 |
| 3 | Built `make_episode.mjs` — the SEGMENT STITCHER: moderator COLD OPEN naming the slate + smooth TRANSITIONS between segments + SIGN-OFF, concatenated into one `episode.md` (render-ready). | mechanism verified (read the generated lines) | WIN — the seam that turns single-story cuts into a multi-story SHOW. Renee moderating: cold-open names both stories, transition is a real broadcast handoff, sign-off clean. **Limitation:** tested with 2 captains segments + topic-label overrides; a content-distinct run + voicing is next. | iter 4 |
| 4 | make_episode **trim**: strip each segment's OWN greeting + sign-off so the stitched episode has ONE cold open + one close (no per-segment "Good evening" resets). Built + blind-judged a REAL 2-segment Falcons episode (captains slate → Bijan). | single-seg **5** → episode **3** (two blind runs, both 3) | Trim VERIFIED correct (openers now start on substance, resets gone) but score didn't move: **CONTENT is the wall, not structure.** Judge, both runs: (a) the two segments read as the SAME story stretched — seg2 (Bijan) REUSED the captains dossier because the QB stringer returned **0 evidence**; (b) slogan/metaphor LOOP persists ("identity", "leadership comes in many forms", "Mm", wrestling metaphors); (c) NO evidence progression — debaters recycle, never cite a NEW [E##] or concede; (d) moderator tilts (A sides with C). | iter 5 |
| 5 | Room **slogan-chant guard** in `run_floor` badTurn: cap any non-subject 6+ letter word once the room has said it 3x (apostrophe-collapsed so "that's" can't trip it; exempts question/evidence/host-name tokens; universal, even unfiltered hosts). Verified on a fresh single-segment captains floor (seed 42). | 5 → **3** | **REVERTED — not a win.** The guard works MECHANICALLY (kills literal chanting; "that's" false-positive fixed via min-6/apostrophe-strip; 41→20 rejections) but the blind judge did NOT improve: **the wall is CONCEPTUAL, not lexical.** Third judge in a row converges: the AGAINST side (Andrew) has NO concrete case — concedes ("you're not wrong, great picks") then restates one vague thesis ("leadership comes in many forms") in fresh words, so no clash develops, no evidence progresses, and the moderator drifts ("Right." filler turns). Word-level de-dup can't fix an argument with no real opposition, and it adds retry latency (hurts P3). Reverted to keep the engine at the 5/10 baseline. | iter 6 |
| 6 | (next) **THE REAL LEVER (three judges agree): the AGAINST side needs a SHARP, CONCRETE counter-thesis.** In `compile_beat` director: the against-host's stance must name a SPECIFIC defensible claim (a wrong pick + why, OR a better alternative + why) drawn from its OWN evidence; if the evidence only supports the FOR side, pick a genuinely contestable sub-question instead of forcing a hollow "against". Plus **forbid empty moderator turns** — a moderator turn must ask a question or press a NAMED claim, never "Right." Verify: heat + argument-progress up vs the 3-5 plateau. **Still-open blocker:** segment researcher WEB-SUPPLEMENT so distinct stories (QB, roster) get evidence AND the against-side gets real ammunition — the recurring root cause behind both the 0-evidence QB stringer and the hollow against-case. | — | — | P3 efficiency |
