import { NextResponse } from 'next/server';
import { type ResultSetHeader } from 'mysql2';
import pool from '../../../../../lib/db';
import { todayYMD } from '../../../../../lib/career-helpers';

export const dynamic = 'force-dynamic';

type Body = {
  item_id?: unknown;
  minutes?: unknown;
  log_date?: unknown;
};

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Body;
    const itemId = Number(body.item_id);
    const minutes = Number(body.minutes);
    const logDateRaw = typeof body.log_date === 'string' ? body.log_date.trim() : '';
    const logDate = logDateRaw && DATE_RE.test(logDateRaw) ? logDateRaw : todayYMD();

    if (!Number.isInteger(itemId) || itemId <= 0) {
      return NextResponse.json({ ok: false, message: 'item_id is required.' }, { status: 400 });
    }
    if (!Number.isInteger(minutes) || minutes < 0 || minutes > 1440) {
      return NextResponse.json({ ok: false, message: 'minutes must be integer 0-1440.' }, { status: 400 });
    }

    await pool.execute<ResultSetHeader>(
      `INSERT INTO daily_practice_progress (item_id, log_date, minutes)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE minutes = VALUES(minutes)`,
      [itemId, logDate, minutes],
    );

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false, message: 'Unable to save daily progress.' }, { status: 500 });
  }
}
