import { NextResponse } from 'next/server';
import { type ResultSetHeader, type RowDataPacket } from 'mysql2';
import pool from '../../../../lib/db';
import { addPointsSafe } from '../../../../lib/points-helpers';

export const dynamic = 'force-dynamic';

type ContentRow = RowDataPacket & {
  id: number;
  brand_id: number;
  title: string;
  platform: 'tiktok' | 'instagram' | 'youtube' | 'pinterest' | 'facebook';
  category: string | null;
  hook: string | null;
  description: string | null;
  status: 'idea' | 'scripted' | 'filmed' | 'edited' | 'scheduled' | 'posted';
  script_id: number | null;
  affiliate_id: number | null;
  monetized: number;
  thumbnail_path: string | null;
  scheduled_at: string | null;
  created_at: string;
};

type Body = {
  brand_id?: unknown;
  title?: unknown;
  platform?: unknown;
  category?: unknown;
  status?: unknown;
  monetized?: unknown;
};

const VALID_STATUSES = new Set(['idea', 'scripted', 'filmed', 'edited', 'scheduled', 'posted']);
const VALID_PLATFORMS = new Set(['tiktok', 'instagram', 'youtube', 'pinterest', 'facebook']);

function parseOptionalString(value: unknown, max = 255) {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, max) : null;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const brandId = Number(searchParams.get('brand_id'));
    if (!Number.isInteger(brandId) || brandId <= 0) {
      return NextResponse.json({ ok: false, message: 'brand_id is required.' }, { status: 400 });
    }

    const status = (searchParams.get('status') ?? '').trim().toLowerCase();
    const platform = (searchParams.get('platform') ?? '').trim().toLowerCase();
    const q = (searchParams.get('q') ?? '').trim();
    const category = (searchParams.get('category') ?? '').trim();

    const where: string[] = ['brand_id = ?'];
    const params: Array<string | number> = [brandId];

    if (status && VALID_STATUSES.has(status)) {
      where.push('status = ?');
      params.push(status);
    }
    if (platform && VALID_PLATFORMS.has(platform)) {
      where.push('platform = ?');
      params.push(platform);
    }
    if (category) {
      where.push('category = ?');
      params.push(category);
    }
    if (q) {
      where.push('(title LIKE ? OR category LIKE ? OR hook LIKE ?)');
      const term = `%${q}%`;
      params.push(term, term, term);
    }

    const [rows] = await pool.execute<ContentRow[]>(
      `
      SELECT
        id, brand_id, title, platform, category, hook, description, status, script_id,
        affiliate_id, monetized, thumbnail_path, scheduled_at, created_at
      FROM content_items
      WHERE ${where.join(' AND ')}
      ORDER BY created_at DESC
      `,
      params,
    );

    return NextResponse.json(rows);
  } catch {
    return NextResponse.json({ ok: false, message: 'Unable to load content items.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Body;
    const brandId = Number(body.brand_id);
    const title = parseOptionalString(body.title, 200);
    const platform = typeof body.platform === 'string' ? body.platform.trim().toLowerCase() : '';
    const category = parseOptionalString(body.category, 120);
    const statusRaw = typeof body.status === 'string' ? body.status.trim().toLowerCase() : 'idea';
    const status = VALID_STATUSES.has(statusRaw) ? statusRaw : 'idea';
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

    const [result] = await pool.execute<ResultSetHeader>(
      `
      INSERT INTO content_items (brand_id, title, platform, category, status, monetized)
      VALUES (?, ?, ?, ?, ?, ?)
      `,
      [brandId, title, platform, category, status, monetized],
    );

    const pointsAwarded = status === 'idea' ? 4 : status === 'scripted' ? 8 : 10;
    await addPointsSafe({
      domain: 'content',
      sourceType: `content_create_${status}`,
      sourceId: result.insertId || null,
      points: pointsAwarded,
      reason: `Content created as ${status}`,
    });

    return NextResponse.json({ ok: true, insertedId: result.insertId, points_awarded: pointsAwarded });
  } catch {
    return NextResponse.json({ ok: false, message: 'Unable to create content item.' }, { status: 500 });
  }
}
