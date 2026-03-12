-- Migration: 20260311_173500_refine_home_closet_portals.sql
-- Refines closet into inventory + laundry log + outfit planner foundation.

SET @closet_items_subcategory_exists := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'closet_items' AND COLUMN_NAME = 'subcategory'
);
SET @closet_items_subcategory_sql := IF(
  @closet_items_subcategory_exists = 0,
  'ALTER TABLE closet_items ADD COLUMN subcategory VARCHAR(120) NULL AFTER category',
  'SELECT 1'
);
PREPARE stmt_closet_items_subcategory FROM @closet_items_subcategory_sql;
EXECUTE stmt_closet_items_subcategory;
DEALLOCATE PREPARE stmt_closet_items_subcategory;

SET @closet_items_color_exists := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'closet_items' AND COLUMN_NAME = 'color'
);
SET @closet_items_color_sql := IF(
  @closet_items_color_exists = 0,
  'ALTER TABLE closet_items ADD COLUMN color VARCHAR(60) NULL AFTER size',
  'SELECT 1'
);
PREPARE stmt_closet_items_color FROM @closet_items_color_sql;
EXECUTE stmt_closet_items_color;
DEALLOCATE PREPARE stmt_closet_items_color;

SET @closet_items_brand_exists := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'closet_items' AND COLUMN_NAME = 'brand'
);
SET @closet_items_brand_sql := IF(
  @closet_items_brand_exists = 0,
  'ALTER TABLE closet_items ADD COLUMN brand VARCHAR(120) NULL AFTER color',
  'SELECT 1'
);
PREPARE stmt_closet_items_brand FROM @closet_items_brand_sql;
EXECUTE stmt_closet_items_brand;
DEALLOCATE PREPARE stmt_closet_items_brand;

SET @closet_items_season_exists := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'closet_items' AND COLUMN_NAME = 'season'
);
SET @closet_items_season_sql := IF(
  @closet_items_season_exists = 0,
  'ALTER TABLE closet_items ADD COLUMN season VARCHAR(60) NULL AFTER brand',
  'SELECT 1'
);
PREPARE stmt_closet_items_season FROM @closet_items_season_sql;
EXECUTE stmt_closet_items_season;
DEALLOCATE PREPARE stmt_closet_items_season;

SET @closet_items_occasion_exists := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'closet_items' AND COLUMN_NAME = 'occasion'
);
SET @closet_items_occasion_sql := IF(
  @closet_items_occasion_exists = 0,
  'ALTER TABLE closet_items ADD COLUMN occasion VARCHAR(120) NULL AFTER season',
  'SELECT 1'
);
PREPARE stmt_closet_items_occasion FROM @closet_items_occasion_sql;
EXECUTE stmt_closet_items_occasion;
DEALLOCATE PREPARE stmt_closet_items_occasion;

SET @closet_items_notes_exists := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'closet_items' AND COLUMN_NAME = 'notes'
);
SET @closet_items_notes_sql := IF(
  @closet_items_notes_exists = 0,
  'ALTER TABLE closet_items ADD COLUMN notes TEXT NULL AFTER image_path',
  'SELECT 1'
);
PREPARE stmt_closet_items_notes FROM @closet_items_notes_sql;
EXECUTE stmt_closet_items_notes;
DEALLOCATE PREPARE stmt_closet_items_notes;

SET @closet_items_favorite_exists := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'closet_items' AND COLUMN_NAME = 'is_favorite'
);
SET @closet_items_favorite_sql := IF(
  @closet_items_favorite_exists = 0,
  'ALTER TABLE closet_items ADD COLUMN is_favorite TINYINT(1) NOT NULL DEFAULT 0 AFTER notes',
  'SELECT 1'
);
PREPARE stmt_closet_items_favorite FROM @closet_items_favorite_sql;
EXECUTE stmt_closet_items_favorite;
DEALLOCATE PREPARE stmt_closet_items_favorite;

SET @closet_items_archived_exists := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'closet_items' AND COLUMN_NAME = 'is_archived'
);
SET @closet_items_archived_sql := IF(
  @closet_items_archived_exists = 0,
  'ALTER TABLE closet_items ADD COLUMN is_archived TINYINT(1) NOT NULL DEFAULT 0 AFTER is_favorite',
  'SELECT 1'
);
PREPARE stmt_closet_items_archived FROM @closet_items_archived_sql;
EXECUTE stmt_closet_items_archived;
DEALLOCATE PREPARE stmt_closet_items_archived;

SET @closet_items_wear_count_exists := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'closet_items' AND COLUMN_NAME = 'wear_count'
);
SET @closet_items_wear_count_sql := IF(
  @closet_items_wear_count_exists = 0,
  'ALTER TABLE closet_items ADD COLUMN wear_count INT NOT NULL DEFAULT 0 AFTER is_archived',
  'SELECT 1'
);
PREPARE stmt_closet_items_wear_count FROM @closet_items_wear_count_sql;
EXECUTE stmt_closet_items_wear_count;
DEALLOCATE PREPARE stmt_closet_items_wear_count;

SET @closet_items_last_worn_exists := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'closet_items' AND COLUMN_NAME = 'last_worn_at'
);
SET @closet_items_last_worn_sql := IF(
  @closet_items_last_worn_exists = 0,
  'ALTER TABLE closet_items ADD COLUMN last_worn_at DATETIME NULL AFTER wear_count',
  'SELECT 1'
);
PREPARE stmt_closet_items_last_worn FROM @closet_items_last_worn_sql;
EXECUTE stmt_closet_items_last_worn;
DEALLOCATE PREPARE stmt_closet_items_last_worn;

