#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="${ENV_FILE:-$ROOT_DIR/.env.production}"
COMPOSE_FILE="${COMPOSE_FILE:-$ROOT_DIR/docker-compose.prod.yml}"
MIGRATIONS_DIR="${MIGRATIONS_DIR:-$ROOT_DIR/db/migrations}"
COMMAND="${1:-status}"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "db-migrate-prod: missing env file: $ENV_FILE"
  exit 1
fi

if [[ ! -d "$MIGRATIONS_DIR" ]]; then
  echo "db-migrate-prod: missing migrations directory: $MIGRATIONS_DIR"
  exit 1
fi

set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

: "${MYSQL_USER:?MYSQL_USER is required}"
: "${MYSQL_PASSWORD:?MYSQL_PASSWORD is required}"
: "${MYSQL_DATABASE:?MYSQL_DATABASE is required}"

mysql_exec_raw() {
  docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" exec -T mysql sh -lc \
    "mysql -u\"${MYSQL_USER}\" -p\"${MYSQL_PASSWORD}\" \"${MYSQL_DATABASE}\" -N"
}

mysql_exec() {
  local sql="$1"
  printf '%s\n' "$sql" | mysql_exec_raw
}

ensure_table() {
  mysql_exec "CREATE TABLE IF NOT EXISTS schema_migrations (id INT AUTO_INCREMENT PRIMARY KEY, filename VARCHAR(255) NOT NULL UNIQUE, checksum CHAR(64) NOT NULL, applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;"
}

list_files() {
  find "$MIGRATIONS_DIR" -maxdepth 1 -type f -name '*.sql' | sort
}

checksum_file() {
  shasum -a 256 "$1" | awk '{print $1}'
}

sql_escape() {
  printf "%s" "$1" | sed "s/'/''/g"
}

get_applied_checksum() {
  local name="$1"
  local escaped_name
  escaped_name="$(sql_escape "$name")"
  mysql_exec "SELECT checksum FROM schema_migrations WHERE filename='${escaped_name}' LIMIT 1;"
}

verify_applied_checksum_or_fail() {
  local name="$1"
  local file="$2"
  local expected actual
  expected="$(checksum_file "$file")"
  actual="$(get_applied_checksum "$name")"

  if [[ -n "$actual" && "$actual" != "$expected" ]]; then
    echo "db-migrate-prod: checksum mismatch for applied migration: $name"
    exit 1
  fi
}

status() {
  ensure_table

  local total=0
  local pending=0
  local file name actual_checksum

  while IFS= read -r file; do
    total=$((total + 1))
    name="$(basename "$file")"
    actual_checksum="$(get_applied_checksum "$name")"
    if [[ -z "$actual_checksum" ]]; then
      pending=$((pending + 1))
    else
      verify_applied_checksum_or_fail "$name" "$file"
    fi
  done < <(list_files)

  local applied
  applied="$(mysql_exec "SELECT COUNT(*) FROM schema_migrations")"

  echo "Migrations dir: $MIGRATIONS_DIR"
  echo "Total files: $total"
  echo "Applied: $applied"
  echo "Pending: $pending"

  if [[ "$pending" -gt 0 ]]; then
    echo "Pending migrations:"
    while IFS= read -r file; do
      name="$(basename "$file")"
      if [[ -z "$(get_applied_checksum "$name")" ]]; then
        echo "- $name"
      fi
    done < <(list_files)
  fi
}

up() {
  ensure_table

  local applied_now=0
  local file name checksum applied_checksum escaped_name escaped_checksum

  while IFS= read -r file; do
    name="$(basename "$file")"
    applied_checksum="$(get_applied_checksum "$name")"

    if [[ -n "$applied_checksum" ]]; then
      verify_applied_checksum_or_fail "$name" "$file"
      continue
    fi

    checksum="$(checksum_file "$file")"
    escaped_name="$(sql_escape "$name")"
    escaped_checksum="$(sql_escape "$checksum")"
    echo "Applying $name ..."

    {
      printf 'START TRANSACTION;\n'
      cat "$file"
      printf '\nINSERT INTO schema_migrations (filename, checksum) VALUES ('
      printf "'%s', '%s'" "$escaped_name" "$escaped_checksum"
      printf ');\nCOMMIT;\n'
    } | mysql_exec_raw

    applied_now=$((applied_now + 1))
  done < <(list_files)

  echo "Applied ${applied_now} migration(s)."
}

case "$COMMAND" in
  status)
    status
    ;;
  up)
    up
    ;;
  *)
    echo "Usage: bash scripts/db-migrate-prod.sh [status|up]"
    exit 1
    ;;
esac
