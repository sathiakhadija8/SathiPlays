import { type PoolConnection, type ResultSetHeader, type RowDataPacket } from 'mysql2/promise';

export const FOOD_DOMAIN = 'food' as const;

export function nowSqlDateTime(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  const ss = String(date.getSeconds()).padStart(2, '0');
  return `${y}-${m}-${d} ${hh}:${mm}:${ss}`;
}

export function ymd(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

const YMD_RE = /^\d{4}-(0[1-9]|1[0-2])-([0-2]\d|3[01])$/;

function parseYmdInput(value: string): Date | null {
  if (!YMD_RE.test(value)) return null;
  const [yearRaw, monthRaw, dayRaw] = value.split('-');
  const year = Number(yearRaw);
  const month = Number(monthRaw);
  const day = Number(dayRaw);
  const date = new Date(year, month - 1, day);
  if (
    Number.isNaN(date.getTime()) ||
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }
  date.setHours(0, 0, 0, 0);
  return date;
}

export function isValidYmd(value: string) {
  return parseYmdInput(value) !== null;
}

export function weekStartSunday(inputDate?: string) {
  const parsedInput = inputDate ? parseYmdInput(inputDate) : null;
  const date = parsedInput ?? new Date();
  const day = date.getDay();
  date.setDate(date.getDate() - day);
  return ymd(date);
}

export function parseJsonArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((v): v is string => typeof v === 'string');
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : [];
    } catch {
      return [];
    }
  }
  return [];
}

type InventoryRow = RowDataPacket & {
  id: number;
  ingredient_name: string;
  quantity: number;
  unit: string;
  low_stock_threshold: number;
};

export async function upsertLowStockGrocery(connection: PoolConnection, itemName: string, quantity: number, unit: string) {
  const [existing] = await connection.execute<RowDataPacket[]>(
    `SELECT id FROM grocery_items WHERE item_name = ? AND status = 'pending' LIMIT 1`,
    [itemName],
  );
  if (existing.length > 0) return;
  await connection.execute<ResultSetHeader>(
    `INSERT INTO grocery_items (item_name, quantity, unit, status) VALUES (?, ?, ?, 'pending')`,
    [itemName, quantity > 0 ? quantity : null, unit || null],
  );
}

export async function deductInventoryForCookedRecipes(
  connection: PoolConnection,
  recipes: Array<{ recipe_id: number; portions_cooked: number }>,
) {
  for (const recipe of recipes) {
    const [ingredients] = await connection.execute<RowDataPacket[]>(
      `SELECT ingredient_name, qty_per_portion, unit
       FROM recipe_ingredients
       WHERE recipe_id = ?`,
      [recipe.recipe_id],
    );

    for (const ingredient of ingredients) {
      const ingredientName = String(ingredient.ingredient_name);
      const unit = String(ingredient.unit);
      const perPortion = Number(ingredient.qty_per_portion ?? 0);
      const usedQty = Math.max(0, perPortion * Math.max(0, Number(recipe.portions_cooked)));

      const [rows] = await connection.execute<InventoryRow[]>(
        `SELECT id, ingredient_name, quantity, unit, low_stock_threshold
         FROM inventory_items
         WHERE ingredient_name = ?
         LIMIT 1`,
        [ingredientName],
      );
      if (rows.length === 0) continue;

      const row = rows[0];
      const updatedQty = Math.max(0, Number(row.quantity) - usedQty);

      await connection.execute<ResultSetHeader>(
        `UPDATE inventory_items
         SET quantity = ?, unit = ?
         WHERE id = ?`,
        [updatedQty, unit || row.unit, row.id],
      );

      if (updatedQty <= Number(row.low_stock_threshold ?? 0)) {
        await upsertLowStockGrocery(connection, row.ingredient_name, Number(row.low_stock_threshold ?? 0) * 2, row.unit);
      }
    }
  }
}

type FastingPlanRow = RowDataPacket & {
  id: number;
  name: string;
  type: 'ramadan_dry' | 'window' | 'omad' | 'custom';
  start_time: string | null;
  end_time: string | null;
  is_active: number;
};

type FastingSessionRow = RowDataPacket & {
  id: number;
  plan_id: number | null;
  started_at: string;
  ended_at: string | null;
  fast_type?: string | null;
  window_start_time?: string | null;
  window_end_time?: string | null;
};

function minutesSinceMidnight(date = new Date()) {
  return date.getHours() * 60 + date.getMinutes();
}

function parseHHMMToMinutes(value: string | null) {
  if (!value) return null;
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const hh = Number(match[1]);
  const mm = Number(match[2]);
  if (!Number.isInteger(hh) || !Number.isInteger(mm) || hh < 0 || hh > 23 || mm < 0 || mm > 59) return null;
  return hh * 60 + mm;
}

export function computeFastingWindowState(plan: FastingPlanRow | null) {
  if (!plan) return { state: 'EATING WINDOW' as const, minutes_to_next_state: null };
  const nowMin = minutesSinceMidnight();
  const startMin = parseHHMMToMinutes(plan.start_time);
  const endMin = parseHHMMToMinutes(plan.end_time);
  if (startMin === null || endMin === null) return { state: 'EATING WINDOW' as const, minutes_to_next_state: null };

  let eating = false;
  let minsToNext: number;
  if (startMin < endMin) {
    eating = nowMin >= startMin && nowMin < endMin;
    minsToNext = eating ? endMin - nowMin : (nowMin < startMin ? startMin - nowMin : 24 * 60 - nowMin + startMin);
  } else {
    eating = nowMin >= startMin || nowMin < endMin;
    minsToNext = eating ? (nowMin >= startMin ? 24 * 60 - nowMin + endMin : endMin - nowMin) : startMin - nowMin;
  }

  return {
    state: eating ? ('EATING WINDOW' as const) : ('FASTING' as const),
    minutes_to_next_state: Math.max(0, minsToNext),
  };
}

export function computeFastingStatus(plan: FastingPlanRow | null, activeSession: FastingSessionRow | null) {
  if (activeSession && !activeSession.ended_at) {
    return {
      plan_name: plan?.name ?? 'Fast Session',
      fast_type: activeSession.fast_type ?? plan?.type ?? null,
      state: 'FASTING' as const,
      minutes_to_next_state: null,
      has_open_session: true,
      session_started_at: activeSession.started_at,
    };
  }

  const windowState = computeFastingWindowState(plan);
  return {
    plan_name: plan?.name ?? null,
    fast_type: null,
    state: windowState.state,
    minutes_to_next_state: windowState.minutes_to_next_state,
    has_open_session: false,
    session_started_at: null,
  };
}
