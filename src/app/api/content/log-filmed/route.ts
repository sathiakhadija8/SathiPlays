import { NextResponse } from 'next/server';
import { type ResultSetHeader, type RowDataPacket } from 'mysql2';
import pool from '../../../../lib/db';
import { addPointsSafe } from '../../../../lib/points-helpers';

export const dynamic = 'force-dynamic';

type Body = {
  brand_id?: unknown;
  title?: unknown;
  platform?: unknown;
  category?: unknown;
  description?: unknown;
  script_id?: unknown;
  thumbnail_path?: unknown;
  monetized?: unknown;
};

const VALID_PLATFORMS = new Set(['tiktok', 'instagram', 'youtube', 'pinterest', 'facebook']);

type ExistsRow = RowDataPacket & {
  id: number;
};

function parseOptionalString(value: unknown, max = 500) {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, max) : null;
}

function parseOptionalInt(value: unknown) {
  if (value === undefined || value === null || value === '') return null;
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : null;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Body;

    const brandId = Number(body.brand_id);
    const title = parseOptionalString(body.title, 200);
    const platform = typeof body.platform === 'string' ? body.platform.trim().toLowerCase() : '';
    const category = parseOptionalString(body.category, 120);
    const description = parseOptionalString(body.description, 3000);
    const scriptId = parseOptionalInt(body.script_id);
    const thumbnailPath = parseOptionalString(body.thumbnail_path, 400);
    const monetized = body.monetized ? 1 : 0;

    if (!Number.isInteger(brandId) || brandId <= 0) {
      return NextResponse.json({ ok: false, message: 'brand_id is required.' }, { status: 400 });
    }

    if (!title) {
      return NextResponse.json({ ok: false, message: 'title is required.' }, { status: 400 });
    }

    if (!VALID_PLATFORMS.has(platform)) {
      return NextResponse.json({ ok: false, message: 'platform is invalid.' }, { status: 400 });
    }

    if (scriptId) {
      const [scriptRows] = await pool.execute<ExistsRow[]>(
        `SELECT id FROM scripts WHERE id = ? AND brand_id = ? LIMIT 1`,
        [scriptId, brandId],
      );
      if (scriptRows.length === 0) {
        return NextResponse.json({ ok: false, message: 'script_id is invalid for this brand.' }, { status: 400 });
      }
    }

    const [result] = await pool.execute<ResultSetHeader>(
      `
      INSERT INTO content_items (
        brand_id, title, platform, category, description, status,
        script_id, monetized, thumbnail_path, filmed_at
      )
      VALUES (?, ?, ?, ?, ?, 'filmed', ?, ?, ?, NOW())
      `,
      [brandId, title, platform, category, description, scriptId, monetized, thumbnailPath],
    );

    await addPointsSafe({
      domain: 'content',
      sourceType: 'content_filmed',
      sourceId: result.insertId || null,
      points: 18,
      reason: 'Content moved to filmed',
    });

    return NextResponse.json({ ok: true, insertedId: result.insertId, points_awarded: 18 });
  } catch {
    return NextResponse.json({ ok: false, message: 'Unable to log filmed content.' }, { status: 500 });
  }
}
