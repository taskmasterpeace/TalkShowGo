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
| 0 | (pending) | ollama: hermes70b (tasha) + qwen3:30b (blaze/kk/mix) | engine built: FLOOR (per-host actor calls, allocator w/ forced detonation + kk-drop + backchannels) + MIX pass | — | — | — | baseline run |
