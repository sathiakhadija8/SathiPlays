#!/usr/bin/env bash
set -euo pipefail

BRANCH="${1:-main}"
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

cd "$ROOT_DIR"

if ! command -v git >/dev/null 2>&1; then
  echo "deploy: git is required"
  exit 1
fi

if ! command -v docker >/dev/null 2>&1; then
  echo "deploy: docker is required"
  exit 1
fi

if ! command -v npm >/dev/null 2>&1; then
  echo "deploy: npm is required"
  exit 1
fi

if [[ ! -f ".env.production" ]]; then
  echo "deploy: missing .env.production in $ROOT_DIR"
  exit 1
fi

if [[ ! -f "docker-compose.prod.yml" ]]; then
  echo "deploy: missing docker-compose.prod.yml in $ROOT_DIR"
  exit 1
fi

if [[ -n "$(git status --porcelain)" ]]; then
  echo "deploy: git worktree is dirty. Commit/stash server-side changes first."
  exit 1
fi

echo "deploy: fetching latest branch $BRANCH"
git fetch --prune origin

git checkout "$BRANCH"
git pull --ff-only origin "$BRANCH"

echo "deploy: preflight"
npm run ops:preflight

echo "deploy: backup"
npm run backup:db

echo "deploy: migrations"
npm run db:migrate:prod:up

echo "deploy: compose up"
docker compose --env-file .env.production -f docker-compose.prod.yml up -d --build

echo "deploy: health"
npm run ops:health

echo "deploy: completed"
