# SathiPlays DB Migrations

## Why
Use versioned SQL migrations for all schema changes so feature development stays safe and reproducible over time.

## Commands
- Status (default uses `.env.local`):
```bash
npm run db:migrate:status
```

- Apply pending migrations:
```bash
npm run db:migrate:up
```

- Create a new migration file:
```bash
npm run db:migrate:create -- add_new_table_name
```

## Production usage
For production server env file, use the docker-based runner:
```bash
npm run db:migrate:prod:status
npm run db:migrate:prod:up
```

The production runner validates SHA-256 checksums for already-applied files and aborts if an old migration was modified.

## Current baseline
- `db/init.sql` still creates the base schema.
- `db/migrations/20260310_000000_baseline_after_init.sql` marks migration tracking start.

## Workflow for new features
1. Create migration file.
2. Add forward-only SQL changes.
3. Run migration in local/staging.
4. Deploy app code.
5. Run migration in production before enabling new feature paths.

## Rules
- Do not edit old migration files once applied.
- If you need a change, add a new migration.
- Keep migrations small and domain-focused.
- Prefer backward-compatible changes first (add columns/tables), then app changes, then cleanup later.

## New canonical split migration
- `db/migrations/20260311_091500_unify_routines_catalog_progress.sql`: introduces canonical structured tables (`sp_*`) and sync triggers from legacy tables.
