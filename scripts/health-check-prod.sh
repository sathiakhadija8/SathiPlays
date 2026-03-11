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

if [[ ! -f "$ENV_FILE" ]]; then
  echo "health: missing env file: $ENV_FILE"
  exit 1
fi

# Load env file.
set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

echo "health: docker services"
docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" ps

if [[ -n "${DOMAIN:-}" ]]; then
  if is_local_domain "${DOMAIN}"; then
    echo "health: DOMAIN looks local/IP (${DOMAIN}); skipping HTTPS validation and checking HTTP only"
    http_url="http://${DOMAIN}/api/health"
    if curl --max-time 12 -fsS "$http_url" >/tmp/sathiplays-health.json; then
      echo "health: remote HTTP api/health OK"
      cat /tmp/sathiplays-health.json
      echo
      echo "health: warning HTTPS is not validated for local/IP domain. Use a real DNS domain for production TLS."
    else
      echo "health: remote HTTP api/health failed for local/IP domain"
    fi
  else
    url="https://${DOMAIN}/api/health"
    echo "health: checking $url"
    if curl --max-time 12 -fsS "$url" >/tmp/sathiplays-health.json; then
      echo "health: remote HTTPS api/health OK"
      cat /tmp/sathiplays-health.json
      echo
    else
      echo "health: remote HTTPS check failed, trying HTTP fallback"
      http_url="http://${DOMAIN}/api/health"
      if curl --max-time 12 -fsS "$http_url" >/tmp/sathiplays-health.json; then
        echo "health: remote HTTP api/health OK"
        cat /tmp/sathiplays-health.json
        echo
      else
        echo "health: remote api/health failed on both HTTPS and HTTP"
      fi
    fi
  fi
else
  echo "health: DOMAIN is empty, skipping remote HTTPS check"
fi

echo "health: checking internal app service"
if docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" exec -T app wget -qO - http://127.0.0.1:3000/api/health >/tmp/sathiplays-health-internal.json; then
  echo "health: internal api/health OK"
  cat /tmp/sathiplays-health-internal.json
  echo
else
  echo "health: internal api/health failed"
  exit 1
fi

echo "health: OK"
