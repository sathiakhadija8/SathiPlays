import { randomUUID } from 'crypto';
import { mkdir, writeFile } from 'fs/promises';
import path from 'path';
import { NextResponse } from 'next/server';
import { type ResultSetHeader } from 'mysql2';
import pool from '../../../../../lib/db';
import { addGlowPoints } from '../../../../../lib/glow-helpers';
import { FormDataRequestError, readMultipartFormData } from '../../../../../lib/formdata-helpers';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: Request) {
  let formData: FormData;
  try {
    formData = await readMultipartFormData(request);
  } catch (error) {
    if (error instanceof FormDataRequestError) {
      return NextResponse.json({ ok: false, message: error.message }, { status: 400 });
    }
    return NextResponse.json({ ok: false, message: 'Invalid upload payload.' }, { status: 400 });
  }

  const connection = await pool.getConnection();
  let transactionStarted = false;
  try {
    const file = formData.get('file');
    const routineId = Number(formData.get('routine_id'));
    const bookId = Number(formData.get('book_id'));
    const caption = typeof formData.get('caption') === 'string' ? String(formData.get('caption')).trim() : '';
    const quote = typeof formData.get('quote') === 'string' ? String(formData.get('quote')).trim() : '';

    if (!(file instanceof File)) {
      return NextResponse.json({ ok: false, message: 'file is required.' }, { status: 400 });
    }
    if (!Number.isInteger(routineId) || routineId <= 0) {
      return NextResponse.json({ ok: false, message: 'routine_id is required.' }, { status: 400 });
    }
    if (!Number.isInteger(bookId) || bookId <= 0) {
      return NextResponse.json({ ok: false, message: 'book_id is required.' }, { status: 400 });
    }

    const uploadsDir = path.join(process.cwd(), 'public', 'uploads', 'glow', 'images');
    await mkdir(uploadsDir, { recursive: true });

    const ext = path.extname(file.name) || '.jpg';
    const fileName = `${Date.now()}-${randomUUID()}${ext}`;
    const fullPath = path.join(uploadsDir, fileName);
    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(fullPath, buffer);
    const publicPath = `/uploads/glow/images/${fileName}`;

    await connection.beginTransaction();
    transactionStarted = true;

    const [insertResult] = await connection.execute<ResultSetHeader>(
      `INSERT INTO glow_images (routine_id, book_id, image_path, caption, quote)
       VALUES (?, ?, ?, ?, ?)`,
      [routineId, bookId, publicPath, caption || null, quote || null],
    );

    await addGlowPoints(connection, 'glow_image', insertResult.insertId, 10, 'Glow polaroid uploaded');

    await connection.commit();

    return NextResponse.json({ ok: true, insertedId: insertResult.insertId, image_path: publicPath, points_awarded: 10 });
  } catch (error) {
    if (transactionStarted) {
      await connection.rollback();
    }
    if (error instanceof FormDataRequestError) {
      return NextResponse.json({ ok: false, message: error.message }, { status: 400 });
    }
    return NextResponse.json({ ok: false, message: 'Unable to upload glow image.' }, { status: 500 });
  } finally {
    connection.release();
  }
}
