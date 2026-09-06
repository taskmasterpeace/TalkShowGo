# CLAUDE.md

This file guides Claude Code in this repository. It describes the system as it ACTUALLY is —
everything in the PARKED section at the bottom exists in the tree but is dead; harvest it, never
resurrect it silently.

# TalkShowGo — the custom talk-show engine

Research a real topic, stage a genuine multi-host debate about it, voice it, ship an mp3.
Branch **`revival`** (main is a dead Dec-2025 snapshot — never build there).

## Boot

```bash
npm run dev        # Next.js on :3000 - the research brain + producer UI at /command
```

Docker (`npm run docker:up`) is OPTIONAL: it brings up SearXNG (web search supplement), Redis,
Postgres/PostgREST (legacy, unused by the live pipeline). The live pipeline needs only `npm run dev`
plus network access to the model providers below.

## The live pipeline (one episode, end to end)

```bash
# 0. a new topic bootstraps itself + writes a validation report (PASS/MARGINAL/FAIL contract)
npm run show:bootstrap -- --name="South Carolina State" --niche="HBCU football"

# 1. beat + questions -> researched, briefed, compiled, floored, stitched episode script
npm run show:build -- --beat=sc-state --questions="Q1|Q2" [--slug=x] [--desk=a,b,c] [--resume]

# 2. voice it (Breeze TTS via the cupcake gateway; per-host LUFS leveling to -16)
npm run show:voice -- lab/shows/<slug>-s1/episode.md lab/shows/<slug>-s1/SHOW-ep.mp3

# helpers
npm run show:activity -- --tail=30 [--kind=take] [--person=robert]   # human-readable activity log
npm run show:dossier                                                  # report on the newest research dossier
npm run show:takes -- --person=<slug> [--public]                      # take links + QR (+ on-demand tunnel)
```

Stage by stage (all under the hood of `show:build`):
stringer research (`POST /api/command/stringer`, YouTube transcripts via Innertube + opt-in web supplement)
→ briefing (`/api/command/briefing`) → per-host cast briefs (`/api/command/briefing/agent`)
→ `lab/engine/compile_beat.mjs` (director assigns moderator + YES/NO debaters) → `lab/engine/run_floor.mjs`
(per-host engines, guard stack, moderator-drive, callback cap) → `lab/engine/make_episode.mjs` (cold open,
content-aware transitions, closing prediction ritual — no calendar years, grounded in what the show
established — sign-off) → `lab/engine/render_breeze.mjs segment` (voices + levels; refuses to render if
spoken lines would be silently skipped).

## Data plane (files are the source of truth; /command is CRUD over them)

| Path | What |
|---|---|
| `lab/beats/<id>.json` | A coverage area: sources (twitter w/ userId, youtube w/ channel_id, rss), `show` block (name/hosts/intro/outro/timespan), `people[]` (delegates w/ private tokens + remembered fan `depth`) |
| `lab/beats/<id>.VALIDATION.md` | The bootstrap health report + PASS contract |
| `lab/cast/cast.json` | 19 hosts as LOCKED bundles: model+temp+Personality Print v4+voice. Pass the WHOLE bundle, never a name |
| `lab/cast/voices/*.wav` + `.ref.txt` | Locked Breeze refs (committed - they ARE the voice lock; uploads keep a `.prev.wav` backup) |
| `lab/shows/<slug>/` | A build: beatcard, evidence, floor/, episode.md, episode.json (build stamp) |
| `lab/takes/<beat>/<slug>/` | The take inbox (gitignored: personal voice audio) |
| `lab/research/stringer/` | Dossiers + `.REPORT.md` files |
| `lab/logs/activity.jsonl` | Append-only telemetry (`npm run show:activity` to read) |
| `lab/engine/SELF_IMPROVE_LOG.md` | The self-improvement ledger: iterations, reverts, the roadmap |

## Voice (Breeze, and ONLY Breeze)

- TTS = **Breeze via the cupcake mk-gateway** `http://192.168.1.249:8700` (`CUPCAKE_GATEWAY_KEY`).
  CFG law: design/direction 4.0, clone 1.0. The `breeze-tts-2` skill is the authority.
