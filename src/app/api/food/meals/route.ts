import { NextResponse } from 'next/server';
import { type ResultSetHeader, type RowDataPacket } from 'mysql2';
import pool from '../../../../lib/db';
import { computeFastingStatus, isValidYmd, nowSqlDateTime, ymd } from '../../../../lib/food-helpers';
import { addPointsLog } from '../../../../lib/points-helpers';

export const dynamic = 'force-dynamic';

type MealRow = RowDataPacket & {
  id: number;
  logged_at: string;
  log_type: 'cooked' | 'cheat';
  batch_id: number | null;
  batch_recipe_id: number | null;
  portions: number | null;
  cheat_title: string | null;
  cheat_notes: string | null;
  cheat_protein_g: number | null;
  cheat_carbs_g: number | null;
  cheat_fat_g: number | null;
  recipe_title: string | null;
};

type Body = {
  log_type?: unknown;
  batch_id?: unknown;
  batch_recipe_id?: unknown;
  portions?: unknown;
  cheat_title?: unknown;
  cheat_notes?: unknown;
  cheat_protein_g?: unknown;
  cheat_carbs_g?: unknown;
  cheat_fat_g?: unknown;
  logged_at?: unknown;
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

function parseNonNegativeNumber(value: unknown): number | null {
  if (value === undefined || value === null || value === '') return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return parsed;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const dateParam = searchParams.get('date');
    if (dateParam && !isValidYmd(dateParam)) {
      return NextResponse.json({ ok: false, message: 'date must be YYYY-MM-DD.' }, { status: 400 });
    }
    const date = dateParam || ymd();
    const [rows] = await pool.execute<MealRow[]>(
      `SELECT ml.id, ml.logged_at, ml.log_type, ml.batch_id, ml.batch_recipe_id, ml.portions,
              ml.cheat_title, ml.cheat_notes, ml.cheat_protein_g, ml.cheat_carbs_g, ml.cheat_fat_g,
              r.title AS recipe_title
       FROM meal_logs ml
       LEFT JOIN cooked_batch_recipes cbr ON cbr.id = ml.batch_recipe_id
       LEFT JOIN recipes r ON r.id = cbr.recipe_id
       WHERE DATE(ml.logged_at) = ?
       ORDER BY ml.logged_at DESC`,
      [date],
    );
    return NextResponse.json(rows);
  } catch {
    return NextResponse.json({ ok: false, message: 'Unable to load meal logs.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const connection = await pool.getConnection();
  try {
    const body = (await request.json()) as Body;
    const logType = body.log_type === 'cooked' || body.log_type === 'cheat' ? body.log_type : null;
    if (!logType) return NextResponse.json({ ok: false, message: 'log_type is required.' }, { status: 400 });
    const loggedAt =
      typeof body.logged_at === 'string' && body.logged_at.trim()
        ? parseDateTimeInput(body.logged_at)
        : nowSqlDateTime();
    if (!loggedAt) {
      return NextResponse.json({ ok: false, message: 'logged_at must be a valid datetime.' }, { status: 400 });
    }

    await connection.beginTransaction();

    const [planRows] = await connection.execute<RowDataPacket[]>(
      `SELECT id, name, type, start_time, end_time, is_active
       FROM fasting_plans
       WHERE is_active = 1
       ORDER BY id DESC
       LIMIT 1`,
    );
    const [sessionRows] = await connection.execute<RowDataPacket[]>(
      `SELECT id, plan_id, fast_type, window_start_time, window_end_time, started_at, ended_at
       FROM fasting_sessions
       ORDER BY started_at DESC
       LIMIT 1`,
    );
    const fasting = computeFastingStatus((planRows[0] as never) ?? null, (sessionRows[0] as never) ?? null);
    const fastingWarning = fasting.state === 'FASTING';

    let insertedId = 0;
    let pointsAwarded = 0;
    if (logType === 'cooked') {
      const batchRecipeId = Number(body.batch_recipe_id);
      if (!Number.isInteger(batchRecipeId) || batchRecipeId <= 0) {
        await connection.rollback();
        return NextResponse.json({ ok: false, message: 'batch_recipe_id is required for cooked meal.' }, { status: 400 });
      }
      const portionsRaw = Number(body.portions ?? 1);
      if (!Number.isFinite(portionsRaw) || portionsRaw <= 0) {
        await connection.rollback();
        return NextResponse.json({ ok: false, message: 'portions must be a positive number.' }, { status: 400 });
      }
      const portions = Math.max(1, Math.floor(portionsRaw));

      const [batchRows] = await connection.execute<RowDataPacket[]>(
        `SELECT id, batch_id, portions_remaining
         FROM cooked_batch_recipes
         WHERE id = ?
         LIMIT 1`,
        [batchRecipeId],
      );
      if (batchRows.length === 0) {
        await connection.rollback();
        return NextResponse.json({ ok: false, message: 'Batch recipe not found.' }, { status: 404 });
      }

      const remaining = Number(batchRows[0].portions_remaining ?? 0);
      const consume = Math.min(remaining, portions);
      if (consume <= 0) {
        await connection.rollback();
        return NextResponse.json({ ok: false, message: 'No portions remaining.' }, { status: 400 });
      }

      await connection.execute<ResultSetHeader>(
        `UPDATE cooked_batch_recipes
         SET portions_remaining = portions_remaining - ?
         WHERE id = ?`,
        [consume, batchRecipeId],
      );

      const [result] = await connection.execute<ResultSetHeader>(
        `INSERT INTO meal_logs (logged_at, log_type, batch_id, batch_recipe_id, portions)
         VALUES (?, 'cooked', ?, ?, ?)`,
        [loggedAt, Number(batchRows[0].batch_id), batchRecipeId, consume],
      );
      insertedId = result.insertId;
      pointsAwarded = 12;
    } else {
      const cheatTitle = typeof body.cheat_title === 'string' ? body.cheat_title.trim() : '';
      if (!cheatTitle || cheatTitle.length > 160) {
        await connection.rollback();
        return NextResponse.json({ ok: false, message: 'cheat_title is required (<=160).' }, { status: 400 });
      }
      const cheatNotes = typeof body.cheat_notes === 'string' ? body.cheat_notes.trim() : '';
      const protein = parseNonNegativeNumber(body.cheat_protein_g);
      const carbs = parseNonNegativeNumber(body.cheat_carbs_g);
      const fat = parseNonNegativeNumber(body.cheat_fat_g);
      if (
        (body.cheat_protein_g !== undefined && protein === null) ||
        (body.cheat_carbs_g !== undefined && carbs === null) ||
        (body.cheat_fat_g !== undefined && fat === null)
      ) {
        await connection.rollback();
        return NextResponse.json({ ok: false, message: 'Macro values must be non-negative numbers.' }, { status: 400 });
      }

      const [result] = await connection.execute<ResultSetHeader>(
        `INSERT INTO meal_logs (logged_at, log_type, cheat_title, cheat_notes, cheat_protein_g, cheat_carbs_g, cheat_fat_g)
         VALUES (?, 'cheat', ?, ?, ?, ?, ?)`,
        [loggedAt, cheatTitle, cheatNotes || null, protein, carbs, fat],
      );
      insertedId = result.insertId;
      pointsAwarded = 7;
    }

    await addPointsLog(connection, {
      domain: 'food',
      sourceType: `meal_${logType}`,
      sourceId: insertedId || null,
      points: pointsAwarded,
      reason: logType === 'cooked' ? 'Cooked meal logged' : 'Cheat meal logged',
    });

    await connection.commit();
    return NextResponse.json({ ok: true, insertedId, fasting_warning: fastingWarning, points_awarded: pointsAwarded });
  } catch {
    await connection.rollback().catch(() => undefined);
    return NextResponse.json({ ok: false, message: 'Unable to save meal log.' }, { status: 500 });
  } finally {
    connection.release();
  }
}
