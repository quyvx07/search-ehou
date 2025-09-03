#!/bin/bash

# Script to safely clear database data
# Usage: ./clear-database.sh [environment]

set -e

ENVIRONMENT=${1:-development}
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

echo "🧹 Clearing database data..."
echo "Environment: $ENVIRONMENT"
echo "Project root: $PROJECT_ROOT"

# Check if we're in the right directory
if [ ! -f "backend/package.json" ]; then
    echo "Error: backend/package.json not found. Please run from project root."
    exit 1
fi

cd "$PROJECT_ROOT/backend"

# Check if .env exists
if [ ! -f ".env" ]; then
    echo "Warning: .env file not found. Using default database configuration."
fi

# Database configuration - adjust these for your setup
DB_HOST=${DB_HOST:-localhost}
DB_PORT=${DB_PORT:-5432}
DB_NAME=${DB_NAME:-search_ehou}
DB_USER=${DB_USER:-postgres}

echo "Database: $DB_NAME on $DB_HOST:$DB_PORT"

# Ask for confirmation
echo ""
echo "⚠️  WARNING: This will delete ALL data from the following tables:"
echo "   - questions"
echo "   - courses"
echo "   - audit_logs"
echo ""
read -p "Are you sure you want to continue? (yes/no): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Operation cancelled."
    exit 0
fi

# Confirm once more
read -p "This action cannot be undone. Type 'DELETE' to confirm: " confirmation
if [ "$confirmation" != "DELETE" ]; then
    echo "Operation cancelled."
    exit 0
fi

echo "Starting data clearance..."

# Check if psql is available
if ! command -v psql > /dev/null 2>&1; then
    echo "Error: psql command not found. Please install PostgreSQL client."
    exit 1
fi

# Clear data from tables in correct order (respecting foreign keys)
echo "Clearing audit_logs..."
PGPASSWORD=${DB_PASSWORD:-} psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c "
    TRUNCATE TABLE audit_logs RESTART IDENTITY CASCADE;
" 2>/dev/null || echo "audit_logs table may not exist or is already empty."

echo "Clearing questions..."
PGPASSWORD=${DB_PASSWORD:-} psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c "
    TRUNCATE TABLE questions RESTART IDENTITY CASCADE;
" 2>/dev/null || echo "questions table may not exist or is already empty."

echo "Clearing courses..."
PGPASSWORD=${DB_PASSWORD:-} psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c "
    TRUNCATE TABLE courses RESTART IDENTITY CASCADE;
" 2>/dev/null || echo "courses table may not exist or is already empty."

# Also clear any backup tables if they exist
echo "Clearing backup tables..."
PGPASSWORD=${DB_PASSWORD:-} psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c "
    -- Drop backup tables if they exist
    DROP TABLE IF EXISTS subjects CASCADE;
    DROP TABLE IF EXISTS question_choices CASCADE;
    DROP TABLE IF EXISTS correct_answers CASCADE;
    DROP TABLE IF EXISTS question_images CASCADE;
    DROP TABLE IF EXISTS choice_images CASCADE;
    DROP TABLE IF EXISTS correct_answer_images CASCADE;
    DROP TABLE IF EXISTS correct_answer_image_hashes CASCADE;
    DROP TABLE IF EXISTS attachment CASCADE;
    DROP TABLE IF EXISTS transactions CASCADE;
    DROP TABLE IF EXISTS questions_seq;
    DROP TABLE IF EXISTS subjects_seq;
    DROP TABLE IF EXISTS choice_images_id_seq;
    DROP TABLE IF EXISTS question_images_id_seq;
    DROP SEQUENCE IF EXISTS questions_seq;
    DROP SEQUENCE IF EXISTS subjects_seq;
    DROP SEQUENCE IF EXISTS choice_images_id_seq;
    DROP SEQUENCE IF EXISTS question_images_id_seq;
" 2>/dev/null || echo "Some backup tables may not exist."

# Reset sequences
echo "Resetting sequences..."
PGPASSWORD=${DB_PASSWORD:-} psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c "
    -- Reset sequences for main tables
    ALTER SEQUENCE IF EXISTS courses_id_seq RESTART WITH 1;
    ALTER SEQUENCE IF EXISTS questions_id_seq RESTART WITH 1;
    ALTER SEQUENCE IF EXISTS audit_logs_id_seq RESTART WITH 1;
" 2>/dev/null || echo "Could not reset some sequences."

# Verify data clearance
echo ""
echo "Verifying data clearance..."
RESULT=$(PGPASSWORD=${DB_PASSWORD:-} psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c "
    SELECT
        'courses' as table_name, COUNT(*) as count FROM courses
    UNION ALL
    SELECT 'questions' as table_name, COUNT(*) as count FROM questions
    UNION ALL
    SELECT 'audit_logs' as table_name, COUNT(*) as count FROM audit_logs
    ORDER BY table_name;
" 2>/dev/null)

if [ $? -eq 0 ]; then
    echo "Current table counts:"
    echo "$RESULT"
else
    echo "Could not verify table counts."
fi

echo ""
echo "✅ Database clearance completed successfully!"
echo ""
echo "📝 Next steps:"
echo "1. Run the migration script: ./scripts/migrate-backup-data.sh"
echo "2. Verify the migration: node scripts/verify-migration.js"
echo ""
echo "Note: Make sure your backup file db/backupv2.sql is ready for migration."
