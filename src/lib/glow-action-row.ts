import { type RowDataPacket } from 'mysql2';
import pool from './db';
import { localTodayYMD } from './glow-schedule';

export type GymWorkoutType = 'glutes' | 'legs' | 'upper' | 'cardio' | 'rest' | 'custom';
export type GymIntensity = 'low' | 'medium' | 'high';
export type GymPlanDay = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';

const DAY_KEYS: GymPlanDay[] = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

let schemaReadyPromise: Promise<void> | null = null;

type CountRow = RowDataPacket & { c: number };

export function dayKeyFromDate(date = new Date()): GymPlanDay {
  return DAY_KEYS[date.getDay()];
}

export function normalizeWorkoutType(value: unknown): GymWorkoutType {
  if (value === 'legs' || value === 'upper' || value === 'cardio' || value === 'rest' || value === 'custom') return value;
  return 'glutes';
}

export function normalizeIntensity(value: unknown): GymIntensity {
  if (value === 'low' || value === 'high') return value;
  return 'medium';
}

export function normalizePlanDay(value: unknown): GymPlanDay {
  if (value === 'mon' || value === 'tue' || value === 'wed' || value === 'thu' || value === 'fri' || value === 'sat' || value === 'sun') return value;
  return 'mon';
}

async function hasColumn(tableName: string, columnName: string) {
  const [rows] = await pool.execute<CountRow[]>(
    `
      SELECT COUNT(*) AS c
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = ?
        AND COLUMN_NAME = ?
    `,
    [tableName, columnName],
  );
  return Number(rows[0]?.c ?? 0) > 0;
}

export async function ensureGlowActionRowSchema() {
  if (!schemaReadyPromise) {
    schemaReadyPromise = (async () => {
      await pool.execute(`
        CREATE TABLE IF NOT EXISTS gym_logs (
          id INT AUTO_INCREMENT PRIMARY KEY,
          date DATE NOT NULL,
          workout_type ENUM('glutes','legs','upper','cardio','rest','custom') NOT NULL DEFAULT 'glutes',
          duration_minutes INT NOT NULL,
          intensity ENUM('low','medium','high') NOT NULL DEFAULT 'medium',
          notes TEXT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          INDEX idx_gym_logs_date (date)
        )
      `);
      const gymDateExists = await hasColumn('gym_logs', 'date');
      if (!gymDateExists) {
        await pool.execute(`ALTER TABLE gym_logs ADD COLUMN date DATE NULL AFTER id`);
      }
      const gymLogDateExists = await hasColumn('gym_logs', 'log_date');
      if (gymLogDateExists) {
        await pool.execute(`UPDATE gym_logs SET date = COALESCE(date, log_date)`);
      }
      await pool.execute(`UPDATE gym_logs SET date = COALESCE(date, CURDATE()) WHERE date IS NULL`);

      await pool.execute(`
        CREATE TABLE IF NOT EXISTS gym_weekly_plan (
          id INT AUTO_INCREMENT PRIMARY KEY,
          day_of_week ENUM('mon','tue','wed','thu','fri','sat','sun') NOT NULL,
          workout_type ENUM('glutes','legs','upper','cardio','rest','custom') NOT NULL DEFAULT 'rest',
          is_active TINYINT(1) NOT NULL DEFAULT 1,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          UNIQUE KEY uniq_gym_weekly_plan_day (day_of_week)
        )
      `);

      await pool.execute(`
        INSERT IGNORE INTO gym_weekly_plan (day_of_week, workout_type, is_active)
        VALUES
          ('mon', 'glutes', 1),
          ('tue', 'upper', 1),
          ('wed', 'legs', 1),
          ('thu', 'cardio', 1),
          ('fri', 'glutes', 1),
          ('sat', 'rest', 1),
          ('sun', 'rest', 1)
      `);

      await pool.execute(`
        CREATE TABLE IF NOT EXISTS tea_types (
          id INT AUTO_INCREMENT PRIMARY KEY,
          name VARCHAR(120) NOT NULL,
          is_active TINYINT(1) NOT NULL DEFAULT 1,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE KEY uniq_tea_types_name (name)
        )
      `);

      await pool.execute(`
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
        )
      `);
    })();
  }

  await schemaReadyPromise;
}

type NumberRow = RowDataPacket & { value: number | null };
type GymTodayRow = RowDataPacket & {
  id: number;
  date: string;
  workout_type: GymWorkoutType;
  duration_minutes: number;
  intensity: GymIntensity;
  notes: string | null;
  created_at: string;
};
type PlanRow = RowDataPacket & {
  id: number;
  day_of_week: GymPlanDay;
  workout_type: GymWorkoutType;
  is_active: number;
};

export async function getActionRowToday() {
  await ensureGlowActionRowSchema();
  const today = localTodayYMD();
  const dayKey = dayKeyFromDate(new Date(`${today}T00:00:00`));

  const [waterRes, stepsRes, teaRes, gymRes, planRes] = await Promise.all([
    pool.execute<NumberRow[]>(`SELECT COALESCE(SUM(amount_ml), 0) AS value FROM water_logs WHERE log_date = ?`, [today]),
    pool.execute<NumberRow[]>(`SELECT COALESCE(SUM(steps), 0) AS value FROM steps_logs WHERE log_date = ?`, [today]),
    pool.execute<NumberRow[]>(`SELECT COUNT(*) AS value FROM tea_logs WHERE DATE(logged_at) = ?`, [today]),
    pool.execute<GymTodayRow[]>(
      `
        SELECT id, DATE_FORMAT(date, '%Y-%m-%d') AS date, workout_type, duration_minutes, intensity, notes,
               DATE_FORMAT(created_at, '%Y-%m-%d %H:%i:%s') AS created_at
        FROM gym_logs
        WHERE date = ?
        ORDER BY created_at DESC, id DESC
        LIMIT 1
      `,
      [today],
    ),
    pool.execute<PlanRow[]>(
      `SELECT id, day_of_week, workout_type, is_active FROM gym_weekly_plan WHERE day_of_week = ? LIMIT 1`,
      [dayKey],
    ),
  ]);

  const waterMl = Number(waterRes[0][0]?.value ?? 0);
  const stepsTotal = Number(stepsRes[0][0]?.value ?? 0);
  const teaCountToday = Number(teaRes[0][0]?.value ?? 0);
  const gymToday = gymRes[0][0] ?? null;
  const gymPlanned = planRes[0][0] ?? null;

  return {
    date: today,
    water_ml: waterMl,
    water_cups: Math.round(waterMl / 250),
    steps_total: stepsTotal,
    tea_count_today: teaCountToday,
    gym_today: gymToday,
    gym_planned: gymPlanned
      ? {
          day_of_week: gymPlanned.day_of_week,
          workout_type: gymPlanned.workout_type,
          is_active: Number(gymPlanned.is_active) === 1 ? 1 : 0,
        }
      : null,
  };
}
