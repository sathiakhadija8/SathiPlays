# Database Split: Structured Catalog + Routine + Progress

This schema reconfiguration introduces canonical tables for structured product data while preserving legacy tables for compatibility.

## Canonical tables
- `sp_domains`: domain registry (`home`, `career`, `glow`)
- `sp_catalog_items`: predefined things (subjects, glam recipes, daily-practice presets)
- `sp_routines`: routine definitions (schedule/config in JSON)
- `sp_routine_tasks`: tasks belonging to routines
- `sp_task_completions`: day-level completion facts
- `sp_user_progress`: normalized progress facts for user actions over time

## Why this split
- Keeps relational data in one place for Supabase/Postgres-style usage.
- Supports routine systems and predefined catalogs without log bloat.
- Leaves heavy files/log streams for object storage.

## Current compatibility strategy
Existing app write paths still target legacy tables. Migration `20260311_091500_unify_routines_catalog_progress.sql`:
- backfills legacy data into canonical tables
- installs triggers so inserts/updates/deletes on legacy tables sync into canonical tables

## Legacy -> canonical mapping
- `home_routines` -> `sp_routines` (`domain_key='home'`, `routine_type='home_routine'`)
- `home_tasks` -> `sp_routine_tasks`
- `home_task_completions` -> `sp_task_completions`
- `subjects` -> `sp_catalog_items` (`domain_key='career'`, `item_type='subject'`)
- `daily_practice_items` -> `sp_catalog_items` (`domain_key='career'`, `item_type='daily_practice_item'`)
- `beauty_drink_recipes` -> `sp_catalog_items` (`domain_key='glow'`, `item_type='beauty_drink_recipe'`)

## Query direction going forward
For new features and refactors, read from canonical tables first:
- catalog screens: `sp_catalog_items`
- routine planners: `sp_routines` + `sp_routine_tasks`
- completion/analytics: `sp_task_completions` + `sp_user_progress`

## Notes for Supabase migration
When moving from MySQL to Supabase Postgres:
- Keep table shapes and keys as-is where possible.
- Replace triggers with Postgres `AFTER` triggers/functions.
- Replace JSON function syntax (`JSON_OBJECT`) with Postgres `jsonb_build_object`.
- Convert `TINYINT(1)` flags to `boolean`.

## Phase 2 (read path)
- `/api/home/routines`, `/api/home/today-tasks`, `/api/home/summary` now read from `sp_routines` + `sp_routine_tasks` + `sp_task_completions` (legacy IDs preserved in API responses).
- `/api/career/subjects`, `/api/career/summary`, `/api/career/daily-practice/items`, `/api/career/daily-practice/status`, `/api/career/daily-practice/checkin` now resolve predefined items from `sp_catalog_items` (legacy IDs preserved for log/write compatibility).

## Phase 3 (glow reads)
- Glow drinks predefined recipe reads (`today/week/system`) now resolve from `sp_catalog_items` instead of direct `beauty_drink_recipes` reads; write paths remain on legacy table with sync triggers.
