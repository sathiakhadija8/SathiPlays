import { NextResponse } from 'next/server';
import { type ResultSetHeader, type RowDataPacket } from 'mysql2';
import pool from '../../../../../lib/db';

export const dynamic = 'force-dynamic';

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

type ExistsRow = RowDataPacket & {
  id: number;
};

function parseOptionalString(value: unknown, max = 255) {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, max) : null;
}

function normalizeHookLines(value: unknown) {
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) return null;
  const lines = value
    .map((line) => (typeof line === 'string' ? line.trim().slice(0, 140) : ''))
    .filter(Boolean);
  if (lines.length < 3 || lines.length > 6) return null;
  return lines;
}

function parseAffiliateId(value: unknown) {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : null;
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  try {
    const id = Number(params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return NextResponse.json({ ok: false, message: 'Invalid id.' }, { status: 400 });
    }

    const body = (await request.json()) as Body;
    const brandId = Number(body.brand_id);
    if (!Number.isInteger(brandId) || brandId <= 0) {
      return NextResponse.json({ ok: false, message: 'brand_id is required.' }, { status: 400 });
    }
    const title = parseOptionalString(body.title, 200);
    const platformRaw =
      body.platform === undefined ? undefined : typeof body.platform === 'string' ? body.platform.trim().toLowerCase() : '';
    const platform = platformRaw === undefined ? undefined : VALID_PLATFORMS.has(platformRaw) ? platformRaw : null;
    const category = parseOptionalString(body.category, 120);
    const monetized = body.monetized === undefined ? undefined : body.monetized ? 1 : 0;
    const hookLines = normalizeHookLines(body.hook_lines);
    const scriptBody = parseOptionalString(body.body, 20000);
    const cta = parseOptionalString(body.cta, 2000);
    const hashtags = parseOptionalString(body.hashtags, 1000);
    const affiliateId = parseAffiliateId(body.affiliate_id);

    if (platform === null) {
      return NextResponse.json({ ok: false, message: 'platform is invalid.' }, { status: 400 });
    }
    if (hookLines === null) {
      return NextResponse.json({ ok: false, message: 'hook_lines must include 3 to 6 lines.' }, { status: 400 });
    }
    if (affiliateId !== undefined && affiliateId !== null) {
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
      UPDATE scripts
      SET
        title = COALESCE(?, title),
        platform = COALESCE(?, platform),
        category = COALESCE(?, category),
        monetized = COALESCE(?, monetized),
        hook_lines = COALESCE(?, hook_lines),
        body = COALESCE(?, body),
        cta = COALESCE(?, cta),
        hashtags = COALESCE(?, hashtags),
        affiliate_id = COALESCE(?, affiliate_id)
      WHERE id = ?
        AND brand_id = ?
      `,
      [
        title === undefined ? null : title,
        platform === undefined ? null : platform,
        category === undefined ? null : category,
        monetized === undefined ? null : monetized,
        hookLines === undefined ? null : JSON.stringify(hookLines),
        scriptBody === undefined ? null : scriptBody,
        cta === undefined ? null : cta,
        hashtags === undefined ? null : hashtags,
        affiliateId === undefined ? null : affiliateId,
        id,
        brandId,
      ],
    );

    if (result.affectedRows === 0) {
      return NextResponse.json({ ok: false, message: 'Script not found.' }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false, message: 'Unable to update script.' }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  try {
    const id = Number(params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return NextResponse.json({ ok: false, message: 'Invalid id.' }, { status: 400 });
    }
    const { searchParams } = new URL(request.url);
    const brandId = Number(searchParams.get('brand_id'));
    if (!Number.isInteger(brandId) || brandId <= 0) {
      return NextResponse.json({ ok: false, message: 'brand_id is required.' }, { status: 400 });
    }

    const [result] = await pool.execute<ResultSetHeader>(
      `DELETE FROM scripts WHERE id = ? AND brand_id = ?`,
      [id, brandId],
    );
    if (result.affectedRows === 0) {
      return NextResponse.json({ ok: false, message: 'Script not found.' }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false, message: 'Unable to delete script.' }, { status: 500 });
  }
}
