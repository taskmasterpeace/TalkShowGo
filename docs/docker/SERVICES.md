# Docker Services Reference

Detailed documentation for each Docker service in Talk Show Go.

---

## Core Services

### PostgreSQL (pgvector)

**Container:** `ck-postgres`
**Image:** `pgvector/pgvector:0.8.0-pg15`
**Port:** 5432

Main database with vector extension for embeddings.

**Environment Variables:**
```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/talkshowgo
```

**Access Database:**
```bash
# psql shell
docker exec -it ck-postgres psql -U postgres -d talkshowgo

# Run query
docker exec ck-postgres psql -U postgres -d talkshowgo -c "SELECT COUNT(*) FROM topics"
```

**Health Check:**
```bash
docker exec ck-postgres pg_isready
```

---

### Redis

**Container:** `ck-redis`
**Image:** `redis:7-alpine`
**Port:** 6379

Job queue for BullMQ background workers.

**Environment Variables:**
```env
REDIS_URL=redis://localhost:6379
```

**Access Redis:**
```bash
# Redis CLI
docker exec -it ck-redis redis-cli

# Check keys
docker exec ck-redis redis-cli KEYS "*"
```

**Health Check:**
```bash
docker exec ck-redis redis-cli ping
# Returns: PONG
```

---

### PostgREST

**Container:** `ck-postgrest`
**Image:** `postgrest/postgrest:v12.0.2`
**Port:** 3333

REST API auto-generated from PostgreSQL schema.

**Health Check:**
```bash
curl http://localhost:3333/
```

---

### Kong API Gateway

**Container:** `ck-kong`
**Image:** `kong:2.8`
**Ports:** 8000 (HTTP), 8443 (HTTPS)

API Gateway handling authentication and routing.

**Config File:** `docker/kong.yml`

**Health Check:**
```bash
curl http://localhost:8000/
```

---

## Optional Services

### SearXNG

**Container:** `ck-searxng`
**Image:** `searxng/searxng:latest`
**Port:** 8888

Self-hosted meta search engine for web searches.

**Environment Variables:**
```env
SEARXNG_URL=http://localhost:8888
```

**Health Check:**
```bash
curl http://localhost:8888/healthz
```

**Test Search:**
```bash
curl "http://localhost:8888/search?q=test&format=json"
```

---

### Qdrant

**Container:** `ck-qdrant`
**Image:** `qdrant/qdrant:latest`
**Ports:** 6333 (HTTP), 6334 (gRPC)

Vector database for RAG and semantic search.

**Environment Variables:**
```env
QDRANT_URL=http://localhost:6333
```

**Health Check:**
```bash
curl http://localhost:6333/
```

---

### Supabase Studio

**Container:** `ck-studio`
**Image:** `supabase/studio:20231123-64a766a`
**Port:** 3001

Web UI for database management.

**Access:** http://localhost:3001

---

### Worker

**Container:** `ck-worker`
**Build:** `./Dockerfile.worker`

Background job processor for:
- Transcript fetching
- Entity extraction
- Story generation

**Logs:**
```bash
docker compose logs -f worker
```

---

## Service Dependencies

```
PostgreSQL (5432)
    ├── PostgREST (3333)
    │       └── Kong (8000)
    └── Worker
            └── Redis (6379)

SearXNG (8888) - Independent
Qdrant (6333) - Independent
Studio (3001) - Depends on PostgreSQL
```

---

## Removing Services

To use external services instead of Docker:

### Use External PostgreSQL

1. Comment out `postgres` in `docker-compose.yml`
2. Update `DATABASE_URL`:
   ```env
   DATABASE_URL=postgresql://user:pass@your-db.com:5432/talkshowgo
   ```

### Use External Redis

1. Comment out `redis` in `docker-compose.yml`
2. Update `REDIS_URL`:
   ```env
   REDIS_URL=redis://your-redis.com:6379
   ```

### Use External Ollama

No Docker service for Ollama by default. Just configure:
```env
OLLAMA_HOST=http://192.168.1.211:11434
```

---

## Next Steps

- [Networking Guide](./NETWORKING.md)
- [Docker Setup](./DOCKER-SETUP.md)
- [Back to Deployment Guide](../DEPLOYMENT.md)
