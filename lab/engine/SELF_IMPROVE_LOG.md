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
| 4 | (next) REAL multi-story episode: build 2-3 DISTINCT Falcons floors (captains + QB + roster), stitch with make_episode, then VOICE the combined episode.md into ONE leveled mp3 (render_breeze already voices "NAME (cold open/transition/sign-off): ..." lines + whoOf resolves the cast). Full blind judge on the stitched episode. | — | — | P3 efficiency |
