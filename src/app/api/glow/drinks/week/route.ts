import { NextResponse } from 'next/server';
import { type RowDataPacket } from 'mysql2';
import pool from '../../../../../lib/db';
import { startOfWeekYMD, weekFromStartYMD } from '../../../../../lib/glow-schedule';
import { dueTimeFor, ensureDrinksSchema, materializeDrinkLogsForRange, type TimeOfDay } from '../../../../../lib/glow-drinks';

export const dynamic = 'force-dynamic';

type SeedWeekRow = RowDataPacket & {
  log_id: number;
  drink_id: number;
  drink_name: string;
  time_of_day: TimeOfDay;
  recipe: string | null;
  seed_types: unknown;
  log_date: string;
  completed: number;
  completed_at: string | null;
};

type BeautyWeekRow = RowDataPacket & {
  log_id: number;
  drink_id: number;
  drink_name: string;
  time_of_day: TimeOfDay;
  recipe: string | null;
  log_date: string;
  completed: number;
  completed_at: string | null;
};

function normalizeStart(input: string | null) {
  if (!input || !/^\d{4}-\d{2}-\d{2}$/.test(input)) return startOfWeekYMD();
  return input;
}

function shiftYmd(startYmd: string, days: number) {
  const date = new Date(`${startYmd}T00:00:00`);
  date.setDate(date.getDate() + days);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
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
      return [] as string[];
    }
  }
  return [] as string[];
}

export async function GET(request: Request) {
  try {
    await ensureDrinksSchema();
    const { searchParams } = new URL(request.url);
    const start = normalizeStart(searchParams.get('startDate'));
    const end = shiftYmd(start, 6);
    const days = weekFromStartYMD(start);

    await materializeDrinkLogsForRange(start, end);

    const [seedRows] = await pool.execute<SeedWeekRow[]>(
      `
        SELECT
          l.id AS log_id,
          sw.id AS drink_id,
          sw.name AS drink_name,
          sw.time_of_day,
          sw.recipe,
          JSON_EXTRACT(sw.seed_types, '$') AS seed_types,
          DATE_FORMAT(l.log_date, '%Y-%m-%d') AS log_date,
          l.completed,
          DATE_FORMAT(l.completed_at, '%Y-%m-%d %H:%i:%s') AS completed_at
        FROM seed_water_logs l
        INNER JOIN seed_waters sw ON sw.id = l.seed_water_id
        WHERE l.log_date BETWEEN ? AND ?
          AND sw.is_active = 1
      `,
      [start, end],
    );

    const [beautyRows] = await pool.execute<BeautyWeekRow[]>(
      `
        SELECT
          d.id AS log_id,
          CAST(r.legacy_id AS SIGNED) AS drink_id,
          r.title AS drink_name,
          COALESCE(JSON_UNQUOTE(JSON_EXTRACT(r.attributes, '$.time_of_day')), 'morning') AS time_of_day,
          JSON_UNQUOTE(JSON_EXTRACT(r.attributes, '$.recipe')) AS recipe,
          DATE_FORMAT(d.log_date, '%Y-%m-%d') AS log_date,
          d.completed,
          DATE_FORMAT(d.completed_at, '%Y-%m-%d %H:%i:%s') AS completed_at
        FROM beauty_drink_daily d
        INNER JOIN sp_catalog_items r
          ON r.domain_key = 'glow'
         AND r.item_type = 'beauty_drink_recipe'
         AND CAST(r.legacy_id AS SIGNED) = d.recipe_id
        WHERE d.log_date BETWEEN ? AND ?
          AND r.is_active = 1
      `,
      [start, end],
    );

    const rowsByDate = new Map<string, Array<Record<string, unknown>>>();

    for (const row of seedRows) {
      const dueTime = dueTimeFor(row.time_of_day);
      const list = rowsByDate.get(row.log_date) ?? [];
      list.push({
        log_id: row.log_id,
        drink_id: row.drink_id,
        drink_name: row.drink_name,
        category: 'seed_water',
        time_of_day: row.time_of_day,
        due_time: dueTime,
        scheduled_datetime: `${row.log_date} ${dueTime}:00`,
        completed: Number(row.completed) === 1,
        completed_at: row.completed_at,
        recipe: row.recipe,
        seed_types: parseSeedTypes(row.seed_types),
      });
      rowsByDate.set(row.log_date, list);
    }

    for (const row of beautyRows) {
      const dueTime = dueTimeFor(row.time_of_day);
      const list = rowsByDate.get(row.log_date) ?? [];
      list.push({
        log_id: row.log_id,
        drink_id: row.drink_id,
        drink_name: row.drink_name,
        category: 'beauty_drink',
        time_of_day: row.time_of_day,
        due_time: dueTime,
        scheduled_datetime: `${row.log_date} ${dueTime}:00`,
        completed: Number(row.completed) === 1,
        completed_at: row.completed_at,
        recipe: row.recipe,
        seed_types: [],
      });
      rowsByDate.set(row.log_date, list);
    }

    return NextResponse.json({
      startDate: start,
      days: days.map((day) => ({
        ...day,
        items: (rowsByDate.get(day.date) ?? []).sort((a, b) => String(a.due_time).localeCompare(String(b.due_time))),
      })),
    });
  } catch {
    return NextResponse.json({ ok: false, message: 'Unable to load drinks week.' }, { status: 500 });
  }
}
