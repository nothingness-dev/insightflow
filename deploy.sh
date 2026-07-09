#!/usr/bin/env bash
# InsightFlow one-command deploy for Linux.
# Usage: ./deploy.sh
set -euo pipefail

echo "==> Building and starting containers..."
docker compose up -d --build

echo "==> Waiting for backend to become healthy..."
ATTEMPTS=0
MAX_ATTEMPTS=30
until [ "$(docker inspect --format='{{.State.Health.Status}}' \
           "$(docker compose ps -q backend)" 2>/dev/null)" = "healthy" ]; do
    ATTEMPTS=$((ATTEMPTS + 1))
    if [ "$ATTEMPTS" -ge "$MAX_ATTEMPTS" ]; then
        echo ""
        echo "ERROR: backend did not become healthy after $((MAX_ATTEMPTS * 5))s."
        echo "Check logs with:  docker compose logs backend --tail=40"
        exit 1
    fi
    printf "   attempt %d/%d; sleeping 5s...\n" "$ATTEMPTS" "$MAX_ATTEMPTS"
    sleep 5
done

echo "   Backend is healthy."

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
BACKUP_SCRIPT="$SCRIPT_DIR/backup.sh"
CRON_JOB="0 2 * * * $BACKUP_SCRIPT >> /var/log/InsightFlow_backup.log 2>&1"

chmod +x "$BACKUP_SCRIPT"

# Add the cron job only if it isn't already there
if ! crontab -l 2>/dev/null | grep -qF "$BACKUP_SCRIPT"; then
    (crontab -l 2>/dev/null; echo "$CRON_JOB") | crontab -
    echo "==> Backup cron job installed (runs daily at 02:00)"
else
    echo "==> Backup cron job already installed"
fi

mkdir -p /opt/InsightFlow/backups

echo ""
echo "============================================================"
echo " InsightFlow is running!"
echo " Open:  http://$(hostname -I | awk '{print $1}')"
echo " Admin: use the credentials from your .env file"
echo ""
echo " Backups: daily at 02:00 -> /opt/InsightFlow/backups/"
echo "   Run now:     ./backup.sh"
echo "   List/restore: ./backup.sh --restore"
echo "============================================================"
