import { NextResponse } from 'next/server';
import { type ResultSetHeader, type RowDataPacket } from 'mysql2';
import pool from '../../../../../lib/db';
import { ensureSupplementSchema } from '../../../../../lib/glow-supplements';
import { addPointsSafe } from '../../../../../lib/points-helpers';

export const dynamic = 'force-dynamic';

type TakeBody = {
  log_id?: unknown;
  scheduled_id?: unknown;
};

type LogRow = RowDataPacket & {
  id: number;
  completed: number;
};

export async function POST(request: Request) {
  try {
    await ensureSupplementSchema();
    const body = (await request.json().catch(() => ({}))) as TakeBody;
    const logIdCandidate = body.log_id === undefined ? body.scheduled_id : body.log_id;
    const logId = Number(logIdCandidate);

    if (!Number.isInteger(logId) || logId <= 0) {
      return NextResponse.json({ ok: false, message: 'log_id is required.' }, { status: 400 });
    }

    const [rows] = await pool.execute<LogRow[]>(
      `SELECT id, completed FROM supplement_logs WHERE id = ? LIMIT 1`,
      [logId],
    );
    const row = rows[0];
    if (!row) {
      return NextResponse.json({ ok: false, message: 'Supplement log not found.' }, { status: 404 });
    }

    const [result] = await pool.execute<ResultSetHeader>(
      `
      UPDATE supplement_logs
      SET completed = 1, completed_at = NOW(), taken_at = NOW(), status = 'taken'
      WHERE id = ?
      `,
      [logId],
    );
    if (result.affectedRows === 0) {
      return NextResponse.json({ ok: false, message: 'Unable to update supplement log.' }, { status: 500 });
    }

    const alreadyCompleted = Number(row.completed) === 1;
    const pointsAwarded = alreadyCompleted ? 0 : 9;
    if (!alreadyCompleted) {
      await addPointsSafe({
        domain: 'supplements',
        sourceType: 'supplement_taken',
        sourceId: logId,
        points: pointsAwarded,
        reason: 'Supplement taken on schedule',
      });
    }

    return NextResponse.json({ ok: true, already_completed: alreadyCompleted, points_awarded: pointsAwarded });
  } catch {
    return NextResponse.json({ ok: false, message: 'Unable to save supplement log.' }, { status: 500 });
  }
}
