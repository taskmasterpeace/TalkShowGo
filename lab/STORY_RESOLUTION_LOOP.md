# The Story Resolution Loop — TalkShowGo discovery architecture

Robert's design, 2026-09-01. The object moving through the system is the **STORY**, not the tweet or the video. The old "X → YouTube → X" pipeline is too rigid. The real shape is a loop:

> **Discover → Cluster → Extract Leads → Expand → Resolve → Rank → Producer Selects**

The trigger that made this concrete: Orangeburg SC (a small town, no sports teams, hard to research). X search for "Orangeburg" returned noise (random crimes that just happened there). Searching by people got closer. The unlock was a **lead chain**: found `@OrangeburgLinks` (an old-links account) → spotted "ESPN Orangeburg" → its bio linked to **espnorangeburg.com** (a real-looking local ESPN affiliate, "1580 ESPN Orangeburg" radio) → which has a **YouTube channel** (112 subs, ~2yr old, mostly stale). Almost a goldmine. The lesson: **don't start from zero every time — follow the leads.** That behavior is the missing module.

---

## Naming (use these terms consistently)
- **Story Cluster** — multiple posts/videos describing/reacting to/adding evidence to the SAME underlying event.
- **Topic Cluster** — everybody talking about the same SUBJECT (GTA VI). NOT the same story. (Story = "Rockstar delayed GTA VI"; Substory = "devs criticize Rockstar over crunch after the delay".)
- **Research Lead** — a person/claim/org/phrase/video/post/hashtag/URL/date/historical event that may deserve another search.
- **Research Lead Queue** — the holding area for leads awaiting expansion.
- **Source Expansion** — searching another source because of a lead.
- **Story Resolution Loop** — the whole iterative discover→resolve process.
- **Evidence Packet** — everything handed to the AI producer.

Pipeline: `X Discovery → Story Clustering → Research Lead Extraction → Research Lead Queue → Source Expansion → Story Resolution → Producer`.

---

## The core mistake to avoid
Do NOT ask "are these tweets about the same **topic**?" (garbage clusters — 50 people naming Trump/Drake/the NFL is not one story). Ask **"are these sources describing, reacting to, or adding evidence to the same event/claim?"** → you need an **Event Fingerprint**.

### Event Fingerprint (per post/source)
```
SUBJECT · ACTION/EVENT · OBJECT · CLAIM · TIME · LOCATION ·
NAMED ENTITIES · SOURCE LINKS · KEY PHRASES · MEDIA (video/image id) · CONVERSATION (replies/quotes/reposts)
```
Two posts can share almost no words and still be the same event. Compare fingerprints.

### Story Similarity Score — signal weights
| Signal | Weight |
|---|---|
| Shared URL/source · same attached video/media · same X conversation | **Extremely high** |
| Semantic event similarity · same claim/action | **Very high** |
| Same named entities · same unusual phrase/quote | High |
| Temporal proximity · same location | Medium |
| Hashtag similarity · raw keyword overlap | Low |

---

## Research Lead Extraction (the missing module)
After a Story Cluster forms, read every source and ask: **"what did they mention that could materially change our understanding?"** Each becomes a lead. Lead types: PERSON, ORG, CLAIM, QUOTE, EVENT, DOCUMENT, ARTICLE, VIDEO, PODCAST, INTERVIEW, POST, ACCOUNT, HASHTAG, URL, PLACE, DATE, HISTORICAL REFERENCE, PRODUCT, LAW, COURT CASE, REPORT, STATISTIC.

Example — tweet "Rogan warned about this two years ago when he interviewed Sam Altman" → leads: `Joe Rogan`, `Sam Altman`, `Rogan+Altman interview`, `"warned about this"`, `~2 years ago` → destination YouTube, mode **LEGACY/HISTORICAL**. (This is exactly the Orangeburg behavior.)

### Lead Value Score (0–100) — 10 dims
Relevance · Novelty · Specificity · Evidence potential · Recurrence · Authority · Controversy · Visual value · Context value · Producer value.
```
0–39   ignore
40–59  store, don't auto-pursue
60–79  expand IF research budget allows
80–100 auto-investigate
```
This one mechanism stops the loop from becoming an uncontrolled crawler.

---

## Source routing (a lead knows where to go)
**X/Twitter** — recent events, direct statements, immediate reactions, eyewitness, emerging narratives, quote-post disagreement, memes, who-first, how-widespread. (X API: recent = 7d; full-archive to 2006 by access tier; structured post data.)

