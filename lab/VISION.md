# TalkShowGo — The Vision (Robert, 2026-09-01)

The through-line: **model DNA → custom hosts with voices → a room where they choose when to
speak → and real people fed impartial context to surface their opinions.** This doc captures
everything and names the parts. Nothing here is lost; it's the build order.

## Status (2026-09-01b) — corrections + what's built

- **Web search VERIFIED.** Earlier "no LLM has internet" is only half true. OpenRouter models
  DO search the live web via `plugins:[{id:'web'}]` (or a `:online` model suffix) — tested: a
  cheap model returned a trade dated *today* with real citations. Perplexity Sonar is native-web
  too. So hosts and the research agent CAN go online.
- **THE STRINGER is BUILT** (research agent, `/command/stringer`). Given a subject or question it
  digs **YouTube first** (the beat's trusted channels, then global), pulls transcripts, and an
  impartial parser produces a cited evidence ledger + answers. Server derives every citation URL
  from the source map, so the model can't invent one. Proven on "Tay Roc": 6 sources, 5
  transcripts, 12 cited evidence, audit PASS. YouTube = the "un-polluted" source Robert wanted;
  OpenRouter web is the secondary supplement.
- **"Call-In" is renamed THE DELEGATE** — a user NAMES a person (optionally gives their own
  voice + view) who represents them on the show. Not a phone gimmick; representation.
- Codex designed the full lineage: **THE STRINGER → THE BRIEFING → (Agent delivery | Delegate) →
  Showplan → Floor** — one evidence lineage, not three silos. Build order at the bottom.

## The names (what we call the parts)

| Name | What it is | Status |
|---|---|---|
| **SHOW** | the switchable unit — a channel/beat + its sources, cast, format, cases, identity | live (Desk) |
| **THE FORMAT ROOM** | the visual gallery of the 10 show formats — set, seats, run of show | artifact → **building as an app page now** |
| **MODEL DNA** | `lab/models.json` — each engine's temperament turned into a personality attribute | **built** |
| **THE PRINT** | a host's personality (Personality Print v4) — the soul on top of a model | live (`lab/cast`) |
| **THE GREENROOM** | the **host + guest creator**: assemble a host from Model DNA + a Print + a Voice; or type a celebrity name and it auto-drafts all three | spec below → next big build |
| **THE ROOM** | the **dialogue engine** — the spontaneous floor where hosts decide who talks, when, to whom | engine exists (`lab/engine/run_floor.mjs`); formalize |
| **THE BRIEFING** | the **informed-opinion format** — impartial research fed one move at a time, then the question. For agents AND users | spec below |
| **THE DELEGATE** | **audience participation** — a real fan gets a Briefing (email/call), gives an opinion, becomes an avatar guest | spec below |

## Model DNA — quirks are attributes (the "walk the dog")

`lab/models.json` holds it. The rule Robert set: **don't fight a model's nature — cast the
model whose quirk IS the character.** Two new dimensions became personality traits:

- **Context window is temperament.** Gemini Flash Lite (1M) reads the whole briefing and still
  snaps instantly = the informed gut. Mancer Weaver (8K) literally can't hold the thread = pure
  impulsive reaction, one perfect line then he forgets. R1's small 64K + slow reasoning = the
  deliberate analyst who waits, then buries you. So how much context a host can hold is part of
  who he is — and it tells us how big a Briefing we can hand each seat.
- **Internet is a pipeline capability, not a host trait.** No LLM has native web. Live/impartial
  context comes from **THE BRIEFING's research node** (Perplexity Sonar = native web; or a web
  tool on a tools:yes model). Any host can be *informed* — we feed it context up to its window.

A show is a **spread of temperaments**: fast gut vs slow analyst vs uncensored comic vs wildcard.
Diversity of engines = diversity of real voices, for pennies (a 40-turn show is under a cent).

## THE GREENROOM — the host/guest creator (next big build)

One page to make a host, saved as a locked bundle (`lab/cast`):
1. **Identity** — name, lane, the archetype (hot-take / analyst / comic / poet / advocate).
2. **Model DNA** — pick the engine by its *attribute* (from `models.json`), see its context
   window + cost + speed + uncensored flag surfaced as you pick.
3. **The Print** — write it, or **type a celebrity name and auto-draft** the personality print
   (persona generator, already built) — their processing style, blind spot, lines they'd say.
4. **The Voice** — design a Breeze voice from a description, upload a reference, or **auto-derive
   a voice from the celebrity** (aesthetic prompt → Breeze design, already built).
5. **Save** → the host is castable into any format's seats.
Guests use the same Greenroom, just seated as `S/E/W/C` instead of a house host.

## THE BRIEFING — informed opinion, for agents and users (the revolutionary part)

The engine that gives *anyone* — an AI host or a real person — an **informed** opinion instead
of a hot one. Robert's Falcons example is the spec:

> "They traded James Johnson, your 4th receiver." → here's his stats. → "They got a running
> back." → here's the back's analysis. → the larger context: the O-line upgraded, but mostly
> pass-blockers; the QB's numbers. → **the question: should they have kept the receiver?**

Rules: **impartial** (no lean — it presents, it doesn't argue), **one move at a time** (each
fact lands before the next), **engaging enough to make you care**, and it ends on **a real
question**. It runs in two morphs off the same core:
- **For agents** — a host is Briefed before a show so its opinion is earned, not invented. The
  research node (Perplexity) gathers the impartial context; the host's context window caps how
  much it holds; then it forms a stance the actor-loop can defend on the floor.
- **For users** — see THE DELEGATE.

## THE DELEGATE — audience participation

A real fan participates without being a writer:
1. **The producer reaches out** — email or (later) an automated call to a fan of a team/topic.
2. **A Briefing plays** — the moves, one by one, impartial, with the larger context (as above).
3. **They answer the question** — their genuine opinion, in their words (typed or spoken).
4. **They become a guest** — the Greenroom turns their answer + a photo + a voice sample into a
   Print + an avatar (InfiniteTalk, already running on the 4090, open-source Apache-2.0), and
   they're seated as a guest whose avatar speaks *their* view on the show.

So participation is just **a guest whose Print and avatar came from a real human**, fed by a
Briefing. Everyone who submits an opinion can literally appear on the show as themselves.

## THE ROOM — spontaneous dialogue (the node graph Robert prototyped in n8n)

The floor engine (`lab/engine/run_floor.mjs`) already does actor-loop turn-taking with an
allocator deciding who talks. Robert's n8n prototype is the same idea as nodes: each host is a
node that can *choose who to talk to and when*, so the conversation feels spontaneous instead of
round-robin. Formalize the allocator into: floor-bid (who wants in), address (who they're
answering), interrupt (mid-clause on a lost bid = backchannel), and detonation (a withheld
receipt lands live). Multi-provider: route each node to its host's Model DNA (OpenRouter /
cupcake) instead of only Requesty.

## Build order

1. **THE FORMAT ROOM in the app** (this turn) — keep the legend + role icons, add image-ready
   seat slots (1:1 portraits) + a 16:9 set-still slot so generated images replace the icons,
   organized by cast size / dependency, wired into the command nav.
2. **THE GREENROOM** — the host creator (Model DNA picker + celebrity auto-draft + voice).
3. **Multi-provider THE ROOM** — wire OpenRouter + cupcake into the floor engine; run a live
   host+guest loop so we HEAR the roster argue.
4. **THE BRIEFING + THE DELEGATE** — research node → impartial briefing → opinion → avatar guest.
