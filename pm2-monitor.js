#!/usr/bin/env node

/**
 * PM2 MONITORING DASHBOARD
 * Real-time monitoring of application health and performance
 */

const pm2 = require('pm2');
const fs = require('fs');
const path = require('path');

const LOG_DIR = './logs';
const MONITOR_INTERVAL = 10000; // 10 seconds
const ALERT_FILE = path.join(LOG_DIR, 'alerts.log');
const HEALTH_FILE = path.join(LOG_DIR, 'health.log');

// Ensure log directory exists
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

class ApplicationMonitor {
  constructor() {
    this.thresholds = {
      memory: 300, // 300MB
      cpuHigh: 80, // 80%
      cpuLow: 5,   // 5%
      errorRate: 10, // 10 errors per minute
      restarts: 3    // More than 3 restarts in 5 minutes
    };
    
    this.metrics = {
      startTime: new Date(),
      lastCheck: null,
      previousRestarts: 0,
      errorCount: 0,
      lastErrorTime: null
    };
  }

  /**
   * Connect to PM2
   */
  connect() {
    return new Promise((resolve, reject) => {
      pm2.connect((err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  /**
   * Get application list
   */
  getList() {
    return new Promise((resolve, reject) => {
      pm2.list((err, apps) => {
        if (err) reject(err);
        else resolve(apps);
      });
    });
  }

  /**
   * Log alert
   */
  logAlert(level, message, details = {}) {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level,
      message,
      details
    };

    console.log(`[${level}] ${timestamp} - ${message}`);
    
    try {
      fs.appendFileSync(
        ALERT_FILE,
        JSON.stringify(logEntry) + '\n'
      );
    } catch (e) {
      console.error('Failed to write alert:', e.message);
    }
  }

  /**
   * Log health metrics
   */
  logHealth(data) {
    const timestamp = new Date().toISOString();
    const entry = {
      timestamp,
      ...data
    };

    try {
      fs.appendFileSync(
        HEALTH_FILE,
        JSON.stringify(entry) + '\n'
      );
    } catch (e) {
      console.error('Failed to write health:', e.message);
    }
  }

  /**
   * Check application health
   */
  async checkHealth() {
    try {
      const apps = await this.getList();
      
      if (apps.length === 0) {
        this.logAlert('WARN', 'No PM2 applications found');
        return;
      }

      for (const app of apps) {
        const healthData = {
          appName: app.name,
          status: app.pm2_env.status,
          memory: app.monit.memory,
          cpu: app.monit.cpu,
          restarts: app.restart_time,
          uptime: app.pm2_env.pm_uptime,
          errorCount: app.pm2_env.instance_var?.error_count || 0
        };

        // Memory check
        if (app.monit.memory > this.thresholds.memory * 1024 * 1024) {
          this.logAlert('ERROR', `High memory usage: ${(app.monit.memory / 1024 / 1024).toFixed(2)}MB`, healthData);
        }

        // CPU check
        if (app.monit.cpu > this.thresholds.cpuHigh) {
          this.logAlert('WARN', `High CPU usage: ${app.monit.cpu}%`, healthData);
        }

        // Status check
        if (app.pm2_env.status !== 'online') {
          this.logAlert('ERROR', `Application status: ${app.pm2_env.status}`, healthData);
        }

        // Restart check
        if (app.restart_time > this.metrics.previousRestarts + this.thresholds.restarts) {
          this.logAlert('WARN', `Excessive restarts: ${app.restart_time} total restarts`, healthData);
          this.metrics.previousRestarts = app.restart_time;
        }

        // Log health metrics
        this.logHealth(healthData);
      }

      this.metrics.lastCheck = new Date();
      this.displayDashboard(apps);

    } catch (error) {
      this.logAlert('ERROR', 'Health check failed', { error: error.message });
    }
  }

  /**
   * Display monitoring dashboard
   */
  displayDashboard(apps) {
    console.clear();
    console.log('\n' + '='.repeat(80));
    console.log('PM2 APPLICATION MONITORING DASHBOARD');
    console.log('='.repeat(80));
    console.log(`Last Updated: ${new Date().toLocaleString()}\n`);

    for (const app of apps) {
      const memory = (app.monit.memory / 1024 / 1024).toFixed(2);
      const status = app.pm2_env.status === 'online' ? '🟢 Online' : '🔴 Offline';
      const uptime = this.formatUptime(app.pm2_env.pm_uptime);

      console.log(`Application: ${app.name}`);
      console.log(`  Status: ${status}`);
      console.log(`  PID: ${app.pid}`);
      console.log(`  Memory: ${memory}MB / CPU: ${app.monit.cpu}%`);
      console.log(`  Uptime: ${uptime}`);
      console.log(`  Restarts: ${app.restart_time}`);
      
      if (app.monit.memory > this.thresholds.memory * 1024 * 1024) {
        console.log(`  ⚠️  Memory threshold exceeded!`);
      }
      if (app.monit.cpu > this.thresholds.cpuHigh) {
        console.log(`  ⚠️  CPU threshold exceeded!`);
      }
      
      console.log('');
    }

    console.log('='.repeat(80));
    console.log('Commands:');
    console.log('  pm2 restart <app>  - Restart application');
    console.log('  pm2 stop <app>      - Stop application');
    console.log('  pm2 logs <app>      - View logs');
    console.log('  pm2 delete <app>    - Remove application');
    console.log('\nPress Ctrl+C to exit monitoring\n');
  }

  /**
   * Format uptime
   */
  formatUptime(timestamp) {
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    if (days > 0) return `${days}d ${hours}h ${minutes}m`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  }

  /**
   * Start monitoring
   */
  async start() {
    console.log('Starting PM2 monitoring...\n');
    
    try {
      await this.connect();
      
      // Initial check
      await this.checkHealth();
      
      // Continuous monitoring
      setInterval(async () => {
        await this.checkHealth();
      }, MONITOR_INTERVAL);

      // Handle graceful shutdown
      process.on('SIGINT', () => {
        console.log('\n\nMonitoring stopped');
        pm2.disconnect();
        process.exit(0);
      });

    } catch (error) {
      console.error('Failed to start monitoring:', error.message);
      process.exit(1);
    }
  }
}

// Run monitor
const monitor = new ApplicationMonitor();
monitor.start();

module.exports = ApplicationMonitor;