- ~~Dia~~ and ~~ElevenLabs~~ do not exist in this codebase anymore (see PARKED).
- Every rendered file gets a row in `lab/engine/AUDIO_MANIFEST.md` (words-by / voiced-by).
- Delegate voices: the longest recorded clip across ALL a person's takes becomes their clone ref
  (a short new clip never replaces a longer one); refs are cut to the 10-20s Breeze spec.

## Take links (real people on the show)

`/take/<token>` is the delegate flow: inform-first brief → ask (web lookup) → behavioral fan-depth
(never "are you a superfan"; remembered per person, quiz skipped on return) → record/type → follow-ups
→ save (idempotent via client_key; retried sends never duplicate). The longest clip auto-becomes their
floor voice. Needs HTTPS for the phone mic.

**Tunnels**: `take_link.mjs --public` opens one on demand. Free localhost.run tunnels are CULLED AT
~31 MINUTES no matter what — plan around it (Tailscale Funnel, once enabled on the tailnet, is the
permanent link). `--off` closes everything. While a tunnel is up, `src/middleware.ts` hides
`/command` + `/api/command/*` from tunnel-origin requests (the take flow stays public by design);
`COMMAND_SHARED_SECRET` + `x-command-key` header is the deliberate remote-admin escape hatch.

## Model providers

- **OpenRouter** (`OPENROUTER_API_KEY`): stringer parse, briefings, floor engines (gpt-4.1-mini,
  gemini-2.5-flash/-lite are the fast seats; deepseek-v3.2 is avoided - 45-265s/turn).
- **cupcake** `192.168.1.249`: `:8700` gateway (Breeze TTS, STT), `:11434` Ollama (topic miner).
- **Mac Mini** `192.168.1.238:11434`: Ollama fallback (qwen3.5).
- Keys land via SETTINGS (`/command/settings`) or `.env`; hydrated `process.env` is the truth and
  live code reads keys per call (a key saved in SETTINGS works without a restart).

## House laws

- **Audio-first deliverables**: Robert listens; ship mp3s, not text files.
- **No purple. Ever.** In any UI, chart, or generated asset.
- Callbacks to "last show" are capped at twice per room, never a third.
- Closing predictions: no calendar years, must not contradict what the show established, must differ
  from each other.
- Excluded publishers (LTBR) are never sourced or surfaced.
- Verify real-person facts (a floor line once misgendered a real coach - fix queued at extraction).
- Commit lab/ artifacts (scripts, beatcards, evidence) but never audio (`*.mp3`/`*.wav` gitignored),
  never `lab/takes/` (personal voice + tokens), never `lab/logs/`.
- git law: this repo is sometimes worked from other session cwds - prefer `git -C D:/git/talkshowgo`.

## UI (/command)

DESK (lamps + pull/mine) · DISCOVERY (story → one-click build) · STRINGER (research + interviews) ·
CAST (bundles, voices, portraits) · PEOPLE (delegates + take links) · TAPE (finished audio) ·
SETTINGS (keys, verified before save). The legacy app-shell console noise ("Error fetching topics")
is a dead legacy poller - ignore it.

## PARKED (exists in the tree, is NOT the system)

- **The battle-rap era stack**: Postgres/PostgREST/Kong schema, BullMQ workers (`src/workers/` is
  GONE - the compose `worker` service is commented out), `scripts/*.mjs` DB scripts, supabase
  migrations, SCHEDULER-README. The live system is file-based under `lab/`.
- **Dia TTS**: `docker/dia/` does not exist; the compose service is commented out. Any doc that says
  "Dia is primary" predates the Breeze pipeline.
- **ElevenLabs**: no module, no keys, only a key-manager slot.
- **`/studio/*` pages, `/api/topics`, `/api/entities`, research-package endpoints**: none exist;
  the app has exactly `/api/command/*` and `/api/take/[token]`.
- Old docs below `docs/` may describe these; check the file dates before trusting them.
