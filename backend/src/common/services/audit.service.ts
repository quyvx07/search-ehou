import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLog, AuditAction, AuditLevel } from '../entities/audit-log.entity';

export interface AuditEvent {
  action: AuditAction;
  resource: string;
  resourceId?: string;
  userId?: string;
  ipAddress?: string;
  userAgent?: string;
  details?: Record<string, any>;
  level?: AuditLevel;
  timestamp?: Date;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(
    @InjectRepository(AuditLog)
    private auditLogRepository: Repository<AuditLog>,
    private configService: ConfigService,
  ) {}

  /**
   * Log audit event
   */
  async log(event: AuditEvent): Promise<void> {
    try {
      const auditLog = new AuditLog();
      auditLog.action = event.action;
      auditLog.resource = event.resource;
      auditLog.resourceId = event.resourceId;
      auditLog.userId = event.userId;
      auditLog.ipAddress = event.ipAddress;
      auditLog.userAgent = event.userAgent;
      auditLog.details = event.details || {};
      auditLog.level = event.level || AuditLevel.INFO;
      auditLog.timestamp = event.timestamp || new Date();

      await this.auditLogRepository.save(auditLog);

      // Also log to console for development
      if (this.configService.get('NODE_ENV') === 'development') {
        this.logger.log(`AUDIT: ${event.action} on ${event.resource} by ${event.userId || 'anonymous'}`);
      }
    } catch (error) {
      this.logger.error('Failed to log audit event:', error);
    }
  }

  /**
   * Log data access
   */
  async logDataAccess(
    resource: string,
    resourceId: string,
    userId: string,
    ipAddress: string,
    userAgent: string,
  ): Promise<void> {
    await this.log({
      action: AuditAction.READ,
      resource,
      resourceId,
      userId,
      ipAddress,
      userAgent,
      level: AuditLevel.INFO,
    });
  }

  /**
   * Log data modification
   */
  async logDataModification(
    action: AuditAction,
    resource: string,
    resourceId: string,
    userId: string,
    ipAddress: string,
    userAgent: string,
    details?: Record<string, any>,
  ): Promise<void> {
    await this.log({
      action,
      resource,
      resourceId,
      userId,
      ipAddress,
      userAgent,
      details,
      level: AuditLevel.WARNING,
    });
  }

  /**
   * Log security event
   */
  async logSecurityEvent(
    action: AuditAction,
    resource: string,
    userId: string,
    ipAddress: string,
    userAgent: string,
    details?: Record<string, any>,
  ): Promise<void> {
    await this.log({
      action,
      resource,
      userId,
      ipAddress,
      userAgent,
      details,
      level: AuditLevel.ERROR,
    });
  }

  /**
   * Log encryption/decryption events
   */
  async logEncryptionEvent(
    action: AuditAction.ENCRYPT | AuditAction.DECRYPT,
    resource: string,
    resourceId: string,
    userId: string,
    ipAddress: string,
    userAgent: string,
  ): Promise<void> {
    await this.log({
      action,
      resource,
      resourceId,
      userId,
      ipAddress,
      userAgent,
      level: AuditLevel.INFO,
    });
  }

  /**
   * Get audit logs with filtering
   */
  async getAuditLogs(
    filters: {
      action?: AuditAction;
      resource?: string;
      userId?: string;
      level?: AuditLevel;
      startDate?: Date;
      endDate?: Date;
    },
    page: number = 1,
    limit: number = 50,
  ): Promise<{ logs: AuditLog[]; total: number }> {
    const query = this.auditLogRepository.createQueryBuilder('audit');

    if (filters.action) {
      query.andWhere('audit.action = :action', { action: filters.action });
    }

    if (filters.resource) {
      query.andWhere('audit.resource = :resource', { resource: filters.resource });
    }

    if (filters.userId) {
      query.andWhere('audit.userId = :userId', { userId: filters.userId });
    }

    if (filters.level) {
      query.andWhere('audit.level = :level', { level: filters.level });
    }

    if (filters.startDate) {
      query.andWhere('audit.timestamp >= :startDate', { startDate: filters.startDate });
    }

    if (filters.endDate) {
      query.andWhere('audit.timestamp <= :endDate', { endDate: filters.endDate });
    }

    query.orderBy('audit.timestamp', 'DESC');

    const total = await query.getCount();
    const logs = await query
      .skip((page - 1) * limit)
      .take(limit)
      .getMany();

    return { logs, total };
  }

  /**
   * Clean old audit logs based on retention policy
   */
  async cleanOldLogs(retentionDays: number = 90): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    const result = await this.auditLogRepository
      .createQueryBuilder()
      .delete()
      .where('timestamp < :cutoffDate', { cutoffDate })
      .execute();

    return result.affected || 0;
  }

  /**
   * Export audit logs for compliance
   */
  async exportAuditLogs(
    startDate: Date,
    endDate: Date,
    format: 'json' | 'csv' = 'json',
  ): Promise<string> {
    const logs = await this.auditLogRepository
      .createQueryBuilder('audit')
      .where('audit.timestamp >= :startDate', { startDate })
      .andWhere('audit.timestamp <= :endDate', { endDate })
      .orderBy('audit.timestamp', 'ASC')
      .getMany();

    if (format === 'csv') {
      return this.convertToCSV(logs);
    }

    return JSON.stringify(logs, null, 2);
  }

  private convertToCSV(logs: AuditLog[]): string {
    const headers = ['timestamp', 'action', 'resource', 'resourceId', 'userId', 'ipAddress', 'level'];
    const csvRows = [headers.join(',')];

    for (const log of logs) {
      const row = [
        log.timestamp.toISOString(),
        log.action,
        log.resource,
        log.resourceId || '',
        log.userId || '',
        log.ipAddress || '',
        log.level,
      ];
      csvRows.push(row.join(','));
    }

    return csvRows.join('\n');
  }
}
