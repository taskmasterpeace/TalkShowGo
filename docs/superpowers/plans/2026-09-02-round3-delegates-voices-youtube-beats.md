# Round 3 — Delegates anytime, real voices, YouTube on display, sports beats, the Janitor

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. This round is executed as PARALLEL WORKSTREAMS, one fresh subagent owning each workstream end to end (not task-by-task handoffs), so each workstream below is a complete spec: decisions already made, exact files, shared JSON contracts, verification commands, commit message. Steps use checkbox (`- [ ]`) syntax for tracking. Codex reviews each workstream's diff after it lands (tightly scoped — a broad Codex scope timed out last round).

**Goal:** Turn TalkShowGo into the thing Robert described on 2026-09-02: a father and a son who can't watch the game together each drop their take whenever they have a minute (a link they tap, later a call or an email), and the show seats them both, in their own voices, next to hosts who sound right and know exactly what they're talking about — with YouTube (transcripts, timestamps, clips) on display, real sports beats (Falcons, Pacers) beside Orangeburg, hosts you can run without style guardrails, a Scout that suggests instead of acting, a Janitor that keeps the ecosystem clean, and an in-app settings page so the whole thing is distributable.

**Architecture:** Files stay the source of truth (`lab/`), the command center is CRUD over them, engines are `.mjs` under `lab/engine/`. New pieces follow the same shape: a `src/lib/command/*.ts` module + a `src/app/api/command/*/route.ts` + a page under `src/app/command/`. Every action appends one activity-log line (`appendLog` from `src/lib/command/log.ts`). Audio-first: every workstream that touches sound ends with an mp3 for Robert.

**Tech Stack:** Next 14 app router (`revival` branch only), youtubei.js + yt-dlp (`C:/Users/taskm/AppData/Local/Programs/Python/Python313/Scripts/yt-dlp.exe`), ffmpeg (on PATH; has `loudnorm`), OpenRouter (key verified live; $4.64 left of a $5 cap), Breeze TTS on cupcake (`breeze-tts-2` skill is the authority; CFG 4.0 design, 1.0 clone), Gemini 2.5 Flash STT via OpenRouter (`src/lib/command/stt.ts`).

