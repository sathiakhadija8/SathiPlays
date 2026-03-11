import { randomUUID } from 'crypto';
import { mkdir, writeFile } from 'fs/promises';
import path from 'path';
import { NextResponse } from 'next/server';
import { type ResultSetHeader, type RowDataPacket } from 'mysql2';
import pool from '../../../../../lib/db';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const ALLOWED_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/jpg']);

type BookRow = RowDataPacket & {
  id: number;
  icon_path: string;
};

export async function PATCH(request: Request, context: { params: { id: string } }) {
  try {
    const id = Number(context.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return NextResponse.json({ ok: false, message: 'id is invalid.' }, { status: 400 });
    }

    const formData = await request.formData();
    const titleRaw = formData.get('title');
    const file = formData.get('icon');
    const title = typeof titleRaw === 'string' ? titleRaw.trim() : '';

    if (!title || title.length > 160) {
      return NextResponse.json({ ok: false, message: 'title is required (<=160).' }, { status: 400 });
    }

    let iconPath: string | null = null;
    if (file instanceof File && file.size > 0) {
      if (file.size > 5 * 1024 * 1024) {
        return NextResponse.json({ ok: false, message: 'Book icon must be <= 5MB.' }, { status: 400 });
      }
      if (file.type && !ALLOWED_TYPES.has(file.type)) {
        return NextResponse.json({ ok: false, message: 'Only PNG, JPG, JPEG, WEBP are allowed.' }, { status: 400 });
      }

      const ext = path.extname(file.name) || '.png';
      const uniqueName = `${Date.now()}-${randomUUID()}${ext}`;
      const uploadsDir = path.join(process.cwd(), 'public', 'uploads', 'glow', 'books');
      await mkdir(uploadsDir, { recursive: true });
      const buffer = Buffer.from(await file.arrayBuffer());
      await writeFile(path.join(uploadsDir, uniqueName), buffer);
      iconPath = `/uploads/glow/books/${uniqueName}`;
    }

    await pool.execute(
      `UPDATE books
       SET title = ?, icon_path = COALESCE(?, icon_path)
       WHERE id = ?`,
      [title, iconPath, id],
    );

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false, message: 'Unable to update book.' }, { status: 500 });
  }
}

export async function DELETE(_: Request, context: { params: { id: string } }) {
  const connection = await pool.getConnection();
  try {
    const id = Number(context.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return NextResponse.json({ ok: false, message: 'id is invalid.' }, { status: 400 });
    }

    await connection.beginTransaction();
    const [bookRows] = await connection.execute<BookRow[]>(
      `SELECT id, icon_path FROM books WHERE id = ? LIMIT 1`,
      [id],
    );
    if (bookRows.length === 0) {
      await connection.rollback();
      return NextResponse.json({ ok: false, message: 'Book not found.' }, { status: 404 });
    }

    await connection.execute<ResultSetHeader>(`DELETE FROM books WHERE id = ?`, [id]);
    await connection.commit();
    return NextResponse.json({ ok: true });
  } catch {
    await connection.rollback();
    return NextResponse.json({ ok: false, message: 'Unable to delete book.' }, { status: 500 });
  } finally {
    connection.release();
  }
}
