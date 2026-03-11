import { NextResponse } from 'next/server';
import { type ResultSetHeader } from 'mysql2';
import pool from '../../../lib/db';
import { EVENT_CATEGORIES } from '../../../lib/events-types';

export const dynamic = 'force-dynamic';

const DATETIME_RE = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}(:\d{2})?$/;

type Body = {
  title?: unknown;
  start_at?: unknown;
  end_at?: unknown;
  location?: unknown;
  notes?: unknown;
  category?: unknown;
};

function normalizeDateTimeInput(value: string): string | null {
  const trimmed = value.trim();
  if (!DATETIME_RE.test(trimmed)) return null;

  const [datePart, rawTimePart] = trimmed.split(' ');
  const [year, month, day] = datePart.split('-').map(Number);
  const timePart = rawTimePart.length === 5 ? `${rawTimePart}:00` : rawTimePart;
  const [hour, minute, second] = timePart.split(':').map(Number);

  const parsed = new Date(year, month - 1, day, hour, minute, second);
  if (Number.isNaN(parsed.getTime())) return null;
  if (
    parsed.getFullYear() !== year ||
    parsed.getMonth() !== month - 1 ||
    parsed.getDate() !== day ||
    parsed.getHours() !== hour ||
    parsed.getMinutes() !== minute ||
    parsed.getSeconds() !== second
  ) {
    return null;
  }

  const yyyy = String(year).padStart(4, '0');
  const mm = String(month).padStart(2, '0');
  const dd = String(day).padStart(2, '0');
  const hh = String(hour).padStart(2, '0');
  const mi = String(minute).padStart(2, '0');
  const ss = String(second).padStart(2, '0');
  return `${yyyy}-${mm}-${dd} ${hh}:${mi}:${ss}`;
}

export async function POST(request: Request) {
  try {
    let body: Body;
    try {
      body = (await request.json()) as Body;
    } catch {
      return NextResponse.json({ ok: false, message: 'Request body must be valid JSON.' }, { status: 400 });
    }

    const title = typeof body.title === 'string' ? body.title.trim() : '';
    if (!title || title.length > 120) {
      return NextResponse.json({ ok: false, message: 'title is required and must be <= 120 chars.' }, { status: 400 });
    }

    const startAtRaw = typeof body.start_at === 'string' ? body.start_at : '';
    const startAt = normalizeDateTimeInput(startAtRaw);
    if (!startAt) {
      return NextResponse.json({ ok: false, message: 'start_at must be DATETIME string (YYYY-MM-DD HH:MM[:SS]).' }, { status: 400 });
    }

    const endAtRaw = typeof body.end_at === 'string' ? body.end_at : '';
    const endAt = endAtRaw.trim() ? normalizeDateTimeInput(endAtRaw) : null;
    if (endAtRaw.trim() && !endAt) {
      return NextResponse.json({ ok: false, message: 'end_at must be DATETIME string.' }, { status: 400 });
    }
    if (endAt && endAt < startAt) {
      return NextResponse.json({ ok: false, message: 'end_at must be greater than or equal to start_at.' }, { status: 400 });
    }

    const location = typeof body.location === 'string' ? body.location.trim() : null;
    if (location && location.length > 120) {
      return NextResponse.json({ ok: false, message: 'location must be <= 120 chars.' }, { status: 400 });
    }

    const notes = typeof body.notes === 'string' ? body.notes.trim() : null;

    const category = typeof body.category === 'string' && body.category.trim() ? body.category.trim() : null;
    if (category && !EVENT_CATEGORIES.includes(category as (typeof EVENT_CATEGORIES)[number])) {
      return NextResponse.json({ ok: false, message: 'category is invalid.' }, { status: 400 });
    }

    const [result] = await pool.execute<ResultSetHeader>(
      `INSERT INTO events (title, start_at, end_at, location, notes, category)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [title, startAt, endAt, location && location.length ? location : null, notes && notes.length ? notes : null, category],
    );

    return NextResponse.json({ ok: true, insertedId: result.insertId });
  } catch (error) {
    console.error('[events][POST] failed to create event', error);
    return NextResponse.json({ ok: false, message: 'Unable to create event right now.' }, { status: 500 });
  }
}
