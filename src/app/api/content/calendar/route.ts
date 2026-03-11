import { NextResponse } from 'next/server';
import { type RowDataPacket } from 'mysql2';
import pool from '../../../../lib/db';

export const dynamic = 'force-dynamic';

type CalendarRow = RowDataPacket & {
  id: number;
  title: string;
  platform: 'tiktok' | 'instagram' | 'youtube' | 'pinterest' | 'facebook';
  status: 'scheduled';
  scheduled_at: string;
};

function parseMonth(month: string | null) {
  if (!month) return null;
  const match = month.match(/^(\d{4})-(\d{2})$/);
  if (!match) return null;
  const year = Number(match[1]);
  const monthIdx = Number(match[2]);
  if (monthIdx < 1 || monthIdx > 12) return null;
  return { year, monthIdx };
}

function toMysqlDateTime(date: Date) {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(
    date.getMinutes(),
  )}:${pad(date.getSeconds())}`;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const brandId = Number(searchParams.get('brand_id'));
    if (!Number.isInteger(brandId) || brandId <= 0) {
      return NextResponse.json({ ok: false, message: 'brand_id is required.' }, { status: 400 });
    }

    const month = parseMonth(searchParams.get('month'));
    if (!month) {
      return NextResponse.json({ ok: false, message: 'month must be YYYY-MM.' }, { status: 400 });
    }

    const start = new Date(month.year, month.monthIdx - 1, 1, 0, 0, 0);
    const end = new Date(month.year, month.monthIdx, 1, 0, 0, 0);

    const [rows] = await pool.execute<CalendarRow[]>(
      `
      SELECT id, title, platform, status, scheduled_at
      FROM content_items
      WHERE brand_id = ?
        AND status = 'scheduled'
        AND scheduled_at IS NOT NULL
        AND scheduled_at >= ?
        AND scheduled_at < ?
      ORDER BY scheduled_at ASC
      `,
      [brandId, toMysqlDateTime(start), toMysqlDateTime(end)],
    );

    return NextResponse.json(rows);
  } catch {
    return NextResponse.json({ ok: false, message: 'Unable to load content calendar.' }, { status: 500 });
  }
}
