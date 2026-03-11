import { NextResponse } from 'next/server';
import { type ResultSetHeader } from 'mysql2';
import pool from '../../../../../../../lib/db';

export const dynamic = 'force-dynamic';

type Body = {
  day_of_week?: unknown;
  time_slot?: unknown;
  due_time?: unknown;
  notes?: unknown;
  enabled?: unknown;
  is_active?: unknown;
};

const VALID_SLOTS = new Set(['morning', 'midday', 'evening', 'night']);

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  try {
    const id = Number(params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return NextResponse.json({ ok: false, message: 'Invalid id.' }, { status: 400 });
    }

    const body = (await request.json()) as Body;
    const dayOfWeek = body.day_of_week === undefined ? null : Number(body.day_of_week);
    const timeSlot = body.time_slot === undefined ? null : typeof body.time_slot === 'string' ? body.time_slot.trim().toLowerCase() : '';
    const dueTimeRaw = body.due_time === undefined ? null : typeof body.due_time === 'string' ? body.due_time.trim() : '';
    const notes = body.notes === undefined ? null : typeof body.notes === 'string' ? body.notes.trim() : '';
    const enabledRaw = body.enabled === undefined ? body.is_active : body.enabled;
    const enabled = enabledRaw === undefined ? null : Number(enabledRaw) ? 1 : 0;

    if (timeSlot !== null && !VALID_SLOTS.has(timeSlot)) {
      return NextResponse.json({ ok: false, message: 'Invalid time_slot.' }, { status: 400 });
    }
    if (dayOfWeek !== null && (!Number.isInteger(dayOfWeek) || dayOfWeek < 0 || dayOfWeek > 6)) {
      return NextResponse.json({ ok: false, message: 'day_of_week must be 0..6.' }, { status: 400 });
    }
    if (dueTimeRaw !== null && !/^\d{2}:\d{2}(:\d{2})?$/.test(dueTimeRaw)) {
      return NextResponse.json({ ok: false, message: 'Invalid due_time.' }, { status: 400 });
    }
    const dueTime = dueTimeRaw ? (dueTimeRaw.length === 5 ? `${dueTimeRaw}:00` : dueTimeRaw) : null;

    const [result] = await pool.execute<ResultSetHeader>(
      `
      UPDATE supplement_schedules
      SET
        day_of_week = COALESCE(?, day_of_week),
        time_slot = COALESCE(?, time_slot),
        due_time = COALESCE(?, due_time),
        notes = COALESCE(?, notes),
        enabled = COALESCE(?, enabled),
        is_active = COALESCE(?, is_active)
      WHERE id = ?
      `,
      [
        dayOfWeek,
        timeSlot,
        dueTime,
        notes === null ? null : notes.slice(0, 255),
        enabled,
        enabled,
        id,
      ],
    );

    if (result.affectedRows === 0) {
      return NextResponse.json({ ok: false, message: 'Schedule not found.' }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false, message: 'Unable to update schedule.' }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  try {
    const id = Number(params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return NextResponse.json({ ok: false, message: 'Invalid id.' }, { status: 400 });
    }
    const [result] = await pool.execute<ResultSetHeader>(`DELETE FROM supplement_schedules WHERE id = ?`, [id]);
    if (result.affectedRows === 0) {
      return NextResponse.json({ ok: false, message: 'Schedule not found.' }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false, message: 'Unable to delete schedule.' }, { status: 500 });
  }
}
