import { randomUUID } from 'crypto';
import { mkdir, writeFile } from 'fs/promises';
import path from 'path';
import { NextResponse } from 'next/server';
import { FormDataRequestError, readMultipartFormData } from '../../../../../lib/formdata-helpers';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const ALLOWED_TYPES = new Set(['image/png', 'image/jpeg', 'image/jpg', 'image/webp']);

export async function POST(request: Request) {
  try {
    const formData = await readMultipartFormData(request);
    const file = formData.get('file');

    if (!(file instanceof File)) {
      return NextResponse.json({ ok: false, message: 'file is required.' }, { status: 400 });
    }
    if (file.size > 8 * 1024 * 1024) {
      return NextResponse.json({ ok: false, message: 'Image must be <= 8MB.' }, { status: 400 });
    }
    if (file.type && !ALLOWED_TYPES.has(file.type)) {
      return NextResponse.json({ ok: false, message: 'Unsupported image format.' }, { status: 400 });
    }

    const ext = path.extname(file.name) || '.png';
    const fileName = `${Date.now()}-${randomUUID()}${ext}`;
    const uploadsDir = path.join(process.cwd(), 'public', 'uploads', 'vinted', 'items');
    await mkdir(uploadsDir, { recursive: true });

    const filePath = path.join(uploadsDir, fileName);
    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(filePath, buffer);

    return NextResponse.json({ ok: true, image_path: `/uploads/vinted/items/${fileName}` });
  } catch (error) {
    if (error instanceof FormDataRequestError) {
      return NextResponse.json({ ok: false, message: error.message }, { status: 400 });
    }
    return NextResponse.json({ ok: false, message: 'Unable to upload item image.' }, { status: 500 });
  }
}
