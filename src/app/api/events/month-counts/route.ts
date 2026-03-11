import { NextResponse } from 'next/server';
import { type RowDataPacket } from 'mysql2';
import pool from '../../../../lib/db';
import { monthKeyFromDate, monthStartSql, nextMonthStartSql } from '../../../../lib/events-helpers';

export const dynamic = 'force-dynamic';

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

type CountRow = RowDataPacket & {
  date: string | Date;
  count: number | string;
};

function normalizeDate(value: string | Date): string {
  if (typeof value === 'string') return value.slice(0, 10);
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const date = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${date}`;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const monthParam = searchParams.get('month');
    const month = monthParam && MONTH_RE.test(monthParam) ? monthParam : monthKeyFromDate(new Date());

    const [rows] = await pool.execute<CountRow[]>(
      `SELECT DATE(start_at) AS date, COUNT(*) AS count
       FROM events
       WHERE start_at >= ? AND start_at < ?
       GROUP BY DATE(start_at)
       ORDER BY DATE(start_at) ASC`,
      [monthStartSql(month), nextMonthStartSql(month)],
    );

    return NextResponse.json(rows.map((row) => ({ date: normalizeDate(row.date), count: Number(row.count) })));
  } catch {
    return NextResponse.json({ message: 'Unable to fetch month counts.' }, { status: 500 });
  }
}
