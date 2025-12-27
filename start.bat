@echo off
title Talk Show Go - Startup
color 0A

echo.
echo  ========================================
echo           TALKSHOWGO
echo  ========================================
echo.

:: Check if Docker is running
docker info >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Docker is not running!
    echo Please start Docker Desktop and try again.
    pause
    exit /b 1
)

echo [1/4] Starting Docker services...
docker-compose up -d

:: Wait for services to be ready
echo [2/4] Waiting for services to initialize...
timeout /t 8 /nobreak >nul

:: Check if PostgreSQL is ready
echo [3/4] Checking database connection...
docker exec tsg-postgres pg_isready -U postgres >nul 2>&1
if errorlevel 1 (
    echo [WARN] Database not ready yet, waiting 5 more seconds...
    timeout /t 5 /nobreak >nul
)

echo [4/4] Starting Next.js development server...
echo.
echo  ========================================
echo     TALK SHOW GO IS STARTING!
echo  ========================================
echo.
echo  Web UI:    http://localhost:3000
echo  Studio:    http://localhost:3000/studio
echo  Settings:  http://localhost:3000/studio/settings
echo.
echo  Press Ctrl+C to stop the server.
echo  ========================================
echo.

:: Start Next.js
npm run dev

pause
