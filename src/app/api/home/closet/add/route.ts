import { NextResponse } from 'next/server';
import { type ResultSetHeader } from 'mysql2';
import pool from '../../../../../lib/db';
import { isClosetState } from '../../../../../lib/home-closet';

type Body = {
  name?: unknown;
  size?: unknown;
  category?: unknown;
  subcategory?: unknown;
  color?: unknown;
  brand?: unknown;
  season?: unknown;
  occasion?: unknown;
  image_path?: unknown;
  notes?: unknown;
  state?: unknown;
};

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Body;
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    const size = typeof body.size === 'string' ? body.size.trim() : null;
    const category = typeof body.category === 'string' ? body.category.trim() : null;
    const subcategory = typeof body.subcategory === 'string' ? body.subcategory.trim() : null;
    const color = typeof body.color === 'string' ? body.color.trim() : null;
    const brand = typeof body.brand === 'string' ? body.brand.trim() : null;
    const season = typeof body.season === 'string' ? body.season.trim() : null;
    const occasion = typeof body.occasion === 'string' ? body.occasion.trim() : null;
    const imagePath = typeof body.image_path === 'string' ? body.image_path.trim() : null;
    const notes = typeof body.notes === 'string' ? body.notes.trim() : null;
    const state = isClosetState(body.state) ? body.state : 'in_closet';

    if (!name || name.length > 160) {
      return NextResponse.json({ ok: false, message: 'name is required (<=160).' }, { status: 400 });
    }

    const [result] = await pool.execute<ResultSetHeader>(
      `INSERT INTO closet_items (name, category, subcategory, size, color, brand, season, occasion, image_path, notes, state)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        name,
        category || null,
        subcategory || null,
        size || null,
        color || null,
        brand || null,
        season || null,
        occasion || null,
        imagePath || null,
        notes || null,
        state,
      ],
    );

    return NextResponse.json({ ok: true, insertedId: result.insertId });
  } catch {
    return NextResponse.json({ ok: false, message: 'Unable to add closet item.' }, { status: 500 });
  }
}
