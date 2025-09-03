import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Question } from '../../modules/questions/entities/question.entity';
import { Course } from '../../modules/questions/entities/course.entity';
import { AuditLog } from '../entities/audit-log.entity';

export interface RetentionPolicy {
  entity: string;
  retentionDays: number;
  anonymizeAfterDays?: number;
  archiveAfterDays?: number;
  deleteAfterDays?: number;
}

@Injectable()
export class DataRetentionService {
  private readonly logger = new Logger(DataRetentionService.name);

  private readonly retentionPolicies: RetentionPolicy[] = [
    {
      entity: 'questions',
      retentionDays: 2555, // 7 years
      anonymizeAfterDays: 1095, // 3 years
      archiveAfterDays: 1825, // 5 years
    },
    {
      entity: 'courses',
      retentionDays: 3650, // 10 years
      anonymizeAfterDays: 1825, // 5 years
      archiveAfterDays: 2555, // 7 years
    },
    {
      entity: 'audit_logs',
      retentionDays: 1095, // 3 years
      deleteAfterDays: 1095, // 3 years
    },
    {
      entity: 'search_logs',
      retentionDays: 365, // 1 year
      anonymizeAfterDays: 90, // 3 months
      deleteAfterDays: 365, // 1 year
    },
  ];

  constructor(
    @InjectRepository(Question)
    private questionRepository: Repository<Question>,
    @InjectRepository(Course)
    private courseRepository: Repository<Course>,
    @InjectRepository(AuditLog)
    private auditLogRepository: Repository<AuditLog>,
    private configService: ConfigService,
  ) {}

  /**
   * Run data retention cleanup daily at 2 AM
   */
  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async runDataRetentionCleanup(): Promise<void> {
    this.logger.log('Starting data retention cleanup...');

    try {
      for (const policy of this.retentionPolicies) {
        await this.processRetentionPolicy(policy);
      }

      this.logger.log('Data retention cleanup completed successfully');
    } catch (error) {
      this.logger.error('Data retention cleanup failed:', error);
    }
  }

  /**
   * Process retention policy for a specific entity
   */
  private async processRetentionPolicy(policy: RetentionPolicy): Promise<void> {
    const now = new Date();

    // Anonymize data if policy specifies
    if (policy.anonymizeAfterDays) {
      const anonymizeDate = new Date(now.getTime() - policy.anonymizeAfterDays * 24 * 60 * 60 * 1000);
      await this.anonymizeData(policy.entity, anonymizeDate);
    }

    // Archive data if policy specifies
    if (policy.archiveAfterDays) {
      const archiveDate = new Date(now.getTime() - policy.archiveAfterDays * 24 * 60 * 60 * 1000);
      await this.archiveData(policy.entity, archiveDate);
    }

    // Delete data if policy specifies
    if (policy.deleteAfterDays) {
      const deleteDate = new Date(now.getTime() - policy.deleteAfterDays * 24 * 60 * 60 * 1000);
      await this.deleteData(policy.entity, deleteDate);
    }
  }

  /**
   * Anonymize sensitive data
   */
  private async anonymizeData(entity: string, beforeDate: Date): Promise<void> {
    try {
      switch (entity) {
        case 'questions':
          await this.anonymizeQuestions(beforeDate);
          break;
        case 'courses':
          await this.anonymizeCourses(beforeDate);
          break;
        case 'search_logs':
          await this.anonymizeSearchLogs(beforeDate);
          break;
      }
    } catch (error) {
      this.logger.error(`Failed to anonymize ${entity}:`, error);
    }
  }

  /**
   * Archive old data
   */
  private async archiveData(entity: string, beforeDate: Date): Promise<void> {
    try {
      // Implementation would depend on your archiving strategy
      // Could be moving to a separate archive table or external storage
      this.logger.log(`Archiving ${entity} data before ${beforeDate}`);
    } catch (error) {
      this.logger.error(`Failed to archive ${entity}:`, error);
    }
  }

  /**
   * Delete old data
   */
  private async deleteData(entity: string, beforeDate: Date): Promise<void> {
    try {
      switch (entity) {
        case 'audit_logs':
          await this.deleteAuditLogs(beforeDate);
          break;
        case 'search_logs':
          await this.deleteSearchLogs(beforeDate);
          break;
      }
    } catch (error) {
      this.logger.error(`Failed to delete ${entity}:`, error);
    }
  }

