import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

export class AddDataProtectionFields1700000000003 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add anonymization fields to questions table
    await queryRunner.query(`
      ALTER TABLE questions 
      ADD COLUMN is_anonymized BOOLEAN DEFAULT FALSE,
      ADD COLUMN anonymized_at TIMESTAMP NULL
    `);

    // Add anonymization fields to courses table
    await queryRunner.query(`
      ALTER TABLE courses 
      ADD COLUMN is_anonymized BOOLEAN DEFAULT FALSE,
      ADD COLUMN anonymized_at TIMESTAMP NULL
    `);

    // Create audit_logs table
    await queryRunner.createTable(
      new Table({
        name: 'audit_logs',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'action',
            type: 'enum',
            enum: [
              'CREATE',
              'READ',
              'UPDATE',
              'DELETE',
              'LOGIN',
              'LOGOUT',
              'SEARCH',
              'EXPORT',
              'IMPORT',
              'BACKUP',
              'RESTORE',
              'ENCRYPT',
              'DECRYPT',
              'ANONYMIZE',
              'ACCESS_DENIED',
              'SECURITY_VIOLATION',
            ],
            isNullable: false,
          },
          {
            name: 'resource',
            type: 'varchar',
            length: '255',
            isNullable: false,
          },
          {
            name: 'resource_id',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          {
            name: 'user_id',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          {
            name: 'ip_address',
            type: 'varchar',
            length: '45',
            isNullable: true,
          },
          {
            name: 'user_agent',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'details',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'level',
            type: 'enum',
            enum: ['INFO', 'WARNING', 'ERROR', 'CRITICAL'],
            default: "'INFO'",
          },
          {
            name: 'timestamp',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'session_id',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          {
            name: 'request_id',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
        ],
      }),
      true,
    );

    // Create indexes for audit_logs table
    await queryRunner.createIndex(
      'audit_logs',
      new TableIndex({
        name: 'IDX_AUDIT_LOGS_TIMESTAMP',
        columnNames: ['timestamp'],
      }),
    );

    await queryRunner.createIndex(
      'audit_logs',
      new TableIndex({
        name: 'IDX_AUDIT_LOGS_ACTION',
        columnNames: ['action'],
      }),
    );

    await queryRunner.createIndex(
      'audit_logs',
      new TableIndex({
        name: 'IDX_AUDIT_LOGS_RESOURCE',
        columnNames: ['resource'],
      }),
    );

    await queryRunner.createIndex(
      'audit_logs',
      new TableIndex({
        name: 'IDX_AUDIT_LOGS_USER_ID',
        columnNames: ['user_id'],
      }),
    );

    await queryRunner.createIndex(
      'audit_logs',
      new TableIndex({
        name: 'IDX_AUDIT_LOGS_LEVEL',
        columnNames: ['level'],
      }),
    );

    // Create indexes for anonymization fields
    await queryRunner.createIndex(
      'questions',
      new TableIndex({
        name: 'IDX_QUESTIONS_ANONYMIZED',
        columnNames: ['is_anonymized'],
      }),
    );

    await queryRunner.createIndex(
      'courses',
      new TableIndex({
        name: 'IDX_COURSES_ANONYMIZED',
        columnNames: ['is_anonymized'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop indexes
    await queryRunner.dropIndex('audit_logs', 'IDX_AUDIT_LOGS_TIMESTAMP');
    await queryRunner.dropIndex('audit_logs', 'IDX_AUDIT_LOGS_ACTION');
    await queryRunner.dropIndex('audit_logs', 'IDX_AUDIT_LOGS_RESOURCE');
    await queryRunner.dropIndex('audit_logs', 'IDX_AUDIT_LOGS_USER_ID');
    await queryRunner.dropIndex('audit_logs', 'IDX_AUDIT_LOGS_LEVEL');
    await queryRunner.dropIndex('questions', 'IDX_QUESTIONS_ANONYMIZED');
    await queryRunner.dropIndex('courses', 'IDX_COURSES_ANONYMIZED');

    // Drop audit_logs table
    await queryRunner.dropTable('audit_logs');

    // Remove anonymization fields from questions table
    await queryRunner.query(`
      ALTER TABLE questions 
      DROP COLUMN is_anonymized,
      DROP COLUMN anonymized_at
    `);

    // Remove anonymization fields from courses table
    await queryRunner.query(`
      ALTER TABLE courses 
      DROP COLUMN is_anonymized,
      DROP COLUMN anonymized_at
    `);
  }
}
