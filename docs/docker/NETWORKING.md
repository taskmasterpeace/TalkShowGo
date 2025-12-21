# Docker Networking Guide

How Docker services connect and communicate in Talk Show Go.

---

## Network Overview

All Docker services run on a shared network: `ck-network`

```
┌─────────────────────────────────────────────────────────────┐
│                      ck-network                              │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────┐    ┌───────────┐    ┌────────┐               │
│  │ postgres │────│ postgrest │────│  kong  │───► Port 8000 │
│  │  :5432   │    │   :3000   │    │ :8000  │               │
│  └──────────┘    └───────────┘    └────────┘               │
│       │                                                      │
│       │          ┌──────────┐                               │
│       └──────────│  worker  │                               │
│                  └──────────┘                               │
│                       │                                      │
│                  ┌──────────┐                               │
│                  │  redis   │───────────────► Port 6379     │
│                  │  :6379   │                               │
│                  └──────────┘                               │
│                                                              │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐             │
│  │ searxng  │    │  qdrant  │    │  studio  │             │
│  │  :8080   │    │  :6333   │    │  :3000   │             │
│  └──────────┘    └──────────┘    └──────────┘             │
│       │               │               │                     │
│       ▼               ▼               ▼                     │
│  Port 8888       Port 6333       Port 3001                 │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## Port Mappings

| Service | Internal Port | External Port | URL |
|---------|---------------|---------------|-----|
| PostgreSQL | 5432 | 5432 | `localhost:5432` |
| Redis | 6379 | 6379 | `localhost:6379` |
| PostgREST | 3000 | 3333 | `localhost:3333` |
| Kong | 8000 | 8000 | `localhost:8000` |
| SearXNG | 8080 | 8888 | `localhost:8888` |
| Qdrant | 6333 | 6333 | `localhost:6333` |
| Studio | 3000 | 3001 | `localhost:3001` |

---

## Service Communication

### Inside Docker Network

Services communicate using container names:
- `postgres:5432` (not `localhost:5432`)
- `redis:6379`
- `postgrest:3000`

Example from `docker-compose.yml`:
```yaml
worker:
  environment:
    DATABASE_URL: postgresql://postgres:postgres@postgres:5432/talkshowgo
    REDIS_URL: redis://redis:6379
```

### From Host Machine

Use localhost with external port:
- `localhost:5432` for PostgreSQL
- `localhost:6379` for Redis
- `localhost:8000` for API Gateway

---

## External Service Access

### Allowing External Connections

By default, ports are bound to `0.0.0.0` (all interfaces).

To restrict to localhost only:
```yaml
ports:
  - "127.0.0.1:5432:5432"
```

### Accessing External Services

From within Docker, use the host's IP:
```yaml
environment:
  OLLAMA_HOST: http://host.docker.internal:11434  # Docker Desktop
  # OR
  OLLAMA_HOST: http://192.168.1.211:11434         # IP address
```

---

## Common Network Issues

### Service Can't Connect

```bash
# Check if service is running
docker compose ps

# Check network
docker network ls
docker network inspect contentkingdom_ck-network

# Test connectivity from within container
docker exec ck-worker ping postgres
```

### Port Already in Use

```bash
# Find what's using the port
netstat -tulpn | grep :5432

# On Windows
netstat -ano | findstr :5432

# Change port in docker-compose.yml
ports:
  - "5433:5432"  # Use 5433 externally
```

### Can't Access from LAN

1. Check firewall allows the port
2. Ensure Docker binds to `0.0.0.0`:
   ```yaml
   ports:
     - "0.0.0.0:8000:8000"
   ```
3. Use machine's IP, not `localhost`

---

## Environment Variables Summary

For the Next.js app (`.env.local`):

```env
# Database (from host)
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/talkshowgo

# API Gateway
NEXT_PUBLIC_SUPABASE_URL=http://localhost:8000

# Redis
REDIS_URL=redis://localhost:6379

# Search
SEARXNG_URL=http://localhost:8888

# Vector DB
QDRANT_URL=http://localhost:6333

# External AI (not in Docker)
OLLAMA_HOST=http://192.168.1.211:11434
```

For Docker services (in `docker-compose.yml`):

```yaml
environment:
  # Use container names inside Docker
  DATABASE_URL: postgresql://postgres:postgres@postgres:5432/talkshowgo
  REDIS_URL: redis://redis:6379
```

---

## Next Steps

- [Services Reference](./SERVICES.md)
- [Docker Setup](./DOCKER-SETUP.md)
- [Back to Deployment Guide](../DEPLOYMENT.md)
