#!/usr/bin/env pwsh

# ================================================================
# HEROKU DEPLOYMENT HELPER - Microgrid City System
# ================================================================
# This script helps with Heroku deployment setup

$ErrorActionPreference = "Continue"

Write-Host ""
Write-Host "================================" -ForegroundColor Cyan
Write-Host "Heroku Deployment Setup Helper" -ForegroundColor Cyan
Write-Host "Microgrid City System" -ForegroundColor Cyan
Write-Host "================================" -ForegroundColor Cyan
Write-Host ""

# Step 1: Check Heroku CLI
Write-Host "Step 1: Checking Heroku CLI..." -ForegroundColor Yellow
$herokuCheck = Get-Command heroku -ErrorAction SilentlyContinue
if ($herokuCheck) {
    $herokuVersion = heroku --version
    Write-Host "[OK] Heroku CLI found: $herokuVersion" -ForegroundColor Green
}
else {
    Write-Host "[ERROR] Heroku CLI not found" -ForegroundColor Red
    Write-Host ""
    Write-Host "Please install Heroku CLI from: https://devcenter.heroku.com/articles/heroku-cli" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Options:" -ForegroundColor Cyan
    Write-Host "  1. Download installer from heroku website" -ForegroundColor White
    Write-Host "  2. npm install -g heroku" -ForegroundColor White
    Write-Host ""
    exit 1
}
Write-Host ""

# Step 2: Check if logged in
Write-Host "Step 2: Checking Heroku login..." -ForegroundColor Yellow
$loginCheck = heroku auth:whoami -ErrorAction SilentlyContinue
if ($LASTEXITCODE -eq 0) {
    Write-Host "[OK] Logged in as: $loginCheck" -ForegroundColor Green
}
else {
    Write-Host "[INFO] Not logged in yet" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Running: heroku login" -ForegroundColor Cyan
    heroku login
    Write-Host ""
}
Write-Host ""

# Step 3: Get app name
Write-Host "Step 3: Heroku app configuration" -ForegroundColor Yellow
$appName = Read-Host "Enter your app name (e.g., microgrid-city-prod)"

if ([string]::IsNullOrWhiteSpace($appName)) {
    Write-Host "[ERROR] App name cannot be empty" -ForegroundColor Red
    exit 1
}

Write-Host ""

# Step 4: Create app
Write-Host "Step 4: Creating Heroku app '$appName'..." -ForegroundColor Yellow
heroku create $appName --region us
if ($LASTEXITCODE -ne 0) {
    Write-Host "[ERROR] Failed to create app" -ForegroundColor Red
    exit 1
}
Write-Host "[OK] App created successfully" -ForegroundColor Green
Write-Host ""

# Step 5: Configure environment variables
Write-Host "Step 5: Configuring environment variables..." -ForegroundColor Yellow
Write-Host ""

$mongoUri = Read-Host "Enter MONGODB_URI (leave blank to use default)"
if (-not [string]::IsNullOrWhiteSpace($mongoUri)) {
    heroku config:set MONGODB_URI="$mongoUri" --app $appName
}

$jwtSecret = Read-Host "Enter JWT_SECRET (leave blank to use default)"
if (-not [string]::IsNullOrWhiteSpace($jwtSecret)) {
    heroku config:set JWT_SECRET="$jwtSecret" --app $appName
}

$encryptionKey = Read-Host "Enter ENCRYPTION_KEY (leave blank to use default)"
if (-not [string]::IsNullOrWhiteSpace($encryptionKey)) {
    heroku config:set ENCRYPTION_KEY="$encryptionKey" --app $appName
}

heroku config:set NODE_ENV="production" --app $appName
Write-Host "[OK] Environment variables configured" -ForegroundColor Green
Write-Host ""

# Step 6: Check git remote
Write-Host "Step 6: Checking git configuration..." -ForegroundColor Yellow
$herokuRemote = git config --get remote.heroku.url -ErrorAction SilentlyContinue
if ([string]::IsNullOrWhiteSpace($herokuRemote)) {
    Write-Host "[INFO] Adding Heroku git remote..." -ForegroundColor Cyan
    git remote add heroku "https://git.heroku.com/$appName.git"
}
else {
    Write-Host "[OK] Heroku git remote already configured" -ForegroundColor Green
}
Write-Host ""

# Step 7: Summary
Write-Host "================================" -ForegroundColor Cyan
Write-Host "DEPLOYMENT READY" -ForegroundColor Green
Write-Host "================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host ""
Write-Host "1. Deploy your application:" -ForegroundColor White
Write-Host "   git push heroku main" -ForegroundColor Cyan
Write-Host ""
Write-Host "2. View your live app:" -ForegroundColor White
Write-Host "   heroku open --app $appName" -ForegroundColor Cyan
Write-Host ""
Write-Host "3. View logs:" -ForegroundColor White
Write-Host "   heroku logs --tail --app $appName" -ForegroundColor Cyan
Write-Host ""
Write-Host "App URL: https://$appName.herokuapp.com" -ForegroundColor Green
Write-Host ""
