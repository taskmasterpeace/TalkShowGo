# TalkShowGo v2 — The Show-Maker

**What it is:** a machine that turns "what's happening right now" into a 5-10 minute AI talk show.

```
BEAT (trusted sources) -> EVIDENCE PACK -> PRODUCER (format + rundown) -> HOSTS (locked personalities) -> SCRIPT -> [soon] VOICES -> [later] VIDEO
```

## The Laws

1. **Plugboard everything.** Beats, sources, hosts, models, formats: plug in, plug out. Battle rap is beat #1, not the product. The same machine must make a show about Orangeburg, SC.
2. **A host is ONE locked bundle:** model + temperature + system prompt + persona (+ voice ref + delivery style, soon). Repeatable on purpose. Generation receives the WHOLE bundle — never just a name (that was v1's fatal wiring bug).
3. **Evidence-grounded, gossip-delivered.** Every factual claim in a script traces to an evidence ID under the hood `[E7]`. On the mic, hosts drop receipts casually: "I seen the clip," "the man said it on his own stream." Rigor lives in the data layer; personality lives in the mouth. No lawyer voice, ever.
4. **The producer runs the room.** One producer (The Showrunner) reads the evidence pack, picks the format the material wants (ROUNDUP / CLASH / REACTION), casts the hosts, writes the rundown + cold open + button.
5. **The five bright lines apply** (no wrong-person; no unproven-thing-as-our-own-fact — attribute, then commit; no snitch label without court receipts; light touch on active litigation; never invent facts/quotes/receipts + deceased-care). Everything else: commit and dramatize.
6. **Human in the loop:** the machine proposes, Robert greenlights. Full-auto is earned later, not assumed now.

## Phases

- **P1 — Script Lab (NOW):** prove the writing. Pilot show: "What happened at Kai Cenat's house" (hand-fed evidence pack). Naked text, multiple formats, Robert judges the words.
- **P2 — Plumbing:** Twitter ingest (twitterapi.io — key LIVE, tested 2026-08-31, returns same-day tweets) + YouTube ingest per beat. Plus a **source-verify step**: handles rot (`uraboratv` already returns not-found).
- **P3 — Voices:** cupcake mk-gateway `breeze-clone` — per-line `instruction` = the host's emotional reaction; locked ref clip + seed per host = same voice forever. Free on our box.
- **P4 — Video:** fast video gen; the `greenlight -> Directors Palette` handoff seam already exists in the old code.

## Beats (the generalization)

A beat = a coverage area with its own trusted sources: `lab/beats/<slug>.json` — twitter handles, youtube channels, rss feeds, web. Local-news beats lean **published RSS** (the town paper's feed, Google News RSS queries) — feeds exist to be read; we never hostile-crawl a site that doesn't want it.

## Where things stand (2026-08-31)

- Frozen Jan-Mar work committed: branch `revival`, commit `cf93977`.
- twitterapi.io: LIVE. Key in `.env` as `TWITTERAPI_IO_KEY` (scrubbed from docs).
- Model drawer today: Requesty (multi-model gateway), Perplexity (fact-check), Mac Mini Ollama (uncensored local), cupcake gateway (voice, free).
- Old 8-phase codename UI + broken debate tables: parked, not restored. We harvest parts; we don't resurrect the cathedral.
