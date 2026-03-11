import { NextResponse } from 'next/server';
import { type RowDataPacket } from 'mysql2';
import pool from '../../../../../lib/db';
import { todayYMD } from '../../../../../lib/career-helpers';
import { DAILY_PRACTICE_DEFAULT_ICON, dailyPracticeGuardKey } from '../../../../../lib/career-constants';
import { ensureDailyPracticeIconColumns } from '../../../../../lib/career-schema';

export const dynamic = 'force-dynamic';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

type CheckinRow = RowDataPacket & {
  id: number;
  item_id: number;
  log_date: string;
  created_at: string;
};

type ItemRow = RowDataPacket & {
  id: number;
  key_name: string | null;
  display_name: string | null;
  icon_type: 'preset' | 'upload';
  preset_icon: string | null;
  uploaded_icon_url: string | null;
};

type GuardRow = RowDataPacket & {
  guard_key: string;
  last_activity_at: string | null;
};

export async function GET(request: Request) {
  try {
    await ensureDailyPracticeIconColumns();
    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date')?.trim() ?? todayYMD();
    if (!DATE_RE.test(date)) {
      return NextResponse.json({ ok: false, message: 'date must be YYYY-MM-DD.' }, { status: 400 });
    }

    const [items] = await pool.execute<ItemRow[]>(
      `SELECT
          CAST(legacy_id AS SIGNED) AS id,
          key_name,
          subtitle AS display_name,
          COALESCE(JSON_UNQUOTE(JSON_EXTRACT(attributes, '$.icon_type')), 'preset') AS icon_type,
          JSON_UNQUOTE(JSON_EXTRACT(attributes, '$.preset_icon')) AS preset_icon,
          JSON_UNQUOTE(JSON_EXTRACT(attributes, '$.uploaded_icon_url')) AS uploaded_icon_url
       FROM sp_catalog_items
       WHERE domain_key = 'career'
         AND item_type = 'daily_practice_item'
         AND is_active = 1
         AND legacy_id IS NOT NULL
       ORDER BY created_at ASC, id ASC`,
    );

    const [todayRows] = await pool.execute<CheckinRow[]>(
      `SELECT id, item_id, log_date, created_at
       FROM daily_practice_logs
       WHERE log_date = ?`,
      [date],
    );

    const [guardRows] = await pool.execute<GuardRow[]>(
      `SELECT guard_key, last_activity_at
       FROM inactivity_guards
       WHERE domain = 'career'`,
    );

    const checkedSet = new Set(todayRows.map((row) => row.item_id));
    const guardMap = new Map(guardRows.map((row) => [row.guard_key, row.last_activity_at]));

    return NextResponse.json({
      date,
      items: items.map((item) => {
        const guardValue = guardMap.get(dailyPracticeGuardKey(item.id));
        return {
          key_name: item.key_name ?? `item_${item.id}`,
          display_name: item.display_name ?? 'Practice',
          icon_type: item.icon_type ?? 'preset',
          preset_icon: item.preset_icon ?? DAILY_PRACTICE_DEFAULT_ICON,
          uploaded_icon_url: item.uploaded_icon_url ?? null,
          item_id: item.id,
          checked_in_today: checkedSet.has(item.id),
          last_activity_at: guardValue ?? null,
        };
      }),
    });
  } catch {
    return NextResponse.json({ ok: false, message: 'Unable to fetch check-in status.' }, { status: 500 });
  }
}
