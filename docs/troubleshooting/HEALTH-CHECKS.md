# Health Checks Guide

How to verify each service is working correctly.

---

## Quick Overview

Visit **http://localhost:3000/studio/system-status** for an at-a-glance view of all services.

---

## Service-by-Service Checks

### PostgreSQL

**Check if running:**
```bash
docker compose ps postgres
```

**Verify connection:**
```bash
docker exec ck-postgres pg_isready
# Output: localhost:5432 - accepting connections
```

**Test query:**
```bash
docker exec ck-postgres psql -U postgres -d talkshowgo -c "SELECT 1"
```

**Check tables exist:**
```bash
docker exec ck-postgres psql -U postgres -d talkshowgo -c "\dt"
```

---

### Redis

**Check if running:**
```bash
docker compose ps redis
```

**Verify connection:**
```bash
docker exec ck-redis redis-cli ping
# Output: PONG
```

**Check keys:**
```bash
docker exec ck-redis redis-cli KEYS "*"
```

---

### SearXNG

**Check if running:**
```bash
docker compose ps searxng
```

**Health endpoint:**
```bash
curl http://localhost:8888/healthz
```

**Test search:**
```bash
curl "http://localhost:8888/search?q=test&format=json" | head -100
```

---

### Ollama

**Check connection:**
```bash
curl http://localhost:11434/api/tags
```

**List models:**
```bash
ollama list
# Or via API
curl http://localhost:11434/api/tags
```

**Test generation:**
```bash
curl http://localhost:11434/api/generate -d '{
  "model": "llama3.2",
  "prompt": "Hello",
  "stream": false
}'
```

---

### Qdrant

**Check if running:**
```bash
docker compose ps qdrant
```

**Health check:**
```bash
curl http://localhost:6333/
```

**List collections:**
```bash
curl http://localhost:6333/collections
```

---

### Kong API Gateway

**Check if running:**
```bash
docker compose ps kong
```

**Test endpoint:**
```bash
curl http://localhost:8000/
```

---

### PostgREST

**Check if running:**
```bash
docker compose ps postgrest
```

**Test API:**
```bash
curl http://localhost:3333/
```

---

## API Health Checks

### System Status API

```bash
curl http://localhost:3000/api/system/status | jq
```

Returns status for all services:
- `connected` - Working
- `error` - Connection failed
- `missing` - API key not configured
- `rate_limited` - Temporarily unavailable

### News Aggregator Status

```bash
curl "http://localhost:3000/api/intelligence/news?status=true" | jq
```

### Individual Service Checks

```bash
# ElevenLabs
curl http://localhost:3000/api/system/status | jq '.services.voice'

# Twitter
curl http://localhost:3000/api/system/status | jq '.services.content'

# News APIs
curl http://localhost:3000/api/system/status | jq '.services.news'
```

---

## Common Issues by Status

### Status: "missing"

**Meaning:** API key not configured

**Fix:**
1. Add key to `.env.local`
2. Restart dev server

### Status: "error"

**Meaning:** Service not reachable or key invalid

**Fix:**
1. Check service is running
2. Verify API key is valid
3. Check network connectivity

### Status: "rate_limited"

**Meaning:** Too many requests

**Fix:**
1. Wait for cooldown (shown in status)
2. Upgrade to higher tier
3. Use backup service

---

## Health Check Scripts

### All Services

Create `scripts/health-check.sh`:
```bash
#!/bin/bash

echo "=== PostgreSQL ==="
docker exec ck-postgres pg_isready

echo "=== Redis ==="
docker exec ck-redis redis-cli ping

echo "=== SearXNG ==="
curl -s http://localhost:8888/healthz

echo "=== Ollama ==="
curl -s http://localhost:11434/api/tags | head -1

echo "=== API Status ==="
curl -s http://localhost:3000/api/system/status | jq '.overall'
```

Run:
```bash
chmod +x scripts/health-check.sh
./scripts/health-check.sh
```

---

## Automated Monitoring

### Using npm scripts

```bash
# Check all services
npm run check:health

# Check specific services
npm run check:ai
npm run check:voice
```

---

## Expected Status

When everything is working:

```json
{
  "success": true,
  "overall": "connected",
  "statusCounts": {
    "connected": 10,
    "error": 0,
    "missing": 0,
    "rate_limited": 0
  }
}
```

Acceptable during development:
```json
{
  "overall": "warning",
  "statusCounts": {
    "connected": 7,
    "missing": 3  // Optional services
  }
}
```

---

## Next Steps

- [Common Issues](./COMMON-ISSUES.md)
- [Back to Deployment Guide](../DEPLOYMENT.md)
