# Optional APIs

These APIs are optional - Talk Show Go works without them using self-hosted alternatives.

---

## OpenAI

### What It's For
Cloud-hosted LLM for content generation.

### Alternative
Ollama (self-hosted, free)

### Setup

1. Go to https://platform.openai.com
2. Create account and add payment method
3. Go to API Keys
4. Create new key
5. Add to `.env.local`:

```env
OPENAI_API_KEY=sk-...
```

### Pricing
- GPT-4: ~$0.03 per 1K tokens
- GPT-3.5: ~$0.002 per 1K tokens

### When to Use
- Need latest models (GPT-4o)
- Don't want to manage Ollama
- Need high availability

---

## Anthropic Claude

### What It's For
Cloud-hosted LLM (Claude models).

### Alternative
Ollama (self-hosted, free)

### Setup

1. Go to https://console.anthropic.com
2. Create account
3. Go to API Keys
4. Generate new key
5. Add to `.env.local`:

```env
ANTHROPIC_API_KEY=sk-ant-...
```

### Pricing
- Claude 3.5 Sonnet: ~$0.003 per 1K tokens
- Claude 3 Opus: ~$0.015 per 1K tokens

### When to Use
- Need Claude's writing style
- Long context windows (200K)
- Don't want to manage Ollama

---

## YouTube API

### What It's For
Official YouTube data access.

### Alternative
youtubei.js (free, no key needed)

Talk Show Go uses youtubei.js by default, so this is rarely needed.

### Setup

1. Go to https://console.cloud.google.com
2. Create project
3. Enable YouTube Data API v3
4. Create API key
5. Add to `.env.local`:

```env
YOUTUBE_API_KEY=AIza...
```

### Pricing
- 10,000 units/day free
- ~$0.001 per additional unit

### When to Use
- Need higher rate limits
- Need live streaming data
- youtubei.js having issues

---

## Perplexity Sonar

### What It's For
AI-powered web search with citations.

### Alternative
SearXNG (self-hosted, free)

### Setup

1. Go to https://perplexity.ai
2. Create account
3. Go to Settings > API
4. Generate key
5. Add to `.env.local`:

```env
PERPLEXITY_API_KEY=pplx-...
```

### Pricing
- 5 free queries/month
- ~$0.006 per query after

### When to Use
- Need AI-synthesized answers
- SearXNG not sufficient
- Need citations automatically

---

## Choosing Your Setup

### Minimum (Free)
```env
ELEVENLABS_API_KEY=...     # Required for voice
# Everything else uses free alternatives
```

### Recommended
```env
ELEVENLABS_API_KEY=...     # Voice
THENEWSAPI_KEY=...         # News
NEWSDATA_API_KEY=...       # Backup news
TWITTER_API_KEY=...        # Social media
# Ollama for LLM (free, self-hosted)
```

### Full Cloud
```env
ELEVENLABS_API_KEY=...
ANTHROPIC_API_KEY=...      # Or OPENAI_API_KEY
THENEWSAPI_KEY=...
NEWSDATA_API_KEY=...
TWITTER_API_KEY=...
PERPLEXITY_API_KEY=...
```

---

## Self-Hosted Alternatives

| Cloud Service | Self-Hosted Alternative |
|--------------|------------------------|
| OpenAI/Claude | Ollama + Llama/Mistral |
| Perplexity | SearXNG |
| YouTube API | youtubei.js |
| Managed PostgreSQL | Docker PostgreSQL |
| Managed Redis | Docker Redis |

---

## Next Steps

- [Ollama Setup](../services/OLLAMA.md)
- [SearXNG Setup](../services/SEARXNG.md)
- [Back to Deployment Guide](../DEPLOYMENT.md)
