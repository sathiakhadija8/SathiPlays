import { NextResponse } from 'next/server';
import { type RowDataPacket } from 'mysql2';
import pool from '../../../../lib/db';
import { parseSymptoms } from '../../../../lib/cycle-helpers';

export const dynamic = 'force-dynamic';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

type DayLogRow = RowDataPacket & {
  id: number;
  created_at: string;
  symptoms: string | null;
  bleeding_type: 'none' | 'spotting' | 'period';
  birth_control_taken: number;
  note: string | null;
};

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date');

    if (!date || !DATE_RE.test(date)) {
      return NextResponse.json({ message: 'date must be YYYY-MM-DD.' }, { status: 400 });
    }

    const [rows] = await pool.execute<DayLogRow[]>(
      `SELECT id, created_at, symptoms, bleeding_type, birth_control_taken, note
       FROM cycle_logs
       WHERE logged_for_date = ?
       ORDER BY created_at DESC, id DESC`,
      [date],
    );

    return NextResponse.json(
      rows.map((row) => ({
        id: row.id,
        created_at: row.created_at,
        symptoms: parseSymptoms(row.symptoms),
        bleeding_type: row.bleeding_type,
        birth_control_taken: row.birth_control_taken === 1,
        note: row.note,
      })),
    );
  } catch {
    return NextResponse.json({ message: 'Unable to fetch day logs.' }, { status: 500 });
  }
}
