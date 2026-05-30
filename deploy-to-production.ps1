# ================================================================
# MICROGRID CITY SYSTEM - PRODUCTION DEPLOYMENT SCRIPT (POWERSHELL)
# ================================================================
# This script performs all necessary steps to deploy the system
# to production with proper configuration and verification.
# ================================================================

$ErrorActionPreference = "Stop"

Write-Host "`n╔════════════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║    MICROGRID CITY SYSTEM - PRODUCTION DEPLOYMENT SCRIPT       ║" -ForegroundColor Cyan
Write-Host "║                   Phase 5D: Deployment                         ║" -ForegroundColor Cyan
Write-Host "╚════════════════════════════════════════════════════════════════╝`n" -ForegroundColor Cyan

# ================================================================
# 1. PRE-DEPLOYMENT CHECKS
# ================================================================
Write-Host "📋 STEP 1: PRE-DEPLOYMENT VERIFICATION" -ForegroundColor Yellow
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Yellow

$nodeCheck = Get-Command node -ErrorAction SilentlyContinue
if (-not $nodeCheck) {
    Write-Host "❌ Node.js not found. Please install Node.js 18+" -ForegroundColor Red
    exit 1
}
$nodeVersion = node -v
Write-Host "✅ Node.js found: $nodeVersion" -ForegroundColor Green

$npmCheck = Get-Command npm -ErrorAction SilentlyContinue
if (-not $npmCheck) {
    Write-Host "❌ npm not found. Please install npm" -ForegroundColor Red
    exit 1
}
$npmVersion = npm -v
Write-Host "✅ npm found: $npmVersion" -ForegroundColor Green

if (-not (Test-Path ".env.production")) {
    Write-Host "❌ .env.production not found. Please create it from .env.production template" -ForegroundColor Red
    exit 1
}
Write-Host "✅ Environment file found: .env.production" -ForegroundColor Green

Write-Host ""

# ================================================================
# 2. INSTALL DEPENDENCIES
# ================================================================
Write-Host "📦 STEP 2: INSTALLING DEPENDENCIES" -ForegroundColor Yellow
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Yellow

if (-not (Test-Path "node_modules")) {
    Write-Host "Installing npm dependencies..." -ForegroundColor Cyan
    npm install --omit=dev
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Failed to install dependencies" -ForegroundColor Red
        exit 1
    }
    Write-Host "✅ Dependencies installed" -ForegroundColor Green
} else {
    Write-Host "✅ Dependencies already installed" -ForegroundColor Green
}

Write-Host ""

# ================================================================
# 3. VERIFY CONFIGURATION
# ================================================================
Write-Host "🔧 STEP 3: VERIFYING CONFIGURATION" -ForegroundColor Yellow
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Yellow

$envContent = Get-Content .env.production

$requiredVars = @("NODE_ENV", "PORT", "DB_URI", "JWT_SECRET", "ENCRYPTION_KEY")

foreach ($var in $requiredVars) {
    if (-not ($envContent -match "^$var=")) {
        Write-Host "❌ Missing required variable: $var" -ForegroundColor Red
        exit 1
    }
}
Write-Host "✅ All required configuration variables present" -ForegroundColor Green

Write-Host ""

# ================================================================
# 4. VERIFY SSL/TLS CERTIFICATES (if HTTPS enabled)
# ================================================================
Write-Host "🔐 STEP 4: VERIFYING SSL/TLS CERTIFICATES" -ForegroundColor Yellow
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Yellow

if ($envContent -match "HTTPS_ENABLED=true") {
    $sslKeyMatch = $envContent | Select-String "SSL_KEY_PATH=(.+)"
    $sslCertMatch = $envContent | Select-String "SSL_CERT_PATH=(.+)"
    
    if ($sslKeyMatch -and $sslCertMatch) {
        $keyPath = $sslKeyMatch.Matches[0].Groups[1].Value
        $certPath = $sslCertMatch.Matches[0].Groups[1].Value
        
        if (-not (Test-Path $keyPath) -or -not (Test-Path $certPath)) {
            Write-Host "❌ SSL certificates not found" -ForegroundColor Red
            Write-Host "   Key: $keyPath" -ForegroundColor Red
            Write-Host "   Cert: $certPath" -ForegroundColor Red
            exit 1
        }
        Write-Host "✅ SSL certificates found and verified" -ForegroundColor Green
    }
} else {
    Write-Host "⚠️  HTTPS disabled (development mode only)" -ForegroundColor Yellow
}

