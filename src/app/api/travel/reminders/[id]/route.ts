import { NextResponse } from 'next/server';
import { type ResultSetHeader } from 'mysql2';
import pool from '../../../../../lib/db';
import { ensureTravelTables, getTravelUserId } from '../../../../../lib/travel-server';

type Body = {
  title?: unknown;
  notes?: unknown;
  remindAt?: unknown;
  reminderType?: unknown;
  isDone?: unknown;
};

type ReminderType = 'countdown' | 'checkin' | 'gate' | 'hotel' | 'refund' | 'custom';

function isReminderType(value: string): value is ReminderType {
  return value === 'countdown' || value === 'checkin' || value === 'gate' || value === 'hotel' || value === 'refund' || value === 'custom';
}

function toIsoOrNull(value: unknown) {
  if (typeof value !== 'string') return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 19).replace('T', ' ');
}

export async function PATCH(request: Request, context: { params: { id: string } }) {
  try {
    await ensureTravelTables();
    const userId = getTravelUserId();
    const id = Number(context.params.id);
    if (!Number.isInteger(id) || id <= 0) return NextResponse.json({ ok: false, message: 'Invalid id.' }, { status: 400 });

    const body = (await request.json()) as Body;
    const title = String(body.title ?? '').trim();
    const notes = String(body.notes ?? '').trim();
    const reminderType = String(body.reminderType ?? 'custom').trim();
    const remindAt = toIsoOrNull(body.remindAt);
    const isDone = body.isDone === undefined ? null : (body.isDone ? 1 : 0);

    if (!title) return NextResponse.json({ ok: false, message: 'title is required.' }, { status: 400 });
    if (!isReminderType(reminderType)) return NextResponse.json({ ok: false, message: 'reminderType is invalid.' }, { status: 400 });
    if (!remindAt) return NextResponse.json({ ok: false, message: 'remindAt is required.' }, { status: 400 });

    const [result] = await pool.execute<ResultSetHeader>(
      `UPDATE travel_trip_reminders
       SET title = ?, notes = ?, reminder_type = ?, remind_at = ?, is_done = COALESCE(?, is_done)
       WHERE id = ? AND user_id = ?`,
      [title, notes || null, reminderType, remindAt, isDone, id, userId],
    );
    if (!result.affectedRows) return NextResponse.json({ ok: false, message: 'Reminder not found.' }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false, message: 'Unable to update reminder.' }, { status: 500 });
  }
}

export async function DELETE(_: Request, context: { params: { id: string } }) {
  try {
    await ensureTravelTables();
    const userId = getTravelUserId();
    const id = Number(context.params.id);
    if (!Number.isInteger(id) || id <= 0) return NextResponse.json({ ok: false, message: 'Invalid id.' }, { status: 400 });

    const [result] = await pool.execute<ResultSetHeader>(
      `DELETE FROM travel_trip_reminders WHERE id = ? AND user_id = ?`,
      [id, userId],
    );
    if (!result.affectedRows) return NextResponse.json({ ok: false, message: 'Reminder not found.' }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false, message: 'Unable to delete reminder.' }, { status: 500 });
  }
}
