# TalkShowGo — Ease-of-Use Plan (make the power usable) · iteration 2

## Goal (one sentence)
Turn TalkShowGo from an 8-stage engineering console into a product a non-engineer can walk into and use — pick a show, see today's stories, build one (or a custom/tailored one), and hear it — while the full pipeline stays available for power users and the app explains itself so it never needs a tour.

## The problem, precisely
TSG already works end to end (8 live stages: PULL → CLUSTER → LEADS → RANK → DOSSIERS → BRIEFINGS → STANCES → SHOWS) and can already build custom/tailored shows (11 formats incl. kids-news, host/tone/audience selection, custom questions). It feels overwhelming because the UI exposes the MACHINE (~14 pages named after internal stages) not the JOB, the jargon needs a human to explain it, and nothing shows how it fits together or what it costs.

## Non-goals (YAGNI)
- No new pipeline capability, no new models, no new show formats, no rewrite.
- Demote the advanced pages, don't delete them. Don't touch the engines (stringer / floor / breeze).
- The code-level consolidation of the two duplicate implementations is a SEPARATE tech-debt ticket, not this plan (see the removed workstream 5 below).

## Workstream 1 — the "Make a Show" wizard (the front door) · effort M
**Home:** a new component `src/components/command/MakeShowWizard.tsx`, rendered as the DEFAULT view of `src/app/command/page.tsx`, with the current card grid moved behind an "Advanced" toggle. It is a thin UI over existing routes — it orchestrates, never re-implements. It resumes by calling `dataflow.buildJourney` (`src/lib/command/dataflow.ts:558`) directly, and treats an artifact as "done" only when atomically finalized (reuse `showbuild`'s temp+rename / `'unreadable'` guard, `showbuild/route.ts:29`), cleaning up partial artifacts on a failed step.

**Steps:**
1. **Pick a show** (beat).
2. **Today's stories** — shows the LAST pull's clusters by default, **no spend on entry**. A "↻ Refresh stories" button is the only control that re-runs PULL, and it shows a PAID chip first (PULL = twitterapi.io). If no pull exists yet, show a "Get today's stories (costs a pull)" button, never an auto-run. A zero-item pull / no-story day is an **empty state** ("no stories in this window — widen the window or pick another show"), never a Retry error.
3. **Pick a story — or type your own.** A typed story becomes an `expand` lead (`{value, query, destination:'WEB'}`) and the user is asked "the question this show turns on" (feeds `briefing.final_question`, which has no other source for a typed story).
4. **Research it** — 1-click, the free path (SearXNG + Mac Mini Ollama, `expand/route.ts`). On a thin/empty dossier or a failed neutrality audit (`briefing/route.ts:31` rejects "no cited evidence"), surface the audit result and offer "add web sources" or "pick another story" — never dead-end.
5. **Choose how it's told** — format + hosts + tone + audience (this is where custom/tailored lives). The host picker is **filtered by the format's cast topology** (`formats.json`): multi-host formats require ≥2 hosts; single-host formats (`opinion-single`, topology "H") skip the 2-host rule; `kids-news` surfaces the kid cast pool (malik/zaya/tyler/emma) + optional grown-up helper.
6. **Brief the cast** — calls `briefing/agent` for the chosen hosts (the step the v1 plan omitted). The Build button stays disabled until `okHouseCount ≥ 2` (or the format is single-host), with an inline "you need 2 briefed hosts" explainer, never a raw 422 from `showbuild/route.ts:73`.
7. **Build & listen** — `showbuild` → mp3. Progress from `status.json`; **Retry resumes from the failed stage** (`showbuild` `from_stage` = compile|floor|audio) so it never re-runs the paid PULL.

**Cost + provider (shared with WS4):** a single helper `resolveProvider(action) → {provider, free|paid, estCost}` backs both the per-step FREE/PAID chip and a one-line "what this run costs" before Build. It pre-flight probes the local boxes (Ollama .238 / SearXNG :8888 / Breeze) so the chip reflects the provider that will actually run, and each route returns the provider it actually used so a post-run line can reconcile ("ran on PAID — the free box was down — cost $X"). NOTE: `make_show` is currently spawned with `--provider=openrouter` hardcoded (`showbuild/route.ts:111`) — either wire it to the free-first providers or label the build honestly as PAID.

Every step also shows a plain one-liner ("what this does") + an "Advanced ↗" deep-link to the matching power page.

**Done when:** a first-time user builds a show start→finish (an mp3 lands under `lab/shows/<slug>/`) without leaving the wizard or asking what a word means.

## Workstream 1b — first-run gate (before step 1) · effort S
If there are zero beats / verified sources / cast / locked Breeze voices, route the user into the SET UP group (sources → cast → voices) with a checklist before the wizard proceeds. Detect via the `state.health` the command index already exposes. **Done when:** a brand-new install can't reach a dead wizard step; it's guided to set up first.

## Workstream 2a — plain-language rename + tooltips · effort S · ⚡
Rename user-facing LABELS (KEEP hrefs) in `src/app/command/nav.tsx` and the in-content labels inside the pages; extend tooltips to every control. Banned codenames in any label: stringer, dossier, stance, floor, beat. **Done when:** grep of nav + page headers finds zero banned codenames, and every control has a hover/inline explainer (enumerable: grep command pages for buttons/links, assert each has a title/tooltip).

## Workstream 2b — nav regroup · effort S-M (structural)
Regroup `nav.tsx` `ITEMS` into three sections — **RUN A SHOW** (wizard, stories, research, build, tape) · **SET UP** (sources, cast, formats, people, settings) · **UNDER THE HOOD** (pipeline, discovery, janitor, log). Tracked separately from 2a because it's a component-shape change, not string swaps.

## Workstream 3 — the Atlas (in-app only) · effort M
First persist the verified pipeline inventory as `lab/PIPELINE_INVENTORY.md` (the 8 stages + 18 prompts + model + free/paid, each traced to file:line — already gathered). Then build an in-app "How TalkShowGo Works" page from it: default view = each stage's plain-English purpose + a FREE/PAID tag; the model + the actual prompt sit behind click-to-reveal (power detail, not the default). No shareable/public version until someone asks. **Done when:** the page matches `PIPELINE_INVENTORY.md` exactly (a concrete diff, not "a user understands").

## Workstream 4 — cost clarity / free-first everywhere · effort S
Delivered by the shared `resolveProvider` helper (WS1): a FREE/PAID chip on every spending action (twitterapi.io PULL + X supplement; the cloud fallbacks and the always-cloud "reasoning middle" — cluster/leads/rank/briefing/compile-director on gemini-2.5-flash-lite). **Done when:** no action spends money without a PAID chip first, AND forcing the local box / SearXNG down makes the chip flip FREE→PAID (verifies it reads the runtime provider, not the config default).

## (Removed) Workstream 5 — implementation consolidation
Cut from this plan. The user-facing "one path" is already delivered by the wizard wrapping `showbuild` (which commits to `compile_beat` over `showplan`) and choosing one story-detector default — a non-engineer never sees the duplication. The actual code consolidation (retire topic-miner OR clusterer; retire `showplan`) is a separate tech-debt ticket, and THAT ticket must first audit callers of the retired path and add a regression test for it before demoting it.

## Risks & failure handling
- **Long-running steps** (PULL, research, build take 30s–minutes): every step shows progress and resumes from atomically-finalized on-disk artifacts — never a dead spinner; an error shows what failed + a stage-resuming Retry, not a stack trace.
- **No silent spend:** step 2 never auto-runs the paid PULL; every paid action shows a PAID chip; Retry resumes mid-pipeline so it can't re-spend PULL.
- **Chip honesty:** the chip reads the runtime provider via `resolveProvider`'s pre-flight probe + each route's post-run provider; account for `make_show`'s hardcoded `--provider=openrouter`.
- **Empty ≠ error** at every stage that can legitimately return nothing.
- **Renames** change labels only (keep hrefs); a route path change gets a redirect.
- Don't clobber `lab/PLAN.md` (the existing six-laws plan).

## How we'll know it's done (verifiable)
- Create `playwright.config.ts` (webServer boots `/command`, baseURL/port) + an npm `test:e2e` script. A **deterministic, free** smoke test starts from PRE-SEEDED on-disk artifacts (or stubs twitterapi.io/cloud/TTS), drives the wizard step 6→7 on `lab/beats/battle-rap.json`, and asserts an mp3 lands within a bounded time — CI-safe, spends nothing.
- Grep nav + page headers: zero banned codenames.
- Glossary coverage: every jargon term rendered in the wizard has an associated tooltip/explainer element; plus a captured steps-to-mp3 / clicks-without-help number on a tester checklist.
- Force the local box / SearXNG down → assert the chip flips FREE→PAID.
- The Atlas matches `lab/PIPELINE_INVENTORY.md` (8 stages, model, free/paid, prompt).

## Sequence
Ship 2a + 4 first (cheap, grep/click-testable, no engine risk) → then WS1 the wizard incl. brief-the-cast + empty/unhappy branches + the first-run gate (the spine) → then 2b + 3 (Atlas) in parallel. The consolidation is out of this plan as a separate ticket.
