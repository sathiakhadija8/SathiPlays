import { NextResponse } from 'next/server';
import { type ResultSetHeader, type RowDataPacket } from 'mysql2';
import pool from '../../../../../lib/db';
import { deductInventoryForCookedRecipes, nowSqlDateTime } from '../../../../../lib/food-helpers';

export const dynamic = 'force-dynamic';

type Body = {
  recipes?: Array<{ recipe_id?: unknown; portions_cooked?: unknown }>;
  cooked_at?: unknown;
};

type InventoryRow = RowDataPacket & {
  id: number;
  ingredient_name: string;
  quantity: number;
  unit: string;
  low_stock_threshold: number;
};

const DATETIME_INPUT_RE =
  /^(\d{4})-(0[1-9]|1[0-2])-([0-2]\d|3[01])[T ]([01]\d|2[0-3]):([0-5]\d)(?::([0-5]\d))?(?:\.\d{1,3})?(?:Z|[+-][01]\d:[0-5]\d)?$/;

function toMysqlDateTime(date: Date) {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(
    date.getMinutes(),
  )}:${pad(date.getSeconds())}`;
}

function parseDateTimeInput(value: string): string | null {
  const trimmed = value.trim();
  const match = DATETIME_INPUT_RE.exec(trimmed);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const second = Number(match[6] ?? '0');

  const localCheck = new Date(year, month - 1, day, hour, minute, second);
  if (
    Number.isNaN(localCheck.getTime()) ||
    localCheck.getFullYear() !== year ||
    localCheck.getMonth() !== month - 1 ||
    localCheck.getDate() !== day ||
    localCheck.getHours() !== hour ||
    localCheck.getMinutes() !== minute ||
    localCheck.getSeconds() !== second
  ) {
    return null;
  }

  const hasTimezone = /(?:Z|[+-][01]\d:[0-5]\d)$/.test(trimmed);
  const parsed = hasTimezone ? new Date(trimmed) : localCheck;
  if (Number.isNaN(parsed.getTime())) return null;
  return toMysqlDateTime(parsed);
}

export async function POST(request: Request) {
  const connection = await pool.getConnection();
  try {
    const body = (await request.json()) as Body;
    const recipesRaw = Array.isArray(body.recipes) ? body.recipes : [];
    const recipes: Array<{ recipe_id: number; portions_cooked: number }> = [];
    for (const item of recipesRaw) {
      const recipeId = Number(item.recipe_id);
      const portionsRaw = Number(item.portions_cooked ?? 1);
      if (!Number.isInteger(recipeId) || recipeId <= 0) {
        return NextResponse.json({ ok: false, message: 'Each recipe_id must be a positive integer.' }, { status: 400 });
      }
      if (!Number.isFinite(portionsRaw) || portionsRaw <= 0) {
        return NextResponse.json({ ok: false, message: 'Each portions_cooked must be a positive number.' }, { status: 400 });
      }
      recipes.push({ recipe_id: recipeId, portions_cooked: Math.max(1, Math.floor(portionsRaw)) });
    }

    if (recipes.length === 0) {
      return NextResponse.json({ ok: false, message: 'At least one recipe is required.' }, { status: 400 });
    }

    const cookedAt =
      typeof body.cooked_at === 'string' && body.cooked_at.trim()
        ? parseDateTimeInput(body.cooked_at)
        : nowSqlDateTime();
    if (!cookedAt) {
      return NextResponse.json({ ok: false, message: 'cooked_at must be a valid datetime.' }, { status: 400 });
    }

    const expiresAtDate = new Date(cookedAt.replace(' ', 'T'));
    expiresAtDate.setDate(expiresAtDate.getDate() + 3);
    const expiresAt = nowSqlDateTime(expiresAtDate);

    await connection.beginTransaction();

    const [batchResult] = await connection.execute<ResultSetHeader>(
      `INSERT INTO cooked_batches (cooked_at, expires_at, status)
       VALUES (?, ?, 'active')`,
      [cookedAt, expiresAt],
    );
    const batchId = batchResult.insertId;

    for (const item of recipes) {
      await connection.execute<ResultSetHeader>(
        `INSERT INTO cooked_batch_recipes (batch_id, recipe_id, portions_cooked, portions_remaining)
         VALUES (?, ?, ?, ?)`,
        [batchId, item.recipe_id, item.portions_cooked, item.portions_cooked],
      );
    }

    await deductInventoryForCookedRecipes(connection, recipes);

    const [inventory] = await connection.execute<InventoryRow[]>(
      `SELECT id, ingredient_name, quantity, unit, low_stock_threshold
       FROM inventory_items
       ORDER BY ingredient_name ASC`,
    );

    await connection.commit();

    return NextResponse.json({ ok: true, batch_id: batchId, cooked_at: cookedAt, expires_at: expiresAt, inventory });
  } catch {
    await connection.rollback();
    return NextResponse.json({ ok: false, message: 'Unable to finish cooking batch.' }, { status: 500 });
  } finally {
    connection.release();
  }
}
