# Daily Show Scheduler - Troubleshooting Guide

## Quick Start

### Windows Users

**Option 1: Batch File (Recommended)**
```bash
# Double-click or run:
start-scheduler.bat
```

**Option 2: PowerShell**
```powershell
# Right-click > Run with PowerShell:
.\start-scheduler.ps1
```

### What the Startup Script Does

1. ✅ Checks Docker is running
2. ✅ Starts all Docker services
3. ✅ Waits for PostgreSQL to be ready
4. ✅ Verifies database exists (creates if missing)
5. ✅ Checks scheduler tables (runs migration if needed)
6. ✅ Verifies Redis is running
7. ✅ Restarts worker to load scheduler
8. ✅ Shows health check summary
9. ✅ Lists active schedules

---

## Common Issues & Solutions

### ❌ "Docker is not running"

**Problem:** Docker Desktop is not started

**Solution:**
1. Open Docker Desktop
2. Wait for it to fully start (whale icon in system tray)
3. Run startup script again

---

### ❌ "Database 'talkshowgo' not found"

**Problem:** Database doesn't exist

**Solution:** The script will automatically create it. If it fails:
```bash
docker exec tsg-postgres psql -U postgres -c "CREATE DATABASE talkshowgo;"
```

---

### ❌ "Scheduler tables not found"

**Problem:** Migration hasn't been applied

**Solution:** The script will automatically run the migration. If it fails:
```bash
docker exec -i tsg-postgres psql -U postgres -d talkshowgo < supabase/migrations/019_daily_show_scheduler.sql
```

---

### ❌ "Redis is not responding"

**Problem:** Redis container is down

**Solution:**
```bash
# Check Redis status
docker ps | findstr redis

# Restart Redis
docker restart tsg-redis

# Check logs
docker logs tsg-redis
```

---

### ❌ "Worker is DOWN"

**Problem:** Worker container crashed or not started

**Solution:**
```bash
# Check worker status
docker ps -a | findstr worker

# View worker logs
docker logs tsg-worker --tail 50

# Restart worker
docker restart tsg-worker

# If still failing, check for errors:
docker logs tsg-worker --tail 100
```

---

### ❌ "Scheduler Status: UNKNOWN"

**Problem:** Scheduler may not have started in worker

**Solution:**
```bash
# Check worker logs for scheduler startup
docker logs tsg-worker --tail 50 | findstr DailyShowScheduler

# Expected output:
# [DailyShowScheduler] Starting...
# [DailyShowScheduler] Loaded X active schedules
# [DailyShowScheduler] Started successfully
# [Worker] Daily Show Scheduler started

# If missing, restart worker:
docker restart tsg-worker
```

---

### ❌ "No active schedules found"

**Problem:** No schedules created yet

**Solution:**
1. Open browser: http://localhost:3000/studio/schedules
2. Click "New Schedule"
3. Configure your first schedule
4. Click "Create Schedule"

---

### ❌ UI shows "Please select a topic first"

**Problem:** No topic selected in UI

**Solution:**
1. Go to home page: http://localhost:3000
2. Click topic selector dropdown (top right)
3. Select your topic (e.g., "Battle Rap")
4. Navigate back to schedules page

---

### ❌ "Failed to load schedules"

**Problem:** API connection issue

**Solution:**
```bash
# Check if PostgREST is running
docker ps | findstr postgrest

# Restart PostgREST
docker restart tsg-postgrest

# Test API directly
curl http://localhost:8000/daily_show_schedules
```

---

### ❌ Schedule created but not running

**Problem:** Schedule is inactive or misconfigured

**Checklist:**
1. ✅ Is schedule active? (green badge in UI)
2. ✅ Is next_scheduled_at in the future?
3. ✅ Is worker running?
4. ✅ Check worker logs for execution

**Debug:**
```bash
# View schedule in database
docker exec tsg-postgres psql -U postgres -d talkshowgo -c "SELECT id, show_name_prefix, schedule_type, is_active, next_scheduled_at FROM daily_show_schedules;"

# Check if scheduler is processing
docker logs tsg-worker -f | findstr "Executing schedule"
```

---

### ❌ "Run Now" button does nothing

**Problem:** API endpoint not responding

**Solution:**
```bash
# Test run-now endpoint directly
curl -X POST http://localhost:3000/api/schedules/daily-show/YOUR_SCHEDULE_ID/run-now

# Check Next.js logs
npm run dev
# Look for errors in terminal
```

---

### ❌ Show generation fails

**Problem:** Daily show API has errors

**Solution:**
```bash
# Check worker logs for detailed error
docker logs tsg-worker --tail 100

# Common causes:
# 1. Missing template_id - check templates exist
# 2. Invalid host_slug - check host exists
# 3. No topics found - check topic has sources
# 4. LLM API error - check REQUESTY_API_KEY

# View execution history in UI:
# Click expand (chevron down) on schedule
# Look for error_message in history
```

---

## Manual Health Checks

### Check All Services

```bash
# View all containers
docker ps -a

# Expected containers:
# tsg-postgres    (healthy)
# tsg-redis       (healthy)
# tsg-worker      (up)
# tsg-postgrest   (up)
# tsg-kong        (healthy)
# tsg-searxng     (up)
```

