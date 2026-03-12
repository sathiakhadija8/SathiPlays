CREATE USER IF NOT EXISTS 'sathia'@'%' IDENTIFIED BY 'sathiapass';
CREATE USER IF NOT EXISTS 'sathia'@'localhost' IDENTIFIED BY 'sathiapass';
ALTER USER 'sathia'@'%' IDENTIFIED BY 'sathiapass';
ALTER USER 'sathia'@'localhost' IDENTIFIED BY 'sathiapass';
GRANT ALL PRIVILEGES ON sathiplays.* TO 'sathia'@'%';
GRANT ALL PRIVILEGES ON sathiplays.* TO 'sathia'@'localhost';
FLUSH PRIVILEGES;

CREATE TABLE IF NOT EXISTS affirmations (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  text VARCHAR(255) NOT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  weight INT NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO affirmations (text, is_active, weight) VALUES
  ('You''re building quietly.', 1, 5),
  ('Small steps compound into momentum.', 1, 3),
  ('Your consistency is your superpower.', 1, 3),
  ('Progress over perfection, every day.', 1, 2),
  ('Calm focus creates sharp results.', 1, 2),
  ('You can do hard things gently.', 1, 1),
  ('Your pace is valid and powerful.', 1, 2),
  ('Discipline is self-respect in motion.', 1, 2),
  ('One focused hour changes the week.', 1, 2),
  ('Clarity grows when you begin.', 1, 1),
  ('Rest is part of the strategy.', 1, 1),
  ('Quiet effort makes loud progress.', 0, 1);

CREATE TABLE IF NOT EXISTS mood_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  mood_value INT NOT NULL,
  note TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO mood_logs (mood_value, note, created_at) VALUES
  (58, 'Morning baseline', DATE_SUB(NOW(), INTERVAL 2 DAY)),
  (66, 'Focused session', DATE_SUB(NOW(), INTERVAL 1 DAY)),
  (72, 'Good flow', DATE_SUB(NOW(), INTERVAL 8 HOUR)),
  (63, 'Energy dip', DATE_SUB(NOW(), INTERVAL 3 HOUR));

CREATE TABLE IF NOT EXISTS cycle_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  logged_for_date DATE NOT NULL,
  symptoms JSON NULL,
  bleeding_type ENUM('none','spotting','period') DEFAULT 'none',
  birth_control_taken TINYINT(1) DEFAULT 0,
  note VARCHAR(255) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_cycle_logged_for_date (logged_for_date),
  INDEX idx_cycle_created_at (created_at)
);

CREATE TABLE IF NOT EXISTS events (
  id INT AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(120) NOT NULL,
  start_at DATETIME NOT NULL,
  end_at DATETIME NULL,
  location VARCHAR(120) NULL,
  notes TEXT NULL,
  category VARCHAR(30) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_events_start_at (start_at),
  INDEX idx_events_category (category)
);

CREATE TABLE IF NOT EXISTS timeline_tasks (
  id INT AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(160) NOT NULL,
  task_date DATE NOT NULL,
  start_at DATETIME NOT NULL,
  end_at DATETIME NOT NULL,
  category VARCHAR(30) NULL,
  completed_at DATETIME NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_timeline_tasks_task_date (task_date),
  INDEX idx_timeline_tasks_start_at (start_at),
  INDEX idx_timeline_tasks_end_at (end_at)
);

