import { NextResponse } from 'next/server';
import { type ResultSetHeader, type RowDataPacket } from 'mysql2';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import pool from '../../../../lib/db';
import { ensureSubjectsCoverColumn } from '../../../../lib/career-schema';

export const dynamic = 'force-dynamic';

type SubjectRow = RowDataPacket & {
  id: number;
  name: string;
  color: string;
  icon_key: string;
  cover_image_path: string | null;
  created_at: string;
};

type Body = {
  name?: unknown;
  color?: unknown;
  icon_key?: unknown;
  cover_image_path?: unknown;
};

function sanitizeExt(filename: string, mimeType: string) {
  const fromName = path.extname(filename).toLowerCase();
  if (fromName && fromName.length <= 6) return fromName;
  if (mimeType === 'image/png') return '.png';
  if (mimeType === 'image/webp') return '.webp';
  if (mimeType === 'image/gif') return '.gif';
  return '.jpg';
}

export async function GET() {
  try {
    await ensureSubjectsCoverColumn();
    const [rows] = await pool.execute<SubjectRow[]>(
      `SELECT
          CAST(legacy_id AS SIGNED) AS id,
          title AS name,
          COALESCE(JSON_UNQUOTE(JSON_EXTRACT(attributes, '$.color')), '#4B5563') AS color,
          COALESCE(JSON_UNQUOTE(JSON_EXTRACT(attributes, '$.icon_key')), '📘') AS icon_key,
          JSON_UNQUOTE(JSON_EXTRACT(attributes, '$.cover_image_path')) AS cover_image_path,
          created_at
       FROM sp_catalog_items
       WHERE domain_key = 'career'
         AND item_type = 'subject'
         AND is_active = 1
         AND legacy_id IS NOT NULL
       ORDER BY created_at DESC`,
    );
    return NextResponse.json(rows);
  } catch {
    return NextResponse.json({ ok: false, message: 'Unable to load subjects.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    await ensureSubjectsCoverColumn();
    const contentType = request.headers.get('content-type') ?? '';

    let name = '';
    let color = '';
    let iconKey = '📘';
    let coverImagePath: string | null = null;

    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      name = String(formData.get('name') ?? '').trim();
      color = String(formData.get('color') ?? '').trim();
      const iconRaw = String(formData.get('icon_key') ?? '').trim();
      if (iconRaw) iconKey = iconRaw;

      const coverFile = formData.get('cover_file');
      if (coverFile instanceof File && coverFile.size > 0) {
        if (!coverFile.type.startsWith('image/')) {
          return NextResponse.json({ ok: false, message: 'cover_file must be an image.' }, { status: 400 });
        }

        const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'career', 'subjects');
        await mkdir(uploadDir, { recursive: true });
        const ext = sanitizeExt(coverFile.name, coverFile.type);
        const filename = `subject-${Date.now()}-${Math.random().toString(36).slice(2, 10)}${ext}`;
        const fullPath = path.join(uploadDir, filename);
        const bytes = Buffer.from(await coverFile.arrayBuffer());
        await writeFile(fullPath, bytes);
        coverImagePath = `/uploads/career/subjects/${filename}`;
      }
    } else {
      const body = (await request.json()) as Body;
      name = typeof body.name === 'string' ? body.name.trim() : '';
      color = typeof body.color === 'string' ? body.color.trim() : '';
      const iconRaw = typeof body.icon_key === 'string' ? body.icon_key.trim() : '';
      if (iconRaw) iconKey = iconRaw;
      const coverRaw = typeof body.cover_image_path === 'string' ? body.cover_image_path.trim() : '';
      coverImagePath = coverRaw || null;
    }

    if (!name || name.length > 120) {
      return NextResponse.json({ ok: false, message: 'name is required (<=120).' }, { status: 400 });
    }
    if (!/^#[0-9A-Fa-f]{6}$/.test(color)) {
      return NextResponse.json({ ok: false, message: 'color must be hex like #FF3EA5.' }, { status: 400 });
    }
    if (!iconKey || iconKey.length > 50) {
      return NextResponse.json({ ok: false, message: 'icon_key must be <=50.' }, { status: 400 });
    }

    const [result] = await pool.execute<ResultSetHeader>(
      `INSERT INTO subjects (name, color, icon_key, cover_image_path) VALUES (?, ?, ?, ?)`,
      [name, color, iconKey, coverImagePath],
    );

    return NextResponse.json({ ok: true, insertedId: result.insertId });
  } catch {
    return NextResponse.json({ ok: false, message: 'Unable to create subject.' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = Number(searchParams.get('id'));
    if (!Number.isInteger(id) || id <= 0) {
      return NextResponse.json({ ok: false, message: 'id is required.' }, { status: 400 });
    }

    await pool.execute(`DELETE FROM subjects WHERE id = ?`, [id]);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false, message: 'Unable to delete subject.' }, { status: 500 });
  }
}
