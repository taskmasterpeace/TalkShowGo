# ElevenLabs Setup Guide

ElevenLabs provides text-to-speech and voice cloning for Talk Show Go.

---

## Sign Up

1. Go to https://elevenlabs.io
2. Click "Sign Up"
3. Create account (Google, GitHub, or email)

---

## Get API Key

1. Log in to ElevenLabs
2. Click your profile icon (top right)
3. Select "Profile + API key"
4. Copy your API key

---

## Add to Talk Show Go

Edit `.env.local`:

```env
ELEVENLABS_API_KEY=your_api_key_here
```

Restart the development server:
```bash
npm run dev
```

---

## Verify Setup

1. Visit http://localhost:3000/studio/system-status
2. Look for "ElevenLabs TTS" under Voice & Audio
3. Should show "Connected" with remaining credits

Or use the API:
```bash
curl http://localhost:3000/api/system/status
```

---

## Plans & Pricing

| Plan | Price | Characters/Month | Features |
|------|-------|-----------------|----------|
| **Free** | $0 | 10,000 | Basic voices |
| **Starter** | $5 | 30,000 | Voice cloning |
| **Creator** | $11 | 100,000 | Professional cloning |
| **Pro** | $82.50 | 500,000 | All features |

**Recommendation:** Start with Starter ($5/month) for voice cloning.

---

## Voice Cloning

### Create a Cloned Voice

1. Go to ElevenLabs dashboard
2. Click "Voices" > "Add Voice" > "Instant Voice Cloning"
3. Upload audio samples (minimum 1 minute, clean audio)
4. Name your voice
5. Copy the Voice ID

### Use Cloned Voice

The voice ID is already configured in Talk Show Go:
```typescript
// src/lib/elevenlabs.ts
const ALGORITHM_VOICE_ID = "ZJ7BlVZrxZKBDMTIK5c9"
```

To use a different voice, update this ID.

---

## Features Available

| Feature | Plan Required | Talk Show Go Support |
|---------|---------------|---------------------|
| Text-to-Speech | Free | Yes |
| Voice Cloning | Starter+ | Yes |
| Sound Effects | Creator+ | Planned |
| Music Generation | Pro+ | Planned |
| Conversational AI | Creator+ | Planned |

---

## Troubleshooting

### "API key invalid"
- Check for extra spaces in `.env.local`
- Regenerate key if compromised

### "Quota exceeded"
- Wait for monthly reset
- Upgrade plan for more characters

### Voice sounds different
- Check voice settings (stability, clarity)
- Verify correct voice ID

---

## Next Steps

- [Back to Deployment Guide](../DEPLOYMENT.md)
- [Voice Configuration](../services/VOICE.md)
