# SearXNG Setup Guide

SearXNG is a self-hosted meta search engine that provides web search for Talk Show Go.

---

## What is SearXNG?

SearXNG aggregates results from multiple search engines:
- Google, Bing, DuckDuckGo
- Reddit, Wikipedia, YouTube
- News sources, academic papers

Benefits:
- No tracking or profiling
- Free and unlimited
- Self-hosted privacy
- No API keys needed

---

## Default Setup (Docker)

SearXNG is included in the Docker setup:

```bash
# Start all services (including SearXNG)
docker compose up -d

# Verify it's running
curl http://localhost:8888/healthz
```

Access the web UI: http://localhost:8888

---

## Configuration

### Talk Show Go Config

Edit `.env.local`:

```env
SEARXNG_URL=http://localhost:8888
```

### SearXNG Settings

Configuration file: `docker/searxng/settings.yml`

Key settings:
```yaml
general:
  instance_name: "Talk Show Go Search"

search:
  safe_search: 0
  autocomplete: ""

engines:
  - name: google
    engine: google
    disabled: false
  - name: bing
    engine: bing
    disabled: false
```

---

## Verify in Talk Show Go

1. Visit http://localhost:3000/studio/system-status
2. Look for "SearXNG" under Content Sources
3. Should show "Running at localhost:8888"

Test search:
```bash
curl "http://localhost:8888/search?q=test&format=json"
```

---

## Using SearXNG

### In Deep Research

SearXNG is automatically used in research workflows:
```
researchTopic()
  ├── YouTube search
  ├── Twitter search
  ├── SearXNG web search  ← Provides web results
  └── News API search
```

### API Endpoints

```bash
# Search
curl "http://localhost:8888/search?q=battle%20rap&format=json"

# With categories
curl "http://localhost:8888/search?q=query&categories=news&format=json"

# Available categories: general, images, news, videos, files, music, it, science
```

---

## Engine Configuration

### Enable/Disable Engines

Edit `docker/searxng/settings.yml`:

```yaml
engines:
  # Enable Google
  - name: google
    disabled: false

  # Disable Bing
  - name: bing
    disabled: true
```

### Recommended Engines

For Talk Show Go:

```yaml
engines:
  # General search
  - name: google
    disabled: false
  - name: duckduckgo
    disabled: false

  # News
  - name: google news
    disabled: false
  - name: bing news
    disabled: false

  # Social
  - name: reddit
    disabled: false

  # Reference
  - name: wikipedia
    disabled: false
```

---

## Performance Tuning

### Reduce Latency

```yaml
# In settings.yml
outgoing:
  request_timeout: 3.0  # Reduce from default 6.0
  max_request_timeout: 10.0

server:
  limiter: false  # Disable if only local access
```

### Enable Caching

```yaml
# In settings.yml
redis:
  url: redis://redis:6379/0  # Use existing Redis
```

---

## Troubleshooting

### "SearXNG not running"

```bash
# Check container status
docker compose ps searxng

# View logs
docker compose logs searxng

# Restart
docker compose restart searxng
```

### "No results"

1. Check engine configuration
2. Verify network connectivity
3. Some engines may be rate-limited

### "Slow searches"

1. Enable caching with Redis
2. Reduce request timeout
3. Disable slow engines

---

## Remote SearXNG

### Using External Instance

```env
SEARXNG_URL=http://192.168.1.100:8888
```

### Public Instances

You can use public SearXNG instances (not recommended for privacy):
- https://searx.be
- https://search.sapti.me

---

## Alternatives

If you don't want SearXNG:

### Perplexity API
```env
PERPLEXITY_API_KEY=pplx-...
```

### Disable Web Search
Remove web search from research pipeline in `src/lib/deep-research.ts`

---

## Next Steps

- [Back to Deployment Guide](../DEPLOYMENT.md)
- [Ollama Setup](./OLLAMA.md)
- [Voice Configuration](./VOICE.md)
