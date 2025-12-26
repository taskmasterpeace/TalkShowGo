@echo off
REM Talk Show Go - Scheduler Startup Script
REM Starts all services with health checks and error detection

echo ========================================
echo  Talk Show Go - Scheduler Startup
echo ========================================
echo.

REM Set colors for output
set GREEN=[92m
set RED=[91m
set YELLOW=[93m
set RESET=[0m

REM Step 1: Check Docker is running
echo [1/7] Checking Docker...
docker ps >nul 2>&1
if errorlevel 1 (
    echo %RED%[ERROR] Docker is not running!%RESET%
    echo.
    echo Please start Docker Desktop and try again.
    pause
    exit /b 1
)
echo %GREEN%[OK] Docker is running%RESET%
echo.

REM Step 2: Start Docker services
echo [2/7] Starting Docker services...
docker-compose up -d
if errorlevel 1 (
    echo %RED%[ERROR] Failed to start Docker services!%RESET%
    echo.
    echo Run 'docker-compose logs' to see errors.
    pause
    exit /b 1
)
echo %GREEN%[OK] Docker services started%RESET%
echo.

REM Step 3: Wait for Postgres
echo [3/7] Waiting for PostgreSQL...
timeout /t 3 /nobreak >nul
:wait_postgres
docker exec tsg-postgres pg_isready -U postgres >nul 2>&1
if errorlevel 1 (
    echo Waiting for Postgres to be ready...
    timeout /t 2 /nobreak >nul
    goto wait_postgres
)
echo %GREEN%[OK] PostgreSQL is ready%RESET%
echo.

REM Step 4: Check database exists
echo [4/7] Checking database...
docker exec tsg-postgres psql -U postgres -lqt | findstr contentkingdom >nul
if errorlevel 1 (
    echo %RED%[ERROR] Database 'contentkingdom' not found!%RESET%
    echo.
    echo Creating database...
    docker exec tsg-postgres psql -U postgres -c "CREATE DATABASE contentkingdom;" >nul 2>&1
    echo %GREEN%[OK] Database created%RESET%
)
echo %GREEN%[OK] Database exists%RESET%
echo.

REM Step 5: Check scheduler tables exist
echo [5/7] Checking scheduler tables...
docker exec tsg-postgres psql -U postgres -d contentkingdom -c "\dt daily_show_schedules" | findstr daily_show_schedules >nul
if errorlevel 1 (
    echo %YELLOW%[WARN] Scheduler tables not found. Running migration...%RESET%
    docker exec -i tsg-postgres psql -U postgres -d contentkingdom < supabase\migrations\019_daily_show_scheduler.sql
    if errorlevel 1 (
        echo %RED%[ERROR] Migration failed!%RESET%
        pause
        exit /b 1
    )
    echo %GREEN%[OK] Migration applied%RESET%
) else (
    echo %GREEN%[OK] Scheduler tables exist%RESET%
)
echo.

REM Step 6: Check Redis
echo [6/7] Checking Redis...
docker exec tsg-redis redis-cli ping | findstr PONG >nul
if errorlevel 1 (
    echo %RED%[ERROR] Redis is not responding!%RESET%
    echo.
    echo Run 'docker logs tsg-redis' to see errors.
    pause
    exit /b 1
)
echo %GREEN%[OK] Redis is running%RESET%
echo.

REM Step 7: Restart worker to load scheduler
echo [7/7] Restarting worker with scheduler...
docker restart tsg-worker >nul 2>&1
timeout /t 3 /nobreak >nul
echo %GREEN%[OK] Worker restarted%RESET%
echo.

REM Health Check Summary
echo ========================================
echo  Health Check Summary
echo ========================================
echo.

echo Checking services...
echo.

REM Check Postgres
docker exec tsg-postgres pg_isready -U postgres >nul 2>&1
if errorlevel 1 (
    echo PostgreSQL: %RED%DOWN%RESET%
) else (
    echo PostgreSQL: %GREEN%UP%RESET%
)

REM Check Redis
docker exec tsg-redis redis-cli ping >nul 2>&1
if errorlevel 1 (
    echo Redis:      %RED%DOWN%RESET%
) else (
    echo Redis:      %GREEN%UP%RESET%
)

REM Check Worker
docker ps --filter "name=tsg-worker" --filter "status=running" | findstr tsg-worker >nul
if errorlevel 1 (
    echo Worker:     %RED%DOWN%RESET%
) else (
    echo Worker:     %GREEN%UP%RESET%
)

REM Check PostgREST
docker ps --filter "name=tsg-postgrest" --filter "status=running" | findstr tsg-postgrest >nul
if errorlevel 1 (
    echo PostgREST:  %RED%DOWN%RESET%
) else (
    echo PostgREST:  %GREEN%UP%RESET%
)

echo.
echo ========================================
echo  Scheduler Status
echo ========================================
echo.

REM Wait a moment for worker to fully start
timeout /t 2 /nobreak >nul

REM Check worker logs for scheduler
docker logs tsg-worker --tail 20 2>&1 | findstr "DailyShowScheduler" >nul
if errorlevel 1 (
    echo Status: %YELLOW%UNKNOWN (check logs)%RESET%
    echo.
    echo Run this to see worker logs:
    echo   docker logs tsg-worker --tail 50
) else (
    echo Status: %GREEN%STARTED%RESET%
    echo.
    echo Recent scheduler activity:
    docker logs tsg-worker --tail 20 2>&1 | findstr "DailyShowScheduler"
)

echo.
echo ========================================
echo  Access Points
echo ========================================
echo.
echo Schedule Management UI: http://localhost:3000/studio/schedules
echo Database (Postgres):    localhost:5432
echo Redis:                  localhost:6379
echo PostgREST API:          http://localhost:8000
echo.

REM Check for active schedules
echo Checking for active schedules...
curl -s "http://localhost:8000/daily_show_schedules?is_active=eq.true&select=id,show_name_prefix,schedule_type,is_active" 2>nul | findstr "id" >nul
if errorlevel 1 (
    echo %YELLOW%No active schedules found%RESET%
    echo.
    echo Create your first schedule at: http://localhost:3000/studio/schedules
) else (
    echo %GREEN%Active schedules found!%RESET%
    curl -s "http://localhost:8000/daily_show_schedules?is_active=eq.true&select=show_name_prefix,schedule_type,next_scheduled_at" 2>nul
)

echo.
echo ========================================
echo  Troubleshooting Commands
echo ========================================
echo.
echo View worker logs:       docker logs tsg-worker --tail 50 -f
echo View postgres logs:     docker logs tsg-postgres --tail 50
echo View all containers:    docker ps -a
echo Restart worker:         docker restart tsg-worker
echo Stop all services:      docker-compose down
echo View schedules in DB:   docker exec tsg-postgres psql -U postgres -d contentkingdom -c "SELECT * FROM daily_show_schedules;"
echo.
echo ========================================
echo  Startup Complete!
echo ========================================
echo.
echo Press any key to exit...
pause >nul
