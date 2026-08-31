# Dialogue Engine Loop — Delivery (2026-08-31)

You said: improve the platform, find free ways to test, /loop until the written dialogue is right. Here's what 10 iterations bought, straight.

## What got built (all committed on `revival`, all free to run)
A real dialogue engine at `lab/engine/` — not prompts, MACHINERY:
- **run_floor.mjs** — every turn is one model call carrying ONE host's locked bundle + only ITS evidence. A director layer drives momentum: waypoints (progression notes at word thresholds), a withheld receipt that detonates mid-argument, a forced reaction beat, KK's hold-then-drop. A guard stack rejects bad drafts before they land: spoken evidence-ids, invented numbers, another host's catchphrase, ending every line with the opponent's name, exemplar recitals, beaten-to-death phrases. Then a messiness pass.
- **fingerprint.mjs** — "sounds real" as numbers: turn-length unevenness, interruptions, micro-turns, word share, tics. Exit code is a gate.
- **A judge that isn't me** — Codex scores naturalness / persona distinctness / heat / evidence integrity with a blind who-said-this test.
- **RUNLOG.md** — every run, every diagnosis, every fix. 10 runs deep.

## What the testing proved
- **Texture is SOLVED.** Fingerprint went 3/7 → 7/7 (run_007) on your own hardware at $0/episode. Uneven turns, interruptions, backchannels, balanced floor — the engine produces all of it on demand.
- **The words plateau at "half-good."** Judge: 3.45 (run_007), 3.25 (run_009) vs the 8.0 bar. The failures are all one family: qwen3:30b (the free 30B on cupcake) drifts referents, invents small details (a "clutching hand" that's in no evidence), misattributes quotes (put @miettah's cps line in @ritabonnita's mouth), dodges fact-guards by rephrasing, and loops metaphors. I proved the guard stack is on a Pareto frontier: tighten it and the model can't finish a sentence (run_008's rejection storms); loosen it and the tennis comes back.
- **Read the good stretches** — they show what the architecture does when the model keeps up: run_008 turns 1–16 (the "walk me through the alternative" beat, Tasha's "I'd do it too, but that's why the bounty's real"), run_009's double concession, KK's "The child said 'You'... not 'dad'. Two years old. Grace was never the problem. The audience is."

## The honest conclusion
**The engine is right and the writer inside it is too small.** Same harness + a stronger conversationalist is the whole remaining move for the words.

## The one decision (yours)
Unlock ONE ceiling, then I rerun the same loop:
1. **Requesty top-up** (~$5 = many episodes). The engine's cloud path is already built and tested — it 402'd only on empty balance. Run: `node lab/engine/run_floor.mjs --beat=... --provider=requesty`
2. **Hermes-4-70B on cupcake, free** — it's installed but the render engines hold the VRAM (OOM'd twice, 150s load timeout). A night window or briefly parking the video engines frees it.
3. **Mac Mini back reachable** (timed out all session) — weakest option (9B), listed for completeness.

## Also on your plate from this session
- **Rotate the twitterapi.io key** (public GitHub since December).
- Voice layer decision can wait — but when we get there, remember the two-layer law in `lab/CONVO_ENGINE.md`: the renderer must speak the whole conversation (Gemini multi-speaker TTS is already in your toolchain; MOSS-TTSD is the free local candidate).
