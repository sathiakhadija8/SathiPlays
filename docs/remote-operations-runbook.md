# SathiPlays Remote Operations Runbook

## Purpose
Operate SathiPlays in a remote-first way with predictable deployment, backups, and recovery.

## Preconditions
- Linux VPS or cloud VM.
- Docker + Docker Compose plugin installed.
- Domain DNS pointed to server.
- `.env.production` created from `.env.production.example`.

## Required Production Settings
- Strong values for:
  - `MYSQL_ROOT_PASSWORD`
  - `MYSQL_PASSWORD`
  - `APP_PIN`
  - `PIN_AUTH_SECRET`
- Keep `PIN_COOKIE_SECURE=true` for production HTTPS.
- Use real domain in `DOMAIN`.

## First-Time Bootstrap
1. Copy repo to server.
2. Create env file:
```bash
cp .env.production.example .env.production
```
3. Validate config:
```bash
npm run ops:preflight
```
4. Start stack:
```bash
docker compose --env-file .env.production -f docker-compose.prod.yml up -d --build
```
5. Check health:
```bash
npm run ops:health
```

## Standard Release Procedure
1. Pull latest code:
```bash
git pull
```
2. Run preflight:
```bash
npm run ops:preflight
```
3. Take manual backup:
```bash
npm run backup:db
```
4. Apply DB migrations:
```bash
npm run db:migrate:prod:up
```
5. Deploy:
```bash
docker compose --env-file .env.production -f docker-compose.prod.yml up -d --build
```
6. Post-deploy checks:
```bash
npm run ops:health
```

## Backup and Retention
- Automated backup service runs in `docker-compose.prod.yml`.
- Manual backup command:
```bash
npm run backup:db
```
- Keep backup directory under host path `./backups`.
- Add offsite sync (recommended) to object storage.

## Monthly Restore Drill
Use restore rehearsal command to verify backups are valid:
```bash
npm run ops:restore:rehearsal
```

This command:
- Picks latest `.sql.gz` backup.
- Restores into temporary DB `sathiplays_restore_verify`.
- Validates expected tables exist.
- Drops the temporary DB when done.

Keep evidence of each drill (date, backup file, result).

## Incident Recovery (Database)
1. Stop writes if possible (maintenance mode or short downtime).
2. Create fresh backup of current state (if DB still accessible).
3. Select backup file to restore.
4. Restore into a new DB first for validation.
5. Switch app to restored DB or restore in place if validated.
6. Run health checks and key user flow checks.

## Daily / Weekly / Monthly Checklist
- Daily:
  - App reachable over HTTPS.
  - `/api/health` returns success.
  - Backup job still running.
- Weekly:
  - Check disk usage trend.
  - Review recent logs for repeated API/DB errors.
- Monthly:
  - Run restore rehearsal.
  - Verify retention and cleanup settings still match expectations.

## Local Mac Usage Policy (to stay lightweight)
- Do not run local Docker/MySQL for daily usage.
- Access the remote deployment by browser.
- Keep only code and tools locally.

## Ownership Notes
- Treat production env values as secrets.
- Never commit `.env.production`.
- Store secret backups in password manager or secret manager.
- Use versioned migrations for all new schema changes: `docs/db-migrations.md`.
