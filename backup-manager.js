#!/usr/bin/env node

/**
 * DATABASE BACKUP & RECOVERY PROCEDURES
 * Automated backup, restore, and recovery management
 */

const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const mongoose = require('mongoose');
const util = require('util');

const execPromise = util.promisify(exec);

class BackupManager {
  constructor() {
    this.backupDir = './backups';
    this.maxBackups = 10; // Keep last 10 backups
    this.retentionDays = 30; // Keep backups for 30 days
    this.logFile = './logs/backup.log';

    // Ensure directories exist
    if (!fs.existsSync(this.backupDir)) {
      fs.mkdirSync(this.backupDir, { recursive: true });
    }
    if (!fs.existsSync('./logs')) {
      fs.mkdirSync('./logs', { recursive: true });
    }
  }

  /**
   * Log backup operation
   */
  log(message, level = 'INFO') {
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] [${level}] ${message}\n`;
    
    console.log(logEntry);
    
    try {
      fs.appendFileSync(this.logFile, logEntry);
    } catch (e) {
      console.error('Failed to write backup log:', e.message);
    }
  }

  /**
   * Create database backup
   */
  async createBackup() {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupName = `backup_${timestamp}.json`;
    const backupPath = path.join(this.backupDir, backupName);

    try {
      this.log(`Starting backup: ${backupName}`, 'INFO');

      // Connect to MongoDB
      if (mongoose.connection.readyState !== 1) {
        await mongoose.connect(process.env.DB_URI || require('../config/appConfig').mongoUri);
      }

      // Get all collections
      const collections = {};
      const db = mongoose.connection.db;
      const colNames = await db.listCollections().toArray();

      for (const colInfo of colNames) {
        const colName = colInfo.name;
        const collection = db.collection(colName);
        collections[colName] = await collection.find({}).toArray();
        this.log(`Backed up collection: ${colName} (${collections[colName].length} documents)`, 'INFO');
      }

      // Write backup
      const backupData = {
        timestamp: new Date().toISOString(),
        uri: process.env.DB_URI,
        collections
      };

      fs.writeFileSync(backupPath, JSON.stringify(backupData, null, 2));
      this.log(`Backup completed: ${backupPath}`, 'SUCCESS');

      // Cleanup old backups
      await this.cleanupOldBackups();

      return backupPath;

    } catch (error) {
      this.log(`Backup failed: ${error.message}`, 'ERROR');
      throw error;
    }
  }

  /**
   * Restore from backup
   */
  async restoreBackup(backupPath) {
    try {
      if (!fs.existsSync(backupPath)) {
        throw new Error(`Backup file not found: ${backupPath}`);
      }

      this.log(`Starting restore from: ${backupPath}`, 'INFO');

      // Connect to MongoDB
      if (mongoose.connection.readyState !== 1) {
        await mongoose.connect(process.env.DB_URI || require('../config/appConfig').mongoUri);
      }

      const backupData = JSON.parse(fs.readFileSync(backupPath, 'utf8'));
      const db = mongoose.connection.db;

      // Restore collections
      for (const [colName, documents] of Object.entries(backupData.collections)) {
        const collection = db.collection(colName);
        
        // Clear existing data
        await collection.deleteMany({});
        this.log(`Cleared collection: ${colName}`, 'INFO');

        // Insert backup data
        if (documents.length > 0) {
          await collection.insertMany(documents);
          this.log(`Restored collection: ${colName} (${documents.length} documents)`, 'INFO');
        }
      }

      this.log(`Restore completed successfully`, 'SUCCESS');
      return true;

    } catch (error) {
      this.log(`Restore failed: ${error.message}`, 'ERROR');
      throw error;
    }
  }

  /**
   * Cleanup old backups
   */
  async cleanupOldBackups() {
    try {
      const files = fs.readdirSync(this.backupDir)
        .filter(f => f.startsWith('backup_'))
        .map(f => ({
          name: f,
          path: path.join(this.backupDir, f),
          time: fs.statSync(path.join(this.backupDir, f)).mtime.getTime()
        }))
        .sort((a, b) => b.time - a.time);

      // Remove by count
      while (files.length > this.maxBackups) {
        const old = files.pop();
        fs.unlinkSync(old.path);
        this.log(`Deleted old backup: ${old.name}`, 'INFO');
      }

      // Remove by age
      const cutoff = Date.now() - (this.retentionDays * 24 * 60 * 60 * 1000);
      for (const file of files) {
        if (file.time < cutoff) {
          fs.unlinkSync(file.path);
          this.log(`Deleted expired backup: ${file.name}`, 'INFO');
        }
      }

    } catch (error) {
      this.log(`Cleanup failed: ${error.message}`, 'WARN');
    }
  }

  /**
   * List available backups
   */
  listBackups() {
    try {
      const files = fs.readdirSync(this.backupDir)
        .filter(f => f.startsWith('backup_'))
        .map(f => {
          const fullPath = path.join(this.backupDir, f);
          const stat = fs.statSync(fullPath);
          return {
            name: f,
            path: fullPath,
            size: (stat.size / 1024 / 1024).toFixed(2) + ' MB',
            created: stat.mtime.toISOString()
          };
        })
        .sort((a, b) => new Date(b.created) - new Date(a.created));

      return files;
    } catch (error) {
      this.log(`Failed to list backups: ${error.message}`, 'ERROR');
      return [];
    }
  }

  /**
   * Schedule automatic backups
   */
  scheduleBackups(intervalHours = 6) {
    const intervalMs = intervalHours * 60 * 60 * 1000;

    this.log(`Scheduling automatic backups every ${intervalHours} hours`, 'INFO');

    // Run immediately on startup
    this.createBackup().catch(e => this.log(`Initial backup failed: ${e.message}`, 'ERROR'));

    // Schedule recurring
    setInterval(() => {
      this.createBackup().catch(e => this.log(`Scheduled backup failed: ${e.message}`, 'ERROR'));
    }, intervalMs);
  }

  /**
   * Get backup statistics
   */
  getStats() {
    try {
      const backups = this.listBackups();
      const totalSize = backups.reduce((sum, b) => sum + parseFloat(b.size), 0);

      return {
        total_backups: backups.length,
        oldest_backup: backups.length > 0 ? backups[backups.length - 1].created : null,
        newest_backup: backups.length > 0 ? backups[0].created : null,
        total_size_mb: totalSize.toFixed(2),
        retention_days: this.retentionDays,
        max_backups: this.maxBackups
      };
    } catch (error) {
      this.log(`Failed to get stats: ${error.message}`, 'ERROR');
      return null;
    }
  }
}

// CLI Usage
if (require.main === module) {
  const manager = new BackupManager();
  const command = process.argv[2];

  (async () => {
    try {
      switch (command) {
        case 'create':
          await manager.createBackup();
          break;

        case 'restore':
          const backupPath = process.argv[3];
          if (!backupPath) {
            console.log('Usage: node backup-manager.js restore <backup_path>');
            process.exit(1);
          }
          await manager.restoreBackup(backupPath);
          break;

        case 'list':
          const backups = manager.listBackups();
          console.table(backups);
          break;

        case 'stats':
          const stats = manager.getStats();
          console.table(stats);
          break;

        case 'schedule':
          const hours = parseInt(process.argv[3]) || 6;
          manager.scheduleBackups(hours);
          // Keep process running
          process.on('SIGINT', () => {
            manager.log('Backup scheduler stopped', 'INFO');
            process.exit(0);
          });
          break;

        default:
          console.log(`
Backup Manager - Usage:
  node backup-manager.js create              - Create backup now
  node backup-manager.js restore <path>     - Restore from backup
  node backup-manager.js list                - List all backups
  node backup-manager.js stats               - Show backup statistics
  node backup-manager.js schedule [hours]    - Start automatic backups (default: 6 hours)
          `);
          break;
      }
    } catch (error) {
      console.error('Error:', error.message);
      process.exit(1);
    }
  })();
}

module.exports = BackupManager;