**YouTube** — interviews, speeches, press conferences, podcasts, news clips, historical statements, reactions/explainers, long-form context. Do NOT use one mode:
```
YOUTUBE_CURRENT         last 24h/3d/7d, order=date + relevance pass
YOUTUBE_CONTEXT         recent but explanatory, order=relevance
YOUTUBE_LEGACY          historical, publishedBefore/After ranges
YOUTUBE_ORIGINAL_SOURCE named speaker/channel/event
YOUTUBE_REACTION        commentary about the story
```
**Run TWO YouTube searches for important stories** — a Freshness pass (order=date, publishedAfter) and a Relevance pass (order=relevance), merge + dedupe. (YT warns non-relevance sorts return smaller/incomplete sets — don't make it either/or.)

**Return-loop rule:** only recurse to another source when the new lead has HIGH probability of new evidence / new reaction / contradiction / primary source. "This reminds me of the dot-com bubble" is contextual color, NOT a lead to chase.

---

## Transcripts & visuals (architect correctly)
- **YouTube metadata: yes** (id, title, desc, channel, date, tags, duration, stats, caption availability, thumbnails to maxres 1280×720). Research UI shows Thumbnail + Title + Channel + Age + Views + Duration + relevance reason.
- **Transcript: separate subsystem** — the official captions API needs edit-permission; it does NOT hand you arbitrary public transcripts. Build a `TranscriptProvider` with fallbacks (native/authorized captions · legitimately-accessible UI transcript · creator-provided · licensed provider · STT where permitted). Do NOT architect "YT API → transcript." *(Note: our Stringer currently uses yt-dlp auto-subs — treat that as one provider under this abstraction, keep it swappable.)*
- **Screenshots:** search-preview = official thumbnail (easy). Exact frame at 13:42 = browser inspection (Playwright), but do NOT architect background media downloads (YT dev policy). Internal evidence model stores `VIDEO / timerange / transcript / visual observation / thumbnail / player URL / suggested on-air visual` and lets publishing decide what's showable.

---

## Attribution designed into the DB NOW (not at script time)
Every claim carries provenance:
```json
{ "claim":"...", "sources":[{ "platform":"x","source_type":"post","post_id":"...","author_id":"...",
  "author_name":"...","username":"...","avatar_url":"...","timestamp":"...","original_text":"...",
  "permalink":"...","media":[],"capture_time":"...","confidence":1.0 }] }
```
**Attribution Modes** (research stores MAX provenance; producer chooses MIN necessary): A Aggregate ("a lot of people online…") · B Paraphrased ("several devs on X argued…") · C Named ("John Smith wrote on X…") · D Direct quote · E Visual Post (put it on screen) · F Source video.

**Social Card Renderer, not fake screenshots.** Render real X metadata (avatar, full name, @username, text, media, timestamp, X logo) per X display requirements; mock-ups of non-existent posts are disallowed. Keep the post_id so an official embed is possible for web.

---

## Producer Story Ranking (Story Value ≠ Research Value)
A story can be perfectly verified and still be a terrible talk-show story. After research, score **Story Value**: newsworthiness · audience relevance · recency · conversation volume · velocity · conflict · novelty · emotional intensity · recognizable characters · available evidence/visuals/video · **contrasting viewpoints** · comedic potential · opinion potential · explainability · **show-fit**. Same research engine, different producer: "top 5 for a Daily-Show episode" vs "top 5 for a Maddow episode." **A debate show needs stories with real contrasting viewpoints** — that's a first-class ranking signal, not an afterthought.

## Evidence Packet (producer input)
`STORY · WHY IT'S MOVING · SUMMARY · CONFIRMED FACTS · UNVERIFIED · DISPUTED · ORIGINAL SOURCES · REACTION (supportive/critical/funny) · YOUTUBE SOURCES (report/interview/historical) · BEST QUOTES · BEST VISUALS · LEADS FOLLOWED/DISCARDED/UNRESOLVED · CONFIDENCE · FRESHNESS · SHOW VALUE · POSSIBLE ANGLES (straight/political/comedic/contrarian/explainer)`.

## Provenance Graph (required)
Store the reasoning structure, not "AI summary": `STORY → CLAIM A → [posts/videos/articles] · CLAIM B → [...] · COUNTERCLAIM C → [...] · REACTION → [...]`. This makes TalkShowGo an **auditable editorial intelligence system**, not a content generator.

Browser control: Playwright as a SECONDARY layer under a `SOURCE ADAPTER` (API adapter · browser adapter · manual import). Prefer APIs; use the browser when the API can't see it (auth-gated views, transcripts, visual verification). Dedicated persistent research browser; user logs in manually; persist encrypted session state, never plaintext passwords in the LLM workflow.

---

## Where this maps onto what's ALREADY built (we are NOT starting from zero)
| Loop stage | Status in repo |
|---|---|
| X Discovery | **partial** — `lab/runs/pull_*.json` (twitterapi.io) + `/api/command/process` |
| Story Clustering | **partial** — `topics_*.json` already has `kind:"story"`, `overlap_sources`, `why_today`, `angle`; NO Event Fingerprint yet |
| Research Lead Extraction + Queue + Lead Value Score | **MISSING** — the core new module (the Orangeburg lead-chain) |
| Source Expansion (dual-mode YouTube, legacy) | **partial** — Stringer does YouTube-first + web supplement; NO current/legacy/original modes yet |
| Story Resolution → Evidence Packet | **BUILT** — the Stringer dossier IS an Evidence Packet (cited evidence, truth labels FACT/ATTRIBUTED_CLAIM/ANALYSIS, distinct-publisher audit, server-derived URLs = provenance) |
| Attribution provenance | **partial** — server derives every citation URL from a source map (can't be invented); modes A–F not yet a producer control |
| Producer Story Ranking (Story Value) | **MISSING** — topics have `angle`/`why_today` but no Story-Value score / show-fit ranking |
| Opinion + Show generation | **BUILT this session** — Briefing → Brief-the-Cast (Model DNA) → Delegate → beat compiler (Showrunner collision) → floor → Breeze audio |

So the discovery loop is the **front-end that produces the Evidence Packet** that the Briefing/Cast/Floor/Audio engine already consumes.

## Build order (Robert's MVP first)
`X ingestion → Event Fingerprint → Story Clusters → Research Lead Queue → dual-mode YouTube → Evidence Packet → human Producer selection`. Autonomous browser navigation + deep recursion come AFTER that loop works — don't build an impressive browser-driving agent on top of weak editorial reasoning.

**Next concrete builds (in order):**
1. **Event Fingerprint + Story Clustering** over an existing `pull_*.json` (replace/upgrade the topic miner's clustering with fingerprint similarity; emit real Story Clusters + Substories).
2. **Research Lead Extraction + Lead Value Score + Lead Queue** (automate the Orangeburg chain; leads route to X or dual-mode YouTube).
3. **Source Expansion** wired to the Stringer (a lead becomes a Stringer assignment; results fold back into the cluster's Evidence Packet).
4. **Producer Story Ranking** (Story Value incl. contrasting-viewpoints/show-fit) → the producer picks → the show engine builds it.

---

## The 40 design-review questions (the real requirements doc)
Discovery: 1 initial corpus (keywords/trends/accounts/lists/verticals)? · 2 what is "current" (15m/6h/24h/3d/7d)? · 3 clustering evidence threshold? · 4 when does one topic split into multiple stories? · 5 do reposts/replies count toward volume? · 6 do prominent accounts count more? · 7 anti-bot / coordinated-spam defense? · 8 which entity types auto-become leads? · 9 min lead score to trigger a search? · 10 max expansion rounds before stop? · 11 per-story API/video/post budget? · 12 lead→source routing rules? · 13 always run fresh+relevance YouTube? · 14 signals that legacy YT is needed? · 15 permitted transcript providers? · 16 transcript-only vs +metadata vs +visual frames? · 17 may we retain thumbnails/screenshots & under what rights? · 18 distinguish fact/opinion/prediction/joke/allegation? · 19 corroboration count for "confirmed"? · 20 does the engine actively search for counter-evidence? **(it should)** · 21 identify the ORIGINATOR of a claim not the top repost? · 22 when "people are saying" vs a name? · 23 when retain exact source text? · 24 post rendering: embed / native card / broadcast? · 25 handle deleted/edited posts after ingestion? · 26 retain the snapshot originally analyzed? · 27 producer force-follow / reject a lead? · 28 rank sources primary/secondary/commentary/anonymous? · 29 deliberately find competing interpretations? · 30 what is RESEARCH COMPLETE? · 31 how is story confidence computed? · 32 when does an Evidence Packet go stale? · 33 which platforms API-auth vs persistent-browser login? · 34 which browser actions auto vs require approval? · 35 can we reconstruct WHY every lead was pursued/rejected (auditability)? · 36 producer sees raw sources + AI summaries (both)? · 37 every script line points back to its evidence? · 38 does story selection happen before or after the show format is known? · 39 can a morning cluster be refreshed not rebuilt? · 40 can two separate clusters later merge when proven the same event?
