import { NextResponse } from 'next/server';
import { type ResultSetHeader, type RowDataPacket } from 'mysql2';
import pool from '../../../../../lib/db';
import { ensureTravelTables, getTravelUserId } from '../../../../../lib/travel-server';

type Body = {
  tripId?: unknown;
};

type TripRow = RowDataPacket & {
  id: number;
  city: string;
  start_date: string;
};

type BookingRow = RowDataPacket & {
  title: string;
  checkin_at: string | null;
  gate_at: string | null;
  hotel_window_start_at: string | null;
  hotel_window_end_at: string | null;
  refund_deadline_at: string | null;
};

function toDate(value: string | null | undefined) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function asSqlDateTime(date: Date) {
  return date.toISOString().slice(0, 19).replace('T', ' ');
}

async function upsertReminder(params: {
  userId: number;
  tripId: number;
  reminderType: 'countdown' | 'checkin' | 'gate' | 'hotel' | 'refund' | 'custom';
  title: string;
  remindAt: Date;
}) {
  const remindAtSql = asSqlDateTime(params.remindAt);
  const [existing] = await pool.execute<Array<RowDataPacket & { id: number }>>(
    `SELECT id
     FROM travel_trip_reminders
     WHERE user_id = ? AND trip_id = ? AND reminder_type = ? AND title = ? AND remind_at = ?
     LIMIT 1`,
    [params.userId, params.tripId, params.reminderType, params.title, remindAtSql],
  );
  if (existing.length > 0) return;
  await pool.execute<ResultSetHeader>(
    `INSERT INTO travel_trip_reminders (user_id, trip_id, reminder_type, title, remind_at)
     VALUES (?, ?, ?, ?, ?)`,
    [params.userId, params.tripId, params.reminderType, params.title, remindAtSql],
  );
}

export async function POST(request: Request) {
  try {
    await ensureTravelTables();
    const userId = getTravelUserId();
    const body = (await request.json()) as Body;
    const tripId = Number(body.tripId);
    if (!Number.isInteger(tripId) || tripId <= 0) {
      return NextResponse.json({ ok: false, message: 'tripId is required.' }, { status: 400 });
    }

    const [tripRows] = await pool.execute<TripRow[]>(
      `SELECT id, city, start_date FROM travel_trips WHERE id = ? AND user_id = ? LIMIT 1`,
      [tripId, userId],
    );
    const trip = tripRows[0];
    if (!trip) return NextResponse.json({ ok: false, message: 'Trip not found.' }, { status: 404 });

    const startDate = new Date(String(trip.start_date).slice(0, 10) + 'T09:00:00Z');
    const milestones = [30, 14, 7, 3, 1];
    for (const day of milestones) {
      const remindAt = new Date(startDate.getTime() - day * 86400000);
      await upsertReminder({
        userId,
        tripId,
        reminderType: 'countdown',
        title: `${trip.city} trip starts in ${day} day${day === 1 ? '' : 's'}`,
        remindAt,
      });
    }

    const [bookingRows] = await pool.execute<BookingRow[]>(
      `SELECT title, checkin_at, gate_at, hotel_window_start_at, hotel_window_end_at, refund_deadline_at
       FROM travel_trip_bookings
       WHERE user_id = ? AND trip_id = ?`,
      [userId, tripId],
    );

    for (const booking of bookingRows) {
      const checkinAt = toDate(booking.checkin_at);
      if (checkinAt) {
        await upsertReminder({ userId, tripId, reminderType: 'checkin', title: `${booking.title} check-in`, remindAt: checkinAt });
      }
      const gateAt = toDate(booking.gate_at);
      if (gateAt) {
        await upsertReminder({ userId, tripId, reminderType: 'gate', title: `${booking.title} gate`, remindAt: gateAt });
      }
      const windowStart = toDate(booking.hotel_window_start_at);
      if (windowStart) {
        await upsertReminder({ userId, tripId, reminderType: 'hotel', title: `${booking.title} window opens`, remindAt: windowStart });
      }
      const windowEnd = toDate(booking.hotel_window_end_at);
      if (windowEnd) {
        await upsertReminder({ userId, tripId, reminderType: 'hotel', title: `${booking.title} window closes`, remindAt: windowEnd });
      }
      const refund = toDate(booking.refund_deadline_at);
      if (refund) {
        await upsertReminder({ userId, tripId, reminderType: 'refund', title: `${booking.title} refund deadline`, remindAt: refund });
      }
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false, message: 'Unable to auto-generate reminders.' }, { status: 500 });
  }
}
