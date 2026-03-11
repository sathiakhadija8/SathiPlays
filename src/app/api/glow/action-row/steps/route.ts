import { NextResponse } from 'next/server';
import { type ResultSetHeader } from 'mysql2';
import pool from '../../../../../lib/db';
import { ensureGlowActionRowSchema, getActionRowToday } from '../../../../../lib/glow-action-row';
import { localTodayYMD } from '../../../../../lib/glow-schedule';

export const dynamic = 'force-dynamic';

type Body = { steps?: unknown };

export async function POST(request: Request) {
  try {
    await ensureGlowActionRowSchema();
    const body = (await request.json().catch(() => ({}))) as Body;
    const steps = Number(body.steps);
    if (!Number.isFinite(steps) || steps <= 0) {
      return NextResponse.json({ ok: false, message: 'steps must be > 0.' }, { status: 400 });
    }

    await pool.execute<ResultSetHeader>(`INSERT INTO steps_logs (log_date, steps) VALUES (?, ?)`, [localTodayYMD(), Math.round(steps)]);
    return NextResponse.json({ ok: true, ...(await getActionRowToday()) });
  } catch {
    return NextResponse.json({ ok: false, message: 'Unable to save steps log.' }, { status: 500 });
  }
}
