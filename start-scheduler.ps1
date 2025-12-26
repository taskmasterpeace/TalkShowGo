# Talk Show Go - Scheduler Startup Script (PowerShell)
# Starts all services with health checks and error detection

Write-Host "========================================" -ForegroundColor Cyan
Write-Host " Talk Show Go - Scheduler Startup" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Step 1: Check Docker is running
Write-Host "[1/7] Checking Docker..." -ForegroundColor Yellow
try {
    docker ps *>$null
    Write-Host "[OK] Docker is running" -ForegroundColor Green
    Write-Host ""
} catch {
    Write-Host "[ERROR] Docker is not running!" -ForegroundColor Red
    Write-Host ""
    Write-Host "Please start Docker Desktop and try again." -ForegroundColor Yellow
    Read-Host "Press Enter to exit"
    exit 1
}

# Step 2: Start Docker services
Write-Host "[2/7] Starting Docker services..." -ForegroundColor Yellow
docker-compose up -d
if ($LASTEXITCODE -ne 0) {
    Write-Host "[ERROR] Failed to start Docker services!" -ForegroundColor Red
    Write-Host ""
    Write-Host "Run 'docker-compose logs' to see errors." -ForegroundColor Yellow
    Read-Host "Press Enter to exit"
    exit 1
}
Write-Host "[OK] Docker services started" -ForegroundColor Green
Write-Host ""

# Step 3: Wait for Postgres
Write-Host "[3/7] Waiting for PostgreSQL..." -ForegroundColor Yellow
Start-Sleep -Seconds 3
while ($true) {
    docker exec tsg-postgres pg_isready -U postgres *>$null
    if ($LASTEXITCODE -eq 0) { break }
    Write-Host "Waiting for Postgres to be ready..." -ForegroundColor Yellow
    Start-Sleep -Seconds 2
}
Write-Host "[OK] PostgreSQL is ready" -ForegroundColor Green
Write-Host ""

# Step 4: Check database exists
Write-Host "[4/7] Checking database..." -ForegroundColor Yellow
$dbExists = docker exec tsg-postgres psql -U postgres -lqt 2>$null | Select-String "contentkingdom"
if (-not $dbExists) {
    Write-Host "[WARN] Database 'contentkingdom' not found!" -ForegroundColor Yellow
    Write-Host "Creating database..." -ForegroundColor Yellow
    docker exec tsg-postgres psql -U postgres -c "CREATE DATABASE contentkingdom;" *>$null
    Write-Host "[OK] Database created" -ForegroundColor Green
} else {
    Write-Host "[OK] Database exists" -ForegroundColor Green
}
Write-Host ""

# Step 5: Check scheduler tables exist
Write-Host "[5/7] Checking scheduler tables..." -ForegroundColor Yellow
$tableExists = docker exec tsg-postgres psql -U postgres -d contentkingdom -c "\dt daily_show_schedules" 2>$null | Select-String "daily_show_schedules"
if (-not $tableExists) {
    Write-Host "[WARN] Scheduler tables not found. Running migration..." -ForegroundColor Yellow
    Get-Content "supabase\migrations\019_daily_show_scheduler.sql" | docker exec -i tsg-postgres psql -U postgres -d contentkingdom
    if ($LASTEXITCODE -ne 0) {
        Write-Host "[ERROR] Migration failed!" -ForegroundColor Red
        Read-Host "Press Enter to exit"
        exit 1
    }
    Write-Host "[OK] Migration applied" -ForegroundColor Green
} else {
    Write-Host "[OK] Scheduler tables exist" -ForegroundColor Green
}
Write-Host ""

# Step 6: Check Redis
Write-Host "[6/7] Checking Redis..." -ForegroundColor Yellow
$redisPing = docker exec tsg-redis redis-cli ping 2>$null
if ($redisPing -ne "PONG") {
    Write-Host "[ERROR] Redis is not responding!" -ForegroundColor Red
    Write-Host ""
    Write-Host "Run 'docker logs tsg-redis' to see errors." -ForegroundColor Yellow
    Read-Host "Press Enter to exit"
    exit 1
}
Write-Host "[OK] Redis is running" -ForegroundColor Green
Write-Host ""

# Step 7: Restart worker to load scheduler
Write-Host "[7/7] Restarting worker with scheduler..." -ForegroundColor Yellow
docker restart tsg-worker *>$null
Start-Sleep -Seconds 3
Write-Host "[OK] Worker restarted" -ForegroundColor Green
Write-Host ""

# Health Check Summary
Write-Host "========================================" -ForegroundColor Cyan
Write-Host " Health Check Summary" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "Checking services..." -ForegroundColor Yellow
Write-Host ""

