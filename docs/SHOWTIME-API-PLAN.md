# SHOWTIME — the TalkShowGo API for games (plan v1.1, post-coach)
*2026-09-18. Robert's ask: a game POSTs its events ("Tass took out seven people on a paintball field —
a Miami record") and gets back a talk show — audio now, speaker-face video (16:9 AND 9:16) now-but-
simple. Home-run grading criteria + speed benchmarks + implement the whole path. First customer: the
paintball line. v1.1 folds in the six-judge coach-plan panel (grades: Clarity A-, Scope A-, Decomp B+,
Risk pending, Testability A-, Flow B-); every judge fix is either adopted below or explicitly declined.*

## 1. The product in one sentence
`POST events → a broadcast-ready talk show about YOUR game's moment, audio or speaker-face video, fast
enough to matter.`

## 2. API surface (v0)

```
POST /api/showtime            (gated from tunnel origins by src/middleware.ts, same as /api/command/*)
{
  "events": [ { "text": "Tass eliminated 7 players in one game at a Miami paintball field", "kind": "stat" },
              { "text": "It is a Miami single-game elimination record", "kind": "record" } ],
  "show":   { "name": "THE SPLATTER ZONE", "tagline": "Miami paintball, every drop" },   // optional
  "question": null,            // null = SHOWTIME derives the debate questions from events
  "desk":  ["renee-vaughn","cassius-wynn","andrew-hammond"],  // optional; validated: >=3 KNOWN cast ids or 400
  "length": "short",           // "short" ~3min (2 segments, runtime 2) | "standard" ~5min (2 segments, runtime 3)
  "outputs": { "audio": true, "video": { "aspects": ["16x9","9x16"] } },
  "style":  { "bg": "#12151a", "accent": "#eab332" },
  "client_key": "match-4812-final"   // optional idempotency (house take-flow pattern): repeat key -> same job
}
→ 202 { "job": "st_x1y2", "poll": "/api/showtime?job=st_x1y2" }
GET  → { "state": "queued|running|failed|done", "stage", "pct", "queue_position"?, "error"?,
         "actual_duration_s"?, "artifacts": { mp3, mp4_16x9, mp4_9x16, transcript, timeline } }
       404 for unknown job. pct is stage-index-based. FIFO, ONE active pipeline; later POSTs queue.
```
- **Input safety:** event text is always delimited as DATA in prompts (never interpolated as
  instructions); a screen rejects slurs/abuse with `422 {bad_events:[indexes]}`. 1–50 events, each ≤300 chars.
- **`kind` is accepted and RESERVED** (maps only to truth label: quote→ATTRIBUTED_CLAIM, else FACT). 
- **Retention:** keep-last-20 SHOWTIME jobs; older artifact dirs purged on new POST. Poll contract says so.
- **Grade is NOT a per-job stage** (judge fix, adopted): `grade_show.mjs` is a standalone grader run for
  acceptance + benchmarks. Games don't pay judge latency on every render.
- Jobs use the existing showbuild pattern: POST spawns the CLI detached, per-stage `status.json`,
  artifacts in `lab/shows/st_<job>/`. CLI mirror: `node lab/engine/showtime.mjs --events=<file> [...]`.
- v1 (hosted keys/metering/style-packs/webhooks) stays out of scope; v0's contract is what v1 wraps.

## 3. Pipeline — stages, owners, models

```
events ─► SYNTHESIZE  lab/engine/synthesize_events.mjs  PURE, no network, unit-testable offline:
                      each event = one evidence row, VERBATIM. Worked example (2 events in):
                        dossier str_<id>.json: { id, assignment:{text:"<show premise>", mode:"showtime"},
                          provenance:"showtime-events",
                          sources:[{id:"src_game", publisher:"game-events (showtime)", medium:"game"}],
                          evidence:[ {id:"E001", claim:"Tass eliminated 7 players in one game at a Miami
                                      paintball field", truth_label:"FACT", source_id:"src_game", valid_source:true},
                                     {id:"E002", claim:"It is a Miami single-game elimination record",
                                      truth_label:"FACT", source_id:"src_game", valid_source:true} ] }
        ─► ANGLES     own stage + status entry (judge fix: split from synthesize). Model: gpt-4.1-mini.
                      Derives TWO debate questions + per-question briefing moves. Law: factual moves cite
                      event ids; interpretive moves are labeled ANALYSIS/OPINION and marked uncited; any
                      name/number not present in events is BANNED. Guards (Risk judge, adopted): output
                      is parse-validated with ONE retry; any move citing an event id that does not
                      resolve is CUT (cite-or-cut), never shipped; event text enters prompts only as
                      delimited quoted data; names in events are game-world identities, spoken as given. Writes brf_<id>.json per question:
                        move example: { id:"m1", order:1, kind:"stat", headline:"Seven in one game",
                          body:"Tass eliminated 7 players in a single game.", truth_label:"FACT",
                          evidence_ids:["E001"], importance:5, uncited:false }
        ─► cast briefs / compile_beat / run_floor / make_episode  (existing, untouched; 2 segments;
                      length preset -> compile --runtime: short=2, standard=3. That's the whole duration
                      mechanism - no continuous knob (judge fix, adopted). actual_duration_s reported.)
        ─► voice      render_breeze segment (existing) + timeline.json [{who,text,start_s,dur_s}] (BUILT)
        ─► mux_video  lab/engine/mux_show_video.mjs: current speaker's portrait fullscreen (lab/cast/
                      images/<id>.png, else portraits/<id>.jpg, else initials card - never a crash),
                      show-name + speaker lower third, style colors, hard cuts on the timeline,
                      1920x1080 + 1080x1920, audio underneath. NOT lip-sync; timeline.json is the seam
                      lip-sync upgrades into later.
        ─► QC gate    (judge fix, adopted): ffprobe asserts each mp4's resolution + |mp4 - mp3| duration
                      ≤ 0.5s; timeline sums to mp3 duration ±1s; LUFS measured and written to the
                      benchmark row (pass = -17..-15). Fails loudly, never ships silently broken video.
```

