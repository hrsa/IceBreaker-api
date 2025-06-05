#!/bin/bash

set -e

if [ $# -eq 0 ]; then
    echo "❌ Error: Missing required parameter"
    echo "Usage: $0 <create|cleanup>"
    echo "➡️ create  - Create and upload a new backup"
    echo "➡️ cleanup - Clean up old backups"
    exit 1
fi

OPERATION=$1
if [ "$OPERATION" != "create" ] && [ "$OPERATION" != "cleanup" ]; then
    echo "❌ Error: Invalid parameter '$OPERATION'"
    echo "Usage: $0 <create|cleanup>"
    echo "➡️ create  - Create and upload a new backup"
    echo "➡️ cleanup - Clean up old backups"
    exit 1
fi

API_CONTAINER="icemelter-api"

if [ "$OPERATION" = "create" ]; then

  DB_CONTAINER="icemelter-db"
  BACKUP_DIR="/{{BACKUP_UPLOAD_DIRECTORY}}"
  TIMESTAMP=$(date +%Y%m%d_%H%M%S)
  BACKUP_FILE="backup_${TIMESTAMP}.sql"
  BACKUP_PATH="${BACKUP_DIR}/${BACKUP_FILE}"
  DB_USER="{{DB_USER}}"
  DB_NAME="{{DB_NAME}}"

  echo "📦 Creating database backup..."
  docker exec ${DB_CONTAINER} bash -c "pg_dump -U ${DB_USER} -d ${DB_NAME} > ${BACKUP_PATH}"

  echo "🗜️ Compressing backup..."
  docker exec ${DB_CONTAINER} gzip "${BACKUP_PATH}"

  echo "☁️ Uploading backup via API container..."
  docker exec ${API_CONTAINER} npm run backup:upload

  echo "✅ Backup process completed successfully!"

elif [ "$OPERATION" = "cleanup" ]; then

    echo "🧹 Starting backup cleanup process..."
    docker exec ${API_CONTAINER} npm run backup:cleanup

    echo "✅ Backup cleanup completed successfully!"
fi
