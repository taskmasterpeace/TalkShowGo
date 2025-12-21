# Qdrant Setup Guide

Qdrant is a vector database used for semantic search and RAG (Retrieval Augmented Generation) in Talk Show Go.

---

## What is Qdrant?

Qdrant stores and searches vector embeddings:
- Semantic similarity search
- Entity matching
- Content recommendations
- RAG for LLM context

---

## Default Setup (Docker)

Qdrant is included in Docker Compose:

```bash
# Start all services
docker compose up -d

# Verify Qdrant is running
curl http://localhost:6333/
```

---

## Configuration

Edit `.env.local`:

```env
QDRANT_URL=http://localhost:6333
```

---

## Verify Setup

1. Visit http://localhost:3000/studio/system-status
2. Check for Qdrant connection status

Or via API:
```bash
curl http://localhost:6333/collections
```

---

## Collections

Talk Show Go uses these collections:

| Collection | Purpose |
|------------|---------|
| `entities` | Entity embeddings for matching |
| `content` | Content embeddings for search |
| `stories` | Story embeddings for similarity |

### Create Collection

```bash
curl -X PUT http://localhost:6333/collections/entities \
  -H "Content-Type: application/json" \
  -d '{
    "vectors": {
      "size": 768,
      "distance": "Cosine"
    }
  }'
```

---

## Web Dashboard

Access Qdrant dashboard:
http://localhost:6333/dashboard

Features:
- View collections
- Search vectors
- Monitor performance

---

## Remote Qdrant

### Self-Hosted Remote

```env
QDRANT_URL=http://192.168.1.211:6333
```

### Qdrant Cloud

1. Create account at https://cloud.qdrant.io
2. Create cluster
3. Get API key and URL
4. Configure:

```env
QDRANT_URL=https://your-cluster.qdrant.io:6333
QDRANT_API_KEY=your-api-key
```

---

## Performance Tuning

### Memory Settings

In `docker-compose.yml`:

```yaml
qdrant:
  environment:
    QDRANT__SERVICE__MAX_REQUEST_SIZE: 33554432
  deploy:
    resources:
      limits:
        memory: 4G
```

### Index Optimization

```bash
# Optimize collection
curl -X POST "http://localhost:6333/collections/entities/index" \
  -H "Content-Type: application/json" \
  -d '{
    "field_name": "text",
    "field_schema": "text"
  }'
```

---

## Backup & Restore

### Backup

```bash
# Snapshot a collection
curl -X POST "http://localhost:6333/collections/entities/snapshots"

# Download snapshot
curl "http://localhost:6333/collections/entities/snapshots/snapshot-name" -o backup.snapshot
```

### Restore

```bash
# Upload and restore
curl -X PUT "http://localhost:6333/collections/entities/snapshots/upload" \
  -F "snapshot=@backup.snapshot"
```

---

## Troubleshooting

### "Connection refused"

```bash
# Check container
docker compose ps qdrant

# View logs
docker compose logs qdrant

# Restart
docker compose restart qdrant
```

### "Collection not found"

Collections are created automatically. If missing:
```bash
# Run migrations
npm run db:migrate
```

### High memory usage

- Reduce collection size
- Enable disk storage
- Limit vector dimensions

---

## Alternatives

### Without Vector Search

If you don't need semantic search:
1. Remove Qdrant from docker-compose.yml
2. Disable vector features in app

### Other Vector Databases

- Pinecone (cloud)
- Weaviate (self-hosted)
- Milvus (self-hosted)

---

## Next Steps

- [Back to Deployment Guide](../DEPLOYMENT.md)
- [Ollama Setup](./OLLAMA.md) (for embeddings)
