import { NextResponse } from 'next/server';
import { type ResultSetHeader, type RowDataPacket } from 'mysql2';
import pool from '../../../../../lib/db';

export const dynamic = 'force-dynamic';

type Body = {
  brand_id?: unknown;
  title?: unknown;
  platform?: unknown;
  category?: unknown;
  hook?: unknown;
  description?: unknown;
  status?: unknown;
  script_id?: unknown;
  affiliate_id?: unknown;
  monetized?: unknown;
};

const VALID_STATUSES = new Set(['idea', 'scripted', 'filmed', 'edited', 'scheduled', 'posted']);
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

function parseOptionalNumber(value: unknown) {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
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
    const platformRaw = body.platform === undefined ? undefined : typeof body.platform === 'string' ? body.platform.trim().toLowerCase() : '';
    const platform = platformRaw === undefined ? undefined : VALID_PLATFORMS.has(platformRaw) ? platformRaw : null;
    const category = parseOptionalString(body.category, 120);
    const hook = parseOptionalString(body.hook, 255);
    const description = parseOptionalString(body.description, 3000);
    const statusRaw = body.status === undefined ? undefined : typeof body.status === 'string' ? body.status.trim().toLowerCase() : '';
    const status = statusRaw === undefined ? undefined : VALID_STATUSES.has(statusRaw) ? statusRaw : null;
    const scriptId = parseOptionalNumber(body.script_id);
    const affiliateId = parseOptionalNumber(body.affiliate_id);
    const monetized = body.monetized === undefined ? undefined : body.monetized ? 1 : 0;

    if (platform === null) {
      return NextResponse.json({ ok: false, message: 'Invalid platform.' }, { status: 400 });
    }
    if (status === null) {
      return NextResponse.json({ ok: false, message: 'Invalid status.' }, { status: 400 });
    }
    if (scriptId !== undefined && scriptId !== null) {
      const [scriptRows] = await pool.execute<ExistsRow[]>(
        `SELECT id FROM scripts WHERE id = ? AND brand_id = ? LIMIT 1`,
        [scriptId, brandId],
      );
      if (scriptRows.length === 0) {
        return NextResponse.json({ ok: false, message: 'script_id is invalid for this brand.' }, { status: 400 });
      }
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
      UPDATE content_items
      SET
        title = COALESCE(?, title),
        platform = COALESCE(?, platform),
        category = COALESCE(?, category),
        hook = COALESCE(?, hook),
        description = COALESCE(?, description),
        status = COALESCE(?, status),
        script_id = COALESCE(?, script_id),
        affiliate_id = COALESCE(?, affiliate_id),
        monetized = COALESCE(?, monetized)
      WHERE id = ?
        AND brand_id = ?
      `,
      [
        title === undefined ? null : title,
        platform === undefined ? null : platform,
        category === undefined ? null : category,
        hook === undefined ? null : hook,
        description === undefined ? null : description,
        status === undefined ? null : status,
        scriptId === undefined ? null : scriptId,
        affiliateId === undefined ? null : affiliateId,
        monetized === undefined ? null : monetized,
        id,
        brandId,
      ],
    );

    if (result.affectedRows === 0) {
      return NextResponse.json({ ok: false, message: 'Content item not found.' }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false, message: 'Unable to update content item.' }, { status: 500 });
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
      `DELETE FROM content_items WHERE id = ? AND brand_id = ?`,
      [id, brandId],
    );
    if (result.affectedRows === 0) {
      return NextResponse.json({ ok: false, message: 'Content item not found.' }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false, message: 'Unable to delete content item.' }, { status: 500 });
  }
}
