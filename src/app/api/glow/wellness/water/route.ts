import { NextResponse } from 'next/server';
import { type ResultSetHeader } from 'mysql2';
import pool from '../../../../../lib/db';
import { localTodayYMD } from '../../../../../lib/glow-supplements';
import { addPointsSafe } from '../../../../../lib/points-helpers';

export const dynamic = 'force-dynamic';

type Body = {
  amount_ml?: unknown;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Body;
    const amount = Number(body.amount_ml);
    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({ ok: false, message: 'amount_ml must be > 0.' }, { status: 400 });
    }

    const [result] = await pool.execute<ResultSetHeader>(
      `INSERT INTO water_logs (log_date, amount_ml) VALUES (?, ?)`,
      [localTodayYMD(), Math.round(amount)],
    );

    const pointsAwarded = Math.max(2, Math.min(10, Math.round(amount / 250) * 2));
    await addPointsSafe({
      domain: 'wellness',
      sourceType: 'water_log',
      sourceId: result.insertId || null,
      points: pointsAwarded,
      reason: `Water logged ${Math.round(amount)}ml`,
    });

    return NextResponse.json({ ok: true, points_awarded: pointsAwarded });
  } catch {
    return NextResponse.json({ ok: false, message: 'Unable to save water log.' }, { status: 500 });
  }
}
