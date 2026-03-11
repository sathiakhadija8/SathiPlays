import { NextResponse } from 'next/server';
import { type ResultSetHeader } from 'mysql2';
import pool from '../../../../lib/db';
import { ensureDeenTables, londonTodayYmd } from '../../../../lib/deen-server';
import { addPointsSafe } from '../../../../lib/points-helpers';

export const dynamic = 'force-dynamic';

type Body = {
  planned_minutes?: unknown;
  actual_minutes?: unknown;
  started_at?: string;
  ended_at?: string;
};

export async function POST(request: Request) {
  try {
    await ensureDeenTables();
    const body = (await request.json().catch(() => ({}))) as Body;

    const planned = Math.max(1, Math.min(180, Number(body.planned_minutes ?? 0)));
    const actual = Math.max(1, Math.min(180, Number(body.actual_minutes ?? 0)));
    if (!Number.isFinite(planned) || !Number.isFinite(actual)) {
      return NextResponse.json({ message: 'Invalid learning minutes.' }, { status: 400 });
    }

    const startedAt = body.started_at ? new Date(body.started_at) : new Date();
    const endedAt = body.ended_at ? new Date(body.ended_at) : new Date();

    const [result] = await pool.execute<ResultSetHeader>(
      `
      INSERT INTO deen_learning_sessions (log_date, planned_minutes, actual_minutes, started_at, ended_at)
      VALUES (?, ?, ?, ?, ?)
      `,
      [londonTodayYmd(), planned, actual, startedAt, endedAt],
    );

    const pointsAwarded = actual >= 30 ? 20 : actual >= 15 ? 12 : 8;
    await addPointsSafe({
      domain: 'deen',
      sourceType: 'learning_session',
      sourceId: result.insertId || null,
      points: pointsAwarded,
      reason: `Deen learning ${actual}m`,
    });

    return NextResponse.json({ ok: true, points_awarded: pointsAwarded });
  } catch {
    return NextResponse.json({ message: 'Unable to save learning session.' }, { status: 500 });
  }
}