SET @closet_items_created_exists := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'closet_items' AND COLUMN_NAME = 'created_at'
);
SET @closet_items_created_sql := IF(
  @closet_items_created_exists = 0,
  'ALTER TABLE closet_items ADD COLUMN created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP AFTER state',
  'SELECT 1'
);
PREPARE stmt_closet_items_created FROM @closet_items_created_sql;
EXECUTE stmt_closet_items_created;
DEALLOCATE PREPARE stmt_closet_items_created;

UPDATE closet_items
SET state = 'in_closet'
WHERE state NOT IN ('in_closet', 'dirty');

ALTER TABLE closet_items
  MODIFY COLUMN state ENUM('in_closet','dirty') NOT NULL DEFAULT 'in_closet';

SET @idx_closet_items_archived_state_exists := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'closet_items' AND INDEX_NAME = 'idx_closet_items_archived_state'
);
SET @idx_closet_items_archived_state_sql := IF(
  @idx_closet_items_archived_state_exists = 0,
  'ALTER TABLE closet_items ADD INDEX idx_closet_items_archived_state (is_archived, state)',
  'SELECT 1'
);
PREPARE stmt_idx_closet_items_archived_state FROM @idx_closet_items_archived_state_sql;
EXECUTE stmt_idx_closet_items_archived_state;
DEALLOCATE PREPARE stmt_idx_closet_items_archived_state;

SET @idx_closet_items_favorite_exists := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'closet_items' AND INDEX_NAME = 'idx_closet_items_favorite'
);
SET @idx_closet_items_favorite_sql := IF(
  @idx_closet_items_favorite_exists = 0,
  'ALTER TABLE closet_items ADD INDEX idx_closet_items_favorite (is_favorite)',
  'SELECT 1'
);
PREPARE stmt_idx_closet_items_favorite FROM @idx_closet_items_favorite_sql;
EXECUTE stmt_idx_closet_items_favorite;
DEALLOCATE PREPARE stmt_idx_closet_items_favorite;

SET @idx_closet_items_category_exists := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'closet_items' AND INDEX_NAME = 'idx_closet_items_category'
);
SET @idx_closet_items_category_sql := IF(
  @idx_closet_items_category_exists = 0,
  'ALTER TABLE closet_items ADD INDEX idx_closet_items_category (category)',
  'SELECT 1'
);
PREPARE stmt_idx_closet_items_category FROM @idx_closet_items_category_sql;
EXECUTE stmt_idx_closet_items_category;
DEALLOCATE PREPARE stmt_idx_closet_items_category;

SET @idx_closet_items_season_exists := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'closet_items' AND INDEX_NAME = 'idx_closet_items_season'
);
SET @idx_closet_items_season_sql := IF(
  @idx_closet_items_season_exists = 0,
  'ALTER TABLE closet_items ADD INDEX idx_closet_items_season (season)',
  'SELECT 1'
);
PREPARE stmt_idx_closet_items_season FROM @idx_closet_items_season_sql;
EXECUTE stmt_idx_closet_items_season;
DEALLOCATE PREPARE stmt_idx_closet_items_season;

SET @idx_closet_items_occasion_exists := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'closet_items' AND INDEX_NAME = 'idx_closet_items_occasion'
);
SET @idx_closet_items_occasion_sql := IF(
  @idx_closet_items_occasion_exists = 0,
  'ALTER TABLE closet_items ADD INDEX idx_closet_items_occasion (occasion)',
  'SELECT 1'
);
PREPARE stmt_idx_closet_items_occasion FROM @idx_closet_items_occasion_sql;
EXECUTE stmt_idx_closet_items_occasion;
DEALLOCATE PREPARE stmt_idx_closet_items_occasion;

CREATE TABLE IF NOT EXISTS closet_item_logs (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  closet_item_id INT NOT NULL,
  from_state ENUM('in_closet','dirty') NULL,
  to_state ENUM('in_closet','dirty') NOT NULL,
  notes VARCHAR(255) NULL,
  changed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_closet_item_logs_item (closet_item_id),
  INDEX idx_closet_item_logs_changed (changed_at),
  CONSTRAINT fk_closet_item_logs_item
    FOREIGN KEY (closet_item_id) REFERENCES closet_items(id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS closet_outfits (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(160) NOT NULL,
  vibe VARCHAR(120) NULL,
  occasion VARCHAR(120) NULL,
  season VARCHAR(60) NULL,
  notes TEXT NULL,
  preview_image_path VARCHAR(400) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_closet_outfits_updated (updated_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS closet_outfit_items (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  outfit_id BIGINT UNSIGNED NOT NULL,
  closet_item_id INT NOT NULL,
  slot_type ENUM('headwear','outerwear','top','bottom','dress','shoes','bag','accessory') NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_closet_outfit_slot (outfit_id, slot_type, sort_order),
  INDEX idx_closet_outfit_items_outfit (outfit_id),
  INDEX idx_closet_outfit_items_item (closet_item_id),
  CONSTRAINT fk_closet_outfit_items_outfit
    FOREIGN KEY (outfit_id) REFERENCES closet_outfits(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_closet_outfit_items_item
    FOREIGN KEY (closet_item_id) REFERENCES closet_items(id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