# Check Postgres
docker exec tsg-postgres pg_isready -U postgres *>$null
if ($LASTEXITCODE -eq 0) {
    Write-Host "PostgreSQL: " -NoNewline; Write-Host "UP" -ForegroundColor Green
} else {
    Write-Host "PostgreSQL: " -NoNewline; Write-Host "DOWN" -ForegroundColor Red
}

# Check Redis
docker exec tsg-redis redis-cli ping *>$null
if ($LASTEXITCODE -eq 0) {
    Write-Host "Redis:      " -NoNewline; Write-Host "UP" -ForegroundColor Green
} else {
    Write-Host "Redis:      " -NoNewline; Write-Host "DOWN" -ForegroundColor Red
}

# Check Worker
$workerRunning = docker ps --filter "name=tsg-worker" --filter "status=running" | Select-String "tsg-worker"
if ($workerRunning) {
    Write-Host "Worker:     " -NoNewline; Write-Host "UP" -ForegroundColor Green
} else {
    Write-Host "Worker:     " -NoNewline; Write-Host "DOWN" -ForegroundColor Red
}

# Check PostgREST
$postgrestRunning = docker ps --filter "name=tsg-postgrest" --filter "status=running" | Select-String "tsg-postgrest"
if ($postgrestRunning) {
    Write-Host "PostgREST:  " -NoNewline; Write-Host "UP" -ForegroundColor Green
} else {
    Write-Host "PostgREST:  " -NoNewline; Write-Host "DOWN" -ForegroundColor Red
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host " Scheduler Status" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Wait a moment for worker to fully start
Start-Sleep -Seconds 2

# Check worker logs for scheduler
$schedulerLogs = docker logs tsg-worker --tail 20 2>&1 | Select-String "DailyShowScheduler"
if ($schedulerLogs) {
    Write-Host "Status: " -NoNewline; Write-Host "STARTED" -ForegroundColor Green
    Write-Host ""
    Write-Host "Recent scheduler activity:" -ForegroundColor Yellow
    $schedulerLogs | ForEach-Object { Write-Host $_ -ForegroundColor Gray }
} else {
    Write-Host "Status: " -NoNewline; Write-Host "UNKNOWN (check logs)" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Run this to see worker logs:" -ForegroundColor Yellow
    Write-Host "  docker logs tsg-worker --tail 50" -ForegroundColor Gray
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host " Access Points" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Schedule Management UI: " -NoNewline; Write-Host "http://localhost:3000/studio/schedules" -ForegroundColor Cyan
Write-Host "Database (Postgres):    " -NoNewline; Write-Host "localhost:5432" -ForegroundColor Cyan
Write-Host "Redis:                  " -NoNewline; Write-Host "localhost:6379" -ForegroundColor Cyan
Write-Host "PostgREST API:          " -NoNewline; Write-Host "http://localhost:8000" -ForegroundColor Cyan
Write-Host ""

# Check for active schedules
Write-Host "Checking for active schedules..." -ForegroundColor Yellow
try {
    $schedules = Invoke-RestMethod -Uri "http://localhost:8000/daily_show_schedules?is_active=eq.true&select=id,show_name_prefix,schedule_type,is_active" -ErrorAction SilentlyContinue
    if ($schedules -and $schedules.Count -gt 0) {
        Write-Host "Active schedules found!" -ForegroundColor Green
        $schedules | ForEach-Object {
            Write-Host "  - $($_.show_name_prefix) ($($_.schedule_type))" -ForegroundColor Gray
        }
    } else {
        Write-Host "No active schedules found" -ForegroundColor Yellow
        Write-Host ""
        Write-Host "Create your first schedule at: http://localhost:3000/studio/schedules" -ForegroundColor Cyan
    }
} catch {
    Write-Host "Could not check schedules (API may be starting up)" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host " Troubleshooting Commands" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "View worker logs:       " -NoNewline; Write-Host "docker logs tsg-worker --tail 50 -f" -ForegroundColor Gray
Write-Host "View postgres logs:     " -NoNewline; Write-Host "docker logs tsg-postgres --tail 50" -ForegroundColor Gray
Write-Host "View all containers:    " -NoNewline; Write-Host "docker ps -a" -ForegroundColor Gray
Write-Host "Restart worker:         " -NoNewline; Write-Host "docker restart tsg-worker" -ForegroundColor Gray
Write-Host "Stop all services:      " -NoNewline; Write-Host "docker-compose down" -ForegroundColor Gray
Write-Host "View schedules in DB:   " -NoNewline; Write-Host 'docker exec tsg-postgres psql -U postgres -d contentkingdom -c "SELECT * FROM daily_show_schedules;"' -ForegroundColor Gray
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host " Startup Complete!" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Read-Host "Press Enter to exit"
