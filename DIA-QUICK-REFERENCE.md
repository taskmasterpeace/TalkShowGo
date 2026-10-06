# Dia TTS - Quick Reference Card

## Start/Stop

```bash
npm run dia:up        # Start Dia service
npm run check:voice   # Check if running
npm run dia:logs      # View logs
npm run dia:test      # Run test suite
docker compose down   # Stop all services
```

## Basic Usage

```typescript
import { generateDialogue, Emotion } from './src/lib/dia'

// Simple 2-voice
const audio = await generateDialogue({
  segments: [
    { speaker: 1, text: "Hello!" },
    { speaker: 2, text: "Hi there!" }
  ],
  seed: 42
})

// With emotions
const audio2 = await generateDialogue({
  segments: [
    { speaker: 1, text: `Welcome! ${Emotion.laughs}` },
    { speaker: 2, text: `Thanks! ${Emotion.chuckle}` }
  ],
  seed: 42
})
```

## 3 Speakers

```typescript
// Maya + Marcus (Seed 100)
await generateDialogue({
  segments: [
    { speaker: 1, text: "Maya here" },
    { speaker: 2, text: "Marcus here" }
  ],
  seed: 100
})

// Maya + Sarah (Seed 200)
await generateDialogue({
  segments: [
    { speaker: 1, text: "Maya here" },
    { speaker: 2, text: "Sarah here" }
  ],
  seed: 200
})
```

Result: 3 voices (Maya, Marcus, Sarah)

## Emotions

```typescript
Emotion.laughs      // (laughs)
Emotion.chuckle     // (chuckle)
Emotion.whispers    // (whispers)
Emotion.sighs       // (sighs)
Emotion.gasps       // (gasps)
Emotion.coughs      // (coughs)
Emotion.groans      // (groans)
Emotion.claps       // (claps)
Emotion.screams     // (screams)
Emotion.inhales     // (inhales)
Emotion.exhales     // (exhales)
Emotion.applause    // (applause)
Emotion.humming     // (humming)
Emotion.sneezes     // (sneezes)
Emotion.whistles    // (whistles)
```

## API

```bash
# Generate
curl -X POST http://localhost:8765/generate \
  -H "Content-Type: application/json" \
  -d '{
    "text": "[S1] Hey! (laughs) [S2] Hi!",
    "seed": 42
  }' --output out.mp3

# Health
curl http://localhost:8765/health
```

## Rules

- Text MUST start with `[S1]`
- MUST alternate `[S1]` and `[S2]`
- NEVER repeat same speaker twice
- Same seed = same voices
- Different seed = different voices

## Files

| File | Purpose |
|------|---------|
| `src/lib/dia.ts` | TypeScript client |
| `test-dia.ts` | Test suite |
| `CLAUDE.md` lines 148-297 | Full docs |
| `docs/DIA-MIGRATION.md` | Migration guide |
| `docker/dia/README.md` | Service docs |

## Troubleshooting

```bash
# GPU check
nvidia-smi

# Docker GPU
docker run --rm --gpus all nvidia/cuda:12.6.0-base nvidia-smi

# View logs
npm run dia:logs

# Rebuild
docker compose up dia --build -d
```

## Migration from ElevenLabs

❌ OLD:
```typescript
import { textToSpeech } from './src/lib/elevenlabs'
```

✅ NEW:
```typescript
import { generateDialogue } from './src/lib/dia'
```

## Requirements

- GPU: 4.4GB+ VRAM
- CUDA: 12.6+
- Docker: nvidia-container-toolkit

## Performance

- Speed: ~2x realtime
- VRAM: 4.4GB
- No costs, no limits
