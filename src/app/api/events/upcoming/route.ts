import { NextResponse } from 'next/server';
import { type RowDataPacket } from 'mysql2';
import pool from '../../../../lib/db';
import { addDaysSql, londonNowSql } from '../../../../lib/events-helpers';

export const dynamic = 'force-dynamic';

type EventRow = RowDataPacket & {
  id: number;
  title: string;
  start_at: string;
  end_at: string | null;
  location: string | null;
  category: string | null;
};

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const limitParam = Number(searchParams.get('limit') ?? 3);
    const daysParam = Number(searchParams.get('days') ?? 30);

    const limit = Number.isFinite(limitParam) ? Math.max(1, Math.min(50, Math.floor(limitParam))) : 3;
    const days = Number.isFinite(daysParam) ? Math.max(1, Math.min(365, Math.floor(daysParam))) : 30;

    const nowSql = londonNowSql();
    const endSql = addDaysSql(nowSql, days);

    const [rows] = await pool.execute<EventRow[]>(
      `SELECT id, title, start_at, end_at, location, category
       FROM events
       WHERE start_at >= ? AND start_at < ?
       ORDER BY start_at ASC
       LIMIT ${limit}`,
      [nowSql, endSql],
    );

    return NextResponse.json(rows);
  } catch {
    return NextResponse.json({ message: 'Unable to fetch upcoming events.' }, { status: 500 });
  }
}
