# Migrating from ElevenLabs to Dia

## Why Dia?

ElevenLabs limitations that forced the migration:
- ❌ No multi-voice dialogue in API (Studio feature only)
- ❌ Expensive ($0.30 per 1000 chars)
- ❌ API key management and rate limits
- ❌ No emotional expression tags
- ❌ Voice ID juggling for multiple speakers

Dia advantages:
- ✅ **Multi-voice out of the box** with [S1]/[S2] tags
- ✅ **Emotional markers** - (laughs), (whispers), (sighs), (gasps), etc.
- ✅ **Fully local** - No API keys, no usage limits, no costs
- ✅ **Fast** - 2x realtime on GPU
- ✅ **Natural dialogue** - Trained specifically for conversations
- ✅ **Consistent voices** - Same seed = same voices every time

## Setup

### 1. Start Dia Service

```bash
# Build and start Dia (first time - downloads 1.6B model)
npm run dia:up

# Check if running
npm run check:voice

# View logs
npm run dia:logs
```

### 2. Test Dia

```bash
# Run comprehensive test suite
npm run dia:test

# Outputs:
#  - test-dia-basic.mp3 (simple dialogue)
#  - test-dia-emotions.mp3 (with emotional markers)
#  - test-dia-long.mp3 (longer conversation)
#  - test-dia-consistent-1.mp3 (voice consistency test)
#  - test-dia-consistent-2.mp3 (same voices with same seed)
```

## Code Migration Guide

### Old: ElevenLabs (DEPRECATED)

```typescript
import { textToSpeech } from './src/lib/elevenlabs'

// Generate single voice
const audio1 = await textToSpeech({
  text: "Maya speaking here",
  voice_id: 'EXAVITQu4vr4xnSDxMaL',
  model_id: 'eleven_multilingual_v2'
})

// Generate second voice (separate call, different voice ID)
const audio2 = await textToSpeech({
  text: "Marcus speaking here",
  voice_id: 'TxGEqnHWrfWFTfGW9XjX',
  model_id: 'eleven_multilingual_v2'
})

// Manually combine with ffmpeg...
```

### New: Dia (RECOMMENDED)

```typescript
import { generateDialogue, Emotion } from './src/lib/dia'

// Generate multi-voice dialogue in ONE call
const audio = await generateDialogue({
  segments: [
    { speaker: 1, text: "Maya speaking here" },
    { speaker: 2, text: "Marcus speaking here" }
  ],
  seed: 42  // Same seed = same voices
})

// With emotions
const audioWithEmotion = await generateDialogue({
  segments: [
    { speaker: 1, text: `Hey there! ${Emotion.laughs}` },
    { speaker: 2, text: `I know right? ${Emotion.whispers} This is incredible.` }
  ],
  seed: 42
})
```

## Speaker Tag Format

### Basic 2-Speaker Dialogue

```typescript
const segments = [
  { speaker: 1, text: "Welcome to the show!" },
  { speaker: 2, text: "Thanks for having me." },
  { speaker: 1, text: "Let's dive in." },
  { speaker: 2, text: "Sounds good!" }
]
```

This generates: `[S1] Welcome to the show! [S2] Thanks for having me! [S1] Let's dive in. [S2] Sounds good!`

### 3-Speaker Shows

Dia supports only 2 voices per generation. For 3-speaker shows, use different seeds:

```typescript
// Maya (S1) + Marcus (S2) - Seed 100
const batch1 = await generateDialogue({
  segments: [
    { speaker: 1, text: "Maya here" },
    { speaker: 2, text: "Marcus responding" }
  ],
  seed: 100
})

// Maya (S1) + Sarah (S2) - Seed 200
const batch2 = await generateDialogue({
  segments: [
    { speaker: 1, text: "Maya here" },
    { speaker: 2, text: "Sarah responding" }
  ],
  seed: 200
})

// Now you have 3 distinct voices:
// - S1 with seed 100 = Maya's voice
// - S2 with seed 100 = Marcus's voice
// - S2 with seed 200 = Sarah's voice
```

## Emotional Markers

```typescript
import { Emotion } from './src/lib/dia'

const text = `
  Hey there! ${Emotion.laughs}
  This is incredible! ${Emotion.gasps}
  I can't believe it. ${Emotion.whispers}
  Let me catch my breath. ${Emotion.inhales}
`
```

Available emotions:
- `Emotion.laughs` - Laughter
- `Emotion.chuckle` - Light laugh
- `Emotion.whispers` - Whispering
- `Emotion.sighs` - Sighing
- `Emotion.gasps` - Gasping
- `Emotion.coughs` - Coughing
- `Emotion.groans` - Groaning
- `Emotion.claps` - Clapping
- `Emotion.screams` - Screaming
- `Emotion.inhales` - Breathing in
- `Emotion.exhales` - Breathing out
- `Emotion.applause` - Audience applause
- `Emotion.burps` - Burping
- `Emotion.humming` - Humming
- `Emotion.sneezes` - Sneezing
- `Emotion.whistles` - Whistling

