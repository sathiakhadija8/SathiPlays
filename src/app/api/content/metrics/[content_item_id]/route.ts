import { NextResponse } from 'next/server';
import { type ResultSetHeader, type RowDataPacket } from 'mysql2';
import pool from '../../../../../lib/db';

export const dynamic = 'force-dynamic';

type Body = {
  brand_id?: unknown;
  views?: unknown;
  likes?: unknown;
  comments?: unknown;
  shares?: unknown;
  saves?: unknown;
  revenue?: unknown;
};

type ContentItemRow = RowDataPacket & {
  id: number;
};

function toNonNegativeInt(value: unknown) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.floor(n);
}

function toNonNegativeDecimal(value: unknown) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return null;
  return Number(n.toFixed(2));
}

export async function PATCH(request: Request, { params }: { params: { content_item_id: string } }) {
  try {
    const contentItemId = Number(params.content_item_id);
    if (!Number.isInteger(contentItemId) || contentItemId <= 0) {
      return NextResponse.json({ ok: false, message: 'Invalid content_item_id.' }, { status: 400 });
    }

    const body = (await request.json()) as Body;
    const brandId = Number(body.brand_id);
    if (!Number.isInteger(brandId) || brandId <= 0) {
      return NextResponse.json({ ok: false, message: 'brand_id is required.' }, { status: 400 });
    }

    const [contentRows] = await pool.execute<ContentItemRow[]>(
      `SELECT id FROM content_items WHERE id = ? AND brand_id = ? LIMIT 1`,
      [contentItemId, brandId],
    );
    if (contentRows.length === 0) {
      return NextResponse.json({ ok: false, message: 'Content item not found for this brand.' }, { status: 404 });
    }

    const views = toNonNegativeInt(body.views ?? 0);
    const likes = toNonNegativeInt(body.likes ?? 0);
    const comments = toNonNegativeInt(body.comments ?? 0);
    const shares = toNonNegativeInt(body.shares ?? 0);
    const saves = toNonNegativeInt(body.saves ?? 0);
    const revenue = toNonNegativeDecimal(body.revenue ?? 0);

    if ([views, likes, comments, shares, saves, revenue].some((v) => v === null)) {
      return NextResponse.json({ ok: false, message: 'Metrics must be non-negative numbers.' }, { status: 400 });
    }

    await pool.execute<ResultSetHeader>(
      `
      INSERT INTO content_metrics (
        content_item_id, views, likes, comments, shares, saves, revenue
      )
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        views = VALUES(views),
        likes = VALUES(likes),
        comments = VALUES(comments),
        shares = VALUES(shares),
        saves = VALUES(saves),
        revenue = VALUES(revenue)
      `,
      [contentItemId, views, likes, comments, shares, saves, revenue],
    );

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false, message: 'Unable to update content metrics.' }, { status: 500 });
  }
}