### Check Postgres

```bash
# Test connection
docker exec tsg-postgres pg_isready -U postgres

# List databases
docker exec tsg-postgres psql -U postgres -l

# Check scheduler tables
docker exec tsg-postgres psql -U postgres -d talkshowgo -c "\dt daily_show*"
```

### Check Redis

```bash
# Ping Redis
docker exec tsg-redis redis-cli ping
# Expected: PONG

# View keys
docker exec tsg-redis redis-cli keys "*"
```

### Check Worker

```bash
# Live logs
docker logs tsg-worker -f

# Last 50 lines
docker logs tsg-worker --tail 50

# Search for scheduler activity
docker logs tsg-worker | findstr "DailyShowScheduler"
```

### Check API

```bash
# List schedules
curl http://localhost:8000/daily_show_schedules

# Get active schedules
curl "http://localhost:8000/daily_show_schedules?is_active=eq.true"

# Get schedule history
curl http://localhost:8000/daily_show_run_history?limit=10
```

---

## Test the UI with Playwright

### Open Schedules UI in Browser

```bash
# Quick test
open-schedules.bat

# Or run manually
node test-schedules-ui.mjs
```

This will:
1. Launch Chromium browser (full screen)
2. Navigate to schedules page
3. Take a screenshot
4. Keep browser open for manual testing

---

## Database Inspection

### View All Schedules

```bash
docker exec tsg-postgres psql -U postgres -d talkshowgo -c "
SELECT
  id,
  show_name_prefix,
  schedule_type,
  is_active,
  next_scheduled_at,
  last_run_status,
  created_at
FROM daily_show_schedules
ORDER BY created_at DESC;
"
```

### View Execution History

```bash
docker exec tsg-postgres psql -U postgres -d talkshowgo -c "
SELECT
  h.show_name,
  h.status,
  h.executed_at,
  h.duration_seconds,
  h.stories_count,
  h.cost_llm_cents + h.cost_tts_cents as total_cost_cents
FROM daily_show_run_history h
ORDER BY h.executed_at DESC
LIMIT 20;
"
```

### Find Failed Runs

```bash
docker exec tsg-postgres psql -U postgres -d talkshowgo -c "
SELECT
  executed_at,
  show_name,
  error_message
FROM daily_show_run_history
WHERE status = 'failed'
ORDER BY executed_at DESC
LIMIT 10;
"
```

---

## Reset Everything

### Soft Reset (Restart Services)

```bash
docker restart tsg-postgres tsg-redis tsg-worker tsg-postgrest
```

### Hard Reset (Wipe Data)

```bash
# Stop all services
docker-compose down

# Remove volumes (DELETES ALL DATA)
docker volume rm talkshowgo_postgres-data
docker volume rm talkshowgo_redis-data

# Start fresh
docker-compose up -d

# Run startup script
start-scheduler.bat
```

---

## Getting Help

### Check Logs

```bash
# Worker (scheduler + jobs)
docker logs tsg-worker --tail 100 -f

# Postgres
docker logs tsg-postgres --tail 50

# Redis
docker logs tsg-redis --tail 50

# PostgREST (API)
docker logs tsg-postgrest --tail 50
```

### Export Logs to File

```bash
# Windows
docker logs tsg-worker > worker-logs.txt 2>&1

# PowerShell
docker logs tsg-worker | Out-File worker-logs.txt
```

### System Info

```bash
# Docker version
docker --version

# Docker compose version
docker-compose --version

# Node version
node --version

# NPM version
npm --version

# Container stats
docker stats --no-stream
```

---

## Useful Commands Reference

```bash
# Start everything
start-scheduler.bat

# Open UI in browser
open-schedules.bat

# View worker logs
docker logs tsg-worker -f

# Restart worker
docker restart tsg-worker

# Stop all
docker-compose down

# Start all
docker-compose up -d

# View database
docker exec -it tsg-postgres psql -U postgres -d talkshowgo

# List schedules in DB
docker exec tsg-postgres psql -U postgres -d talkshowgo -c "SELECT * FROM daily_show_schedules;"

# Test API
curl http://localhost:8000/daily_show_schedules

# Open schedules UI
start http://localhost:3000/studio/schedules
```

---

## Success Indicators

When everything is working, you should see:

✅ All Docker containers running
✅ PostgreSQL accepting connections
✅ Redis responding to PING
✅ Worker logs show scheduler started
✅ Schedules UI loads at http://localhost:3000/studio/schedules
✅ API responds at http://localhost:8000/daily_show_schedules
✅ Can create/edit/delete schedules via UI
✅ "Run Now" triggers show generation
✅ Execution history appears in UI

---

## Still Having Issues?

1. Run the startup script: `start-scheduler.bat`
2. Read the health check output carefully
3. Follow the troubleshooting commands shown
4. Check worker logs: `docker logs tsg-worker --tail 50`
5. Verify database tables exist
6. Test API endpoints with curl
7. Try opening UI in browser: `open-schedules.bat`

If all else fails, do a hard reset (see above) and start fresh.
