import { NextResponse } from 'next/server';
import { type ResultSetHeader } from 'mysql2';
import pool from '../../../../../lib/db';
import { ensureTravelTables, getTravelUserId } from '../../../../../lib/travel-server';

type BookingType = 'flight' | 'hotel' | 'train' | 'activity' | 'other';

type Body = {
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

export async function PATCH(request: Request, context: { params: { id: string } }) {
  try {
    await ensureTravelTables();
    const userId = getTravelUserId();
    const id = Number(context.params.id);
    if (!Number.isInteger(id) || id <= 0) return NextResponse.json({ ok: false, message: 'Invalid id.' }, { status: 400 });

    const body = (await request.json()) as Body;
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

    if (!isBookingType(bookingType)) return NextResponse.json({ ok: false, message: 'bookingType is invalid.' }, { status: 400 });
    if (!title) return NextResponse.json({ ok: false, message: 'title is required.' }, { status: 400 });

    const [result] = await pool.execute<ResultSetHeader>(
      `UPDATE travel_trip_bookings
       SET booking_type = ?, title = ?, provider = ?, reference_code = ?, start_at = ?, end_at = ?, checkin_at = ?, gate_at = ?, hotel_window_start_at = ?, hotel_window_end_at = ?, refund_deadline_at = ?, notes = ?
       WHERE id = ? AND user_id = ?`,
      [
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
        id,
        userId,
      ],
    );
    if (!result.affectedRows) return NextResponse.json({ ok: false, message: 'Booking not found.' }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false, message: 'Unable to update booking.' }, { status: 500 });
  }
}

export async function DELETE(_: Request, context: { params: { id: string } }) {
  try {
    await ensureTravelTables();
    const userId = getTravelUserId();
    const id = Number(context.params.id);
    if (!Number.isInteger(id) || id <= 0) return NextResponse.json({ ok: false, message: 'Invalid id.' }, { status: 400 });

    const [result] = await pool.execute<ResultSetHeader>(
      `DELETE FROM travel_trip_bookings WHERE id = ? AND user_id = ?`,
      [id, userId],
    );
    if (!result.affectedRows) return NextResponse.json({ ok: false, message: 'Booking not found.' }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false, message: 'Unable to delete booking.' }, { status: 500 });
  }
}
