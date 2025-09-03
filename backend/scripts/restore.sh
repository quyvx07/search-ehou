#!/bin/bash

# Database restore script for Search EHOU
# Usage: ./scripts/restore.sh [backup_file] [database_name]

BACKUP_FILE=${1}
DB_NAME=${2:-search_ehou}

if [ -z "$BACKUP_FILE" ]; then
    echo "Usage: $0 <backup_file> [database_name]"
    echo "Example: $0 ./backups/search_ehou_20231201_120000.sql.gz"
    exit 1
fi

# Check if backup file exists
if [ ! -f "$BACKUP_FILE" ]; then
    echo "Backup file not found: $BACKUP_FILE"
    exit 1
fi

# Load environment variables
if [ -f .env ]; then
    export $(cat .env | grep -v '^#' | xargs)
fi

# Database connection parameters
DB_HOST=${DB_HOST:-localhost}
DB_PORT=${DB_PORT:-5432}
DB_USERNAME=${DB_USERNAME:-postgres}
DB_PASSWORD=${DB_PASSWORD:-password}

echo "Starting restore of database: $DB_NAME"
echo "Backup file: $BACKUP_FILE"

# Check if database exists, if not create it
PGPASSWORD="$DB_PASSWORD" psql \
    -h "$DB_HOST" \
    -p "$DB_PORT" \
    -U "$DB_USERNAME" \
    -d postgres \
    -c "SELECT 1 FROM pg_database WHERE datname = '$DB_NAME'" | grep -q 1

if [ $? -ne 0 ]; then
    echo "Creating database: $DB_NAME"
    PGPASSWORD="$DB_PASSWORD" createdb \
        -h "$DB_HOST" \
        -p "$DB_PORT" \
        -U "$DB_USERNAME" \
        "$DB_NAME"
fi

# Restore database
if [[ "$BACKUP_FILE" == *.gz ]]; then
    # Compressed backup
    gunzip -c "$BACKUP_FILE" | PGPASSWORD="$DB_PASSWORD" pg_restore \
        -h "$DB_HOST" \
        -p "$DB_PORT" \
        -U "$DB_USERNAME" \
        -d "$DB_NAME" \
        --verbose \
        --clean \
        --no-owner \
        --no-privileges
else
    # Uncompressed backup
    PGPASSWORD="$DB_PASSWORD" pg_restore \
        -h "$DB_HOST" \
        -p "$DB_PORT" \
        -U "$DB_USERNAME" \
        -d "$DB_NAME" \
        --verbose \
        --clean \
        --no-owner \
        --no-privileges \
        "$BACKUP_FILE"
fi

if [ $? -eq 0 ]; then
    echo "Restore completed successfully!"
else
    echo "Restore failed!"
    exit 1
fi
