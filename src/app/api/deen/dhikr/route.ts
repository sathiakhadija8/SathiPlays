import { NextResponse } from 'next/server';
import { type ResultSetHeader } from 'mysql2';
import pool from '../../../../lib/db';
import { DEEN_DHIKR_TYPES, ensureDeenTables, londonTodayYmd } from '../../../../lib/deen-server';
import { addPointsSafe } from '../../../../lib/points-helpers';

export const dynamic = 'force-dynamic';

type Body = {
  dhikr_type?: string;
};

export async function POST(request: Request) {
  try {
    await ensureDeenTables();
    const body = (await request.json().catch(() => ({}))) as Body;
    const type = (body.dhikr_type ?? '').trim();

    if (!DEEN_DHIKR_TYPES.includes(type as (typeof DEEN_DHIKR_TYPES)[number])) {
      return NextResponse.json({ message: 'Invalid dhikr type.' }, { status: 400 });
    }

    const [result] = await pool.execute<ResultSetHeader>(
      `INSERT INTO deen_dhikr_logs (log_date, dhikr_type, logged_at) VALUES (?, ?, NOW())`,
      [londonTodayYmd(), type],
    );

    await addPointsSafe({
      domain: 'deen',
      sourceType: 'dhikr_log',
      sourceId: result.insertId || null,
      points: 2,
      reason: `Dhikr logged: ${type}`,
    });

    return NextResponse.json({ ok: true, points_awarded: 2 });
  } catch {
    return NextResponse.json({ message: 'Unable to log dhikr.' }, { status: 500 });
  }
}