CREATE TABLE IF NOT EXISTS timeline_checklist_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  task_id INT NOT NULL,
  text VARCHAR(200) NOT NULL,
  is_done TINYINT(1) DEFAULT 0,
  done_at DATETIME NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_timeline_checklist_task_id (task_id),
  CONSTRAINT fk_timeline_checklist_task
    FOREIGN KEY (task_id) REFERENCES timeline_tasks(id)
    ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS subjects (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  color VARCHAR(20) NOT NULL,
  icon_key VARCHAR(50) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS pomodoro_sessions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  subject_id INT NOT NULL,
  label VARCHAR(120) NOT NULL,
  planned_minutes INT NOT NULL,
  actual_minutes INT NOT NULL,
  started_at DATETIME NOT NULL,
  ended_at DATETIME NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_pomodoro_subject_id (subject_id),
  INDEX idx_pomodoro_started_at (started_at),
  INDEX idx_pomodoro_ended_at (ended_at),
  CONSTRAINT fk_pomodoro_subject
    FOREIGN KEY (subject_id) REFERENCES subjects(id)
    ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS study_sessions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  date DATE NOT NULL,
  duration_minutes INT NOT NULL,
  subject_id INT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_study_sessions_date (date),
  INDEX idx_study_sessions_subject_id (subject_id),
  CONSTRAINT fk_study_sessions_subject
    FOREIGN KEY (subject_id) REFERENCES subjects(id)
    ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS daily_practice_targets (
  id INT AUTO_INCREMENT PRIMARY KEY,
  subject_id INT NOT NULL,
  target_minutes INT NOT NULL,
  is_active TINYINT(1) DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_daily_practice_subject (subject_id),
  CONSTRAINT fk_daily_practice_target_subject
    FOREIGN KEY (subject_id) REFERENCES subjects(id)
    ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS daily_practice_checkins (
  id INT AUTO_INCREMENT PRIMARY KEY,
  checkin_date DATE NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_checkin_date (checkin_date)
);

CREATE TABLE IF NOT EXISTS roadmaps (
  id INT AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(160) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS roadmap_tasks (
  id INT AUTO_INCREMENT PRIMARY KEY,
  roadmap_id INT NOT NULL,
  text VARCHAR(220) NOT NULL,
  is_done TINYINT(1) DEFAULT 0,
  done_at DATETIME NULL,
  order_index INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_roadmap_tasks_roadmap_id (roadmap_id),
  INDEX idx_roadmap_tasks_is_done (is_done),
  CONSTRAINT fk_roadmap_tasks_roadmap
    FOREIGN KEY (roadmap_id) REFERENCES roadmaps(id)
    ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS job_applications (
  id INT AUTO_INCREMENT PRIMARY KEY,
  role_title VARCHAR(160) NOT NULL,
  company VARCHAR(160) NOT NULL,
  link VARCHAR(400) NULL,
  status ENUM('saved','applied','interview','offer','rejected') NOT NULL DEFAULT 'saved',
  applied_date DATE NULL,
  notes TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_job_applications_status (status),
  INDEX idx_job_applications_created_at (created_at)
);

CREATE TABLE IF NOT EXISTS job_hunt_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  applied_count INT NOT NULL DEFAULT 0,
  work_mode ENUM('remote','in') NOT NULL DEFAULT 'remote',
  update_note VARCHAR(255) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_job_hunt_logs_work_mode (work_mode),
  INDEX idx_job_hunt_logs_created_at (created_at)
);

CREATE TABLE IF NOT EXISTS cv_files (
  id INT AUTO_INCREMENT PRIMARY KEY,
  display_name VARCHAR(160) NOT NULL,
  tag VARCHAR(80) NULL,
  file_name VARCHAR(220) NOT NULL,
  file_path VARCHAR(400) NOT NULL,
  mime_type VARCHAR(120) NULL,
  size_bytes INT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS certification_badges (
  id INT AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(160) NOT NULL,
  issuer VARCHAR(160) NULL,
  completed_date DATE NULL,
  badge_icon_key VARCHAR(60) NULL,
  badge_color VARCHAR(20) NULL,
  badge_image_path VARCHAR(400) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS points_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  domain VARCHAR(30) NOT NULL,
  source_type VARCHAR(40) NOT NULL,
  source_id INT NULL,
  points INT NOT NULL,
  reason VARCHAR(200) NOT NULL,
  awarded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_points_domain (domain),
  INDEX idx_points_awarded_at (awarded_at),
  INDEX idx_points_source_type (source_type)
);

CREATE TABLE IF NOT EXISTS inactivity_guards (
  id INT AUTO_INCREMENT PRIMARY KEY,
  domain VARCHAR(30) NOT NULL,
  guard_key VARCHAR(40) NOT NULL,
  last_activity_at DATETIME NULL,
  last_penalty_at DATETIME NULL,
  UNIQUE KEY uniq_inactivity_guard (domain, guard_key)
);

CREATE TABLE IF NOT EXISTS daily_practice_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  key_name VARCHAR(60) NULL,
  name VARCHAR(120) NOT NULL,
  display_name VARCHAR(120) NULL,
  icon_type ENUM('preset','upload') NOT NULL DEFAULT 'preset',
  preset_icon VARCHAR(120) NULL,
  uploaded_icon_url VARCHAR(400) NULL,
  is_active TINYINT(1) DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

SET @daily_practice_items_icon_type_exists := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'daily_practice_items'
    AND COLUMN_NAME = 'icon_type'
);
SET @daily_practice_items_icon_type_sql := IF(
  @daily_practice_items_icon_type_exists = 0,
  'ALTER TABLE daily_practice_items ADD COLUMN icon_type ENUM(''preset'',''upload'') NOT NULL DEFAULT ''preset'' AFTER display_name',
  'SELECT 1'
);
PREPARE stmt_daily_practice_items_icon_type FROM @daily_practice_items_icon_type_sql;
EXECUTE stmt_daily_practice_items_icon_type;
DEALLOCATE PREPARE stmt_daily_practice_items_icon_type;

SET @daily_practice_items_preset_icon_exists := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'daily_practice_items'
    AND COLUMN_NAME = 'preset_icon'
);
SET @daily_practice_items_preset_icon_sql := IF(
  @daily_practice_items_preset_icon_exists = 0,
  'ALTER TABLE daily_practice_items ADD COLUMN preset_icon VARCHAR(120) NULL AFTER icon_type',
  'SELECT 1'
);
PREPARE stmt_daily_practice_items_preset_icon FROM @daily_practice_items_preset_icon_sql;
EXECUTE stmt_daily_practice_items_preset_icon;
DEALLOCATE PREPARE stmt_daily_practice_items_preset_icon;

SET @daily_practice_items_uploaded_icon_url_exists := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'daily_practice_items'
    AND COLUMN_NAME = 'uploaded_icon_url'
);
SET @daily_practice_items_uploaded_icon_url_sql := IF(
  @daily_practice_items_uploaded_icon_url_exists = 0,
  'ALTER TABLE daily_practice_items ADD COLUMN uploaded_icon_url VARCHAR(400) NULL AFTER preset_icon',
  'SELECT 1'
);
PREPARE stmt_daily_practice_items_uploaded_icon_url FROM @daily_practice_items_uploaded_icon_url_sql;
EXECUTE stmt_daily_practice_items_uploaded_icon_url;
DEALLOCATE PREPARE stmt_daily_practice_items_uploaded_icon_url;

CREATE TABLE IF NOT EXISTS daily_practice_item_targets (
  id INT AUTO_INCREMENT PRIMARY KEY,
  item_id INT NOT NULL,
  target_minutes INT NOT NULL,
  is_active TINYINT(1) DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_daily_practice_item_target (item_id),
  CONSTRAINT fk_daily_practice_item_target_item
    FOREIGN KEY (item_id) REFERENCES daily_practice_items(id)
    ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS daily_practice_progress (
  id INT AUTO_INCREMENT PRIMARY KEY,
  item_id INT NOT NULL,
  log_date DATE NOT NULL,
  minutes INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_daily_practice_progress_item_date (item_id, log_date),
  INDEX idx_daily_practice_progress_log_date (log_date),
  CONSTRAINT fk_daily_practice_progress_item
    FOREIGN KEY (item_id) REFERENCES daily_practice_items(id)
    ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS daily_practice_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  item_id INT NOT NULL,
  log_date DATE NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_daily_practice_logs_item_date (item_id, log_date),
  INDEX idx_daily_practice_logs_log_date (log_date),
  CONSTRAINT fk_daily_practice_logs_item
    FOREIGN KEY (item_id) REFERENCES daily_practice_items(id)
    ON DELETE CASCADE
);

INSERT INTO daily_practice_items (key_name, name, display_name, icon_type, preset_icon, uploaded_icon_url, is_active)
VALUES
  ('communication', 'Communication Skills', 'Communication Skills', 'preset', '🗣', NULL, 1),
  ('driving', 'Driving Licence', 'Driving Licence', 'preset', '🚗', NULL, 1)
ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  display_name = VALUES(display_name),
  icon_type = VALUES(icon_type),
  preset_icon = COALESCE(daily_practice_items.preset_icon, VALUES(preset_icon)),
  uploaded_icon_url = COALESCE(daily_practice_items.uploaded_icon_url, VALUES(uploaded_icon_url)),
  is_active = VALUES(is_active);

CREATE TABLE IF NOT EXISTS routines (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(160) NOT NULL,
  type VARCHAR(60) NOT NULL,
  active_days JSON NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS routine_tasks (
  id INT AUTO_INCREMENT PRIMARY KEY,
  routine_id INT NOT NULL,
  title VARCHAR(220) NOT NULL,
  order_index INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_routine_tasks_routine_id (routine_id),
  CONSTRAINT fk_routine_tasks_routine
    FOREIGN KEY (routine_id) REFERENCES routines(id)
    ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS routine_completions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  routine_id INT NOT NULL,
  completed_date DATE NOT NULL,
  completed_at DATETIME NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_routine_completion_day (routine_id, completed_date),
  INDEX idx_routine_completions_date (completed_date),
  CONSTRAINT fk_routine_completions_routine
    FOREIGN KEY (routine_id) REFERENCES routines(id)
    ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS routine_streaks (
  routine_id INT PRIMARY KEY,
  current_streak INT DEFAULT 0,
  last_completed_date DATE NULL,
  CONSTRAINT fk_routine_streaks_routine
    FOREIGN KEY (routine_id) REFERENCES routines(id)
    ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS books (
  id INT AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(160) NOT NULL,
  icon_path VARCHAR(400) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS glow_images (
  id INT AUTO_INCREMENT PRIMARY KEY,
  routine_id INT NOT NULL,
  book_id INT NOT NULL,
  image_path VARCHAR(400) NOT NULL,
  caption VARCHAR(255) NULL,
  quote VARCHAR(255) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_glow_images_routine_id (routine_id),
  INDEX idx_glow_images_book_id (book_id),
  CONSTRAINT fk_glow_images_routine
    FOREIGN KEY (routine_id) REFERENCES routines(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_glow_images_book
    FOREIGN KEY (book_id) REFERENCES books(id)
    ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS recipes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(160) NOT NULL,
  description TEXT NULL,
  image_path VARCHAR(400) NULL,
  pcos_tags JSON NULL,
  meal_tags JSON NULL,
  protein_g_per_portion DECIMAL(6,2) DEFAULT 0,
  carbs_g_per_portion DECIMAL(6,2) DEFAULT 0,
  fat_g_per_portion DECIMAL(6,2) DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS recipe_steps (
  id INT AUTO_INCREMENT PRIMARY KEY,
  recipe_id INT NOT NULL,
  step_text VARCHAR(400) NOT NULL,
  order_index INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_recipe_steps_recipe_id (recipe_id),
  INDEX idx_recipe_steps_recipe_order (recipe_id, order_index),
  CONSTRAINT fk_recipe_steps_recipe
    FOREIGN KEY (recipe_id) REFERENCES recipes(id)
    ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS recipe_ingredients (
  id INT AUTO_INCREMENT PRIMARY KEY,
  recipe_id INT NOT NULL,
  ingredient_name VARCHAR(160) NOT NULL,
  qty_per_portion DECIMAL(10,2) NOT NULL,
  unit VARCHAR(30) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_recipe_ingredients_recipe_id (recipe_id),
  CONSTRAINT fk_recipe_ingredients_recipe
    FOREIGN KEY (recipe_id) REFERENCES recipes(id)
    ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS inventory_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  ingredient_name VARCHAR(160) NOT NULL UNIQUE,
  image_path VARCHAR(400) NULL,
  quantity DECIMAL(10,2) NOT NULL DEFAULT 0,
  unit VARCHAR(30) NOT NULL,
  location ENUM('pantry','fridge','freezer') DEFAULT 'pantry',
  low_stock_threshold DECIMAL(10,2) NOT NULL DEFAULT 0,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS grocery_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  item_name VARCHAR(160) NOT NULL,
  quantity DECIMAL(10,2) NULL,
  unit VARCHAR(30) NULL,
  category VARCHAR(60) NULL,
  status ENUM('pending','bought') NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_grocery_status (status)
);

CREATE TABLE IF NOT EXISTS weekly_plan (
  id INT AUTO_INCREMENT PRIMARY KEY,
  week_start_date DATE NOT NULL UNIQUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS weekly_plan_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  weekly_plan_id INT NOT NULL,
  plan_date DATE NOT NULL,
  meal_slot ENUM('breakfast','lunch','dinner','snack','suhoor','iftar') NOT NULL,
  recipe_id INT NOT NULL,
  planned_portions INT NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_weekly_plan_items_plan_id (weekly_plan_id),
  INDEX idx_weekly_plan_items_date (plan_date),
  CONSTRAINT fk_weekly_plan_items_plan
    FOREIGN KEY (weekly_plan_id) REFERENCES weekly_plan(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_weekly_plan_items_recipe
    FOREIGN KEY (recipe_id) REFERENCES recipes(id)
    ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS cooked_batches (
  id INT AUTO_INCREMENT PRIMARY KEY,
  cooked_at DATETIME NOT NULL,
  expires_at DATETIME NOT NULL,
  status ENUM('active','finished','expired') DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS cooked_batch_recipes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  batch_id INT NOT NULL,
  recipe_id INT NOT NULL,
  portions_cooked INT NOT NULL,
  portions_remaining INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_cooked_batch_recipes_batch_id (batch_id),
  INDEX idx_cooked_batch_recipes_recipe_id (recipe_id),
  CONSTRAINT fk_cooked_batch_recipes_batch
    FOREIGN KEY (batch_id) REFERENCES cooked_batches(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_cooked_batch_recipes_recipe
    FOREIGN KEY (recipe_id) REFERENCES recipes(id)
    ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS meal_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  logged_at DATETIME NOT NULL,
  log_type ENUM('cooked','cheat') NOT NULL,
  batch_id INT NULL,
  batch_recipe_id INT NULL,
  portions INT NULL,
  cheat_title VARCHAR(160) NULL,
  cheat_notes TEXT NULL,
  cheat_protein_g DECIMAL(6,2) NULL,
  cheat_carbs_g DECIMAL(6,2) NULL,
  cheat_fat_g DECIMAL(6,2) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_meal_logs_logged_at (logged_at),
  INDEX idx_meal_logs_log_type (log_type),
  CONSTRAINT fk_meal_logs_batch
    FOREIGN KEY (batch_id) REFERENCES cooked_batches(id)
    ON DELETE SET NULL,
  CONSTRAINT fk_meal_logs_batch_recipe
    FOREIGN KEY (batch_recipe_id) REFERENCES cooked_batch_recipes(id)
    ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS fasting_plans (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  type ENUM('ramadan_dry','window','omad','custom') NOT NULL,
  start_time VARCHAR(10) NULL,
  end_time VARCHAR(10) NULL,
  is_active TINYINT(1) DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS fasting_sessions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  plan_id INT NULL,
  fast_type VARCHAR(40) NULL,
  window_start_time VARCHAR(10) NULL,
  window_end_time VARCHAR(10) NULL,
  started_at DATETIME NOT NULL,
  ended_at DATETIME NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_fasting_sessions_started_at (started_at),
  CONSTRAINT fk_fasting_sessions_plan
    FOREIGN KEY (plan_id) REFERENCES fasting_plans(id)
    ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS home_routines (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(160) NOT NULL,
  room VARCHAR(60) NOT NULL,
  frequency VARCHAR(60) NOT NULL,
  active_days JSON NULL,
  time_limit_minutes INT NOT NULL DEFAULT 60,
  scheduled_time TIME NOT NULL DEFAULT '08:00:00',
  is_active TINYINT(1) DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

SET @home_routines_time_limit_exists := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'home_routines'
    AND COLUMN_NAME = 'time_limit_minutes'
);
SET @home_routines_time_limit_sql := IF(
  @home_routines_time_limit_exists = 0,
  'ALTER TABLE home_routines ADD COLUMN time_limit_minutes INT NOT NULL DEFAULT 60 AFTER active_days',
  'SELECT 1'
);
PREPARE stmt_home_routines_time_limit FROM @home_routines_time_limit_sql;
EXECUTE stmt_home_routines_time_limit;
DEALLOCATE PREPARE stmt_home_routines_time_limit;

SET @home_routines_scheduled_time_exists := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'home_routines'
    AND COLUMN_NAME = 'scheduled_time'
);
SET @home_routines_scheduled_time_sql := IF(
  @home_routines_scheduled_time_exists = 0,
  'ALTER TABLE home_routines ADD COLUMN scheduled_time TIME NOT NULL DEFAULT ''08:00:00'' AFTER time_limit_minutes',
  'SELECT 1'
);
PREPARE stmt_home_routines_scheduled_time FROM @home_routines_scheduled_time_sql;
EXECUTE stmt_home_routines_scheduled_time;
DEALLOCATE PREPARE stmt_home_routines_scheduled_time;

UPDATE home_routines
SET scheduled_time = '08:00:00'
WHERE scheduled_time IS NULL;

CREATE TABLE IF NOT EXISTS home_tasks (
  id INT AUTO_INCREMENT PRIMARY KEY,
  routine_id INT NOT NULL,
  title VARCHAR(220) NOT NULL,
  order_index INT DEFAULT 0,
  estimated_minutes INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_home_tasks_routine_id (routine_id),
  CONSTRAINT fk_home_tasks_routine
    FOREIGN KEY (routine_id) REFERENCES home_routines(id)
    ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS home_task_completions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  task_id INT NOT NULL,
  completion_date DATE NOT NULL,
  completed_at DATETIME NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_home_task_completion_day (task_id, completion_date),
  INDEX idx_home_task_completions_task_id (task_id),
  CONSTRAINT fk_home_task_completions_task
    FOREIGN KEY (task_id) REFERENCES home_tasks(id)
    ON DELETE CASCADE
);

SET @home_task_completions_date_idx_exists := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'home_task_completions'
    AND INDEX_NAME = 'idx_home_task_completions_date'
);
SET @home_task_completions_date_idx_sql := IF(
  @home_task_completions_date_idx_exists = 0,
  'ALTER TABLE home_task_completions ADD INDEX idx_home_task_completions_date (completion_date)',
  'SELECT 1'
);
PREPARE stmt_home_task_completions_date_idx FROM @home_task_completions_date_idx_sql;
EXECUTE stmt_home_task_completions_date_idx;
DEALLOCATE PREPARE stmt_home_task_completions_date_idx;

CREATE TABLE IF NOT EXISTS closet_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(160) NOT NULL,
  size VARCHAR(40) NULL,
  category VARCHAR(120) NULL,
  image_path VARCHAR(400) NULL,
  state ENUM('in_closet','dirty','in_laundry','drying','folded') NOT NULL DEFAULT 'in_closet',
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_closet_items_state (state),
  INDEX idx_closet_items_updated_at (updated_at)
);

SET @closet_items_size_exists := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'closet_items'
    AND COLUMN_NAME = 'size'
);
SET @closet_items_size_sql := IF(
  @closet_items_size_exists = 0,
  'ALTER TABLE closet_items ADD COLUMN size VARCHAR(40) NULL AFTER name',
  'SELECT 1'
);
PREPARE stmt_closet_items_size FROM @closet_items_size_sql;
EXECUTE stmt_closet_items_size;
DEALLOCATE PREPARE stmt_closet_items_size;

CREATE TABLE IF NOT EXISTS plants (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  watering_frequency_days INT NOT NULL DEFAULT 2,
  last_watered_at DATETIME NULL,
  next_watering_at DATETIME NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

SET @plants_next_watering_idx_exists := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'plants'
    AND INDEX_NAME = 'idx_plants_next_watering_at'
);
SET @plants_next_watering_idx_sql := IF(
  @plants_next_watering_idx_exists = 0,
  'ALTER TABLE plants ADD INDEX idx_plants_next_watering_at (next_watering_at)',
  'SELECT 1'
);
PREPARE stmt_plants_next_watering_idx FROM @plants_next_watering_idx_sql;
EXECUTE stmt_plants_next_watering_idx;
DEALLOCATE PREPARE stmt_plants_next_watering_idx;

CREATE TABLE IF NOT EXISTS plant_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  plant_id INT NOT NULL,
  watered_at DATETIME NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_plant_logs_plant_id (plant_id),
  INDEX idx_plant_logs_watered_at (watered_at),
  CONSTRAINT fk_plant_logs_plant
    FOREIGN KEY (plant_id) REFERENCES plants(id)
    ON DELETE CASCADE
);

INSERT INTO plants (name, watering_frequency_days, last_watered_at, next_watering_at)
SELECT 'Balcony Plant', 2, NOW(), DATE_ADD(NOW(), INTERVAL 2 DAY)
WHERE NOT EXISTS (SELECT 1 FROM plants);

SET @fasting_sessions_fast_type_exists := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'fasting_sessions'
    AND COLUMN_NAME = 'fast_type'
);
SET @fasting_sessions_fast_type_sql := IF(
  @fasting_sessions_fast_type_exists = 0,
  'ALTER TABLE fasting_sessions ADD COLUMN fast_type VARCHAR(40) NULL AFTER plan_id',
  'SELECT 1'
);
PREPARE stmt_fasting_sessions_fast_type FROM @fasting_sessions_fast_type_sql;
EXECUTE stmt_fasting_sessions_fast_type;
DEALLOCATE PREPARE stmt_fasting_sessions_fast_type;

SET @fasting_sessions_window_start_exists := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'fasting_sessions'
    AND COLUMN_NAME = 'window_start_time'
);
SET @fasting_sessions_window_start_sql := IF(
  @fasting_sessions_window_start_exists = 0,
  'ALTER TABLE fasting_sessions ADD COLUMN window_start_time VARCHAR(10) NULL AFTER fast_type',
  'SELECT 1'
);
PREPARE stmt_fasting_sessions_window_start FROM @fasting_sessions_window_start_sql;
EXECUTE stmt_fasting_sessions_window_start;
DEALLOCATE PREPARE stmt_fasting_sessions_window_start;

SET @fasting_sessions_window_end_exists := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'fasting_sessions'
    AND COLUMN_NAME = 'window_end_time'
);
SET @fasting_sessions_window_end_sql := IF(
  @fasting_sessions_window_end_exists = 0,
  'ALTER TABLE fasting_sessions ADD COLUMN window_end_time VARCHAR(10) NULL AFTER window_start_time',
  'SELECT 1'
);
PREPARE stmt_fasting_sessions_window_end FROM @fasting_sessions_window_end_sql;
EXECUTE stmt_fasting_sessions_window_end;
DEALLOCATE PREPARE stmt_fasting_sessions_window_end;

SET @books_icon_path_exists := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'books'
    AND COLUMN_NAME = 'icon_path'
);
SET @books_icon_path_sql := IF(
  @books_icon_path_exists = 0,
  'ALTER TABLE books ADD COLUMN icon_path VARCHAR(400) NULL',
  'SELECT 1'
);
PREPARE stmt_books_icon_path FROM @books_icon_path_sql;
EXECUTE stmt_books_icon_path;
DEALLOCATE PREPARE stmt_books_icon_path;

UPDATE books
SET icon_path = COALESCE(NULLIF(icon_path, ''), '/SathiPlays/Images/background.png')
WHERE icon_path IS NULL OR icon_path = '';

SET @recipes_image_path_exists := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'recipes'
    AND COLUMN_NAME = 'image_path'
);
SET @recipes_image_path_sql := IF(
  @recipes_image_path_exists = 0,
  'ALTER TABLE recipes ADD COLUMN image_path VARCHAR(400) NULL AFTER description',
  'SELECT 1'
);
PREPARE stmt_recipes_image_path FROM @recipes_image_path_sql;
EXECUTE stmt_recipes_image_path;
DEALLOCATE PREPARE stmt_recipes_image_path;

SET @inventory_image_path_exists := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'inventory_items'
    AND COLUMN_NAME = 'image_path'
);
SET @inventory_image_path_sql := IF(
  @inventory_image_path_exists = 0,
  'ALTER TABLE inventory_items ADD COLUMN image_path VARCHAR(400) NULL AFTER ingredient_name',
  'SELECT 1'
);
PREPARE stmt_inventory_image_path FROM @inventory_image_path_sql;
EXECUTE stmt_inventory_image_path;
DEALLOCATE PREPARE stmt_inventory_image_path;

CREATE TABLE IF NOT EXISTS supplements (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(160) NOT NULL,
  dosage VARCHAR(120) NULL,
  frequency_type ENUM('daily','weekly','monthly') NOT NULL DEFAULT 'daily',
  times_per_day TINYINT NOT NULL DEFAULT 1,
  day_of_week TINYINT NULL,
  days_of_week_json JSON NULL,
  specific_date TINYINT NULL,
  time_of_day ENUM('morning','evening','night') NOT NULL DEFAULT 'morning',
  primary_time CHAR(5) NULL,
  secondary_time CHAR(5) NULL,
  intake_mode ENUM('empty_stomach','with_food') NOT NULL DEFAULT 'with_food',
  dosage_text VARCHAR(120) NULL,
  timing VARCHAR(80) NULL,
  notes VARCHAR(255) NULL,
  is_active TINYINT(1) DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

SET @supplements_dosage_exists := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'supplements' AND COLUMN_NAME = 'dosage_text'
);
SET @supplements_dosage_sql := IF(
  @supplements_dosage_exists = 0,
  'ALTER TABLE supplements ADD COLUMN dosage_text VARCHAR(120) NULL AFTER name',
  'SELECT 1'
);
PREPARE stmt_supplements_dosage FROM @supplements_dosage_sql;
EXECUTE stmt_supplements_dosage;
DEALLOCATE PREPARE stmt_supplements_dosage;

SET @supplements_timing_exists := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'supplements' AND COLUMN_NAME = 'timing'
);
SET @supplements_timing_sql := IF(
  @supplements_timing_exists = 0,
  'ALTER TABLE supplements ADD COLUMN timing VARCHAR(80) NULL AFTER dosage_text',
  'SELECT 1'
);
PREPARE stmt_supplements_timing FROM @supplements_timing_sql;
EXECUTE stmt_supplements_timing;
DEALLOCATE PREPARE stmt_supplements_timing;

SET @supplements_notes_exists := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'supplements' AND COLUMN_NAME = 'notes'
);
SET @supplements_notes_sql := IF(
  @supplements_notes_exists = 0,
  'ALTER TABLE supplements ADD COLUMN notes VARCHAR(255) NULL AFTER timing',
  'SELECT 1'
);
PREPARE stmt_supplements_notes FROM @supplements_notes_sql;
EXECUTE stmt_supplements_notes;
DEALLOCATE PREPARE stmt_supplements_notes;

CREATE TABLE IF NOT EXISTS supplement_schedules (
  id INT AUTO_INCREMENT PRIMARY KEY,
  supplement_id INT NOT NULL,
  day_of_week TINYINT NOT NULL DEFAULT 1,
  time_slot ENUM('morning','midday','evening','night') NOT NULL,
  due_time TIME NOT NULL,
  notes VARCHAR(255) NULL,
  enabled TINYINT(1) DEFAULT 1,
  is_active TINYINT(1) DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_supplement_schedules_day (day_of_week),
  INDEX idx_supplement_schedules_enabled (enabled),
  INDEX idx_supplement_schedules_time_slot (time_slot),
  INDEX idx_supplement_schedules_due_time (due_time),
  INDEX idx_supplement_schedules_supplement_id (supplement_id),
  CONSTRAINT fk_supplement_schedules_supplement
    FOREIGN KEY (supplement_id) REFERENCES supplements(id)
    ON DELETE CASCADE
);

SET @supplement_schedule_day_exists := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'supplement_schedules' AND COLUMN_NAME = 'day_of_week'
);
SET @supplement_schedule_day_sql := IF(
  @supplement_schedule_day_exists = 0,
  'ALTER TABLE supplement_schedules ADD COLUMN day_of_week TINYINT NOT NULL DEFAULT 1 AFTER supplement_id',
  'SELECT 1'
);
PREPARE stmt_supplement_schedule_day FROM @supplement_schedule_day_sql;
EXECUTE stmt_supplement_schedule_day;
DEALLOCATE PREPARE stmt_supplement_schedule_day;

