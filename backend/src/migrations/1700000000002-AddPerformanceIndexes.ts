import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPerformanceIndexes1700000000002 implements MigrationInterface {
  name = 'AddPerformanceIndexes1700000000002';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add indexes for better query performance
    await queryRunner.query(`
      -- Index for course lookups
      CREATE INDEX IF NOT EXISTS "IDX_questions_course_id" ON "questions" ("course_id");

      -- Index for question text search
      CREATE INDEX IF NOT EXISTS "IDX_questions_question_html" ON "questions" USING gin(to_tsvector('english', "question_html"));

      -- Index for answer text search
      CREATE INDEX IF NOT EXISTS "IDX_questions_answers_html" ON "questions" USING gin(to_tsvector('english', "answers_html"));

      -- Index for created_at ordering
      CREATE INDEX IF NOT EXISTS "IDX_questions_created_at" ON "questions" ("created_at" DESC);

      -- Index for course name search
      CREATE INDEX IF NOT EXISTS "IDX_courses_name" ON "courses" USING gin(to_tsvector('english', "course_name"));

      -- Composite index for course and created_at
      CREATE INDEX IF NOT EXISTS "IDX_questions_course_created" ON "questions" ("course_id", "created_at" DESC);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Remove indexes
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_question_course_id";
      DROP INDEX IF EXISTS "IDX_question_question_html";
      DROP INDEX IF EXISTS "IDX_question_answer_html";
      DROP INDEX IF EXISTS "IDX_question_created_at";
      DROP INDEX IF EXISTS "IDX_course_name";
      DROP INDEX IF EXISTS "IDX_question_course_created";
    `);
  }
}
