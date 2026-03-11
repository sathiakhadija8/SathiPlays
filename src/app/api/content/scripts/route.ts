import { NextResponse } from 'next/server';
import { type ResultSetHeader, type RowDataPacket } from 'mysql2';
import pool from '../../../../lib/db';

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
  cta: string | null;
  hashtags: string | null;
  affiliate_id: number | null;
  created_at: string;
};

type ExistsRow = RowDataPacket & {
  id: number;
};

type Body = {
  brand_id?: unknown;
  title?: unknown;
  platform?: unknown;
  category?: unknown;
  monetized?: unknown;
  hook_lines?: unknown;
  body?: unknown;
  cta?: unknown;
  hashtags?: unknown;
  affiliate_id?: unknown;
};

const VALID_PLATFORMS = new Set(['tiktok', 'instagram', 'youtube', 'pinterest', 'facebook']);

function parseOptionalString(value: unknown, max = 255) {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, max) : null;
}

function normalizeHookLines(value: unknown) {
  if (!Array.isArray(value)) return null;
  const lines = value
    .map((line) => (typeof line === 'string' ? line.trim().slice(0, 140) : ''))
    .filter(Boolean);
  if (lines.length < 3 || lines.length > 6) return null;
  return lines;
}

function parseAffiliateId(value: unknown) {
  if (value === undefined || value === null || value === '') return null;
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : null;
}

function deserializeHookLines(value: string | string[]) {
  if (Array.isArray(value)) return value;
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const brandId = Number(searchParams.get('brand_id'));
    if (!Number.isInteger(brandId) || brandId <= 0) {
      return NextResponse.json({ ok: false, message: 'brand_id is required.' }, { status: 400 });
    }

    const q = (searchParams.get('q') ?? '').trim();
    const platform = (searchParams.get('platform') ?? '').trim().toLowerCase();

    const where: string[] = ['brand_id = ?'];
    const params: Array<string | number> = [brandId];

    if (platform && VALID_PLATFORMS.has(platform)) {
      where.push('platform = ?');
      params.push(platform);
    }

    if (q) {
      const term = `%${q}%`;
      where.push('(title LIKE ? OR category LIKE ? OR body LIKE ? OR hashtags LIKE ?)');
      params.push(term, term, term, term);
    }

    const [rows] = await pool.execute<ScriptRow[]>(
      `
      SELECT
        id, brand_id, title, platform, category, monetized, hook_lines,
        body, cta, hashtags, affiliate_id, created_at
      FROM scripts
      WHERE ${where.join(' AND ')}
      ORDER BY created_at DESC
      `,
      params,
    );

    const payload = rows.map((row) => ({
      ...row,
      hook_lines: deserializeHookLines(row.hook_lines),
    }));

    return NextResponse.json(payload);
  } catch {
    return NextResponse.json({ ok: false, message: 'Unable to load scripts.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Body;
    const brandId = Number(body.brand_id);
    const title = parseOptionalString(body.title, 200);
    const platform = typeof body.platform === 'string' ? body.platform.trim().toLowerCase() : '';
    const category = parseOptionalString(body.category, 120);
    const monetized = body.monetized ? 1 : 0;
    const hookLines = normalizeHookLines(body.hook_lines);
    const scriptBody = parseOptionalString(body.body, 20000);
    const cta = parseOptionalString(body.cta, 2000);
    const hashtags = parseOptionalString(body.hashtags, 1000);
    const affiliateId = parseAffiliateId(body.affiliate_id);

    if (!Number.isInteger(brandId) || brandId <= 0) {
      return NextResponse.json({ ok: false, message: 'brand_id is required.' }, { status: 400 });
    }
    if (!title) {
      return NextResponse.json({ ok: false, message: 'title is required.' }, { status: 400 });
    }
    if (!VALID_PLATFORMS.has(platform)) {
      return NextResponse.json({ ok: false, message: 'platform is invalid.' }, { status: 400 });
    }
    if (!scriptBody) {
      return NextResponse.json({ ok: false, message: 'body is required.' }, { status: 400 });
    }
    if (!hookLines) {
      return NextResponse.json({ ok: false, message: 'hook_lines must include 3 to 6 lines.' }, { status: 400 });
    }
    if (affiliateId) {
      const [affiliateRows] = await pool.execute<ExistsRow[]>(
        `SELECT id FROM affiliate_links WHERE id = ? AND brand_id = ? LIMIT 1`,
        [affiliateId, brandId],
      );
      if (affiliateRows.length === 0) {
        return NextResponse.json({ ok: false, message: 'affiliate_id is invalid for this brand.' }, { status: 400 });
      }
    }

    const [result] = await pool.execute<ResultSetHeader>(
      `
      INSERT INTO scripts (
        brand_id, title, platform, category, monetized,
        hook_lines, body, cta, hashtags, affiliate_id
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        brandId,
        title,
        platform,
        category,
        monetized,
        JSON.stringify(hookLines),
        scriptBody,
        cta,
        hashtags,
        affiliateId,
      ],
    );

    return NextResponse.json({ ok: true, insertedId: result.insertId });
  } catch {
    return NextResponse.json({ ok: false, message: 'Unable to create script.' }, { status: 500 });
  }
}