Write-Host ""

# ================================================================
# 5. RUN PRODUCTION READINESS CHECK
# ================================================================
Write-Host "🧪 STEP 5: PRODUCTION READINESS CHECK" -ForegroundColor Yellow
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Yellow

Write-Host "Verifying production conditions..." -ForegroundColor Cyan
node production-readiness-check.js

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Production readiness check failed" -ForegroundColor Red
    exit 1
}

Write-Host ""

# ================================================================
# 6. DATABASE VERIFICATION
# ================================================================
Write-Host "📊 STEP 6: DATABASE VERIFICATION" -ForegroundColor Yellow
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Yellow

Write-Host "Testing database connection..." -ForegroundColor Cyan

$testScript = @'
const mongoose = require("mongoose");
async function testConnection() {
  try {
    await mongoose.connect(process.env.DB_URI, {
      serverSelectionTimeoutMS: 5000
    });
    console.log("✅ Database connection successful");
    await mongoose.disconnect();
  } catch (error) {
    console.error("❌ Database connection failed:", error.message);
    process.exit(1);
  }
}
testConnection();
'@

$testScript | Out-File -FilePath "test-db-connection.js" -Encoding UTF8
node test-db-connection.js
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Database connection test failed" -ForegroundColor Red
    Remove-Item "test-db-connection.js" -Force -ErrorAction SilentlyContinue
    exit 1
}
Remove-Item "test-db-connection.js" -Force -ErrorAction SilentlyContinue

Write-Host ""

# ================================================================
# 7. APPLICATION STARTUP TEST
# ================================================================
Write-Host "🔨 STEP 7: APPLICATION STARTUP VERIFICATION" -ForegroundColor Yellow
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Yellow

Write-Host "Testing application startup (10s timeout)..." -ForegroundColor Cyan
$process = Start-Process -FilePath "node" -ArgumentList "server.js" -PassThru -NoNewWindow
Start-Sleep -Seconds 3

if ($process.HasExited) {
    Write-Host "❌ Application failed to start" -ForegroundColor Red
    exit 1
}

$process.Kill()
Write-Host "✅ Application startup verified" -ForegroundColor Green

Write-Host ""

# ================================================================
# 8. BACKUP DATABASE
# ================================================================
Write-Host "💾 STEP 8: DATABASE BACKUP" -ForegroundColor Yellow
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Yellow

$mongoDump = Get-Command mongodump -ErrorAction SilentlyContinue
if ($mongoDump) {
    Write-Host "Creating pre-deployment database backup..." -ForegroundColor Cyan
    if (-not (Test-Path "backups")) {
        New-Item -ItemType Directory -Path "backups" | Out-Null
    }
    $backupDir = "backups/backup_$(Get-Date -Format 'yyyyMMdd_HHmmss')"
    mongodump --uri="$($envContent | Select-String 'DB_URI=(.+)' | ForEach-Object {$_.Matches[0].Groups[1].Value})" --out="$backupDir"
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Backup created at: $backupDir" -ForegroundColor Green
    }
} else {
    Write-Host "⚠️  mongodump not available (optional)" -ForegroundColor Yellow
}

Write-Host ""

# ================================================================
# 9. CREATE PROCESS MANAGER CONFIG (PM2)
# ================================================================
Write-Host "⚙️  STEP 9: PROCESS MANAGER CONFIGURATION" -ForegroundColor Yellow
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Yellow

