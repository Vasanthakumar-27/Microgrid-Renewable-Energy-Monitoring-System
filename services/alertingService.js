/**
 * ERROR ALERTING SYSTEM
 * Monitors application errors and sends notifications
 */

const fs = require('fs');
const path = require('path');
const nodemailer = require('nodemailer');

class AlertingSystem {
  constructor(config = {}) {
    this.config = {
      alertsFile: config.alertsFile || './logs/alerts.log',
      criticalThreshold: config.criticalThreshold || 5, // Errors per minute
      emailEnabled: process.env.ALERT_EMAIL_ENABLED === 'true',
      emailTo: process.env.ALERT_EMAIL_TO || 'admin@example.com',
      slackEnabled: process.env.ALERT_SLACK_ENABLED === 'true',
      slackWebhook: process.env.ALERT_SLACK_WEBHOOK || '',
      ...config
    };

    this.metrics = {
      errorCount: 0,
      lastHour: [],
      lastMinute: []
    };

    this.emailTransporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD
      }
    });
  }

  /**
   * Log error
   */
  logError(error, context = {}) {
    const timestamp = new Date().toISOString();
    const errorEntry = {
      timestamp,
      message: error.message,
      stack: error.stack,
      context,
      severity: this.calculateSeverity(error)
    };

    // Add to in-memory tracking
    this.metrics.lastMinute.push(timestamp);
    this.metrics.lastHour.push(timestamp);
    this.metrics.errorCount++;

    // Clean old entries (older than 1 minute)
    const oneMinuteAgo = Date.now() - 60000;
    this.metrics.lastMinute = this.metrics.lastMinute.filter(t => 
      new Date(t).getTime() > oneMinuteAgo
    );

    // Log to file
    this.writeToFile(errorEntry);

    // Check if alert needed
    if (this.metrics.lastMinute.length >= this.config.criticalThreshold) {
      this.sendAlert('CRITICAL', error, context);
    }

    return errorEntry;
  }

  /**
   * Calculate error severity
   */
  calculateSeverity(error) {
    const message = error.message || '';
    
    if (message.includes('database') || message.includes('connection')) {
      return 'CRITICAL';
    }
    if (message.includes('unauthorized') || message.includes('auth')) {
      return 'HIGH';
    }
    if (message.includes('validation') || message.includes('format')) {
      return 'MEDIUM';
    }
    
    return 'LOW';
  }

  /**
   * Write alert to file
   */
  writeToFile(errorEntry) {
    try {
      const dir = path.dirname(this.config.alertsFile);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      fs.appendFileSync(
        this.config.alertsFile,
        JSON.stringify(errorEntry) + '\n'
      );
    } catch (e) {
      console.error('Failed to write error to file:', e.message);
    }
  }

  /**
   * Send alert via email
   */
  async sendEmailAlert(subject, body) {
    if (!this.config.emailEnabled) {
      return;
    }

    try {
      await this.emailTransporter.sendMail({
        from: process.env.EMAIL_USER,
        to: this.config.emailTo,
        subject: `[ALERT] ${subject}`,
        html: `
          <h2>${subject}</h2>
          <pre>${body}</pre>
          <p>Timestamp: ${new Date().toISOString()}</p>
          <p>Environment: ${process.env.NODE_ENV}</p>
        `
      });
    } catch (error) {
      console.error('Failed to send email alert:', error.message);
    }
  }

  /**
   * Send alert via Slack
   */
  async sendSlackAlert(message, severity) {
    if (!this.config.slackEnabled) {
      return;
    }

    const colors = {
      'CRITICAL': '#FF0000',
      'HIGH': '#FF6600',
      'MEDIUM': '#FFCC00',
      'LOW': '#0099FF'
    };

    try {
      const response = await fetch(this.config.slackWebhook, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          attachments: [{
            color: colors[severity] || '#999999',
            title: `Alert: ${severity}`,
            text: message,
            footer: 'Microgrid City System',
            ts: Math.floor(Date.now() / 1000)
          }]
        })
      });

      if (!response.ok) {
        console.error('Slack alert failed:', response.statusText);
      }
    } catch (error) {
      console.error('Failed to send Slack alert:', error.message);
    }
  }

  /**
   * Send consolidated alert
   */
  async sendAlert(severity, error, context = {}) {
    const timestamp = new Date().toISOString();
    const message = `
      Severity: ${severity}
      Error: ${error.message}
      Time: ${timestamp}
      Context: ${JSON.stringify(context, null, 2)}
      Error Count (last minute): ${this.metrics.lastMinute.length}
    `;

    console.error(`\n[${severity}] ${timestamp}\n${message}`);

    // Send via multiple channels
    await Promise.all([
      this.sendEmailAlert(`${severity}: ${error.message}`, message),
      this.sendSlackAlert(message, severity)
    ]);

    // Update alert statistics
    this.recordAlert(severity, error.message);
  }

  /**
   * Record alert statistics
   */
  recordAlert(severity, message) {
    const statsFile = './logs/alert-stats.json';
    
    try {
      let stats = { total: 0, by_severity: {} };
      
      if (fs.existsSync(statsFile)) {
        stats = JSON.parse(fs.readFileSync(statsFile, 'utf8'));
      }

      stats.total++;
      stats.by_severity[severity] = (stats.by_severity[severity] || 0) + 1;
      stats.last_alert = new Date().toISOString();

      fs.writeFileSync(statsFile, JSON.stringify(stats, null, 2));
    } catch (e) {
      console.error('Failed to update alert stats:', e.message);
    }
  }

  /**
   * Get alert summary
   */
  getAlertSummary() {
    try {
      const statsFile = './logs/alert-stats.json';
      if (fs.existsSync(statsFile)) {
        return JSON.parse(fs.readFileSync(statsFile, 'utf8'));
      }
    } catch (e) {
      console.error('Failed to read alert stats:', e.message);
    }

    return {
      total: 0,
      by_severity: {},
      last_alert: null
    };
  }

  /**
   * Get recent errors
   */
  getRecentErrors(minutes = 60) {
    try {
      if (!fs.existsSync(this.config.alertsFile)) {
        return [];
      }

      const lines = fs.readFileSync(this.config.alertsFile, 'utf8').split('\n').filter(l => l);
      const cutoff = Date.now() - (minutes * 60000);

      return lines.map(line => {
        try {
          return JSON.parse(line);
        } catch {
          return null;
        }
      }).filter(e => e && new Date(e.timestamp).getTime() > cutoff);
    } catch (error) {
      console.error('Failed to read errors:', error.message);
      return [];
    }
  }
}

module.exports = AlertingSystem;
