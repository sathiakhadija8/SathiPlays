import { NextResponse } from 'next/server';
import { type ResultSetHeader } from 'mysql2';
import pool from '../../../../lib/db';
import { ensureCafeTables, getCafeUserId, type CafeBookKey } from '../../../../lib/cafe-server';

type Body = {
  book_key?: unknown;
  title?: unknown;
  date?: unknown;
  mood?: unknown;
  note?: unknown;
  images?: unknown;
};

function isBookKey(input: string): input is CafeBookKey {
  return input === 'friendship' || input === 'solo' || input === 'pinterest';
}

export async function POST(request: Request) {
  try {
    await ensureCafeTables();
    const userId = getCafeUserId();
    const body = (await request.json()) as Body;

    const bookKey = String(body.book_key ?? '').trim();
    const title = String(body.title ?? '').trim();
    const date = String(body.date ?? '').trim();
    const mood = String(body.mood ?? '').trim();
    const note = String(body.note ?? '').trim();
    const images = Array.isArray(body.images) ? body.images.filter((v): v is string => typeof v === 'string') : [];

    if (!isBookKey(bookKey)) {
      return NextResponse.json({ ok: false, message: 'book_key is invalid.' }, { status: 400 });
    }
    if (!title) return NextResponse.json({ ok: false, message: 'title is required.' }, { status: 400 });
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return NextResponse.json({ ok: false, message: 'date is required.' }, { status: 400 });
    if (!mood) return NextResponse.json({ ok: false, message: 'mood is required.' }, { status: 400 });
    if (images.length === 0) {
      return NextResponse.json({ ok: false, message: 'At least one image is required.' }, { status: 400 });
    }

    const [result] = await pool.execute<ResultSetHeader>(
      `INSERT INTO cafe_memory_entries (user_id, book_key, title, entry_date, mood, note, images_json)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [userId, bookKey, title, date, mood, note || null, JSON.stringify(images)],
    );

    return NextResponse.json({ ok: true, id: String(result.insertId) });
  } catch {
    return NextResponse.json({ ok: false, message: 'Unable to create memory.' }, { status: 500 });
  }
}

