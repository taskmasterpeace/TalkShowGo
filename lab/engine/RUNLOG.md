# CONVO ENGINE RUN LOG
Loop mandate (Robert, 2026-08-31): iterate the WRITTEN DIALOGUE until it's right. Free compute: cupcake Ollama (Hermes-4-70B + qwen3:30b). Judge: Codex (independent), rubric below. Gate: judge avg >= 8/10 AND fingerprint PASS, two consecutive runs. Hard stop: 10 iterations, deliver best + gap analysis.

## Judge rubric (Codex, per run)
1. Naturalness /10 — does it read like recorded talk, not writing?
2. Persona distinctness /10 — blind who-said-this on 6 sampled lines (score = correct×10/6)
3. Heat /10 — real disagreement, stakes, momentum; validation-loops score low
4. Evidence integrity /10 — every factual claim tagged, no invented facts vs evidence.json
5. Fake-tells — list any: catchphrase tics, even turn-taking, constant validation, summary-speak

## Fingerprint targets
turn-length cv >= 0.65 | interruptions >= 2 | micro-turns >= 3 | max share <= 0.55 | em-dash 0 | quotes <= 6 | ev tags >= 4

## Iterations
| # | run | provider/models | change made | fingerprint | judge | verdict | next |
|---|-----|----------------|-------------|-------------|-------|---------|------|
| 0 | run_000 | ollama all-qwen3:30b (hermes70b OOM: render engines hold cupcake VRAM) | engine built + transient-retry + /no_think + format:json | FAIL: cv 0.51, blaze share 0.62, 1 em-dash; 20 turns, 135w (MIX over-compressed from ~236w); PASS: interruptions 7, micro-turns 4, ev tags 12 | not judged (quality visibly below bar) | argument LOOPS (exemplars recited verbatim 3-4x), detonation limp + no reaction beat, KK drop wasted on signature line, JSON double-wrap leaked into 4 turns | iter 1: anti-repeat + parse fix + detonation payload/react + KK-drop hardening + MIX keep-length + per-host word caps |
| 1 | run_001 | ollama all-qwen3:30b | anti-repeat block (already-said lines injected), double-JSON unwrap, detonation carries verbatim receipt + forced Blaze react turn, KK drop new-words-only @turn13, MIX keep-every-turn ±10%, word cap = f(verbosity), max_turns 24 | FAIL: cv 0.59, blaze 0.61, ev tags 0 (ids got SPOKEN: "E6's the bounty"), "em-dash" was our own md header; better: 282w, no JSON leaks, 3 interruptions | not judged | four structural bugs: ids spoken aloud, previous-speaker line echoed as opener, backchannels reset allocator's last-speaker (same-speaker doubles + identical dupes), KK recited exemplar for his drop | iter 2: ids only in evidence array + spoken-id reject/scrub + tags appended at render, echo/recital jaccard guard w/ one retry, allocator skips backchannels + damps floor-hogs (>0.45 share), consecutive-turn merge, plain-hyphen headers |
| 2 | run_002 | ollama all-qwen3:30b | iter-2 fixes above | 6/7 PASS (cv 1.01, ev tags 23, em-dash 0); FAIL blaze share 0.56 (hair over; exit-turn merged onto his own last turn) | not judged | texture fixed but MEANING collapsed: "clip vs VOD" meta-nonsense spiral, hosts attacked KK's backchannel "Whew" as a take, one hallucinated fact ("kid's dad was in the clip"), retry guard accepted unvalidated retries (KK recitals snuck back through) | iter 3: bc turns hidden from model context, per-turn question+stance re-injection, anti-meta ban, 3-attempt validation (attempt 3 strips exemplars), code-level word-cap truncation, noMerge on scripted turns, blaze verbosity 0.65, damp at 0.40 |
| 3 | run_003 | ollama all-qwen3:30b | iter-3 fixes above | (running) | judge scheduled this iter regardless of fingerprint | — | — |
