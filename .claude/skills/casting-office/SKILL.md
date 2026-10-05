---
name: casting-office
description: Use when creating a new host/character for the cast, generating or auditioning voices, or inspecting personality prints. The personality-first flow at /command/casting. Triggers on "new host", "create a character", "audition voices", "see the personalities", "hire them to the cast".
---

# The Casting Office — the personality makes the voice

UI: `/command/casting` (CASTING in the rail). Robert's law: generate the PERSONALITY first; the print writes the voice description; hear candidates; then lock.

## The flow
1. **Describe the person** → `POST /api/command/personality` generates a full Personality Print v4 (free, cupcake qwen3:30b, 30-90s), fed every existing host's essence as constraints so the newcomer is distinct BY CONSTRUCTION. Saved to `lab/cast/guests/<slug>.json` — resumable.
2. **The print writes the voice** — `voice.aesthetic` comes out of the print. Edit in plain words: `+gravelly, -fast` (the clarity term always stays glued LAST).
3. **Audition** — `POST /api/command/voice {action:'audition', aesthetic, ref_text, seed}` renders candidates to `lab/cast/voices/candidates/` (never touches locked refs; honestly 409s when a video job owns the GPU). **The seed IS the identity**: same description, seeds N/N+1/N+2 = three different people auditioning.
4. **Hire** — `{action:'hire', guest_id, candidate, aesthetic, ref_text, seed}` → full bundle into cast.json (proven fast seat gpt-4.1-mini/0.9, dna_id must exist in models.json — use 'openai/gpt-4.1-mini'), candidate becomes the LOCKED ref at `lab/cast/voices/<id>.wav` + `.ref.txt` (prior ref backed up `.prev.wav`). Bootstrap-to-clone law: all production clones this exact take forever.

## Voice description law (the FIELD GUIDE panel teaches this in-app; breeze-tts-2 skill is the deep authority)
Order: gender/age → role → pitch+timbre → texture → accent → pace → register → personality, telegraphic commas, 30-60 words, **ALWAYS ending "clear, full-bodied, close-mic studio quality"** (without it you can roll a muffled telephone voice — the model OBEYS acoustic words; "phone quality" is only ever a deliberate caller character). CFG law: design 4.0, clone 1.0, nothing else.

## Seeing the personalities
CAST page → every host card has a **▸ FULL PRINT** expander (all 10 sections + catchphrase). All 19 hosts carry complete 10/10 prints (verified 2026-09-07). Hand the WHOLE bundle to generation, never just a name.

## Nonverbals (what Robert loves)
Live in the SCRIPT, not the voice: `(laugh) (sigh) (clears throat) (cough)` placed where the sound belongs, ≤1/line. Sustained states (whisper, breathless) are per-line delivery directions — the floor writes them from the print automatically.