SET @supplement_schedule_enabled_exists := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'supplement_schedules' AND COLUMN_NAME = 'enabled'
);
SET @supplement_schedule_enabled_sql := IF(
  @supplement_schedule_enabled_exists = 0,
  'ALTER TABLE supplement_schedules ADD COLUMN enabled TINYINT(1) DEFAULT 1 AFTER notes',
  'SELECT 1'
);
PREPARE stmt_supplement_schedule_enabled FROM @supplement_schedule_enabled_sql;
EXECUTE stmt_supplement_schedule_enabled;
DEALLOCATE PREPARE stmt_supplement_schedule_enabled;

UPDATE supplement_schedules
SET enabled = is_active
WHERE enabled IS NULL;

CREATE TABLE IF NOT EXISTS supplement_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  supplement_id INT NOT NULL,
  scheduled_id INT NULL,
  log_date DATE NOT NULL,
  taken_at DATETIME NOT NULL,
  status ENUM('taken') DEFAULT 'taken',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_supplement_log_dedupe (supplement_id, log_date, scheduled_id),
  INDEX idx_supplement_logs_log_date (log_date),
  INDEX idx_supplement_logs_supplement_id (supplement_id),
  CONSTRAINT fk_supplement_logs_supplement
    FOREIGN KEY (supplement_id) REFERENCES supplements(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_supplement_logs_schedule
    FOREIGN KEY (scheduled_id) REFERENCES supplement_schedules(id)
    ON DELETE SET NULL
);

