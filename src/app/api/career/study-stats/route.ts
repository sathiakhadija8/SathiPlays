import { NextResponse } from 'next/server';
import { type RowDataPacket } from 'mysql2';
import pool from '../../../../lib/db';
import { ensureStudySessionsTable } from '../../../../lib/career-schema';

export const dynamic = 'force-dynamic';

type StatRow = RowDataPacket & {
  total_minutes: number;
  sessions_count: number;
};

export async function GET() {
  try {
    await ensureStudySessionsTable();

    const [last7Rows] = await pool.execute<StatRow[]>(
      `SELECT
          COALESCE(SUM(duration_minutes), 0) AS total_minutes,
          COUNT(*) AS sessions_count
       FROM study_sessions
       WHERE date >= DATE_SUB(CURDATE(), INTERVAL 6 DAY)
         AND date <= CURDATE()`,
    );

    const [last30Rows] = await pool.execute<StatRow[]>(
      `SELECT
          COALESCE(SUM(duration_minutes), 0) AS total_minutes,
          COUNT(*) AS sessions_count
       FROM study_sessions
       WHERE date >= DATE_SUB(CURDATE(), INTERVAL 29 DAY)
         AND date <= CURDATE()`,
    );

    const [yearRows] = await pool.execute<StatRow[]>(
      `SELECT
          COALESCE(SUM(duration_minutes), 0) AS total_minutes,
          COUNT(*) AS sessions_count
       FROM study_sessions
       WHERE YEAR(date) = YEAR(CURDATE())`,
    );

    const last7 = last7Rows[0] ?? { total_minutes: 0, sessions_count: 0 };
    const last30 = last30Rows[0] ?? { total_minutes: 0, sessions_count: 0 };
    const thisYear = yearRows[0] ?? { total_minutes: 0, sessions_count: 0 };

    return NextResponse.json({
      last_7_days: {
        total_minutes: Number(last7.total_minutes ?? 0),
        sessions_count: Number(last7.sessions_count ?? 0),
      },
      last_30_days: {
        total_minutes: Number(last30.total_minutes ?? 0),
        sessions_count: Number(last30.sessions_count ?? 0),
      },
      this_year: {
        total_minutes: Number(thisYear.total_minutes ?? 0),
        sessions_count: Number(thisYear.sessions_count ?? 0),
      },
    });
  } catch {
    return NextResponse.json({ ok: false, message: 'Unable to load study stats.' }, { status: 500 });
  }
}
