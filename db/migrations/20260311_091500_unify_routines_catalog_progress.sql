-- Migration: 20260311_091500_unify_routines_catalog_progress.sql
-- Canonical schema for structured app data (routines/catalog/progress) with legacy sync.

CREATE TABLE IF NOT EXISTS sp_domains (
  id TINYINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  domain_key VARCHAR(40) NOT NULL,
  display_name VARCHAR(80) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_sp_domains_key (domain_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT IGNORE INTO sp_domains (domain_key, display_name)
VALUES
  ('home', 'Home'),
  ('career', 'Career'),
  ('glow', 'Glow');

CREATE TABLE IF NOT EXISTS sp_catalog_items (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  domain_key VARCHAR(40) NOT NULL,
  item_type VARCHAR(60) NOT NULL,
  key_name VARCHAR(120) NULL,
  title VARCHAR(180) NOT NULL,
  subtitle VARCHAR(180) NULL,
  attributes JSON NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  legacy_table VARCHAR(80) NULL,
  legacy_id BIGINT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_sp_catalog_legacy (legacy_table, legacy_id),
  UNIQUE KEY uniq_sp_catalog_domain_type_key (domain_key, item_type, key_name),
  INDEX idx_sp_catalog_domain_type_active (domain_key, item_type, is_active),
  CONSTRAINT fk_sp_catalog_domain
    FOREIGN KEY (domain_key) REFERENCES sp_domains(domain_key)
    ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS sp_routines (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  domain_key VARCHAR(40) NOT NULL,
  routine_type VARCHAR(60) NOT NULL,
  name VARCHAR(180) NOT NULL,
  config JSON NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  legacy_table VARCHAR(80) NULL,
  legacy_id BIGINT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_sp_routines_legacy (legacy_table, legacy_id),
  INDEX idx_sp_routines_domain_type_active (domain_key, routine_type, is_active),
  CONSTRAINT fk_sp_routines_domain
    FOREIGN KEY (domain_key) REFERENCES sp_domains(domain_key)
    ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS sp_routine_tasks (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  routine_id BIGINT UNSIGNED NOT NULL,
  title VARCHAR(220) NOT NULL,
  order_index INT NOT NULL DEFAULT 0,
  estimated_minutes INT NOT NULL DEFAULT 0,
  metadata JSON NULL,
  legacy_table VARCHAR(80) NULL,
  legacy_id BIGINT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_sp_tasks_legacy (legacy_table, legacy_id),
  INDEX idx_sp_tasks_routine_order (routine_id, order_index, id),
  CONSTRAINT fk_sp_tasks_routine
    FOREIGN KEY (routine_id) REFERENCES sp_routines(id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS sp_task_completions (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  task_id BIGINT UNSIGNED NOT NULL,
  completion_date DATE NOT NULL,
  completed_at DATETIME NOT NULL,
  legacy_table VARCHAR(80) NULL,
  legacy_id BIGINT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_sp_task_completion_day (task_id, completion_date),
  UNIQUE KEY uniq_sp_task_completion_legacy (legacy_table, legacy_id),
  INDEX idx_sp_task_completion_date (completion_date),
  CONSTRAINT fk_sp_task_completion_task
    FOREIGN KEY (task_id) REFERENCES sp_routine_tasks(id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS sp_user_progress (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_key VARCHAR(120) NOT NULL DEFAULT 'demo',
  domain_key VARCHAR(40) NOT NULL,
  progress_type VARCHAR(80) NOT NULL,
  item_id BIGINT UNSIGNED NULL,
  routine_id BIGINT UNSIGNED NULL,
  task_id BIGINT UNSIGNED NULL,
  progress_date DATE NULL,
  progress_value DECIMAL(10,2) NULL,
  status VARCHAR(40) NULL,
  payload JSON NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_sp_progress_user_domain_type (user_key, domain_key, progress_type),
  INDEX idx_sp_progress_date (progress_date),
  CONSTRAINT fk_sp_progress_domain
    FOREIGN KEY (domain_key) REFERENCES sp_domains(domain_key)
    ON DELETE RESTRICT,
  CONSTRAINT fk_sp_progress_item
    FOREIGN KEY (item_id) REFERENCES sp_catalog_items(id)
    ON DELETE SET NULL,
  CONSTRAINT fk_sp_progress_routine
    FOREIGN KEY (routine_id) REFERENCES sp_routines(id)
    ON DELETE SET NULL,
  CONSTRAINT fk_sp_progress_task
    FOREIGN KEY (task_id) REFERENCES sp_routine_tasks(id)
    ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Backfill home routines/tasks/completions into canonical tables.
INSERT INTO sp_routines (domain_key, routine_type, name, config, is_active, legacy_table, legacy_id, created_at, updated_at)
SELECT
  'home',
  'home_routine',
  hr.name,
  JSON_OBJECT(
    'room', hr.room,
    'frequency', hr.frequency,
    'active_days', hr.active_days,
    'time_limit_minutes', hr.time_limit_minutes,
    'scheduled_time', CAST(hr.scheduled_time AS CHAR)
  ),
  COALESCE(hr.is_active, 1),
  'home_routines',
  hr.id,
  hr.created_at,
  CURRENT_TIMESTAMP
FROM home_routines hr
ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  config = VALUES(config),
  is_active = VALUES(is_active),
  updated_at = CURRENT_TIMESTAMP;

INSERT INTO sp_routine_tasks (routine_id, title, order_index, estimated_minutes, metadata, legacy_table, legacy_id, created_at, updated_at)
SELECT
  sr.id,
  ht.title,
  COALESCE(ht.order_index, 0),
  COALESCE(ht.estimated_minutes, 0),
  JSON_OBJECT(),
  'home_tasks',
  ht.id,
  ht.created_at,
  CURRENT_TIMESTAMP
FROM home_tasks ht
INNER JOIN sp_routines sr
  ON sr.legacy_table = 'home_routines'
 AND sr.legacy_id = ht.routine_id
ON DUPLICATE KEY UPDATE
  routine_id = VALUES(routine_id),
  title = VALUES(title),
  order_index = VALUES(order_index),
  estimated_minutes = VALUES(estimated_minutes),
  updated_at = CURRENT_TIMESTAMP;

INSERT INTO sp_task_completions (task_id, completion_date, completed_at, legacy_table, legacy_id, created_at)
SELECT
  srt.id,
  htc.completion_date,
  htc.completed_at,
  'home_task_completions',
  htc.id,
  htc.created_at
FROM home_task_completions htc
INNER JOIN sp_routine_tasks srt
  ON srt.legacy_table = 'home_tasks'
 AND srt.legacy_id = htc.task_id
ON DUPLICATE KEY UPDATE
  task_id = VALUES(task_id),
  completion_date = VALUES(completion_date),
  completed_at = VALUES(completed_at);

-- Backfill predefined catalogs for career + glow.
INSERT INTO sp_catalog_items (
  domain_key, item_type, key_name, title, subtitle, attributes, is_active,
  legacy_table, legacy_id, created_at, updated_at
)
SELECT
  'career',
  'subject',
  CONCAT('subject_', s.id),
  s.name,
  NULL,
  JSON_OBJECT(
    'color', s.color,
    'icon_key', s.icon_key,
    'cover_image_path', s.cover_image_path
  ),
  1,
  'subjects',
  s.id,
  s.created_at,
  CURRENT_TIMESTAMP
FROM subjects s
ON DUPLICATE KEY UPDATE
  title = VALUES(title),
  attributes = VALUES(attributes),
  is_active = VALUES(is_active),
  updated_at = CURRENT_TIMESTAMP;

INSERT INTO sp_catalog_items (
  domain_key, item_type, key_name, title, subtitle, attributes, is_active,
  legacy_table, legacy_id, created_at, updated_at
)
SELECT
  'career',
  'daily_practice_item',
  COALESCE(NULLIF(dpi.key_name, ''), CONCAT('daily_practice_', dpi.id)),
  dpi.name,
  dpi.display_name,
  JSON_OBJECT(
    'icon_type', dpi.icon_type,
    'preset_icon', dpi.preset_icon,
    'uploaded_icon_url', dpi.uploaded_icon_url
  ),
  COALESCE(dpi.is_active, 1),
  'daily_practice_items',
  dpi.id,
  dpi.created_at,
  CURRENT_TIMESTAMP
FROM daily_practice_items dpi
ON DUPLICATE KEY UPDATE
  title = VALUES(title),
  subtitle = VALUES(subtitle),
  attributes = VALUES(attributes),
  is_active = VALUES(is_active),
  updated_at = CURRENT_TIMESTAMP;

INSERT INTO sp_catalog_items (
  domain_key, item_type, key_name, title, subtitle, attributes, is_active,
  legacy_table, legacy_id, created_at, updated_at
)
SELECT
  'glow',
  'beauty_drink_recipe',
  CONCAT('beauty_drink_', bdr.id),
  bdr.name,
  NULL,
  JSON_OBJECT(
    'recipe', bdr.recipe,
    'time_of_day', bdr.time_of_day,
    'icon_image_path', bdr.icon_image_path
  ),
  COALESCE(bdr.is_active, 1),
  'beauty_drink_recipes',
  bdr.id,
  bdr.created_at,
  CURRENT_TIMESTAMP
FROM beauty_drink_recipes bdr
ON DUPLICATE KEY UPDATE
  title = VALUES(title),
  attributes = VALUES(attributes),
  is_active = VALUES(is_active),
  updated_at = CURRENT_TIMESTAMP;

-- Keep canonical schema synced from existing write paths.
DROP TRIGGER IF EXISTS trg_home_routines_ai_to_sp;
CREATE TRIGGER trg_home_routines_ai_to_sp
AFTER INSERT ON home_routines
FOR EACH ROW
INSERT INTO sp_routines (domain_key, routine_type, name, config, is_active, legacy_table, legacy_id, created_at, updated_at)
VALUES (
  'home',
  'home_routine',
  NEW.name,
  JSON_OBJECT(
    'room', NEW.room,
    'frequency', NEW.frequency,
    'active_days', NEW.active_days,
    'time_limit_minutes', NEW.time_limit_minutes,
    'scheduled_time', CAST(NEW.scheduled_time AS CHAR)
  ),
  COALESCE(NEW.is_active, 1),
  'home_routines',
  NEW.id,
  NEW.created_at,
  CURRENT_TIMESTAMP
)
ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  config = VALUES(config),
  is_active = VALUES(is_active),
  updated_at = CURRENT_TIMESTAMP;

DROP TRIGGER IF EXISTS trg_home_routines_au_to_sp;
CREATE TRIGGER trg_home_routines_au_to_sp
AFTER UPDATE ON home_routines
FOR EACH ROW
INSERT INTO sp_routines (domain_key, routine_type, name, config, is_active, legacy_table, legacy_id, created_at, updated_at)
VALUES (
  'home',
  'home_routine',
  NEW.name,
  JSON_OBJECT(
    'room', NEW.room,
    'frequency', NEW.frequency,
    'active_days', NEW.active_days,
    'time_limit_minutes', NEW.time_limit_minutes,
    'scheduled_time', CAST(NEW.scheduled_time AS CHAR)
  ),
  COALESCE(NEW.is_active, 1),
  'home_routines',
  NEW.id,
  COALESCE(NEW.created_at, CURRENT_TIMESTAMP),
  CURRENT_TIMESTAMP
)
ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  config = VALUES(config),
  is_active = VALUES(is_active),
  updated_at = CURRENT_TIMESTAMP;

DROP TRIGGER IF EXISTS trg_home_routines_ad_to_sp;
CREATE TRIGGER trg_home_routines_ad_to_sp
AFTER DELETE ON home_routines
FOR EACH ROW
DELETE FROM sp_routines WHERE legacy_table = 'home_routines' AND legacy_id = OLD.id;

DROP TRIGGER IF EXISTS trg_home_tasks_ai_to_sp;
CREATE TRIGGER trg_home_tasks_ai_to_sp
AFTER INSERT ON home_tasks
FOR EACH ROW
INSERT INTO sp_routine_tasks (routine_id, title, order_index, estimated_minutes, metadata, legacy_table, legacy_id, created_at, updated_at)
SELECT
  sr.id,
  NEW.title,
  COALESCE(NEW.order_index, 0),
  COALESCE(NEW.estimated_minutes, 0),
  JSON_OBJECT(),
  'home_tasks',
  NEW.id,
  NEW.created_at,
  CURRENT_TIMESTAMP
FROM sp_routines sr
WHERE sr.legacy_table = 'home_routines'
  AND sr.legacy_id = NEW.routine_id
ON DUPLICATE KEY UPDATE
  routine_id = VALUES(routine_id),
  title = VALUES(title),
  order_index = VALUES(order_index),
  estimated_minutes = VALUES(estimated_minutes),
  updated_at = CURRENT_TIMESTAMP;

DROP TRIGGER IF EXISTS trg_home_tasks_au_to_sp;
CREATE TRIGGER trg_home_tasks_au_to_sp
AFTER UPDATE ON home_tasks
FOR EACH ROW
INSERT INTO sp_routine_tasks (routine_id, title, order_index, estimated_minutes, metadata, legacy_table, legacy_id, created_at, updated_at)
SELECT
  sr.id,
  NEW.title,
  COALESCE(NEW.order_index, 0),
  COALESCE(NEW.estimated_minutes, 0),
  JSON_OBJECT(),
  'home_tasks',
  NEW.id,
  COALESCE(NEW.created_at, CURRENT_TIMESTAMP),
  CURRENT_TIMESTAMP
FROM sp_routines sr
WHERE sr.legacy_table = 'home_routines'
  AND sr.legacy_id = NEW.routine_id
ON DUPLICATE KEY UPDATE
  routine_id = VALUES(routine_id),
  title = VALUES(title),
  order_index = VALUES(order_index),
  estimated_minutes = VALUES(estimated_minutes),
  updated_at = CURRENT_TIMESTAMP;

DROP TRIGGER IF EXISTS trg_home_tasks_ad_to_sp;
CREATE TRIGGER trg_home_tasks_ad_to_sp
AFTER DELETE ON home_tasks
FOR EACH ROW
DELETE FROM sp_routine_tasks WHERE legacy_table = 'home_tasks' AND legacy_id = OLD.id;

DROP TRIGGER IF EXISTS trg_home_task_completions_ai_to_sp;
CREATE TRIGGER trg_home_task_completions_ai_to_sp
AFTER INSERT ON home_task_completions
FOR EACH ROW
INSERT INTO sp_task_completions (task_id, completion_date, completed_at, legacy_table, legacy_id, created_at)
SELECT
  srt.id,
  NEW.completion_date,
  NEW.completed_at,
  'home_task_completions',
  NEW.id,
  NEW.created_at
FROM sp_routine_tasks srt
WHERE srt.legacy_table = 'home_tasks'
  AND srt.legacy_id = NEW.task_id
ON DUPLICATE KEY UPDATE
  task_id = VALUES(task_id),
  completion_date = VALUES(completion_date),
  completed_at = VALUES(completed_at);

DROP TRIGGER IF EXISTS trg_home_task_completions_au_to_sp;
CREATE TRIGGER trg_home_task_completions_au_to_sp
AFTER UPDATE ON home_task_completions
FOR EACH ROW
INSERT INTO sp_task_completions (task_id, completion_date, completed_at, legacy_table, legacy_id, created_at)
SELECT
  srt.id,
  NEW.completion_date,
  NEW.completed_at,
  'home_task_completions',
  NEW.id,
  COALESCE(NEW.created_at, CURRENT_TIMESTAMP)
FROM sp_routine_tasks srt
WHERE srt.legacy_table = 'home_tasks'
  AND srt.legacy_id = NEW.task_id
ON DUPLICATE KEY UPDATE
  task_id = VALUES(task_id),
  completion_date = VALUES(completion_date),
  completed_at = VALUES(completed_at);

DROP TRIGGER IF EXISTS trg_home_task_completions_ad_to_sp;
CREATE TRIGGER trg_home_task_completions_ad_to_sp
AFTER DELETE ON home_task_completions
FOR EACH ROW
DELETE FROM sp_task_completions WHERE legacy_table = 'home_task_completions' AND legacy_id = OLD.id;

DROP TRIGGER IF EXISTS trg_subjects_ai_to_sp;
CREATE TRIGGER trg_subjects_ai_to_sp
AFTER INSERT ON subjects
FOR EACH ROW
INSERT INTO sp_catalog_items (
  domain_key, item_type, key_name, title, subtitle, attributes, is_active,
  legacy_table, legacy_id, created_at, updated_at
)
VALUES (
  'career',
  'subject',
  CONCAT('subject_', NEW.id),
  NEW.name,
  NULL,
  JSON_OBJECT('color', NEW.color, 'icon_key', NEW.icon_key, 'cover_image_path', NEW.cover_image_path),
  1,
  'subjects',
  NEW.id,
  NEW.created_at,
  CURRENT_TIMESTAMP
)
ON DUPLICATE KEY UPDATE
  title = VALUES(title),
  attributes = VALUES(attributes),
  is_active = VALUES(is_active),
  updated_at = CURRENT_TIMESTAMP;

DROP TRIGGER IF EXISTS trg_subjects_au_to_sp;
CREATE TRIGGER trg_subjects_au_to_sp
AFTER UPDATE ON subjects
FOR EACH ROW
INSERT INTO sp_catalog_items (
  domain_key, item_type, key_name, title, subtitle, attributes, is_active,
  legacy_table, legacy_id, created_at, updated_at
)
VALUES (
  'career',
  'subject',
  CONCAT('subject_', NEW.id),
  NEW.name,
  NULL,
  JSON_OBJECT('color', NEW.color, 'icon_key', NEW.icon_key, 'cover_image_path', NEW.cover_image_path),
  1,
  'subjects',
  NEW.id,
  COALESCE(NEW.created_at, CURRENT_TIMESTAMP),
  CURRENT_TIMESTAMP
)
ON DUPLICATE KEY UPDATE
  title = VALUES(title),
  attributes = VALUES(attributes),
  is_active = VALUES(is_active),
  updated_at = CURRENT_TIMESTAMP;

DROP TRIGGER IF EXISTS trg_subjects_ad_to_sp;
CREATE TRIGGER trg_subjects_ad_to_sp
AFTER DELETE ON subjects
FOR EACH ROW
DELETE FROM sp_catalog_items WHERE legacy_table = 'subjects' AND legacy_id = OLD.id;

DROP TRIGGER IF EXISTS trg_daily_practice_items_ai_to_sp;
CREATE TRIGGER trg_daily_practice_items_ai_to_sp
AFTER INSERT ON daily_practice_items
FOR EACH ROW
INSERT INTO sp_catalog_items (
  domain_key, item_type, key_name, title, subtitle, attributes, is_active,
  legacy_table, legacy_id, created_at, updated_at
)
VALUES (
  'career',
  'daily_practice_item',
  COALESCE(NULLIF(NEW.key_name, ''), CONCAT('daily_practice_', NEW.id)),
  NEW.name,
  NEW.display_name,
  JSON_OBJECT(
    'icon_type', NEW.icon_type,
    'preset_icon', NEW.preset_icon,
    'uploaded_icon_url', NEW.uploaded_icon_url
  ),
  COALESCE(NEW.is_active, 1),
  'daily_practice_items',
  NEW.id,
  NEW.created_at,
  CURRENT_TIMESTAMP
)
ON DUPLICATE KEY UPDATE
  title = VALUES(title),
  subtitle = VALUES(subtitle),
  attributes = VALUES(attributes),
  is_active = VALUES(is_active),
  updated_at = CURRENT_TIMESTAMP;

DROP TRIGGER IF EXISTS trg_daily_practice_items_au_to_sp;
CREATE TRIGGER trg_daily_practice_items_au_to_sp
AFTER UPDATE ON daily_practice_items
FOR EACH ROW
INSERT INTO sp_catalog_items (
  domain_key, item_type, key_name, title, subtitle, attributes, is_active,
  legacy_table, legacy_id, created_at, updated_at
)
VALUES (
  'career',
  'daily_practice_item',
  COALESCE(NULLIF(NEW.key_name, ''), CONCAT('daily_practice_', NEW.id)),
  NEW.name,
  NEW.display_name,
  JSON_OBJECT(
    'icon_type', NEW.icon_type,
    'preset_icon', NEW.preset_icon,
    'uploaded_icon_url', NEW.uploaded_icon_url
  ),
  COALESCE(NEW.is_active, 1),
  'daily_practice_items',
  NEW.id,
  COALESCE(NEW.created_at, CURRENT_TIMESTAMP),
  CURRENT_TIMESTAMP
)
ON DUPLICATE KEY UPDATE
  title = VALUES(title),
  subtitle = VALUES(subtitle),
  attributes = VALUES(attributes),
  is_active = VALUES(is_active),
  updated_at = CURRENT_TIMESTAMP;

DROP TRIGGER IF EXISTS trg_daily_practice_items_ad_to_sp;
CREATE TRIGGER trg_daily_practice_items_ad_to_sp
AFTER DELETE ON daily_practice_items
FOR EACH ROW
DELETE FROM sp_catalog_items WHERE legacy_table = 'daily_practice_items' AND legacy_id = OLD.id;

DROP TRIGGER IF EXISTS trg_beauty_drink_recipes_ai_to_sp;
CREATE TRIGGER trg_beauty_drink_recipes_ai_to_sp
AFTER INSERT ON beauty_drink_recipes
FOR EACH ROW
INSERT INTO sp_catalog_items (
  domain_key, item_type, key_name, title, subtitle, attributes, is_active,
  legacy_table, legacy_id, created_at, updated_at
)
VALUES (
  'glow',
  'beauty_drink_recipe',
  CONCAT('beauty_drink_', NEW.id),
  NEW.name,
  NULL,
  JSON_OBJECT(
    'recipe', NEW.recipe,
    'time_of_day', NEW.time_of_day,
    'icon_image_path', NEW.icon_image_path
  ),
  COALESCE(NEW.is_active, 1),
  'beauty_drink_recipes',
  NEW.id,
  NEW.created_at,
  CURRENT_TIMESTAMP
)
ON DUPLICATE KEY UPDATE
  title = VALUES(title),
  attributes = VALUES(attributes),
  is_active = VALUES(is_active),
  updated_at = CURRENT_TIMESTAMP;

DROP TRIGGER IF EXISTS trg_beauty_drink_recipes_au_to_sp;
CREATE TRIGGER trg_beauty_drink_recipes_au_to_sp
AFTER UPDATE ON beauty_drink_recipes
FOR EACH ROW
INSERT INTO sp_catalog_items (
  domain_key, item_type, key_name, title, subtitle, attributes, is_active,
  legacy_table, legacy_id, created_at, updated_at
)
VALUES (
  'glow',
  'beauty_drink_recipe',
  CONCAT('beauty_drink_', NEW.id),
  NEW.name,
  NULL,
  JSON_OBJECT(
    'recipe', NEW.recipe,
    'time_of_day', NEW.time_of_day,
    'icon_image_path', NEW.icon_image_path
  ),
  COALESCE(NEW.is_active, 1),
  'beauty_drink_recipes',
  NEW.id,
  COALESCE(NEW.created_at, CURRENT_TIMESTAMP),
  CURRENT_TIMESTAMP
)
ON DUPLICATE KEY UPDATE
  title = VALUES(title),
  attributes = VALUES(attributes),
  is_active = VALUES(is_active),
  updated_at = CURRENT_TIMESTAMP;

DROP TRIGGER IF EXISTS trg_beauty_drink_recipes_ad_to_sp;
CREATE TRIGGER trg_beauty_drink_recipes_ad_to_sp
AFTER DELETE ON beauty_drink_recipes
FOR EACH ROW
DELETE FROM sp_catalog_items WHERE legacy_table = 'beauty_drink_recipes' AND legacy_id = OLD.id;