SET @supplements_dosage_new_exists := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'supplements' AND COLUMN_NAME = 'dosage'
);
SET @supplements_dosage_new_sql := IF(
  @supplements_dosage_new_exists = 0,
  'ALTER TABLE supplements ADD COLUMN dosage VARCHAR(120) NULL AFTER name',
  'SELECT 1'
);
PREPARE stmt_supplements_dosage_new FROM @supplements_dosage_new_sql;
EXECUTE stmt_supplements_dosage_new;
DEALLOCATE PREPARE stmt_supplements_dosage_new;

SET @supplements_frequency_type_exists := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'supplements' AND COLUMN_NAME = 'frequency_type'
);
SET @supplements_frequency_type_sql := IF(
  @supplements_frequency_type_exists = 0,
  'ALTER TABLE supplements ADD COLUMN frequency_type ENUM(''daily'',''weekly'',''monthly'') NOT NULL DEFAULT ''daily'' AFTER dosage',
  'SELECT 1'
);
PREPARE stmt_supplements_frequency_type FROM @supplements_frequency_type_sql;
EXECUTE stmt_supplements_frequency_type;
DEALLOCATE PREPARE stmt_supplements_frequency_type;

SET @supplements_times_per_day_exists := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'supplements' AND COLUMN_NAME = 'times_per_day'
);
SET @supplements_times_per_day_sql := IF(
  @supplements_times_per_day_exists = 0,
  'ALTER TABLE supplements ADD COLUMN times_per_day TINYINT NOT NULL DEFAULT 1 AFTER frequency_type',
  'SELECT 1'
);
PREPARE stmt_supplements_times_per_day FROM @supplements_times_per_day_sql;
EXECUTE stmt_supplements_times_per_day;
DEALLOCATE PREPARE stmt_supplements_times_per_day;

