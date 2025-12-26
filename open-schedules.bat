@echo off
REM Quick launcher for Schedules UI in browser

echo ========================================
echo  Opening Schedules UI in Browser
echo ========================================
echo.

REM Check if Next.js is running
curl -s http://localhost:3000 >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Next.js is not running!
    echo.
    echo Please start it first:
    echo   npm run dev
    echo.
    pause
    exit /b 1
)

echo [OK] Next.js is running
echo.
echo Opening browser...
echo.

REM Run Playwright test
node test-schedules-ui.mjs

pause
