#!/usr/bin/env bash

set -euo pipefail

APP_DIR="/var/www"
LOG_FILE="/var/log/icemelter-certbot-renew.log"

cd "$APP_DIR"

echo "[$(date --iso-8601=seconds)] Starting SSL renewal check..." >> "$LOG_FILE"

docker compose run --rm certbot renew \
  --webroot \
  -w /tmp/letsencrypt \
  --quiet >> "$LOG_FILE" 2>&1

echo "[$(date --iso-8601=seconds)] Reloading nginx..." >> "$LOG_FILE"

if docker compose ps nginx | grep -q "Up"; then
  docker compose exec -T nginx nginx -s reload >> "$LOG_FILE" 2>&1 || docker compose restart nginx >> "$LOG_FILE" 2>&1
else
  docker compose up -d nginx >> "$LOG_FILE" 2>&1
fi

echo "[$(date --iso-8601=seconds)] SSL renewal check finished." >> "$LOG_FILE"