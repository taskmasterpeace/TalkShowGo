# Breeze TTS 2 (BreezeBlue) — Definitive Research Report
**Date:** 2026-08-31 · Model open-sourced 2026-08-25 (6 days ago) · Researched for the AI talk-show product (self-hosted on our GPU box, official inference repo)

**Evidence classes used throughout:**
- **[OFFICIAL]** — BreezeBlue's repo/README, MODEL_LICENSE, HF model card + config.json, breezeblue.ai blog/pricing/terms, docs.breezeblue.ai, their benchmark repos, plus our local box dump (`scratchpad/breeze_repo/box_repo_dump.txt`, remote = github.com/breezeblue-ai/breeze-tts).
- **[COMMUNITY]** — third-party ports, articles, Artificial Analysis / AlphaSignal, HF discussions, GitHub issues.
- **[INFERENCE]** — my own analysis from the code/config; clearly flagged, verify before betting production on it.

---

## 0. Executive summary

1. **LICENSE VERDICT: our self-hosted box is PROTOTYPE-ONLY for AIOBR/talk-show.** The BreezeBlue Research and Non-Commercial License covers weights, derivatives **and self-hosted outputs**; "monetized content creation" is expressly a Commercial Purpose with **no creator/revenue-threshold exception** ([MODEL_LICENSE](https://raw.githubusercontent.com/breezeblue-ai/breeze-tts/main/MODEL_LICENSE)).
2. **There IS a commercial path, and it's cheap:** BreezeBlue's hosted API — any **paid** plan (from $9/mo Starter; $19/mo Creator ≈ 900 min) grants commercial rights to outputs generated while the subscription is active, surviving cancellation for those outputs ([terms](https://breezeblue.ai/legal/terms), [pricing](https://breezeblue.ai/pricing)). Free-tier outputs are non-commercial; credits alone don't grant rights; a hosted sub does **not** license the self-hosted weights. Self-host commercial = written license via contact@breeze.blue (RESONIA, INC).
3. **What it is:** ~3B-total stack (Qwen3-arch ~1B audio backbone + 100M depth decoder over Kyutai's **Mimi** codec @12.5 Hz/24 kHz + T5Gemma2 text encoder), CFG-driven instruction following, streaming, EN/ZH open weights; **verified #1 open-weight on Artificial Analysis** (Elo ~1217, ~#6 overall), beats Fish Audio S2 Pro by ~90 Elo.
4. **cfg_scale answer:** clone/plain reads = **1.0**; voice design & voice direction = **4.0** (official). Our client's **1.3 is wrong for design** — it's near-unguided sampling and is the most likely cause of the "telephone-quality" designed voice; also the shipped fast path only pre-compiles graphs for 1.0 and 4.0.
5. **Nonverbals:** official inline tags are only **(laugh), (cough), (clears throat), (sigh)** (EN parens / ZH square brackets); whisper/shout/cry/breathing are **instruction-driven**, not tags (the model's own direction benchmark has `vocal_events`, `physiological_state`, `acoustic_attributes` categories).
6. **Production recipe holds:** design→clone bootstrap is the right architecture — design each host once at cfg 4 with a fidelity-descriptor prompt + fixed seed, freeze the best take as a 10–20 s ref+transcript pair, then run everything as clone (cfg 1.0) / direction (cfg 4.0) per line, ≤ ~200 words per generation.

---

## 1. What it is

### Identity & release
- **Breeze TTS 2** by **BreezeBlue** (an AI research/product company; parent/legal entity **RESONIA, INC** — "BreezeBlue's parent company is Resonia" per [press release](https://natlawreview.com/press-releases/breeze-blue-unveils-breeze-tts-2-real-time-flagship-voice-ai-interactive); the license names RESONIA, INC as the commercial authorizer). **[OFFICIAL/COMMUNITY]**
- Open-sourced **2026-08-25**: weights on HF ([BreezeBlue/Breeze-TTS-2](https://huggingface.co/BreezeBlue/Breeze-TTS-2)), PyTorch inference at [github.com/breezeblue-ai/breeze-tts](https://github.com/breezeblue-ai/breeze-tts). Benchmark suites released 2026-08-07 ([voice design](https://github.com/breezeblue-ai/tts-voice-design-benchmark), [voice direction](https://github.com/breezeblue-ai/TTS-Voice-Direction-Benchmark), latency). Official demo Space: [BreezeBlue/breeze-tts-2-demo](https://huggingface.co/spaces/BreezeBlue/breeze-tts-2-demo). **[OFFICIAL]**
- **No paper.** The "paper they did" is the blog writeup ([breezeblue.ai/breeze-tts-2](https://breezeblue.ai/breeze-tts-2)) — it contains benchmarks and examples but **zero training details**. Training code/data undisclosed (open [issue #5 "Training Code?"](https://github.com/breezeblue-ai/breeze-tts/issues/5) unanswered). **[OFFICIAL — absence confirmed]**

### Architecture (from the HF `config.json` — the ground truth) **[OFFICIAL]**
Source: [config.json](https://huggingface.co/BreezeBlue/Breeze-TTS-2/raw/main/config.json)
- `BreezeForConditionalGeneration`, model_type `breeze`. Four components:
  1. **Backbone LM** — `Qwen3ForCausalLM` architecture, flavor **"llama-1B"**: hidden 2048, 28 layers, 16 heads (8 KV), head dim 128, intermediate 6144, RoPE llama3-scaled (theta 500000, factor 32), **max_position_embeddings 2048**.
  2. **Depth decoder** — flavor **"llama-100M"**: hidden 1024, 12 layers, 8 heads, max positions **33** (it iterates across the codebooks of each audio frame).
  3. **Text encoder** — **T5Gemma2TextEncoder**: hidden 1152, 26 layers, 32768 max positions, sliding window 512.
  4. **Audio codec** — **Mimi** (Kyutai's streaming codec): **12.5 Hz frame rate, 24000 Hz sample rate, mono**, 16 codebooks used (codebook size 2048, dim 256; 32 quantizers in codec; upsampling [8,6,5,4]).
- Vocab: text 262158 (Gemma-family), audio vocab 2051; special tokens `<|AUDIO|>` (id 262144), `<|audio_eos|>` (262145), **speaker tokens [S0]–[S9]**, instruction tokens `<ins_bos>`/`<ins_eos>`. bf16.
- Weights: 2 safetensors shards, **6.96 GB** (~7.68 GB repo incl. tokenizer 33.4 MB, separate `audio_tokenizer` dir) → ~3.5B params total, matching the "3B" marketing. ([file tree](https://huggingface.co/BreezeBlue/Breeze-TTS-2/tree/main))
- **[INFERENCE]** This is the **Sesame-CSM recipe** (LM backbone predicts codebook-0 + a small depth transformer fills residual Mimi codebooks per frame), upgraded with a Qwen3-arch backbone and a T5Gemma2 text encoder feeding CFG-able conditioning. It is an **LM-over-codec-tokens** model — **no flow matching / no diffusion**; streaming falls out naturally because Mimi decodes causally frame-by-frame at 12.5 Hz. "RESONIA" is the **company**, not the backbone; the backbone is Qwen3-architecture at llama-1B dimensions.
- **[INFERENCE — capacity math]** Backbone context 2048 positions @ 12.5 Hz ⇒ absolute ceiling ≈ **163 s of audio tokens per generation, minus text + reference-audio frames**. This is why every serving stack chunks long text (see §7).

### How generation works (from `breeze_infer/templates.py` in our box dump) **[OFFICIAL code]**
- Plain TTS: `[S0]{text}` → audio tokens.
- **Voice design / instruction TTS** (`tts_instruction`): `[S0]<ins_bos>{instruction}<ins_eos>{text}`; the **CFG negative branch is the same request WITHOUT the instruction** — so cfg_scale amplifies exactly the delta the instruction adds.
- **Voice clone** (`ref_clone_tata`): `[S0]{ref_text}` + `<|AUDIO|>` ref frames + `[S0]{text}` — in-context imitation (TATA = text-audio-text-audio pattern).
- **Voice direction** (`ref_edit_tata`): ref_text + ref audio + `[S0]<ins_bos>{instruction}<ins_eos>{text}`; **negative branch = pure clone**, so CFG pushes toward the instruction while the ref anchors identity. A `build_dual_branches` variant exposes three branches (uncond / ref / ins) for multi-axis guidance.
- The official API server (`breeze_infer/api.py`) exposes **`POST /v1/audio/speech`** (+ `GET /health`): fields `text`, `instruction` (default **"Speak clearly and naturally."**), `cfg_scale` (default **1.0**, validated only ">0 and finite"), `ref_audio` file, `ref_text`, `seed` (default **42**, `set_all_seeds` per request). No ref → `tts_instruction`; with ref → `ref_edit_tata`. Streams **mono 24 kHz s16le PCM**; **single concurrency** (threading lock; concurrent request → "An inference request is already running."). **No text chunking exists upstream** — our 260-word chunker is our wrapper's own. (`breeze_infer` = just `api.py, audio.py, runtime.py, templates.py`.)
- **Our wrapper mapping [INFERENCE about our own box]:** our `/v1/speak` (text+design+cfg+seed) = the `tts_instruction` template with design-as-instruction; our `/v1/clone` (ref_audio_b64+ref_text+instruction) = `ref_edit_tata`. Note upstream **always** injects an instruction when a ref is present (default "Speak clearly and naturally.") — a "pure" clone is just direction with the default instruction at cfg 1.0.

### Performance (self-hosted) **[OFFICIAL README]**
- **TTFA < 40 ms**, **RTF 0.32 (~3.1× real time)** with warmed **fast path** on H100; eager ~**7.7 GiB** VRAM (12 GB GPU min), `--fast-all` ~**14.4 GiB** (24 GB GPU rec). Docker targets sm90 (H100); `FLASH_ATTN_CUDA_ARCHS=80` for A100.
- Fast path (`configs/fast.json`, our dump): `concurrency: 1`, `freeze_after_warmup: true`, **`cfg_scales: [1.0, 4.0]`** (CUDA graphs pre-compiled for exactly these), text-encoder graphs at token lengths 32/64/96/128.

### Benchmark position — verified **[COMMUNITY, incl. Artificial Analysis' own posts]**
- **#1 open-weight confirmed**: Artificial Analysis' account: "Breeze TTS 2 is now the leading Open Weights TTS model in the Artificial Analysis Provider Voices Speech Arena, surpassing Fish Audio S2 Pro by 90 Elo points" ([AA on X](https://x.com/ArtificialAnlys/status/2092399623839326550)).
- **Elo 1,215–1,217.5**: AlphaSignal reported **1,215**, **#6 overall of 100+**, behind Sonic 3.6 (1,283), Qwen-Audio-3.0-TTS-Plus (1,238), Simba 3.2 (1,238), Luna TTS (1,223), v3 Conversational (1,219); Fish Audio S2 Pro previous open leader at 1,125 ([AlphaSignal](https://alphasignal.ai/news/breezeblue-s-breeze-tts-2-tops-open-weights-voice-ai-with-1-215-elo)). AA's [model page](https://artificialanalysis.ai/text-to-speech/models/breeze-tts-2) currently shows **Elo 1217.51** (a "28 of 101" figure on that page appears to be a table/filter counter, not the rank — the #1-open-weight/#6-overall standing is the corroborated one). Arena tracks: "Provider Voice" vs "Controlled Voice"; these numbers are the Provider Voice arena.
- **Throughput/pricing on AA**: 45 chars/sec via BreezeBlue's hosted endpoint (vs Fish S2 Pro 102 chars/s), listed at **$34/1M chars** ([AA on X](https://x.com/ArtificialAnlys/status/2092399632676704266)).
- **BreezeBlue's own benchmarks** ([blog](https://breezeblue.ai/breeze-tts-2)): Voice-design **Role Fit 78.02 / Voice Diversity 708 clusters** (vs MiMo-V2.5-TTS 72.78/202, Inworld VD 64.61/378, Fun-AudioGen-VD 63.82/136, Eleven v3 58.88/111, Qwen3-TTS-VD 58.48/83, VoxCPM2 55.28/509); Voice-direction **VDS 4.25 / SPK_SIM 0.67** (vs MiMo-v2.5 3.76, StepAudio 2.5 3.48, Qwen-Audio 3.0-TTS-Plus 3.33, Inworld TTS-2 3.01, VoxCPM2 2.49); hosted latency **TTFB p50 119.4 ms / TTFA p50 133.6 / p95 163.3** vs ElevenLabs Flash v2.5 (154.5 TTFA p50), Cartesia Sonic 3.5 (241.9), ElevenLabs v3 (628.7). Self-reported; VDS judged by gemini-3.1-pro-preview 1–5 rubric, SIM via fine-tuned WavLM-Large ECAPA ([direction benchmark](https://github.com/breezeblue-ai/TTS-Voice-Direction-Benchmark)).

---

## 2. LICENSE (the critical section)

### The split **[OFFICIAL]**
- **Source code (inference repo): Apache 2.0.** Free for anything, including commercial — the *code*, not the model.
- **Model weights, checkpoints, adapters, derivative models, and SELF-HOSTED OUTPUTS: "BreezeBlue Research and Non-Commercial License"** ([MODEL_LICENSE](https://raw.githubusercontent.com/breezeblue-ai/breeze-tts/main/MODEL_LICENSE); README banner: "Breeze TTS 2 model weights, derivative models, and self-hosted outputs are for research and non-commercial use only").

### What the model license actually says **[OFFICIAL — key operative terms]**
- **Output** is defined as "audio, speech, text, metadata, or other content generated by the Model Materials or a Derivative Model in response to an input" — outputs are explicitly inside the license's scope.
- **Commercial Purpose** includes "production use, API/SaaS hosting, **monetized content creation**, internal operations beyond evaluation, and any commercialization."
- "**No Commercial Purpose is permitted under this Agreement.** Any Commercial Purpose involving the Model Materials, a Derivative Model, or an Output requires a separate written commercial license from BreezeBlue."
- Explicitly **no** "creator, content monetization, small-business, revenue-threshold, or other implied commercial-use exception."
- Even where you own outputs: "Output ownership does not remove or limit the non-commercial restrictions in this Agreement."
- No training other models on outputs; no cloning a real person's voice without "explicit and legally sufficient consent"; no materially misleading synthetic audio; standard bad-uses list; attribution + license pass-through required on redistribution; Delaware law; immediate termination for commercial-use violations.

### Verdict for a monetized YouTube/talk-show **[OFFICIAL terms → my application]**
- **Self-hosted Breeze TTS 2 audio in ANY monetized video/show = license violation.** Monetized content creation is named. Fine for internal prototyping, voice auditions, pipeline dev, unmonetized tests.
- **Commercial path A — hosted API (recommended):** [Terms of service](https://breezeblue.ai/legal/terms): "Outputs generated **while your paid subscription is active** may be used for commercial purposes" (right survives cancellation for those outputs); you own your outputs; **Free-tier outputs "may be used only for personal and non-commercial purposes"**; "Purchasing credits alone does not provide commercial-use permission" (top-ups without an active paid sub don't count). Caution: the [pricing page](https://breezeblue.ai/pricing) marketing lists "Commercial use" on every tier including Free — **the Terms govern; stay on a paid plan.** Also: "A subscription to the Services does not grant any license to download, self-host, redistribute, fine-tune, or commercially use separately released model weights" — **paying for hosted does NOT legalize our box.**
- **Commercial path B — written self-host license:** "For commercial licensing, contact **contact@breeze.blue**" (authorization from RESONIA, INC). No published pricing; there's a "talk to us" custom-plan lane. No waitlist — hosted signup is immediate ("Start for free" → app.breezeblue.ai equivalent at `/app`).

### Hosted pricing **[OFFICIAL pricing page]**
| Plan | $/mo | Credits | ≈ minutes | Effective $/1M chars | Concurrency | Voice slots |
|---|---|---|---|---|---|---|
| Free | 0 | 400/day | — | $40 | 3 | 5 |
| Starter | 9 | 25k/mo | ~375 min | $36 | 6 | 20 |
| Creator ("Popular") | 19 | 59.4k/mo | ~900 min | $32 | 10 | 50 |
| Pro | 99 | 353.6k/mo | ~5,300 min | $28 | 20 | 300 |

Yearly = 2 months free; top-ups $1 = 2,500–3,500 credits by tier; custom/enterprise plans on request. AA lists the endpoint at $34/1M chars blended. Rate limits ([docs](https://docs.breezeblue.ai/reference/rate-limits.md)): concurrency above; no published RPM throttle; 429 `GENERATION_CONCURRENCY_EXCEEDED` w/ Retry-After; WebSocket: ≤20 sessions/key, 30-min max session, 30-s idle timeout (config ≤180 s).

**Bottom line: prototype on our box; ship the show's audio through a paid hosted plan (Creator $19/mo ≈ 900 min comfortably covers a weekly 3-host show) unless/until we negotiate a self-host license.** For a locked pipeline, the hosted API's design/clone/direction features mirror the open model (same family), so recipes transfer.

---

## 3. VOICE DESIGN mode (our `/v1/speak`: text + design + cfg_scale + seed)

### Mechanism **[OFFICIAL code]**
The design prompt is injected as `<ins_bos>{design}<ins_eos>` before the text (template `tts_instruction`); CFG contrasts against a no-instruction branch, so **cfg_scale directly scales how hard the described persona is enforced**. Nothing else conditions the voice — with a weak/absent instruction the model free-samples a speaker from its training prior.

### Official guidance **[OFFICIAL]**
- README: "Create a voice from a natural-language description without reference audio. **Match the instruction language to the target text. Use `--cfg-scale 4`** to strengthen instruction-following." Canonical example: *"A warm, thoughtful young woman with a clear voice and a calm, reflective delivery."*
- Hosted design endpoint ([guide](https://docs.breezeblue.ai/guides/voice-design.md)): `POST /v1/voice-previews/design`, `voice_description` ≤ **500 chars**, preview `text` ≤ 500 chars, `preview_count` for multiple candidates, `guidance_scale` **1.0–10.0** — "When you pass it, that exact value is used. **When you omit it, Breeze picks a random value between 1.0 and 10.0**" (they randomize guidance to diversify candidates). Save a preview → permanent `voice_id` with required `language_code`. Docs example: *"A confident young woman with a warm British accent."*

### What a great design prompt looks like — 7 official examples **[OFFICIAL blog, verbatim]**
Pattern across all of them: **gender/age → character/role → pitch class & timbre → texture → accent → pace/rhythm → emotional register/dynamics → personality/intent**, telegraphic comma phrases, ~30–60 words:
1. *"Masculine, mature adult. Massive heavy-set alien. Deep, gravelly, resonant bass-baritone. Gruff, authoritative, commanding, drill-sergeant cadence. Fast, high-intensity. Rough, weathered, immense power, stern mentorship."*
2. *"Young adult female, mid-20s, American accent. Professional broadcast journalist turning frantic. Clear, articulate but strained by panic. High tension, rapid pace, breathless. Polished to raw desperation."*
3. *"Female, young adult, ethereal trickster. High-pitched, breathy, mischievous. Fast, rhythmic delivery with giggles. Mocking sing-song riddles. Playful, taunting, otherworldly."*
4. *"Male, mid-20s to early 30s. Smooth velvety tenor-range speaking voice with a light rasp. Soulful and deeply emotive, shifting from weary struggle to optimistic conviction. Impeccable diction, gentle Southern lilt, deliberate pace, and broad expressive pitch arcs."*
5. *"Mature nomadic storyteller. Weathered, resonant speaking voice with rhythmic pacing and expressive pitch contours. Wide dynamic range from hushed whispers to booming proclamations; soulful."*
6. *"Mature male, 50s-60s, Japanese-accented English. Dignified, measured, stoic tone. Clear texture with slight age rasp. Deliberate pacing, significant pauses. Conveys wisdom, authority, and visionary caution."*
7. *"Ancient male, massive scale. Deep, resonant bass, gravelly, subterranean. Slow, deliberate, aristocratic. Terrifying power, sibilant, predatory intelligence."*

### The official attribute vocabulary (usable as design building blocks) **[OFFICIAL voices schema]**
From [concepts/voices.md](https://docs.breezeblue.ai/concepts/voices.md): gender `male/female/neutral`; age `child/young/middle_aged/old`; **tone codes**: warm, calm, bright, gentle, energetic, authoritative, sincere, weary, precise, refined, urgent, friendly, articulate, steady, playful, compassionate, reflective, measured, rhythmic, passionate; **English accent codes**: american, british, scottish, irish, australian, canadian, us_southern, us_new_york, indian, south_african, russian, japanese, korean, chinese (accented English); Chinese: mandarin variants + cantonese. Their voice-design benchmark scores **Role Fit** (does voice+performance realize the whole role), **Transcript Pass Rate** (text intact) and **Voice Diversity** — the dimensions THEY optimize for ([benchmark](https://github.com/breezeblue-ai/tts-voice-design-benchmark)).

### Limits & practical notes
- Keep design ≤500 chars (hosted contract; sensible self-host bound). **[OFFICIAL]**
- Design language must match text language (EN design for EN lines). **[OFFICIAL]**
- **Always include a fidelity/clarity descriptor** ("clear voice", "clear texture", "studio-quality, close-mic") — every official example includes a clarity term; omitting it leaves recording-quality free to vary (see §7 telephone issue). **[INFERENCE from official examples + §7]**
- Design mode re-samples the voice every call — identity is only as stable as (design, seed, build). For repeatable characters, freeze via clone bootstrap (§8 R1). **[INFERENCE from mechanism; corroborated by hosted "save the preview" product design]**

---

## 4. VOICE CLONE + INSTRUCTION mode (our `/v1/clone`: ref_audio_b64 + ref_text + instruction)

### Mechanism **[OFFICIAL code]**
Clone = in-context imitation: `[S0]{ref_text} + ref-audio-frames + [S0]{text}`. Direction (`ref_edit_tata`) inserts `<ins_bos>{instruction}<ins_eos>` before the new text; **CFG's negative branch is the pure clone**, so cfg_scale controls "how far from the reference's natural delivery the instruction may pull" while the ref keeps identity. Their benchmark reports SPK_SIM 0.67 at VDS 4.25 — best-in-class direction adherence at mildly reduced similarity (Inworld TTS-2 holds 0.71 SIM but only 3.01 VDS): **instruction strength trades against voice fidelity**; that's the knob.

### Reference clip best practices
- **[OFFICIAL README]** "Reference audio should contain clean speech with minimal background noise." `ref_text` must be the **exact transcript**.
- **[OFFICIAL hosted clone guide](https://docs.breezeblue.ai/guides/voice-clone.md)** (their production defaults — best available official spec): MP3/WAV, **min 3 s, max file 5 MB**, exactly one file, **single speaker, no background music/noise**; system "analyzes only the **first 60 seconds**" and "extracts **up to 30 seconds**, trimmed to the last complete sentence," adds ~1 s leading silence, and **normalizes to −18 LUFS** (so ref loudness doesn't matter, content does). Auto-transcribes + language-detects. Consent required ([voice consent policy](https://breezeblue.ai/en/legal/voice-consent)).
- **[COMMUNITY — ComfyUI port](https://github.com/Saganaki22/ComfyUI-Breeze-TTS-2):** "Reference clips: keep them under **~20 s (hard max 60 s)**."
- **[INFERENCE]** Sweet spot **10–20 s** of expressive, representative speech: long enough to lock timbre+rhythm, short enough to leave backbone context for output (each ref second ≈ 12.5 frames of the 2048-position budget). The clone copies *style* too ("preserve timbre, rhythm, emotion, and style" — README), so record the ref at the energy you want as the host's default register; keep an alt "heated" ref per host for debate segments.

### Instruction-following — the FULL documented vocabulary **[OFFICIAL]**
The nine categories from BreezeBlue's own [Voice-Direction Benchmark](https://github.com/breezeblue-ai/TTS-Voice-Direction-Benchmark) (`category_prompts/`), grouped Foundational/Situational/Complex:
1. **emotion** — e.g. *"The speaker sounds acerbic and bitter, delivering the lines with heavy, passive-aggressive sarcasm."*
2. **accent** — accent shifts on the same identity (accented English per the accent codes in §3).
3. **acoustic_attributes** — recording/sound character (this is why "phone-quality" is a *steerable* dimension — see §7).
4. **physiological_state** — e.g. *"Speaking while heavily out of breath and gasping for air, trying to reassure the listener that everything is fine."* (breathlessness, exhaustion, etc.)
5. **communicative_intent** — e.g. *"Speak with an alluring, hushed intensity, using a hypnotic and persuasive rhythm to draw the listener in and convince them to acquire a rare item."*
6. **role** — persona overlay: *"Speak with a gritty, swaggering, and theatrical tone, projecting an aggressive and boastful attitude of a seafaring marauder."*
7. **composition** — layered/combined states (their blog files the gasping example here).
8. **variation** — **mid-line switches**: *"Start with a confident, reassuring tone. At the word 'Wait', suddenly shift to terrified, breathless alarm as if reacting to a frightening noise."*
9. **vocal_events** — event insertion by instruction (giggles, etc.), complementing inline tags (§5).
- README's canonical simple direction: *"Speak slowly with a restrained, serious tone."* Pace, volume, pitch movement, tone, intent all respond.
- Hosted `instructions` field ≤ **1000 chars**; there's even an [enhance-instruction endpoint](https://docs.breezeblue.ai/api-reference/text-to-speech/enhance-text-to-speech-instruction.md) that rewrites a rough note ("Make it warmer and more cinematic.") into "clearer model guidance without changing the script" — evidence that concrete, explicit performance language is the target form. Hosted clone previews accept `instructions` like *"Stay close to the reference tone."*
- **[INFERENCE — writing rules distilled from all official examples]** One sentence, present tense, performance verbs; specify emotion + intensity + pace + intent; anchor mid-line shifts to an exact word ("At the word 'X'…"); keep instruction in the script's language; don't restate script content.

---

## 5. NONVERBALS (inline tags vs instruction)

- **Official inline tag list (open model, complete as documented): EN `(laugh)`, `(cough)`, `(clears throat)`, `(sigh)` — parentheses; ZH `[笑]`, `[咳嗽]`, `[清嗓子]`, `[叹气]` — square brackets.** Placed inline where the sound should occur; official examples lead lines with them: *"(sigh) It is good to hear your voice again…"*, *"(clears throat) We need to discuss what happened last night."* **[OFFICIAL README/model card]**
- **Community:** "Close variants like `(laughing)` or `(sighs)` usually also work, but prefer the confirmed forms above" ([ComfyUI SKILL.md](https://raw.githubusercontent.com/Saganaki22/ComfyUI-Breeze-TTS-2/main/SKILL.md)). No community-verified list beyond that yet (model is 6 days old). **[COMMUNITY]**
- **Your asked-about tags:** laughs ✔ (official), sighs ✔ (variant), coughs ✔ (official). **(inhales)/(breathing): NOT documented as tags** → use instruction ("breathy", "heavily out of breath and gasping" — official physiological_state example). **Whispering/shouting: instruction- or design-driven**, not tags (official design ex. 5: "from hushed whispers to booming proclamations"; direction ex.: "alluring, hushed intensity"). **Crying: no tag documented** → instruction ("voice breaking, on the verge of tears") — plausible but **untested; treat as experiment**. **[OFFICIAL for what exists / INFERENCE for workarounds]**
- **Which does the model prefer?** Both are first-class and designed to combine: inline tags for **discrete, punctual sounds** at exact positions; instructions for **sustained states** (whisper, shout, breathlessness, crying) and everything expressive. `vocal_events` is itself one of the nine instruction categories, so events can also be requested via instruction ("delivery with giggles" — design ex. 3). Un-listed inline tags risk being read aloud or ignored — audition any new tag before using it in a show. **[OFFICIAL structure + INFERENCE on risk]**
- Guardrail from the community cookbook: no stage directions, asterisks, quotes or emojis in script text — only confirmed tags; keep ~≤1 event per line. **[COMMUNITY]**

---

## 6. cfg_scale semantics & seed

### What cfg_scale does **[OFFICIAL code + docs]**
Classifier-free guidance over the templates in §1: output ≈ negative_branch + cfg·(positive − negative). Per mode:
- **Design:** negative = same text with NO instruction ⇒ cfg scales persona adherence. At 1.0 the instruction only conditions weakly (no contrast amplification).
- **Direction:** negative = pure clone ⇒ cfg scales instruction-vs-reference-delivery. At 1.0 you get essentially the clone's natural read.
- Hosted `guidance_scale`: range **1.0–10.0**, default **1** on the TTS endpoint, "adjusts how strongly generation follows the prompt and reference voice"; design endpoint randomizes it in [1,10] when omitted (candidate diversity).

### Recommended values
- **Official:** `--cfg-scale 4` for **design and direction**; server default **1.0** = clone/plain reads. **[OFFICIAL]**
- **Community (ComfyUI):** "Voice Clone: CFG 1.0; Voice Design: CFG 4; Voice Direction: CFG 4." **[COMMUNITY]**
- **Our settings ruling:** server default 4.0 is **correct for design and per-line direction**. The client's **1.3 is wrong for design** — near-unguided persona sampling (see §7). For pure clone lines with no meaningful instruction, use **1.0**. Values 2–3 = subtler direction at higher similarity; >4–6 = harder adherence with rising artifact/similarity cost (hosted cap 10). **[OFFICIAL + INFERENCE]**
- **Fast-path constraint:** shipped `configs/fast.json` freezes CUDA graphs for **cfg 1.0 and 4.0 only** (`"cfg_scales": [1.0, 4.0]`, `freeze_after_warmup: true`). Off-menu values like 1.3 are at best eager-speed, at worst rejected once the service is frozen — **standardize on 1.0/4.0** so the fast path applies. **[OFFICIAL config; behavior-on-mismatch is INFERENCE — test on our box]**

### Seed **[OFFICIAL code]**
- `seed` default **42**; server calls `set_all_seeds(seed)` before every request ⇒ **same (text, design/instruction, ref, cfg, seed, checkpoint, build) = reproducible output**. Changing ANY input changes the draw (a designed voice is only "the same voice" across lines because design+seed pin the sampling trajectory — identity may still drift subtly line-to-line, which is why we bootstrap to clone).
- Community pattern: "Each speaker keeps a stable seed offset across turns (so designed voices stay consistent)" — per-speaker fixed seeds in multi-speaker rendering. **[COMMUNITY]**
- Caveat: determinism is per build/GPU/kernel config (eager vs CUDA-graph fast path may differ); pin the Docker image for archival reproducibility. **[INFERENCE]**
- Hosted API: **no seed parameter** on the convert endpoint — consistency there comes from saved `voice_id`s, not seeds. **[OFFICIAL]**

---

## 7. QUALITY GOTCHAS

### The "telephone-quality" designed voice **[no public bug reports found; mechanism analysis]**
Searched GitHub issues (only 5 exist, none quality-related), HF discussions (8 threads — license, comparisons, languages, fine-tuning, integrations), Reddit/HN (no threads yet), X — **no public reports of bandlimited output in the model's first week**. Causes, in likelihood order for OUR case:
1. **cfg 1.3 on design = the model largely ignored "clear voice" and free-sampled a speaker from its training prior — which demonstrably includes narrowband/telephone-bandwidth speech**, since `acoustic_attributes` is one of its nine trained direction categories (you can *ask* for phone-quality; you can also *roll* it when guidance is too weak to enforce the opposite). Fix: **cfg 4.0 + explicit fidelity descriptors** ("clear, full-bodied, close-mic studio quality") + re-roll seeds until clean. **[INFERENCE, grounded in official mechanism + benchmark taxonomy]**
2. **It's not the codec:** Mimi at 12.5 Hz reconstructs full-band 24 kHz; a muffled voice is a *sampled speaker characteristic*, not a bandwidth ceiling. (General Mimi character: slight softness vs 44.1 kHz studio TTS, but not "telephone.") **[INFERENCE from config]**
3. Once a clean take exists, **freeze it via the clone bootstrap** — clone mode anchors to your ref's acoustics, ending the lottery. Keep direction instructions free of acoustic-degradation words unless intended. **[INFERENCE]**
4. If a *cloned* voice comes out muffled: the ref is the culprit (noise, low bitrate, room reverb — README demands clean speech) or the ref exceeded the analysis window (hosted uses first 60 s/extracts 30 s; keep refs ≤20 s self-host). **[OFFICIAL guidance applied]**

### Long text & chunking
- **Upstream does NOT chunk** — `breeze_infer/api.py` has no splitter; one request = one generation. Our server's **260-word sentence-boundary chunking is our own wrapper's policy**. **[OFFICIAL code]**
- **Hard ceiling [INFERENCE from config]:** backbone context 2048 positions ⇒ ~163 s audio minus prompt. A 20 s ref ≈ 250 positions + ref_text + script tokens. At talk-show pace (~150 wpm) 260 words ≈ 104 s ≈ 1300 frames — fits; at slow narration (~95 wpm) 260 words ≈ 164 s — **can exhaust context and truncate the tail (audio ends when `<|audio_eos|>` is emitted or context runs out)**. Recommendation: **≤200 words/chunk with a 10–20 s ref; ≤150 words for slow reads**; always sentence-boundary splits (our wrapper already does); transcript-check tails (§8 R9).
- Community pacing budget (ComfyUI SKILL.md): ~150 wpm; dialogue in short 1–3 sentence turns — "short turns feel like real conversation; long monologues sound robotic." audio.cpp demoed 6000+ chars longform at RTF 0.23 via its own chunking. **[COMMUNITY]**

### Languages
- **Open weights: English + Chinese only** ("Generates natural English and Chinese speech with a single model" — README/model card). **[OFFICIAL]**
- **Hosted service: 23 language codes** (ar cs de el en es fi fr hi id it ja ko nl pl pt ro ru th tr uk vi zh) with **accent codes only for en/zh** ([multilingual docs](https://docs.breezeblue.ai/concepts/multilingual.md)); press/AA say "50(+) languages" — marketing vs the documented 23-code contract. **The hosted multilingual model ≠ the open checkpoint.** Community wants more open languages ([HF discussion #4, 12 reactions, unanswered]). Accented English (japanese/russian/indian/etc.) IS available in the open model via design/direction prompts. **[OFFICIAL + COMMUNITY]**
- Match instruction/design language to text language; ZH uses square-bracket events. **[OFFICIAL]**

### Sample rate & formats
- Native **24 kHz mono**; self-host API streams **s16le PCM** (headers X-Sample-Rate / X-Sample-Format). Upsample/master to 48 kHz in post for video delivery; don't expect >24 kHz detail. Hosted: mp3/wav/flac/pcm/aac/opus incl. 44.1 kHz containers (server-side conversion). **[OFFICIAL]**
- Deliver narration/music as separate tracks per house rules; loudness-normalize the 24 kHz stems (hosted normalizes refs to −18 LUFS — a sane ref-prep target for us too).

### Ops
- Self-host server is **single-concurrency** (explicit lock). For batch rendering: serialize per GPU, or run multiple server instances (eager ~7.7 GiB each ⇒ 2–3 per 24 GB card) **[OFFICIAL + INFERENCE]**.
- Lighter runtimes now exist: **audio.cpp** C++ port (no Python, ~6 GB VRAM, RTF 0.21–0.24 on RTX 5090 ≈ 4× realtime; [issue #3](https://github.com/breezeblue-ai/breeze-tts/issues/3), [repo](https://github.com/0xShug0/audio.cpp)) and **ComfyUI INT8-Hybrid** (4.53 GiB file / 5.53 GiB peak VRAM, "matches bf16 quality"; INT8 ConvRot backbone+text-encoder, bf16 depth decoder). Same non-commercial model license applies to both. **[COMMUNITY]**
- Fast path needs warmup + freeze; keep the service hot for latency-sensitive use; A100 needs the `FLASH_ATTN_CUDA_ARCHS=80` image. **[OFFICIAL]**

---

## 8. PRACTICAL COOKBOOK — 10 recipes for a 3-host talk show

**R1 — Lock each host with the design→clone bootstrap (our pattern, now validated).** Per host: run DESIGN at **cfg 4.0**, fixed seed, structured ≤500-char prompt (§3 pattern) **including a clarity descriptor**, on a 40–60 s audition script that spans the host's range (banter, disagreement, laugh line). Re-roll seeds until a take nails identity AND fidelity. **Freeze the winning WAV + its exact transcript as the host's canonical ref pair.** All production afterward = CLONE/DIRECTION from that pair — never re-design. (Hosted equivalent: save the design preview as a `voice_id`.)

**R2 — Ref pair spec.** 10–20 s, single speaker, zero BGM/noise, exact transcript, delivered at the host's default energy; trim to complete sentences; ~−18 LUFS. Keep a second "heated" ref per host for debate blocks (swap refs instead of fighting cfg). Store under version control like our canonical_registry (checkpoint hash + seed + design prompt + build tag in a ledger).

**R3 — cfg discipline: two values only.** Plain reads/clone = **1.0**; any line with a real instruction = **4.0**. These match the shipped fast-path graphs (`cfg_scales: [1.0, 4.0]`) — retire the client's 1.3. Reserve 2–3 for "subtle direction, maximum similarity" experiments on the eager path.

**R4 — Per-line emotional direction.** One present-tense sentence: emotion + intensity + pace + intent — *"Speak slowly with a restrained, serious tone"*, *"sounds acerbic and bitter… heavy, passive-aggressive sarcasm"*. For turns inside a line use the official Variation pattern: *"Start with a confident, reassuring tone. At the word 'Wait', suddenly shift to terrified, breathless alarm."* Keep ≤1000 chars; same language as the script.

**R5 — Nonverbals policy.** Inline: only `(laugh)`, `(sigh)`, `(cough)`, `(clears throat)` (+ audition close variants once), ≤1 per line, placed exactly where the sound belongs. Sustained states — whisper/shout/breathless/tearful — go in the instruction, never as tags. No other stage directions/emojis/asterisks in script text.

**R6 — Seed ledger.** Fixed base seed per host (e.g. S0=1042, S1=2042, S2=3042); a re-roll bumps by +1 and is logged. Same inputs+seed+build = same audio, so archived (line, params) tuples are re-renderable. Pin the Docker image per season.

**R7 — Chunk small, per turn.** Talk-show lines: one API call per dialogue turn (short turns = natural rhythm; ~150 wpm budget ⇒ 1 min ≈ 150 words ≈ 10–14 turns). Narration: cap chunks at **~200 words** (150 for slow reads) on sentence boundaries — stays inside the 2048-position context with a 10–20 s ref and avoids tail truncation. Our 260-word setting is borderline for slow reads; lower it.

**R8 — Dialogue assembly.** Generate per-turn with each host's ref (identity from ref, not sampling), stitch with 300–600 ms gaps and light overlap trims in post. Script formatting per the community cookbook: interactive short turns, reactions/interruptions, distinct per-host vocabulary and catchphrases, numbers written as speech ("fifty grand"), end on a punchline/callback. (The model has [S0]–[S9] speaker tokens internally, but the shipped API is one-speaker-per-request — per-turn calls are the supported path.)

**R9 — Automated QC gate.** For every rendered line: Whisper-transcribe → fuzzy-match against script (their own benchmarks gate on "Transcript Pass Rate"); flag mismatch, clipped tails, or duration outliers (>±25% of words/150wpm estimate); auto-retry with seed+1 at same settings. Spot-check designed-voice fidelity weekly against the canonical ref (cosine on speaker embeddings if we want to get fancy — they use WavLM-Large ECAPA).

**R10 — Fidelity insurance (the telephone fix).** Design prompts always carry "clear, full-bodied, close-mic studio quality"; design only at cfg 4.0; muffled result ⇒ re-roll seed, don't lower cfg; never put degraded-acoustics words (phone, radio, distant, muffled) in a design/instruction unless the scene wants it — `acoustic_attributes` is a trained, obedient category. Once clean, R1 freezes it forever.

**Production/licensing overlay:** until a commercial arrangement exists, everything above renders **prototypes** on our box; the show's shipped audio re-renders through the hosted API on a paid plan (same recipes: saved voice_ids = our frozen hosts; `instructions` + `guidance_scale` per line; no seed hosted — determinism via voice_id + retakes).

---

## 9. Source index

**Official:** [GitHub repo](https://github.com/breezeblue-ai/breeze-tts) · [MODEL_LICENSE](https://raw.githubusercontent.com/breezeblue-ai/breeze-tts/main/MODEL_LICENSE) · [HF model + card](https://huggingface.co/BreezeBlue/Breeze-TTS-2) · [config.json](https://huggingface.co/BreezeBlue/Breeze-TTS-2/raw/main/config.json) · [HF files](https://huggingface.co/BreezeBlue/Breeze-TTS-2/tree/main) · [Blog/writeup](https://breezeblue.ai/breeze-tts-2) · [Site](https://breezeblue.ai/) · [Pricing](https://breezeblue.ai/pricing) · [Service terms](https://breezeblue.ai/legal/terms) · Docs: [index](https://docs.breezeblue.ai/llms.txt), [voice-design](https://docs.breezeblue.ai/guides/voice-design.md), [voice-clone](https://docs.breezeblue.ai/guides/voice-clone.md), [multilingual](https://docs.breezeblue.ai/concepts/multilingual.md), [voices schema](https://docs.breezeblue.ai/concepts/voices.md), [TTS endpoint](https://docs.breezeblue.ai/api-reference/text-to-speech/convert-text-to-speech.md), [enhance-instruction](https://docs.breezeblue.ai/api-reference/text-to-speech/enhance-text-to-speech-instruction.md), [rate limits](https://docs.breezeblue.ai/reference/rate-limits.md) · Benchmarks: [voice design](https://github.com/breezeblue-ai/tts-voice-design-benchmark), [voice direction](https://github.com/breezeblue-ai/TTS-Voice-Direction-Benchmark) (+[nine categories](https://github.com/breezeblue-ai/TTS-Voice-Direction-Benchmark/tree/main/category_prompts)) · [Demo Space](https://huggingface.co/spaces/BreezeBlue/breeze-tts-2-demo) · Local box dump (README head, templates.py, configs/fast.json, git remote).

**Community:** [AA #1-open-weight post](https://x.com/ArtificialAnlys/status/2092399623839326550) · [AA speed/pricing post](https://x.com/ArtificialAnlys/status/2092399632676704266) · [AA model page](https://artificialanalysis.ai/text-to-speech/models/breeze-tts-2) · [AlphaSignal (1,215 Elo)](https://alphasignal.ai/news/breezeblue-s-breeze-tts-2-tops-open-weights-voice-ai-with-1-215-elo) · [MindStudio release](https://www.mindstudio.ai/blog/breeze-tts-2-open-weight-release) / [setup guide](https://www.mindstudio.ai/blog/breeze-tts-2-open-weight-model) · [ComfyUI-Breeze-TTS-2](https://github.com/Saganaki22/ComfyUI-Breeze-TTS-2) + [SKILL.md](https://raw.githubusercontent.com/Saganaki22/ComfyUI-Breeze-TTS-2/main/SKILL.md) · [audio.cpp port (issue #3)](https://github.com/breezeblue-ai/breeze-tts/issues/3) · [HF discussions](https://huggingface.co/BreezeBlue/Breeze-TTS-2/discussions) · [Press release](https://natlawreview.com/press-releases/breeze-blue-unveils-breeze-tts-2-real-time-flagship-voice-ai-interactive).

**Known-unknowns (nothing published yet):** training data/method (issue #5 open) · fine-tuning support & extra open languages (HF #4 unanswered) · exact fast-path behavior for off-menu cfg values (test on our box) · negotiated self-host commercial pricing (email them) · no public quality-artifact threads yet (6-day-old model; our telephone case is ahead of the community).
