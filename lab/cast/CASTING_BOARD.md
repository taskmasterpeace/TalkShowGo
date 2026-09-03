# Casting Board — the reusable voice library (in progress)

Robert (2026-09-02): we're building a **cast we can reuse**. Every good candidate voice becomes its
own **named, tagged character** — nothing thrown away ("we absolutely must keep these voices"). Picks
by ear from `voices/candidates/LINEUP.mp3`. This board is the running truth until locked into `cast.json`.

## Locked reads (Robert, by ear)

| Voice (seed) | Character | Robert's read | Lane / tag (draft) | Status |
|---|---|---|---|---|
| **Blaze A** (212) | **Andrew Hammond** | White male ~40s, stereotypical sports/news anchor, "talks quarterbacks," **normal pacing**, sounds like a REAL news reporter | `news-anchor` + `sports-desk` | NAMED |
| **Blaze B** (222) | *(name TBD)* | Sounds a little high/intoxicated but **very human** — slow, lots of silence between lines, keeps you locked in. Should talk in **slang** ("I don't be trying," "I'm not fixing to do that") | `street` / `slang` | KEEP — name TBD |
| **Dwayne B** (414) | **Champagne Dwayne** | Flashy, playful, laughs before the punchline — "this is Champagne Dwayne" | `late-night-charm` / `battle-rap` | LOCKED |
| **Dwayne A** (404) | *(name TBD)* | Smooth black man, slow pace | `late-night` / `smooth` | KEEP — name TBD |
| **Knowledge A/B/C** (313/323/333) | *(repurpose)* | **Rejected as King Knowledge** — not hip-hop enough. Reads as a **distinguished black male, normal pace** → good for a **news / political reporter** | `urban-news` / `political-anchor` | REPURPOSE |

## Still to categorize ("give me more to categorize")
- **Blaze C** (232) — big warm broadcaster, church-organ bass-baritone, southern warmth
- **Knowledge B** (323) — lighter, quicker, "a barber who reads," storyteller rhythm
- **Knowledge C** (333) — deep elder statesman, clean, no gravel
- **Dwayne C** (424) — low late-night quiet-storm, velvet, seductive-calm

## Redesign needed
- **King Knowledge (the HOST)** — **RETIRE THE NAME** (Robert 2026-09-02: there's already a battle-rap
  figure named Knowledge). The character (a hip-hop elder) needs a **new name** + a **more hip-hop** voice
  (culture-fluent, not distinguished-anchor). Working replacement voice in the library: **Unc Ray**.

## Library — Batch 1 (2026-09-02) + Robert's verdicts by ear

| id | Name | Seed | Lane / tags | Verdict (Robert) |
|---|---|---|---|---|
| `sonny-cash` | **Sonny Cash** | 500 | gossip · urban-news · battle-rap | ⭐ **KEEP — "best AI voice I've ever heard."** Full print built → [`library/sonny-cash.json`](library/sonny-cash.json). guards.style OFF (raw). Demo rendered. |
| `renee-vaughn` | **Renee Vaughn** | 520 | urban-news · news-anchor | ✅ **KEEP — the OFFICIAL Machine King Lives studio news/analysis anchor.** |
| `marlon-pierce` | **Marlon Pierce** | 540 | satire · comedy | ✅ KEEP (satirist). |
| `big-mike-vega` | **Big Mike Vega** | 550 | hype · sports · battle-rap | ✅ KEEP — big Black man, good for **sports**. |
| `deuce-carter` | Deuce Carter | 530 | street · battle-rap | ⚠️ KEEP but marginal — "sounds like he's outside / a little hustle," **not for long-form.** |
| `unc-ray` | Unc Ray | 510 | hip-hop-elder | ❌ **REJECT — too old.** Culture-elder lane re-cast younger as `cee-rah` (batch 2). |

## Library — Batch 2 (2026-09-02) + verdicts

| id | Name | Seed | Verdict (Robert) |
|---|---|---|---|
| `quincy-banks` | **Quincy Banks** | 560 | ✅ KEEP — "insightful, bright-spirited" |
| `nia-foster` | **Nia Foster** | 580 | ⭐ **KEEP — "LOVE HER."** Fiery advocate, **natural hair** (avatar note) |
| `august-reed` | **August Reed** | 590 | ✅ KEEP — **cinematic trailers + intros** |
| `rico-delgado` | **Rico Delgado** | 600 | ✅ KEEP — "cool, lively" |
| `imani-cole` | **Imani Cole** | 610 | ✅ KEEP — "alluring and analytical," **good for storytelling** |
| `cee-rah` | Cee Rah | 570 | ⏳ **PENDING** — Robert didn't call it; awaiting ear |

## Library — Batch 3 (2026-09-02) — kids + storytellers
Robert's ask: Black + white kids (M/F) for storytelling, plus a 78-year-old storyteller.

| id | Proposed name | Seed | Lane / tags | For |
|---|---|---|---|---|
| `kid-malik` | Malik, age 9 | 620 | kids · storytelling · family | ✅ KEEP (Black boy) |
| `kid-zaya` | Zaya, age 8 | 630 | kids · storytelling · family | ✅ KEEP (Black girl) |
| `kid-tyler` | Tyler, age 9 | 640→641 | kids · storytelling · family | ✅ KEEP (white boy) — ⚠️ had faint **room tone**; RE-ROLL clean (seed 641, dry-studio descriptor) |
| `kid-emma` | Emma, age 8 | 650 | kids · storytelling · family | ✅ KEEP (white girl) |
| `gran-pearl` | Grandma Pearl, 78 | 660 | elderly · storytelling · family | ✅ KEEP (78 bedtime grandmother) |
| `pop-earl` | Pop Earl, 78 | 670 | elderly · storytelling · family | ✅ KEEP (78 grandfather) — note: **reads white**, Robert likes him |

