import { NextResponse } from 'next/server';
import pool from '../../../../lib/db';
import { DEEN_ITEMS, ensureDeenTables, type DeenCheckRow, type DeenNoteRow, type FullDayRow, isValidYmd, todayYmd } from '../../../../lib/deen-server';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    await ensureDeenTables();
    const { searchParams } = new URL(request.url);
    const dateParam = (searchParams.get('date') ?? '').trim();
    const date = isValidYmd(dateParam) ? dateParam : todayYmd();

    const [checkRows] = await pool.execute<DeenCheckRow[]>(
      `SELECT item_key, is_done FROM deen_daily_checks WHERE log_date = ?`,
      [date],
    );

    const [noteRows] = await pool.execute<DeenNoteRow[]>(
      `SELECT note FROM deen_daily_notes WHERE note_date = ? LIMIT 1`,
      [date],
    );

    const doneMap = new Map(checkRows.map((row) => [row.item_key, row.is_done === 1]));
    const items = DEEN_ITEMS.map((item) => ({
      key: item.key,
      label: item.label,
      done: doneMap.get(item.key) ?? false,
    }));

    const completedCount = items.filter((item) => item.done).length;
    const totalCount = items.length;
    const progressPct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

    const [streakRows] = await pool.execute<FullDayRow[]>(
      `
      SELECT COALESCE(SUM(day_complete), 0) AS complete_days
      FROM (
        SELECT log_date, MIN(is_done) AS day_complete
        FROM deen_daily_checks
        WHERE log_date >= DATE_SUB(?, INTERVAL 6 DAY) AND log_date <= ?
        GROUP BY log_date
      ) t
      `,
      [date, date],
    );

    return NextResponse.json({
      date,
      items,
      note: noteRows[0]?.note ?? '',
      progress_pct: progressPct,
      completed_count: completedCount,
      total_count: totalCount,
      complete_days_7d: Number(streakRows[0]?.complete_days ?? 0),
    });
  } catch {
    return NextResponse.json({ message: 'Unable to load Deen summary.' }, { status: 500 });
  }
}