  /**
   * Anonymize questions
   */
  private async anonymizeQuestions(beforeDate: Date): Promise<void> {
    const questions = await this.questionRepository.find({
      where: {
        createdAt: LessThan(beforeDate),
        isAnonymized: false,
      },
    });

    for (const question of questions) {
      // Anonymize sensitive fields
      question.questionHtml = this.anonymizeText(question.questionHtml);
      question.correctAnswersHtml = question.correctAnswersHtml.map(answer => this.anonymizeText(answer));
      question.explanationHtml = question.explanationHtml ? this.anonymizeText(question.explanationHtml) : undefined;
      question.isAnonymized = true;
      question.anonymizedAt = new Date();

      await this.questionRepository.save(question);
    }

    this.logger.log(`Anonymized ${questions.length} questions`);
  }

  /**
   * Anonymize courses
   */
  private async anonymizeCourses(beforeDate: Date): Promise<void> {
    const courses = await this.courseRepository.find({
      where: {
        createdAt: LessThan(beforeDate),
        isAnonymized: false,
      },
    });

    for (const course of courses) {
      // Anonymize sensitive fields
      course.courseName = this.anonymizeText(course.courseName);
      course.isAnonymized = true;
      course.anonymizedAt = new Date();

      await this.courseRepository.save(course);
    }

    this.logger.log(`Anonymized ${courses.length} courses`);
  }

  /**
   * Anonymize search logs
   */
  private async anonymizeSearchLogs(beforeDate: Date): Promise<void> {
    // Implementation would depend on your search log structure
    this.logger.log(`Anonymizing search logs before ${beforeDate}`);
  }

  /**
   * Delete old audit logs
   */
  private async deleteAuditLogs(beforeDate: Date): Promise<void> {
    const result = await this.auditLogRepository.delete({
      timestamp: LessThan(beforeDate),
    });

    this.logger.log(`Deleted ${result.affected} audit logs`);
  }

  /**
   * Delete old search logs
   */
  private async deleteSearchLogs(beforeDate: Date): Promise<void> {
    // Implementation would depend on your search log structure
    this.logger.log(`Deleting search logs before ${beforeDate}`);
  }

  /**
   * Anonymize text by replacing with generic patterns
   */
  private anonymizeText(text: string): string {
    if (!text) return text;

    // Replace personal information patterns
    let anonymized = text
      .replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, '[EMAIL]')
      .replace(/\b\d{10,11}\b/g, '[PHONE]')
      .replace(/\b\d{9,12}\b/g, '[ID_NUMBER]')
      .replace(/\b[A-Z][a-z]+ [A-Z][a-z]+\b/g, '[NAME]')
      .replace(/\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g, '[IP_ADDRESS]');

    // Replace specific patterns with generic ones
    anonymized = anonymized
      .replace(/ehou\.edu\.vn/g, '[DOMAIN]')
      .replace(/localhost/g, '[LOCALHOST]')
      .replace(/127\.0\.0\.1/g, '[LOCAL_IP]');

    return anonymized;
  }

  /**
   * Get retention statistics
   */
  async getRetentionStatistics(): Promise<Record<string, any>> {
    const stats: Record<string, any> = {};

    for (const policy of this.retentionPolicies) {
      const now = new Date();
      const retentionDate = new Date(now.getTime() - policy.retentionDays * 24 * 60 * 60 * 1000);

      switch (policy.entity) {
        case 'questions': {
          const questionCount = await this.questionRepository.count({
            where: { createdAt: LessThan(retentionDate) },
          });
          stats.questions = {
            total: await this.questionRepository.count(),
            old: questionCount,
            policy: policy,
          };
          break;
        }

        case 'courses': {
          const courseCount = await this.courseRepository.count({
            where: { createdAt: LessThan(retentionDate) },
          });
          stats.courses = {
            total: await this.courseRepository.count(),
            old: courseCount,
            policy: policy,
          };
          break;
        }

        case 'audit_logs': {
          const auditCount = await this.auditLogRepository.count({
            where: { timestamp: LessThan(retentionDate) },
          });
          stats.audit_logs = {
            total: await this.auditLogRepository.count(),
            old: auditCount,
            policy: policy,
          };
          break;
        }
      }
    }

    return stats;
  }

  /**
   * Manually trigger retention cleanup
   */
  async manualCleanup(): Promise<void> {
    this.logger.log('Manual data retention cleanup triggered');
    await this.runDataRetentionCleanup();
  }
}
