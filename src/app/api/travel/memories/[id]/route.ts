import { NextResponse } from 'next/server';
import { type ResultSetHeader } from 'mysql2';
import pool from '../../../../../lib/db';
import { ensureTravelTables, getTravelUserId } from '../../../../../lib/travel-server';

type Body = {
  memoryDate?: unknown;
  title?: unknown;
  notes?: unknown;
  rating?: unknown;
  photos?: unknown;
};

function parseRating(value: unknown) {
  if (value === null || value === undefined || value === '') return null;
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

export async function PATCH(request: Request, context: { params: { id: string } }) {
  try {
    await ensureTravelTables();
    const userId = getTravelUserId();
    const id = Number(context.params.id);
    if (!Number.isInteger(id) || id <= 0) return NextResponse.json({ ok: false, message: 'Invalid id.' }, { status: 400 });

    const body = (await request.json()) as Body;
    const title = String(body.title ?? '').trim();
    const notes = String(body.notes ?? '').trim();
    const rating = parseRating(body.rating);
    const memoryDate = parseDateOrNull(body.memoryDate);
    const photos = Array.isArray(body.photos) ? body.photos.filter((v): v is string => typeof v === 'string') : [];
    if (!title) return NextResponse.json({ ok: false, message: 'title is required.' }, { status: 400 });

    const [result] = await pool.execute<ResultSetHeader>(
      `UPDATE travel_trip_memories
       SET memory_date = ?, title = ?, notes = ?, rating = ?, photos_json = ?
       WHERE id = ? AND user_id = ?`,
      [memoryDate, title, notes || null, rating, JSON.stringify(photos), id, userId],
    );
    if (!result.affectedRows) return NextResponse.json({ ok: false, message: 'Memory not found.' }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false, message: 'Unable to update memory.' }, { status: 500 });
  }
}

export async function DELETE(_: Request, context: { params: { id: string } }) {
  try {
    await ensureTravelTables();
    const userId = getTravelUserId();
    const id = Number(context.params.id);
    if (!Number.isInteger(id) || id <= 0) return NextResponse.json({ ok: false, message: 'Invalid id.' }, { status: 400 });

    const [result] = await pool.execute<ResultSetHeader>(
      `DELETE FROM travel_trip_memories WHERE id = ? AND user_id = ?`,
      [id, userId],
    );
    if (!result.affectedRows) return NextResponse.json({ ok: false, message: 'Memory not found.' }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false, message: 'Unable to delete memory.' }, { status: 500 });
  }
}
