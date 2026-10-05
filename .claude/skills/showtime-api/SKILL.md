---
name: showtime-api
description: Use for SHOWTIME — turning game events into talk shows via API/CLI (the games integration), the speaker-face video muxer (16:9 + 9:16), the blind grading rubric, and benchmarks. Triggers on "showtime", "game events to show", "API for my game", "video podcast of the show", "grade this output".
---

# SHOWTIME — game events in, talk show out (plan: docs/SHOWTIME-API-PLAN.md v1.1, coach-graded)

First HOME RUN: st_uvgov3 (Tass's 7, 2026-09-18) — avg 7.71, fact 10/10, tier A, ~7min for a 2:49 show with both videos.

## Surfaces
- **API**: `POST /api/showtime` {events[{text,kind?}], show{name,tagline}, desk?, length:short|standard, outputs{audio,video{aspects}}, style{bg,accent}, client_key?} → 202 {job, poll}. GET ?job= → {state,stage,pct,error?,fact_warnings?,artifacts}. One active job (409 + active_job), client_key idempotent, 404 unknown, 422 unsafe events w/ indexes, keep-last-20 retention, 30-min timeout, **tunnel-gated in middleware like /api/command**.
- **CLI**: `node lab/engine/showtime.mjs --events=<file.json> --job=st_x --show="..." --length=short [--video] [--resume]` — same stages, per-stage status.json, `--resume` re-enters at the dead stage (floors/voice are the expensive parts; resume preserves them).
- Example event files: `lab/showtime-examples/*.json`.

## Pipeline + its laws
sanitize → synthesize (`synthesize_events.mjs`, PURE: events become VERBATIM FACT evidence, provenance `showtime-events`) → ANGLES (two debate questions; **factual moves must cite event ids or they're CUT**; names/numbers not in events BANNED; parse-retry) → briefs (3-pass retry — sparse-evidence briefs flake; Cassius's cited-stance validation fails most) → compile (`--runtime` from length preset) → floors → stitch → **fact-watch** (numbers >12 not in events → `fact_warnings`, warn-only v0) → voice (+timeline.json) → mux (**partial success: video fails, audio still ships with video_error**).

## The muxer (lab/engine/mux_show_video.mjs) — paid-for gotchas
- Face lookup: `lab/cast/images/<id>.png` → `portraits/<id>-gray.jpg` → `portraits/<id>.jpg` → initials card. (OG desk portraits are PNGs in images/, Diverse Ten jpgs in portraits/.)
- concat demuxer resolves relative entries against the LIST's dir — **absolute paths in list.txt always**.
- Stills round up to the 24fps grid (+0.68s over 18 entries) — **`-t <audioDur>` pins the output**; QC gate asserts resolution + drift ≤0.5s (final: 0.01s).

## Grading (never per-job; run on acceptance/benchmarks)
```
node lab/engine/grade_show.mjs --transcript=<episode.md> --events=<events.json> [--total-min=7.4]
```
Blind (speaker-anonymized), judge gemini-2.5-flash (different family than writers), versioned prompt `lab/engine/judge_prompts/showtime-rubric-v1.md`. **HOME RUN = avg ≥7.5 AND fact_fidelity 10 AND tier ≥A (S≤5min, A≤10, B≤20). One invented fact = automatic MEDIOCRE.** A future-tense prediction number is not a fact violation (judge ruled; fact-watch still flags it for eyes).

## Benchmarks
`lab/benchmarks/showtime-<date>.md`. Honest numbers (2026-09-18): angles ~8s · segment floors ~30s each (2-evidence world) · stitch 4s · **voice ~1.5× realtime (the whale)** · mux ~25s/aspect. Tier graded on the slower of ≥2 warm runs.

## License law
Self-hosted Breeze output = demo/prototype ONLY. A monetized game integration routes voice through the hosted Breeze plan (runtime config swap; frozen refs transfer as saved voices).
