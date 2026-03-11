import { NextResponse } from 'next/server';
import { type ResultSetHeader } from 'mysql2';
import pool from '../../../../lib/db';
import { ensureCafeTables, getCafeUserId } from '../../../../lib/cafe-server';

type Body = {
  label?: unknown;
  title?: unknown;
  date?: unknown;
  a4_template_src?: unknown;
  elements?: unknown;
  cover_preview_image?: unknown;
};

export async function POST(request: Request) {
  try {
    await ensureCafeTables();
    const userId = getCafeUserId();
    const body = (await request.json()) as Body;

    const label = String(body.label ?? '').trim();
    const title = String(body.title ?? '').trim();
    const date = String(body.date ?? '').trim();
    const a4TemplateSrc = String(body.a4_template_src ?? '').trim();
    const coverPreviewImage = String(body.cover_preview_image ?? '').trim();
    const elements = Array.isArray(body.elements) ? body.elements : [];

    if (!label) return NextResponse.json({ ok: false, message: 'label is required.' }, { status: 400 });
    if (!title) return NextResponse.json({ ok: false, message: 'title is required.' }, { status: 400 });
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return NextResponse.json({ ok: false, message: 'date is required.' }, { status: 400 });
    if (!coverPreviewImage) {
      return NextResponse.json({ ok: false, message: 'cover_preview_image is required.' }, { status: 400 });
    }

    const [result] = await pool.execute<ResultSetHeader>(
      `INSERT INTO cafe_magazines (user_id, label, title, issue_date, a4_template_src, elements_json, cover_preview_image)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [userId, label, title, date, a4TemplateSrc || null, JSON.stringify(elements), coverPreviewImage],
    );

    return NextResponse.json({ ok: true, id: String(result.insertId) });
  } catch {
    return NextResponse.json({ ok: false, message: 'Unable to create magazine.' }, { status: 500 });
  }
}

