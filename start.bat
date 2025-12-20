@echo off
title Talk Show Go - Startup
color 0A

echo.
echo  ======================================
echo   CONTENT KINGDOM - STARTING UP
echo  ======================================
echo.

:: Check if Docker is running
docker info >nul 2>&1
if errorlevel 1 (
    echo [!] Docker is not running. Starting Docker Desktop...
    start "" "C:\Program Files\Docker\Docker\Docker Desktop.exe"
    echo     Waiting for Docker to start...
    timeout /t 30 /nobreak >nul
)

:: Start Docker containers
echo [1/3] Starting Docker containers...
docker-compose up -d
if errorlevel 1 (
    echo [!] Failed to start Docker containers
    pause
    exit /b 1
)
echo      Done!

:: Wait for services to be ready
echo [2/3] Waiting for services to initialize...
timeout /t 10 /nobreak >nul

:: Check Presidium AI connection
echo [3/3] Checking Presidium AI connection...
curl -s http://192.168.1.211:11434/api/tags >nul 2>&1
if errorlevel 1 (
    echo      [!] Warning: Cannot reach Presidium AI at 192.168.1.211
    echo      Make sure you're on the same network or using Tailscale
) else (
    echo      Presidium AI: Connected!
)

curl -s http://192.168.1.211:4123/health >nul 2>&1
if errorlevel 1 (
    echo      [!] Warning: Cannot reach Chatterbox voice server
) else (
    echo      Chatterbox Voice: Connected!
)

echo.
echo  ======================================
echo   SERVICES READY
echo  ======================================
echo.
echo  Services running:
echo    - PostgreSQL: localhost:5432
echo    - Supabase API: localhost:8000
echo    - Supabase Studio: localhost:3001
echo    - Redis: localhost:6379
echo    - Qdrant: localhost:6333
echo.
echo  Presidium AI:
echo    - LLMs: http://192.168.1.211:11434
echo    - Voice: http://192.168.1.211:4123
echo.
echo  ======================================
echo   STARTING NEXT.JS ^& OPENING BROWSER
echo  ======================================
echo.

:: Start Next.js in a new window
echo [4/4] Starting Next.js development server...
start "Talk Show Go - Next.js" cmd /k "npm run dev"

:: Wait for port 3000 to be available
echo      Waiting for server to be ready...
set /a waited=0
set /a maxwait=60

:waitloop
timeout /t 2 /nobreak >nul
set /a waited+=2
curl -s -o nul http://localhost:3000
if %errorlevel%==0 goto serverready
if %waited% lss %maxwait% goto waitloop

:: Timeout reached
echo      Server may still be starting...
echo      Opening browser anyway - refresh if needed
start http://localhost:3000/studio/daily-show
goto done

:serverready
echo      Server ready!
echo.
echo  Opening browser to Daily Show...
start http://localhost:3000/studio/daily-show
echo.
echo  ======================================
echo   CONTENT KINGDOM IS RUNNING
echo  ======================================
echo.
echo  App URL:      http://localhost:3000
echo  Daily Show:   http://localhost:3000/studio/daily-show
echo  Studio:       http://localhost:3000/studio
echo.
echo  Next.js is running in a separate window.
echo  You can close this window.

:done
echo.
pause
