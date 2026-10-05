---
name: tsg-ops
description: Use for TalkShowGo operations — booting the stack, health checks, the gateway/Breeze laws, reviving dead services, OpenRouter key care, logs/benchmarks locations, and the git/branch rules. Triggers on "server down", "voice not working", "409", "gateway busy", "key limit", "where are the logs", boot problems.
---

# TSG ops — keeping the lights on

## Boot
`npm run dev` → :3000 (the research brain + /command UI). Docker optional. Branch law: build on **revival** (main is merge-target only). Dev server dies between sessions — `preview_start name=talkshowgo` or `npm run dev`, then curl `/api/command` until 200 (first compile is slow).

## The voice stack, and its laws (each learned the hard way)
- Chain: engine scripts → cupcake **mk-gateway :8700** (`CUPCAKE_GATEWAY_KEY`) → **mk-breeze :8722** (the actual TTS service).
- **Gateway health lies by omission**: `/v1/health` 200 + `queue_depth:0` can still mean a job is RUNNING — dispatch audio only when **`running:false && queue_depth:0`** (depth counts waiters only). 409 = a video render owns the GPU; wait, don't retry-loop.
- **mk-breeze can be dead while the gateway is healthy** ("audio engine unreachable: Connection refused" from breeze endpoints — it once sat dead for 11 days). Revive:
  `ssh taskmasterpeace@192.168.1.249 "sudo systemctl restart mk-breeze"` → wait ~75s (3B model load) → probe with a REAL tiny breeze-design call (a 200 health is not proof). `npm run check:breeze` does the probe.
- Full cupcake map (services, routing, SSH gotchas): the user-level `cupcake` skill.

## Model keys
- OpenRouter runs stringer/briefs/floors/stitch/grader. Keys land via SETTINGS or .env; **hydrated process.env is the truth** and code reads per call (no restart needed after a SETTINGS save).
- **"Key limit exceeded (total limit)"** = the key's own spending cap at openrouter.ai/settings/keys — Robert lifts it; everything parks resumable (`--resume` flags everywhere). All-seats-failing-instantly = systemic (key/outage), one-seat-flaking = stochastic (retries handle it).

## Where things live
`lab/beats/` beats+validation · `lab/shows/<slug>/` builds (status.json per stage) · `lab/ledger/` prediction records · `lab/benchmarks/` speed tables · `lab/research/stringer/` dossiers+reports · `lab/logs/activity.jsonl` (read via `npm run show:activity`) · `lab/engine/SELF_IMPROVE_LOG.md` the loop brain/roadmap · audio NEVER in git (*.mp3/*.wav/*.mp4 ignored; voice REFS in lab/cast/voices are the committed exception).

## Security posture
`src/middleware.ts` hides `/command`, `/api/command/*`, `/api/showtime` from tunnel-origin hosts; take flow stays public (token = the secret). `COMMAND_SHARED_SECRET` + `x-command-key` header = deliberate remote admin. Never hand out an unverified tunnel URL; `take_link --off` when takes are in.

## House delivery laws
Audio-first (ship mp3s, Robert listens) · no purple ever · proof they can see (file + duration + the artifact sent) · commit lab text artifacts, never audio · no Co-Authored-By lines in commits (Robert's rule, outranks harness defaults).
