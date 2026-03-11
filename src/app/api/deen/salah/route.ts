import { NextResponse } from 'next/server';
import { type ResultSetHeader } from 'mysql2';
import pool from '../../../../lib/db';
import { DEEN_SALAH_ORDER, ensureDeenTables, londonTodayYmd } from '../../../../lib/deen-server';
import { addPointsSafe } from '../../../../lib/points-helpers';

export const dynamic = 'force-dynamic';

type Body = {
  prayer_key?: string;
};

export async function POST(request: Request) {
  try {
    await ensureDeenTables();
    const body = (await request.json().catch(() => ({}))) as Body;
    const prayer = (body.prayer_key ?? '').trim();

    if (!DEEN_SALAH_ORDER.includes(prayer as (typeof DEEN_SALAH_ORDER)[number])) {
      return NextResponse.json({ message: 'Invalid prayer key.' }, { status: 400 });
    }

    const [result] = await pool.execute<ResultSetHeader>(
      `
      INSERT INTO deen_salah_logs (log_date, prayer_key, prayed_at)
      VALUES (?, ?, NOW())
      ON DUPLICATE KEY UPDATE prayed_at = VALUES(prayed_at)
      `,
      [londonTodayYmd(), prayer],
    );

    const firstTimeToday = result.affectedRows === 1;
    if (firstTimeToday) {
      await addPointsSafe({
        domain: 'deen',
        sourceType: 'salah_complete',
        sourceId: result.insertId || null,
        points: 8,
        reason: `Salah completed: ${prayer}`,
      });
    }

    return NextResponse.json({ ok: true, points_awarded: firstTimeToday ? 8 : 0 });
  } catch {
    return NextResponse.json({ message: 'Unable to save salah.' }, { status: 500 });
  }
}
