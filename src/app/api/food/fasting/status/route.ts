import { NextResponse } from 'next/server';
import { type RowDataPacket } from 'mysql2';
import pool from '../../../../../lib/db';
import { computeFastingStatus } from '../../../../../lib/food-helpers';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const [plans] = await pool.execute<RowDataPacket[]>(
      `SELECT id, name, type, start_time, end_time, is_active
       FROM fasting_plans
       WHERE is_active = 1
       ORDER BY id DESC
       LIMIT 1`,
    );
    const [sessions] = await pool.execute<RowDataPacket[]>(
      `SELECT id, plan_id, fast_type, window_start_time, window_end_time, started_at, ended_at
       FROM fasting_sessions
       ORDER BY started_at DESC
       LIMIT 1`,
    );
    const status = computeFastingStatus((plans[0] as never) ?? null, (sessions[0] as never) ?? null);
    return NextResponse.json(status);
  } catch {
    return NextResponse.json({ ok: false, message: 'Unable to load fasting status.' }, { status: 500 });
  }
}
