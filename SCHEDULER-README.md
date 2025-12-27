# Daily Show Scheduler - Quick Start Guide

## 🚀 One-Click Startup

### Windows

**Double-click either file:**
- `start-scheduler.bat` - Command Prompt version
- `start-scheduler.ps1` - PowerShell version (right-click → Run with PowerShell)

**Or run from terminal:**
```bash
npm run scheduler:start
```

### What Happens?

The startup script will:
1. ✅ Check Docker is running
2. ✅ Start all services
3. ✅ Verify PostgreSQL
4. ✅ Check/create database
5. ✅ Run migrations if needed
6. ✅ Verify Redis
7. ✅ Restart worker with scheduler
8. ✅ Show health summary
9. ✅ List active schedules

**Total time:** ~30 seconds

---

## 🎨 Open the UI

### Option 1: Manual
```
http://localhost:3000/studio/schedules
```

### Option 2: Auto-Open with Browser Test
```bash
# Double-click:
open-schedules.bat

# Or run:
npm run open:schedules
```

This will:
- Launch Chromium browser (full screen)
- Navigate to schedules page
- Take a screenshot
- Keep browser open for testing

---

## 📋 Create Your First Schedule

1. **Open UI:** http://localhost:3000/studio/schedules
2. **Select Topic:** Click topic dropdown (if not already selected)
3. **Click:** "New Schedule" button
4. **Configure Schedule:**
   - **Type:** Daily / Weekly / Interval / Cron
   - **Time:** When to run (e.g., 9:00 AM)
   - **Timezone:** Your timezone
   - **Show Name:** "Battle Rap" (creates "Battle Rap Daily")
   - **Stories:** 3
   - **Lookback:** 24 hours
   - **Host:** Marcus Blaze (or any of 7 hosts)
5. **Click:** "Create Schedule"
6. **Done!** Your show will now generate automatically

---

## ⚡ Quick Examples

### Daily Battle Rap News at 9am EST
```
Type: Daily
Time: 09:00
Timezone: America/New_York
Show Name: Battle Rap
Stories: 3
Lookback: 24 hours
Host: Marcus Blaze
```

### Every 6 Hours
```
Type: Interval
Hours: 6
Show Name: Battle Rap
Stories: 3
Lookback: 6 hours
Host: Marcus Blaze
```

### Mon/Wed/Fri at 6pm
```
Type: Weekly
Days: Mon, Wed, Fri
Time: 18:00
Timezone: America/New_York
Show Name: Battle Rap
Stories: 5
Lookback: 48 hours
Host: Devon Sharp
```

### Weekdays at 9am (Cron)
```
Type: Cron
Expression: 0 9 * * 1-5
Timezone: America/New_York
Show Name: Battle Rap
Stories: 3
Lookback: 24 hours
Host: Maya Sterling
```

---

## 🎯 UI Features

### Main Page

**Schedule List**
- 📊 Status badges (Active/Paused/Success/Failed)
- ⏰ Next run countdown ("In 2h", "In 3d")
- 📝 Quick stats (3 stories · 24h lookback)
- 🎤 Host assignment

**Quick Actions**
- ▶️ **Run Now** - Manually trigger show generation
- ⏸️ **Pause/Activate** - Toggle schedule on/off
- 📊 **Expand** - View execution history
- 🗑️ **Delete** - Remove schedule

**Execution History**
- Last 10 runs per schedule
- ✅ Success/❌ Failure status
- ⏱️ Duration and story count
- 💰 Cost tracking (LLM + TTS)
- 🔍 Error messages for failed runs

---

## 🔧 Troubleshooting

### Check Everything is Running

```bash
# Run startup script (does health checks)
start-scheduler.bat
```

### View Logs

```bash
# Worker logs (scheduler runs here)
docker logs tsg-worker --tail 50 -f

# Postgres logs
docker logs tsg-postgres --tail 50

# All services
docker-compose logs -f
```

### Common Issues

**"No schedules showing up"**
- Check if topic is selected (top right dropdown)
- Refresh page
- Check API: `curl http://localhost:8000/daily_show_schedules`

**"Schedule not running"**
- Check if it's active (green badge)
- Check next_scheduled_at is in future
- View worker logs: `docker logs tsg-worker -f`
- Look for: `[DailyShowScheduler] Executing schedule`

**"Run Now button does nothing"**
- Check browser console for errors (F12)
- Verify Next.js is running: `npm run dev`
- Check API logs

**Full troubleshooting guide:** See `TROUBLESHOOTING-SCHEDULER.md`

---

## 📊 Database Access

### View Schedules
```bash
docker exec tsg-postgres psql -U postgres -d talkshowgo -c "
SELECT
  show_name_prefix,
  schedule_type,
  is_active,
  next_scheduled_at,
  last_run_status
FROM daily_show_schedules
ORDER BY created_at DESC;
"
```

