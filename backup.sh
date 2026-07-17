#!/usr/bin/env bash
# InsightFlow full backup and recovery manager for Linux customer servers.
set -Eeuo pipefail
umask 077

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="${ENV_FILE:-$SCRIPT_DIR/.env}"
BACKUP_DIR="${BACKUP_DIR:-/opt/InsightFlow/backups}"
KEEP_DAYS="${BACKUP_KEEP_DAYS:-30}"
LOCK_FILE="${BACKUP_LOCK_FILE:-/tmp/InsightFlow-backup.lock}"

if [ -n "${COMPOSE_FILE:-}" ]; then
    COMPOSE_PATH="$COMPOSE_FILE"
elif [ -f "$SCRIPT_DIR/docker-compose.customer.yml" ] && \
     grep -qE '^INSIGHTFLOW_BACKEND_IMAGE=.+$' "$ENV_FILE" 2>/dev/null; then
    COMPOSE_PATH="$SCRIPT_DIR/docker-compose.customer.yml"
else
    COMPOSE_PATH="$SCRIPT_DIR/docker-compose.yml"
fi

usage() {
    cat <<'EOF'
Usage:
  ./backup.sh backup                 Create a full backup (default command)
  ./backup.sh list                   List available backups
  ./backup.sh verify [FILE|latest]   Verify archive integrity
  ./backup.sh restore FILE|latest    Restore database and media (interactive)
  ./backup.sh restore FILE|latest --yes
  ./backup.sh install-cron           Install the daily backup schedule
  ./backup.sh remove-cron            Remove the daily backup schedule

Optional environment variables:
  BACKUP_DIR=/opt/InsightFlow/backups
  BACKUP_KEEP_DAYS=30
  BACKUP_CRON_SCHEDULE="0 2 * * *"
  COMPOSE_FILE=/opt/InsightFlow/docker-compose.customer.yml
EOF
}

die() { echo "ERROR: $*" >&2; exit 1; }
log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*"; }
require_command() { command -v "$1" >/dev/null 2>&1 || die "Required command not found: $1"; }

