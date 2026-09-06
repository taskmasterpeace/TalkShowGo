# THE JUNIOR DESK — "CNN for Kids" Architecture
*How TalkShowGo produces real news, safely retold for 8-year-olds. (Robert's ask, 2026-09-04)*

## The core answer to your question
You asked: do we need one show, one way to process stuff, or a change to our sources?

**We need ONE NEW LENS + ONE SAFETY GATE. Nothing else changes.**

TalkShowGo is already: `RESEARCH (real sources → cited evidence) → RENDERERS (debate floor, episode, brief...)`.
The kids product is just a **new renderer** on the same research — the facts don't change, the *telling* changes.
Same stringer, same dossiers, same voice pipeline, same episode stitcher. One new show type: `junior-desk`.

```
same research dossier
        │
producer picks stories  ←── (the existing daily-show propose flow, with a kid rubric)
        │
   JUNIOR LENS          ←── rewrite for age 8: vocabulary, analogies, no fear framing
        │
   THE G-CHECK          ←── independent safety judge (our blind-judge pattern, aimed at safety)
        │                   fails → auto-rewrite → re-check
   kid cast reads it    ←── Breeze voices, same render chain
        │
episode + shorts + thumbnail
```

## 1. The Producer Rubric (what gets covered — humans decide)
The ENGINE can tone anything down; the PRODUCER decides what deserves coverage. Three lanes:
- 🟢 **Green** — science, space, animals, sports, inventions, community heroes, weather, records. Auto-eligible.
- 🟡 **Yellow** — elections, economy ("why groceries cost more"), conflict *at the summary level*, laws, strikes.
  Eligible ONLY through the full gate, dual-perspective required.
- 🔴 **Red** — graphic violence detail, adult subject matter, active tragedies with victims' names. Not covered.
  Not because the engine can't sanitize it — because an 8-year-old doesn't need it. The rubric is the product.

## 2. The Junior Lens (the rewrite rules)
- **Vocabulary at grade 3** — checked mechanically (readability score), not vibes.
- **Analogy-first explaining**: "a tariff is like a fee for bringing toys in from another neighborhood."
- **No fear framing**: what happened → what's being done → *"look for the helpers"* (the Mister Rogers rule —
  every heavy story ends on the people fixing it and one thing a kid can understand or do).
- **Numbers rounded, names minimal, zero speculation** — kids get confirmed facts only, which our
  cite-everything dossier already enforces better than most adult news.
- **Curiosity voice, not authority voice**: the anchor wonders *with* the kid, never lectures.

## 3. Politics & Religion (the two you named — the hard requirement)
This is where most attempts die. The rules that make it safe:

**Politics = explain the DISAGREEMENT and the PROCESS, never the winner.**
Template: *what happened → why some grown-ups think X (their real reason, steel-manned) → why others think Y
(same respect) → how it gets decided (a vote, a court, a meeting) → "ask your grown-ups what they think."*
The kid anchor NEVER has a side. The G-Check literally counts: both perspectives present? equal respect? no
loaded adjectives? — fail any one and it bounces back.

**Religion = what neighbors believe and celebrate, never what's true.**
Covered as culture and community: what the holiday is, what the tradition means to the people who keep it,
"lots of families believe different things, and that's how neighborhoods work." No truth-claims, no ranking,
no mockery — and the G-Check enforces a respect-framing test the same way.

These two get a **mandatory second pass** (two independent model checks must both pass) because they're the
reputational blast radius.

## 4. The G-Check (the engineering heart)
Same pattern as our blind Codex judge, pointed at safety instead of quality. Every script is graded by an
independent model against a fixed checklist before it can render:
- fear level (would this scare a sensitive 8-year-old?)
- reading level ≤ grade 3-4
- neutrality (politics/religion dual-perspective tests)
- zero adult themes, zero graphic detail, zero speculation
- ends with helpers/agency
- factual claims still trace to the dossier's cited evidence (cite-or-block survives the rewrite)

Fail → automatic rewrite with the failure reasons → re-check. Two consecutive fails → producer review, never
auto-publish. We PROVED this verify-loop pattern works in the self-improve loop; this is the same machine.

## 5. The Kid Cast (the fun part)
Same cast system, new prints. Proposed starting three:
- **Zoe (11)** — the anchor. Endlessly curious, asks the question the kid at home was thinking.
- **Marcus (10)** — the "but WHY?" co-host. His job is literally to make the show explain it again, simpler.
- **Grandpa Joe** — one adult character for the heavy 🟡 stories: warm, unhurried, the safe lap for hard news.
  (Mixing one grown-up in is deliberate — some stories should come from a grown-up voice.)

**Faces: use ILLUSTRATED/animated avatars for the kids, not photoreal.** Photoreal AI children on social
media is the wrong move on every axis (uncanny, platform-sensitive, bad optics). Friendly cartoon anchors are
safer, more brandable, and kids like them more anyway. (Deliberate exception to our photoreal-portrait rule.)
Voices: bright young-teen designs from Breeze — reads "kid show" without the uncanny valley of cloned children.

## 6. Distribution — the TikTok question, answered honestly
You flagged it yourself: **under-13s can't hold TikTok accounts** (COPPA; TikTok is 13+). So "TikTok for kids"
actually means:
- **YouTube is the real home.** It has an official **"Made for Kids"** designation + the YouTube Kids app —
  the one platform with a front door built for this exact product. Episode + Shorts both live there.
- **TikTok/IG target the PARENTS.** The account is brand-run (adults), clips framed "show this to your kid /
  watch together." Parents ARE the distribution channel for under-13 — that's how every successful kids-news
  account already works.
- **No comments, no data games** — the Made-for-Kids designation handles the compliance posture for us.

## 7. MVP path (small, provable)
1. Build the kid cast (3 prints + voices + avatar art) — a day of the same casting work we just did.
2. `junior-desk` lens + G-Check — one new renderer + one judge prompt on the existing pipeline.
3. **Pilot episode**: 3 producer-picked stories — one 🟢 (space/animals), one 🟢 sports (Falcons for the kids!),
   one 🟡 (an election explainer) to prove the gate on the hard case.
4. Judge it with the safety rubric the way we judge shows now. Iterate. THEN shorts + thumbnail branding.

## Name ideas
**The Junior Desk** · **Big World, Little News** · **The What's Up** · **KidWire** · **News for Us**

---
*Bottom line: the research machine you already built is the hard part, and it's done. Kids news is one lens,
one gate, three small voices — and it inherits cite-or-block, which is exactly what a kids product must have.*
