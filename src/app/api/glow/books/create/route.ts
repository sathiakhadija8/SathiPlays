import { randomUUID } from 'crypto';
import { mkdir, writeFile } from 'fs/promises';
import path from 'path';
import { NextResponse } from 'next/server';
import { type ResultSetHeader } from 'mysql2';
import pool from '../../../../../lib/db';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const ALLOWED_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/jpg']);

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const titleRaw = formData.get('title');
    const file = formData.get('icon');

    const title = typeof titleRaw === 'string' ? titleRaw.trim() : '';
    if (!title || title.length > 160) {
      return NextResponse.json({ ok: false, message: 'title is required (<=160).' }, { status: 400 });
    }
    if (!(file instanceof File)) {
      return NextResponse.json({ ok: false, message: 'Book icon image is required.' }, { status: 400 });
    }
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
    const iconPath = `/uploads/glow/books/${uniqueName}`;

    const [result] = await pool.execute<ResultSetHeader>(
      `INSERT INTO books (title, icon_path) VALUES (?, ?)`,
      [title, iconPath],
    );

    return NextResponse.json({ ok: true, insertedId: result.insertId, icon_path: iconPath });
  } catch {
    return NextResponse.json({ ok: false, message: 'Unable to create book.' }, { status: 500 });
  }
}
