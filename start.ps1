# Talk Show Go - Startup Script
# Run with: .\start.ps1

$Host.UI.RawUI.WindowTitle = "Talk Show Go"

Write-Host ""
Write-Host "  ======================================" -ForegroundColor Cyan
Write-Host "   CONTENT KINGDOM - STARTING UP" -ForegroundColor Cyan
Write-Host "  ======================================" -ForegroundColor Cyan
Write-Host ""

# Check if Docker is running
$dockerRunning = $null
try {
    $dockerRunning = docker info 2>$null
} catch {}

if (-not $dockerRunning) {
    Write-Host "[!] Docker is not running. Starting Docker Desktop..." -ForegroundColor Yellow
    Start-Process "C:\Program Files\Docker\Docker\Docker Desktop.exe"
    Write-Host "    Waiting for Docker to start (30 seconds)..." -ForegroundColor Gray
    Start-Sleep -Seconds 30
}

# Start Docker containers
Write-Host "[1/4] Starting Docker containers..." -ForegroundColor White
docker-compose up -d
if ($LASTEXITCODE -ne 0) {
    Write-Host "[!] Failed to start Docker containers" -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}
Write-Host "     Done!" -ForegroundColor Green

# Wait for services
Write-Host "[2/4] Waiting for services to initialize..." -ForegroundColor White
Start-Sleep -Seconds 8

# Check Presidium AI
Write-Host "[3/4] Checking Presidium AI connection..." -ForegroundColor White

$ollamaOk = $false
$voiceOk = $false

try {
    $response = Invoke-RestMethod -Uri "http://192.168.1.211:11434/api/tags" -TimeoutSec 5 -ErrorAction SilentlyContinue
    $ollamaOk = $true
    Write-Host "     Ollama LLMs: " -NoNewline
    Write-Host "Connected!" -ForegroundColor Green
    Write-Host "       Models: $($response.models.name -join ', ')" -ForegroundColor Gray
} catch {
    Write-Host "     Ollama LLMs: " -NoNewline
    Write-Host "Not reachable (check network)" -ForegroundColor Yellow
}

try {
    $response = Invoke-RestMethod -Uri "http://192.168.1.211:4123/health" -TimeoutSec 5 -ErrorAction SilentlyContinue
    $voiceOk = $true
    Write-Host "     Chatterbox Voice: " -NoNewline
    Write-Host "Connected!" -ForegroundColor Green
} catch {
    Write-Host "     Chatterbox Voice: " -NoNewline
    Write-Host "Not reachable (check network)" -ForegroundColor Yellow
}

# Check local services
Write-Host "[4/4] Checking local services..." -ForegroundColor White

try {
    $null = Test-NetConnection -ComputerName localhost -Port 5432 -WarningAction SilentlyContinue
    Write-Host "     PostgreSQL: " -NoNewline
    Write-Host "Running on :5432" -ForegroundColor Green
} catch {
    Write-Host "     PostgreSQL: " -NoNewline
    Write-Host "Starting..." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "  ======================================" -ForegroundColor Cyan
Write-Host "   SERVICES READY" -ForegroundColor Cyan
Write-Host "  ======================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Local Services:" -ForegroundColor White
Write-Host "    PostgreSQL:     localhost:5432" -ForegroundColor Gray
Write-Host "    Supabase API:   localhost:8000" -ForegroundColor Gray
Write-Host "    Supabase UI:    localhost:3001" -ForegroundColor Gray
Write-Host "    Redis:          localhost:6379" -ForegroundColor Gray
Write-Host "    Qdrant:         localhost:6333" -ForegroundColor Gray
Write-Host ""
Write-Host "  Presidium AI:" -ForegroundColor White
Write-Host "    LLMs (Ollama):  http://192.168.1.211:11434" -ForegroundColor Gray
Write-Host "    Voice (Chatterbox): http://192.168.1.211:4123" -ForegroundColor Gray
Write-Host ""

Write-Host "  ======================================" -ForegroundColor Cyan
Write-Host "   STARTING NEXT.JS & OPENING BROWSER" -ForegroundColor Cyan
Write-Host "  ======================================" -ForegroundColor Cyan
Write-Host ""

# Start Next.js in a new window
Write-Host "[5/5] Starting Next.js development server..." -ForegroundColor White
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$scriptDir'; npm run dev" -WindowStyle Normal

# Wait for port 3000 to be available
$maxWait = 60
$waited = 0
$ready = $false

Write-Host "     Waiting for server to be ready" -NoNewline -ForegroundColor Gray

while ($waited -lt $maxWait -and -not $ready) {
    Start-Sleep -Seconds 2
    $waited += 2

    try {
        $response = Invoke-WebRequest -Uri "http://localhost:3000" -TimeoutSec 2 -UseBasicParsing -ErrorAction SilentlyContinue
        if ($response.StatusCode -eq 200) {
            $ready = $true
        }
    } catch {
        Write-Host "." -NoNewline -ForegroundColor Gray
    }
}

Write-Host ""

if ($ready) {
    Write-Host "     Server ready!" -ForegroundColor Green
    Write-Host ""
    Write-Host "  Opening browser to Daily Show..." -ForegroundColor Cyan
    Start-Process "http://localhost:3000/studio/daily-show"
    Write-Host ""
    Write-Host "  ======================================" -ForegroundColor Green
    Write-Host "   CONTENT KINGDOM IS RUNNING" -ForegroundColor Green
    Write-Host "  ======================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "  App URL:      " -NoNewline
    Write-Host "http://localhost:3000" -ForegroundColor Cyan
    Write-Host "  Daily Show:   " -NoNewline
    Write-Host "http://localhost:3000/studio/daily-show" -ForegroundColor Cyan
    Write-Host "  Studio:       " -NoNewline
    Write-Host "http://localhost:3000/studio" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "  Next.js is running in a separate window." -ForegroundColor Gray
    Write-Host "  You can close this window." -ForegroundColor Gray
    Write-Host ""
} else {
    Write-Host "     Server may still be starting..." -ForegroundColor Yellow
    Write-Host "     Opening browser anyway - refresh if needed" -ForegroundColor Gray
    Start-Process "http://localhost:3000/studio/daily-show"
}

Write-Host "Press any key to exit..." -ForegroundColor Gray
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
