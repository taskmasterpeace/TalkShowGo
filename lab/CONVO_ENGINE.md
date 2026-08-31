# CONVO ENGINE — how the show stops sounding written
Design locked 2026-08-31 from two research sweeps (archived: `lab/research/conversational_ai_landscape.md` + `lab/research/dialogue_realism_techniques.md`).

## The two-layer law
Realism lives in BOTH layers, and each has a cheap proven fix:
- **Script layer carries most of it** (MoonCast ablation: real script stripped of disfluencies drops MOS 4.73 -> 3.21; injected fillers/repetitions/informal grammar recover 4.03). Fix: actor-loop drafting + a "make it messier" texture pass.
- **Audio layer performs it** (NotebookLM's breaths/overlaps/laughter are in the audio model, not the words). Fix: a DIALOGUE-NATIVE renderer that speaks the whole conversation as one performance. Per-line single-voice TTS cannot overlap two hosts; it is for narration, not conversation.

## The pipeline (PREP -> BEATS -> FLOOR -> MIX -> MASTER -> SCORECARD)
1. **PREP** — evidence pack per show (already built; tiers + discourse lanes).
2. **BEATS** — The Showrunner writes a conflict-designed beat sheet, NEVER dialogue. Two NotebookLM design rules are law: **engineer disagreement** (too much agreement is boring) and **withhold information** (hosts get different evidence subsets so reveals land live on the floor).
3. **FLOOR** — the actor loop. Each turn = one cheap LLM call carrying ONE host's full locked bundle + conversation so far + that host's evidence subset. Per-host calls structurally reset persona drift every turn (single-pass cannot). ~100-150 calls, $1-3/episode.
   - **Turn allocator** (from the Murder-Mystery-agents pattern, ~8x fewer breakdowns than round-robin): adjacency pair first (you were addressed -> you respond); otherwise every host BIDS an importance score; stance-conflict biases the bid (heat-seeking floor); **losing mid-range bids emit backchannels** ("mm," "right right") instead of turns.
4. **MIX** — the texture pass (one cheap LLM pass over the transcript): inject fillers/false starts/self-corrections, truncate lines and mark the next speaker `[interrupting]`/`[overlapping]`, informal grammar, uneven turn lengths, callbacks. Evidence tags survive untouched.
5. **MASTER** — render with a dialogue-native engine:
   | Renderer | Cost | Status |
   |---|---|---|
   | Gemini multi-speaker TTS (`gemini-fast-tts` skill) | cheap API | ALREADY IN TOOLCHAIN — first candidate to test |
   | ElevenLabs v3 Text-to-Dialogue (`[interrupting]`/`[laughs]` native) | paid, premium | quality ceiling; A/B against Gemini |
   | MOSS-TTSD v1.0 (Apache-2.0, 1-5 speakers, 60 min, real overlap) | free, LOCAL | evaluate on cupcake; if it takes reference-voice conditioning we keep locked cloned voices AND get overlap |
   | Microsoft VibeVoice (90 min / 4 speakers) | free, local | second local candidate |
   | cupcake breeze-clone (per-line) | free | STAYS for single-voice narration formats + fallback; not for multi-host conversation |
6. **SCORECARD** — texture fingerprint per episode: turn-length distribution (must be uneven), interruption + backchannel rates, blind "who said this?" attribution test across hosts, LLM-judge rubric vs real-podcast reference (PodEval pattern). Robert's ear is the release gate.

## Persona law v2 (what the research changed)
- **Thin bio + thick exemplars.** ≤150-word behavioral core; 8-12 verbatim signature lines + 2-4 example EXCHANGES per host (models over-recite fat bios; they imitate exemplars).
- **Behavior knobs** per host: verbosity, filler rate, interruption rate, backchannel rate (Behavior-SD pattern) — these drive the allocator and MIX.
- **Catchphrases are a FAKE-TELL** (reviewers flag tics, constant validation, even turn-taking). Demoted to rare seasoning: max 1 per episode per host.
- **Show memory** per host (`lab/cast/memory/<id>.json`): running bits, callbacks, past verdicts — loaded into the bundle every episode so the cast feels persistent.
- Per-host fine-tunes/LoRAs: NOT yet; revisit after ~50 approved episodes of training data.

## Build order (audible impact per day of work)
1. MIX texture pass (biggest jump, one prompt) -> 2. FLOOR actor loop + allocator -> 3. MASTER renderer bake-off (Gemini vs MOSS-TTSD-on-cupcake vs ElevenLabs v3) -> 4. exemplar packs + show memory -> 5. SCORECARD automation.
