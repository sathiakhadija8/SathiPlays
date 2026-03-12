import { NextResponse } from 'next/server';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { FormDataRequestError, readMultipartFormData } from '../../../../../../lib/formdata-helpers';

export const dynamic = 'force-dynamic';

function sanitizeExt(filename: string, mimeType: string) {
  const fromName = path.extname(filename).toLowerCase();
  if (fromName && fromName.length <= 6) return fromName;
  if (mimeType === 'image/png') return '.png';
  if (mimeType === 'image/webp') return '.webp';
  if (mimeType === 'image/gif') return '.gif';
  return '.jpg';
}

export async function POST(request: Request) {
  try {
    const formData = await readMultipartFormData(request);
    const file = formData.get('file');

    if (!(file instanceof File) || file.size <= 0) {
      return NextResponse.json({ ok: false, message: 'file is required.' }, { status: 400 });
    }
    if (!file.type.startsWith('image/')) {
      return NextResponse.json({ ok: false, message: 'file must be an image.' }, { status: 400 });
    }

    const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'career', 'daily-practice');
    await mkdir(uploadDir, { recursive: true });

    const ext = sanitizeExt(file.name, file.type);
    const filename = `daily-practice-${Date.now()}-${Math.random().toString(36).slice(2, 10)}${ext}`;
    const fullPath = path.join(uploadDir, filename);
    const bytes = Buffer.from(await file.arrayBuffer());
    await writeFile(fullPath, bytes);

    return NextResponse.json({
      ok: true,
      uploaded_icon_url: `/uploads/career/daily-practice/${filename}`,
    });
  } catch (error) {
    if (error instanceof FormDataRequestError) {
      return NextResponse.json({ ok: false, message: error.message }, { status: 400 });
    }
    return NextResponse.json({ ok: false, message: 'Unable to upload image.' }, { status: 500 });
  }
}
