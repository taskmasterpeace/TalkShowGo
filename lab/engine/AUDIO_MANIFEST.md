# AUDIO MANIFEST - what made every file
Law (Robert, 2026-08-31): every rendered audio file gets a row here the moment it exists. Words = who wrote the script; Voice = what spoke it.

| file | length | words written by | voiced by | cast/voice | notes |
|---|---|---|---|---|---|
| flareup_v2.mp3 | 1:40 | Claude (hand-written v2 convo demo, `lab/shows/kai-cenat-pullup/segment_flareup_v2_convo.md`) | Kokoro TTS on cupcake (mk-gateway /v1/audio/tts) | af_bella=Tasha, am_fenrir=Blaze, am_michael=KK, v1 flat concat | THE ONE ROBERT LIKED (words). Voices = draft Kokoro, RETIRED |
| pilot_script_A.mp3 | 6:40 | Claude (pilot Script A, hand-written) | Kokoro v1 (same trio) | same as above | first full pilot; "too many voices" complaint - Kokoro take-to-take wobble + backchannels as phantoms |
| pullup_narrator_11L_final.mp3 | 2:36 | Claude (single-narrator adaptation, `narration_single_v1.txt`) | ElevenLabs eleven_multilingual_v2 via aiobr generate-narration.js | Battlerap Algorithm (ZJ7BlVZrxZKBDMTIK5c9) | the channel's own narrator; costs 11L credits |
| pilot_3voices_v2.mp3 | 6:32 | Claude (pilot Script A) | Kokoro v2 (pitch-locked, backchannels cut) | af_bella / am_fenrir / bm_george(UK elder) | distinctness fix; Kokoro still RETIRED per Robert |
| (engine runs run_000-009 segments) | text only | qwen3:30b on cupcake Ollama (the FLOOR actor loop) | never voiced | - | the /loop iterations; judge-scored 3.25-3.45 |

| nonverbal_test_reel.mp3 | 0:49 | Claude (5 test takes, self-labeled) | **Breeze TTS 2** on cupcake (breeze-design refs -> breeze-clone w/ `instruction`) | designed cast: tasha seed 101 / blaze seed 202 / knowledge seed 303 | ROBERT'S NONVERBAL TEST: inline (laughs)/(sighs) tags vs instruction-only, breathing, whisper-to-shout |
| flareup_v3_breeze.mp3 | 1:59 | Claude (same v2 convo demo Robert liked at 1:40) | **Breeze TTS 2** breeze-clone, per-line instruction = delivery parentheticals | same locked designed cast | first full Breeze segment; ref-clip lock = no voice wobble by construction |
| flareup_v4_breeze.mp3 | 2:06 | Claude (same v2 convo demo) | **Breeze TTS 2**, CFG LAW applied (direction 4.0 / plain 1.0) | Blaze REDESIGNED at cfg 4.0 + studio-quality descriptors (seed 202) - phone voice fixed; Tasha/KK refs unchanged | the corrected cut per Robert's note |
| lab/cast/voices/*.wav | refs | - | breeze-design (seed-locked, cfg 4.0 since v4) | the canonical cast reference clips + ref texts | COMMITTED to git: these ARE the voice lock |

## Standing engine decisions (2026-08-31)
- **VOICE ENGINE = Breeze TTS 2 on cupcake** (`/v1/audio/breeze-design` + `/v1/audio/breeze-clone` w/ per-line `instruction` for emotion/nonverbals). Kokoro retired (draft-only wobble). ElevenLabs Battlerap Algorithm stays the narrator option.
- Cast reference voices live in `lab/cast/voices/` (designed once, seed-locked, cloned per line = consistency).
