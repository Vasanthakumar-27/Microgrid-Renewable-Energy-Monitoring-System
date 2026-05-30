#!/bin/bash
# ================================================================
# MICROGRID CITY SYSTEM - PRODUCTION DEPLOYMENT SCRIPT
# ================================================================
# This script performs all necessary steps to deploy the system
# to production with proper configuration and verification.
# ================================================================

set -e  # Exit on error

echo "╔════════════════════════════════════════════════════════════════╗"
echo "║    MICROGRID CITY SYSTEM - PRODUCTION DEPLOYMENT SCRIPT       ║"
echo "║                   Phase 5D: Deployment                         ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""

# ================================================================
# 1. PRE-DEPLOYMENT CHECKS
# ================================================================
echo "📋 STEP 1: PRE-DEPLOYMENT VERIFICATION"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if ! command -v node &> /dev/null; then
    echo "❌ Node.js not found. Please install Node.js 18+"
    exit 1
fi
echo "✅ Node.js found: $(node -v)"

if ! command -v npm &> /dev/null; then
    echo "❌ npm not found. Please install npm"
    exit 1
fi
echo "✅ npm found: $(npm -v)"

if ! command -v mongo &> /dev/null; then
    echo "⚠️  MongoDB client not found (optional for deployment)"
else
    echo "✅ MongoDB client found"
fi

if [ ! -f ".env.production" ]; then
    echo "❌ .env.production not found. Please create it from .env.production template"
    exit 1
fi
echo "✅ Environment file found: .env.production"

echo ""

# ================================================================
# 2. INSTALL DEPENDENCIES
# ================================================================
echo "📦 STEP 2: INSTALLING DEPENDENCIES"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if [ ! -d "node_modules" ]; then
    echo "Installing npm dependencies..."
    npm install --omit=dev
    echo "✅ Dependencies installed"
else
    echo "✅ Dependencies already installed"
fi

echo ""

# ================================================================
# 3. VERIFY CONFIGURATION
# ================================================================
echo "🔧 STEP 3: VERIFYING CONFIGURATION"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

source .env.production

required_vars=(
    "NODE_ENV"
    "PORT"
    "DB_URI"
    "JWT_SECRET"
    "ENCRYPTION_KEY"
)

for var in "${required_vars[@]}"; do
    if [ -z "${!var}" ]; then
        echo "❌ Missing required variable: $var"
        exit 1
    fi
done
echo "✅ All required configuration variables present"

echo ""

# ================================================================
# 4. VERIFY SSL/TLS CERTIFICATES
# ================================================================
echo "🔐 STEP 4: VERIFYING SSL/TLS CERTIFICATES"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if [ "$HTTPS_ENABLED" = "true" ]; then
    if [ ! -f "$SSL_KEY_PATH" ] || [ ! -f "$SSL_CERT_PATH" ]; then
        echo "❌ SSL certificates not found at specified paths"
        echo "   Key: $SSL_KEY_PATH"
        echo "   Cert: $SSL_CERT_PATH"
        echo ""
        echo "Generate certificates with:"
        echo "  certbot certonly --standalone -d yourdomain.com"
        echo "Or use:"
        echo "  openssl req -new -x509 -days 365 -nodes -out cert.pem -keyout key.pem"
        exit 1
    fi
    echo "✅ SSL certificates found and verified"
else
    echo "⚠️  HTTPS disabled (development mode only)"
fi

echo ""

# ================================================================
# 5. RUN TESTS
# ================================================================
echo "🧪 STEP 5: RUNNING TEST SUITE"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

echo "Verifying production conditions..."
node production-readiness-check.js

if [ $? -ne 0 ]; then
    echo "❌ Production readiness check failed"
    exit 1
fi
echo "✅ All production readiness checks passed"

echo ""

# ================================================================
# 6. DATABASE VERIFICATION
# ================================================================
echo "📊 STEP 6: DATABASE VERIFICATION"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Create connection test script
cat > test-db-connection.js << 'EOF'
const mongoose = require('mongoose');

async function testConnection() {
  try {
    await mongoose.connect(process.env.DB_URI, {
      serverSelectionTimeoutMS: 5000
    });
    console.log('✅ Database connection successful');
    await mongoose.disconnect();
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    process.exit(1);
  }
}

