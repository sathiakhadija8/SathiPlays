import { NextResponse } from 'next/server';
import { type ResultSetHeader, type RowDataPacket } from 'mysql2';
import pool from '../../../../../../lib/db';
import { ensureTravelTables, getTravelUserId } from '../../../../../../lib/travel-server';
import { persistTravelImage, TravelImagePersistError } from '../../../../../../lib/travel-image-storage';

export const runtime = 'nodejs';

type DreamRow = RowDataPacket & {
  id: number;
  city: string;
  country: string;
  image: string;
  budget_estimate: number;
  why_text: string | null;
};

function londonTodayYmd() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/London',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const year = parts.find((part) => part.type === 'year')?.value ?? '1970';
  const month = parts.find((part) => part.type === 'month')?.value ?? '01';
  const day = parts.find((part) => part.type === 'day')?.value ?? '01';
  return `${year}-${month}-${day}`;
}

export async function POST(_: Request, context: { params: { id: string } }) {
  const connection = await pool.getConnection();
  try {
    await ensureTravelTables();
    const userId = getTravelUserId();
    const dreamId = Number(context.params.id);
    if (!Number.isInteger(dreamId) || dreamId <= 0) {
      return NextResponse.json({ ok: false, message: 'Invalid id.' }, { status: 400 });
    }

    await connection.beginTransaction();

    const [rows] = await connection.execute<DreamRow[]>(
      `SELECT id, city, country, image, budget_estimate, why_text
       FROM travel_dreams
       WHERE id = ? AND user_id = ?
       LIMIT 1`,
      [dreamId, userId],
    );

    const dream = rows[0];
    if (!dream) {
      await connection.rollback();
      return NextResponse.json({ ok: false, message: 'Destination not found.' }, { status: 404 });
    }

    const today = londonTodayYmd();
    const coverImage = await persistTravelImage(dream.image, 'trips');
    const [tripResult] = await connection.execute<ResultSetHeader>(
      `INSERT INTO travel_trips
       (user_id, city, country, start_date, end_date, status, cover_image, planned_budget, spent_budget, reflection, gallery_json, places_json)
       VALUES (?, ?, ?, ?, ?, 'upcoming', ?, ?, 0, ?, '[]', '[]')`,
      [userId, dream.city, dream.country, today, today, coverImage, Number(dream.budget_estimate ?? 0), dream.why_text ?? null],
    );

    await connection.execute<ResultSetHeader>(
      `DELETE FROM travel_dreams WHERE id = ? AND user_id = ?`,
      [dreamId, userId],
    );

    await connection.commit();
    return NextResponse.json({ ok: true, tripId: String(tripResult.insertId) });
  } catch (error) {
    if (error instanceof TravelImagePersistError) {
      await connection.rollback();
      return NextResponse.json({ ok: false, message: error.message }, { status: 400 });
    }
    await connection.rollback();
    return NextResponse.json({ ok: false, message: 'Unable to move destination to trips.' }, { status: 500 });
  } finally {
    connection.release();
  }
}
