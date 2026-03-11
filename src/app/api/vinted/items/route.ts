import { NextResponse } from 'next/server';
import { type ResultSetHeader, type RowDataPacket } from 'mysql2';
import pool from '../../../../lib/db';

export const dynamic = 'force-dynamic';

type ItemRow = RowDataPacket & {
  id: number;
  title: string;
  category: string | null;
  size: string | null;
  condition: string | null;
  cost_price: number;
  intended_price: number | null;
  sale_price: number | null;
  platform_fee: number | null;
  status: 'draft' | 'listed' | 'reserved' | 'sold';
  image_path: string | null;
  bundle_id: number | null;
  created_at: string;
  sold_at: string | null;
};

type Body = {
  title?: unknown;
  category?: unknown;
  size?: unknown;
  condition?: unknown;
  cost_price?: unknown;
  intended_price?: unknown;
  status?: unknown;
  image_path?: unknown;
  bundle_id?: unknown;
};

const VALID_STATUSES = new Set(['draft', 'listed', 'reserved', 'sold']);

function parseOptionalString(value: unknown, max = 200) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, max);
}

function parseOptionalNumber(value: unknown) {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function parseOptionalPositiveInt(value: unknown) {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : null;
}

function parseStatus(value: unknown) {
  const status = typeof value === 'string' ? value.trim().toLowerCase() : 'draft';
  return VALID_STATUSES.has(status) ? (status as 'draft' | 'listed' | 'reserved' | 'sold') : null;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const q = (searchParams.get('q') ?? '').trim();
    const statusParam = (searchParams.get('status') ?? '').trim().toLowerCase();
    const status = VALID_STATUSES.has(statusParam) ? statusParam : null;
    const pageParam = Number(searchParams.get('page') ?? 1);
    const page = Number.isFinite(pageParam) ? Math.max(1, Math.floor(pageParam)) : 1;
    const limitParam = Number(searchParams.get('limit') ?? 18);
    const limitRaw = Number.isFinite(limitParam) ? Math.floor(limitParam) : 18;
    const limit = Math.min(60, Math.max(6, limitRaw));
    const offset = (page - 1) * limit;

    const where: string[] = [];
    const params: Array<string | number> = [];

    if (q) {
      where.push('(title LIKE ? OR category LIKE ? OR size LIKE ? OR `condition` LIKE ?)');
      const term = `%${q}%`;
      params.push(term, term, term, term);
    }
    if (status) {
      where.push('status = ?');
      params.push(status);
    }

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const [rows] = await pool.execute<ItemRow[]>(
      `
      SELECT
        id, title, category, size, \`condition\`, cost_price, intended_price, sale_price, platform_fee,
        status, image_path, bundle_id, created_at, sold_at
      FROM vinted_items
      ${whereSql}
      ORDER BY created_at DESC
      LIMIT ${limit} OFFSET ${offset}
      `,
      params,
    );

    const [countRows] = await pool.execute<RowDataPacket[]>(
      `SELECT COUNT(*) AS total FROM vinted_items ${whereSql}`,
      params,
    );
    const total = Number(countRows[0]?.total ?? 0);

    return NextResponse.json({
      items: rows,
      page,
      limit,
      total,
      total_pages: Math.max(1, Math.ceil(total / limit)),
    });
  } catch {
    return NextResponse.json({ ok: false, message: 'Unable to load inventory items.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Body;
    const title = parseOptionalString(body.title, 180);
    const category = parseOptionalString(body.category, 120);
    const size = parseOptionalString(body.size, 40);
    const condition = parseOptionalString(body.condition, 80);
    const costPrice = parseOptionalNumber(body.cost_price);
    const intendedPrice = parseOptionalNumber(body.intended_price);
    const status = parseStatus(body.status ?? 'draft');
    const imagePath = parseOptionalString(body.image_path, 400);
    const bundleId = parseOptionalPositiveInt(body.bundle_id);

    if (!title) {
      return NextResponse.json({ ok: false, message: 'title is required.' }, { status: 400 });
    }
    if (costPrice === null || costPrice < 0) {
      return NextResponse.json({ ok: false, message: 'cost_price must be a valid positive number.' }, { status: 400 });
    }
    if (intendedPrice !== null && intendedPrice < 0) {
      return NextResponse.json({ ok: false, message: 'intended_price must be >= 0.' }, { status: 400 });
    }
    if (body.bundle_id !== undefined && bundleId === null) {
      return NextResponse.json({ ok: false, message: 'bundle_id must be a positive integer.' }, { status: 400 });
    }
    if (!status) {
      return NextResponse.json({ ok: false, message: 'status is invalid.' }, { status: 400 });
    }
    if (status === 'sold') {
      return NextResponse.json(
        { ok: false, message: 'Use /api/vinted/items/:id/sold to mark item as sold with sale details.' },
        { status: 400 },
      );
    }

    const [result] = await pool.execute<ResultSetHeader>(
      `
      INSERT INTO vinted_items
      (title, category, size, \`condition\`, cost_price, intended_price, status, image_path, bundle_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [title, category, size, condition, costPrice, intendedPrice, status, imagePath, bundleId],
    );

    return NextResponse.json({ ok: true, insertedId: result.insertId });
  } catch {
    return NextResponse.json({ ok: false, message: 'Unable to create inventory item.' }, { status: 500 });
  }
}