## 4. THE HOME-RUN RUBRIC (0-10 per axis; judged blind on the anonymized transcript + the input events)
| Axis | 10 looks like | Bar |
|---|---|---|
| **1. Fact fidelity** | every factual claim traces to an input event; zero invented names/stats/history | **must be 10 — one invented fact = automatic MEDIOCRE** |
| 2. Angle richness | ≥4 distinct angles (meaning, method, history-of-the-scene framing WITHOUT invented history, stakes, doubt) | ≥8 |
| 3. Collision heat | genuine opposition, escalation, a landed verdict | ≥7 |
| 4. Character distinctness | blind read names the speaker from the words | ≥7 |
| 5. Structure | cold open names the moment · debate · verdict · on-record prediction · sign-off | ≥8 |
| 6. Repetition discipline | no opener tics, no stat 3+ times, no vocative spam | ≥7 |
| 7. Direction variety (transcript-visible) | delivery directions vary across the arc | ≥7 |
| 8. Latency tier | S ≤5min · A ≤10min · B ≤20min end-to-end (3-min audio show), graded on the SLOWER of ≥2 warm runs | ≥A |
LUFS moved out of axis 7 into the measured QC gate (judge fix). **HOME RUN = avg ≥7.5 AND fact
fidelity 10 AND tier ≥A.** Grader: `grade_show.mjs` — judge model gemini-2.5-flash (different family
than the gpt-4.1-mini writers), versioned prompt at `lab/engine/judge_prompts/showtime-rubric-v1.md`,
raw per-axis JSON stored with the artifacts. The acceptance run ALSO gets the house blind codex judge.

## 5. Benchmarks — exact run set (judge fix: named, minimal)
`lab/benchmarks/showtime-2026-09-18.md`: per-stage + end-to-end for
(1) warm config-A (gpt-4.1-mini desk) audio+video — the acceptance run,
(2) warm config-B (gemini-2.5-flash desk) audio-only,
(and cold-start numbers recorded if observed, informational, never tier-grading).
Tier graded on the slower warm run. LUFS + |duration-target| deltas in the row.

## 6. Failure handling
400 (bad desk/limits, named) · 422 (unsafe events, indexes named) · state:"failed" with error + the
dying stage in the poll (no infinite polling) · job timeout 30min → failed · gateway busy → stage
says so, job keeps its place · per-stage retries (existing; ANGLES gets its own, above) · `--resume`
re-enters at the dead stage · **partial success is explicit** (Risk judge, adopted): voice-complete /
video-failed still delivers the mp3 with a per-artifact error object — a game gets audio, never a dead
job · **fact watch** (v0 warn, v1 gate): after the floor, numbers >12 spoken in the transcript that
appear in no input event are flagged in status as `fact_warnings` (the full LLM grade stays an
offline tool; the cheap deterministic scan runs every job) · Breeze license: self-hosted output =
demo/prototype; monetized integrations route voice through the hosted plan (runtime config).

## 7. Acceptance (§8 of v1: kept, plus the judges' negative checklist)
Happy path: the exact Tass/Miami-record events → mp3 + 16:9 mp4 + 9:16 mp4 + transcript + timeline +
benchmark rows + blind grade; home run or say why not, with numbers. Negative checklist: empty
events→400 · 51 events→400 · unknown desk id→400 · desk member without portrait→initials card visible
in the mp4 · unsafe event→422 naming the index.

## 8. Build order (judge fix: stated, not derived)
1. `synthesize_events.mjs` (pure) → 2. timeline.json in render_breeze (done) → 3. `mux_show_video.mjs`
→ 4. `showtime.mjs` orchestrator (angles + stages + status + benchmarks) → 5. `/api/showtime` route +
middleware gate → 6. `grade_show.mjs` + judge prompt → 7. acceptance + benchmark runs → 8. report.