**Cross-repo git law:** every git command is `git -C /d/git/talkshowgo ...`. Commit messages: no Co-Authored-By lines (Robert's global rule).

---

## Decisions already made (do not re-ask; Robert granted decision authority 2026-09-02)

1. **"Philadelphia" in the voice note = Atlanta Falcons.** He listed "a local and two sports teams": Orangeburg SC, Atlanta Falcons, Indiana Pacers.
2. **Champagne Dwayne** is the new male host's name — spelled `Dwayne`, explicitly NOT `Duane` (the real, inactive rapper). The dead `champduane` X source is already removed from the battle-rap beat.
3. **Tasha Raw's VOICE is frozen** (Robert approved; `_note` in cast.json). Her MODEL may change. **Blaze's and Knowledge's voices are rejected** and get redesigned as candidates Robert picks from.
4. **Guardrails become per-host, but only the STYLE ones.** Anaphora, end-name tic, catchphrase cap, exemplar-repeat = `guards.style`. The invented-number guard, the five bright lines, the evidence law, and the MIX verbatim protection are NOT dials — they are what keeps a show from pinning a crime on the wrong person.
5. **Scout suggests; a human verifies.** Auto-add becomes opt-in (off by default). Scout also gets an EXPLORE mode for channels it has never used.
6. **Delegate takes are BEAT-level and ANYTIME**, not tied to a briefing. A person attached to a beat has a private link; whatever they drop lands in a take inbox; the next show built for that beat seats every unused take. This is what makes the father/son case work — neither has to be online at the same time, and nobody waits for the show to ask first.
7. **Phone (Twilio) and email are simulated first, wired second.** The simulation harness posts takes through the exact same API a phone or email adapter would, so edge cases get found now. Real Twilio/email adapters land after the cross-repo scan (an Explore agent is inventorying existing Twilio/ElevenLabs/email/record-page code across `D:/git`).
8. **Model lineup (OpenRouter everywhere; Requesty is dead — 402):**
   | Role | Model | Why |
   |---|---|---|
   | Showrunner (producer, 1 call/show) | `anthropic/claude-sonnet-5` | the one seat where the writer quality is the product |
   | Marcus Blaze | `google/gemini-2.5-flash-lite` | The Instant Read — gut host, 1M context |
   | Tasha Raw | `deepseek/deepseek-v3.2-exp` | The Committed Voice ("Robert's pick") — receipts + won't back down |
   | King Knowledge | `deepseek/deepseek-r1` | The Deliberate Mind — slow is gravitas |
   | Champagne Dwayne (NEW) | `nousresearch/hermes-4-70b` | The Unfiltered Mouth — the no-guardrails host |
   | STT (delegate takes) | `google/gemini-2.5-flash` | verbatim, ~1.4s |
   | Follow-ups / parser / lead miner fallback | `google/gemini-2.5-flash-lite` | pennies |
   | Floor default provider | `openrouter` (was `ollama`/cupcake qwen3:30b — the 3.3/10 plateau) | each host on its own DNA engine |
   Cost: a full show on this lineup is cents; the Showrunner call is the only dollar-scale item (~$0.05). Robert must raise the OpenRouter limit above $5.
9. **Design law for every new surface:** dark warm base, ONE accent matching the existing command center, Inter, 10px radius, hover states, real empty states. **NO PURPLE.** Authored, not generic. Public pages (the take link) are mobile-first and carry no command-center chrome.
10. **New gitignored dirs:** `lab/takes/` (people's audio), `lab/settings/` (keys!), `lab/clips/`, `lab/janitor/`, `lab/scout/`. `lab/cast/voices/candidates/` IS committed (small wavs; candidates are part of the lock decision).

---

## Shared contracts (every workstream uses these exact shapes)

```jsonc
// beat.people[] — a person attached to a beat (WS-3 owns the schema; WS-5 writes it into new beats)
{ "slug": "dad", "name": "Dad", "relation": "father", "channel": "link", "address": null,
  "token": "k7m2p9qx4tz8w3rn", "prompts_mode": "auto", "custom_prompts": [], "added": "2026-09-02T18:00:00Z" }
// channel: "link" | "email" | "phone"; address: email or E.164 phone when channel needs one; token: 16 chars [a-z0-9]

// lab/takes/<beat_id>/<person_slug>/take-<n>.json — one take (audio or typed)
{ "beat": "atlanta-falcons", "person": { "slug": "dad", "name": "Dad" }, "take": 3,
  "prompt": "What did you make of the Falcons' fourth quarter?",
  "transcript": "Man, that fourth quarter...", "answers": [ { "q": "...", "a": "...", "source": "voice|typed|choice" } ],
  "seconds": 41.2, "wav": "D:/git/talkshowgo/lab/takes/atlanta-falcons/dad/take-3.wav", "mime": "audio/webm",
  "created_at": "2026-09-02T18:05:00Z", "used_in": null }          // used_in: show slug once seated

// cast.json host additions (WS-4)
"model": { "provider": "openrouter", "id": "...", "temperature": 0.9, "dna_id": "..." },
"guards": { "style": true }        // false = anaphora / end-name tic / catchphrase cap / exemplar-repeat OFF for this host

// lab/settings/keys.json (WS-7; gitignored)  — env vars ALWAYS override these
{ "OPENROUTER_API_KEY": "...", "TWITTERAPI_IO_KEY": "...", "PERPLEXITY_API_KEY": "...", "CUPCAKE_GATEWAY_KEY": "...",
  "TWILIO_ACCOUNT_SID": "...", "TWILIO_AUTH_TOKEN": "...", "TWILIO_FROM": "...", "ELEVENLABS_API_KEY": "...",
  "RESEND_API_KEY": "...", "ASSEMBLYAI_API_KEY": "...", "YTDLP_PATH": "...", "FFMPEG_PATH": "..." }
// lab/settings/models.json (WS-7)
{ "roles": { "showrunner": { "provider": "openrouter", "id": "anthropic/claude-sonnet-5" },
             "host:marcus-blaze": { "provider": "openrouter", "id": "google/gemini-2.5-flash-lite" },
             "stt": { "provider": "openrouter", "id": "google/gemini-2.5-flash" },
             "followups": {...}, "parser": {...}, "leads": {...}, "rank": {...}, "floor_provider": "openrouter" } }

// transcript with timestamps (WS-2)
{ "video_id": "abc123", "duration_s": 1834, "words": 5120, "text": "...flat...",
  "segments": [ { "start_s": 0.0, "end_s": 3.2, "text": "..." } ] }

// scout response additions (WS-6)
{ "suggested": [ { "channel_name": "...", "channel_id": "UC...", "in_window": 4, "reason": "4 videos on \"Falcons\" in 72h" } ], "auto_added": [] }

// janitor report lab/janitor/<beat>/<ts>.json (WS-6)
{ "beat": "battle-rap", "ran_at": "...", "positions": [ { "position": "source_auditor",
    "findings": [ "HipHopIsReal on X has 4 followers (label says media outlet) - SUSPECT squatter" ],
    "proposals": [ { "id": "jp_ab12", "action": "flag_suspect|retire_source|repair_id|add_channel|widen_window|prune_runs",
                     "target": "twitter:HipHopIsReal", "reason": "...", "auto": false, "status": "pending|applied" } ] } ] }
```

---

## WS-1 — Show Robert the DATAFLOW (owner: the main session, not a subagent)

- [ ] Dev server up via `.claude/launch.json` (`autoPort: true` — port 3000 is LogNog's Vite; never kill it).
- [ ] Open `/command/dataflow`, confirm the strip renders the latest battle-rap runs (`lab/runs/*_2026-09-02T16-35-39-130_battle-rap.json`), click one sample to light its lineage, screenshot, `SendUserFile`.
- [ ] Explain in plain language what each hop is and what it carries.

---

## WS-2 — YouTube on display: timestamps kept, transcripts readable, clips playable

**Plain language:** YouTube is already reliable (3-rung pull). This makes it VISIBLE, keeps the timestamps the subtitles already carry (today they are thrown away at `stringer.ts:97`), and lets a producer cut a bounded clip so a show can play a snippet.

**Files:**
- Create: `src/lib/command/transcript.ts` — `parseVtt(raw): { segments, text, words }` (dedupe rolling auto-sub repeats: keep the FIRST cue's `start_s` for each unique line; strip `<c>` tags and entities exactly as `stringer.ts:96` does), `fetchTranscriptSegments(videoId, { capWords? }): Promise<Transcript>` (yt-dlp `--write-auto-sub --write-sub --sub-lang en --sub-format vtt`, same args as today), `duration_s` from the last cue.
- Modify: `src/lib/command/stringer.ts:87-105` — `fetchTranscript` delegates to the new lib and ALSO stores `transcript_segments` (cap 400 segments) on the source in the dossier so a claim can cite `video_id@mm:ss`.
- Modify: `src/app/api/command/transcript/route.ts` — return the full contract (`segments`, `duration_s`, `text`, `words`); accept `GET ?video_id=` as well as `POST {video_id}`.
- Create: `src/app/api/command/clip/route.ts` — `POST { video_id, start_s, end_s }`, hard limits: `end_s - start_s <= 30`, start>=0; yt-dlp `-f bestaudio --download-sections "*<start>-<end>" -x --audio-format mp3` to `lab/clips/<video_id>_<start>-<end>.mp3` (cached: if it exists, return it); response `{ ok, path, url }` where `url` is served by the existing `/api/command/audio/[...p]` route (read that route first; extend its allowed roots to `lab/clips` if needed). Producer-triggered and bounded on purpose — never background media downloads.
- Create: `src/app/command/youtube/page.tsx` — the YOUTUBE page: beat picker (same pattern as SOURCES), health header (channels answered / total, last pull time, rung mix from the newest `lab/runs/pull_*<beat>.json` — read its shape first), per-channel card: rung badge (`rss` / `innertube` / `ytdlp` / `dead→repaired`), videos in window with thumbnail + title + age + duration, captions availability, TRANSCRIPT drawer (timestamped lines; clicking a line sets the embedded player `?start=<s>` — use the YouTube iframe embed, allowed for this purpose), CLIP control (pick start, length ≤30s, renders via `/api/command/clip`, plays inline). Empty states for "no pull yet" and "no captions".
- Modify: the command nav (find it: grep `dataflow` in `src/app/command/` layout/nav) — add YOUTUBE next to SOURCES.
- Log: `appendLog({ kind: 'youtube', stage: 'transcript'|'clip', ... })`.

**Steps:**
- [ ] Read `src/lib/command/yt.ts`, `src/app/api/command/process/route.ts` (the pull), the newest `pull_*.json`, and `src/app/api/command/audio/[...p]/route.ts` to learn the real shapes before writing anything.
- [ ] Build `transcript.ts` with a unit-style check script `lab/engine/check_transcript.mjs` (or a `tsx` one-off) that runs it on a real video from the newest battle-rap pull and asserts: `segments.length > 0`, timestamps monotonic non-decreasing, `text` non-empty, no `-->` in any text.
- [ ] Wire the route + stringer, then the clip route, then the page + nav.
- [ ] Verify in the browser: page renders for battle-rap, transcript drawer shows timestamps, a 15s clip renders and plays. Screenshot.
- [ ] Commit: `git -C /d/git/talkshowgo add -A src/lib/command/transcript.ts src/lib/command/stringer.ts src/app/api/command/transcript src/app/api/command/clip src/app/command/youtube <nav file> lab/engine/check_transcript.mjs .gitignore && git -C /d/git/talkshowgo commit -m "youtube: timestamped transcripts, YOUTUBE page (rung health, transcript drawer, bounded clips)"`

**Verification:** `curl -s localhost:<port>/api/command/transcript?video_id=<id> | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{const j=JSON.parse(s);console.log(j.segments.length, j.segments[0], j.duration_s)})"` → segments > 0 with numeric `start_s`.

---

## WS-3 — Delegates anytime: people on a beat, the take link, the inbox, seated on the next show, and the simulation loop

**Plain language:** This is the father/son machine. Each beat has PEOPLE. Each person gets a private link. They tap it on their phone whenever they want, hit RECORD, talk, get two or three follow-up questions with tappable answers, and hit THAT'S MY TAKE. It sits in that beat's inbox. The next time a show is built for that beat, every unused take is seated on the floor word-for-word, in that person's own cloned voice. A simulator plays the people so we can run this loop a hundred times and find the edge cases before a real dad does.

**Files:**
- Create: `src/lib/command/people.ts` — `loadPeople(beatId)`, `addPerson(beatId, {name, relation, channel, address})` (generates slug + token, re-reads the beat file before patching `people[]` so concurrent scout/pull writes are never clobbered — same discipline as the pull's beat repair), `personByToken(token) → { beat, person } | null`, `newToken()` (crypto random, 16 chars `[a-z0-9]`).
- Create: `src/lib/command/takes.ts` — `takeDir(beatId, slug)`, `nextTake`, `saveTake(...)`, `listTakes(beatId, slug?)`, `pendingTakes(beatId, { maxAgeDays: 7 })`, `markUsed(takes, showSlug)`. Reuse `toWav`, `transcribeWav`, `wavSeconds` from `stt.ts`; copy the `EXT_BY_MIME`, size and `ownedWav`-style guards from `src/app/api/command/briefing/interview/route.ts` (extract them into `src/lib/command/audio-intake.ts` and have the interview route import from there — one intake path, not two).
- Create: `src/lib/command/prompts.ts` — `promptsFor(beatId, person)`: if the beat has a briefing or a recent cluster/rank run, 3 tailored questions (reuse the shape of `interviewQuestions` in `agent-brief.ts`; flash-lite); else the beat's `show`-aware generic set ("What did you make of the game?", "Anything about the trades or injuries you want on the record?", "What's your prediction?"). Follow-ups: reuse `askFollowups` from the interview route — move it into `src/lib/command/followups.ts` taking a plain `context` string instead of a briefing, and make the interview route call the moved function.
- Create: `src/app/api/take/[token]/route.ts` — `GET` → `{ ok, show: { name, tagline }, person: { name }, prompts[] }`; `POST { audio_b64, mime, prompt }` → save + transcript (`{ transcript, seconds, take, wav }`); `POST { followups: true, transcript_so_far }` → `{ followups }`; `POST { answers[], voice? }` → final take json with `answers` and `voice` (the longest take + its transcript, path-guarded to this person's dir). Unknown token → 404, no hints. Same size/mime limits as the interview route. Every call logs `kind:'take'`.
- Create: `src/app/take/[token]/page.tsx` (+ `layout.tsx` with NO command shell) — mobile-first public page. Above the fold: show name, "Hey {name}", the first prompt, one big RECORD button (MediaRecorder; webm/ogg/mp4 per browser), a live "listening…" state, then the transcript in an editable box, then follow-ups as tappable choices + a free-text box, then THAT'S MY TAKE → a done state ("You're on the next show."). "Type instead" link always visible. Handle: mic denied, no speech, network fail (retry), too long (25MB). Design per the design law; the show's name is the hero, not a form.
- Create: `src/app/api/command/people/route.ts` — `GET ?beat=` list, `POST {beat, name, relation, channel, address}` add, `DELETE {beat, slug}`; `GET ?beat=&takes=1` includes takes with `used_in`.
- Create: `src/app/api/command/takes/attach/route.ts` — `POST { beat, briefing_id }`: turns every pending take into a `human:true` delivery via `humanDelivery()` + `mergeDelivery()` (agent-brief.ts), `voice` = the longest take with a transcript; marks takes `used_in` = briefing id (the show slug is stamped later by make_show — write both when known). Returns `{ seated: [names], skipped: [reasons] }`.
- Create: `src/app/command/people/page.tsx` — PEOPLE page: beat picker; add-person modal (name, relation, channel link/email/phone, address); person cards with COPY LINK, the link itself (`<origin>/take/<token>`), takes list (play the wav via `/api/command/audio/...`, transcript, `used_in` badge), NUDGE (link: copies a short message with the link; email: `mailto:` draft; phone: "simulated for now"); a SIMULATE button per beat (runs the harness below through `POST /api/command/simulate`). Nav entry PEOPLE.
- Modify: `lab/engine/make_show.mjs` — before `compile`, call `POST /api/command/takes/attach` (the app URL from `--app=` or `APP_URL`, default `http://localhost:3000`; if unreachable, log a warning and continue — a show must never fail because the inbox was unreachable). RE-READ the file immediately before editing (WS-4 no longer touches make_show; it already defaults to openrouter). After compile, stamp `used_in` with the show slug via `takes.ts` semantics (a tiny `lab/engine/lib/takes_mark.mjs` that rewrites the json files).
- Create: `lab/engine/sim_people.mjs` + `lab/engine/sim_scenarios.json` — THE LOOP. `node lab/engine/sim_people.mjs --beat=atlanta-falcons --scenario=father-son [--rounds=3] [--voice] [--stop-on-fail] [--app=http://localhost:PORT]`. For each round: pick the scenario's personas (father: 30 years a fan, watched the whole game, hates the play-calling; son: caught the second half on his phone between classes, loves the rookie), have flash-lite write each persona's spoken take (60-150 words, spoken register, no em-dashes) from the beat's latest cluster/briefing context if present else from the scenario's seed facts; if `--voice`, render each take to a wav through Breeze DESIGN voice (`render_breeze.mjs` design path, a different designed voice per persona) so the CLONE path is exercised, else post typed; POST through `/api/take/<token>` exactly like a phone adapter would (get prompts → post audio/typed → followups → answer with choices → final); then run `make_show.mjs` for the beat (`--from=compile` if a briefing exists, else the full build) and ASSERT: (a) both personas appear in the compiled beat card `participants` with `kind:'human'`; (b) every verbatim line survives into the floor transcript unaltered (the MIX law); (c) with `--voice`, `render_breeze` logs the clone for each persona and `lab/engine/AUDIO_MANIFEST.md` gets a row per rendered file (words-by / voiced-by); (d) an mp3 ≥ 60s exists. Edge-case scenarios in `sim_scenarios.json`: `silence` (empty take → the page/route must say so, nothing seated), `ramble` (12-minute take → transcript capped, longest take still clones), `same-name` (two people named Marcus → slugs differ, both seated), `spanish-line` (a sentence in Spanish stays verbatim), `profanity` (kept verbatim; the floor does not sanitize a human), `late-take` (posted after the show started → stays pending for the NEXT show, never half-seated), `contradiction` (a second take contradicting the first → both seated in order; the host is directed to notice). Write `lab/runs/sim_<ts>_<beat>.json` `{ scenario, rounds: [{ assertions: [{ name, ok, detail }] }], terminal: 'ALL_PASS' | 'FAIL' | 'INFRA' }` (`INFRA` = Breeze 409 busy / app unreachable — retry once, then stop). Log each round `kind:'sim'`.
- Create: `src/app/api/command/simulate/route.ts` — spawns the harness detached (same durable-job pattern as showbuild: job dir + status.json + heartbeat) and returns the job so PEOPLE can poll it.
- Modify: `.gitignore` — add `lab/takes/`.

**Steps:**
- [ ] Read first: `src/app/api/command/briefing/interview/route.ts`, `src/lib/command/agent-brief.ts` (`humanDelivery`, `mergeDelivery`, `interviewQuestions`), `lab/engine/compile_beat.mjs:72-175`, `lab/engine/make_show.mjs`, `src/app/api/command/showbuild/route.ts` (the durable-job pattern), the STRINGER page's delegate panel (`src/app/command/stringer/page.tsx`) for the existing recorder UI to reuse.
- [ ] Extract shared intake (`audio-intake.ts`) and follow-ups (`followups.ts`); re-point the interview route; run the existing voice e2e (`voice_e2e.mjs` in the session scratchpad if present, else re-run the interview flow by hand with a wav) to prove nothing regressed.
- [ ] people.ts + takes.ts + prompts.ts + the take API + the public page. Test on your own machine's browser (mic) AND with a curl of a stock wav.
- [ ] people API + PEOPLE page + nav. Attach route. make_show hook (re-read before edit).
- [ ] Harness + scenarios. Run `father-son` on `atlanta-falcons` (WS-5 creates the beat; if it does not exist yet, create a minimal `lab/beats/atlanta-falcons.json` from `sports-team-template.json` with `people[]` per the contract and let WS-5 fill the sources — coordinate by re-reading before writing). Then `--voice`. Then the edge-case scenarios. Fix what breaks; note each edge case found in the commit body.
- [ ] Deliverable for Robert: the father-son Falcons mp3 with both cloned voices, plus the sim report.
- [ ] Commit: `git -C /d/git/talkshowgo add -A <files> && git -C /d/git/talkshowgo commit -m "delegates anytime: people on a beat, the take link, inbox, seated on the next show, simulation loop"`

**Verification:** `node lab/engine/sim_people.mjs --beat=atlanta-falcons --scenario=father-son --rounds=1 --voice --app=http://localhost:<port>` → terminal `ALL_PASS`; mp3 path printed; `grep -c "in their own voice" <show dir>/audio.log` ≥ 2.

---

## WS-4 — Hosts and voices: Champagne Dwayne, redesigned male voices, even audio, per-host guardrails, the OpenRouter lineup

**Plain language:** The one voice Robert likes stays exactly as is. The two he doesn't get redesigned as CANDIDATES he picks from by ear. A new host, Champagne Dwayne, joins as the smooth, flashy, unfiltered one. Every voice in the mix comes out at the same loudness. Style guardrails become a per-host switch (Dwayne runs without them). All hosts move off the dead Requesty account onto OpenRouter engines.

**REQUIRED SUB-SKILLS:** `breeze-tts-2` (before any render), `personality-print` (before writing Dwayne's print). Read `lab/cast/PERSONALITY_PRINT.md` and `lab/engine/AUDIO_MANIFEST.md` (the manifest law: every rendered file gets a row).

**Files:**
- Modify: `lab/cast/cast.json` — (1) every `provider: "requesty"` → `"openrouter"`; producer stays `anthropic/claude-sonnet-5`; Tasha's `model` → `{ provider: "openrouter", id: "deepseek/deepseek-v3.2-exp", temperature: 0.95, dna_id: "deepseek/deepseek-v3.2-exp" }` (voice block untouched — FROZEN); Knowledge `dna_id` stays `deepseek/deepseek-r1`; Blaze stays flash-lite. (2) add `"guards": { "style": true }` to Blaze/Tasha/Knowledge. (3) NEW host `champagne-dwayne`: `persona_version: 1`, lane "the smooth talker: charm, flash, the read nobody else will say out loud", `model: { provider: "openrouter", id: "nousresearch/hermes-4-70b", temperature: 0.95, dna_id: "nousresearch/hermes-4-70b" }`, `behavior: { verbosity: 0.45, filler_rate: 0.3, interruption_rate: 0.5, backchannel_rate: 0.5 }`, `guards: { style: false }`, a FULL Personality Print v4 with `contrast` entries vs all three others and each of THEIR `contrast` blocks extended with `vs_dwayne` (distinctness is a contract — write the contrast cards), `catchphrase_rare`, `show_memory: "lab/cast/memory/champagne-dwayne.json"`, voice block (engine breeze, `seed` new, `aesthetic`: "smooth, silky mid-thirties Black American man, laid-back champagne-lounge baritone, playful and sing-song when he's amused, a little flashy, unbothered, close-mic late-night radio warmth", `ref_text`, `default_instruction`, `emotion_map`, `nonverbal_habits`). Bump the top-level `version` to 4.
- Modify: `lab/engine/run_floor.mjs` — (1) `const PROVIDER = ARG.provider || 'openrouter'` (was `'ollama'`); (2) `ADDRESS_ENUM` is rebuilt from participants already — confirm Dwayne flows; (3) wrap the STYLE guards at lines ~191-222 (anaphora, end-name tic, catchphrase law, exemplar/jaccard repeat) in `if (styleGuards(hostId))` where `styleGuards = id => hosts[id]?.guards?.style !== false`; the numeric-hallucination guard (line ~202-206) stays unconditional; the MIX verbatim rejection (line ~357) stays.
- `lab/engine/make_show.mjs` ALREADY defaults `provider` to `openrouter` (line 38) and passes it to run_floor — do NOT edit make_show in this workstream; only run_floor's standalone default (`ARG.provider || 'ollama'`) flips.
- Modify: `lab/engine/render_breeze.mjs` and `lab/engine/render_kokoro.mjs` — EVEN AUDIO: before `concatToMp3`, measure each SPEAKER's integrated loudness across all their parts (`ffmpeg -af ebur128=peak=true -f null -` parse `I:` LUFS), compute one gain per speaker to hit `-16 LUFS`, apply it per part (`-af volume=<gain>dB`), then concat, then a final `loudnorm=I=-16:TP=-1.5:LRA=11` on the full mix (two-pass measured, `print_format=json`). Per-speaker gain (not per-line) keeps a whisper a whisper. Write the per-speaker before/after LUFS into the show's `audio.log`.
- Create: `lab/cast/voices/candidates/` — via `render_breeze.mjs` DESIGN path (CFG 4.0): `blaze-A/B/C.wav`, `knowledge-A/B/C.wav`, `dwayne-A/B/C.wav`. Each candidate says a SLATE then a character line: "Candidate Blaze B. <one of his signature lines>". Aesthetics: Blaze — three real directions (a: live sports-radio drive-time host, less cartoon boom; b: younger, faster, Atlanta; c: big but warm, church-organ chest); Knowledge — (a: warmer elder, less movie-trailer; b: lighter, quicker, a barber who reads; c: deep but conversational, no gravel); Dwayne — (a: silk lounge; b: playful high-energy flash; c: low late-night). Also `lab/cast/voices/candidates/LINEUP.mp3`: all nine in a row with 0.6s gaps, loudness-leveled by the new code. Set each host's `voice.candidate_default` to `A` so shows run before Robert picks; the existing `blaze.wav`/`knowledge.wav` remain until he picks (then the picked candidate is copied over the ref and the manifest row updated).
- Modify: `lab/engine/AUDIO_MANIFEST.md` — rows for every candidate + LINEUP.
- Modify: `lab/models.json` — add a `"lineup_2026_09_02"` block mirroring the table in Decisions §8.

**Steps:**
- [ ] Load `breeze-tts-2` + `personality-print`; read cast.json, PERSONALITY_PRINT.md, run_floor.mjs (whole guard section 185-250 and the provider block 29-101), render_breeze.mjs (whole), make_show.mjs.
- [ ] cast.json edits (validate with `node -e "JSON.parse(require('fs').readFileSync('lab/cast/cast.json','utf8'))"`).
- [ ] run_floor guards + provider; make_show provider. Dry-run the floor on the newest compiled beat card in `lab/shows/tay-roc-battle-rapper*/` with `--provider=openrouter` and confirm every host (incl. Dwayne if seated) gets turns and `meta.json.models` shows the lineup.
- [ ] Leveling in both renderers; render the LINEUP; verify with `ffmpeg -i LINEUP.mp3 -af ebur128 -f null -` that per-candidate integrated loudness is within ±1 LU of -16.
- [ ] Candidates rendered; manifest rows; `SendUserFile` LINEUP.mp3 to Robert with a caption listing A/B/C per host.
- [ ] Commit: `git -C /d/git/talkshowgo add -A lab/cast lab/engine/run_floor.mjs lab/engine/render_breeze.mjs lab/engine/render_kokoro.mjs lab/engine/make_show.mjs lab/models.json lab/engine/AUDIO_MANIFEST.md && git -C /d/git/talkshowgo commit -m "cast: Champagne Dwayne, voice candidates for Blaze/Knowledge, per-host style guards, even audio (per-speaker LUFS), OpenRouter lineup"`

**Verification:** `node lab/engine/run_floor.mjs --beat=<card> --out=<dir>` uses openrouter with no flag; `audio.log` shows per-speaker LUFS before/after; LINEUP.mp3 exists and is level.

---

## WS-5 — Sports beats: Atlanta Falcons, Indiana Pacers, people on every beat

**Plain language:** Two real teams beside Orangeburg. Football is in season (Falcons content is live); the NBA is in its off-season (Pacers content is trades/injuries/preseason — exactly the "even at the end of the season" case). Every beat gets its designated people.

**Files:**
- Create: `lab/beats/atlanta-falcons.json` and `lab/beats/indiana-pacers.json` from `lab/beats/sports-team-template.json`. Show blocks: Falcons `THE HUDDLE` (tagline from the template), Pacers `THE FIELDHOUSE` ("Your Pacers, every day, like you were courtside"). `timespan_hours: 24`, `show_type: "moderated-collision"`. `cases[]`: Falcons `season-arc` filled (2026 season, the QB situation, the division); Pacers `offseason-arc` (trades, injuries, preseason, the East). Sources: seed the obvious ones and VERIFY every X handle through `POST /api/command/verify` (it stores `userId`; handles rot — a handle that does not verify is written `NOT FOUND <date> - needs a human`, never assumed): Falcons — official team X + YouTube, the Atlanta Journal-Constitution Falcons writer, The Athletic's Falcons writer, 92.9 The Game (radio), 1-2 Falcons creators; Pacers — official X + YouTube, the Indianapolis Star Pacers writer, Fieldhouse Files / Tony East, 107.5 The Fan, 1-2 Pacers creators. YouTube channels resolve via `POST /api/command/youtube {file, action:'resolve'}`. Scout (WS-6 may be mid-edit; call it with `{auto:false}` and treat a failure as "skip enrichment") for 72h suggestions on "Atlanta Falcons" / "Indiana Pacers". RSS: Google News RSS per team (from the template).
- Modify: `lab/beats/orangeburg-sc.json`, `lab/beats/hood.json`, `lab/beats/battle-rap.json` — add `people[]` per the contract (re-read each file right before writing; WS-3 and Scout write beats too): Orangeburg → one person `{ name: "Neighbor", relation: "local" }`; Falcons → two `{ name: "Dad", relation: "father" }`, `{ name: "Son", relation: "son" }`; Pacers → one `{ name: "Pacers Fan", relation: "fan" }`; battle-rap → `{ name: "Robert", relation: "owner" }`; hood → `{ name: "The Block", relation: "local" }`. Tokens via the same generator WS-3 ships (`newToken()` in `src/lib/command/people.ts`; if not landed yet, generate 16-char `[a-z0-9]` with `crypto.randomBytes` — identical output shape).
- Run: `POST /api/command/process` (the pull) for both new beats with `{hours: 72}` and confirm items return; then CLUSTER + LEADS + RANK via the DISCOVERY endpoints so DATAFLOW lights up for a sports beat.

**Steps:**
- [ ] Read the template, battle-rap.json (the verified shape), `src/app/api/command/verify/route.ts`, `src/app/api/command/process/route.ts`.
- [ ] Write both beats; verify handles; resolve channels; pull; cluster/leads/rank.
- [ ] Add `people[]` to the three existing beats.
- [ ] Commit: `git -C /d/git/talkshowgo add lab/beats && git -C /d/git/talkshowgo commit -m "beats: Atlanta Falcons (THE HUDDLE) + Indiana Pacers (THE FIELDHOUSE), verified sources, people on every beat"`

**Verification:** `curl -s localhost:<port>/api/command/dataflow?beat=atlanta-falcons` shows PULL count > 0 and at least one cluster.

---

## WS-6 — Scout suggests (human verifies), EXPLORE mode, and THE JANITOR

**Plain language:** Scout stops adding channels on its own. It shows what clears the bar with the reason, and a human clicks ADD or DISMISS. It also goes looking at channels it has never used. And a Janitor walks every beat on demand (later on a schedule): each "position" makes decisions — flag the squatter, retire the dead source, repair the broken id, propose a wider window, prune old runs — writing a report where the safe ones are applied and the rest wait for one click.

**Files:**
- Modify: `src/app/api/command/scout/route.ts` — `auto` defaults to FALSE (line 146). Every candidate that clears `autoPick` is returned in `suggested[]` with a `reason`; `auto_added` only when `{auto:true}` is sent explicitly. Persist dismissals in `lab/scout/dismissed_<beat>.json` and never re-suggest a dismissed id. `POST {explore:true}` — search topics the beat has never scouted: `beat.cases[].title`, `show.name`, and the top 3 cluster titles from the newest `clusters_*<beat>.json`, over `hours: 168`, EXCLUDING every channel already in the beat and every id in `lab/scout/seen_<beat>.json` (append every suggested id there); return `explored: [{ topic, suggested[] }]`.
- Modify: `src/app/command/sources/page.tsx` (the Scout panel) — a SUGGESTED section (reason, `in_window`, ADD / DISMISS per row; ADD uses the existing manual-add helper), an EXPLORE button, and the AUTO-ADD toggle relabeled "AUTO-ADD (no review)" defaulting OFF (the persisted toggle value must be migrated: if it was on, keep it on — Robert flipped it on last round — but the DEFAULT for a fresh install is off).
- Create: `src/lib/command/janitor.ts` — positions, each `(beat, ctx) => { findings, proposals }`: `source_auditor` (per source from the last 5 pulls: last item date, rung, consecutive empties → `healthy | quiet_7d | dead_30d | broken_id`; `broken_id` → proposal `repair_id` `auto:true` using the pull's re-resolve helper in `yt.ts`; `dead_30d` → `retire_source` `auto:false`), `squatter_watch` (X sources whose `followers` < 100 while `type` is league/media, or whose display_name is far from the label → `flag_suspect` `auto:true` sets `status: 'SUSPECT ...'` on the source), `scout_explore` (calls the explore mode → `add_channel` proposals `auto:false`), `window_tuner` (if the last 3 pulls averaged < 5 items → `widen_window` to the next step 24→48→72 `auto:false`), `housekeeper` (`prune_runs`: `lab/runs/*` older than 14 days not referenced by a show → `auto:true`; rotate `lab/logs/activity.jsonl` at 20MB → `auto:true`). `runJanitor(beatId, { apply: 'auto' })` writes `lab/janitor/<beat>/<ts>.json`, applies `auto:true` proposals, logs each decision `kind:'janitor'` with `position` in meta. `applyProposal(beat, proposalId)` for the pending ones.
- Create: `src/app/api/command/janitor/route.ts` — `POST {beat}` run; `POST {beat, apply: proposal_id}` apply; `GET ?beat=` latest report.
- Create: `src/app/command/janitor/page.tsx` (+ nav) — per beat: RUN, the latest report grouped by position, applied (green) vs pending (one-click APPLY / DISMISS), a history list. Also a small JANITOR card on the DESK (`src/app/command/page.tsx`) showing pending proposals count.
- Modify: `.gitignore` — `lab/janitor/`, `lab/scout/`.

**Steps:**
- [ ] Read scout route (whole), scout.ts, sources page, `yt.ts` (the re-resolve helper), the pull route, the newest pulls' shapes, `log.ts`.
- [ ] Scout flip + dismissals + explore; verify on battle-rap: `curl -X POST .../api/command/scout -d '{"topic":"Summer Madness","beat_file":"battle-rap.json","hours":48}'` returns `suggested[]` and `auto_added: []`.
- [ ] Janitor lib + route + page + DESK card; run it on battle-rap — it MUST flag `HipHopIsReal` on X (4 followers, labeled media) as SUSPECT and propose repair/retire for the `NOT FOUND` X handles.
- [ ] Commit: `git -C /d/git/talkshowgo add -A src/app/api/command/scout src/app/command/sources src/lib/command/janitor.ts src/app/api/command/janitor src/app/command/janitor src/app/command/page.tsx <nav> .gitignore && git -C /d/git/talkshowgo commit -m "scout: suggest + verify (auto opt-in), EXPLORE mode; the JANITOR (source auditor, squatter watch, window tuner, housekeeper)"`

**Verification:** the janitor report for battle-rap contains a `flag_suspect` proposal targeting `twitter:HipHopIsReal` with `status: 'applied'`, and `retire_source` proposals (pending) for `RBE_studios` and `AngryFan007`.

---

## WS-7 — Settings: API keys and the model lineup, in the app (distributable)

**Plain language:** Everything the app talks to gets a card: is the key set, does it work (one click), and you can paste a new one — saved to a private file, never to git, and env vars still win. A MODELS card shows exactly which model every role is running on and lets you change it. This is what makes TalkShowGo something another person can install.

**Files:**
- Create: `src/lib/command/keys.ts` — `KEYS` registry (name, label, service, how to verify, optional?) for every entry in the keys contract; `getKey(name)` = `process.env[name] ?? settings[name]`; `loadSettings()` / `saveKey(name, value)` writing `lab/settings/keys.json` (mode 0600 where the OS allows); `verifyKey(name)` per service: OpenRouter `GET /api/v1/auth/key`; twitterapi.io `user/info?userName=urltv`; Perplexity a 1-token `sonar` call; cupcake gateway health (endpoint from the `breeze-tts-2`/`cupcake` skill); Twilio `GET /2010-04-01/Accounts/{sid}.json`; ElevenLabs `GET /v1/user`; Resend `GET /domains`; AssemblyAI `GET /v2/transcript?limit=1`; `YTDLP_PATH`/`FFMPEG_PATH` = `--version` runs. Responses NEVER echo a key; the UI shows `sk-or-…85f` style masks only.
- Create: `src/instrumentation.ts` — `register()` hydrates `process.env` from `lab/settings/keys.json` for any var not already set (Next 14: enable `experimental.instrumentationHook` in `next.config.*`). This is how every existing `process.env.X` read picks up in-app keys with zero edits elsewhere.
- Modify: `lab/engine/run_floor.mjs` `readEnvKey` (and any twin in `render_breeze.mjs` / `make_show.mjs` — grep `readEnvKey|\.env`) — fall back to `lab/settings/keys.json`.
- Create: `src/lib/command/models-config.ts` — `modelFor(role): { provider, id }` reading `lab/settings/models.json` with defaults = Decisions §8; roles: `showrunner`, `host:<id>`, `stt`, `followups`, `parser`, `leads`, `rank`, `floor_provider`. Wire it into the four cheapest call sites WITHOUT conflicting with other agents' files: `stt.ts` (STT_MODEL), the interview route's `FOLLOWUP_MODEL`, `stringer.ts` parser default, `leads.ts` miner model — read each file immediately before editing (WS-2 edits stringer.ts; WS-3 moves the follow-ups). The floor/producer read cast.json directly — leave that, but the MODELS card shows cast.json's values as read-only "set in cast.json".
- Create: `src/app/api/command/settings/route.ts` — `GET` (status of every key: set/missing, source env|settings, masked tail, last verify result), `POST {name, value}` save (verify first; refuse to save a key that fails verification unless `{force:true}`), `POST {name, verify:true}`, `DELETE {name}`; models: `GET ?models=1`, `POST {role, provider, id}`.
- Create: `src/app/command/settings/page.tsx` (+ nav SETTINGS): KEYS card grid (service logo-less, label, status pill, masked value, VERIFY, EDIT → modal with a password field, SAVE), a MODELS card (role → dropdown of `lab/models.json` roster + custom, cost/turn hint, provider), and a "distributable checklist" strip: which keys are required for which features (pull needs twitterapi.io; shows need OpenRouter + cupcake or a hosted Breeze plan; phone needs Twilio; email needs Resend).
- Harvest only patterns from the legacy `src/lib/api-keys.ts` and `src/app/settings/api-keys/page.tsx` (verify calls); do not import them (they are DB-backed legacy — parked).
- Modify: `.gitignore` — `lab/settings/`.

**Steps:**
- [ ] Read the legacy api-keys files (harvest), `next.config.*`, `run_floor.mjs:29-58` (readEnvKey), `stt.ts`, `leads.ts` model constant.
- [ ] keys.ts + instrumentation + settings route + page + nav; verify OpenRouter/twitterapi.io/Perplexity/cupcake from the UI (they are set in `.env`).
- [ ] models-config + the four call sites (re-read before each edit) + MODELS card.
- [ ] Commit: `git -C /d/git/talkshowgo add -A src/lib/command/keys.ts src/lib/command/models-config.ts src/instrumentation.ts next.config.* src/app/api/command/settings src/app/command/settings <nav> lab/engine/*.mjs src/lib/command/stt.ts src/lib/command/leads.ts .gitignore && git -C /d/git/talkshowgo commit -m "settings: in-app API keys (verify + save, env wins) and the model lineup per role; distributable-ready"`

**Verification:** `curl -s localhost:<port>/api/command/settings` lists every key with `set:true` for the four in `.env`, none echoing a value; the MODELS card shows the lineup from Decisions §8.

---

## Phase 2 (after Phase 1 lands; sequenced because they touch Phase-1 files)

### WS-8 — The X social card on the show, and hosts that KNOW
- Read what `discovery` already renders for X posts (commit 95a3940) and build `src/components/command/SocialCard.tsx` (avatar, display name, @handle, text, media, timestamp, engagement, permalink, X mark — per X display requirements; never a mock of a post that does not exist). Use it in DISCOVERY and on TAPE.
- READ-vs-SHOW: a quoted post in a script line gets `[EXHIBIT x_<post_id>]` (stripped before voicing, like evidence ids); the format decides `read | show | both` (`lab/formats.json` gets a `quotes_mode` field per format: THE DESK reads, THE PANEL shows); TAPE renders the card at that line's audio time.
- Host knowledge audit: trace `briefAgents` → `compile_beat` allowed evidence → `run_floor` receipts and make sure each host holds, per claim, WHO said it, WHERE (permalink / `video_id@mm:ss` from WS-2), WHEN, and the quote — so a host can say "at the thirteen-minute mark of the Vlad interview" and never be vague. The provenance GRAPH view stays a roadmap item (Robert: "not mainly for me to see visually").

### WS-9 — The real shows on the new lineup (audio-first deliverables)
- Run the Algorithm Institute of Battle Rap 48h desk end to end (pull → cluster → rank → BUILD THIS SHOW) with the full cast + leveling → mp3 to Robert. It must be the multi-host desk, not one voice.
- Same for Hood History Club (the lil-durk case is a standing case). Same for THE HUDDLE with the father-son takes seated.

### WS-10 — Real capture adapters (harvest map from the 2026-09-02 cross-repo scan)
Nothing in `D:/git` is a public no-login record page or a working inbound-email webhook — those are built here (WS-3 builds the page). Everything else can be lifted:
- **Phone, simplest:** `D:/git/hey-its-my-contractor/packages/web/src/app/api/make-call/route.ts` (COPY) — a ~90-line Next route: `twilio` SDK `calls.create({to, from, twiml})`, auth gate + rate limit. Env: `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER`. Add a `<Record>` verb + recording-status callback (no repo has one) → the recording URL → the take intake by the person's token.
- **Phone, the interview agent:** ElevenLabs Conversational AI with a Twilio number imported in the ElevenLabs dashboard (no TwiML): `conversational_ai.twilio.outbound_call(agent_id, agent_phone_number_id, to_number)` then `conversations.get(id)` for the full transcript (+ the conversation audio endpoint for the clone sample). Exact call signatures: `D:/git/machinekinglabs/officer-system/elevenlabs-mcp/elevenlabs_mcp/server.py` (REFERENCE-ONLY). Per-beat interviewer agents built the way `D:/git/yourehired/app/api/create-agent/route.ts` does (ADAPT). Architecture + cost notes: `D:/git/machinekinglabs/docs/aligned-dc-voice-ai-options.md`.
- **Live browser interview (no phone):** `D:/git/housesmith/camp-planning-dashboard/app/api/assistant/signed-url/route.ts` + `components/assistant/assistant-panel.tsx` (COPY, ~50 lines): `get_signed_url` + `@elevenlabs/react` `useConversation` — an agent interviews the person on the take page itself.
- **Full Twilio media-stream stack (if we ever self-host the agent):** `D:/git/clawdbot/extensions/voice-call/` (ADAPT): providers, signature verification, `<Connect><Stream>` WebSocket handler, `waitForFinalTranscript()`.
- **Email:** only design exists — `D:/git/hey-its-my-contractor/docs/image-and-email-plan.md` (Mailgun inbound route spec with signature verification + attachment filing); the one running inbound loop (`D:/git/machinekinglabs/officer-system/presidium_email_command_router.py`, IMAP poll + dedupe + reply) ignores attachments. Build: a Resend/Mailgun inbound webhook → voice-memo attachment or body text → the take intake.
- **Word-level timestamps on a take** (for cutting to the beat): `D:/git/aiobr/scripts/whisper-timestamps.js` (Replicate incredibly-fast-whisper, `{words:[{word,start,end}], sentences}`) or `D:/git/directors-desktop/backend/handlers/transcription_handler.py` (adds hallucination filtering); the method is the `word-level-timestamps` skill.
- **Timestamped YouTube captions, cleaner than VTT:** `D:/git/aiobr/scripts/youtube-transcript.mjs` — yt-dlp `--sub-format srv1` with a 3-strategy fallback and an XML cue parser (`{offset, duration, text}`); handed to WS-2 as the preferred path with VTT as fallback.
- Then `coach-feature` on the take-link flow.

---

## Self-review (done while writing)
- Spec coverage: every ask in the 2026-09-02 voice note maps to a workstream (DATAFLOW→WS-1; delegates/word-for-word/father-son/record-page/phone/email/simulation/setup→WS-3; host voices/leveling/Dwayne/guardrails/models→WS-4; Falcons/Pacers/people→WS-5; Scout suggest/verify/explore/janitor→WS-6; API keys/distributable→WS-7; X card/hosts-know→WS-8; battle rap not one voice + hood dope→WS-9; YouTube transcript/timestamps/snippets/display→WS-2).
- Placeholder scan: no TBDs; each workstream names its files, contracts, commands.
- Type consistency: `people[]`, take json, `guards.style`, settings files, transcript `segments`, scout `suggested[]`, janitor report are defined once above and referenced by name everywhere.
