import { NextResponse } from 'next/server';
import { type RowDataPacket } from 'mysql2';
import pool from '../../../../../lib/db';

export const dynamic = 'force-dynamic';

type ImageRow = RowDataPacket & {
  id: number;
  routine_id: number;
  book_id: number | null;
  image_path: string;
  caption: string | null;
  quote: string | null;
  created_at: string;
  routine_name: string;
};

export async function GET(_: Request, context: { params: { id: string } }) {
  try {
    const id = Number(context.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return NextResponse.json({ ok: false, message: 'id is invalid.' }, { status: 400 });
    }

    const [rows] = await pool.execute<ImageRow[]>(
      `SELECT gi.id, gi.routine_id, gi.book_id, gi.image_path, gi.caption, gi.quote, gi.created_at,
              r.name AS routine_name
       FROM glow_images gi
       LEFT JOIN routines r ON r.id = gi.routine_id
       WHERE gi.book_id = ?
       ORDER BY gi.created_at DESC`,
      [id],
    );

    return NextResponse.json(rows);
  } catch {
    return NextResponse.json({ ok: false, message: 'Unable to load book images.' }, { status: 500 });
  }
}
