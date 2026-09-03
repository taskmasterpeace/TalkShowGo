# TalkShowGo Pipeline Inventory

The authoritative, file-traced map of the pipeline. It is the text source of truth behind
`lab/atlas.html` (the visual "How TalkShowGo Works" page). Regenerate the Atlas from this file;
keep this file honest against the code.

Cost key: FREE = runs on our own machines (SearXNG, Mac Mini Ollama, cupcake, self-hosted Breeze).
PAID = an outside API (twitterapi.io, OpenRouter, Perplexity). "Utility" cloud calls default to
`google/gemini-2.5-flash-lite` on OpenRouter (pennies).

## The 8 live stages (dataflow order)

| # | Stage | What it does | In &rarr; Out | Model | Cost |
|---|-------|--------------|---------|-------|------|
| 01 | PULL | Sweep a show's X handles + YouTube channels inside the window | show sources &rarr; `lab/runs/pull_*.json` | none | X = PAID (twitterapi.io); YouTube = FREE |
| 02 | CLUSTER | Group items by the same EVENT (fingerprint), not the same topic | `pull_*.json` &rarr; `clusters_*.json` | gemini-2.5-flash-lite (OpenRouter); free topic-miner alt on cupcake qwen3:30b | PAID (or FREE alt) |
| 03 | LEADS | Extract scored research leads, route + query each | `pull_*.json` &rarr; `leads_*.json` | gemini-2.5-flash-lite | PAID |
| 04 | RANK | Producer scores stories for SHOW VALUE (conflict weighted highest) | `clusters_*.json` &rarr; `producer_*.json` | gemini-2.5-flash-lite | PAID |
| 05 | DOSSIERS (Stringer) | Expand a lead into a cited evidence file; server fills every citation | a lead &rarr; `lab/research/stringer/str_*.json` | Mac Mini qwen3.5 FIRST, OpenRouter fallback; SearXNG web; twitterapi.io for X | FREE-first (PAID fallback / X) |
| 06 | BRIEFINGS | Evidence &rarr; impartial "one move at a time" walk to the question | `str_*.json` &rarr; `lab/briefings/brf_*.json` | gemini-2.5-flash-lite | PAID |
| 07 | STANCES | Each host takes a side under closed-evidence law | `brf_*.json` + `cast.json` &rarr; `brf_*.agents.json` | per-host DNA (mostly OpenRouter; cupcake for house-engine hosts) | PAID (some FREE) |
| 08 | SHOWS | Director engineers disagreement &rarr; floor argues &rarr; mix &rarr; Breeze voices | `brf_*.agents.json` &rarr; `lab/shows/<slug>/<slug>.mp3` | writing = gemini + host DNA; voice = Breeze (self-hosted) | writing PAID; voice FREE |

## Prompt index (name &middot; file:line &middot; model)

1. Evidence miner (PARSE_SYS) &middot; `src/lib/command/stringer.ts:99` &middot; Mac Mini qwen3.5 &rarr; gemini fallback
2. Web synthesis, paid (WEB_SYS) &middot; `src/lib/command/openrouter-web.ts:7` &middot; gemini web-plugin &rarr; perplexity/sonar
3. Web synthesis, free (WEB_SYS) &middot; `src/lib/command/searxng-web.ts:12` &middot; optional local, else raw snippet digest
4. STT (transcribe a delegate's take) &middot; `src/lib/command/stt.ts:16` &middot; gemini-2.5-flash
5. Topic miner &middot; `src/app/api/command/topics/route.ts:115` &middot; cupcake qwen3:30b (FREE)
6. Story clustering engine &middot; `src/lib/command/fingerprint.ts:17` &middot; gemini-2.5-flash-lite
7. Research lead extractor &middot; `src/lib/command/leads.ts:24` &middot; gemini-2.5-flash-lite
8. Executive producer (rank) &middot; `src/lib/command/producer.ts:47` &middot; gemini-2.5-flash-lite
9. The briefing &middot; `src/lib/command/briefing.ts:12` &middot; gemini-2.5-flash-lite
10. Host stance (Personality Print + RULES) &middot; `src/lib/command/agent-brief.ts:71,83` &middot; host DNA
11. Delegate stance &middot; `src/lib/command/agent-brief.ts:94` &middot; delegate DNA &rarr; gemini
12. Delegate interview questions &middot; `src/lib/command/agent-brief.ts:170` &middot; gemini-2.5-flash-lite
13. Take-link prompts (person on a beat) &middot; `src/lib/command/prompts.ts:109` &middot; gemini-2.5-flash-lite
14. Follow-ups (tappable choices) &middot; `src/lib/command/followups.ts:71` &middot; gemini-2.5-flash-lite
15. The showrunner / director &middot; `lab/engine/compile_beat.mjs:36` &middot; gemini-2.5-flash-lite
16. The floor (per-host turn, hostSystem) &middot; `lab/engine/run_floor.mjs:120` &middot; host DNA
17. The mix (messiness pass) &middot; `lab/engine/run_floor.mjs:372` &middot; gemini-2.5-flash-lite / cupcake
18. Guest personality generator (Print v4) &middot; `src/app/api/command/personality/route.ts:20` &middot; cupcake qwen3:30b (FREE)

## Two honest notes

- **The show engine requires >= 2 house hosts** (`lab/engine/compile_beat.mjs:84` exits; `showbuild/route.ts:74` returns 422). Multi-host debate/panel shows build; single-host and kids-news need extra wiring first.
- **Two of some steps coexist:** a free topic-miner and a paid clusterer (RANK prefers clusters); `compile_beat.mjs` (live) vs `showplan.mjs`. The app uses one of each; consolidation is a separate tech-debt ticket.
