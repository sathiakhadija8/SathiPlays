import { NextResponse } from 'next/server';
import { type ResultSetHeader, type RowDataPacket } from 'mysql2';
import pool from '../../../../../lib/db';

export const dynamic = 'force-dynamic';

type AffiliateLinkRow = RowDataPacket & {
  id: number;
  brand_id: number;
  network: string;
  product_name: string;
  url: string;
  commission_percent: number | null;
  created_at: string;
};

type Body = {
  id?: unknown;
  brand_id?: unknown;
  network?: unknown;
  product_name?: unknown;
  url?: unknown;
  commission_percent?: unknown;
};

function parseString(value: unknown, max = 255) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, max) : null;
}

function parseOptionalDecimal(value: unknown) {
  if (value === undefined || value === null || value === '') return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return null;
  return Number(n.toFixed(2));
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const brandId = Number(searchParams.get('brand_id'));
    if (!Number.isInteger(brandId) || brandId <= 0) {
      return NextResponse.json({ ok: false, message: 'brand_id is required.' }, { status: 400 });
    }

    const [rows] = await pool.execute<AffiliateLinkRow[]>(
      `
      SELECT id, brand_id, network, product_name, url, commission_percent, created_at
      FROM affiliate_links
      WHERE brand_id = ?
      ORDER BY created_at DESC
      `,
      [brandId],
    );

    return NextResponse.json(rows);
  } catch {
    return NextResponse.json({ ok: false, message: 'Unable to load affiliate links.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Body;
    const brandId = Number(body.brand_id);
    const network = parseString(body.network, 120);
    const productName = parseString(body.product_name, 160);
    const url = parseString(body.url, 4000);
    const commissionPercent = parseOptionalDecimal(body.commission_percent);

    if (!Number.isInteger(brandId) || brandId <= 0) {
      return NextResponse.json({ ok: false, message: 'brand_id is required.' }, { status: 400 });
    }
    if (!network || !productName || !url) {
      return NextResponse.json({ ok: false, message: 'network, product_name and url are required.' }, { status: 400 });
    }

    const [result] = await pool.execute<ResultSetHeader>(
      `
      INSERT INTO affiliate_links (brand_id, network, product_name, url, commission_percent)
      VALUES (?, ?, ?, ?, ?)
      `,
      [brandId, network, productName, url, commissionPercent],
    );

    return NextResponse.json({ ok: true, insertedId: result.insertId });
  } catch {
    return NextResponse.json({ ok: false, message: 'Unable to create affiliate link.' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const body = (await request.json()) as Body;
    const id = Number(body.id);
    const brandId = Number(body.brand_id);
    const network = parseString(body.network, 120);
    const productName = parseString(body.product_name, 160);
    const url = parseString(body.url, 4000);
    const commissionPercent = parseOptionalDecimal(body.commission_percent);

    if (!Number.isInteger(id) || id <= 0) {
      return NextResponse.json({ ok: false, message: 'id is required.' }, { status: 400 });
    }
    if (!Number.isInteger(brandId) || brandId <= 0) {
      return NextResponse.json({ ok: false, message: 'brand_id is required.' }, { status: 400 });
    }

    const [result] = await pool.execute<ResultSetHeader>(
      `
      UPDATE affiliate_links
      SET
        network = COALESCE(?, network),
        product_name = COALESCE(?, product_name),
        url = COALESCE(?, url),
        commission_percent = COALESCE(?, commission_percent)
      WHERE id = ?
        AND brand_id = ?
      `,
      [network, productName, url, commissionPercent, id, brandId],
    );

    if (result.affectedRows === 0) {
      return NextResponse.json({ ok: false, message: 'Affiliate link not found.' }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false, message: 'Unable to update affiliate link.' }, { status: 500 });
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
      'DELETE FROM affiliate_links WHERE id = ? AND brand_id = ?',
      [id, brandId],
    );
    if (result.affectedRows === 0) {
      return NextResponse.json({ ok: false, message: 'Affiliate link not found.' }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false, message: 'Unable to delete affiliate link.' }, { status: 500 });
  }
}
