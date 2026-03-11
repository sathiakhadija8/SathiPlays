import { NextResponse } from 'next/server';
import { type ResultSetHeader, type RowDataPacket } from 'mysql2';
import pool from '../../../../../../lib/db';

export const dynamic = 'force-dynamic';

type ScriptRow = RowDataPacket & {
  id: number;
  brand_id: number;
  title: string;
  platform: 'tiktok' | 'instagram' | 'youtube' | 'pinterest' | 'facebook';
  category: string | null;
  monetized: number;
  hook_lines: string | string[];
  body: string;
};

type ExistingContentRow = RowDataPacket & {
  id: number;
};

function deserializeHookLines(value: string | string[]) {
  if (Array.isArray(value)) return value;
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    const scriptId = Number(params.id);
    if (!Number.isInteger(scriptId) || scriptId <= 0) {
      return NextResponse.json({ ok: false, message: 'Invalid script id.' }, { status: 400 });
    }
    const body = (await request.json().catch(() => ({}))) as { brand_id?: unknown };
    const brandId = Number(body.brand_id);
    if (!Number.isInteger(brandId) || brandId <= 0) {
      return NextResponse.json({ ok: false, message: 'brand_id is required.' }, { status: 400 });
    }

    const [scriptRows] = await pool.execute<ScriptRow[]>(
      `
      SELECT id, brand_id, title, platform, category, monetized, hook_lines, body
      FROM scripts
      WHERE id = ?
      LIMIT 1
      `,
      [scriptId],
    );

    const script = scriptRows[0];
    if (!script) {
      return NextResponse.json({ ok: false, message: 'Script not found.' }, { status: 404 });
    }
    if (script.brand_id !== brandId) {
      return NextResponse.json({ ok: false, message: 'Script brand mismatch.' }, { status: 403 });
    }

    const hookLines = deserializeHookLines(script.hook_lines);
    const hook = hookLines.filter((line) => typeof line === 'string' && line.trim()).join(' | ').slice(0, 255) || null;

    const [existingRows] = await pool.execute<ExistingContentRow[]>(
      `SELECT id FROM content_items WHERE script_id = ? LIMIT 1`,
      [scriptId],
    );

    const existing = existingRows[0];

    if (existing) {
      await pool.execute<ResultSetHeader>(
        `
        UPDATE content_items
        SET
          title = ?,
          platform = ?,
          category = ?,
          hook = ?,
          description = ?,
          monetized = ?,
          status = 'scripted'
        WHERE id = ?
        `,
        [script.title, script.platform, script.category, hook, script.body, script.monetized ? 1 : 0, existing.id],
      );

      return NextResponse.json({ ok: true, content_item_id: existing.id, mode: 'updated' });
    }

    const [insertResult] = await pool.execute<ResultSetHeader>(
      `
      INSERT INTO content_items (
        brand_id, title, platform, category, hook, description, status, script_id, monetized
      )
      VALUES (?, ?, ?, ?, ?, ?, 'scripted', ?, ?)
      `,
      [script.brand_id, script.title, script.platform, script.category, hook, script.body, script.id, script.monetized ? 1 : 0],
    );

    return NextResponse.json({ ok: true, content_item_id: insertResult.insertId, mode: 'created' });
  } catch {
    return NextResponse.json({ ok: false, message: 'Unable to convert script.' }, { status: 500 });
  }
}
