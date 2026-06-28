#!/usr/bin/env bash
# InsightFlow — PostgreSQL backup script.
# Dumps the database, compresses it, and removes backups older than 7 days.
# Designed to be run by cron — safe to call manually too.
#
# Usage:
#   ./backup.sh               — run a backup now
#   ./backup.sh --restore     — list available backups
set -euo pipefail

# ── Config ────────────────────────────────────────────────────────────────────
BACKUP_DIR="/opt/insightflow/backups"
KEEP_DAYS=7
COMPOSE_FILE="$(cd "$(dirname "$0")" && pwd)/docker-compose.yml"

# Read DB credentials from .env next to this script
ENV_FILE="$(cd "$(dirname "$0")" && pwd)/.env"
if [ ! -f "$ENV_FILE" ]; then
    echo "ERROR: .env file not found at $ENV_FILE" >&2
    exit 1
fi

# Source only the DB variables we need (ignore everything else)
DB_NAME=$(grep -E '^DB_NAME=' "$ENV_FILE" | cut -d= -f2 | tr -d '"'"'" | tr -d '[:space:]')
DB_USER=$(grep -E '^DB_USER=' "$ENV_FILE" | cut -d= -f2 | tr -d '"'"'" | tr -d '[:space:]')

DB_NAME="${DB_NAME:-surveydb}"
DB_USER="${DB_USER:-surveyuser}"

# ── List mode ─────────────────────────────────────────────────────────────────
if [ "${1:-}" = "--restore" ]; then
    echo "Available backups in $BACKUP_DIR:"
    echo ""
    ls -lh "$BACKUP_DIR"/*.sql.gz 2>/dev/null || echo "  No backups found."
    echo ""
    echo "To restore a backup:"
    echo "  gunzip -c $BACKUP_DIR/<filename>.sql.gz | docker exec -i \$(docker compose -f $COMPOSE_FILE ps -q db) psql -U $DB_USER $DB_NAME"
    exit 0
fi

# ── Backup ────────────────────────────────────────────────────────────────────
mkdir -p "$BACKUP_DIR"

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
OUTPUT_FILE="$BACKUP_DIR/insightflow_${TIMESTAMP}.sql.gz"
TEMP_FILE="${OUTPUT_FILE}.tmp"

echo "[$(date '+%Y-%m-%d %H:%M:%S')] Starting backup → $OUTPUT_FILE"

# Check the db container is running
DB_CONTAINER=$(docker compose -f "$COMPOSE_FILE" ps -q db 2>/dev/null || true)
if [ -z "$DB_CONTAINER" ]; then
    echo "ERROR: db container is not running. Start the app first with ./deploy.sh" >&2
    exit 1
fi

# Dump and compress — write to temp file first so a partial dump is never kept
docker exec "$DB_CONTAINER" \
    pg_dump -U "$DB_USER" "$DB_NAME" | gzip > "$TEMP_FILE"

mv "$TEMP_FILE" "$OUTPUT_FILE"

SIZE=$(du -sh "$OUTPUT_FILE" | cut -f1)
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Backup complete — $SIZE"

# ── Cleanup old backups ───────────────────────────────────────────────────────
DELETED=$(find "$BACKUP_DIR" -name "insightflow_*.sql.gz" -mtime +"$KEEP_DAYS" -print -delete | wc -l)
if [ "$DELETED" -gt 0 ]; then
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] Removed $DELETED backup(s) older than $KEEP_DAYS days"
fi

echo "[$(date '+%Y-%m-%d %H:%M:%S')] Done. Backups stored in $BACKUP_DIR"
