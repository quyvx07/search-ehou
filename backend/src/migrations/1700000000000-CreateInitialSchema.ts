import { MigrationInterface, QueryRunner, Table, TableIndex, TableForeignKey } from 'typeorm';

export class CreateInitialSchema1700000000000 implements MigrationInterface {
  name = 'CreateInitialSchema1700000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create courses table
    await queryRunner.createTable(
      new Table({
        name: 'courses',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'gen_random_uuid()',
          },
          {
            name: 'course_code',
            type: 'varchar',
            length: '50',
            isUnique: true,
          },
          {
            name: 'course_name',
            type: 'varchar',
            length: '255',
            isNullable: false,
          },
          {
            name: 'created_at',
            type: 'timestamp with time zone',
            default: 'NOW()',
          },
          {
            name: 'updated_at',
            type: 'timestamp with time zone',
            default: 'NOW()',
          },
        ],
      }),
      true,
    );

    // Create questions table
    await queryRunner.createTable(
      new Table({
        name: 'questions',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'gen_random_uuid()',
          },
          {
            name: 'course_id',
            type: 'uuid',
            isNullable: true,
          },
          {
            name: 'question_html',
            type: 'text',
            isNullable: false,
          },
          {
            name: 'answers_html',
            type: 'jsonb',
          },
          {
            name: 'correct_answers_html',
            type: 'jsonb',
          },
          {
            name: 'explanation_html',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'created_at',
            type: 'timestamp with time zone',
            default: 'NOW()',
          },
          {
            name: 'updated_at',
            type: 'timestamp with time zone',
            default: 'NOW()',
          },
        ],
      }),
      true,
    );

    // Create indexes
    await queryRunner.createIndex(
      'courses',
      new TableIndex({
        name: 'idx_courses_code',
        columnNames: ['course_code'],
        isUnique: true,
      }),
    );

    await queryRunner.createIndex(
      'questions',
      new TableIndex({
        name: 'idx_questions_course_id',
        columnNames: ['course_id'],
      }),
    );

    await queryRunner.createIndex(
      'questions',
      new TableIndex({
        name: 'idx_questions_created_at',
        columnNames: ['created_at'],
      }),
    );

    // Create foreign key
    await queryRunner.createForeignKey(
      'questions',
      new TableForeignKey({
        name: 'fk_questions_course',
        columnNames: ['course_id'],
        referencedColumnNames: ['id'],
        referencedTableName: 'courses',
        onDelete: 'CASCADE',
      }),
    );

    // Enable uuid-ossp extension for UUID generation
    await queryRunner.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropForeignKey('questions', 'fk_questions_course');
    await queryRunner.dropIndex('questions', 'idx_questions_created_at');
    await queryRunner.dropIndex('questions', 'idx_questions_course_id');
    await queryRunner.dropIndex('courses', 'idx_courses_code');
    await queryRunner.dropTable('questions');
    await queryRunner.dropTable('courses');
  }
}
