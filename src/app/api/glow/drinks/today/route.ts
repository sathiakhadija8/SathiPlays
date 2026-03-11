import { NextResponse } from 'next/server';
import { type RowDataPacket } from 'mysql2';
import pool from '../../../../../lib/db';
import {
  dueTimeFor,
  ensureDrinksSchema,
  localTodayYMD,
  materializeDrinkLogsForDate,
  toDueNowItem,
  type TimeOfDay,
  type TodayDrinkItem,
} from '../../../../../lib/glow-drinks';

export const dynamic = 'force-dynamic';

type SeedDueRow = RowDataPacket & {
  log_id: number;
  drink_id: number;
  drink_name: string;
  time_of_day: TimeOfDay;
  recipe: string | null;
  seed_types: unknown;
};

type BeautyDueRow = RowDataPacket & {
  log_id: number;
  drink_id: number;
  drink_name: string;
  time_of_day: TimeOfDay;
  recipe: string | null;
  icon_image_path: string | null;
  completed: number;
  completed_at: string | null;
};

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

export async function GET() {
  try {
    await ensureDrinksSchema();
    const today = localTodayYMD();
    await materializeDrinkLogsForDate(today);

    const [seedRows] = await pool.execute<SeedDueRow[]>(
      `
        SELECT
          l.id AS log_id,
          sw.id AS drink_id,
          sw.name AS drink_name,
          sw.time_of_day,
          sw.recipe,
          JSON_EXTRACT(sw.seed_types, '$') AS seed_types
        FROM seed_water_logs l
        INNER JOIN seed_waters sw ON sw.id = l.seed_water_id
        WHERE l.log_date = ?
          AND l.completed = 0
          AND sw.is_active = 1
        ORDER BY sw.updated_at DESC, sw.id DESC
      `,
      [today],
    );

    const [beautyRows] = await pool.execute<BeautyDueRow[]>(
      `
        SELECT
          d.id AS log_id,
          CAST(r.legacy_id AS SIGNED) AS drink_id,
          r.title AS drink_name,
          COALESCE(JSON_UNQUOTE(JSON_EXTRACT(r.attributes, '$.time_of_day')), 'morning') AS time_of_day,
          JSON_UNQUOTE(JSON_EXTRACT(r.attributes, '$.recipe')) AS recipe,
          JSON_UNQUOTE(JSON_EXTRACT(r.attributes, '$.icon_image_path')) AS icon_image_path,
          d.completed,
          DATE_FORMAT(d.completed_at, '%Y-%m-%d %H:%i:%s') AS completed_at
        FROM beauty_drink_daily d
        INNER JOIN sp_catalog_items r
          ON r.domain_key = 'glow'
         AND r.item_type = 'beauty_drink_recipe'
         AND CAST(r.legacy_id AS SIGNED) = d.recipe_id
        WHERE d.log_date = ?
          AND r.is_active = 1
        LIMIT 1
      `,
      [today],
    );

    const seedDueItems: TodayDrinkItem[] = [
      ...seedRows.map((row) => {
        const dueTime = dueTimeFor(row.time_of_day);
        return {
          log_id: row.log_id,
          entry_type: 'seed_water' as const,
          category: 'seed_water' as const,
          drink_id: row.drink_id,
          drink_name: row.drink_name,
          icon_image_path: null,
          time_of_day: row.time_of_day,
          due_time: dueTime,
          scheduled_datetime: `${today} ${dueTime}:00`,
          recipe: row.recipe,
          seed_types: parseSeedTypes(row.seed_types),
          completed_at: null,
        };
      }),
    ];

    const beautyItem: TodayDrinkItem | null = beautyRows[0]
      ? (() => {
          const row = beautyRows[0];
          const dueTime = dueTimeFor(row.time_of_day);
          return {
            log_id: row.log_id,
            entry_type: 'beauty_drink' as const,
            category: 'beauty_drink' as const,
            drink_id: row.drink_id,
            drink_name: row.drink_name,
            icon_image_path: row.icon_image_path ?? null,
            time_of_day: row.time_of_day,
            due_time: dueTime,
            scheduled_datetime: `${today} ${dueTime}:00`,
            recipe: row.recipe,
            seed_types: [],
            completed_at: row.completed_at,
          };
        })()
      : null;

    const dueNow: TodayDrinkItem[] = [
      ...seedDueItems,
      ...(beautyItem && Number((beautyRows[0]?.completed ?? 0)) !== 1
        ? [{
            ...beautyItem,
          }]
        : []),
    ];

    const completedToday: TodayDrinkItem[] = [
      ...(beautyItem && Number((beautyRows[0]?.completed ?? 0)) === 1
        ? [{
            ...beautyItem,
          }]
        : []),
    ];

    return NextResponse.json({
      date: today,
      dueNow: dueNow.map(toDueNowItem),
      completedToday,
      seedWater: dueNow.find((item) => item.entry_type === 'seed_water') ?? null,
      beautyDrinkToday: beautyItem ?? null,
      beautyDrinkCompleted: Boolean(beautyRows[0] && Number(beautyRows[0].completed) === 1),
    });
  } catch {
    return NextResponse.json({ ok: false, message: 'Unable to load drinks today.' }, { status: 500 });
  }
}
