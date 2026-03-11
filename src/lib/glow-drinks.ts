import { type RowDataPacket } from 'mysql2';
import pool from './db';
import { localTodayYMD } from './glow-schedule';

export { localTodayYMD };

export type DrinkCategory = 'seed_water' | 'beauty_drink';
export type TimeOfDay = 'morning' | 'midday' | 'evening' | 'night';

export type SeedWaterRow = RowDataPacket & {
  id: number;
  name: string;
  seed_types: unknown;
  recipe: string | null;
  time_of_day: TimeOfDay;
  is_active: number;
  created_at: string;
  updated_at: string;
};

export type BeautyRecipeRow = RowDataPacket & {
  id: number;
  name: string;
  recipe: string | null;
  icon_image_path: string | null;
  time_of_day: TimeOfDay;
  is_active: number;
  created_at: string;
  updated_at: string;
};

let schemaReadyPromise: Promise<void> | null = null;

type CountRow = RowDataPacket & { c: number };

function normalizeTimeOfDay(value: unknown): TimeOfDay {
  if (value === 'midday' || value === 'evening' || value === 'night') return value;
  return 'morning';
}

function shiftYmd(ymd: string, days: number) {
  const base = new Date(`${ymd}T00:00:00`);
  base.setDate(base.getDate() + days);
  return localTodayYMD(base);
}

function parseSeedTypes(value: unknown) {
  if (Array.isArray(value)) {
    return value
      .filter((entry): entry is string => typeof entry === 'string')
      .map((entry) => entry.trim())
      .filter(Boolean);
  }
  if (typeof value === 'string' && value.trim()) {
    try {
      return parseSeedTypes(JSON.parse(value));
    } catch {
      return value
        .split(',')
        .map((entry) => entry.trim())
        .filter(Boolean);
    }
  }
  return [] as string[];
}

export function dueTimeFor(timeOfDay: TimeOfDay) {
  if (timeOfDay === 'midday') return '13:00';
  if (timeOfDay === 'evening') return '18:00';
  if (timeOfDay === 'night') return '21:30';
  return '08:00';
}

