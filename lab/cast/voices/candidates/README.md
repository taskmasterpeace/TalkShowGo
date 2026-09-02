# Voice candidates (2026-09-02): pick by ear

Robert: "I don't like those two male voices. I think we need other ones." Marcus Blaze's and King Knowledge's current
refs (`../blaze.wav`, `../knowledge.wav`) are REJECTED but stay live until a pick is locked. Champagne Dwayne is new and
has no locked ref yet: the renderers use his `candidate_default` (A) from this folder until a pick is locked.

**Listen to `LINEUP.mp3`**: all nine, in this order, 0.6 s gaps, every voice leveled to -16 LUFS (per speaker) then the
whole reel mastered (I -16 / TP -1.5 / LRA 11). Each candidate slates itself ("Candidate Blaze B.") and then says that
host's own reference line, the SAME words across A/B/C, so what you are comparing is the voice and nothing else.

| file | host | label | seed | Breeze design prompt (cfg 4.0) |
|---|---|---|---|---|
| `blaze-A.wav` | Marcus Blaze | live sports-radio drive-time host, less cartoon boom | 212 | Masculine, American man in his late thirties, live sports-radio drive-time host, mid baritone with natural chest resonance, grounded real-broadcaster projection, slightly husky texture, general American accent, quick conversational pace that builds in runs, passionate and incredulous but never a cartoon, clear full-bodied close-mic studio quality |
| `blaze-B.wav` | Marcus Blaze | younger, faster, Atlanta | 222 | Masculine, Black American man in his late twenties from Atlanta, sports-debate podcaster, energetic higher tenor-baritone, bright and punchy, Atlanta southern accent, fast pace with rhythmic emphasis, animated and playful, laughs easily, clear crisp close-mic studio quality |
| `blaze-C.wav` | Marcus Blaze | big but warm, church-organ chest | 232 | Masculine, Black American man in his forties, big warm broadcaster, deep resonant bass-baritone with church-organ chest, smooth rich texture, general American accent with southern warmth, measured pace that swells when excited, warm booming sincerity, commanding and generous, clear full-bodied close-mic studio quality |
| `knowledge-A.wav` | King Knowledge | warmer elder, less movie-trailer | 313 | Masculine, Black American man in his early sixties, barbershop elder, warm low baritone, soft worn gentle texture, general American accent with an older-generation cadence, slow unhurried pace, calm and wise with dry play underneath, conversational not cinematic, clear close-mic studio quality |
| `knowledge-B.wav` | King Knowledge | lighter, quicker, a barber who reads | 323 | Masculine, Black American man in his mid fifties, a barber who reads, medium-light baritone, lively and articulate, light texture, general American accent, quicker conversational pace with a storyteller's rhythm, amused and knowing, teasing warmth, clear crisp close-mic studio quality |
| `knowledge-C.wav` | King Knowledge | deep but conversational, no gravel | 333 | Masculine, Black American man in his late fifties, elder statesman, deep smooth bass-baritone, clean polished resonant texture, general American accent, easy conversational pace with air after the important line, calm certainty and quiet authority, clear full-bodied close-mic studio quality |
| `dwayne-A.wav` | Champagne Dwayne (default) | silk lounge | 404 | smooth, silky mid-thirties Black American man, laid-back champagne-lounge baritone, playful and sing-song when he is amused, a little flashy, unbothered, close-mic late-night radio warmth, clear full-bodied studio quality |
| `dwayne-B.wav` | Champagne Dwayne | playful high-energy flash | 414 | Masculine, Black American man in his early thirties, flashy nightlife host and hype personality, bright mid-baritone, smooth but lively texture, general American accent, quick playful pace with a sing-song lilt, charming and self-satisfied, laughs before the punchline, clear crisp close-mic studio quality |
| `dwayne-C.wav` | Champagne Dwayne | low late-night | 424 | Masculine, Black American man in his late thirties, late-night quiet-storm radio host, low intimate bass-baritone, velvet texture, general American accent, slow unhurried pace with long smooth phrases, seductive calm, amused and unbothered, close-mic intimacy, clear full-bodied studio quality |

Every `.wav` has a sibling `.ref.txt` holding the exact words spoken (slate included). Together they are a lock-ready
reference pair: 24 kHz mono, single speaker, no music, exact transcript, 10 to 16 s. The recipes (seed + prompt) also
live in `lab/cast/cast.json` under each host's `voice.candidates`, which is what `render_breeze.mjs candidates` reads.

## How to lock a pick (example: Blaze B)

1. Copy the pair over the live ref, both files, so the transcript stays exact:
   `cp lab/cast/voices/candidates/blaze-B.wav lab/cast/voices/blaze.wav`
   `cp lab/cast/voices/candidates/blaze-B.ref.txt lab/cast/voices/blaze.ref.txt`
2. In `lab/cast/cast.json`, Blaze's `voice` block: set `"candidate_default": "B"`, copy candidate B's `seed` (222) and
   `aesthetic` up into `voice.seed` / `voice.aesthetic` (so a future `design blaze` re-roll starts from the winning
   recipe), and replace the REJECTED `_note` with the approval date. The print is untouched, so `persona_version` stays.
3. Add the row to `lab/engine/AUDIO_MANIFEST.md` for the new `blaze.wav` (words by / voiced by / seed). That is law.
4. Commit `lab/cast/voices/blaze.wav`, `blaze.ref.txt`, `cast.json`, the manifest. The refs ARE the voice lock.
5. Nothing else changes: every show clones per line from `lab/cast/voices/<host>.wav` (cfg 1.0 plain read, 4.0 directed).

Same for Knowledge (`knowledge.wav`) and Dwayne (`dwayne.wav`). Until Dwayne is locked, shows use `dwayne-A` from
this folder automatically (`candidate_default`); once `../dwayne.wav` exists it wins.

## Re-rolling, more letters, the box being busy

- Re-roll one candidate: delete its `.wav`, bump that candidate's `seed` by +1 in cast.json (seed ledger law: log it),
  then `node lab/engine/render_breeze.mjs candidates <blaze|knowledge|dwayne>`. Existing wavs are kept, only the
  missing one renders. `node lab/engine/render_breeze.mjs lineup` rebuilds `LINEUP.mp3` from disk, no GPU needed.
- A new letter (D, E, ...) is just a new entry under `voice.candidates` in cast.json.
- Tasha's ref is FROZEN (Robert approved 2026-08-31): `design tasha` refuses without `--force`, and she has no candidates.
- 409 from the gateway means the video engines hold the GPU: the renderer waits 60 s up to 5 times, then tells you to
  rerun the same command once `GET :8700/v1/health` shows `running:false` and `queue_depth:0`.
