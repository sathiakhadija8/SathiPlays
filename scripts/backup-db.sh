#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="$ROOT_DIR/.env.production"
COMPOSE_FILE="$ROOT_DIR/docker-compose.prod.yml"
BACKUP_DIR="$ROOT_DIR/backups"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing $ENV_FILE"
  exit 1
fi

mkdir -p "$BACKUP_DIR"

# Load env file for explicit credentials.
set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

prefix="${BACKUP_FILE_PREFIX:-sathiplays-manual}"
timestamp="$(date -u +%Y%m%d-%H%M%S)"
outfile="$BACKUP_DIR/${prefix}-${timestamp}.sql.gz"

docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" exec -T mysql sh -lc "
  set -e
  mysqldump --single-transaction --quick --skip-lock-tables --no-tablespaces \
    -u\"${MYSQL_USER}\" -p\"${MYSQL_PASSWORD}\" \"${MYSQL_DATABASE}\"
" | gzip > "$outfile"

echo "Backup written: $outfile"
