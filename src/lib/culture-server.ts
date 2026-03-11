import pool from './db';

let schemaReady = false;

export async function ensureCultureSchema() {
  if (schemaReady) return;

  await pool.execute(`
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
    )
  `);

  schemaReady = true;
}

