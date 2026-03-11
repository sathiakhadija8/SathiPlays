# Deploy SathiPlays With PIN Access

## 1. Prepare server

- Provision a Linux VPS.
- Install Docker + Docker Compose plugin.
- Point your domain A record to the VPS IP.

## 2. Upload project

- Copy this project to the server.
- In project root, create production env file:

```bash
cp .env.production.example .env.production
```

- Edit `.env.production` with real values:
  - `DOMAIN` -> your domain, e.g. `app.yourdomain.com`
  - `APP_PIN` -> your unlock PIN
  - `PIN_AUTH_SECRET` -> long random secret
  - DB passwords

## 3. Start full stack

Run preflight validation first:

```bash
npm run ops:preflight
```

Then start full stack:

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml up -d --build
```

This starts:
- `mysql` for data
- `db-backup` for automatic daily database backups
- `db-cleanup` for automatic monthly log cleanup
- `app` (Next.js)
- `caddy` (HTTPS + reverse proxy)

## 4. Verify

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml ps
curl -I https://your-domain
npm run ops:health
```

You should see the PIN page first. After entering PIN once, device stays unlocked via secure cookie.

## 5. Updates

```bash
git pull
npm run ops:preflight
npm run backup:db
npm run db:migrate:prod:up
docker compose --env-file .env.production -f docker-compose.prod.yml up -d --build
npm run ops:health
```

## 6. Backup DB (automatic + manual)

Automatic backups are enabled by default in `docker-compose.prod.yml`.

- Interval: every 24 hours (`BACKUP_INTERVAL_SECONDS=86400`)
- Retention: 30 days (`BACKUP_RETENTION_DAYS=30`)
- Output folder: `./backups` on the host

Tune settings in `.env.production`:

```bash
BACKUP_INTERVAL_SECONDS=86400
BACKUP_RETENTION_DAYS=30
BACKUP_FILE_PREFIX=sathiplays
```

Monthly cleanup settings in `.env.production`:

```bash
CLEANUP_INTERVAL_SECONDS=2592000
CLEANUP_RETENTION_DAYS=30
```

Cleanup removes old rows from:
- `events` (past events)
- `supplement_logs`, `drink_logs`, `drinks_logs`, `tea_logs`, `seed_water_logs`, `beauty_drink_daily`
- `routine_completions`, `home_task_completions`, `plant_logs`, `timeline_tasks`

Cleanup does **not** touch your core/history tables like books/media, routine definitions, or closet items.

Run a manual backup anytime:

```bash
npm run backup:db
```

Or direct command:

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml exec -T mysql \
  mysqldump -u"$MYSQL_USER" -p"$MYSQL_PASSWORD" "$MYSQL_DATABASE" > backup.sql
```

## 7. Restore rehearsal (monthly)

Run this monthly to ensure backups are actually restorable:

```bash
npm run ops:restore:rehearsal
```

## 8. Next docs

- Remote roadmap: `docs/remote-platform-roadmap.md`
- Operations runbook: `docs/remote-operations-runbook.md`
