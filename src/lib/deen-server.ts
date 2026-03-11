import { type RowDataPacket } from 'mysql2';
import pool from './db';

export const DEEN_DHIKR_TYPES = ['SubhanAllah', 'Alhamdulillah', 'Allahu Akbar', 'Salawat', 'Istighfar'] as const;
export const DEEN_SALAH_ORDER = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha', 'tahajjud'] as const;
// Backward-compatible checklist export for legacy routes.
export const DEEN_ITEMS = [
  { key: 'fajr', label: 'Fajr' },
  { key: 'dhuhr', label: 'Dhuhr' },
  { key: 'asr', label: 'Asr' },
  { key: 'maghrib', label: 'Maghrib' },
  { key: 'isha', label: 'Isha' },
  { key: 'quran', label: 'Quran' },
  { key: 'dhikr', label: 'Dhikr' },
] as const;

let initPromise: Promise<void> | null = null;

export async function ensureDeenTables() {
  if (!initPromise) {
    initPromise = (async () => {
      await pool.execute(`
        CREATE TABLE IF NOT EXISTS deen_learning_sessions (
          id INT AUTO_INCREMENT PRIMARY KEY,
          log_date DATE NOT NULL,
          planned_minutes INT NOT NULL,
          actual_minutes INT NOT NULL,
          started_at DATETIME NULL,
          ended_at DATETIME NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          KEY idx_deen_learning_date (log_date)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
      `);

      await pool.execute(`
        CREATE TABLE IF NOT EXISTS deen_dhikr_logs (
          id INT AUTO_INCREMENT PRIMARY KEY,
          log_date DATE NOT NULL,
          dhikr_type VARCHAR(60) NOT NULL,
          logged_at DATETIME NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          KEY idx_deen_dhikr_date (log_date),
          KEY idx_deen_dhikr_type (dhikr_type)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
      `);

      await pool.execute(`
        CREATE TABLE IF NOT EXISTS deen_salah_logs (
          id INT AUTO_INCREMENT PRIMARY KEY,
          log_date DATE NOT NULL,
          prayer_key VARCHAR(20) NOT NULL,
          prayed_at DATETIME NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE KEY uniq_deen_salah_day_prayer (log_date, prayer_key),
          KEY idx_deen_salah_date (log_date)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
      `);

      await pool.execute(`
        CREATE TABLE IF NOT EXISTS deen_quran_progress (
          id INT AUTO_INCREMENT PRIMARY KEY,
          log_date DATE NOT NULL,
          pages_read INT NOT NULL DEFAULT 0,
          daily_goal INT NOT NULL DEFAULT 5,
          mushaf_version VARCHAR(120) NULL,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          UNIQUE KEY uniq_deen_quran_day (log_date)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
      `);

      await pool.execute(`
        CREATE TABLE IF NOT EXISTS deen_reflections (
          id INT AUTO_INCREMENT PRIMARY KEY,
          log_date DATE NOT NULL,
          q1 TEXT NULL,
          q2 TEXT NULL,
          q3 TEXT NULL,
          q4 TEXT NULL,
          q5 TEXT NULL,
          q6 TEXT NULL,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          UNIQUE KEY uniq_deen_reflection_day (log_date)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
      `);

      await pool.execute(`
        CREATE TABLE IF NOT EXISTS deen_daily_checks (
          id INT AUTO_INCREMENT PRIMARY KEY,
          log_date DATE NOT NULL,
          item_key VARCHAR(40) NOT NULL,
          is_done TINYINT(1) NOT NULL DEFAULT 0,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          UNIQUE KEY uniq_deen_daily_check (log_date, item_key),
          KEY idx_deen_daily_checks_date (log_date)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
      `);

      await pool.execute(`
        CREATE TABLE IF NOT EXISTS deen_daily_notes (
          id INT AUTO_INCREMENT PRIMARY KEY,
          note_date DATE NOT NULL,
          note TEXT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          UNIQUE KEY uniq_deen_daily_note (note_date),
          KEY idx_deen_daily_notes_date (note_date)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
      `);
    })();
  }

  await initPromise;
}

export function londonTodayYmd() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/London',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());

  const year = parts.find((part) => part.type === 'year')?.value ?? '1970';
  const month = parts.find((part) => part.type === 'month')?.value ?? '01';
  const day = parts.find((part) => part.type === 'day')?.value ?? '01';

  return `${year}-${month}-${day}`;
}

// Backward-compatible alias for legacy routes.
export const todayYmd = londonTodayYmd;

export function isValidYmd(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export type DhikrCountRow = RowDataPacket & {
  dhikr_type: string;
  count: number | null;
};

export type SalahRow = RowDataPacket & {
  prayer_key: string;
};

export type LearningRow = RowDataPacket & {
  total_minutes: number | null;
};

export type QuranRow = RowDataPacket & {
  pages_read: number | null;
  daily_goal: number | null;
  mushaf_version: string | null;
};

export type ReflectionRow = RowDataPacket & {
  q1: string | null;
  q2: string | null;
  q3: string | null;
  q4: string | null;
  q5: string | null;
  q6: string | null;
};

// Backward-compatible legacy row types.
export type DeenCheckRow = RowDataPacket & {
  item_key: string;
  is_done: number;
};

export type DeenNoteRow = RowDataPacket & {
  note: string | null;
};

export type FullDayRow = RowDataPacket & {
  complete_days: number | null;
};

export function toNumber(value: unknown) {
  const num = Number(value ?? 0);
  return Number.isFinite(num) ? num : 0;
}
