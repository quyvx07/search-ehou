import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';
import { AuditService } from './audit.service';
import { AuditAction, AuditLevel } from '../entities/audit-log.entity';

const execAsync = promisify(exec);

export interface BackupConfig {
  enabled: boolean;
  schedule: string;
  retentionDays: number;
  backupPath: string;
  includeAuditLogs: boolean;
  compression: boolean;
  encryption: boolean;
}

@Injectable()
export class BackupService {
  private readonly logger = new Logger(BackupService.name);

  constructor(
    private configService: ConfigService,
    private auditService: AuditService,
  ) {}

  /**
   * Run daily backup at 3 AM
   */
  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async runScheduledBackup(): Promise<void> {
    const config = this.getBackupConfig();
    
    if (!config.enabled) {
      this.logger.log('Backup is disabled in configuration');
      return;
    }

    this.logger.log('Starting scheduled backup...');
    await this.createBackup();
  }

  /**
   * Create a new backup
   */
  async createBackup(): Promise<string> {
    const config = this.getBackupConfig();
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFileName = `backup-${timestamp}.sql`;
    const backupPath = path.join(config.backupPath, backupFileName);

    try {
      // Ensure backup directory exists
      if (!fs.existsSync(config.backupPath)) {
        fs.mkdirSync(config.backupPath, { recursive: true });
      }

      // Get database configuration
      const dbHost = this.configService.get('DB_HOST', 'localhost');
      const dbPort = this.configService.get('DB_PORT', '5432');
      const dbName = this.configService.get('DB_NAME', 'search_ehou');
      const dbUser = this.configService.get('DB_USER', 'postgres');
      const dbPassword = this.configService.get('DB_PASSWORD', '');

      // Create pg_dump command
      let command = `PGPASSWORD="${dbPassword}" pg_dump -h ${dbHost} -p ${dbPort} -U ${dbUser} -d ${dbName}`;

      // Add options
      if (config.includeAuditLogs) {
        command += ' --data-only --table=audit_logs';
      } else {
        command += ' --exclude-table=audit_logs';
      }

      command += ` > ${backupPath}`;

      // Execute backup
      await execAsync(command);

      // Compress if enabled
      if (config.compression) {
        await this.compressBackup(backupPath);
      }

      // Encrypt if enabled
      if (config.encryption) {
        await this.encryptBackup(backupPath);
      }

      // Log backup creation
      await this.auditService.log({
        action: AuditAction.BACKUP,
        resource: 'database',
        details: {
          fileName: backupFileName,
          size: fs.statSync(backupPath).size,
          compressed: config.compression,
          encrypted: config.encryption,
        },
        level: AuditLevel.INFO,
      });

      this.logger.log(`Backup created successfully: ${backupFileName}`);

      // Clean old backups
      await this.cleanOldBackups();

      return backupPath;
    } catch (error) {
      this.logger.error('Backup failed:', error);
      
      // Log backup failure
      await this.auditService.log({
        action: AuditAction.BACKUP,
        resource: 'database',
        details: {
          error: error.message,
          fileName: backupFileName,
        },
        level: AuditLevel.ERROR,
      });

      throw error;
    }
  }

  /**
   * Restore from backup
   */
  async restoreBackup(backupPath: string): Promise<void> {
    try {
      const dbHost = this.configService.get('DB_HOST', 'localhost');
      const dbPort = this.configService.get('DB_PORT', '5432');
      const dbName = this.configService.get('DB_NAME', 'search_ehou');
      const dbUser = this.configService.get('DB_USER', 'postgres');
      const dbPassword = this.configService.get('DB_PASSWORD', '');

      // Decrypt if needed
      let restorePath = backupPath;
      if (backupPath.endsWith('.enc')) {
        restorePath = await this.decryptBackup(backupPath);
      }

      // Decompress if needed
      if (backupPath.endsWith('.gz')) {
        restorePath = await this.decompressBackup(restorePath);
      }

      // Create restore command
      const command = `PGPASSWORD="${dbPassword}" psql -h ${dbHost} -p ${dbPort} -U ${dbUser} -d ${dbName} < ${restorePath}`;

      // Execute restore
      await execAsync(command);

      // Log restore
      await this.auditService.log({
        action: AuditAction.RESTORE,
        resource: 'database',
        details: {
          fileName: path.basename(backupPath),
        },
        level: AuditLevel.WARNING,
      });

      this.logger.log(`Backup restored successfully from: ${backupPath}`);
    } catch (error) {
      this.logger.error('Restore failed:', error);
      
      await this.auditService.log({
        action: AuditAction.RESTORE,
        resource: 'database',
        details: {
          error: error.message,
          fileName: path.basename(backupPath),
        },
        level: AuditLevel.ERROR,
      });

      throw error;
    }
  }