## Voice Consistency

Use the `seed` parameter for consistent voices:

```typescript
// First show - generates specific voices
const show1 = await generateDialogue({
  segments: [/* ... */],
  seed: 42
})

// Next show - SAME VOICES as show1
const show2 = await generateDialogue({
  segments: [/* ... */],
  seed: 42
})

// Different show - NEW VOICES
const show3 = await generateDialogue({
  segments: [/* ... */],
  seed: 999
})
```

## API Endpoints

Direct HTTP API (alternative to TypeScript client):

### POST /generate

```bash
curl -X POST http://localhost:8765/generate \
  -H "Content-Type: application/json" \
  -d '{
    "text": "[S1] Hey there! (laughs) [S2] Hi! (chuckle)",
    "seed": 42,
    "temperature": 1.8,
    "guidance_scale": 3.0
  }' \
  --output output.mp3
```

### GET /health

```bash
curl http://localhost:8765/health
```

Response:
```json
{
  "status": "healthy",
  "model": "nari-labs/Dia-1.6B-0626",
  "device": "cuda:0",
  "supports_multi_voice": true,
  "supported_emotions": [
    "laughs", "chuckle", "whispers", "sighs", "gasps",
    "coughs", "groans", "claps", "screams", "inhales",
    "exhales", "applause", "burps", "humming", "sneezes", "whistles"
  ]
}
```

## File Locations

| File | Purpose |
|------|---------|
| `src/lib/dia.ts` | TypeScript client library |
| `docker/dia/Dockerfile` | Dia Docker image |
| `docker/dia/dia-api.py` | FastAPI wrapper for Dia |
| `docker/dia/README.md` | Dia service documentation |
| `test-dia.ts` | Test suite for Dia |
| `generate-orangeburg-3host-dia.ts` | Example 3-host show generator |

## Common Patterns

### Generate Show Segments

```typescript
import { generateDialogue } from './src/lib/dia'
import * as fs from 'fs/promises'

const segments = [
  { speaker: 1, text: "Welcome to the show!" },
  { speaker: 2, text: "Thanks Maya." },
  { speaker: 1, text: "Let's get started." }
]

const audio = await generateDialogue({ segments, seed: 100 })
await fs.writeFile('show.mp3', audio)
```

### Batch Generation with Voice Consistency

```typescript
// Generate multiple segments with same voices
const segment1 = await generateDialogue({
  segments: [
    { speaker: 1, text: "Part 1 opening" },
    { speaker: 2, text: "Part 1 response" }
  ],
  seed: 42
})

const segment2 = await generateDialogue({
  segments: [
    { speaker: 1, text: "Part 2 opening" },
    { speaker: 2, text: "Part 2 response" }
  ],
  seed: 42  // Same seed = same voices
})

// Combine segments with ffmpeg or save separately
```

### Check Service Health

```typescript
import { checkHealth } from './src/lib/dia'

try {
  const health = await checkHealth()
  console.log(`Dia is ${health.status}`)
} catch (error) {
  console.error('Dia service not available')
  console.error('Run: npm run dia:up')
}
```

## Troubleshooting

### Service won't start
```bash
# Check GPU availability
nvidia-smi

# Check Docker GPU access
docker run --rm --gpus all nvidia/cuda:12.6.0-base-ubuntu22.04 nvidia-smi

# View Dia logs
npm run dia:logs
```

### Out of memory
- Reduce `max_new_tokens` in request (default: 3072)
- Check VRAM usage: `nvidia-smi`
- Dia needs 4.4GB VRAM minimum

### Voices don't sound consistent
- Use `seed` parameter
- Same seed = same voices
- Different seed = different voices

## Performance

- **Speed**: ~2x realtime on RTX 4090
- **VRAM**: 4.4GB (bfloat16)
- **Latency**: <1 second to start generation
- **Quality**: Natural conversational dialogue

## Next Steps

1. ✅ Start Dia service: `npm run dia:up`
2. ✅ Test it: `npm run dia:test`
3. ✅ Update your scripts to use `src/lib/dia.ts`
4. ✅ Remove ElevenLabs dependencies
5. ✅ Enjoy unlimited multi-voice dialogue generation!

## ElevenLabs Deprecation

Once Dia is confirmed working:
1. Remove `ELEVENLABS_API_KEY` from `.env`
2. Delete `src/lib/elevenlabs.ts` (or keep as backup)
3. Update all scripts to use Dia
4. Cancel ElevenLabs subscription

Dia is the future. No more API keys, no more costs, unlimited natural dialogue.
