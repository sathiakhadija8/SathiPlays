import { NextResponse } from 'next/server';
import { type RowDataPacket } from 'mysql2';
import pool from '../../../../lib/db';
import { addDaysSql, londonNowSql, monthStartSql, nextMonthStartSql } from '../../../../lib/events-helpers';

export const dynamic = 'force-dynamic';

type EventRow = RowDataPacket & {
  id: number;
  title: string;
  start_at: string;
  end_at: string | null;
  location: string | null;
  notes: string | null;
  category: string | null;
};

type Mode = '7d' | '30d' | 'all';

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

function parseMode(value: string | null): Mode {
  if (value === '7d' || value === '30d' || value === 'all') return value;
  return '30d';
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const mode = parseMode(searchParams.get('mode'));
    const month = searchParams.get('month');

    const nowSql = londonNowSql();

    let query = `SELECT id, title, start_at, end_at, location, notes, category FROM events WHERE start_at >= ?`;
    const params: Array<string | number> = [nowSql];

    if (mode === '7d' || mode === '30d') {
      const days = mode === '7d' ? 7 : 30;
      query += ' AND start_at < ?';
      params.push(addDaysSql(nowSql, days));
    }

    if (month && MONTH_RE.test(month)) {
      query += ' AND start_at >= ? AND start_at < ?';
      params.push(monthStartSql(month), nextMonthStartSql(month));
    }

    query += ' ORDER BY start_at ASC';

    const [rows] = await pool.execute<EventRow[]>(query, params);
    return NextResponse.json(rows);
  } catch {
    return NextResponse.json({ message: 'Unable to fetch events range.' }, { status: 500 });
  }
}
