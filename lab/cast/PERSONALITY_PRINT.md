# PERSONALITY PRINT v4 (evolved from Robert's Personality Print Framework 3.0)

The old 3.0 (and the `personality_prints` table in migration 001) was built for describing a person.
v4 is built for RUNNING one: every field either changes what the writer model generates, what the
voice model performs, or how the allocator behaves. If a field can't change output, it's gone.

## What was KEPT from 3.0 (consolidated - 3.0 had "Pace" three times)
- Speech & tone (tone, pace, formality, slang/cursing, vocabulary) -> **SPEECH**
- Sentence structure, emphasis tactics, question types, debate style -> **ARGUMENT**
- Evidence types, focus areas, problem-solving style -> **PROCESSING**
- Emotional range, expressiveness, humor style -> **EMOTION**
- Knowledge base, expertise, cultural references -> **KNOWLEDGE**
- Idioms, metaphor pools, motifs -> **LEXICON**
- Motivation, self-view -> **DRIVES** (two lines, not a chapter)

## What was THROWN OUT (can't be used today)
- Non-Verbal Communication (facial expressions, body language, listening skills) - meaningless for
  text + TTS; returns at the AVATAR stage as its own block
- Ethics & Influence (effectiveness, impact-on-decision-making) - non-operational fluff; the global
  bright lines already govern ethics
- All duplicate/near-duplicate fields; all "medium/high" ratings that don't change a single token

## What was ADDED (the v4 difference)
1. **PROCESSING - how they take in information** (Robert's ask): what they notice FIRST in a story,
   how they reason (gut / receipts / history), what CONVINCES them, what they DISMISS, their BLIND
   SPOT, and how they change their mind. Blind spots are load-bearing: two hosts with different
   blind spots disagree HONESTLY - that's where real heat comes from.
2. **THINGS THEY SAY** (Robert's ask): signature lines, example exchanges, opener/comeback/concession
   moves. Models imitate examples, not adjectives (proven in the engine loop).
3. **VOICE (Breeze-fused)**: the design aesthetic, seed, ref transcript, default delivery, and an
   **emotion map** - named states -> exact Breeze instruction strings - plus nonverbal habits from
   the official tag set ((laugh)/(sigh)/(clears throat)/(cough), per the breeze-tts-2 skill).
4. **CONTRAST CARD**: what makes this host unmistakable against the rest of the cast in a blind
   who-said-this test. Distinctness is a CONTRACT, measured by the judge harness, not a vibe.
5. **MACHINE block**: model binding, temperature, allocator knobs - the bundle law unchanged.

## The schema (per cast member, in cast.json `print`)
```
essence            2 lines - who this is on the mic
speech             tone, pace, register, profanity, sentence shape, delivery habits
processing         notices_first, reasons_by, convinced_by, dismisses, blind_spot, mind_change
argument           how they attack, question style, concession style, verdict style
emotion            default state, the heat curve, humor style, the signature flip
knowledge          what they actually know deep, eras/domains, references they reach for
lexicon            registers, metaphor pools, motifs, banned-for-them words
things_they_say    signature_lines[8-12], example_exchanges, moves {opener, comeback, concession}
contrast           one line per other cast member: how you can NEVER be confused with them
drives             what they want, self-view (one line each)
```
`voice` (sibling of print): aesthetic, seed, ref_text, default_instruction, emotion_map{}, nonverbal_habits.

## Generation (guests)
`lab/engine/gen_personality.mjs` / `POST /api/command/personality` builds a full v4 print from a
name + description, with the existing cast's contrast cards passed as constraints so every generated
guest lands DISTINCT by construction. Guests live in `lab/cast/guests/` and can be pulled onto any
show type that seats them (HEAD TO HEAD debaters, THE DESK drop-ins, HOT WIRE callers).
