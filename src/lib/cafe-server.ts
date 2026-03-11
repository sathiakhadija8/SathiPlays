import pool from './db';

export type CafeBookKey = 'friendship' | 'solo' | 'pinterest';

let initPromise: Promise<void> | null = null;

export function getCafeUserId() {
  return 1;
}

export async function ensureCafeTables() {
  if (!initPromise) {
    initPromise = (async () => {
      await pool.execute(`
        CREATE TABLE IF NOT EXISTS cafe_memory_entries (
          id INT AUTO_INCREMENT PRIMARY KEY,
          user_id INT NOT NULL DEFAULT 1,
          book_key ENUM('friendship','solo','pinterest') NOT NULL,
          title VARCHAR(220) NOT NULL,
          entry_date DATE NOT NULL,
          mood VARCHAR(120) NOT NULL,
          note TEXT NULL,
          images_json LONGTEXT NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          KEY idx_cafe_memory_user_book (user_id, book_key),
          KEY idx_cafe_memory_date (entry_date)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
      `);

      await pool.execute(`
        CREATE TABLE IF NOT EXISTS cafe_places (
          id INT AUTO_INCREMENT PRIMARY KEY,
          user_id INT NOT NULL DEFAULT 1,
          name VARCHAR(220) NOT NULL,
          location VARCHAR(220) NOT NULL,
          visited_date DATE NOT NULL,
          rating TINYINT NOT NULL DEFAULT 4,
          note TEXT NULL,
          images_json LONGTEXT NOT NULL,
          tag VARCHAR(60) NOT NULL DEFAULT 'Cafe',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          KEY idx_cafe_places_user_date (user_id, visited_date),
          KEY idx_cafe_places_tag (tag)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
      `);

      await pool.execute(`
        CREATE TABLE IF NOT EXISTS cafe_magazines (
          id INT AUTO_INCREMENT PRIMARY KEY,
          user_id INT NOT NULL DEFAULT 1,
          label VARCHAR(120) NOT NULL,
          title VARCHAR(220) NOT NULL,
          issue_date DATE NOT NULL,
          a4_template_src LONGTEXT NULL,
          elements_json LONGTEXT NOT NULL,
          cover_preview_image LONGTEXT NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          KEY idx_cafe_mag_user_date (user_id, issue_date),
          KEY idx_cafe_mag_created (created_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
      `);
    })();
  }

  await initPromise;
}

export function parseJsonArray(input: unknown): string[] {
  if (Array.isArray(input)) {
    return input.filter((value): value is string => typeof value === 'string');
  }
  if (typeof input !== 'string' || !input.trim()) return [];
  try {
    const parsed = JSON.parse(input);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((value): value is string => typeof value === 'string');
  } catch {
    return [];
  }
}

export function parseJsonObject<T>(input: unknown, fallback: T): T {
  if (input && typeof input === 'object') return input as T;
  if (typeof input !== 'string' || !input.trim()) return fallback;
  try {
    const parsed = JSON.parse(input);
    if (parsed && typeof parsed === 'object') return parsed as T;
    return fallback;
  } catch {
    return fallback;
  }
}

