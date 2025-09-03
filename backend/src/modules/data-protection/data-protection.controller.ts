import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { EncryptionService } from '../../common/services/encryption.service';
import { AuditService } from '../../common/services/audit.service';
import { AuditAction, AuditLevel } from '../../common/entities/audit-log.entity';
import { DataRetentionService } from '../../common/services/data-retention.service';
import { BackupService } from '../../common/services/backup.service';
import { AccessControlService, Permission } from '../../common/services/access-control.service';

@ApiTags('Data Protection')
@Controller('api/v1/data-protection')
export class DataProtectionController {
  constructor(
    private encryptionService: EncryptionService,
    private auditService: AuditService,
    private dataRetentionService: DataRetentionService,
    private backupService: BackupService,
    private accessControlService: AccessControlService,
  ) {}

  // Encryption endpoints
  @Post('encrypt')
  @ApiOperation({ summary: 'Encrypt sensitive data' })
  @ApiResponse({ status: 200, description: 'Data encrypted successfully' })
  async encryptData(@Body() data: { text: string }) {
    const encrypted = await this.encryptionService.encrypt(data.text);
    
    await this.auditService.log({
      action: AuditAction.ENCRYPT,
      resource: 'data',
      details: { dataLength: data.text.length },
      level: AuditLevel.INFO,
    });

    return { encrypted };
  }

  @Post('decrypt')
  @ApiOperation({ summary: 'Decrypt encrypted data' })
  @ApiResponse({ status: 200, description: 'Data decrypted successfully' })
  async decryptData(@Body() data: { encrypted: string }) {
    const decrypted = await this.encryptionService.decrypt(data.encrypted);
    
    await this.auditService.log({
      action: AuditAction.DECRYPT,
      resource: 'data',
      details: { dataLength: data.encrypted.length },
      level: AuditLevel.INFO,
    });

    return { decrypted };
  }

  // Audit endpoints
  @Get('audit-logs')
  @ApiOperation({ summary: 'Get audit logs with filtering' })
  @ApiResponse({ status: 200, description: 'Audit logs retrieved successfully' })
  async getAuditLogs(
    @Query('action') action?: string,
    @Query('resource') resource?: string,
    @Query('userId') userId?: string,
    @Query('level') level?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const filters = {
      action: action as AuditAction,
      resource,
      userId,
      level: level as AuditLevel,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
    };

    const result = await this.auditService.getAuditLogs(
      filters,
      parseInt(page) || 1,
      parseInt(limit) || 50,
    );

    return result;
  }

  @Post('audit-logs/export')
  @ApiOperation({ summary: 'Export audit logs for compliance' })
  @ApiResponse({ status: 200, description: 'Audit logs exported successfully' })
  async exportAuditLogs(
    @Body() data: { startDate: string; endDate: string; format: 'json' | 'csv' },
  ) {
    const exported = await this.auditService.exportAuditLogs(
      new Date(data.startDate),
      new Date(data.endDate),
      data.format,
    );

    await this.auditService.log({
      action: AuditAction.EXPORT,
      resource: 'audit_logs',
      details: { format: data.format, startDate: data.startDate, endDate: data.endDate },
      level: AuditLevel.INFO,
    });

    return { exported };
  }

  // Data retention endpoints
  @Get('retention/stats')
  @ApiOperation({ summary: 'Get data retention statistics' })
  @ApiResponse({ status: 200, description: 'Retention statistics retrieved successfully' })
  async getRetentionStats() {
    const stats = await this.dataRetentionService.getRetentionStatistics();
    return stats;
  }

  @Post('retention/cleanup')
  @ApiOperation({ summary: 'Manually trigger data retention cleanup' })
  @ApiResponse({ status: 200, description: 'Data retention cleanup completed' })
  async triggerRetentionCleanup() {
    await this.dataRetentionService.manualCleanup();
    
    await this.auditService.log({
      action: AuditAction.ANONYMIZE,
      resource: 'data_retention',
      details: { manual: true },
      level: AuditLevel.WARNING,
    });

    return { message: 'Data retention cleanup completed' };
  }

  // Backup endpoints
  @Post('backup/create')
  @ApiOperation({ summary: 'Create a new backup' })
  @ApiResponse({ status: 200, description: 'Backup created successfully' })
  async createBackup() {
    const backupPath = await this.backupService.createBackup();
    
    await this.auditService.log({
      action: AuditAction.BACKUP,
      resource: 'database',
      details: { backupPath },
      level: AuditLevel.INFO,
    });

    return { backupPath, message: 'Backup created successfully' };
  }

  @Get('backup/list')
  @ApiOperation({ summary: 'List available backups' })
  @ApiResponse({ status: 200, description: 'Backups listed successfully' })
  async listBackups() {
    const backups = await this.backupService.listBackups();
    return backups;
  }

  @Post('backup/restore/:filename')
  @ApiOperation({ summary: 'Restore from backup' })
  @ApiResponse({ status: 200, description: 'Backup restored successfully' })
  async restoreBackup(@Param('filename') filename: string) {
    const backupPath = `./backups/${filename}`;
    await this.backupService.restoreBackup(backupPath);
    
    await this.auditService.log({
      action: AuditAction.RESTORE,
      resource: 'database',
      details: { filename },
      level: AuditLevel.WARNING,
    });

    return { message: 'Backup restored successfully' };
  }

  @Post('backup/test')
  @ApiOperation({ summary: 'Test backup configuration' })
  @ApiResponse({ status: 200, description: 'Backup configuration test completed' })
  async testBackup() {
    const result = await this.backupService.testBackup();
    return { success: result };
  }

  // Access control endpoints
  @Get('access-control/stats')
  @ApiOperation({ summary: 'Get access control statistics' })
  @ApiResponse({ status: 200, description: 'Access control statistics retrieved successfully' })
  async getAccessControlStats() {
    const stats = await this.accessControlService.getAccessControlStats();
    return stats;
  }

  @Post('access-control/check')
  @ApiOperation({ summary: 'Check user permissions' })
  @ApiResponse({ status: 200, description: 'Permission check completed' })
  async checkPermission(@Body() request: {
    userId: string;
    resource: string;
    action: string;
    ipAddress: string;
    userAgent: string;
  }) {
    const hasPermission = await this.accessControlService.checkPermission(request);
    return { hasPermission };
  }

  @Get('access-control/permissions/:userId/:resource')
  @ApiOperation({ summary: 'Get user permissions for resource' })
  @ApiResponse({ status: 200, description: 'User permissions retrieved successfully' })
  async getUserPermissions(
    @Param('userId') userId: string,
    @Param('resource') resource: string,
  ) {
    const permissions = await this.accessControlService.getUserResourcePermissions(userId, resource);
    return { permissions };
  }

  // Data protection overview
  @Get('overview')
  @ApiOperation({ summary: 'Get data protection overview' })
  @ApiResponse({ status: 200, description: 'Data protection overview retrieved successfully' })
  async getDataProtectionOverview() {
    const [retentionStats, accessControlStats, backups] = await Promise.all([
      this.dataRetentionService.getRetentionStatistics(),
      this.accessControlService.getAccessControlStats(),
      this.backupService.listBackups(),
    ]);

    return {
      retention: retentionStats,
      accessControl: accessControlStats,
      backups: {
        count: backups.length,
        latest: backups[0] || null,
      },
      encryption: {
        enabled: true,
        algorithm: 'AES-256-GCM',
      },
      audit: {
        enabled: true,
        levels: Object.values(AuditLevel),
        actions: Object.values(AuditAction),
      },
    };
  }
}