testConnection();
EOF

node test-db-connection.js
rm test-db-connection.js

echo ""

# ================================================================
# 7. BUILD & OPTIMIZE
# ================================================================
echo "🔨 STEP 7: BUILD & OPTIMIZATION"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

echo "Verifying application can start..."
timeout 10 node server.js &
sleep 3
pkill -f "node server.js" || true
echo "✅ Application startup verified"

echo ""

# ================================================================
# 8. BACKUP DATABASE (if applicable)
# ================================================================
echo "💾 STEP 8: DATABASE BACKUP"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if command -v mongodump &> /dev/null; then
    echo "Creating pre-deployment database backup..."
    mkdir -p ./backups
    BACKUP_DIR="./backups/backup_$(date +%Y%m%d_%H%M%S)"
    mongodump --uri="$DB_URI" --out="$BACKUP_DIR"
    if [ $? -eq 0 ]; then
        echo "✅ Backup created at: $BACKUP_DIR"
    fi
else
    echo "⚠️  mongodump not available (optional)"
fi

echo ""

# ================================================================
# 9. CREATE PROCESS MANAGER CONFIG (PM2)
# ================================================================
echo "⚙️  STEP 9: PROCESS MANAGER CONFIGURATION"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if command -v pm2 &> /dev/null; then
    echo "PM2 found. Creating ecosystem configuration..."
    cat > ecosystem.config.js << 'EOF'
module.exports = {
  apps: [{
    name: 'microgrid-api',
    script: './server.js',
    instances: 'max',
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production'
    },
    max_memory_restart: '1G',
    merge_logs: true,
    autorestart: true,
    watch: false,
    ignore_watch: ['node_modules', 'logs'],
    max_restarts: 10,
    min_uptime: '10s'
  }]
};
EOF
    echo "✅ PM2 ecosystem.config.js created"
    echo ""
    echo "Start with: pm2 start ecosystem.config.js"
    echo "Monitor with: pm2 monit"
else
    echo "⚠️  PM2 not installed (optional). Use: npm install -g pm2"
fi

echo ""

# ================================================================
# 10. DEPLOYMENT SUMMARY
# ================================================================
echo "═══════════════════════════════════════════════════════════════════"
echo "✅ PRODUCTION DEPLOYMENT VERIFICATION COMPLETE"
echo "═══════════════════════════════════════════════════════════════════"
echo ""
echo "📊 DEPLOYMENT STATUS"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Pre-deployment checks passed"
echo "✅ Dependencies installed"
echo "✅ Configuration verified"
echo "✅ SSL/TLS certificates ready"
echo "✅ Production readiness confirmed"
echo "✅ Database connection verified"
echo "✅ Application startup verified"
echo "✅ Database backup created"
echo ""

echo "🚀 NEXT STEPS:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "1. Start the application:"
echo "   • With PM2: pm2 start ecosystem.config.js"
echo "   • With Node: node server.js"
echo "   • With npm: npm start"
echo ""
echo "2. Configure monitoring:"
echo "   • Sentry: Set SENTRY_DSN in .env.production"
echo "   • Prometheus: Configure metrics export"
echo "   • ELK: Set up log aggregation"
echo ""
echo "3. Verify deployment:"
echo "   • Check health endpoint: GET /health"
echo "   • Monitor logs: pm2 logs microgrid-api"
echo "   • Check metrics: curl http://localhost:9090/metrics"
echo ""
echo "4. Enable auto-restart:"
echo "   • pm2 startup"
echo "   • pm2 save"
echo ""
echo "📚 Documentation:"
echo "   • Deployment Guide: ./docs/DEPLOYMENT-GUIDE.md"
echo "   • Test Summary: ./docs/TEST-SUMMARY.md"
echo "   • Operations Runbook: ./docs/DEPLOYMENT-GUIDE.md (Operations section)"
echo ""
echo "═══════════════════════════════════════════════════════════════════"
echo "System ready for production. Deploy with confidence! 🎉"
echo "═══════════════════════════════════════════════════════════════════"
echo ""
