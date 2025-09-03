import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

export enum AuditAction {
  CREATE = 'CREATE',
  READ = 'READ',
  UPDATE = 'UPDATE',
  DELETE = 'DELETE',
  LOGIN = 'LOGIN',
  LOGOUT = 'LOGOUT',
  SEARCH = 'SEARCH',
  EXPORT = 'EXPORT',
  IMPORT = 'IMPORT',
  BACKUP = 'BACKUP',
  RESTORE = 'RESTORE',
  ENCRYPT = 'ENCRYPT',
  DECRYPT = 'DECRYPT',
  ANONYMIZE = 'ANONYMIZE',
  ACCESS_DENIED = 'ACCESS_DENIED',
  SECURITY_VIOLATION = 'SECURITY_VIOLATION',
}

export enum AuditLevel {
  INFO = 'INFO',
  WARNING = 'WARNING',
  ERROR = 'ERROR',
  CRITICAL = 'CRITICAL',
}

@Entity('audit_logs')
@Index(['timestamp'])
@Index(['action'])
@Index(['resource'])
@Index(['userId'])
@Index(['level'])
export class AuditLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({
    type: 'enum',
    enum: AuditAction,
    nullable: false,
  })
  action: AuditAction;

  @Column({
    type: 'varchar',
    length: 255,
    nullable: false,
  })
  resource: string;

  @Column({
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  resourceId: string;

  @Column({
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  userId: string;

  @Column({
    type: 'varchar',
    length: 45, // IPv6 length
    nullable: true,
  })
  ipAddress: string;

  @Column({
    type: 'text',
    nullable: true,
  })
  userAgent: string;

  @Column({
    type: 'jsonb',
    nullable: true,
  })
  details: Record<string, any>;

  @Column({
    type: 'enum',
    enum: AuditLevel,
    default: AuditLevel.INFO,
  })
  level: AuditLevel;

  @CreateDateColumn({
    type: 'timestamp',
    default: () => 'CURRENT_TIMESTAMP',
  })
  timestamp: Date;

  @Column({
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  sessionId: string;

  @Column({
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  requestId: string;
}
