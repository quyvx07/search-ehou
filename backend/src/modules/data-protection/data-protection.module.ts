import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { EncryptionService } from '../../common/services/encryption.service';
import { AuditService } from '../../common/services/audit.service';
import { DataRetentionService } from '../../common/services/data-retention.service';
import { BackupService } from '../../common/services/backup.service';
import { AccessControlService } from '../../common/services/access-control.service';
import { AuditLog } from '../../common/entities/audit-log.entity';
import { Question } from '../questions/entities/question.entity';
import { Course } from '../questions/entities/course.entity';
import { DataProtectionController } from './data-protection.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([AuditLog, Question, Course]),
    ScheduleModule.forRoot(),
  ],
  providers: [
    EncryptionService,
    AuditService,
    DataRetentionService,
    BackupService,
    AccessControlService,
  ],
  controllers: [DataProtectionController],
  exports: [
    EncryptionService,
    AuditService,
    DataRetentionService,
    BackupService,
    AccessControlService,
  ],
})
export class DataProtectionModule {}
