import { NextResponse } from 'next/server';
import { type ResultSetHeader } from 'mysql2';
import pool from '../../../../../../lib/db';

export const dynamic = 'force-dynamic';

type Body = {
  drink_id?: unknown;
  day_of_week?: unknown;
  time_slot?: unknown;
  due_time?: unknown;
  notes?: unknown;
  enabled?: unknown;
};

const VALID_SLOTS = new Set(['morning', 'midday', 'evening', 'night']);

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Body;
    const drinkId = Number(body.drink_id);
    const dayOfWeek = Number(body.day_of_week);
    const timeSlot = typeof body.time_slot === 'string' ? body.time_slot.trim().toLowerCase() : '';
    const dueTimeRaw = typeof body.due_time === 'string' ? body.due_time.trim() : '';
    const notes = typeof body.notes === 'string' ? body.notes.trim() : null;
    const enabled = body.enabled === undefined ? 1 : Number(body.enabled) ? 1 : 0;

    if (!Number.isInteger(drinkId) || drinkId <= 0) {
      return NextResponse.json({ ok: false, message: 'drink_id is required.' }, { status: 400 });
    }
    if (!Number.isInteger(dayOfWeek) || dayOfWeek < 0 || dayOfWeek > 6) {
      return NextResponse.json({ ok: false, message: 'day_of_week must be 0..6.' }, { status: 400 });
    }
    if (!VALID_SLOTS.has(timeSlot)) {
      return NextResponse.json({ ok: false, message: 'Invalid time_slot.' }, { status: 400 });
    }
    if (!/^\d{2}:\d{2}(:\d{2})?$/.test(dueTimeRaw)) {
      return NextResponse.json({ ok: false, message: 'Invalid due_time.' }, { status: 400 });
    }

    const dueTime = dueTimeRaw.length === 5 ? `${dueTimeRaw}:00` : dueTimeRaw;

    const [result] = await pool.execute<ResultSetHeader>(
      `
      INSERT INTO drink_schedules (drink_id, day_of_week, time_slot, due_time, notes, enabled)
      VALUES (?, ?, ?, ?, ?, ?)
      `,
      [drinkId, dayOfWeek, timeSlot, dueTime, notes ? notes.slice(0, 255) : null, enabled],
    );

    return NextResponse.json({ ok: true, insertedId: result.insertId });
  } catch {
    return NextResponse.json({ ok: false, message: 'Unable to create drink schedule.' }, { status: 500 });
  }
}
