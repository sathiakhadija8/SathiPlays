import { NextResponse } from 'next/server';
import { type RowDataPacket } from 'mysql2';
import pool from '../../../../lib/db';

export const dynamic = 'force-dynamic';

type BookRow = RowDataPacket & {
  id: number;
  title: string;
  icon_path: string;
  created_at: string;
  image_count: number;
};

export async function GET() {
  try {
    const [rows] = await pool.execute<BookRow[]>(
      `SELECT b.id, b.title, b.icon_path, b.created_at, COUNT(gi.id) AS image_count
       FROM books b
       LEFT JOIN glow_images gi ON gi.book_id = b.id
       GROUP BY b.id, b.title, b.icon_path, b.created_at
       ORDER BY b.created_at DESC`,
    );
    return NextResponse.json(rows);
  } catch {
    return NextResponse.json({ ok: false, message: 'Unable to load books.' }, { status: 500 });
  }
}