SET @supplements_day_of_week_exists := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'supplements' AND COLUMN_NAME = 'day_of_week'
);
SET @supplements_day_of_week_sql := IF(
  @supplements_day_of_week_exists = 0,
  'ALTER TABLE supplements ADD COLUMN day_of_week TINYINT NULL AFTER times_per_day',
  'SELECT 1'
);
PREPARE stmt_supplements_day_of_week FROM @supplements_day_of_week_sql;
EXECUTE stmt_supplements_day_of_week;
DEALLOCATE PREPARE stmt_supplements_day_of_week;

SET @supplements_days_of_week_json_exists := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'supplements' AND COLUMN_NAME = 'days_of_week_json'
);
SET @supplements_days_of_week_json_sql := IF(
  @supplements_days_of_week_json_exists = 0,
  'ALTER TABLE supplements ADD COLUMN days_of_week_json JSON NULL AFTER day_of_week',
  'SELECT 1'
);
PREPARE stmt_supplements_days_of_week_json FROM @supplements_days_of_week_json_sql;
EXECUTE stmt_supplements_days_of_week_json;
DEALLOCATE PREPARE stmt_supplements_days_of_week_json;

SET @supplements_specific_date_exists := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'supplements' AND COLUMN_NAME = 'specific_date'
);
SET @supplements_specific_date_sql := IF(
  @supplements_specific_date_exists = 0,
  'ALTER TABLE supplements ADD COLUMN specific_date TINYINT NULL AFTER days_of_week_json',
  'SELECT 1'
);
PREPARE stmt_supplements_specific_date FROM @supplements_specific_date_sql;
EXECUTE stmt_supplements_specific_date;
DEALLOCATE PREPARE stmt_supplements_specific_date;

SET @supplements_time_of_day_exists := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'supplements' AND COLUMN_NAME = 'time_of_day'
);
SET @supplements_time_of_day_sql := IF(
  @supplements_time_of_day_exists = 0,
  'ALTER TABLE supplements ADD COLUMN time_of_day ENUM(''morning'',''evening'',''night'') NOT NULL DEFAULT ''morning'' AFTER specific_date',
  'SELECT 1'
);
PREPARE stmt_supplements_time_of_day FROM @supplements_time_of_day_sql;
EXECUTE stmt_supplements_time_of_day;
DEALLOCATE PREPARE stmt_supplements_time_of_day;

SET @supplement_logs_scheduled_datetime_exists := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'supplement_logs' AND COLUMN_NAME = 'scheduled_datetime'
);
SET @supplement_logs_scheduled_datetime_sql := IF(
  @supplement_logs_scheduled_datetime_exists = 0,
  'ALTER TABLE supplement_logs ADD COLUMN scheduled_datetime DATETIME NULL AFTER created_at',
  'SELECT 1'
);
PREPARE stmt_supplement_logs_scheduled_datetime FROM @supplement_logs_scheduled_datetime_sql;
EXECUTE stmt_supplement_logs_scheduled_datetime;
DEALLOCATE PREPARE stmt_supplement_logs_scheduled_datetime;

SET @supplement_logs_completed_exists := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'supplement_logs' AND COLUMN_NAME = 'completed'
);
SET @supplement_logs_completed_sql := IF(
  @supplement_logs_completed_exists = 0,
  'ALTER TABLE supplement_logs ADD COLUMN completed TINYINT(1) NOT NULL DEFAULT 1 AFTER scheduled_datetime',
  'SELECT 1'
);
PREPARE stmt_supplement_logs_completed FROM @supplement_logs_completed_sql;
EXECUTE stmt_supplement_logs_completed;
DEALLOCATE PREPARE stmt_supplement_logs_completed;

SET @supplement_logs_completed_at_exists := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'supplement_logs' AND COLUMN_NAME = 'completed_at'
);
SET @supplement_logs_completed_at_sql := IF(
  @supplement_logs_completed_at_exists = 0,
  'ALTER TABLE supplement_logs ADD COLUMN completed_at DATETIME NULL AFTER completed',
  'SELECT 1'
);
PREPARE stmt_supplement_logs_completed_at FROM @supplement_logs_completed_at_sql;
EXECUTE stmt_supplement_logs_completed_at;
DEALLOCATE PREPARE stmt_supplement_logs_completed_at;

