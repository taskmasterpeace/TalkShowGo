# Dia Multi-Voice TTS Service

Multi-voice dialogue generation with emotional markers and speaker tags.

## Features

- **[S1]/[S2] Speaker Tags** - Natural multi-voice conversations
- **Emotional Markers** - (laughs), (whispers), (sighs), (gasps), and 12+ more
- **Consistent Voices** - Same seed = same voices across generations
- **Real-time Generation** - ~2x faster than realtime on GPU
- **No API Keys** - Fully local, self-hosted service

## Requirements

- **GPU Required**: NVIDIA GPU with 4.4GB+ VRAM
- CUDA 12.6+
- Docker with nvidia-container-toolkit

## Quick Start

```bash
# Build and start Dia service
docker compose up dia --build -d

# Check if service is running
curl http://localhost:8765/health

# Test generation
curl -X POST http://localhost:8765/generate \
  -H "Content-Type: application/json" \
  -d '{
    "text": "[S1] Hey there! (laughs) This is incredible! [S2] I know right? (whispers) This changes everything.",
    "seed": 42
  }' \
  --output test.mp3
```

## API Endpoints

### POST /generate
Generate multi-voice speech from text

**Request:**
```json
{
  "text": "[S1] Text here [S2] Response here",
  "max_new_tokens": 3072,
  "guidance_scale": 3.0,
  "temperature": 1.8,
  "output_format": "mp3",
  "seed": 42
}
```

**Response:** MP3/WAV audio file

### GET /health
Check service status

**Response:**
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

## Usage Examples

### TypeScript Client

```typescript
import { generateDialogue, Emotion } from './src/lib/dia'

// Generate 2-speaker conversation
const audio = await generateDialogue({
  segments: [
    { speaker: 1, text: `Hey there! ${Emotion.laughs} This is incredible!` },
    { speaker: 2, text: `I know right? ${Emotion.whispers} This changes everything.` }
  ],
  seed: 42  // Same seed = same voices
})
```

### Python Client

```python
import requests

response = requests.post('http://localhost:8765/generate', json={
    'text': '[S1] Hello! (laughs) [S2] Hi there! (chuckle)',
    'seed': 42
})

with open('output.mp3', 'wb') as f:
    f.write(response.content)
```

## Speaker Tag Rules

1. **Always start with [S1]**
2. **Always alternate** between [S1] and [S2]
3. **Never repeat** the same speaker tag consecutively

✅ Good: `[S1] Text [S2] Response [S1] Reply`
❌ Bad: `[S1] Text [S1] More text [S2] Response`

## Emotional Markers

Add emotions anywhere in the text:

- `(laughs)` - Laughter
- `(chuckle)` - Light laugh
- `(whispers)` - Whispering
- `(sighs)` - Sighing
- `(gasps)` - Gasping
- `(coughs)` - Coughing
- `(groans)` - Groaning
- `(claps)` - Clapping
- `(screams)` - Screaming
- `(inhales)` - Breathing in
- `(exhales)` - Breathing out
- `(applause)` - Audience applause
- `(burps)` - Burping
- `(humming)` - Humming
- `(sneezes)` - Sneezing
- `(whistles)` - Whistling

## Performance

- **Speed**: ~2x realtime on RTX 4090
- **VRAM**: 4.4GB (bfloat16)
- **Model**: 1.6B parameters
- **Quality**: Natural conversational dialogue

## Troubleshooting

### Service won't start
- Check GPU availability: `nvidia-smi`
- Verify Docker has GPU access: `docker run --rm --gpus all nvidia/cuda:12.6.0-base-ubuntu22.04 nvidia-smi`

### Out of memory
- Reduce `max_new_tokens` in request
- Use `bfloat16` dtype (default)

### Voices sound inconsistent
- Use `seed` parameter for consistent voices
- Same seed = same voices across all generations

## Why Dia?

- ✅ **Multi-voice out of the box** - No voice ID management
- ✅ **Emotional expression** - (laughs), (whispers), etc.
- ✅ **Fully local** - No API keys, no usage limits
- ✅ **Fast** - 2x realtime on GPU
- ✅ **Natural dialogue** - Trained specifically for conversations

## Links

- GitHub: https://github.com/nari-labs/dia
- Model: https://huggingface.co/nari-labs/Dia-1.6B-0626
