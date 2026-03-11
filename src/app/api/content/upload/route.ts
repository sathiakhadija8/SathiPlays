import { randomUUID } from 'crypto';
import { mkdir, writeFile } from 'fs/promises';
import path from 'path';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const ALLOWED_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/jpg']);

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file');

    if (!(file instanceof File)) {
      return NextResponse.json({ ok: false, message: 'file is required.' }, { status: 400 });
    }
    if (file.size > 8 * 1024 * 1024) {
      return NextResponse.json({ ok: false, message: 'Image must be <= 8MB.' }, { status: 400 });
    }
    if (file.type && !ALLOWED_TYPES.has(file.type)) {
      return NextResponse.json({ ok: false, message: 'Only PNG, JPG, JPEG, WEBP are allowed.' }, { status: 400 });
    }

    const ext = path.extname(file.name) || '.png';
    const uniqueName = `${Date.now()}-${randomUUID()}${ext}`;
    const uploadsDir = path.join(process.cwd(), 'public', 'uploads', 'content', 'thumbnails');
    await mkdir(uploadsDir, { recursive: true });

    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(path.join(uploadsDir, uniqueName), buffer);

    return NextResponse.json({ ok: true, image_path: `/uploads/content/thumbnails/${uniqueName}` });
  } catch {
    return NextResponse.json({ ok: false, message: 'Unable to upload thumbnail.' }, { status: 500 });
  }
}
