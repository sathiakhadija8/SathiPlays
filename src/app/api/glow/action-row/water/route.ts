import { NextResponse } from 'next/server';
import { type ResultSetHeader } from 'mysql2';
import pool from '../../../../../lib/db';
import { ensureGlowActionRowSchema, getActionRowToday } from '../../../../../lib/glow-action-row';
import { localTodayYMD } from '../../../../../lib/glow-schedule';

export const dynamic = 'force-dynamic';

type Body = { amount_ml?: unknown };

export async function POST(request: Request) {
  try {
    await ensureGlowActionRowSchema();
    const body = (await request.json().catch(() => ({}))) as Body;
    const amount = Number(body.amount_ml);
    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({ ok: false, message: 'amount_ml must be > 0.' }, { status: 400 });
    }

    await pool.execute<ResultSetHeader>(`INSERT INTO water_logs (log_date, amount_ml) VALUES (?, ?)`, [localTodayYMD(), Math.round(amount)]);
    return NextResponse.json({ ok: true, ...(await getActionRowToday()) });
  } catch {
    return NextResponse.json({ ok: false, message: 'Unable to save water log.' }, { status: 500 });
  }
}
