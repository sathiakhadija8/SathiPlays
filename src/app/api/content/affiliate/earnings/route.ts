import { NextResponse } from 'next/server';
import { type ResultSetHeader, type RowDataPacket } from 'mysql2';
import pool from '../../../../../lib/db';

export const dynamic = 'force-dynamic';

type EarningRow = RowDataPacket & {
  id: number;
  affiliate_id: number;
  content_item_id: number | null;
  amount: string | number;
  earned_date: string;
  created_at: string;
};

type ExistsRow = RowDataPacket & {
  id: number;
};

type Body = {
  id?: unknown;
  brand_id?: unknown;
  affiliate_id?: unknown;
  content_item_id?: unknown;
  amount?: unknown;
  earned_date?: unknown;
};

function parseOptionalInt(value: unknown) {
  if (value === undefined || value === null || value === '') return null;
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : null;
}

function parseAmount(value: unknown) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return null;
  return Number(n.toFixed(2));
}

function parseDate(value: unknown) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(trimmed) ? trimmed : null;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const brandId = Number(searchParams.get('brand_id'));
    if (!Number.isInteger(brandId) || brandId <= 0) {
      return NextResponse.json({ ok: false, message: 'brand_id is required.' }, { status: 400 });
    }

    const [rows] = await pool.execute<EarningRow[]>(
      `
      SELECT
        ae.id,
        ae.affiliate_id,
        ae.content_item_id,
        ae.amount,
        ae.earned_date,
        ae.created_at
      FROM affiliate_earnings ae
      INNER JOIN affiliate_links al ON al.id = ae.affiliate_id
      WHERE al.brand_id = ?
      ORDER BY ae.earned_date DESC, ae.created_at DESC
      `,
      [brandId],
    );

    return NextResponse.json(rows.map((row) => ({ ...row, amount: Number(row.amount ?? 0) })));
  } catch {
    return NextResponse.json({ ok: false, message: 'Unable to load affiliate earnings.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Body;
    const brandId = Number(body.brand_id);
    const affiliateId = parseOptionalInt(body.affiliate_id);
    const contentItemId = parseOptionalInt(body.content_item_id);
    const amount = parseAmount(body.amount);
    const earnedDate = parseDate(body.earned_date);

    if (!Number.isInteger(brandId) || brandId <= 0) {
      return NextResponse.json({ ok: false, message: 'brand_id is required.' }, { status: 400 });
    }
    if (!affiliateId || amount === null || !earnedDate) {
      return NextResponse.json({ ok: false, message: 'affiliate_id, amount, earned_date are required.' }, { status: 400 });
    }

    const [affiliateRows] = await pool.execute<ExistsRow[]>(
      `SELECT id FROM affiliate_links WHERE id = ? AND brand_id = ? LIMIT 1`,
      [affiliateId, brandId],
    );
    if (affiliateRows.length === 0) {
      return NextResponse.json({ ok: false, message: 'affiliate_id is invalid for this brand.' }, { status: 400 });
    }

    if (contentItemId) {
      const [contentRows] = await pool.execute<ExistsRow[]>(
        `SELECT id FROM content_items WHERE id = ? AND brand_id = ? LIMIT 1`,
        [contentItemId, brandId],
      );
      if (contentRows.length === 0) {
        return NextResponse.json({ ok: false, message: 'content_item_id is invalid for this brand.' }, { status: 400 });
      }
    }

    const [result] = await pool.execute<ResultSetHeader>(
      `
      INSERT INTO affiliate_earnings (affiliate_id, content_item_id, amount, earned_date)
      VALUES (?, ?, ?, ?)
      `,
      [affiliateId, contentItemId, amount, earnedDate],
    );

    return NextResponse.json({ ok: true, insertedId: result.insertId });
  } catch {
    return NextResponse.json({ ok: false, message: 'Unable to create earning log.' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const body = (await request.json()) as Body;
    const id = Number(body.id);
    const brandId = Number(body.brand_id);
    const hasAffiliateId = body.affiliate_id !== undefined;
    const hasContentItemId = body.content_item_id !== undefined;
    const affiliateId = parseOptionalInt(body.affiliate_id);
    const contentItemId = parseOptionalInt(body.content_item_id);
    const amount = body.amount === undefined ? null : parseAmount(body.amount);
    const earnedDate = body.earned_date === undefined ? null : parseDate(body.earned_date);

    if (!Number.isInteger(id) || id <= 0) {
      return NextResponse.json({ ok: false, message: 'id is required.' }, { status: 400 });
    }
    if (!Number.isInteger(brandId) || brandId <= 0) {
      return NextResponse.json({ ok: false, message: 'brand_id is required.' }, { status: 400 });
    }
    if (
      hasAffiliateId &&
      body.affiliate_id !== null &&
      body.affiliate_id !== '' &&
      !affiliateId
    ) {
      return NextResponse.json({ ok: false, message: 'affiliate_id must be a valid positive integer.' }, { status: 400 });
    }
    if (
      hasContentItemId &&
      body.content_item_id !== null &&
      body.content_item_id !== '' &&
      !contentItemId
    ) {
      return NextResponse.json({ ok: false, message: 'content_item_id must be a valid positive integer.' }, { status: 400 });
    }
    if (body.amount !== undefined && amount === null) {
      return NextResponse.json({ ok: false, message: 'amount must be a non-negative number.' }, { status: 400 });
    }
    if (body.earned_date !== undefined && !earnedDate) {
      return NextResponse.json({ ok: false, message: 'earned_date must be YYYY-MM-DD.' }, { status: 400 });
    }

    if (hasAffiliateId) {
      if (!affiliateId) {
        return NextResponse.json({ ok: false, message: 'affiliate_id is required when updating affiliate link.' }, { status: 400 });
      }
      const [affiliateRows] = await pool.execute<ExistsRow[]>(
        `SELECT id FROM affiliate_links WHERE id = ? AND brand_id = ? LIMIT 1`,
        [affiliateId, brandId],
      );
      if (affiliateRows.length === 0) {
        return NextResponse.json({ ok: false, message: 'affiliate_id is invalid for this brand.' }, { status: 400 });
      }
    }

    if (hasContentItemId && contentItemId) {
      const [contentRows] = await pool.execute<ExistsRow[]>(
        `SELECT id FROM content_items WHERE id = ? AND brand_id = ? LIMIT 1`,
        [contentItemId, brandId],
      );
      if (contentRows.length === 0) {
        return NextResponse.json({ ok: false, message: 'content_item_id is invalid for this brand.' }, { status: 400 });
      }
    }

    const [result] = await pool.execute<ResultSetHeader>(
      `
      UPDATE affiliate_earnings
      SET
        affiliate_id = CASE WHEN ? = 1 THEN ? ELSE affiliate_id END,
        content_item_id = CASE WHEN ? = 1 THEN ? ELSE content_item_id END,
        amount = COALESCE(?, amount),
        earned_date = COALESCE(?, earned_date)
      WHERE id = ?
        AND affiliate_id IN (SELECT id FROM affiliate_links WHERE brand_id = ?)
      `,
      [
        hasAffiliateId ? 1 : 0,
        affiliateId,
        hasContentItemId ? 1 : 0,
        contentItemId,
        amount,
        earnedDate,
        id,
        brandId,
      ],
    );

    if (result.affectedRows === 0) {
      return NextResponse.json({ ok: false, message: 'Earning log not found.' }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false, message: 'Unable to update earning log.' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = Number(searchParams.get('id'));
    const brandId = Number(searchParams.get('brand_id'));
    if (!Number.isInteger(id) || id <= 0) {
      return NextResponse.json({ ok: false, message: 'id is required.' }, { status: 400 });
    }
    if (!Number.isInteger(brandId) || brandId <= 0) {
      return NextResponse.json({ ok: false, message: 'brand_id is required.' }, { status: 400 });
    }

    const [result] = await pool.execute<ResultSetHeader>(
      `
      DELETE FROM affiliate_earnings
      WHERE id = ?
        AND affiliate_id IN (SELECT id FROM affiliate_links WHERE brand_id = ?)
      `,
      [id, brandId],
    );
    if (result.affectedRows === 0) {
      return NextResponse.json({ ok: false, message: 'Earning log not found.' }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false, message: 'Unable to delete earning log.' }, { status: 500 });
  }
}
