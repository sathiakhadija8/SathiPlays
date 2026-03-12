import { randomUUID } from 'crypto';
import { mkdir, writeFile } from 'fs/promises';
import path from 'path';
import { NextResponse } from 'next/server';
import { type ResultSetHeader } from 'mysql2';
import pool from '../../../../../lib/db';
import { FormDataRequestError, readMultipartFormData } from '../../../../../lib/formdata-helpers';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    const formData = await readMultipartFormData(request);
    const file = formData.get('file');
    const displayNameRaw = formData.get('display_name');
    const tagRaw = formData.get('tag');

    if (!(file instanceof File)) {
      return NextResponse.json({ ok: false, message: 'file is required.' }, { status: 400 });
    }

    const displayName = typeof displayNameRaw === 'string' && displayNameRaw.trim() ? displayNameRaw.trim() : file.name;
    const tag = typeof tagRaw === 'string' && tagRaw.trim() ? tagRaw.trim().slice(0, 80) : null;

    const ext = path.extname(file.name) || '.bin';
    const uniqueName = `${Date.now()}-${randomUUID()}${ext}`;

    const uploadsDir = path.join(process.cwd(), 'public', 'uploads', 'cv');
    await mkdir(uploadsDir, { recursive: true });

    const filePath = path.join(uploadsDir, uniqueName);
    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(filePath, buffer);

    const publicPath = `/uploads/cv/${uniqueName}`;

    const [result] = await pool.execute<ResultSetHeader>(
      `INSERT INTO cv_files (display_name, tag, file_name, file_path, mime_type, size_bytes)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [displayName.slice(0, 160), tag, file.name.slice(0, 220), publicPath, file.type || null, file.size || null],
    );

    return NextResponse.json({ ok: true, insertedId: result.insertId, file_path: publicPath });
  } catch (error) {
    if (error instanceof FormDataRequestError) {
      return NextResponse.json({ ok: false, message: error.message }, { status: 400 });
    }
    return NextResponse.json({ ok: false, message: 'Unable to upload CV file.' }, { status: 500 });
  }
}
