import { NextResponse } from 'next/server';
import { type RowDataPacket } from 'mysql2';
import pool from '../../../../lib/db';

export const dynamic = 'force-dynamic';

type CvRow = RowDataPacket & {
  id: number;
  display_name: string;
  tag: string | null;
  file_name: string;
  file_path: string;
  mime_type: string | null;
  size_bytes: number | null;
  created_at: string;
};

export async function GET() {
  try {
    const [rows] = await pool.execute<CvRow[]>(
      `SELECT id, display_name, tag, file_name, file_path, mime_type, size_bytes, created_at
       FROM cv_files
       ORDER BY created_at DESC`,
    );
    return NextResponse.json(rows);
  } catch {
    return NextResponse.json({ ok: false, message: 'Unable to load CV files.' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = Number(searchParams.get('id'));
    if (!Number.isInteger(id) || id <= 0) {
      return NextResponse.json({ ok: false, message: 'id is required.' }, { status: 400 });
    }

    await pool.execute(`DELETE FROM cv_files WHERE id = ?`, [id]);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false, message: 'Unable to delete CV file.' }, { status: 500 });
  }
}
