import pool from './db';

let initPromise: Promise<void> | null = null;

export function getTravelUserId() {
  return 1;
}

export async function ensureTravelTables() {
  if (!initPromise) {
    initPromise = (async () => {
      await pool.execute(`
        CREATE TABLE IF NOT EXISTS travel_trips (
          id INT AUTO_INCREMENT PRIMARY KEY,
          user_id INT NOT NULL DEFAULT 1,
          city VARCHAR(160) NOT NULL,
          country VARCHAR(160) NOT NULL,
          start_date DATE NOT NULL,
          end_date DATE NOT NULL,
          status ENUM('dream','upcoming','completed') NOT NULL DEFAULT 'dream',
          cover_image LONGTEXT NOT NULL,
          planned_budget DECIMAL(10,2) NOT NULL DEFAULT 0,
          spent_budget DECIMAL(10,2) NOT NULL DEFAULT 0,
          reflection TEXT NULL,
          gallery_json LONGTEXT NOT NULL,
          places_json LONGTEXT NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          KEY idx_travel_trips_user (user_id),
          KEY idx_travel_trips_status (status),
          KEY idx_travel_trips_dates (start_date, end_date)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
      `);

      await pool.execute(`
        CREATE TABLE IF NOT EXISTS travel_dreams (
          id INT AUTO_INCREMENT PRIMARY KEY,
          user_id INT NOT NULL DEFAULT 1,
          city VARCHAR(160) NOT NULL,
          country VARCHAR(160) NOT NULL,
          image LONGTEXT NOT NULL,
          budget_estimate DECIMAL(10,2) NOT NULL DEFAULT 0,
          trip_type ENUM('UK','Overseas') NOT NULL DEFAULT 'Overseas',
          why_text TEXT NULL,
          vibe ENUM('Solo','Friends','Romantic','Cultural') NOT NULL DEFAULT 'Solo',
          savings_goal DECIMAL(10,2) NOT NULL DEFAULT 0,
          saved_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          KEY idx_travel_dreams_user (user_id),
          KEY idx_travel_dreams_type (trip_type)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
      `);

      await pool.execute(`
        CREATE TABLE IF NOT EXISTS travel_planners (
          id INT AUTO_INCREMENT PRIMARY KEY,
          user_id INT NOT NULL DEFAULT 1,
          trip_id INT NOT NULL,
          itinerary_json LONGTEXT NOT NULL,
          packing_json LONGTEXT NOT NULL,
          budget_json LONGTEXT NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          UNIQUE KEY uniq_travel_planner_trip (trip_id),
          KEY idx_travel_planner_user (user_id),
          CONSTRAINT fk_travel_planner_trip
            FOREIGN KEY (trip_id) REFERENCES travel_trips(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
      `);
    })();
  }

  await initPromise;
}

export function parseStringArray(input: unknown): string[] {
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

export function parseObject<T>(input: unknown, fallback: T): T {
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
