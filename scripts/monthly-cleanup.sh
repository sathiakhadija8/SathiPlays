#!/usr/bin/env sh
set -eu

MYSQL_HOST="${MYSQL_HOST:-mysql}"
MYSQL_PORT="${MYSQL_PORT:-3306}"
MYSQL_USER="${MYSQL_USER:-root}"
MYSQL_PASSWORD="${MYSQL_PASSWORD:-}"
MYSQL_DATABASE="${MYSQL_DATABASE:-sathiplays}"
CLEANUP_INTERVAL_SECONDS="${CLEANUP_INTERVAL_SECONDS:-2592000}"
CLEANUP_RETENTION_DAYS="${CLEANUP_RETENTION_DAYS:-30}"

mysql_exec() {
  MYSQL_PWD="${MYSQL_PASSWORD}" mysql \
    -h"${MYSQL_HOST}" \
    -P"${MYSQL_PORT}" \
    -u"${MYSQL_USER}" \
    "${MYSQL_DATABASE}" \
    -Nse "$1"
}

table_exists() {
  mysql_exec "
    SELECT COUNT(*)
    FROM information_schema.tables
    WHERE table_schema = DATABASE()
      AND table_name = '$1'
  "
}

run_if_table_exists() {
  table_name="$1"
  query="$2"
  if [ "$(table_exists "${table_name}")" -gt 0 ]; then
    mysql_exec "${query}"
  fi
}

echo "db-cleanup: starting (interval=${CLEANUP_INTERVAL_SECONDS}s, retention=${CLEANUP_RETENTION_DAYS}d)"

while true; do
  echo "db-cleanup: run started at $(date -u '+%Y-%m-%dT%H:%M:%SZ')"

  # Events cleanup: remove events whose date has passed.
  run_if_table_exists "events" "
    DELETE FROM events
    WHERE COALESCE(end_at, start_at) < CURDATE()
  "

  # Supplement + drinks logs cleanup.
  run_if_table_exists "supplement_logs" "
    DELETE FROM supplement_logs
    WHERE log_date < DATE_SUB(CURDATE(), INTERVAL ${CLEANUP_RETENTION_DAYS} DAY)
  "
  run_if_table_exists "drink_logs" "
    DELETE FROM drink_logs
    WHERE log_date < DATE_SUB(CURDATE(), INTERVAL ${CLEANUP_RETENTION_DAYS} DAY)
  "
  run_if_table_exists "drinks_logs" "
    DELETE FROM drinks_logs
    WHERE log_date < DATE_SUB(CURDATE(), INTERVAL ${CLEANUP_RETENTION_DAYS} DAY)
  "
  run_if_table_exists "tea_logs" "
    DELETE FROM tea_logs
    WHERE DATE(logged_at) < DATE_SUB(CURDATE(), INTERVAL ${CLEANUP_RETENTION_DAYS} DAY)
  "
  run_if_table_exists "seed_water_logs" "
    DELETE FROM seed_water_logs
    WHERE log_date < DATE_SUB(CURDATE(), INTERVAL ${CLEANUP_RETENTION_DAYS} DAY)
  "
  run_if_table_exists "beauty_drink_daily" "
    DELETE FROM beauty_drink_daily
    WHERE log_date < DATE_SUB(CURDATE(), INTERVAL ${CLEANUP_RETENTION_DAYS} DAY)
  "

  # Routine/home/plants monthly cleanup (logs/completions only).
  run_if_table_exists "routine_completions" "
    DELETE FROM routine_completions
    WHERE completed_date < DATE_SUB(CURDATE(), INTERVAL ${CLEANUP_RETENTION_DAYS} DAY)
  "
  run_if_table_exists "home_task_completions" "
    DELETE FROM home_task_completions
    WHERE completion_date < DATE_SUB(CURDATE(), INTERVAL ${CLEANUP_RETENTION_DAYS} DAY)
  "
  run_if_table_exists "plant_logs" "
    DELETE FROM plant_logs
    WHERE watered_at < DATE_SUB(NOW(), INTERVAL ${CLEANUP_RETENTION_DAYS} DAY)
  "

  # Timeline task cleanup for completed/past tasks.
  run_if_table_exists "timeline_tasks" "
    DELETE FROM timeline_tasks
    WHERE task_date < DATE_SUB(CURDATE(), INTERVAL ${CLEANUP_RETENTION_DAYS} DAY)
  "

  echo "db-cleanup: run completed at $(date -u '+%Y-%m-%dT%H:%M:%SZ')"
  sleep "${CLEANUP_INTERVAL_SECONDS}"
done
