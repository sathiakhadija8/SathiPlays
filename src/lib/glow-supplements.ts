import { type RowDataPacket } from 'mysql2';
import pool from './db';
import { localTodayYMD } from './glow-schedule';

export { localTodayYMD };

export type FrequencyType = 'daily' | 'weekly' | 'monthly';
export type TimeOfDay = 'morning' | 'evening' | 'night';
export type IntakeMode = 'empty_stomach' | 'with_food';

export type SupplementConfigRow = RowDataPacket & {
  id: number;
  name: string;
  dosage: string | null;
  frequency_type: FrequencyType;
  times_per_day: number;
  day_of_week: number | null;
  days_of_week_json: unknown;
  specific_date: number | null;
  time_of_day: TimeOfDay;
  primary_time: string | null;
  secondary_time: string | null;
  intake_mode: IntakeMode;
  is_active: number;
};

let schemaReadyPromise: Promise<void> | null = null;

type CountRow = RowDataPacket & { c: number };
type DateTimeRow = RowDataPacket & { scheduled_datetime: string | Date | null };
type ActiveRow = RowDataPacket & { is_active: number };

function normalizeFrequency(value: unknown): FrequencyType {
  return value === 'weekly' || value === 'monthly' ? value : 'daily';
}

function normalizeTimesPerDay(value: unknown): 1 | 2 {
  return Number(value) === 2 ? 2 : 1;
}

function normalizeTimeOfDay(value: unknown): TimeOfDay {
  return value === 'evening' || value === 'night' ? value : 'morning';
}

function parseDaysOfWeekJson(value: unknown): number[] {
  let raw: unknown = value;
  if (typeof value === 'string') {
    try {
      raw = JSON.parse(value);
    } catch {
      raw = null;
    }
  }
  if (!Array.isArray(raw)) return [];
  const unique = new Set<number>();
  for (const entry of raw) {
    const n = Number(entry);
    if (Number.isInteger(n) && n >= 0 && n <= 6) unique.add(n);
  }
  return [...unique].sort((a, b) => a - b);
}

function normalizeClockTime(value: unknown) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(trimmed)) return trimmed;
  if (/^(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d$/.test(trimmed)) return trimmed.slice(0, 5);
  return null;
}

function defaultPrimaryTime(timeOfDay: TimeOfDay) {
  if (timeOfDay === 'evening') return '18:00';
  if (timeOfDay === 'night') return '22:00';
  return '08:00';
}

function defaultSecondaryTime(primaryTime: string) {
  return primaryTime < '12:00' ? '20:00' : '08:00';
}

function shiftYmd(ymd: string, days: number) {
  const base = new Date(`${ymd}T00:00:00`);
  base.setDate(base.getDate() + days);
  return localTodayYMD(base);
}