  /**
   * List available backups
   */
  async listBackups(): Promise<Array<{ name: string; size: number; createdAt: Date }>> {
    const config = this.getBackupConfig();
    
    if (!fs.existsSync(config.backupPath)) {
      return [];
    }

    const files = fs.readdirSync(config.backupPath);
    const backups = [];

    for (const file of files) {
      if (file.startsWith('backup-') && (file.endsWith('.sql') || file.endsWith('.sql.gz') || file.endsWith('.sql.enc'))) {
        const filePath = path.join(config.backupPath, file);
        const stats = fs.statSync(filePath);
        
        backups.push({
          name: file,
          size: stats.size,
          createdAt: stats.birthtime,
        });
      }
    }

    return backups.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  /**
   * Compress backup file
   */
  private async compressBackup(backupPath: string): Promise<void> {
    const compressedPath = `${backupPath}.gz`;
    await execAsync(`gzip -f ${backupPath}`);
    
    // Rename to original path
    fs.renameSync(compressedPath, backupPath);
  }

  /**
   * Decompress backup file
   */
  private async decompressBackup(backupPath: string): Promise<string> {
    const decompressedPath = backupPath.replace('.gz', '');
    await execAsync(`gunzip -f ${backupPath}`);
    return decompressedPath;
  }

  /**
   * Encrypt backup file
   */
  private async encryptBackup(backupPath: string): Promise<void> {
    const encryptionKey = this.configService.get('BACKUP_ENCRYPTION_KEY');
    if (!encryptionKey) {
      throw new Error('BACKUP_ENCRYPTION_KEY not configured');
    }

    const encryptedPath = `${backupPath}.enc`;
    await execAsync(`openssl enc -aes-256-cbc -salt -in ${backupPath} -out ${encryptedPath} -k "${encryptionKey}"`);
    
    // Remove original file
    fs.unlinkSync(backupPath);
    
    // Rename to original path
    fs.renameSync(encryptedPath, backupPath);
  }

  /**
   * Decrypt backup file
   */
  private async decryptBackup(backupPath: string): Promise<string> {
    const encryptionKey = this.configService.get('BACKUP_ENCRYPTION_KEY');
    if (!encryptionKey) {
      throw new Error('BACKUP_ENCRYPTION_KEY not configured');
    }

    const decryptedPath = backupPath.replace('.enc', '');
    await execAsync(`openssl enc -aes-256-cbc -d -in ${backupPath} -out ${decryptedPath} -k "${encryptionKey}"`);
    
    return decryptedPath;
  }

  /**
   * Clean old backups based on retention policy
   */
  private async cleanOldBackups(): Promise<void> {
    const config = this.getBackupConfig();
    const backups = await this.listBackups();
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - config.retentionDays);

    for (const backup of backups) {
      if (backup.createdAt < cutoffDate) {
        const backupPath = path.join(config.backupPath, backup.name);
        fs.unlinkSync(backupPath);
        this.logger.log(`Deleted old backup: ${backup.name}`);
      }
    }
  }

  /**
   * Get backup configuration
   */
  private getBackupConfig(): BackupConfig {
    return {
      enabled: this.configService.get('BACKUP_ENABLED', 'true') === 'true',
      schedule: this.configService.get('BACKUP_SCHEDULE', '0 3 * * *'),
      retentionDays: parseInt(this.configService.get('BACKUP_RETENTION_DAYS', '30')),
      backupPath: this.configService.get('BACKUP_PATH', './backups'),
      includeAuditLogs: this.configService.get('BACKUP_INCLUDE_AUDIT_LOGS', 'false') === 'true',
      compression: this.configService.get('BACKUP_COMPRESSION', 'true') === 'true',
      encryption: this.configService.get('BACKUP_ENCRYPTION', 'true') === 'true',
    };
  }

  /**
   * Test backup configuration
   */
  async testBackup(): Promise<boolean> {
    try {
      const config = this.getBackupConfig();
      
      // Test database connection
      const dbHost = this.configService.get('DB_HOST', 'localhost');
      const dbPort = this.configService.get('DB_PORT', '5432');
      const dbName = this.configService.get('DB_NAME', 'search_ehou');
      const dbUser = this.configService.get('DB_USER', 'postgres');
      const dbPassword = this.configService.get('DB_PASSWORD', '');

      const testCommand = `PGPASSWORD="${dbPassword}" psql -h ${dbHost} -p ${dbPort} -U ${dbUser} -d ${dbName} -c "SELECT 1;"`;
      await execAsync(testCommand);

      // Test backup directory
      if (!fs.existsSync(config.backupPath)) {
        fs.mkdirSync(config.backupPath, { recursive: true });
      }

      // Test write permissions
      const testFile = path.join(config.backupPath, 'test.txt');
      fs.writeFileSync(testFile, 'test');
      fs.unlinkSync(testFile);

      this.logger.log('Backup configuration test passed');
      return true;
    } catch (error) {
      this.logger.error('Backup configuration test failed:', error);
      return false;
    }
  }
}
