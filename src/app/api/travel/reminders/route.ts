import { NextResponse } from 'next/server';
import { type ResultSetHeader, type RowDataPacket } from 'mysql2';
import pool from '../../../../lib/db';
import { ensureTravelTables, getTravelUserId } from '../../../../lib/travel-server';

type ReminderType = 'countdown' | 'checkin' | 'gate' | 'hotel' | 'refund' | 'custom';

type ReminderRow = RowDataPacket & {
  id: number;
  trip_id: number;
  reminder_type: ReminderType;
  title: string;
  notes: string | null;
  remind_at: string;
  is_done: number;
};

type Body = {
  tripId?: unknown;
  reminderType?: unknown;
  title?: unknown;
  notes?: unknown;
  remindAt?: unknown;
};

function isReminderType(value: string): value is ReminderType {
  return value === 'countdown' || value === 'checkin' || value === 'gate' || value === 'hotel' || value === 'refund' || value === 'custom';
}

function toIsoOrNull(value: unknown) {
  if (typeof value !== 'string') return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 19).replace('T', ' ');
}

export async function GET(request: Request) {
  try {
    await ensureTravelTables();
    const userId = getTravelUserId();
    const { searchParams } = new URL(request.url);
    const tripId = Number(searchParams.get('tripId'));
    if (!Number.isInteger(tripId) || tripId <= 0) {
      return NextResponse.json({ ok: false, message: 'tripId is required.' }, { status: 400 });
    }

    const [rows] = await pool.execute<ReminderRow[]>(
      `SELECT id, trip_id, reminder_type, title, notes, remind_at, is_done
       FROM travel_trip_reminders
       WHERE user_id = ? AND trip_id = ?
       ORDER BY remind_at ASC, id ASC`,
      [userId, tripId],
    );
    return NextResponse.json(
      rows.map((row) => ({
        id: String(row.id),
        tripId: String(row.trip_id),
        reminderType: row.reminder_type,
        title: row.title,
        notes: row.notes ?? '',
        remindAt: String(row.remind_at),
        isDone: Boolean(row.is_done),
      })),
    );
  } catch {
    return NextResponse.json({ ok: false, message: 'Unable to load reminders.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    await ensureTravelTables();
    const userId = getTravelUserId();
    const body = (await request.json()) as Body;
    const tripId = Number(body.tripId);
    const reminderType = String(body.reminderType ?? 'custom').trim();
    const title = String(body.title ?? '').trim();
    const notes = String(body.notes ?? '').trim();
    const remindAt = toIsoOrNull(body.remindAt);

    if (!Number.isInteger(tripId) || tripId <= 0) return NextResponse.json({ ok: false, message: 'tripId is required.' }, { status: 400 });
    if (!isReminderType(reminderType)) return NextResponse.json({ ok: false, message: 'reminderType is invalid.' }, { status: 400 });
    if (!title) return NextResponse.json({ ok: false, message: 'title is required.' }, { status: 400 });
    if (!remindAt) return NextResponse.json({ ok: false, message: 'remindAt is required.' }, { status: 400 });

    const [result] = await pool.execute<ResultSetHeader>(
      `INSERT INTO travel_trip_reminders (user_id, trip_id, reminder_type, title, notes, remind_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [userId, tripId, reminderType, title, notes || null, remindAt],
    );
    return NextResponse.json({ ok: true, id: String(result.insertId) });
  } catch {
    return NextResponse.json({ ok: false, message: 'Unable to create reminder.' }, { status: 500 });
  }
}
