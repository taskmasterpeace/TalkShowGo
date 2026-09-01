# The Universal Talk-Show Format System

Replaces the old `show_types.json` 8-slot model. The old model broke because it mixed
three different things and modeled **booking** ("is there a guest?") instead of **function**
("what human job does this episode require, is it mandatory, and what replaces it if the
person is unavailable?").

## The core rule

> **Model functions, not people. Model required roles, optional roles, and substitutes,
> not "guest: true".**

"Guest" describes how someone was booked. It says nothing about what they do inside the
format. On a debate they occupy a *challenger* seat; on an interview show they *are* the
episode; on a desk show they are an *optional proof*. A single `guest` boolean is useless.
Every format instead declares a **cast topology** of roles, which roles are **required**,
which are **optional**, and a **fallback** for each.

## The three layers (keep them separate)

The old slots tangled these. They are now distinct fields, and the last one is a
**separate file**:

1. **Series identity** — what never changes across episodes (spine, container, atom,
   editorial mode, host job, signature payoff). Section A of a format card.
2. **Episode grammar** — how one installment moves (entry, blocks, assembly branch logic,
   escalation, payoff, close, afterlife). Section C of a format card.
3. **Production configuration** — how many avatars/cameras/clips/lower-thirds render it.
   This is the **production skin** (`production_skins.json`), bound at render time and
   **independent** of the editorial skeleton. The same "Moderated Collision" skeleton can
   render as three people at a desk, three remote windows, animated characters, or one host
   answering prerecorded opposition.

## The 14-part format card (the universal data model)

Every format is one card. Cards live in `formats.json`. Fields:

### A. Series DNA (identity — never changes)
1. **spine** — the permanent audience promise. Must contain a verb: *debates, investigates,
   exposes, ranks, interrogates, explains, predicts, tests, reveals.*
2. **episode_container** — what holds a complete installment: `person | major_story |
   daily_bundle | debate_slate | system | ranking | case | weekly_bundle`.
3. **segment_atom** — the smallest repeatable unit *inside* the episode: `debate_proposition |
   contradiction | claim_evidence | question_answer | ranked_item | round | document |
   clip_reaction | clue_link | mechanism | issue | story_build`. (Container ≠ atom. First Take
   container = the day's sports talk; atom = one disputed question.)
4. **audience_value** — what the viewer leaves with: `understanding | verdict | laughter |
   disclosure | prediction | action`.
5. **editorial_mode** — the intellectual product: `reporting | explanation | analysis |
   opinion | debate | review | satire | prediction | hybrid`.
6. **host_job** — dominant host function (one dominates; may combine two): `narrator |
   investigator | advocate | moderator | interviewer | referee | comic | teacher | judge |
   audience_surrogate | provocateur`.
7. **signature_payoff** — the recurring answer shape: `reveal | verdict | winner | concession |
   disclosure | ranking | system_explanation | solution | prediction | editorial`.

### B. Cast logic (functions, not names)
8. **topology** — a human-readable string in role letters (e.g. `M + A + B`, `H + [E/W]`,
   `H + (S/E) + P + P + [P]`). Display only; `slots` is the machine truth.
9. **slots** — the structured seat list. Each slot: `{id, role (a letter) OR one_of (letters),
   required, substitution}`. Multiplicity = multiple slots (`panel_1`, `panel_2`); a seat that
   either type can fill = `one_of`; optional = `required:false`. **Every slot carries a
   mandatory `substitution`** — what replaces this human FUNCTION when the seat is empty. An
   `abort` / switch-format outcome IS a valid substitution (that is exactly what
   SUBJECT_REQUIRED means). No host exemption: the host seat's substitution is normally
   "recast from the cast pool".
10. **relationship_physics** — *why* these roles create energy: `adversarial | cooperative |
    prosecutorial | teacher-student | skeptic-believer | insider-outsider |
    subject-interviewer | judge-competitors | straight-comic | expert-surrogate`.
    (The number of people never creates the format. Their relationship does.)
11. **human_dependency** — the fallback scale (see below).

### C. Episode grammar (how one installment moves)
12. **entry_ritual** — broader than "cold open": `strongest_clip | mystery | forced_choice |
    joke | accusation | artifact | guest_ritual | stakes_announce | confrontation_preview`.
    Establishes *how the audience should watch*.
13. **base_sequence** — the mandatory ordered block ids from `blocks.json`. Optional blocks do
    NOT live here; branches insert them.
14. **branches** — structured conditional logic, not prose. Each branch:
    `{when, op (insert|replace|remove|merge|abort|note), block/blocks, after|before|target|into, note}`.
    Conditions branch on **filled slots** (`slot proof filled`), runtime, or a premise change —
    **never on booking status**. e.g. `{when:"slot proof filled", op:"insert",
    block:"expert-interview", after:"thesis-connect"}`.
15. **evidence_devices** — how proof enters: `documents | video_clips | statistics |
    timelines | demonstrations | screenshots | gameplay_footage | eyewitness |
    expert_explanation | opposing_statements | before_after | live_experiment`.
16. **escalation_curve** — how the episode gets more consequential (not necessarily louder):
    stronger evidence, personal stakes, harsher counter, time limit, new participant,
    contradiction, elimination, live result, forced prediction, moral/financial consequence.
17. **payoff / close / afterlife** — payoff = the satisfying answer; close = the final on-air
    ritual; afterlife = `poll | comments_question | cta | source_list | guest_plug |
    next_tease | shorts | newsletter | community_debate`.

(That is 14 conceptual parts; some expand into paired fields. The card is the compiler's
input contract.)

## The truth contract (editorial labeling)

Do **not** label a whole show "fact-based" or "opinion-based." Competent shows mix both.
Label the **claims and blocks**. Every meaningful claim carries one:

| Label | Meaning |
|---|---|
| `FACT` | independently supported |
| `ATTRIBUTED_CLAIM` | someone said or reported it (name the source) |
| `ANALYSIS` | interpretation derived from facts |
| `OPINION` | declared judgment |
| `PREDICTION` | forecast with stated uncertainty |
| `SATIRE` | comedic exaggeration on a recognizable premise |

Each format declares the `truth_contract` claim types it traffics in; each block declares its
`claim_mode`; the generated Source-and-Claim Map tags every load-bearing line. This is the
editorial-truth system the old model lacked — without it the generator eventually presents
interpretation as fact. **The global bright lines in `cast.json` shared_rules still override
everything; the truth contract is how a format stays honest *within* those lines.**

## Role vocabulary and topology notation

`H` host/narrator · `M` moderator · `A` advocate · `B` challenger · `E` expert · `W` witness ·
`S` subject · `C` correspondent/comic foil · `P` panelist. `[X]` = optional. `X/Y` = one role,
either type. The **cast** (`cast.json` hosts + generated guests) supplies the personnel that
*fill* these role slots; the format owns the slots, not the people.

## Human dependency scale (the fallback core)

| Level | Meaning | Fallback |
|---|---|---|
| `NONE` | host completes the show alone | — |
| `OPTIONAL_PROOF` | an expert/witness strengthens but isn't required | interview → document walkthrough / timeline |
| `OPTIONAL_MODULE` | the interview is a replaceable section | drop it, run more desk/correspondent |
| `REQUIRED_COUNTERPART` | another voice must exist (co-host, rotating analyst, caller, clip, or AI character) | debate → strongest counterargument + host response |
| `SUBJECT_REQUIRED` | the person *is* the episode | none — pick a different episode/format |
| `MULTI_MODULE` | different people do different jobs in different portions | substitute per module |

## The block library (BLOCK GRAMMAR)

Reusable segment types live in `blocks.json`. Each block declares: `purpose, eligible_roles,
requires, claim_mode, evidence_required, input, output, duration_s, escalation (0-5), fallback`.
`eligible_roles` = any ONE of those role types MAY lead the block; the compiler binds each
occurrence to a filled slot of a matching role (not all listed roles participate). `requires` =
role types that must ALL be co-present (each satisfied by a filled slot); absent = a
single-performer block. **Block-level cite-or-cut: any block whose `claim_mode` includes FACT or
ATTRIBUTED_CLAIM must declare at least one evidence device.**
`entry_cue`/`exit_condition` are derived by the compiler from surrounding blocks, not stored.
Formats reference blocks by id and order them via `base_sequence` + `branches`. This is what
lets one show survive different filled seats, runtimes, and material.

## Editorial skeleton vs production skin (the load-bearing separation)

The **format card is editorial only**. Rendering config lives in `production_skins.json`:
avatar count, camera layout, set, graphics, remote feeds, lower-thirds, engine. A skin binds
to a format at render time. Keep them independent so the same skeleton renders many ways and
so a cheap render (one host + prerecorded opposition) and an expensive one (three avatars)
are the *same episode*, different skin.

## The seven components this system is

1. **Universal data model** — the 14-part card (this doc + `formats.json` schema).
2. **Format presets** — `formats.json` (10 presets; the 6 canonical + 4 house formats: open-panel, opinion-single, rapid-wire, news-desk).
3. **Block library** — `blocks.json`.
4. **Cast-role assignment** — the producer maps `cast.json` personnel → format roles per
   episode (respecting processing-collision casting; bright lines global).
5. **Truth & evidence labeling** — the truth contract above + per-block `claim_mode` + the
   Source-and-Claim Map in output.
6. **Fallback logic** — `human_dependency` + per-slot `substitution` + `branches`.
7. **Production skin** — `production_skins.json`, separate and swappable.

## Migration from `show_types.json`

| old type | new preset | note |
|---|---|---|
| `head-to-head` | `moderated-collision` | 1:1 |
| `the-desk` | `news-desk` | 1:1 — the nightly multi-story anchor desk (A-block / B-block / C-block / Last Word) preserved as its own preset, with the measured-delivery / direct-address / ends-one-step-short laws. |
| `the-panel` | `open-panel` | the proven multi-host floor engine, preserved |
| `the-take` | `opinion-single` | solo advocate |
| `hot-wire` | `rapid-wire` | the call-in is an editorial outsider character (its phone-EQ SOUND is a skin property, not a format field) |
| — | `evidence-mystery` | NEW (Maddow's investigative single-story build) |
| — | `satirical-news-desk` | NEW (modular desk + correspondent) |
| — | `system-expose` | NEW (solo researched deep dive) |
| — | `pressure-interview` | NEW (one subject, escalating challenge) |
| — | `hybrid-forum` | NEW (monologue + interview + panel + editorial) |

`show_types.json` is retained only until the producer/desk UI and the SHOWPLAN stage read
`formats.json`; then it is deleted. The `_law` from the old file (bright lines global, cast
independent of type) carries forward unchanged.

## The SHOWPLAN compiler contract (the next component)

The data model above is complete; the **SHOWPLAN compiler** that consumes it is the next
component to build. These are its responsibilities — declared here, not yet implemented — and
the data already carries everything they need, so building the compiler does not require
changing the format cards:

- **Predicate evaluation.** Branch `when` strings are a typed predicate language the compiler
  owns: `slot <id> filled` / `unfilled` / `filled as <ROLE>`, `runtime<Nm`, `runtime long`,
  `breaking-news-changes-premise`, `<field> <op> <value>`. Branches evaluate **top-to-bottom**;
  later branches see earlier edits.
- **Occurrence resolution.** A `base_sequence` entry is a block id (string) or `{block, bind}`
  binding that occurrence to a slot (e.g. the two `opening-argument` entries bind `side_a` /
  `side_b`, targeted as `opening-argument@side_b`). The compiler assigns stable occurrence ids
  and resolves each block's `requires` roles to concrete filled slots; a block whose `requires`
  cannot be satisfied is dropped or its format aborts per the governing branch.
- **Uncertainty qualifier.** `UNCERTAINTY` is not a truth label. The compiler tags every
  `PREDICTION` (and any hedged `ANALYSIS`) claim in the Source-and-Claim Map with
  `uncertainty:true`, and the writer must voice the hedge. Enforced at output time, not stored.
- **Capacity negotiation.** At bind time the compiler compares the manifest's peak concurrent
  tracks to the skin's `capacity`; over-capacity manifests overflow to inserts (video) or the
  pairing is rejected for a higher-capacity skin.
- **Cast-role assignment.** The producer fills each format slot from `cast.json` personnel (or
  generated guests) by the processing-collision rule; bright lines stay global.

A local checker (`scratchpad/validate_formats.py`) already enforces the static invariants the
compiler will rely on: block-id coverage, truth-contract subset, slot↔eligible-role and
`requires` fillability, per-slot substitution, evidence coverage, block-level cite-or-cut, and
editorial/production separation in both directions.
