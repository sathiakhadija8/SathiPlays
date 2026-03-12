import { NextResponse } from 'next/server';
import { type ResultSetHeader, type RowDataPacket } from 'mysql2';
import pool from '../../../../lib/db';
import { ensureTravelTables, getTravelUserId, parseStringArray } from '../../../../lib/travel-server';

type MemoryRow = RowDataPacket & {
  id: number;
  trip_id: number;
  memory_date: string | null;
  title: string;
  notes: string | null;
  rating: number | null;
  photos_json: string;
};

type Body = {
  tripId?: unknown;
  memoryDate?: unknown;
  title?: unknown;
  notes?: unknown;
  rating?: unknown;
  photos?: unknown;
};

function parseRating(value: unknown) {
  const n = Number(value);
  if (!Number.isInteger(n)) return null;
  if (n < 1 || n > 5) return null;
  return n;
}

function parseDateOrNull(value: unknown) {
  if (typeof value !== 'string' || !value.trim()) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
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

    const [rows] = await pool.execute<MemoryRow[]>(
      `SELECT id, trip_id, memory_date, title, notes, rating, photos_json
       FROM travel_trip_memories
       WHERE user_id = ? AND trip_id = ?
       ORDER BY COALESCE(memory_date, DATE(created_at)) DESC, id DESC`,
      [userId, tripId],
    );
    return NextResponse.json(
      rows.map((row) => ({
        id: String(row.id),
        tripId: String(row.trip_id),
        memoryDate: row.memory_date ? String(row.memory_date).slice(0, 10) : '',
        title: row.title,
        notes: row.notes ?? '',
        rating: row.rating ?? null,
        photos: parseStringArray(row.photos_json),
      })),
    );
  } catch {
    return NextResponse.json({ ok: false, message: 'Unable to load memories.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    await ensureTravelTables();
    const userId = getTravelUserId();
    const body = (await request.json()) as Body;
    const tripId = Number(body.tripId);
    const title = String(body.title ?? '').trim();
    const notes = String(body.notes ?? '').trim();
    const rating = parseRating(body.rating);
    const memoryDate = parseDateOrNull(body.memoryDate);
    const photos = Array.isArray(body.photos) ? body.photos.filter((v): v is string => typeof v === 'string') : [];

    if (!Number.isInteger(tripId) || tripId <= 0) return NextResponse.json({ ok: false, message: 'tripId is required.' }, { status: 400 });
    if (!title) return NextResponse.json({ ok: false, message: 'title is required.' }, { status: 400 });

    const [result] = await pool.execute<ResultSetHeader>(
      `INSERT INTO travel_trip_memories (user_id, trip_id, memory_date, title, notes, rating, photos_json)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [userId, tripId, memoryDate, title, notes || null, rating, JSON.stringify(photos)],
    );
    return NextResponse.json({ ok: true, id: String(result.insertId) });
  } catch {
    return NextResponse.json({ ok: false, message: 'Unable to add memory.' }, { status: 500 });
  }
}