export async function ensureDrinksSchema() {
  if (!schemaReadyPromise) {
    schemaReadyPromise = (async () => {
      await pool.execute(`
        CREATE TABLE IF NOT EXISTS seed_waters (
          id INT AUTO_INCREMENT PRIMARY KEY,
          name VARCHAR(160) NOT NULL,
          seed_types JSON NULL,
          recipe TEXT NULL,
          time_of_day ENUM('morning','midday','evening','night') NOT NULL DEFAULT 'morning',
          is_active TINYINT(1) NOT NULL DEFAULT 1,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        )
      `);

      await pool.execute(`
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
        )
      `);

      await pool.execute(`
        CREATE TABLE IF NOT EXISTS beauty_drink_recipes (
          id INT AUTO_INCREMENT PRIMARY KEY,
          name VARCHAR(160) NOT NULL,
          recipe TEXT NULL,
          icon_image_path LONGTEXT NULL,
          time_of_day ENUM('morning','midday','evening','night') NOT NULL DEFAULT 'morning',
          is_active TINYINT(1) NOT NULL DEFAULT 1,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        )
      `);

      const [iconColumnRows] = await pool.execute<CountRow[]>(
        `
          SELECT COUNT(*) AS c
          FROM INFORMATION_SCHEMA.COLUMNS
          WHERE TABLE_SCHEMA = DATABASE()
            AND TABLE_NAME = 'beauty_drink_recipes'
            AND COLUMN_NAME = 'icon_image_path'
        `,
      );
      if (Number(iconColumnRows[0]?.c ?? 0) === 0) {
        await pool.execute(`ALTER TABLE beauty_drink_recipes ADD COLUMN icon_image_path LONGTEXT NULL AFTER recipe`);
      }

      await pool.execute(`
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
        )
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

      await pool.execute(`
        INSERT INTO tea_types (name, is_active)
        SELECT * FROM (
          SELECT 'Spearmint' AS name, 1 AS is_active
          UNION ALL SELECT 'Green Tea', 1
          UNION ALL SELECT 'Chamomile', 1
          UNION ALL SELECT 'Ginger Tea', 1
          UNION ALL SELECT 'Chai', 1
        ) AS seed
        WHERE NOT EXISTS (
          SELECT 1 FROM tea_types t WHERE LOWER(t.name) = LOWER(seed.name)
        )
      `);
    })();
  }

  await schemaReadyPromise;
}

export async function listSeedWaters() {
  await ensureDrinksSchema();
  const [rows] = await pool.execute<SeedWaterRow[]>(
    `
      SELECT id, name, JSON_EXTRACT(seed_types, '$') AS seed_types, recipe, time_of_day, is_active, created_at, updated_at
      FROM seed_waters
      ORDER BY updated_at DESC, id DESC
    `,
  );

  return rows.map((row) => ({
    ...row,
    seed_types: parseSeedTypes(row.seed_types),
    time_of_day: normalizeTimeOfDay(row.time_of_day),
    is_active: Number(row.is_active) === 1 ? 1 : 0,
  }));
}

export async function listBeautyRecipes() {
  await ensureDrinksSchema();
  const [rows] = await pool.execute<BeautyRecipeRow[]>(
    `
      SELECT
        CAST(legacy_id AS SIGNED) AS id,
        title AS name,
        JSON_UNQUOTE(JSON_EXTRACT(attributes, '$.recipe')) AS recipe,
        JSON_UNQUOTE(JSON_EXTRACT(attributes, '$.icon_image_path')) AS icon_image_path,
        COALESCE(JSON_UNQUOTE(JSON_EXTRACT(attributes, '$.time_of_day')), 'morning') AS time_of_day,
        is_active,
        created_at,
        updated_at
      FROM sp_catalog_items
      WHERE domain_key = 'glow'
        AND item_type = 'beauty_drink_recipe'
        AND legacy_id IS NOT NULL
      ORDER BY updated_at DESC, id DESC
    `,
  );

  return rows.map((row) => ({
    ...row,
    time_of_day: normalizeTimeOfDay(row.time_of_day),
    is_active: Number(row.is_active) === 1 ? 1 : 0,
  }));
}

type CandidateRow = RowDataPacket & {
  id: number;
  last_used_at: string | null;
};

type DailyBeautyRow = RowDataPacket & {
  id: number;
  recipe_id: number | null;
  completed: number;
};

type IsActiveRow = RowDataPacket & {
  is_active: number;
};

async function chooseBeautyRecipeId(dateYmd: string) {
  const yesterday = shiftYmd(dateYmd, -1);

  const [yesterdayRows] = await pool.execute<RowDataPacket[]>(
    `SELECT recipe_id FROM beauty_drink_daily WHERE log_date = ? LIMIT 1`,
    [yesterday],
  );
  const yesterdayRecipeId = Number(yesterdayRows[0]?.recipe_id ?? 0) || null;

  const [candidateRows] = await pool.execute<CandidateRow[]>(
    `
      SELECT CAST(r.legacy_id AS SIGNED) AS id, MAX(d.log_date) AS last_used_at
      FROM sp_catalog_items r
      LEFT JOIN beauty_drink_daily d ON d.recipe_id = CAST(r.legacy_id AS SIGNED)
      WHERE r.domain_key = 'glow'
        AND r.item_type = 'beauty_drink_recipe'
        AND r.is_active = 1
        AND r.legacy_id IS NOT NULL
      GROUP BY r.legacy_id
      ORDER BY (MAX(d.log_date) IS NULL) DESC, MAX(d.log_date) ASC, CAST(r.legacy_id AS SIGNED) ASC
    `,
  );

  if (candidateRows.length === 0) return null;
  if (!yesterdayRecipeId || candidateRows.length === 1) return candidateRows[0].id;

  const nonYesterday = candidateRows.find((row) => row.id !== yesterdayRecipeId);
  return nonYesterday?.id ?? candidateRows[0].id;
}

export async function materializeDrinkLogsForDate(dateYmd = localTodayYMD()) {
  await ensureDrinksSchema();

  await pool.execute(
    `
      INSERT INTO seed_water_logs (seed_water_id, log_date, completed, completed_at)
      SELECT sw.id, ?, 0, NULL
      FROM seed_waters sw
      WHERE sw.is_active = 1
      AND NOT EXISTS (
        SELECT 1
        FROM seed_water_logs l
        WHERE l.seed_water_id = sw.id AND l.log_date = ?
      )
    `,
    [dateYmd, dateYmd],
  );

  const [activeCountRows] = await pool.execute<RowDataPacket[]>(
    `SELECT COUNT(*) AS c
     FROM sp_catalog_items
     WHERE domain_key = 'glow'
       AND item_type = 'beauty_drink_recipe'
       AND is_active = 1
       AND legacy_id IS NOT NULL`,
  );
  const activeCount = Number(activeCountRows[0]?.c ?? 0);
  if (activeCount === 0) {
    return;
  }

  const [dailyRows] = await pool.execute<DailyBeautyRow[]>(
    `SELECT id, recipe_id, completed FROM beauty_drink_daily WHERE log_date = ? LIMIT 1`,
    [dateYmd],
  );
  const daily = dailyRows[0] ?? null;

  if (!daily) {
    const recipeId = await chooseBeautyRecipeId(dateYmd);
    if (!recipeId) return;
    await pool.execute(
      `INSERT INTO beauty_drink_daily (log_date, recipe_id, completed, completed_at) VALUES (?, ?, 0, NULL)`,
      [dateYmd, recipeId],
    );
    return;
  }

  const currentRecipeId = Number(daily.recipe_id ?? 0) || null;
  if (!currentRecipeId) {
    const nextRecipeId = await chooseBeautyRecipeId(dateYmd);
    if (!nextRecipeId) return;
    await pool.execute(`UPDATE beauty_drink_daily SET recipe_id = ? WHERE id = ?`, [nextRecipeId, daily.id]);
    return;
  }

  const [activeRows] = await pool.execute<IsActiveRow[]>(
    `SELECT is_active
     FROM sp_catalog_items
     WHERE domain_key = 'glow'
       AND item_type = 'beauty_drink_recipe'
       AND legacy_id = ?
     LIMIT 1`,
    [currentRecipeId],
  );

  if (activeRows.length === 0 || Number(activeRows[0].is_active) !== 1) {
    const nextRecipeId = await chooseBeautyRecipeId(dateYmd);
    if (!nextRecipeId) return;
    await pool.execute(`UPDATE beauty_drink_daily SET recipe_id = ? WHERE id = ?`, [nextRecipeId, daily.id]);
  }
}

export async function materializeDrinkLogsForRange(startYmd: string, endYmd: string) {
  let cursor = startYmd;
  while (cursor <= endYmd) {
    await materializeDrinkLogsForDate(cursor);
    cursor = shiftYmd(cursor, 1);
  }
}

export type TodayDrinkItem = {
  log_id: number;
  entry_type: DrinkCategory;
  category: DrinkCategory;
  drink_id: number;
  drink_name: string;
  icon_image_path: string | null;
  time_of_day: TimeOfDay;
  due_time: string;
  scheduled_datetime: string;
  recipe: string | null;
  seed_types: string[];
  completed_at: string | null;
};

export function toDueNowItem(input: TodayDrinkItem) {
  return {
    ...input,
    is_missed: false,
  };
}