### View Execution History
```bash
docker exec tsg-postgres psql -U postgres -d talkshowgo -c "
SELECT
  show_name,
  status,
  executed_at,
  duration_seconds,
  stories_count
FROM daily_show_run_history
ORDER BY executed_at DESC
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
ORDER BY executed_at DESC;
"
```

---

## 🔄 Testing

### Test the Scheduler

**Create a test schedule:**
```
Type: Interval
Hours: 1 (every hour)
Show Name: Test
Stories: 1
```

**Watch it execute:**
```bash
docker logs tsg-worker -f
# Look for:
# [DailyShowScheduler] Executing schedule: ...
# [DailyShowScheduler] Successfully generated show
```

### Test the UI with Playwright

```bash
# Open browser and test UI
npm run test:ui

# Or double-click:
open-schedules.bat
```

This will:
- Launch browser (full screen)
- Navigate to schedules page
- Take screenshot
- Stay open for manual testing

---

## 📁 Files Created

### Startup Scripts
- `start-scheduler.bat` - Windows batch file
- `start-scheduler.ps1` - PowerShell script
- `open-schedules.bat` - Open UI in browser

### Documentation
- `SCHEDULER-README.md` - This file
- `TROUBLESHOOTING-SCHEDULER.md` - Complete troubleshooting guide

### Testing
- `test-schedules-ui.mjs` - Playwright browser test

### Database
- `supabase/migrations/019_daily_show_scheduler.sql` - Database schema

### Backend
- `src/lib/scheduler/daily-show-scheduler.ts` - Scheduler class (615 lines)
- `src/workers/index.ts` - Worker integration

### API
- `src/app/api/schedules/daily-show/route.ts` - List/create schedules
- `src/app/api/schedules/daily-show/[id]/route.ts` - Get/update/delete
- `src/app/api/schedules/daily-show/[id]/run-now/route.ts` - Manual trigger
- `src/app/api/schedules/daily-show/[id]/history/route.ts` - Execution history

### UI
- `src/app/studio/schedules/page.tsx` - Schedule management UI (800+ lines)

---

## 🎯 NPM Scripts

```bash
# Scheduler
npm run scheduler:start    # Run startup script
npm run scheduler:test     # Test UI with Playwright

# UI Testing
npm run test:ui            # Same as scheduler:test
npm run open:schedules     # Open schedules page in browser

# Docker
npm run docker:up          # Start services
npm run docker:down        # Stop services
npm run docker:reset       # Wipe data and restart

# Development
npm run dev                # Start Next.js
npm run worker             # Start worker manually
npm run go                 # Start Docker + Next.js
```

---

## 🚀 Production Workflow

### 1. Setup (One Time)
```bash
# Run startup script
start-scheduler.bat

# Creates database, runs migrations, starts scheduler
```

### 2. Create Schedules (One Time per Schedule)
1. Open http://localhost:3000/studio/schedules
2. Click "New Schedule"
3. Configure your schedule
4. Click "Create Schedule"

### 3. Automated Operation
- Scheduler runs in background worker
- Shows generate automatically on schedule
- Execution history tracked in database
- Failed runs logged with error messages

### 4. Monitoring
- View schedules in UI
- Check execution history
- Monitor worker logs: `docker logs tsg-worker -f`
- Database queries for detailed analysis

---

## ✅ Success Indicators

When everything is working:

✅ **Startup script shows:**
- All services UP (green)
- Scheduler STARTED
- Active schedules listed

✅ **UI works:**
- http://localhost:3000/studio/schedules loads
- Can create/edit/delete schedules
- "Run Now" triggers generation
- History shows past runs

✅ **Worker logs show:**
```
[DailyShowScheduler] Starting...
[DailyShowScheduler] Loaded X active schedules
[DailyShowScheduler] Started successfully
[Worker] Daily Show Scheduler started
```

✅ **Shows generate automatically:**
- Check execution history in UI
- See new entries in `daily_show_run_history` table
- Audio files in output directory

---

## 🆘 Getting Help

1. **Run startup script:** `start-scheduler.bat`
   - Shows health checks and diagnostics

2. **Read troubleshooting guide:** `TROUBLESHOOTING-SCHEDULER.md`
   - Complete solutions for all common issues

3. **Check worker logs:** `docker logs tsg-worker --tail 50`
   - See scheduler activity and errors

4. **Test UI:** `npm run test:ui`
   - Opens browser for visual inspection

5. **Check database:** Run SQL queries above
   - Verify schedules and history

---

## 📚 Additional Resources

- **Full System Docs:** `docs/SYSTEM_ARCHITECTURE.md`
- **Terminology:** `docs/TERMINOLOGY.md`
- **API Reference:** API endpoint files in `src/app/api/`
- **Troubleshooting:** `TROUBLESHOOTING-SCHEDULER.md`

---

## 🎉 You're Ready!

The Daily Show Scheduler is now:
- ✅ Installed and configured
- ✅ Running in background
- ✅ Ready to generate shows automatically
- ✅ Fully monitored and debuggable

Create your first schedule and let the automation begin! 🚀
