import { NextResponse } from 'next/server';
import pool from '../../../../../lib/db';
import { ensureDeenTables, londonTodayYmd } from '../../../../../lib/deen-server';

export const dynamic = 'force-dynamic';

type Body = {
  pages_read?: unknown;
  daily_goal?: unknown;
  mushaf_version?: string;
};

export async function POST(request: Request) {
  try {
    await ensureDeenTables();
    const body = (await request.json().catch(() => ({}))) as Body;

    const rawPagesRead = Number(body.pages_read ?? 0);
    const rawDailyGoal = Number(body.daily_goal ?? 5);
    const pagesRead = Number.isFinite(rawPagesRead) ? Math.max(0, Math.floor(rawPagesRead)) : 0;
    const dailyGoal = Number.isFinite(rawDailyGoal) ? Math.max(1, Math.floor(rawDailyGoal)) : 5;
    const mushafVersion = (body.mushaf_version ?? 'Standard').trim().slice(0, 120) || 'Standard';

    await pool.execute(
      `
      INSERT INTO deen_quran_progress (log_date, pages_read, daily_goal, mushaf_version)
      VALUES (?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE pages_read = VALUES(pages_read), daily_goal = VALUES(daily_goal), mushaf_version = VALUES(mushaf_version)
      `,
      [londonTodayYmd(), pagesRead, dailyGoal, mushafVersion],
    );

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ message: 'Unable to save Quran settings.' }, { status: 500 });
  }
}
