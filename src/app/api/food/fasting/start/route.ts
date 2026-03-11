import { NextResponse } from 'next/server';
import { type ResultSetHeader, type RowDataPacket } from 'mysql2';
import pool from '../../../../../lib/db';
import { nowSqlDateTime } from '../../../../../lib/food-helpers';

export const dynamic = 'force-dynamic';

type Body = {
  fast_type?: unknown;
  start_time?: unknown;
  end_time?: unknown;
};

function normalizeFastType(value: unknown) {
  if (typeof value !== 'string') return null;
  const v = value.trim();
  if (!v) return null;
  return v.slice(0, 40);
}

export async function POST(request: Request) {
  const connection = await pool.getConnection();
  try {
    const body = (await request.json()) as Body;
    const fastType = normalizeFastType(body.fast_type);
    const startTime = typeof body.start_time === 'string' ? body.start_time.trim().slice(0, 10) : null;
    const endTime = typeof body.end_time === 'string' ? body.end_time.trim().slice(0, 10) : null;
    if (!fastType) {
      return NextResponse.json({ ok: false, message: 'fast_type is required.' }, { status: 400 });
    }

    await connection.beginTransaction();
    const [plans] = await connection.execute<RowDataPacket[]>(
      `SELECT id
       FROM fasting_plans
       WHERE is_active = 1
       ORDER BY id DESC
       LIMIT 1`,
    );
    const planId = plans[0]?.id ? Number(plans[0].id) : null;

    await connection.execute<ResultSetHeader>(
      `UPDATE fasting_sessions
       SET ended_at = COALESCE(ended_at, ?)
       WHERE ended_at IS NULL`,
      [nowSqlDateTime()],
    );

    const [result] = await connection.execute<ResultSetHeader>(
      `INSERT INTO fasting_sessions (plan_id, fast_type, window_start_time, window_end_time, started_at)
       VALUES (?, ?, ?, ?, ?)`,
      [planId, fastType, startTime, endTime, nowSqlDateTime()],
    );
    await connection.commit();
    return NextResponse.json({ ok: true, session_id: result.insertId, fast_type: fastType });
  } catch {
    await connection.rollback();
    return NextResponse.json({ ok: false, message: 'Unable to start fasting session.' }, { status: 500 });
  } finally {
    connection.release();
  }
}