read_env_value() {
    local key="$1" value
    value="$(sed -n "s/^${key}=//p" "$ENV_FILE" | tail -n 1)"
    value="${value%$'\r'}"
    if [[ "$value" == \"*\" ]]; then value="${value:1:${#value}-2}"; fi
    if [[ "$value" == \'*\' ]]; then value="${value:1:${#value}-2}"; fi
    printf '%s' "$value"
}

load_config() {
    [ -f "$ENV_FILE" ] || die ".env file not found: $ENV_FILE"
    [ -f "$COMPOSE_PATH" ] || die "Compose file not found: $COMPOSE_PATH"
    DB_NAME="$(read_env_value DB_NAME)"
    DB_USER="$(read_env_value DB_USER)"
    DB_NAME="${DB_NAME:-surveydb}"
    DB_USER="${DB_USER:-surveyuser}"
}

compose() { docker compose --env-file "$ENV_FILE" -f "$COMPOSE_PATH" "$@"; }
container_id() { compose ps -q "$1" 2>/dev/null; }

resolve_archive() {
    local requested="${1:-latest}"
    if [ "$requested" = "latest" ]; then
        find "$BACKUP_DIR" -maxdepth 1 -type f -name 'InsightFlow_full_*.tar.gz' -printf '%T@ %p\n' 2>/dev/null \
            | sort -nr | head -n 1 | cut -d' ' -f2-
    elif [ -f "$requested" ]; then
        printf '%s\n' "$requested"
    elif [ -f "$BACKUP_DIR/$requested" ]; then
        printf '%s\n' "$BACKUP_DIR/$requested"
    fi
}

verify_archive() {
    local archive temp_dir
    archive="$(resolve_archive "${1:-latest}")"
    [ -n "$archive" ] && [ -f "$archive" ] || die "Backup not found: ${1:-latest}"
    require_command tar
    require_command sha256sum
    gzip -t "$archive" || die "Compressed archive is damaged: $archive"
    temp_dir="$(mktemp -d)"
    tar -xzf "$archive" -C "$temp_dir"
    [ -f "$temp_dir/SHA256SUMS" ] || { rm -rf "$temp_dir"; die "SHA256SUMS is missing"; }
    (cd "$temp_dir" && sha256sum -c SHA256SUMS) || { rm -rf "$temp_dir"; die "Checksum verification failed"; }
    [ -s "$temp_dir/database.dump" ] || { rm -rf "$temp_dir"; die "Database dump is empty"; }
    tar -tzf "$temp_dir/media.tar.gz" >/dev/null || { rm -rf "$temp_dir"; die "Media archive is damaged"; }
    rm -rf "$temp_dir"
    log "Backup verified successfully: $archive"
}

create_backup() {
    require_command docker; require_command tar; require_command gzip
    require_command sha256sum; require_command flock
    load_config
    mkdir -p "$BACKUP_DIR"; chmod 700 "$BACKUP_DIR"
    exec 9>"$LOCK_FILE"
    flock -n 9 || die "Another backup or restore operation is running"

    local timestamp work_dir archive temp_archive db_container backend_container deleted size
    timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
    work_dir="$(mktemp -d "$BACKUP_DIR/.InsightFlow_${timestamp}.XXXXXX")"
    archive="$BACKUP_DIR/InsightFlow_full_${timestamp}.tar.gz"
    temp_archive="$archive.tmp"
    trap 'rm -rf "$work_dir" "$temp_archive"' EXIT
    db_container="$(container_id db)"; backend_container="$(container_id backend)"
    [ -n "$db_container" ] || die "Database container is not running"
    [ -n "$backend_container" ] || die "Backend container is not running"

    log "Creating PostgreSQL dump"
    docker exec "$db_container" pg_dump --username "$DB_USER" --format=custom --compress=6 \
        --no-owner --no-privileges --dbname "$DB_NAME" > "$work_dir/database.dump"
    [ -s "$work_dir/database.dump" ] || die "Database dump is empty"

    log "Archiving uploaded media"
    docker exec "$backend_container" tar -C /app -czf - media > "$work_dir/media.tar.gz"
    tar -tzf "$work_dir/media.tar.gz" >/dev/null

    log "Archiving deployment configuration"
    tar -C "$SCRIPT_DIR" -czf "$work_dir/config.tar.gz" --ignore-failed-read \
        .env docker-compose.yml docker-compose.customer.yml nginx ssl deploy.sh backup.sh 2>/dev/null

    cat > "$work_dir/manifest.txt" <<EOF
application=InsightFlow
format_version=1
created_utc=$timestamp
hostname=$(hostname)
database=$DB_NAME
database_user=$DB_USER
compose_file=$(basename "$COMPOSE_PATH")
includes=database,media,deployment_configuration
EOF
    (cd "$work_dir" && sha256sum database.dump media.tar.gz config.tar.gz manifest.txt > SHA256SUMS)
    tar -C "$work_dir" -czf "$temp_archive" database.dump media.tar.gz config.tar.gz manifest.txt SHA256SUMS
    mv "$temp_archive" "$archive"; chmod 600 "$archive"
    verify_archive "$archive"
    deleted="$(find "$BACKUP_DIR" -maxdepth 1 -type f -name 'InsightFlow_full_*.tar.gz' -mtime "+$KEEP_DAYS" -print -delete | wc -l)"
    size="$(du -h "$archive" | cut -f1)"
    log "Full backup complete: $archive ($size)"
    log "Removed $deleted backup(s) older than $KEEP_DAYS days"
    trap - EXIT; rm -rf "$work_dir"
}

restore_backup() {
    require_command docker; require_command tar; require_command sha256sum; require_command flock
    load_config
    local archive confirmation="${2:-}" work_dir db_container backend_container
    archive="$(resolve_archive "${1:-}")"
    [ -n "$archive" ] && [ -f "$archive" ] || die "Backup not found: ${1:-}"
    verify_archive "$archive"
    if [ "$confirmation" != "--yes" ]; then
        echo "This will replace the current database and uploaded media with: $archive"
        read -r -p "Type RESTORE to continue: " answer
        [ "$answer" = "RESTORE" ] || die "Restore cancelled"
    fi
    exec 9>"$LOCK_FILE"; flock -n 9 || die "Another backup or restore operation is running"
    work_dir="$(mktemp -d)"; trap 'rm -rf "$work_dir"' EXIT
    tar -xzf "$archive" -C "$work_dir"

    log "Stopping application services during restore"
    compose stop nginx frontend backend
    compose up -d db
    db_container="$(container_id db)"; [ -n "$db_container" ] || die "Database container did not start"
    local attempt
    for attempt in $(seq 1 30); do
        if docker exec "$db_container" pg_isready --username "$DB_USER" --dbname "$DB_NAME" >/dev/null 2>&1; then
            break
        fi
        [ "$attempt" -lt 30 ] || die "Database did not become ready"
        sleep 2
    done
    log "Replacing PostgreSQL database"
    docker exec "$db_container" dropdb --username "$DB_USER" --maintenance-db=postgres --if-exists --force "$DB_NAME"
    docker exec "$db_container" createdb --username "$DB_USER" --maintenance-db=postgres "$DB_NAME"
    docker exec -i "$db_container" pg_restore --username "$DB_USER" --dbname "$DB_NAME" \
        --no-owner --no-privileges --exit-on-error < "$work_dir/database.dump"

    log "Replacing uploaded media"
    compose up -d backend
    backend_container="$(container_id backend)"; [ -n "$backend_container" ] || die "Backend container did not start"
    docker exec "$backend_container" sh -c 'rm -rf /app/media/* /app/media/.[!.]* /app/media/..?* 2>/dev/null || true'
    docker exec -i "$backend_container" tar -C /app -xzf - < "$work_dir/media.tar.gz"
    log "Starting all services"
    compose up -d
    log "Restore completed. Current deployment configuration was preserved."
    log "Backed-up configuration remains available inside config.tar.gz for disaster recovery."
    trap - EXIT; rm -rf "$work_dir"
}

list_backups() {
    mkdir -p "$BACKUP_DIR"
    echo "Backups in $BACKUP_DIR:"
    find "$BACKUP_DIR" -maxdepth 1 -type f -name 'InsightFlow_full_*.tar.gz' \
        -printf '%TY-%Tm-%Td %TH:%TM  %10s bytes  %f\n' 2>/dev/null | sort -r
}

install_cron() {
    require_command crontab
    local schedule="${BACKUP_CRON_SCHEDULE:-0 2 * * *}" marker="# InsightFlow automated full backup"
    local job="$schedule BACKUP_DIR='$BACKUP_DIR' BACKUP_KEEP_DAYS='$KEEP_DAYS' COMPOSE_FILE='$COMPOSE_PATH' '$SCRIPT_DIR/backup.sh' backup >> '$BACKUP_DIR/backup.log' 2>&1"
    mkdir -p "$BACKUP_DIR"; chmod 700 "$BACKUP_DIR"
    (crontab -l 2>/dev/null | grep -vF "$marker" | grep -vF "$SCRIPT_DIR/backup.sh" || true; echo "$marker"; echo "$job") | crontab -
    log "Installed daily backup schedule: $schedule"
}

remove_cron() {
    require_command crontab
    (crontab -l 2>/dev/null | grep -vF "# InsightFlow automated full backup" | grep -vF "$SCRIPT_DIR/backup.sh" || true) | crontab -
    log "Removed InsightFlow backup schedule"
}

case "${1:-backup}" in
    backup) create_backup ;;
    list|--list) list_backups ;;
    verify) verify_archive "${2:-latest}" ;;
    restore|--restore) restore_backup "${2:-}" "${3:-}" ;;
    install-cron) load_config; install_cron ;;
    remove-cron) remove_cron ;;
    help|-h|--help) usage ;;
    *) usage; die "Unknown command: ${1:-}" ;;
esac
