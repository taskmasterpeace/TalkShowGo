# Docker Setup Guide

Complete guide to setting up and managing Docker services for Talk Show Go.

---

## Prerequisites

- Docker Desktop 4.0+ (Windows/Mac) or Docker Engine 20.10+ (Linux)
- Docker Compose 2.0+
- At least 8GB RAM recommended
- 20GB free disk space

---

## Installation

### Windows/Mac

1. Download Docker Desktop from https://docker.com/products/docker-desktop
2. Run the installer
3. Start Docker Desktop
4. Verify installation:
   ```bash
   docker --version
   docker compose version
   ```

### Linux

```bash
# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Add user to docker group
sudo usermod -aG docker $USER

# Log out and back in, then verify
docker --version
```

---

## Starting Services

```bash
# Start all services
docker compose up -d

# View running services
docker compose ps

# View logs
docker compose logs -f
```

### Expected Output

```
NAME                STATUS              PORTS
tsg-postgres         running (healthy)   0.0.0.0:5432->5432/tcp
tsg-redis            running (healthy)   0.0.0.0:6379->6379/tcp
tsg-postgrest        running             0.0.0.0:3333->3000/tcp
tsg-kong             running             0.0.0.0:8000->8000/tcp
tsg-searxng          running             0.0.0.0:8888->8080/tcp
tsg-qdrant           running             0.0.0.0:6333->6333/tcp
tsg-studio           running             0.0.0.0:3001->3000/tcp
```

---

## Managing Services

### Start/Stop

```bash
# Stop all services
docker compose down

# Stop without removing containers
docker compose stop

# Start stopped containers
docker compose start

# Restart all services
docker compose restart

# Restart specific service
docker compose restart postgres
```

### Viewing Logs

```bash
# All services
docker compose logs -f

# Specific service
docker compose logs -f postgres

# Last 100 lines
docker compose logs --tail=100 postgres
```

### Checking Health

```bash
# Service status
docker compose ps

# PostgreSQL health
docker exec tsg-postgres pg_isready

# Redis health
docker exec tsg-redis redis-cli ping

# SearXNG health
curl http://localhost:8888/healthz
```

---

## Data Management

### Data Volumes

Data is persisted in Docker volumes:

| Volume | Purpose |
|--------|---------|
| `talkshowgo_postgres_data` | PostgreSQL database |
| `talkshowgo_redis_data` | Redis data |
| `talkshowgo_qdrant_data` | Vector database |

### Backup Data

```bash
# Backup PostgreSQL
docker exec tsg-postgres pg_dump -U postgres talkshowgo > backup.sql

# Backup all volumes
docker run --rm -v talkshowgo_postgres_data:/data -v $(pwd):/backup alpine tar czf /backup/postgres-backup.tar.gz -C /data .
```

### Restore Data

```bash
# Restore PostgreSQL
docker exec -i tsg-postgres psql -U postgres talkshowgo < backup.sql
```

### Reset Everything

**WARNING: This deletes all data!**

```bash
# Remove containers and volumes
docker compose down -v

# Start fresh
docker compose up -d

# Run migrations
npm run db:migrate
```

---

## Resource Usage

### Check Resource Usage

```bash
docker stats
```

### Limit Resources

Add to service in `docker-compose.yml`:

```yaml
services:
  postgres:
    deploy:
      resources:
        limits:
          memory: 2G
          cpus: '1.0'
```

---

## Common Issues

### Port Already in Use

```bash
# Find what's using the port
netstat -tulpn | grep :5432

# Kill the process or change the port in docker-compose.yml
```

### Services Won't Start

```bash
# Check Docker daemon
docker info

# Check service logs
docker compose logs postgres

# Remove and recreate
docker compose down
docker compose up -d
```

### Out of Disk Space

```bash
# Remove unused images
docker image prune -a

# Remove unused volumes
docker volume prune

# Full cleanup
docker system prune -a --volumes
```

---

## Next Steps

- [Services Reference](./SERVICES.md)
- [Networking Guide](./NETWORKING.md)
- [Back to Deployment Guide](../DEPLOYMENT.md)
