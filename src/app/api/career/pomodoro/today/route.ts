import { NextResponse } from 'next/server';
import { type RowDataPacket } from 'mysql2';
import pool from '../../../../../lib/db';
import { todayYMD } from '../../../../../lib/career-helpers';

export const dynamic = 'force-dynamic';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

type SessionRow = RowDataPacket & {
  id: number;
  subject_id: number;
  label: string;
  planned_minutes: number;
  actual_minutes: number;
  started_at: string;
  ended_at: string;
};

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date')?.trim() ?? todayYMD();
    if (!DATE_RE.test(date)) {
      return NextResponse.json({ ok: false, message: 'date must be YYYY-MM-DD.' }, { status: 400 });
    }

    const [rows] = await pool.execute<SessionRow[]>(
      `SELECT id, subject_id, label, planned_minutes, actual_minutes, started_at, ended_at
       FROM pomodoro_sessions
       WHERE DATE(started_at) = ?
       ORDER BY started_at ASC`,
      [date],
    );

    return NextResponse.json(rows);
  } catch {
    return NextResponse.json({ ok: false, message: 'Unable to fetch today pomodoro sessions.' }, { status: 500 });
  }
}
