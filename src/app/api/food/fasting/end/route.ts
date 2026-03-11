import { NextResponse } from 'next/server';
import { type ResultSetHeader } from 'mysql2';
import pool from '../../../../../lib/db';
import { nowSqlDateTime } from '../../../../../lib/food-helpers';

export const dynamic = 'force-dynamic';

export async function POST() {
  try {
    await pool.execute<ResultSetHeader>(
      `UPDATE fasting_sessions
       SET ended_at = ?
       WHERE ended_at IS NULL`,
      [nowSqlDateTime()],
    );
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false, message: 'Unable to end fasting session.' }, { status: 500 });
  }
}