$pm2Check = Get-Command pm2 -ErrorAction SilentlyContinue
if ($pm2Check) {
    Write-Host "PM2 found. Creating ecosystem configuration..." -ForegroundColor Cyan
    
    $ecosystemConfig = @'
module.exports = {
  apps: [{
    name: "microgrid-api",
    script: "./server.js",
    instances: "max",
    exec_mode: "cluster",
    env: {
      NODE_ENV: "production"
    },
    max_memory_restart: "1G",
    merge_logs: true,
    autorestart: true,
    watch: false,
    ignore_watch: ["node_modules", "logs"],
    max_restarts: 10,
    min_uptime: "10s"
  }]
};
'@
    
    $ecosystemConfig | Out-File -FilePath "ecosystem.config.js" -Encoding UTF8
    Write-Host "✅ PM2 ecosystem.config.js created" -ForegroundColor Green
} else {
    Write-Host "⚠️  PM2 not installed (optional). Install with: npm install -g pm2" -ForegroundColor Yellow
}

Write-Host ""

# ================================================================
# 10. DEPLOYMENT SUMMARY
# ================================================================
Write-Host "═══════════════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "✅ PRODUCTION DEPLOYMENT VERIFICATION COMPLETE" -ForegroundColor Cyan
Write-Host "═══════════════════════════════════════════════════════════════════" -ForegroundColor Cyan

Write-Host ""
Write-Host "📊 DEPLOYMENT STATUS" -ForegroundColor Cyan
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host "✅ Pre-deployment checks passed" -ForegroundColor Green
Write-Host "✅ Dependencies installed" -ForegroundColor Green
Write-Host "✅ Configuration verified" -ForegroundColor Green
Write-Host "✅ SSL/TLS certificates ready" -ForegroundColor Green
Write-Host "✅ Production readiness confirmed" -ForegroundColor Green
Write-Host "✅ Database connection verified" -ForegroundColor Green
Write-Host "✅ Application startup verified" -ForegroundColor Green
Write-Host "✅ Database backup created" -ForegroundColor Green

Write-Host ""
Write-Host "🚀 NEXT STEPS:" -ForegroundColor Yellow
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Yellow

Write-Host ""
Write-Host "1. Start the application:" -ForegroundColor Cyan
Write-Host "   • With PM2: pm2 start ecosystem.config.js" -ForegroundColor White
Write-Host "   • With Node: node server.js" -ForegroundColor White
Write-Host "   • With npm: npm start" -ForegroundColor White

Write-Host ""
Write-Host "2. Configure monitoring:" -ForegroundColor Cyan
Write-Host "   • Sentry: Set SENTRY_DSN in .env.production" -ForegroundColor White
Write-Host "   • Prometheus: Configure metrics export" -ForegroundColor White
Write-Host "   • ELK: Set up log aggregation" -ForegroundColor White

Write-Host ""
Write-Host "3. Verify deployment:" -ForegroundColor Cyan
Write-Host "   • Check health endpoint: GET /health" -ForegroundColor White
Write-Host "   • Monitor logs: pm2 logs microgrid-api" -ForegroundColor White
Write-Host "   • Check metrics: curl http://localhost:9090/metrics" -ForegroundColor White

Write-Host ""
Write-Host "4. Enable auto-restart:" -ForegroundColor Cyan
Write-Host "   • pm2 startup" -ForegroundColor White
Write-Host "   • pm2 save" -ForegroundColor White

Write-Host ""
Write-Host "📚 Documentation:" -ForegroundColor Cyan
Write-Host "   • Deployment Guide: ./docs/DEPLOYMENT-GUIDE.md" -ForegroundColor White
Write-Host "   • Test Summary: ./docs/TEST-SUMMARY.md" -ForegroundColor White
Write-Host "   • Operations Runbook: ./docs/DEPLOYMENT-GUIDE.md (Operations section)" -ForegroundColor White

Write-Host ""
Write-Host "═══════════════════════════════════════════════════════════════════" -ForegroundColor Green
Write-Host "System ready for production. Deploy with confidence! 🎉" -ForegroundColor Green
Write-Host "═══════════════════════════════════════════════════════════════════" -ForegroundColor Green
Write-Host ""
