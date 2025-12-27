# Talk Show Go - Deployment Guide

Complete guide to deploying Talk Show Go from scratch. Whether you're setting up for development or production, this guide covers everything.

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Quick Start (5 minutes)](#quitsg-start)
3. [API Keys Setup](#api-keys-setup)
4. [Docker Services](#docker-services)
5. [Environment Configuration](#environment-configuration)
6. [Verification](#verification)
7. [Advanced Configuration](#advanced-configuration)
8. [Troubleshooting](#troubleshooting)

---

## Prerequisites

Before you begin, ensure you have:

| Requirement | Version | Check Command |
|-------------|---------|---------------|
| Docker | 20.10+ | `docker --version` |
| Docker Compose | 2.0+ | `docker compose version` |
| Node.js | 18+ | `node --version` |
| npm | 9+ | `npm --version` |
| Git | Any | `git --version` |

### Installing Prerequisites

**Docker Desktop (Windows/Mac):**
1. Download from https://www.docker.com/products/docker-desktop
2. Install and start Docker Desktop
3. Verify with `docker --version`

**Docker on Linux:**
```bash
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER
```

**Node.js:**
1. Download from https://nodejs.org (LTS version)
2. Or use nvm: `nvm install 18`

---

## Quick Start

Get Talk Show Go running in 5 minutes:

```bash
# 1. Clone the repository
git clone https://github.com/yourusername/talkshowgo.git
cd talkshowgo

# 2. Copy environment file
cp .env.example .env.local

# 3. Start Docker services
docker compose up -d

# 4. Install dependencies
npm install

# 5. Run database migrations
npm run db:migrate

# 6. Start development server
npm run dev
```

Open http://localhost:3000 in your browser.

**What's Running Now:**
- Next.js app on port 3000
- PostgreSQL database on port 5432
- Redis job queue on port 6379
- SearXNG search engine on port 8888
- PostgREST API on port 3333
- Kong API Gateway on port 8000
- Supabase Studio on port 3001
- Qdrant vector database on port 6333

---

## API Keys Setup

Talk Show Go requires some external API keys. Here's what you need:

### Required API Keys

| Service | Purpose | Free Tier | Get Key |
|---------|---------|-----------|---------|
| **ElevenLabs** | Voice generation | Limited | https://elevenlabs.io |

### Recommended API Keys

| Service | Purpose | Free Tier | Get Key |
|---------|---------|-----------|---------|
| **Twitter** | Social monitoring | Pay-as-you-go | https://twitterapi.io |
| **TheNewsAPI** | News aggregation | 100/day | https://thenewsapi.com |
| **NewsData.io** | Backup news | 200/day | https://newsdata.io |

### Optional API Keys

| Service | Purpose | Alternative |
|---------|---------|-------------|
| **YouTube API** | Video search | youtubei.js (no key needed) |
| **OpenAI** | Cloud LLM | Ollama (self-hosted) |
| **Anthropic** | Cloud LLM | Ollama (self-hosted) |

### Adding API Keys

Edit your `.env.local` file:

```env
# Required
ELEVENLABS_API_KEY=your_elevenlabs_key_here

# Recommended
TWITTER_API_KEY=your_twitter_key_here
THENEWSAPI_KEY=your_thenewsapi_key_here
NEWSDATA_API_KEY=your_newsdata_key_here

# Optional
OPENAI_API_KEY=your_openai_key_here
ANTHROPIC_API_KEY=your_anthropic_key_here
```

### API Key Setup Guides

For detailed setup instructions with screenshots:
- [ElevenLabs Setup](./api-keys/ELEVENLABS.md)
- [Twitter API Setup](./api-keys/TWITTER.md)
- [News APIs Setup](./api-keys/NEWS-APIS.md)
- [Optional APIs](./api-keys/OPTIONAL.md)

---

## Docker Services

Talk Show Go uses Docker Compose to run several services:

### Core Services (Required)

| Service | Port | Purpose |
|---------|------|---------|
| **PostgreSQL** | 5432 | Main database with pgvector |
| **Redis** | 6379 | Job queue for background workers |
| **PostgREST** | 3333 | REST API for database |
| **Kong** | 8000 | API Gateway |

### Optional Services

| Service | Port | Purpose |
|---------|------|---------|
| **SearXNG** | 8888 | Self-hosted web search |
| **Qdrant** | 6333 | Vector database for RAG |
| **Supabase Studio** | 3001 | Database admin UI |

### Managing Docker Services

```bash
# Start all services
docker compose up -d

# Stop all services
docker compose down

# View logs
docker compose logs -f

# View specific service logs
docker compose logs -f postgres

# Restart a service
docker compose restart postgres

# Reset everything (WARNING: deletes data)
docker compose down -v
docker compose up -d
```

### Service Health Checks

```bash
# Check all services
docker compose ps

# Check PostgreSQL
docker exec tsg-postgres pg_isready

# Check Redis
docker exec tsg-redis redis-cli ping
```

For detailed Docker documentation:
- [Docker Setup Guide](./docker/DOCKER-SETUP.md)
- [Services Reference](./docker/SERVICES.md)
- [Networking Guide](./docker/NETWORKING.md)

---

## Environment Configuration

### Core Variables

```env
# Database
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/talkshowgo
NEXT_PUBLIC_SUPABASE_URL=http://localhost:8000
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

# Redis
REDIS_URL=redis://localhost:6379
```

### Service URLs

```env
# Local LLM (Ollama)
OLLAMA_HOST=http://localhost:11434

# Web Search
SEARXNG_URL=http://localhost:8888

# Vector Database
QDRANT_URL=http://localhost:6333
```

### Using External Services

You can point any service to existing infrastructure:

```env
# Use remote Ollama server
OLLAMA_HOST=http://192.168.1.211:11434

# Use external PostgreSQL
DATABASE_URL=postgresql://user:pass@db.example.com:5432/talkshowgo

# Use Qdrant Cloud
QDRANT_URL=https://your-cluster.qdrant.io:6333
```

See [Advanced Configuration](#advanced-configuration) for more options.

---

## Verification

### System Status Dashboard

Visit http://localhost:3000/studio/system-status to see:
- Which services are connected
- Which API keys are configured
- Service health status
- Quick troubleshooting tips

### Manual Verification

```bash
# Check Docker services
docker compose ps

# Verify PostgreSQL
docker exec -it tsg-postgres psql -U postgres -d talkshowgo -c "SELECT 1"

# Verify Redis
docker exec -it tsg-redis redis-cli ping

# Verify SearXNG
curl http://localhost:8888/healthz

# Verify Ollama (if configured)
curl http://localhost:11434/api/tags
```

### API Verification

```bash
# Check system status API
curl http://localhost:3000/api/system/status

# Check news aggregator status
curl http://localhost:3000/api/intelligence/news?status=true
```

---

## Advanced Configuration

### Hybrid Setup

Run some services locally, others remotely:

```env
# Local database, remote AI
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/talkshowgo
OLLAMA_HOST=http://192.168.1.211:11434

# Local search, remote vector DB
SEARXNG_URL=http://localhost:8888
QDRANT_URL=https://your-cluster.qdrant.io:6333
```

### Removing Docker Services

If using external services, you can remove them from Docker:

1. Comment out the service in `docker-compose.yml`
2. Update environment variables to point to external service
3. Restart Docker: `docker compose up -d`

### Production Considerations

For production deployment:

1. **Security:**
   - Change default PostgreSQL password
   - Generate strong JWT secret
   - Use HTTPS for all external URLs

2. **Performance:**
   - Increase PostgreSQL connection limits
   - Configure Redis persistence
   - Set up proper logging

3. **Scaling:**
   - Run multiple worker instances
   - Use managed database services
   - Configure CDN for static assets

---

## Troubleshooting

### Common Issues

**Docker services won't start:**
```bash
# Check Docker is running
docker info

# Check for port conflicts
netstat -tulpn | grep :5432

# View service logs
docker compose logs postgres
```

**Database connection failed:**
```bash
# Verify PostgreSQL is running
docker compose ps postgres

# Test connection
docker exec -it tsg-postgres psql -U postgres -d talkshowgo
```

**API keys not working:**
1. Check `.env.local` file exists
2. Verify no extra spaces around keys
3. Restart the development server
4. Check System Status page

**Ollama not connecting:**
```bash
# Verify Ollama is running
curl http://localhost:11434/api/tags

# Check firewall rules
# On the Ollama server, ensure port 11434 is open
```

For more troubleshooting:
- [Common Issues](./troubleshooting/COMMON-ISSUES.md)
- [Health Checks](./troubleshooting/HEALTH-CHECKS.md)

---

## Next Steps

1. **Visit the Setup Wizard:** http://localhost:3000/studio/setup
2. **Check System Status:** http://localhost:3000/studio/system-status
3. **Create Your First Topic:** http://localhost:3000/studio/topics
4. **Generate a Show:** http://localhost:3000/studio/daily-show

---

## Additional Documentation

- [Docker Setup](./docker/DOCKER-SETUP.md)
- [Docker Services](./docker/SERVICES.md)
- [Docker Networking](./docker/NETWORKING.md)
- [ElevenLabs Setup](./api-keys/ELEVENLABS.md)
- [Twitter API Setup](./api-keys/TWITTER.md)
- [News APIs Setup](./api-keys/NEWS-APIS.md)
- [Ollama Setup](./services/OLLAMA.md)
- [SearXNG Setup](./services/SEARXNG.md)
- [Voice Configuration](./services/VOICE.md)
