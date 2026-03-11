import { NextResponse } from 'next/server';
import { type RowDataPacket } from 'mysql2';
import pool from '../../../../../lib/db';

export const dynamic = 'force-dynamic';

type SummaryRow = RowDataPacket & {
  total_applied: number;
  remote_logs: number;
  in_logs: number;
  total_logs: number;
};

export async function GET() {
  try {
    const [rows] = await pool.execute<SummaryRow[]>(
      `SELECT
          COALESCE(SUM(applied_count), 0) AS total_applied,
          COALESCE(SUM(CASE WHEN work_mode = 'remote' THEN 1 ELSE 0 END), 0) AS remote_logs,
          COALESCE(SUM(CASE WHEN work_mode = 'in' THEN 1 ELSE 0 END), 0) AS in_logs,
          COUNT(*) AS total_logs
       FROM job_hunt_logs`,
    );

    const row = rows[0] ?? { total_applied: 0, remote_logs: 0, in_logs: 0, total_logs: 0 };
    return NextResponse.json(row);
  } catch {
    return NextResponse.json({ ok: false, message: 'Unable to load job summary.' }, { status: 500 });
  }
}
