import { NextResponse } from 'next/server';
import { type ResultSetHeader } from 'mysql2';
import pool from '../../../../../lib/db';

export const dynamic = 'force-dynamic';

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

function parseOptionalPositiveInt(value: unknown) {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : undefined;
}

function parseStatus(value: unknown) {
  if (value === undefined) return undefined;
  if (typeof value !== 'string') return undefined;
  const normalized = value.trim().toLowerCase();
  return VALID_STATUSES.has(normalized) ? normalized : undefined;
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  try {
    const id = Number(params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return NextResponse.json({ ok: false, message: 'Invalid id.' }, { status: 400 });
    }

    const body = (await request.json()) as Body;

    const title = parseOptionalString(body.title, 180);
    const category = parseOptionalString(body.category, 120);
    const size = parseOptionalString(body.size, 40);
    const condition = parseOptionalString(body.condition, 80);
    const imagePath = parseOptionalString(body.image_path, 400);
    const costPrice = parseOptionalNumber(body.cost_price);
    const intendedPrice = parseOptionalNumber(body.intended_price);
    const bundleId = parseOptionalPositiveInt(body.bundle_id);
    const status = parseStatus(body.status);

    if (costPrice !== undefined && (costPrice === null || costPrice < 0)) {
      return NextResponse.json({ ok: false, message: 'cost_price must be >= 0.' }, { status: 400 });
    }
    if (intendedPrice !== undefined && intendedPrice !== null && intendedPrice < 0) {
      return NextResponse.json({ ok: false, message: 'intended_price must be >= 0.' }, { status: 400 });
    }
    if (body.status !== undefined && !status) {
      return NextResponse.json({ ok: false, message: 'Invalid status.' }, { status: 400 });
    }
    if (body.bundle_id !== undefined && bundleId === undefined) {
      return NextResponse.json({ ok: false, message: 'bundle_id must be a positive integer.' }, { status: 400 });
    }
    if (status === 'sold') {
      return NextResponse.json(
        { ok: false, message: 'Use /api/vinted/items/:id/sold to mark item as sold with sale details.' },
        { status: 400 },
      );
    }

    const toDb = <T,>(value: T | undefined): T | null => (value === undefined ? null : value);

    const [result] = await pool.execute<ResultSetHeader>(
      `
      UPDATE vinted_items
      SET
        title = COALESCE(?, title),
        category = COALESCE(?, category),
        size = COALESCE(?, size),
        \`condition\` = COALESCE(?, \`condition\`),
        cost_price = COALESCE(?, cost_price),
        intended_price = COALESCE(?, intended_price),
        status = COALESCE(?, status),
        image_path = COALESCE(?, image_path),
        bundle_id = COALESCE(?, bundle_id)
      WHERE id = ?
      `,
      [
        toDb(title),
        toDb(category),
        toDb(size),
        toDb(condition),
        toDb(costPrice),
        toDb(intendedPrice),
        toDb(status),
        toDb(imagePath),
        toDb(bundleId),
        id,
      ],
    );

    if (result.affectedRows === 0) {
      return NextResponse.json({ ok: false, message: 'Item not found.' }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false, message: 'Unable to update item.' }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  try {
    const id = Number(params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return NextResponse.json({ ok: false, message: 'Invalid id.' }, { status: 400 });
    }

    const [result] = await pool.execute<ResultSetHeader>(`DELETE FROM vinted_items WHERE id = ?`, [id]);
    if (result.affectedRows === 0) {
      return NextResponse.json({ ok: false, message: 'Item not found.' }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false, message: 'Unable to delete item.' }, { status: 500 });
  }
}
