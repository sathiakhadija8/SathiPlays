import { NextResponse } from 'next/server';
import { type ResultSetHeader } from 'mysql2';
import pool from '../../../../lib/db';
import { ensureCafeTables, getCafeUserId } from '../../../../lib/cafe-server';

type Body = {
  name?: unknown;
  location?: unknown;
  date?: unknown;
  rating?: unknown;
  note?: unknown;
  images?: unknown;
  tag?: unknown;
};

export async function POST(request: Request) {
  try {
    await ensureCafeTables();
    const userId = getCafeUserId();
    const body = (await request.json()) as Body;

    const name = String(body.name ?? '').trim();
    const location = String(body.location ?? '').trim();
    const date = String(body.date ?? '').trim();
    const rating = Number(body.rating ?? 0);
    const note = String(body.note ?? '').trim();
    const tag = String(body.tag ?? 'Cafe').trim() || 'Cafe';
    const images = Array.isArray(body.images) ? body.images.filter((v): v is string => typeof v === 'string') : [];

    if (!name) return NextResponse.json({ ok: false, message: 'name is required.' }, { status: 400 });
    if (!location) return NextResponse.json({ ok: false, message: 'location is required.' }, { status: 400 });
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return NextResponse.json({ ok: false, message: 'date is required.' }, { status: 400 });
    if (!Number.isFinite(rating) || rating < 1 || rating > 5) {
      return NextResponse.json({ ok: false, message: 'rating must be 1-5.' }, { status: 400 });
    }
    if (images.length === 0) {
      return NextResponse.json({ ok: false, message: 'At least one image is required.' }, { status: 400 });
    }

    const [result] = await pool.execute<ResultSetHeader>(
      `INSERT INTO cafe_places (user_id, name, location, visited_date, rating, note, images_json, tag)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [userId, name, location, date, rating, note || null, JSON.stringify(images), tag],
    );

    return NextResponse.json({ ok: true, id: String(result.insertId) });
  } catch {
    return NextResponse.json({ ok: false, message: 'Unable to create place.' }, { status: 500 });
  }
}

