# Talk Show Go - PowerShell Startup Script
# Double-click to run or right-click > Run with PowerShell

$Host.UI.RawUI.WindowTitle = "Talk Show Go"
Write-Host ""
Write-Host "  ========================================" -ForegroundColor Cyan
Write-Host "           TALKSHOWGO" -ForegroundColor Cyan
Write-Host "  ========================================" -ForegroundColor Cyan
Write-Host ""

# Check if Docker is running
try {
    docker info 2>$null | Out-Null
    if ($LASTEXITCODE -ne 0) { throw }
} catch {
    Write-Host "[ERROR] Docker is not running!" -ForegroundColor Red
    Write-Host "Please start Docker Desktop and try again." -ForegroundColor Yellow
    Read-Host "Press Enter to exit"
    exit 1
}

Write-Host "[1/4] Starting Docker services..." -ForegroundColor Green
docker-compose up -d

Write-Host "[2/4] Waiting for services to initialize..." -ForegroundColor Green
Start-Sleep -Seconds 8

Write-Host "[3/4] Checking database connection..." -ForegroundColor Green
$dbReady = docker exec tsg-postgres pg_isready -U postgres 2>$null
if ($LASTEXITCODE -ne 0) {
    Write-Host "[WARN] Database not ready yet, waiting 5 more seconds..." -ForegroundColor Yellow
    Start-Sleep -Seconds 5
}

Write-Host "[4/4] Starting Next.js development server..." -ForegroundColor Green
Write-Host ""
Write-Host "  ========================================" -ForegroundColor Cyan
Write-Host "     TALK SHOW GO IS RUNNING!" -ForegroundColor Green
Write-Host "  ========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Web UI:    " -NoNewline; Write-Host "http://localhost:3000" -ForegroundColor Yellow
Write-Host "  Studio:    " -NoNewline; Write-Host "http://localhost:3000/studio" -ForegroundColor Yellow
Write-Host "  Settings:  " -NoNewline; Write-Host "http://localhost:3000/studio/settings" -ForegroundColor Yellow
Write-Host ""
Write-Host "  Press Ctrl+C to stop the server." -ForegroundColor Gray
Write-Host "  ========================================" -ForegroundColor Cyan
Write-Host ""

# Open browser after a short delay
Start-Job -ScriptBlock {
    Start-Sleep -Seconds 5
    Start-Process "http://localhost:3000/studio"
} | Out-Null

# Start Next.js
npm run dev
