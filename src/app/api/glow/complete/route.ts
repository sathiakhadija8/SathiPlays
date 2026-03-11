import { NextResponse } from 'next/server';
import pool from '../../../../lib/db';
import { applyRoutineCompletionAndStreak } from '../../../../lib/glow-helpers';

export const dynamic = 'force-dynamic';

type Body = {
  routine_id?: unknown;
};

export async function POST(request: Request) {
  const connection = await pool.getConnection();
  try {
    const body = (await request.json()) as Body;
    const routineId = Number(body.routine_id);
    if (!Number.isInteger(routineId) || routineId <= 0) {
      return NextResponse.json({ ok: false, message: 'routine_id is required.' }, { status: 400 });
    }

    await connection.beginTransaction();
    const result = await applyRoutineCompletionAndStreak(connection, routineId);
    await connection.commit();

    return NextResponse.json({ ok: true, ...result });
  } catch {
    await connection.rollback();
    return NextResponse.json({ ok: false, message: 'Unable to complete routine.' }, { status: 500 });
  } finally {
    connection.release();
  }
}
