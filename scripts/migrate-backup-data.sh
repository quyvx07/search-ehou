#!/bin/bash

# Script to migrate backup data to current database schema
# Usage: ./migrate-backup-data.sh [environment]

set -e

ENVIRONMENT=${1:-development}
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

echo "Starting backup data migration..."
echo "Environment: $ENVIRONMENT"
echo "Project root: $PROJECT_ROOT"

# Check if backup file exists
BACKUP_FILE="$PROJECT_ROOT/db/backupv2.sql"
if [ ! -f "$BACKUP_FILE" ]; then
    echo "Error: Backup file not found at $BACKUP_FILE"
    exit 1
fi

echo "Found backup file: $BACKUP_FILE"

# Change to project root
cd "$PROJECT_ROOT"

# Navigate to backend directory
cd backend

# Check if package.json exists
if [ ! -f "package.json" ]; then
    echo "Error: package.json not found in backend directory"
    exit 1
fi

# Install dependencies if node_modules doesn't exist
if [ ! -d "node_modules" ]; then
    echo "Installing dependencies..."
    npm install
fi

# Create environment file if it doesn't exist
if [ ! -f ".env" ]; then
    echo "Warning: .env file not found. Please ensure database connection is configured."
fi

echo "Step 1: Restoring backup data to database..."
echo "Please make sure your database is running and accessible."
echo "You may need to run this command manually if you have custom database setup:"
echo "psql -h [host] -U [user] -d [database] -f $BACKUP_FILE"

read -p "Do you want to proceed with database restoration? (y/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Skipping database restoration. Please restore the backup manually first."
else
    # Note: This assumes PostgreSQL is running locally with default settings
    # You may need to adjust these parameters for your setup
    DB_HOST=${DB_HOST:-localhost}
    DB_PORT=${DB_PORT:-5432}
    DB_NAME=${DB_NAME:-search_ehou}
    DB_USER=${DB_USER:-postgres}

    echo "Restoring backup to database..."
    PGPASSWORD=${DB_PASSWORD:-} psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -f "$BACKUP_FILE"

    if [ $? -eq 0 ]; then
        echo "Backup restoration completed successfully."
    else
        echo "Error: Failed to restore backup. Please check your database connection and try again."
        exit 1
    fi
fi

echo ""
echo "Step 2: Running TypeORM migration..."

# Check if TypeORM CLI is available
if ! npm list @nestjs/cli > /dev/null 2>&1; then
    echo "Installing @nestjs/cli..."
    npm install --save-dev @nestjs/cli
fi

# Run the specific migration
echo "Running migration: MigrateBackupData1700000000004"
npx typeorm migration:run --config dist/config/database.config.js

if [ $? -eq 0 ]; then
    echo "Migration completed successfully!"
else
    echo "Error: Migration failed. Please check the logs above."
    exit 1
fi

echo ""
echo "Step 3: Verifying migrated data..."

# Check if we can run a simple query to verify data
if command -v psql > /dev/null 2>&1; then
    echo "Checking migrated data counts..."
    PGPASSWORD=${DB_PASSWORD:-} psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c "
        SELECT
            (SELECT COUNT(*) FROM courses) as courses_count,
            (SELECT COUNT(*) FROM questions) as questions_count,
            (SELECT COUNT(*) FROM subjects) as subjects_count,
            (SELECT COUNT(*) FROM question_choices) as choices_count,
            (SELECT COUNT(*) FROM correct_answers) as answers_count;
    " 2>/dev/null || echo "Could not verify data counts. Please check manually."
else
    echo "psql not found. Skipping data verification."
fi

echo ""
echo "Migration completed successfully!"
echo ""
echo "Next steps:"
echo "1. Review the migrated data in your application"
echo "2. Check for any missing images or attachments that need manual migration"
echo "3. Test your application functionality with the new data structure"
echo "4. Consider running data protection features if needed"
echo ""
echo "Note: If you encounter any issues, you can rollback using:"
echo "npx typeorm migration:revert --config dist/config/database.config.js"