UPDATE supplements
SET dosage = COALESCE(NULLIF(dosage, ''), dosage_text)
WHERE dosage IS NULL OR dosage = '';

UPDATE supplements
SET dosage_text = COALESCE(NULLIF(dosage_text, ''), dosage)
WHERE dosage_text IS NULL OR dosage_text = '';

UPDATE supplements
SET times_per_day = CASE
  WHEN times_per_day IS NULL OR times_per_day <= 1 THEN 1
  ELSE 2
END;

UPDATE supplements
SET days_of_week_json = JSON_ARRAY(day_of_week)
WHERE frequency_type = 'weekly'
  AND day_of_week IS NOT NULL
  AND (days_of_week_json IS NULL OR JSON_LENGTH(days_of_week_json) = 0);

UPDATE supplement_logs
SET scheduled_datetime = COALESCE(scheduled_datetime, taken_at, CONCAT(log_date, ' 08:00:00'))
WHERE scheduled_datetime IS NULL;

UPDATE supplement_logs
SET completed_at = COALESCE(completed_at, taken_at)
WHERE completed = 1 AND completed_at IS NULL;

CREATE TABLE IF NOT EXISTS water_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  log_date DATE NOT NULL,
  amount_ml INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_water_logs_log_date (log_date)
);

CREATE TABLE IF NOT EXISTS steps_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  log_date DATE NOT NULL,
  steps INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_steps_logs_log_date (log_date)
);

CREATE TABLE IF NOT EXISTS drinks_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  log_date DATE NOT NULL,
  drink_type ENUM('seed_water','herbal_tea','ispaghula') NOT NULL,
  completed TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_drinks_log_day_type (log_date, drink_type),
  INDEX idx_drinks_logs_log_date (log_date)
);

CREATE TABLE IF NOT EXISTS drinks (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(160) NOT NULL,
  type VARCHAR(60) NOT NULL DEFAULT 'other',
  dosage_text VARCHAR(120) NULL,
  timing VARCHAR(80) NULL,
  recipe_or_ingredients TEXT NULL,
  notes VARCHAR(255) NULL,
  is_active TINYINT(1) DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS drink_schedules (
  id INT AUTO_INCREMENT PRIMARY KEY,
  drink_id INT NOT NULL,
  day_of_week TINYINT NOT NULL,
  time_slot ENUM('morning','midday','evening','night') NOT NULL,
  due_time TIME NOT NULL,
  notes VARCHAR(255) NULL,
  enabled TINYINT(1) DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_drink_schedules_drink_id (drink_id),
  INDEX idx_drink_schedules_day (day_of_week),
  INDEX idx_drink_schedules_due_time (due_time),
  INDEX idx_drink_schedules_enabled (enabled),
  CONSTRAINT fk_drink_schedules_drink
    FOREIGN KEY (drink_id) REFERENCES drinks(id)
    ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS drink_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  drink_id INT NOT NULL,
  scheduled_id INT NULL,
  log_date DATE NOT NULL,
  taken_at DATETIME NOT NULL,
  status ENUM('taken') DEFAULT 'taken',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_drink_log_dedupe (drink_id, log_date, scheduled_id),
  INDEX idx_drink_logs_log_date (log_date),
  INDEX idx_drink_logs_drink_id (drink_id),
  CONSTRAINT fk_drink_logs_drink
    FOREIGN KEY (drink_id) REFERENCES drinks(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_drink_logs_schedule
    FOREIGN KEY (scheduled_id) REFERENCES drink_schedules(id)
    ON DELETE SET NULL
);

SET @drinks_category_exists := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'drinks' AND COLUMN_NAME = 'category'
);
SET @drinks_category_sql := IF(
  @drinks_category_exists = 0,
  'ALTER TABLE drinks ADD COLUMN category ENUM(''seed_water'',''beauty_drink'',''herbal_tea'') NOT NULL DEFAULT ''seed_water'' AFTER id',
  'SELECT 1'
);
PREPARE stmt_drinks_category FROM @drinks_category_sql;
EXECUTE stmt_drinks_category;
DEALLOCATE PREPARE stmt_drinks_category;

SET @drinks_frequency_type_exists := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'drinks' AND COLUMN_NAME = 'frequency_type'
);
SET @drinks_frequency_type_sql := IF(
  @drinks_frequency_type_exists = 0,
  'ALTER TABLE drinks ADD COLUMN frequency_type ENUM(''daily'',''weekly'',''monthly'') NOT NULL DEFAULT ''daily'' AFTER name',
  'SELECT 1'
);
PREPARE stmt_drinks_frequency_type FROM @drinks_frequency_type_sql;
EXECUTE stmt_drinks_frequency_type;
DEALLOCATE PREPARE stmt_drinks_frequency_type;

SET @drinks_times_per_day_exists := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'drinks' AND COLUMN_NAME = 'times_per_day'
);
SET @drinks_times_per_day_sql := IF(
  @drinks_times_per_day_exists = 0,
  'ALTER TABLE drinks ADD COLUMN times_per_day TINYINT NOT NULL DEFAULT 1 AFTER frequency_type',
  'SELECT 1'
);
PREPARE stmt_drinks_times_per_day FROM @drinks_times_per_day_sql;
EXECUTE stmt_drinks_times_per_day;
DEALLOCATE PREPARE stmt_drinks_times_per_day;

SET @drinks_day_of_week_exists := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'drinks' AND COLUMN_NAME = 'day_of_week'
);
SET @drinks_day_of_week_sql := IF(
  @drinks_day_of_week_exists = 0,
  'ALTER TABLE drinks ADD COLUMN day_of_week TINYINT NULL AFTER times_per_day',
  'SELECT 1'
);
PREPARE stmt_drinks_day_of_week FROM @drinks_day_of_week_sql;
EXECUTE stmt_drinks_day_of_week;
DEALLOCATE PREPARE stmt_drinks_day_of_week;

SET @drinks_specific_date_exists := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'drinks' AND COLUMN_NAME = 'specific_date'
);
SET @drinks_specific_date_sql := IF(
  @drinks_specific_date_exists = 0,
  'ALTER TABLE drinks ADD COLUMN specific_date TINYINT NULL AFTER day_of_week',
  'SELECT 1'
);
PREPARE stmt_drinks_specific_date FROM @drinks_specific_date_sql;
EXECUTE stmt_drinks_specific_date;
DEALLOCATE PREPARE stmt_drinks_specific_date;

SET @drinks_specific_dates_json_exists := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'drinks' AND COLUMN_NAME = 'specific_dates_json'
);
SET @drinks_specific_dates_json_sql := IF(
  @drinks_specific_dates_json_exists = 0,
  'ALTER TABLE drinks ADD COLUMN specific_dates_json JSON NULL AFTER specific_date',
  'SELECT 1'
);
PREPARE stmt_drinks_specific_dates_json FROM @drinks_specific_dates_json_sql;
EXECUTE stmt_drinks_specific_dates_json;
DEALLOCATE PREPARE stmt_drinks_specific_dates_json;

SET @drinks_time_of_day_exists := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'drinks' AND COLUMN_NAME = 'time_of_day'
);
SET @drinks_time_of_day_sql := IF(
  @drinks_time_of_day_exists = 0,
  'ALTER TABLE drinks ADD COLUMN time_of_day ENUM(''morning'',''midday'',''evening'',''night'') NOT NULL DEFAULT ''morning'' AFTER specific_dates_json',
  'SELECT 1'
);
PREPARE stmt_drinks_time_of_day FROM @drinks_time_of_day_sql;
EXECUTE stmt_drinks_time_of_day;
DEALLOCATE PREPARE stmt_drinks_time_of_day;

SET @drinks_recipe_exists := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'drinks' AND COLUMN_NAME = 'recipe'
);
SET @drinks_recipe_sql := IF(
  @drinks_recipe_exists = 0,
  'ALTER TABLE drinks ADD COLUMN recipe TEXT NULL AFTER time_of_day',
  'SELECT 1'
);
PREPARE stmt_drinks_recipe FROM @drinks_recipe_sql;
EXECUTE stmt_drinks_recipe;
DEALLOCATE PREPARE stmt_drinks_recipe;

