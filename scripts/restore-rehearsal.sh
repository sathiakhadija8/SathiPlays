#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="${ENV_FILE:-$ROOT_DIR/.env.production}"
COMPOSE_FILE="${COMPOSE_FILE:-$ROOT_DIR/docker-compose.prod.yml}"
BACKUP_DIR="${BACKUP_DIR:-$ROOT_DIR/backups}"
RESTORE_DB="${RESTORE_DB:-sathiplays_restore_verify}"
KEEP_RESTORE_DB="${KEEP_RESTORE_DB:-0}"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "restore-rehearsal: missing env file: $ENV_FILE"
  exit 1
fi

# Load env file for explicit credentials.
set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

if [[ ! -d "$BACKUP_DIR" ]]; then
  echo "restore-rehearsal: missing backup directory: $BACKUP_DIR"
  exit 1
fi

latest_backup="$(ls -1t "$BACKUP_DIR"/*.sql.gz 2>/dev/null | head -n 1 || true)"
if [[ -z "$latest_backup" ]]; then
  echo "restore-rehearsal: no .sql.gz backup file found in $BACKUP_DIR"
  exit 1
fi

echo "restore-rehearsal: using backup: $latest_backup"

detect_root_password() {
  local candidates=()
  candidates+=("${MYSQL_ROOT_PASSWORD}")
  if [[ -n "${MYSQL_ROOT_PASSWORD_FALLBACK:-}" ]]; then
    candidates+=("${MYSQL_ROOT_PASSWORD_FALLBACK}")
  fi
  # Common legacy local default from docker-compose.yml.
  candidates+=("rootpass")

  local candidate
  for candidate in "${candidates[@]}"; do
    if docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" exec -T mysql sh -lc \
      "mysql -uroot -p\"${candidate}\" -e 'SELECT 1' >/dev/null 2>&1"; then
      echo "$candidate"
      return 0
    fi
  done
  return 1
}

ROOT_PASS="$(detect_root_password || true)"
if [[ -z "$ROOT_PASS" ]]; then
  echo "restore-rehearsal: unable to authenticate as MySQL root."
  echo "restore-rehearsal: set MYSQL_ROOT_PASSWORD correctly for this volume, or set MYSQL_ROOT_PASSWORD_FALLBACK in env."
  exit 1
fi

docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" exec -T mysql sh -lc \
  "mysql -uroot -p\"${ROOT_PASS}\" -e 'DROP DATABASE IF EXISTS ${RESTORE_DB}; CREATE DATABASE ${RESTORE_DB};'"

gzip -dc "$latest_backup" | docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" exec -T mysql sh -lc \
  "mysql -uroot -p\"${ROOT_PASS}\" ${RESTORE_DB}"

required_tables=(
  mood_logs
  events
  routines
  home_routines
  recipes
  vinted_items
  content_items
)

for table_name in "${required_tables[@]}"; do
  exists="$(docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" exec -T mysql sh -lc \
    "mysql -N -uroot -p\"${ROOT_PASS}\" -e \"SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='${RESTORE_DB}' AND table_name='${table_name}'\"")"

  if [[ "${exists}" != "1" ]]; then
    echo "restore-rehearsal: table missing after restore: ${table_name}"
    exit 1
  fi
done

echo "restore-rehearsal: core table validation OK"

if [[ "$KEEP_RESTORE_DB" != "1" ]]; then
  docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" exec -T mysql sh -lc \
    "mysql -uroot -p\"${ROOT_PASS}\" -e 'DROP DATABASE IF EXISTS ${RESTORE_DB};'"
  echo "restore-rehearsal: dropped temporary db ${RESTORE_DB}"
else
  echo "restore-rehearsal: keeping temporary db ${RESTORE_DB} (KEEP_RESTORE_DB=1)"
fi

echo "restore-rehearsal: OK"
