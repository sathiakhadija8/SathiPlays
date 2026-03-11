#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="${ENV_FILE:-$ROOT_DIR/.env.production}"
COMPOSE_FILE="${COMPOSE_FILE:-$ROOT_DIR/docker-compose.prod.yml}"

is_ipv4() {
  local value="$1"
  [[ "$value" =~ ^([0-9]{1,3}\.){3}[0-9]{1,3}$ ]]
}

is_local_domain() {
  local value="$1"
  if is_ipv4 "$value"; then
    return 0
  fi
  [[ "$value" == "localhost" || "$value" == *.local || "$value" == *.sslip.io || "$value" == *.nip.io ]]
}

required_cmds=(docker)
for cmd in "${required_cmds[@]}"; do
  if ! command -v "$cmd" >/dev/null 2>&1; then
    echo "preflight: missing required command: $cmd"
    exit 1
  fi
done

if ! docker compose version >/dev/null 2>&1; then
  echo "preflight: docker compose plugin is not available"
  exit 1
fi

if [[ ! -f "$ENV_FILE" ]]; then
  echo "preflight: missing env file: $ENV_FILE"
  exit 1
fi

if [[ ! -f "$COMPOSE_FILE" ]]; then
  echo "preflight: missing compose file: $COMPOSE_FILE"
  exit 1
fi

required_vars=(
  DOMAIN
  MYSQL_ROOT_PASSWORD
  MYSQL_DATABASE
  MYSQL_USER
  MYSQL_PASSWORD
  APP_PIN
  PIN_AUTH_SECRET
)

# Load env file in shell-safe way.
set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

missing=0
for key in "${required_vars[@]}"; do
  value="${!key:-}"
  if [[ -z "$value" ]]; then
    echo "preflight: missing required env var: $key"
    missing=1
  fi
done

if [[ "$missing" -ne 0 ]]; then
  exit 1
fi

if [[ "${MYSQL_PASSWORD:-}" == "change_app_db_password" ]]; then
  echo "preflight: MYSQL_PASSWORD still uses example placeholder"
  exit 1
fi

if [[ "${MYSQL_ROOT_PASSWORD:-}" == "change_root_password" ]]; then
  echo "preflight: MYSQL_ROOT_PASSWORD still uses example placeholder"
  exit 1
fi

if [[ "${PIN_AUTH_SECRET:-}" == "change_long_random_secret" ]]; then
  echo "preflight: PIN_AUTH_SECRET still uses example placeholder"
  exit 1
fi

if [[ "${PIN_COOKIE_SECURE:-true}" != "true" ]]; then
  echo "preflight: warning PIN_COOKIE_SECURE is not true (expected true in HTTPS production)"
fi

if is_local_domain "${DOMAIN:-}"; then
  echo "preflight: warning DOMAIN (${DOMAIN}) looks local/IP; HTTPS/TLS checks and secure-cookie behavior are for real DNS production domains"
fi

if [[ "${BACKUP_RETENTION_DAYS:-30}" -lt 30 ]]; then
  echo "preflight: warning BACKUP_RETENTION_DAYS is below 30"
fi

if ! docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" config -q; then
  echo "preflight: docker compose config validation failed"
  exit 1
fi

echo "preflight: OK"