SET @drinks_seed_types_exists := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'drinks' AND COLUMN_NAME = 'seed_types'
);
SET @drinks_seed_types_sql := IF(
  @drinks_seed_types_exists = 0,
  'ALTER TABLE drinks ADD COLUMN seed_types JSON NULL AFTER recipe',
  'SELECT 1'
);
PREPARE stmt_drinks_seed_types FROM @drinks_seed_types_sql;
EXECUTE stmt_drinks_seed_types;
DEALLOCATE PREPARE stmt_drinks_seed_types;

SET @drink_logs_scheduled_datetime_exists := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'drink_logs' AND COLUMN_NAME = 'scheduled_datetime'
);
SET @drink_logs_scheduled_datetime_sql := IF(
  @drink_logs_scheduled_datetime_exists = 0,
  'ALTER TABLE drink_logs ADD COLUMN scheduled_datetime DATETIME NULL AFTER created_at',
  'SELECT 1'
);
PREPARE stmt_drink_logs_scheduled_datetime FROM @drink_logs_scheduled_datetime_sql;
EXECUTE stmt_drink_logs_scheduled_datetime;
DEALLOCATE PREPARE stmt_drink_logs_scheduled_datetime;

SET @drink_logs_completed_exists := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'drink_logs' AND COLUMN_NAME = 'completed'
);
SET @drink_logs_completed_sql := IF(
  @drink_logs_completed_exists = 0,
  'ALTER TABLE drink_logs ADD COLUMN completed TINYINT(1) NOT NULL DEFAULT 1 AFTER scheduled_datetime',
  'SELECT 1'
);
PREPARE stmt_drink_logs_completed FROM @drink_logs_completed_sql;
EXECUTE stmt_drink_logs_completed;
DEALLOCATE PREPARE stmt_drink_logs_completed;

SET @drink_logs_completed_at_exists := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'drink_logs' AND COLUMN_NAME = 'completed_at'
);
SET @drink_logs_completed_at_sql := IF(
  @drink_logs_completed_at_exists = 0,
  'ALTER TABLE drink_logs ADD COLUMN completed_at DATETIME NULL AFTER completed',
  'SELECT 1'
);
PREPARE stmt_drink_logs_completed_at FROM @drink_logs_completed_at_sql;
EXECUTE stmt_drink_logs_completed_at;
DEALLOCATE PREPARE stmt_drink_logs_completed_at;

UPDATE drinks
SET category = CASE
  WHEN type = 'beauty_drink' THEN 'beauty_drink'
  WHEN type = 'herbal_tea' THEN 'herbal_tea'
  ELSE 'seed_water'
END
WHERE category IS NULL OR category = '';

UPDATE drinks
SET frequency_type = CASE
  WHEN timing = 'weekly' THEN 'weekly'
  WHEN timing = 'monthly' THEN 'monthly'
  ELSE 'daily'
END
WHERE frequency_type IS NULL OR frequency_type = '';

UPDATE drinks
SET time_of_day = CASE
  WHEN timing = 'midday' THEN 'midday'
  WHEN timing = 'evening' THEN 'evening'
  WHEN timing = 'night' THEN 'night'
  ELSE 'morning'
END
WHERE time_of_day IS NULL OR time_of_day = '';

UPDATE drinks
SET times_per_day = CASE
  WHEN category = 'herbal_tea' THEN 3
  WHEN times_per_day IS NULL OR times_per_day < 1 THEN 1
  WHEN times_per_day > 3 THEN 3
  ELSE times_per_day
END;

UPDATE drinks
SET recipe = COALESCE(NULLIF(recipe, ''), recipe_or_ingredients)
WHERE recipe IS NULL OR recipe = '';

UPDATE drink_logs
SET scheduled_datetime = COALESCE(scheduled_datetime, taken_at, CONCAT(log_date, ' 08:00:00'))
WHERE scheduled_datetime IS NULL;

UPDATE drink_logs
SET completed_at = COALESCE(completed_at, taken_at)
WHERE completed = 1 AND completed_at IS NULL;

CREATE TABLE IF NOT EXISTS vinted_bundles (
  id INT AUTO_INCREMENT PRIMARY KEY,
  supplier VARCHAR(160) NOT NULL,
  bundle_name VARCHAR(160) NOT NULL,
  quantity_expected INT NOT NULL DEFAULT 0,
  total_cost DECIMAL(10,2) NOT NULL DEFAULT 0,
  status ENUM('ordered','shipped','delivered') NOT NULL DEFAULT 'ordered',
  ordered_at DATETIME NULL,
  eta_date DATE NULL,
  delivered_at DATETIME NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_vinted_bundles_status (status)
);

CREATE TABLE IF NOT EXISTS vinted_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(180) NOT NULL,
  category VARCHAR(120) NULL,
  size VARCHAR(40) NULL,
  `condition` VARCHAR(80) NULL,
  cost_price DECIMAL(10,2) NOT NULL DEFAULT 0,
  intended_price DECIMAL(10,2) NULL,
  sale_price DECIMAL(10,2) NULL,
  platform_fee DECIMAL(10,2) NULL,
  status ENUM('draft','listed','reserved','sold') NOT NULL DEFAULT 'draft',
  image_path VARCHAR(400) NULL,
  bundle_id INT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  sold_at DATETIME NULL,
  INDEX idx_vinted_items_status (status),
  INDEX idx_vinted_items_created_at (created_at),
  CONSTRAINT fk_vinted_items_bundle
    FOREIGN KEY (bundle_id) REFERENCES vinted_bundles(id)
    ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS vinted_expenses (
  id INT AUTO_INCREMENT PRIMARY KEY,
  type ENUM('packaging','other') NOT NULL,
  name VARCHAR(180) NOT NULL,
  quantity INT NULL,
  cost DECIMAL(10,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_vinted_expenses_type (type)
);

CREATE TABLE IF NOT EXISTS brands (
  id INT AUTO_INCREMENT PRIMARY KEY,
  `key` ENUM('personal','business') NOT NULL UNIQUE,
  name VARCHAR(120) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO brands (`key`, name)
VALUES
  ('personal', 'Personal Brand'),
  ('business', 'Business Brand')
ON DUPLICATE KEY UPDATE
  name = VALUES(name);

CREATE TABLE IF NOT EXISTS content_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  brand_id INT NOT NULL,
  title VARCHAR(200) NOT NULL,
  platform ENUM('tiktok','instagram','youtube','pinterest','facebook') NOT NULL,
  category VARCHAR(120) NULL,
  hook VARCHAR(255) NULL,
  description TEXT NULL,
  status ENUM('idea','scripted','filmed','edited','scheduled','posted') NOT NULL DEFAULT 'idea',
  script_id INT NULL,
  monetized TINYINT(1) DEFAULT 0,
  thumbnail_path VARCHAR(400) NULL,
  filmed_at DATETIME NULL,
  scheduled_at DATETIME NULL,
  posted_at DATETIME NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_content_items_brand_status (brand_id, status),
  INDEX idx_content_items_brand_platform (brand_id, platform),
  INDEX idx_content_items_brand_scheduled (brand_id, scheduled_at),
  CONSTRAINT fk_content_items_brand
    FOREIGN KEY (brand_id) REFERENCES brands(id)
    ON DELETE CASCADE
);

SET @content_items_affiliate_id_exists := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'content_items'
    AND COLUMN_NAME = 'affiliate_id'
);
SET @content_items_affiliate_id_sql := IF(
  @content_items_affiliate_id_exists = 0,
  'ALTER TABLE content_items ADD COLUMN affiliate_id INT NULL AFTER script_id',
  'SELECT 1'
);
PREPARE stmt_content_items_affiliate_id FROM @content_items_affiliate_id_sql;
EXECUTE stmt_content_items_affiliate_id;
DEALLOCATE PREPARE stmt_content_items_affiliate_id;

