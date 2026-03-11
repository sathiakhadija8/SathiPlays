import { NextResponse } from 'next/server';
import { type ResultSetHeader } from 'mysql2';
import pool from '../../../../../lib/db';
import { isClosetState } from '../../../../../lib/home-closet';

type Body = {
  name?: unknown;
  size?: unknown;
  category?: unknown;
  image_path?: unknown;
  state?: unknown;
};

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Body;
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    const size = typeof body.size === 'string' ? body.size.trim() : null;
    const category = typeof body.category === 'string' ? body.category.trim() : null;
    const imagePath = typeof body.image_path === 'string' ? body.image_path.trim() : null;
    const state = isClosetState(body.state) ? body.state : 'in_closet';

    if (!name || name.length > 160) {
      return NextResponse.json({ ok: false, message: 'name is required (<=160).' }, { status: 400 });
    }

    const [result] = await pool.execute<ResultSetHeader>(
      `INSERT INTO closet_items (name, size, category, image_path, state)
       VALUES (?, ?, ?, ?, ?)`,
      [name, size || null, category || null, imagePath || null, state],
    );

    return NextResponse.json({ ok: true, insertedId: result.insertId });
  } catch {
    return NextResponse.json({ ok: false, message: 'Unable to add closet item.' }, { status: 500 });
  }
}
