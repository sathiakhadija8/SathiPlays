import { NextResponse } from 'next/server';
import pool from '../../../../../lib/db';
import { ensureDeenTables, londonTodayYmd } from '../../../../../lib/deen-server';
import { addPointsSafe } from '../../../../../lib/points-helpers';

export const dynamic = 'force-dynamic';

type Body = {
  pages?: unknown;
};

export async function POST(request: Request) {
  try {
    await ensureDeenTables();
    const body = (await request.json().catch(() => ({}))) as Body;
    const rawPages = Number(body.pages ?? 1);
    const pages = Number.isFinite(rawPages) ? Math.max(1, Math.floor(rawPages)) : 1;

    await pool.execute(
      `
      INSERT INTO deen_quran_progress (log_date, pages_read, daily_goal, mushaf_version)
      VALUES (?, ?, 5, 'Standard')
      ON DUPLICATE KEY UPDATE pages_read = pages_read + VALUES(pages_read)
      `,
      [londonTodayYmd(), pages],
    );

    const pointsAwarded = Math.min(20, Math.max(3, pages * 3));
    await addPointsSafe({
      domain: 'deen',
      sourceType: 'quran_pages',
      sourceId: null,
      points: pointsAwarded,
      reason: `Quran pages read +${pages}`,
    });

    return NextResponse.json({ ok: true, points_awarded: pointsAwarded });
  } catch {
    return NextResponse.json({ message: 'Unable to update Quran progress.' }, { status: 500 });
  }
}
