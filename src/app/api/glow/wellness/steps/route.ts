import { NextResponse } from 'next/server';
import { type ResultSetHeader } from 'mysql2';
import pool from '../../../../../lib/db';
import { localTodayYMD } from '../../../../../lib/glow-supplements';
import { addPointsSafe } from '../../../../../lib/points-helpers';

export const dynamic = 'force-dynamic';

type Body = {
  steps?: unknown;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Body;
    const steps = Number(body.steps);
    if (!Number.isFinite(steps) || steps <= 0) {
      return NextResponse.json({ ok: false, message: 'steps must be > 0.' }, { status: 400 });
    }

    const [result] = await pool.execute<ResultSetHeader>(
      `INSERT INTO steps_logs (log_date, steps) VALUES (?, ?)`,
      [localTodayYMD(), Math.round(steps)],
    );

    const pointsAwarded = Math.max(2, Math.min(20, Math.round(steps / 1000) * 2));
    await addPointsSafe({
      domain: 'wellness',
      sourceType: 'steps_log',
      sourceId: result.insertId || null,
      points: pointsAwarded,
      reason: `Steps logged ${Math.round(steps)}`,
    });

    return NextResponse.json({ ok: true, points_awarded: pointsAwarded });
  } catch {
    return NextResponse.json({ ok: false, message: 'Unable to save steps log.' }, { status: 500 });
  }
}
