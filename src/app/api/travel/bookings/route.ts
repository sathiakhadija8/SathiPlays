import { NextResponse } from 'next/server';
import { type ResultSetHeader, type RowDataPacket } from 'mysql2';
import pool from '../../../../lib/db';
import { ensureTravelTables, getTravelUserId } from '../../../../lib/travel-server';

type BookingType = 'flight' | 'hotel' | 'train' | 'activity' | 'other';

type BookingRow = RowDataPacket & {
  id: number;
  trip_id: number;
  booking_type: BookingType;
  title: string;
  provider: string | null;
  reference_code: string | null;
  start_at: string | null;
  end_at: string | null;
  checkin_at: string | null;
  gate_at: string | null;
  hotel_window_start_at: string | null;
  hotel_window_end_at: string | null;
  refund_deadline_at: string | null;
  notes: string | null;
};

type Body = {
  tripId?: unknown;
  bookingType?: unknown;
  title?: unknown;
  provider?: unknown;
  referenceCode?: unknown;
  startAt?: unknown;
  endAt?: unknown;
  checkinAt?: unknown;
  gateAt?: unknown;
  hotelWindowStartAt?: unknown;
  hotelWindowEndAt?: unknown;
  refundDeadlineAt?: unknown;
  notes?: unknown;
};

function isBookingType(value: string): value is BookingType {
  return value === 'flight' || value === 'hotel' || value === 'train' || value === 'activity' || value === 'other';
}

function toSqlDateTimeOrNull(value: unknown) {
  if (typeof value !== 'string' || !value.trim()) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 19).replace('T', ' ');
}

async function addReminderIfDate(params: {
  userId: number;
  tripId: number;
  type: 'countdown' | 'checkin' | 'gate' | 'hotel' | 'refund' | 'custom';
  title: string;
  remindAt: string | null;
}) {
  if (!params.remindAt) return;
  await pool.execute<ResultSetHeader>(
    `INSERT INTO travel_trip_reminders (user_id, trip_id, reminder_type, title, remind_at)
     VALUES (?, ?, ?, ?, ?)`,
    [params.userId, params.tripId, params.type, params.title, params.remindAt],
  );
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

    const [rows] = await pool.execute<BookingRow[]>(
      `SELECT
         id, trip_id, booking_type, title, provider, reference_code, start_at, end_at, checkin_at, gate_at,
         hotel_window_start_at, hotel_window_end_at, refund_deadline_at, notes
       FROM travel_trip_bookings
       WHERE user_id = ? AND trip_id = ?
       ORDER BY COALESCE(start_at, created_at) ASC, id ASC`,
      [userId, tripId],
    );

    return NextResponse.json(
      rows.map((row) => ({
        id: String(row.id),
        tripId: String(row.trip_id),
        bookingType: row.booking_type,
        title: row.title,
        provider: row.provider ?? '',
        referenceCode: row.reference_code ?? '',
        startAt: row.start_at ?? '',
        endAt: row.end_at ?? '',
        checkinAt: row.checkin_at ?? '',
        gateAt: row.gate_at ?? '',
        hotelWindowStartAt: row.hotel_window_start_at ?? '',
        hotelWindowEndAt: row.hotel_window_end_at ?? '',
        refundDeadlineAt: row.refund_deadline_at ?? '',
        notes: row.notes ?? '',
      })),
    );
  } catch {
    return NextResponse.json({ ok: false, message: 'Unable to load bookings.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    await ensureTravelTables();
    const userId = getTravelUserId();
    const body = (await request.json()) as Body;

    const tripId = Number(body.tripId);
    const bookingType = String(body.bookingType ?? 'other').trim();
    const title = String(body.title ?? '').trim();
    const provider = String(body.provider ?? '').trim();
    const referenceCode = String(body.referenceCode ?? '').trim();
    const startAt = toSqlDateTimeOrNull(body.startAt);
    const endAt = toSqlDateTimeOrNull(body.endAt);
    const checkinAt = toSqlDateTimeOrNull(body.checkinAt);
    const gateAt = toSqlDateTimeOrNull(body.gateAt);
    const hotelWindowStartAt = toSqlDateTimeOrNull(body.hotelWindowStartAt);
    const hotelWindowEndAt = toSqlDateTimeOrNull(body.hotelWindowEndAt);
    const refundDeadlineAt = toSqlDateTimeOrNull(body.refundDeadlineAt);
    const notes = String(body.notes ?? '').trim();

    if (!Number.isInteger(tripId) || tripId <= 0) return NextResponse.json({ ok: false, message: 'tripId is required.' }, { status: 400 });
    if (!isBookingType(bookingType)) return NextResponse.json({ ok: false, message: 'bookingType is invalid.' }, { status: 400 });
    if (!title) return NextResponse.json({ ok: false, message: 'title is required.' }, { status: 400 });

    const [result] = await pool.execute<ResultSetHeader>(
      `INSERT INTO travel_trip_bookings
       (user_id, trip_id, booking_type, title, provider, reference_code, start_at, end_at, checkin_at, gate_at, hotel_window_start_at, hotel_window_end_at, refund_deadline_at, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        userId,
        tripId,
        bookingType,
        title,
        provider || null,
        referenceCode || null,
        startAt,
        endAt,
        checkinAt,
        gateAt,
        hotelWindowStartAt,
        hotelWindowEndAt,
        refundDeadlineAt,
        notes || null,
      ],
    );

    await addReminderIfDate({ userId, tripId, type: 'checkin', title: `${title} check-in`, remindAt: checkinAt });
    await addReminderIfDate({ userId, tripId, type: 'gate', title: `${title} gate time`, remindAt: gateAt });
    await addReminderIfDate({ userId, tripId, type: 'hotel', title: `${title} hotel window opens`, remindAt: hotelWindowStartAt });
    await addReminderIfDate({ userId, tripId, type: 'hotel', title: `${title} hotel window closes`, remindAt: hotelWindowEndAt });
    await addReminderIfDate({ userId, tripId, type: 'refund', title: `${title} refund deadline`, remindAt: refundDeadlineAt });

    return NextResponse.json({ ok: true, id: String(result.insertId) });
  } catch {
    return NextResponse.json({ ok: false, message: 'Unable to create booking.' }, { status: 500 });
  }
}
