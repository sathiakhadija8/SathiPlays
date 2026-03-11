import { NextResponse } from 'next/server';
import { type RowDataPacket } from 'mysql2';
import pool from '../../../../lib/db';

export const dynamic = 'force-dynamic';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

type EventRow = RowDataPacket & {
  id: number;
  title: string;
  start_at: string;
  end_at: string | null;
  location: string | null;
  notes: string | null;
  category: string | null;
};

function isValidDateInput(value: string): boolean {
  if (!DATE_RE.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const parsed = new Date(year, month - 1, day);
  return (
    !Number.isNaN(parsed.getTime()) &&
    parsed.getFullYear() === year &&
    parsed.getMonth() === month - 1 &&
    parsed.getDate() === day
  );
}

function nextDate(date: string): string {
  const [y, m, d] = date.split('-').map(Number);
  const value = new Date(Date.UTC(y, m - 1, d));
  value.setUTCDate(value.getUTCDate() + 1);
  const yy = value.getUTCFullYear();
  const mm = String(value.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(value.getUTCDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date');

    if (!date || !isValidDateInput(date)) {
      return NextResponse.json({ message: 'date must be YYYY-MM-DD' }, { status: 400 });
    }

    const start = `${date} 00:00:00`;
    const end = `${nextDate(date)} 00:00:00`;

    const [rows] = await pool.execute<EventRow[]>(
      `SELECT id, title, start_at, end_at, location, notes, category
       FROM events
       WHERE start_at >= ? AND start_at < ?
       ORDER BY start_at ASC`,
      [start, end],
    );

    return NextResponse.json(rows);
  } catch {
    return NextResponse.json({ message: 'Unable to fetch day events.' }, { status: 500 });
  }
}
