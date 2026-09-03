# TSG COMMAND — Robert's full walkthrough (2026-09-02)

Captured from Robert's screen-by-screen tour of http://localhost:56190/command. Every item logged so nothing is lost.
Status: `bug` = broken · `feat` = build · `q` = needs an explanation (goes in the TOUR) · `data` = source curation · `done`.

## BUGS (crashes / errors)
- **B1** `bug` **People page crashes on click** (repeatable). Also "clicked something under Sources and it crashed."
- **B2** `bug` **Topic Miner intermittent JSON parse error**: "miner failed: Expected ',' or ']' after array element in JSON at position 3849". Worked on retry (9 topics). LLM JSON not being repaired.
- **B3** `bug` **YouTube resolve leaves channel_name as the URL** — after Resolve All it resolves but the name field still holds the pasted URL, not the real channel name.
- **B4** `bug` **Discovery/expand error then worked** — an expand failed once, then succeeded. Flaky.

## UX / INPUT
- **U1** `feat` **Strip `@` from the Twitter handle field** — typing/pasting a handle must never keep the `@` (paste `@foo` -> stores `foo`).
- **U2** `feat` **Verify ONE source** (not only Verify All) — Robert added a handle and couldn't verify just that one.
- **U3** `feat` **Source heat/recency indicator** — per source show last-tweet recency buckets (24h / 7d / 30d) so "verified" isn't misleading when there are 0 recent.
- **U4** `feat` **Source richness / drill-down** — how many items we've pulled per source; expand to richer info.
- **U5** `feat` **Tape needs a proper DELETE** — no way to delete rendered takes/shows.
- **U6** `q`/`feat` **Priority** on a source — what does changing it actually do? (explain + make it real: weighting in pull/rank.)
- **U7** `feat` **API-call safety** — Robert is "really afraid" of burning twitterapi.io calls. Add guardrails / a visible call budget.

## TOOLTIPS + THE TOUR (biggest theme — it's a DESKTOP app)
- **T1** `feat` **Tooltips everywhere** saying what each control/term does.
- **T2** `q` **A guided TOUR** — screenshots of every panel + plain-English explanation. Terms to define: overlap number · the pipeline status line (PULL/TOPIC MINER/SHOWPLAN **live**, FLOOR/BREEZE **engine ready** yellow) · "next unlocks: avatar desk, breeze audio" · Stringer · Janitor · The Clock · pull/cluster/leads/rank · "what came back" · Expand + number · the `str_...` reference ids · require_counterpart · discovery lead queue.
- **T3** `idea` Maybe a short explainer video (remotion/motion skill).

## DESIGN
- **D1** `feat` **Restyle with the ORIGINAL Talk Show Go design kit** — "I don't like this brown shit." Drop the brown command-terminal palette for the original TSG look.
- **D2** `feat` **Per-beat/show LOGO**, prominently displayed (≈2 rows, by/over the tagline) + a way to upload a logo per show (THE HUDDLE first).

## NAMING
- **N1** `q` DESK -> maybe "Front Desk" (TBD).
- **N2** `feat` **Stringer -> "Research Desk"** (or clearly explain the name).
- **N3** show names: battle-rap beat show = **"Battle Rap Daily"**; sports = THE HUDDLE (Falcons) / THE FIELDHOUSE (Pacers).

## CAST
- **C1** `feat` **SWAP names: Cassius Wynn <-> Champagne Dwayne.** The current rapper (cap/chain) becomes **Champagne Dwayne**; the current smooth charmer becomes **Cassius Wynn** and is redesigned: **dark-skinned, glasses, dressed up a little.**
- **C2** `feat` **Casting reel** — each cast member SAYS their name + their casting/role line (voiced). Andrew Hammond explicitly ("our white voiceover god").
- **C3** `feat` **LTX 480p animated talking clips** — animate each cast member saying their line, one by one; go through a video and see them talk. (The lip-sync pilot, now a real ask.)

## FORMATS + SHOW STRUCTURE
- **F1** `feat` **Show segments built in: INTRO + SEGMENTS + OUTRO.** The tape/first-take structure confused him (intro module / "score check / warm breath" / "biggest day storyline = topic card" — he expected named segments + a clear end).
- **F2** `feat` **Closing should recap what was discussed;** future: 3-sec **music** sting in/out + optional **voiceover intro** (use August Reed, the VO guy).
- **F3** `feat` **Format PREVIEW image** — generate an image representing each format using the CAST as reference images (moderated-collision = show the M + A + B seats); show how many people are on it.
- **F4** `q` **require_counterpart / human_dependency** — explain; it reads as locked. Formats feel too rigid ("who says investigation HAS to do all that?"). Want a format right-sized for the little First-Take-per-team shows we have now.

## RESEARCH / DISCOVERY / DATAFLOW / YOUTUBE
- **R1** `feat` **Stringer/research view is bunched** — when you open a source it should DEFAULT to showing only THAT station, not everything at once.
- **R2** `feat` **In-app YouTube channel SEARCH** to add sources (he expected it to be easy; adding by handle/URL is clunky and the resolve name bug (B3) bites).
- **R3** `feat` **Twitter tweet display with metadata** (date, author) as a reusable show element.
- **R4** `q` Explain Discovery lead queue + Expand + the stored evidence + `str_` ids; Dataflow (beat -> pull -> cluster -> leads -> rank -> "what came back"); the Clock.

## DATA (source curation — beats)
- **DA1** `data` **battle-rap beat:** REMOVE VladTV, JayBlac, RareBreed(?), King of the Dot, URL. ADD Battle Rap Trap, Hip Hop Is Real, Chris Unbias, DNA Tooth (@DNATOOTH confirmed). Robert edited these live on `algorithm-institute-of-battle-rap` — verify it SAVED.
- **DA2** `data` Source auditor flagged @RBE_studios + @AngryFan007 NOT FOUND (dead handles), @HipHopIsReal SUSPECT squatter (real HHIR handle needed). Reconcile.

## THE PLAN
Quick fixes first (U1 @-strip, U2 verify-one, B1 crashes, B3 resolve-name). Then the TOUR (answers most `q`). Then design kit (D1) + logos (D2). Then cast swap (C1) + casting reel/LTX (C2/C3). Segments/formats (F1-F4) and sources heat/search (U3/R2) as their own builds. Everything above is (or will be) a GitHub issue.