CREATE TABLE IF NOT EXISTS scripts (
  id INT AUTO_INCREMENT PRIMARY KEY,
  brand_id INT NOT NULL,
  title VARCHAR(200) NOT NULL,
  platform ENUM('tiktok','instagram','youtube','pinterest','facebook') NOT NULL,
  category VARCHAR(120) NULL,
  monetized TINYINT(1) DEFAULT 0,
  hook_lines JSON NOT NULL,
  body TEXT NOT NULL,
  cta TEXT NULL,
  hashtags TEXT NULL,
  affiliate_id INT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_scripts_brand_platform (brand_id, platform),
  CONSTRAINT fk_scripts_brand
    FOREIGN KEY (brand_id) REFERENCES brands(id)
    ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS content_metrics (
  id INT AUTO_INCREMENT PRIMARY KEY,
  content_item_id INT NOT NULL,
  views INT NOT NULL DEFAULT 0,
  likes INT NOT NULL DEFAULT 0,
  comments INT NOT NULL DEFAULT 0,
  shares INT NOT NULL DEFAULT 0,
  saves INT NOT NULL DEFAULT 0,
  revenue DECIMAL(10,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_content_metrics_item (content_item_id),
  CONSTRAINT fk_content_metrics_item
    FOREIGN KEY (content_item_id) REFERENCES content_items(id)
    ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS affiliate_links (
  id INT AUTO_INCREMENT PRIMARY KEY,
  brand_id INT NOT NULL,
  network VARCHAR(120) NOT NULL,
  product_name VARCHAR(160) NOT NULL,
  url TEXT NOT NULL,
  commission_percent DECIMAL(5,2) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_affiliate_links_brand (brand_id),
  CONSTRAINT fk_affiliate_links_brand
    FOREIGN KEY (brand_id) REFERENCES brands(id)
    ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS affiliate_earnings (
  id INT AUTO_INCREMENT PRIMARY KEY,
  affiliate_id INT NOT NULL,
  content_item_id INT NULL,
  amount DECIMAL(10,2) NOT NULL,
  earned_date DATE NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_affiliate_earnings_affiliate (affiliate_id),
  INDEX idx_affiliate_earnings_date (earned_date),
  CONSTRAINT fk_affiliate_earnings_link
    FOREIGN KEY (affiliate_id) REFERENCES affiliate_links(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_affiliate_earnings_content
    FOREIGN KEY (content_item_id) REFERENCES content_items(id)
    ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS pr_brands (
  id INT AUTO_INCREMENT PRIMARY KEY,
  brand_id INT NOT NULL,
  company_name VARCHAR(160) NOT NULL,
  contact_email VARCHAR(160) NULL,
  contact_person VARCHAR(160) NULL,
  status ENUM('pitched','in_discussion','gifted','paid','declined') NOT NULL DEFAULT 'pitched',
  notes TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_pr_brands_brand (brand_id),
  INDEX idx_pr_brands_status (status),
  CONSTRAINT fk_pr_brands_brand
    FOREIGN KEY (brand_id) REFERENCES brands(id)
    ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS pr_deliverables (
  id INT AUTO_INCREMENT PRIMARY KEY,
  pr_brand_id INT NOT NULL,
  content_item_id INT NULL,
  deadline DATE NULL,
  payment_amount DECIMAL(10,2) NULL,
  status ENUM('pending','posted','paid') NOT NULL DEFAULT 'pending',
  posted_at DATETIME NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_pr_deliverables_brand (pr_brand_id),
  INDEX idx_pr_deliverables_status (status),
  CONSTRAINT fk_pr_deliverables_brand
    FOREIGN KEY (pr_brand_id) REFERENCES pr_brands(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_pr_deliverables_content
    FOREIGN KEY (content_item_id) REFERENCES content_items(id)
    ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS culture_entries (
  id INT AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(200) NOT NULL,
  type ENUM('movie','series','book') NOT NULL,
  in_wishlist TINYINT(1) NOT NULL DEFAULT 0,
  image_url VARCHAR(400) NOT NULL,
  language VARCHAR(80) NOT NULL,
  genres JSON NULL,
  category_kind ENUM('fiction','deen') NULL,
  rating DECIMAL(3,1) NULL,
  review_text TEXT NULL,
  date_started DATE NULL,
  date_completed DATE NULL,
  status VARCHAR(40) NULL,
  seasons_watched INT NULL,
  episodes_watched INT NULL,
  author VARCHAR(160) NULL,
  total_pages INT NULL,
  pages_read INT NULL,
  mood VARCHAR(80) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_culture_entries_type (type),
  INDEX idx_culture_entries_wishlist (in_wishlist),
  INDEX idx_culture_entries_created (created_at)
);

-- Glow Drinks v2: Seed Water + Beauty Drinks + Tea Check-In
CREATE TABLE IF NOT EXISTS seed_waters (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(160) NOT NULL,
  seed_types JSON NULL,
  recipe TEXT NULL,
  time_of_day ENUM('morning','midday','evening','night') NOT NULL DEFAULT 'morning',
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS seed_water_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  seed_water_id INT NOT NULL,
  log_date DATE NOT NULL,
  completed TINYINT(1) NOT NULL DEFAULT 0,
  completed_at DATETIME NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_seed_water_day (seed_water_id, log_date),
  INDEX idx_seed_water_logs_date (log_date),
  INDEX idx_seed_water_logs_completed (completed),
  CONSTRAINT fk_seed_water_logs_seed_water
    FOREIGN KEY (seed_water_id) REFERENCES seed_waters(id)
    ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS beauty_drink_recipes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(160) NOT NULL,
  recipe TEXT NULL,
  time_of_day ENUM('morning','midday','evening','night') NOT NULL DEFAULT 'morning',
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS beauty_drink_daily (
  id INT AUTO_INCREMENT PRIMARY KEY,
  log_date DATE NOT NULL,
  recipe_id INT NULL,
  completed TINYINT(1) NOT NULL DEFAULT 0,
  completed_at DATETIME NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_beauty_drink_daily_date (log_date),
  INDEX idx_beauty_drink_daily_completed (completed),
  CONSTRAINT fk_beauty_drink_daily_recipe
    FOREIGN KEY (recipe_id) REFERENCES beauty_drink_recipes(id)
    ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS tea_types (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_tea_types_name (name)
);

CREATE TABLE IF NOT EXISTS tea_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  tea_type_id INT NOT NULL,
  logged_at DATETIME NOT NULL,
  moods JSON NULL,
  notes TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_tea_logs_logged_at (logged_at),
  CONSTRAINT fk_tea_logs_tea_type
    FOREIGN KEY (tea_type_id) REFERENCES tea_types(id)
    ON DELETE RESTRICT
);

INSERT IGNORE INTO tea_types (name, is_active)
VALUES
  ('Spearmint', 1),
  ('Green Tea', 1),
  ('Chamomile', 1),
  ('Ginger Tea', 1),
  ('Chai', 1);

-- Glow Action Row: Gym
CREATE TABLE IF NOT EXISTS gym_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  date DATE NOT NULL,
  workout_type ENUM('glutes','legs','upper','cardio','rest','custom') NOT NULL DEFAULT 'glutes',
  duration_minutes INT NOT NULL,
  intensity ENUM('low','medium','high') NOT NULL DEFAULT 'medium',
  notes TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_gym_logs_date (date)
);

CREATE TABLE IF NOT EXISTS gym_weekly_plan (
  id INT AUTO_INCREMENT PRIMARY KEY,
  day_of_week ENUM('mon','tue','wed','thu','fri','sat','sun') NOT NULL,
  workout_type ENUM('glutes','legs','upper','cardio','rest','custom') NOT NULL DEFAULT 'rest',
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_gym_weekly_plan_day (day_of_week)
);

INSERT IGNORE INTO gym_weekly_plan (day_of_week, workout_type, is_active)
VALUES
  ('mon', 'glutes', 1),
  ('tue', 'upper', 1),
  ('wed', 'legs', 1),
  ('thu', 'cardio', 1),
  ('fri', 'glutes', 1),
  ('sat', 'rest', 1),
  ('sun', 'rest', 1);
