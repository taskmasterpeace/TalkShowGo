# Voice Configuration Guide

Talk Show Go uses ElevenLabs for text-to-speech and voice cloning.

---

## Voice Providers

| Provider | Type | Use Case |
|----------|------|----------|
| **ElevenLabs** | Cloud | Primary TTS, voice cloning |
| **Chatterbox** | Self-hosted | Alternative TTS |

---

## ElevenLabs Setup

### Get API Key

See [ElevenLabs Setup Guide](../api-keys/ELEVENLABS.md)

### Configure

```env
ELEVENLABS_API_KEY=your_key_here
```

### Default Voice

The "Battlerap Algorithm" voice is pre-configured:

```typescript
// src/lib/elevenlabs.ts
const ALGORITHM_VOICE_ID = "ZJ7BlVZrxZKBDMTIK5c9"
```

---

## Voice Cloning

### Create Your Own Voice

1. Go to ElevenLabs dashboard
2. Click "Voices" > "Add Voice" > "Instant Voice Cloning"
3. Upload audio samples:
   - Minimum 1 minute of audio
   - Clear speech, no background noise
   - Consistent tone and pace
4. Name and save your voice
5. Copy the Voice ID

### Use Custom Voice

Update voice ID in your configuration or show templates.

---

## Available Voices

### Pre-made ElevenLabs Voices

| Voice | ID | Style |
|-------|-----|-------|
| Rachel | 21m00Tcm4TlvDq8ikWAM | Female, conversational |
| Domi | AZnzlk1XvdvUeBnXmlld | Female, narrative |
| Adam | pNInz6obpgDQGcFmaJgB | Male, deep |
| Antoni | ErXwobaYiN019PkySvjV | Male, warm |

### Host Personalities

Talk Show Go includes 7 host personalities:

1. **Maya Sterling** - Investigative anchor
2. **Marcus Blaze** - Hot take king
3. **Devon Sharp** - Witty satirist
4. **Tasha Raw** - Unfiltered real talk
5. **James Noble** - Smooth narrator
6. **DJ Momentum** - High energy
7. **King Knowledge** - Street analyst

---

## Voice Settings

### Voice Parameters

```typescript
{
  stability: 0.5,        // 0-1, higher = more consistent
  similarity_boost: 0.75, // 0-1, higher = more like original
  style: 0.0,            // 0-1, style exaggeration
  use_speaker_boost: true // Enhance clarity
}
```

### Recommended Settings

**Documentary style:**
```typescript
{ stability: 0.7, similarity_boost: 0.8 }
```

**Energetic host:**
```typescript
{ stability: 0.4, similarity_boost: 0.6, style: 0.3 }
```

**Conversational:**
```typescript
{ stability: 0.5, similarity_boost: 0.75 }
```

---

## Verify Voice Setup

1. Visit http://localhost:3000/studio/system-status
2. Check "ElevenLabs TTS" status
3. View remaining credits

Test voice generation:
```bash
curl -X POST http://localhost:3000/api/voice \
  -H "Content-Type: application/json" \
  -d '{"text": "Hello, this is a test.", "voice_id": "ZJ7BlVZrxZKBDMTIK5c9"}'
```

---

## Chatterbox (Alternative)

### What is Chatterbox?

Self-hosted TTS server with voice cloning.

### Setup

1. Install Chatterbox on a server with GPU
2. Configure URL:

```env
CHATTERBOX_URL=http://192.168.1.211:4123
```

### Usage

Chatterbox is used automatically if ElevenLabs is unavailable.

---

## Multi-Speaker Support

### Show Formats

| Format | Speakers |
|--------|----------|
| Solo | 1 host |
| Interview | Host + 1 guest |
| Panel | Host + 2-3 guests |
| Debate | 2 opposing voices |

### Voice Assignment

In show templates:
```typescript
voiceAssignments: {
  host: "ZJ7BlVZrxZKBDMTIK5c9",
  guest: "21m00Tcm4TlvDq8ikWAM",
  narrator: "AZnzlk1XvdvUeBnXmlld"
}
```

---

## Audio Quality

### Output Format

ElevenLabs returns MP3 by default.

Settings in `src/lib/elevenlabs.ts`:
```typescript
output_format: "mp3_44100_128"
```

Options:
- `mp3_44100_64` - Lower quality, smaller files
- `mp3_44100_128` - Standard quality
- `mp3_44100_192` - Higher quality

---

## Troubleshooting

### "Voice generation failed"

1. Check API key is valid
2. Verify sufficient credits
3. Check voice ID exists

### "Voice sounds different"

1. Check voice settings
2. Verify correct voice ID
3. Try adjusting stability

### Slow generation

1. Use shorter text segments
2. Check network latency
3. Consider Chatterbox for local generation

---

## Cost Management

### ElevenLabs Pricing

- ~30 characters = 1 credit
- 1500-word script = ~7,500 characters = ~250 credits
- Starter plan: 30,000 credits/month = ~120 scripts

### Reduce Costs

1. Keep scripts concise
2. Preview text before generating
3. Cache generated audio

---

## Next Steps

- [ElevenLabs Setup](../api-keys/ELEVENLABS.md)
- [Back to Deployment Guide](../DEPLOYMENT.md)
