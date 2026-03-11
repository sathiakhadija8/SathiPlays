import { NextResponse } from 'next/server';
import { type RowDataPacket } from 'mysql2';
import pool from '../../../../lib/db';

export const dynamic = 'force-dynamic';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

type TaskRow = RowDataPacket & {
  id: number;
  title: string;
  task_date: string;
  start_at: string;
  end_at: string;
  category: string | null;
  completed_at: string | null;
};

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const from = searchParams.get('from');
    const to = searchParams.get('to');

    if (!from || !to || !DATE_RE.test(from) || !DATE_RE.test(to)) {
      return NextResponse.json({ message: 'from and to must be YYYY-MM-DD.' }, { status: 400 });
    }

    const [rows] = await pool.execute<TaskRow[]>(
      `SELECT id, title, task_date, start_at, end_at, category, completed_at
       FROM timeline_tasks
       WHERE task_date >= ? AND task_date <= ?
       ORDER BY start_at ASC, id ASC`,
      [from, to],
    );

    return NextResponse.json(rows);
  } catch {
    return NextResponse.json({ message: 'Unable to fetch timeline range.' }, { status: 500 });
  }
}
