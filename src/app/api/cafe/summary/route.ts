import { NextResponse } from 'next/server';
import { type RowDataPacket } from 'mysql2';
import pool from '../../../../lib/db';
import { ensureCafeTables, getCafeUserId, parseJsonArray, parseJsonObject, type CafeBookKey } from '../../../../lib/cafe-server';

export const dynamic = 'force-dynamic';

type MemoryRow = RowDataPacket & {
  id: number;
  book_key: CafeBookKey;
  title: string;
  entry_date: string;
  mood: string;
  note: string | null;
  images_json: string;
  created_at: string;
};

type PlaceRow = RowDataPacket & {
  id: number;
  name: string;
  location: string;
  visited_date: string;
  rating: number;
  note: string | null;
  images_json: string;
  tag: string;
  created_at: string;
};

type MagazineRow = RowDataPacket & {
  id: number;
  label: string;
  title: string;
  issue_date: string;
  a4_template_src: string | null;
  elements_json: string;
  cover_preview_image: string;
  created_at: string;
};

function sanitizeImageUrl(value: string) {
  return value.startsWith('blob:') ? '' : value;
}

function sanitizeImageList(values: string[]) {
  return values.filter((value) => !value.startsWith('blob:'));
}

export async function GET() {
  try {
    await ensureCafeTables();
    const userId = getCafeUserId();

    const [memoryRows] = await pool.execute<MemoryRow[]>(
      `SELECT id, book_key, title, entry_date, mood, note, images_json, created_at
       FROM cafe_memory_entries
       WHERE user_id = ?
       ORDER BY entry_date DESC, created_at DESC`,
      [userId],
    );

    const [placeRows] = await pool.execute<PlaceRow[]>(
      `SELECT id, name, location, visited_date, rating, note, images_json, tag, created_at
       FROM cafe_places
       WHERE user_id = ?
       ORDER BY visited_date DESC, created_at DESC`,
      [userId],
    );

    const [magazineRows] = await pool.execute<MagazineRow[]>(
      `SELECT id, label, title, issue_date, a4_template_src, elements_json, cover_preview_image, created_at
       FROM cafe_magazines
       WHERE user_id = ?
       ORDER BY issue_date DESC, created_at DESC`,
      [userId],
    );

    const memoryBooks: Record<CafeBookKey, unknown[]> = {
      friendship: [],
      solo: [],
      pinterest: [],
    };

    for (const row of memoryRows) {
      memoryBooks[row.book_key].push({
        id: String(row.id),
        title: row.title,
        date: row.entry_date,
        mood: row.mood,
        note: row.note ?? '',
        images: sanitizeImageList(parseJsonArray(row.images_json)),
      });
    }

    const places = placeRows.map((row) => ({
      id: String(row.id),
      name: row.name,
      location: row.location,
      date: row.visited_date,
      rating: Number(row.rating ?? 0),
      note: row.note ?? '',
      images: sanitizeImageList(parseJsonArray(row.images_json)),
      tag: row.tag,
    }));

    const magazineEntries = magazineRows.map((row) => ({
      id: String(row.id),
      label: row.label,
      title: row.title,
      date: row.issue_date,
      a4_template_src: row.a4_template_src ? sanitizeImageUrl(row.a4_template_src) || undefined : undefined,
      elements: parseJsonObject(row.elements_json, [] as unknown[]),
      cover_preview_image: sanitizeImageUrl(row.cover_preview_image),
    }));

    return NextResponse.json({
      memoryBooks,
      places,
      magazineEntries,
    });
  } catch {
    return NextResponse.json({ ok: false, message: 'Unable to load cafe data.' }, { status: 500 });
  }
}
