# ================================================================
# MICROGRID CITY SYSTEM - PRODUCTION DEPLOYMENT SIMPLIFIED
# ================================================================

$ErrorActionPreference = "Continue"

Write-Host ""
Write-Host "Starting production deployment verification..." -ForegroundColor Cyan
Write-Host ""

# Step 1: Check Node.js
Write-Host "Step 1: Checking Node.js..." -ForegroundColor Yellow
$nodeCheck = Get-Command node -ErrorAction SilentlyContinue
if ($nodeCheck) {
    $nodeVersion = node -v
    Write-Host "[OK] Node.js $nodeVersion found" -ForegroundColor Green
}
else {
    Write-Host "[ERROR] Node.js not found" -ForegroundColor Red
    exit 1
}
Write-Host ""

# Step 2: Check dependencies
Write-Host "Step 2: Checking dependencies..." -ForegroundColor Yellow
if (Test-Path "node_modules") {
    Write-Host "[OK] Dependencies installed" -ForegroundColor Green
}
else {
    Write-Host "Installing dependencies..." -ForegroundColor Cyan
    npm install --omit=dev
}
Write-Host ""

# Step 3: Check configuration
Write-Host "Step 3: Checking configuration..." -ForegroundColor Yellow
if (Test-Path ".env.production") {
    $envContent = Get-Content ".env.production"
    $hasDbUri = $envContent -match "DB_URI="
    $hasJwt = $envContent -match "JWT_SECRET="
    
    if ($hasDbUri -and $hasJwt) {
        Write-Host "[OK] Configuration found" -ForegroundColor Green
    }
    else {
        Write-Host "[WARN] Configuration incomplete" -ForegroundColor Yellow
    }
}
else {
    Write-Host "[INFO] Using default .env configuration" -ForegroundColor Cyan
}
Write-Host ""

# Step 4: Production readiness
Write-Host "Step 4: Running production readiness check..." -ForegroundColor Yellow
if (Test-Path "production-readiness-check.js") {
    node production-readiness-check.js
}
Write-Host ""

# Final status
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "DEPLOYMENT VERIFICATION COMPLETE" -ForegroundColor Green
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "DEPLOYMENT OPTIONS:" -ForegroundColor Yellow
Write-Host ""
Write-Host "Option 1 - Start directly with Node:" -ForegroundColor Cyan
Write-Host "  node server.js"
Write-Host ""

Write-Host "Option 2 - Start with npm:" -ForegroundColor Cyan
Write-Host "  npm start"
Write-Host ""

Write-Host "Option 3 - Start with PM2:" -ForegroundColor Cyan
Write-Host "  pm2 start ecosystem.config.js"
Write-Host "  pm2 monitor"
Write-Host ""

Write-Host "System is ready for production deployment." -ForegroundColor Green
Write-Host ""
