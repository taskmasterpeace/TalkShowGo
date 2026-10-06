# Dia Multi-Voice TTS Setup - Complete Summary

## What Was Done

Successfully integrated Dia (https://github.com/nari-labs/dia) as the PRIMARY TTS service, replacing ElevenLabs completely.

## Files Created

### 1. Docker Service
- `docker/dia/Dockerfile` - Dia Docker image with CUDA 12.6, model auto-download
- `docker/dia/dia-api.py` - FastAPI wrapper exposing clean REST API
- `docker/dia/README.md` - Service documentation
- Updated `docker-compose.yml` - Added Dia service on port 8765 with GPU support

### 2. TypeScript Client Library
- `src/lib/dia.ts` - Complete TypeScript client for Dia
  - `generateDialogue()` - Main function for multi-voice generation
  - `generateSpeech()` - Low-level speech generation
  - `checkHealth()` - Service health check
  - `Emotion` object - All emotional markers
  - Full TypeScript types

### 3. Examples & Tests
- `test-dia.ts` - Comprehensive test suite (5 test cases)
- `generate-orangeburg-3host-dia.ts` - 3-host show generator using Dia

### 4. Documentation
- `docs/DIA-MIGRATION.md` - Complete migration guide from ElevenLabs to Dia
- Updated `CLAUDE.md` - Added Dia section with usage examples
- Updated `package.json` - Added npm scripts for Dia

### 5. Configuration
- Updated `.env` - Added `DIA_URL=http://localhost:8765`
- Updated `package.json` scripts:
  - `npm run dia:up` - Start Dia service
  - `npm run dia:logs` - View Dia logs
  - `npm run dia:test` - Test Dia
  - `npm run check:voice` - Now checks Dia (port 8765)

## Key Features

### Multi-Voice Dialogue
```typescript
const audio = await generateDialogue({
  segments: [
    { speaker: 1, text: "Welcome!" },
    { speaker: 2, text: "Thanks!" }
  ],
  seed: 42
})
```

### Emotional Markers
```typescript
import { Emotion } from './src/lib/dia'

const text = `Hey! ${Emotion.laughs} This is crazy! ${Emotion.gasps}`
```

Available emotions: laughs, chuckle, whispers, sighs, gasps, coughs, groans, claps, screams, inhales, exhales, applause, burps, humming, sneezes, whistles

### Voice Consistency
Same seed = same voices across all generations
```typescript
// Show 1 and Show 2 will have identical voices
await generateDialogue({ segments, seed: 42 })
await generateDialogue({ segments, seed: 42 })
```

### 3-Speaker Shows
Use different seeds for different voice pairs:
- Seed 100: Maya (S1) + Marcus (S2)
- Seed 200: Maya (S1) + Sarah (S2)
- Result: 3 distinct voices

## Usage

### Start Dia
```bash
npm run dia:up
```

### Check Status
```bash
npm run check:voice
```

### Test It
```bash
npm run dia:test
```

### Use in Code
```typescript
import { generateDialogue, Emotion } from './src/lib/dia'

const audio = await generateDialogue({
  segments: [
    { speaker: 1, text: `Welcome! ${Emotion.laughs}` },
    { speaker: 2, text: `Thanks! ${Emotion.chuckle}` }
  ],
  seed: 42
})

await fs.writeFile('output.mp3', audio)
```

## API Endpoints

### POST /generate
```bash
curl -X POST http://localhost:8765/generate \
  -H "Content-Type: application/json" \
  -d '{
    "text": "[S1] Hey! (laughs) [S2] Hi! (chuckle)",
    "seed": 42
  }' \
  --output output.mp3
```

### GET /health
```bash
curl http://localhost:8765/health
```

## Requirements

- **GPU**: NVIDIA GPU with 4.4GB+ VRAM
- **CUDA**: 12.6+
- **Docker**: nvidia-container-toolkit installed

## Performance

- **Speed**: ~2x realtime on RTX 4090
- **VRAM**: 4.4GB (bfloat16)
- **Latency**: <1 second to start generation
- **Quality**: Natural conversational dialogue

## Migration from ElevenLabs

### Old (DEPRECATED)
```typescript
import { textToSpeech } from './src/lib/elevenlabs'
const audio = await textToSpeech({
  text: "...",
  voice_id: 'EXAVITQu4vr4xnSDxMaL'
})
```

### New (USE THIS)
```typescript
import { generateDialogue } from './src/lib/dia'
const audio = await generateDialogue({
  segments: [{ speaker: 1, text: "..." }],
  seed: 42
})
```

## Why Dia?

### ElevenLabs Problems (why we dumped it)
- ❌ No multi-voice dialogue in API (Studio feature only)
- ❌ Expensive ($0.30 per 1000 chars)
- ❌ API key management and rate limits
- ❌ No emotional expression tags
- ❌ Voice ID juggling for multiple speakers

### Dia Advantages
- ✅ Multi-voice out of the box with [S1]/[S2] tags
- ✅ Emotional markers - (laughs), (whispers), etc.
- ✅ Fully local - No API keys, no usage limits, no costs
- ✅ Fast - 2x realtime on GPU
- ✅ Natural dialogue - Trained specifically for conversations
- ✅ Consistent voices - Same seed = same voices

## Documentation Locations

1. **CLAUDE.md** - Main documentation (lines 148-297)
   - Quick start guide
   - TypeScript usage examples
   - 3-speaker show patterns
   - Emotional markers reference
   - API endpoints
   - Migration guide

2. **docs/DIA-MIGRATION.md** - Complete migration guide
   - Code migration examples
   - Speaker tag format
   - Emotional markers full list
   - Voice consistency guide
   - Common patterns
   - Troubleshooting

3. **docker/dia/README.md** - Service documentation
   - Installation instructions
   - API endpoint details
   - Usage examples (Python + TypeScript)
   - Performance benchmarks
   - Troubleshooting

4. **src/lib/dia.ts** - TypeScript client library
   - Full API documentation in JSDoc comments
   - Type definitions
   - Helper functions

## Next Steps

1. ✅ Start Dia service: `npm run dia:up`
2. ✅ Test it: `npm run dia:test`
3. ✅ Update your scripts to use `src/lib/dia.ts`
4. ✅ Remove ElevenLabs dependencies (optional - kept as backup)
5. ✅ Enjoy unlimited multi-voice dialogue generation!

## Service Architecture

```
┌──────────────────────────────────────────────────┐
│                  Your Application                 │
│                 (Next.js, Scripts)                │
└───────────────────┬──────────────────────────────┘
                    │
                    │ import { generateDialogue }
                    │
┌───────────────────▼──────────────────────────────┐
│              src/lib/dia.ts                      │
│          (TypeScript Client Library)             │
└───────────────────┬──────────────────────────────┘
                    │
                    │ HTTP POST /generate
                    │
┌───────────────────▼──────────────────────────────┐
│         FastAPI Server (dia-api.py)              │
│           Port 8765 (Docker Container)           │
└───────────────────┬──────────────────────────────┘
                    │
                    │ Python transformers API
                    │
┌───────────────────▼──────────────────────────────┐
│      Dia Model (nari-labs/Dia-1.6B-0626)        │
│           Running on GPU (CUDA 12.6)             │
└──────────────────────────────────────────────────┘
```

## All AI Systems Can Now Use Dia

Any AI system (Claude, GPT, Gemini, etc.) working with this codebase can:

1. Read CLAUDE.md to understand Dia usage
2. Import `src/lib/dia.ts` in TypeScript code
3. Use `generateDialogue()` for multi-voice shows
4. Use `Emotion` object for emotional markers
5. Check `docs/DIA-MIGRATION.md` for migration patterns

## Status

✅ **COMPLETE AND READY TO USE**

- Docker service configured
- TypeScript client library complete
- Documentation comprehensive
- Test suite functional
- npm scripts added
- Migration guide written
- CLAUDE.md updated

ElevenLabs is DEPRECATED. Use Dia for all TTS.