function ymdRange(startYmd: string, endYmd: string) {
  const dates: string[] = [];
  const cursor = new Date(`${startYmd}T00:00:00`);
  const end = new Date(`${endYmd}T00:00:00`);
  while (cursor <= end) {
    dates.push(localTodayYMD(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return dates;
}

function toDateTimeKey(value: string | Date | null | undefined) {
  if (!value) return '';
  if (value instanceof Date) {
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, '0');
    const day = String(value.getDate()).padStart(2, '0');
    const hour = String(value.getHours()).padStart(2, '0');
    const minute = String(value.getMinutes()).padStart(2, '0');
    const second = String(value.getSeconds()).padStart(2, '0');
    return `${year}-${month}-${day} ${hour}:${minute}:${second}`;
  }
  const normalized = value.replace('T', ' ').slice(0, 19);
  return /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(normalized) ? normalized : '';
}

function shouldScheduleOnDate(config: SupplementConfigRow, ymd: string) {
  const date = new Date(`${ymd}T00:00:00`);
  const frequency = normalizeFrequency(config.frequency_type);
  if (frequency === 'daily') return true;
  if (frequency === 'weekly') {
    const targets = parseDaysOfWeekJson(config.days_of_week_json);
    if (targets.length > 0) return targets.includes(date.getDay());
    const target = Number.isInteger(config.day_of_week) ? Number(config.day_of_week) : 1;
    return date.getDay() === target;
  }
  const monthlyDay = Number.isInteger(config.specific_date) ? Number(config.specific_date) : 1;
  return date.getDate() === monthlyDay;
}

function scheduleTimesFor(config: SupplementConfigRow) {
  const timesPerDay = normalizeTimesPerDay(config.times_per_day);
  const primary = normalizeClockTime(config.primary_time) ?? defaultPrimaryTime(normalizeTimeOfDay(config.time_of_day));
  if (timesPerDay === 2) {
    const secondaryRaw = normalizeClockTime(config.secondary_time) ?? defaultSecondaryTime(primary);
    const secondary = secondaryRaw === primary ? defaultSecondaryTime(primary) : secondaryRaw;
    return [primary, secondary].sort();
  }

  return [primary];
}

function buildDateTimes(config: SupplementConfigRow, startYmd: string, endYmd: string) {
  const result: string[] = [];
  const times = scheduleTimesFor(config);
  for (const dateYmd of ymdRange(startYmd, endYmd)) {
    if (!shouldScheduleOnDate(config, dateYmd)) continue;
    for (const hhmm of times) result.push(`${dateYmd} ${hhmm}:00`);
  }
  return result;
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

async function ensureColumn(tableName: string, columnName: string, alterSql: string) {
  const exists = await hasColumn(tableName, columnName);
  if (!exists) await pool.execute(alterSql);
}

export async function ensureSupplementSchema() {
  if (!schemaReadyPromise) {
    schemaReadyPromise = (async () => {
      await pool.execute(`
        CREATE TABLE IF NOT EXISTS supplements (
          id INT AUTO_INCREMENT PRIMARY KEY,
          name VARCHAR(160) NOT NULL,
          dosage_text VARCHAR(120) NULL,
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
          timing VARCHAR(80) NULL,
          notes VARCHAR(255) NULL,
          is_active TINYINT(1) DEFAULT 1,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        )
      `);

      await ensureColumn('supplements', 'dosage', `ALTER TABLE supplements ADD COLUMN dosage VARCHAR(120) NULL AFTER name`);
      await ensureColumn(
        'supplements',
        'frequency_type',
        `ALTER TABLE supplements ADD COLUMN frequency_type ENUM('daily','weekly','monthly') NOT NULL DEFAULT 'daily' AFTER dosage`,
      );
      await ensureColumn(
        'supplements',
        'times_per_day',
        `ALTER TABLE supplements ADD COLUMN times_per_day TINYINT NOT NULL DEFAULT 1 AFTER frequency_type`,
      );
      await ensureColumn(
        'supplements',
        'day_of_week',
        `ALTER TABLE supplements ADD COLUMN day_of_week TINYINT NULL AFTER times_per_day`,
      );
      await ensureColumn(
        'supplements',
        'days_of_week_json',
        `ALTER TABLE supplements ADD COLUMN days_of_week_json JSON NULL AFTER day_of_week`,
      );
      await ensureColumn(
        'supplements',
        'specific_date',
        `ALTER TABLE supplements ADD COLUMN specific_date TINYINT NULL AFTER days_of_week_json`,
      );
      await ensureColumn(
        'supplements',
        'time_of_day',
        `ALTER TABLE supplements ADD COLUMN time_of_day ENUM('morning','evening','night') NOT NULL DEFAULT 'morning' AFTER specific_date`,
      );
      await ensureColumn('supplements', 'primary_time', `ALTER TABLE supplements ADD COLUMN primary_time CHAR(5) NULL AFTER time_of_day`);
      await ensureColumn('supplements', 'secondary_time', `ALTER TABLE supplements ADD COLUMN secondary_time CHAR(5) NULL AFTER primary_time`);
      await ensureColumn(
        'supplements',
        'intake_mode',
        `ALTER TABLE supplements ADD COLUMN intake_mode ENUM('empty_stomach','with_food') NOT NULL DEFAULT 'with_food' AFTER time_of_day`,
      );
      await ensureColumn('supplements', 'dosage_text', `ALTER TABLE supplements ADD COLUMN dosage_text VARCHAR(120) NULL AFTER dosage`);
      await ensureColumn('supplements', 'timing', `ALTER TABLE supplements ADD COLUMN timing VARCHAR(80) NULL AFTER dosage_text`);
      await ensureColumn('supplements', 'notes', `ALTER TABLE supplements ADD COLUMN notes VARCHAR(255) NULL AFTER timing`);

      await pool.execute(`
        CREATE TABLE IF NOT EXISTS supplement_logs (
          id INT AUTO_INCREMENT PRIMARY KEY,
          supplement_id INT NOT NULL,
          scheduled_id INT NULL,
          log_date DATE NOT NULL,
          taken_at DATETIME NOT NULL,
          status ENUM('taken') DEFAULT 'taken',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          scheduled_datetime DATETIME NULL,
          completed TINYINT(1) NOT NULL DEFAULT 1,
          completed_at DATETIME NULL,
          INDEX idx_supplement_logs_log_date (log_date),
          INDEX idx_supplement_logs_supplement_id (supplement_id),
          INDEX idx_supplement_logs_scheduled_datetime (scheduled_datetime),
          INDEX idx_supplement_logs_completed (completed),
          CONSTRAINT fk_supplement_logs_supplement
            FOREIGN KEY (supplement_id) REFERENCES supplements(id)
            ON DELETE CASCADE
        )
      `);

      await ensureColumn(
        'supplement_logs',
        'scheduled_datetime',
        `ALTER TABLE supplement_logs ADD COLUMN scheduled_datetime DATETIME NULL AFTER created_at`,
      );
      await ensureColumn(
        'supplement_logs',
        'completed',
        `ALTER TABLE supplement_logs ADD COLUMN completed TINYINT(1) NOT NULL DEFAULT 1 AFTER scheduled_datetime`,
      );
      await ensureColumn(
        'supplement_logs',
        'completed_at',
        `ALTER TABLE supplement_logs ADD COLUMN completed_at DATETIME NULL AFTER completed`,
      );

      await pool.execute(`
        UPDATE supplements
        SET dosage = COALESCE(NULLIF(dosage, ''), dosage_text)
        WHERE dosage IS NULL OR dosage = ''
      `);

      await pool.execute(`
        UPDATE supplements
        SET dosage_text = COALESCE(NULLIF(dosage_text, ''), dosage)
        WHERE dosage_text IS NULL OR dosage_text = ''
      `);

      await pool.execute(`
        UPDATE supplements
        SET timing = COALESCE(NULLIF(timing, ''), frequency_type)
        WHERE timing IS NULL OR timing = ''
      `);

      await pool.execute(`
        UPDATE supplements
        SET primary_time = CASE
          WHEN time_of_day = 'evening' THEN '18:00'
          WHEN time_of_day = 'night' THEN '22:00'
          ELSE '08:00'
        END
        WHERE primary_time IS NULL
          OR primary_time = ''
          OR primary_time NOT REGEXP '^(0[0-9]|1[0-9]|2[0-3]):[0-5][0-9]$'
      `);

      await pool.execute(`
        UPDATE supplements
        SET secondary_time = CASE
          WHEN primary_time < '12:00' THEN '20:00'
          ELSE '08:00'
        END
        WHERE times_per_day = 2
          AND (
            secondary_time IS NULL
            OR secondary_time = ''
            OR secondary_time NOT REGEXP '^(0[0-9]|1[0-9]|2[0-3]):[0-5][0-9]$'
            OR secondary_time = primary_time
          )
      `);

      await pool.execute(`
        UPDATE supplements
        SET secondary_time = NULL
        WHERE times_per_day <> 2
      `);

      await pool.execute(`
        UPDATE supplements
        SET times_per_day = CASE
          WHEN times_per_day IS NULL OR times_per_day <= 1 THEN 1
          ELSE 2
        END
      `);

      await pool.execute(`
        UPDATE supplements
        SET days_of_week_json = JSON_ARRAY(day_of_week)
        WHERE frequency_type = 'weekly'
          AND day_of_week IS NOT NULL
          AND (days_of_week_json IS NULL OR JSON_LENGTH(days_of_week_json) = 0)
      `);

      await pool.execute(`
        UPDATE supplement_logs
        SET scheduled_datetime = COALESCE(scheduled_datetime, taken_at, CONCAT(log_date, ' 08:00:00'))
        WHERE scheduled_datetime IS NULL
      `);

      await pool.execute(`
        UPDATE supplement_logs
        SET completed_at = COALESCE(completed_at, taken_at)
        WHERE completed = 1 AND completed_at IS NULL
      `);
    })();
  }

  await schemaReadyPromise;
}

async function activeSupplements(supplementId?: number) {
  await ensureSupplementSchema();
  const args: Array<number> = [];
  let where = 'WHERE is_active = 1';
  if (supplementId && supplementId > 0) {
    where += ' AND id = ?';
    args.push(supplementId);
  }

  const [rows] = await pool.execute<SupplementConfigRow[]>(
    `
    SELECT
      id,
      name,
      COALESCE(NULLIF(dosage, ''), NULLIF(dosage_text, '')) AS dosage,
      frequency_type,
      times_per_day,
      day_of_week,
      days_of_week_json,
      specific_date,
      time_of_day,
      primary_time,
      secondary_time,
      intake_mode,
      is_active
    FROM supplements
    ${where}
    ORDER BY id ASC
    `,
    args,
  );
  return rows;
}

export async function materializeSupplementLogsForRange(startYmd: string, endYmd: string, supplementId?: number) {
  const supplements = await activeSupplements(supplementId);
  if (supplements.length === 0) return;

  const rangeStart = `${startYmd} 00:00:00`;
  const rangeEnd = `${endYmd} 23:59:59`;

  for (const supplement of supplements) {
    const generated = buildDateTimes(supplement, startYmd, endYmd);
    if (generated.length === 0) continue;

    const [existingRows] = await pool.execute<DateTimeRow[]>(
      `
      SELECT scheduled_datetime
      FROM supplement_logs
      WHERE supplement_id = ?
        AND scheduled_datetime BETWEEN ? AND ?
      `,
      [supplement.id, rangeStart, rangeEnd],
    );

    const existing = new Set(existingRows.map((row) => toDateTimeKey(row.scheduled_datetime)).filter(Boolean));
    const missing = generated.filter((scheduledAt) => !existing.has(scheduledAt));
    if (missing.length === 0) continue;

    const placeholders = missing.map(() => '(?, NULL, ?, ?, ?, ?, NULL, ?)').join(',');
    const values: Array<number | string | null> = [];
    for (const scheduledAt of missing) {
      values.push(
        supplement.id,
        scheduledAt.slice(0, 10),
        scheduledAt,
        'taken',
        0,
        scheduledAt,
      );
    }

    await pool.execute(
      `
      INSERT INTO supplement_logs
        (supplement_id, scheduled_id, log_date, taken_at, status, completed, completed_at, scheduled_datetime)
      VALUES ${placeholders}
      `,
      values,
    );
  }
}

export async function syncSupplementFutureLogs(supplementId: number, horizonDays = 60) {
  await ensureSupplementSchema();
  if (!Number.isInteger(supplementId) || supplementId <= 0) return;

  const [activeRows] = await pool.execute<ActiveRow[]>(
    `SELECT is_active FROM supplements WHERE id = ? LIMIT 1`,
    [supplementId],
  );
  if (activeRows.length === 0) return;

  const today = localTodayYMD();
  const end = shiftYmd(today, horizonDays);

  await pool.execute(
    `
    DELETE FROM supplement_logs
    WHERE supplement_id = ?
      AND completed = 0
      AND scheduled_datetime >= ?
    `,
    [supplementId, `${today} 00:00:00`],
  );

  if (Number(activeRows[0].is_active) !== 1) return;
  await materializeSupplementLogsForRange(today, end, supplementId);
}