**Robert 2026-09-02: "I love all those voices, keep them all, book them."** Whole batch-3 kept.

## NEXT: character portraits (Robert's ask)
Photorealistic **studio portrait, white background, one image per character** — for the voice-picker UI.
Later upgrade: turbo-animate each into a short **GIF** so the picker shows a moving portrait (deferred — stills first).
Step 1 = write a VISUAL description per character; Step 2 = generate. Open question: **DP portraits** (existing
`gen_portraits.mjs`, matches the 3 portraits already in `lab/cast/images/`) vs **cupcake local gen** ("whatever turbo
fast thing we got"). Nia = natural hair. Pop Earl = white. Tag `natural-hair` etc. as avatar notes.

### RESOLVED (2026-09-02): portraits = KREA 2 on cupcake + cinematic LoRA
- Robert: **no DP.** Use **Krea 2 on cupcake** + the **Cinematic Shot LoRA** (`krea2_style_cinematic.safetensors`,
  trigger `zy_cinematic`, str 0.9) chained with **Realism V2** (0.5). Personality baked into each prompt (from the voice
  prints) so they're not generic; 3 variations (framing + seeds 137/5150/88888).
- Tooling: `lab/engine/gen_portraits_krea.mjs` (text-to-image via `/v1/image` loras[]), spec in `lab/cast/images/portraits.json`.
  3-up contact sheets in `lab/cast/images/sheets/`. 19 chars × 3 = 57 images, 0 failures.
- **Locked picks** (Claude chose per Robert's "make the choice"; the pick is copied to `<id>.png`):

| Character | Pick | Character | Pick | Character | Pick |
|---|---|---|---|---|---|
| Sonny Cash | **1** | Rico Delgado | **2** | Malik (9) | **2** |
| Renee Vaughn | **1** | August Reed | **2** | Zaya (8) | **2** |
| Nia Foster | **1** | Andrew Hammond | **2** | Tyler (9) | **2** |
| Imani Cole | **2** | Tasha Raw | **1** | Emma (8) | **2** |
| Marlon Pierce | **1** | Champagne Dwayne | **1** | Grandma Pearl (78) | **2** |
| Big Mike Vega | **2** | Deuce Carter | **2** | Pop Earl (78) | **2** |
| Quincy Banks | **1** | | | | |

- Next upgrade (deferred): turbo-animate each locked portrait into a short GIF for the picker UI.

## Tags (confirmed + growing)
`sports-desk` · `battle-rap` · `urban-news` · `news-anchor` · `political-anchor` · `late-night-charm` ·
`street` / `street-slang` · `smooth` · `gossip` · `hip-hop-elder` · `satire` · `comedy` · `hype`

## Technical note (don't lose this)
- **Blaze B rendered SLOWER / more human than its prompt intended** (prompt said "fast, energetic,
  Atlanta"; it came out slow with silences). That divergence is the magic — so **freeze Blaze B's exact
  .wav as the lock and do NOT re-design it**, or we lose the quality Robert liked.

## Open systemic
- **Cross-episode memory** — hosts should remember previous episodes (verdicts, running beefs,
  callbacks). Scaffold already exists: every host bundle has `show_memory: lab/cast/memory/<id>.json`.
  → GitHub issue to DESIGN later (what gets stored + how it's injected into the floor system prompt).
- **Tag taxonomy** — starter set to confirm/extend: `sports-desk` · `battle-rap` · `urban-news` ·
  `political-anchor` / `news-anchor` · `late-night-charm` · `street-slang` · `smooth`.

## RULE (Robert 2026-09-02): no character without a personality
"We shouldn't be able to import characters without personalities." A face + a voice is NOT a character until it has a
**Personality Print v4**. Enforcement so far: the roster API returns `hasPersonality`; the CAST picker flags every face
`✓ PRINT` or `⚠ NO PERSONALITY` and shows an X/Y counter. Next: block show-casting a character that has no print.

## Personality prints — authored 2026-09-02 (parallel writers)
Full v4 print bundles at `lab/cast/library/<id>.json` for: renee-vaughn, andrew-hammond, imani-cole, nia-foster,
quincy-banks, marlon-pierce, cee-rah, deuce-carter, big-mike-vega, rico-delgado, kid-malik, kid-zaya, kid-tyler,
kid-emma, gran-pearl, pop-earl. (sonny-cash already had one.) Each: distinct blind_spot + disjoint metaphor pools +
signature lines + emotion_map + exclusive nonverbals, matched to its locked voice.

## KIDS NEWS show (Robert 2026-09-02): a real story, retold for kids
Format card `kids-news` in `lab/formats.json` (news-desk variant, editorial_mode=explanation, host_job=teacher,
cooperative not debate). KID LAWS: wholesome, no scary detail, adult stakes -> kid-world stakes (fairness/sharing/
safety/feelings), facts stay TRUE. Default cast (Claude's pick per "you choose"): anchor = Malik (9, the excited
explainer); crew = Zaya (storyteller) / Tyler (fairness) / Emma (wonder); optional grown-up = Grandma Pearl or Renee.
