# Common Issues & Solutions

Quick fixes for the most common problems in Talk Show Go.

---

## Installation Issues

### "npm install fails"

**Symptoms:** Errors during `npm install`

**Solutions:**
```bash
# Clear npm cache
npm cache clean --force

# Delete node_modules and reinstall
rm -rf node_modules package-lock.json
npm install

# Try with legacy peer deps
npm install --legacy-peer-deps
```

### "Docker won't start"

**Symptoms:** `docker compose up` fails

**Solutions:**
```bash
# Check Docker is running
docker info

# On Windows, ensure Docker Desktop is started
# On Linux, start Docker daemon
sudo systemctl start docker

# Check for port conflicts
netstat -tulpn | grep :5432
```

---

## Database Issues

### "Database connection failed"

**Symptoms:** API returns database errors

**Solutions:**

1. Check PostgreSQL is running:
```bash
docker compose ps postgres
docker exec tsg-postgres pg_isready
```

2. Verify connection string:
```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/talkshowgo
```

3. Restart PostgreSQL:
```bash
docker compose restart postgres
```

4. Check logs:
```bash
docker compose logs postgres
```

### "Relation does not exist"

**Symptoms:** SQL errors about missing tables

**Solution:**
```bash
# Run migrations
npm run db:migrate

# Or manually
docker exec -i tsg-postgres psql -U postgres -d talkshowgo < supabase/migrations/001_initial_schema.sql
```

---

## API Key Issues

### "API key invalid"

**Symptoms:** Service shows "error" on status page

**Solutions:**

1. Check `.env.local` exists (not `.env`)
2. Verify no extra spaces around key:
```env
# Wrong
ELEVENLABS_API_KEY= sk-abc123
# Correct
ELEVENLABS_API_KEY=sk-abc123
```

3. Restart the dev server after changes:
```bash
npm run dev
```

4. Regenerate key if compromised

### "API key not found"

**Symptoms:** Service shows "missing" on status page

**Solution:**
1. Add the key to `.env.local`
2. Restart dev server

---

## Service Connection Issues

### "Ollama not connecting"

**Symptoms:** AI Services shows error

**Solutions:**

1. Check Ollama is running:
```bash
curl http://localhost:11434/api/tags
```

2. If using remote Ollama, verify URL:
```env
OLLAMA_HOST=http://192.168.1.211:11434
```

3. Check firewall allows port 11434

4. Verify Ollama is listening on all interfaces:
```bash
OLLAMA_HOST=0.0.0.0:11434 ollama serve
```

### "SearXNG not reachable"

**Symptoms:** Web search fails

**Solutions:**

1. Check container:
```bash
docker compose ps searxng
docker compose logs searxng
```

2. Verify port:
```bash
curl http://localhost:8888/healthz
```

3. Restart SearXNG:
```bash
docker compose restart searxng
```

---

## Voice Generation Issues

### "Voice generation failed"

**Symptoms:** Audio generation returns error

**Solutions:**

1. Check ElevenLabs status on System Status page
2. Verify API key is valid
3. Check remaining credits in ElevenLabs dashboard
4. Verify voice ID exists

### "Voice sounds wrong"

**Symptoms:** Audio sounds different than expected

**Solutions:**

1. Verify correct voice ID in config
2. Adjust voice settings (stability, similarity)
3. Check audio output format

---

## Performance Issues

### "Slow responses"

**Symptoms:** Pages take long to load

**Solutions:**

1. Check Docker resource usage:
```bash
docker stats
```

2. Verify Ollama is using GPU:
```bash
nvidia-smi  # NVIDIA GPUs
```

3. Use smaller LLM models
4. Check network latency to external APIs

### "High memory usage"

**Symptoms:** System slow, swapping

**Solutions:**

1. Limit Docker memory in `docker-compose.yml`:
```yaml
deploy:
  resources:
    limits:
      memory: 2G
```

2. Use smaller LLM models
3. Reduce Qdrant collection size

---

## Research Issues

### "No results found"

**Symptoms:** Research returns empty results

**Solutions:**

1. Check individual services on Status page
2. Verify search query is correct
3. Try different search terms
4. Check if topic is too niche

### "YouTube search fails"

**Symptoms:** YouTube returns errors

**Solutions:**

1. youtubei.js doesn't need API key
2. Check network connectivity
3. Try different search terms
4. Restart the application

---

## Common Error Messages

| Error | Likely Cause | Solution |
|-------|--------------|----------|
| ECONNREFUSED | Service not running | Start Docker services |
| 401 Unauthorized | Invalid API key | Check API key in .env.local |
| 429 Too Many Requests | Rate limited | Wait or upgrade plan |
| ENOTFOUND | DNS/network issue | Check internet connection |
| ETIMEDOUT | Service slow/down | Retry or check service status |

---

## Getting Help

If you can't resolve an issue:

1. Check the [Health Checks Guide](./HEALTH-CHECKS.md)
2. Review Docker logs: `docker compose logs`
3. Check the System Status page
4. Open an issue on GitHub

---

## Next Steps

- [Health Checks](./HEALTH-CHECKS.md)
- [Back to Deployment Guide](../DEPLOYMENT.md)
