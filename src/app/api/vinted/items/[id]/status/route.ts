import { NextResponse } from 'next/server';
import { type ResultSetHeader } from 'mysql2';
import pool from '../../../../../../lib/db';

export const dynamic = 'force-dynamic';

type Body = {
  status?: unknown;
  clear_sold_fields?: unknown;
};

const VALID_STATUSES = new Set(['draft', 'listed', 'reserved', 'sold']);

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  try {
    const id = Number(params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return NextResponse.json({ ok: false, message: 'Invalid id.' }, { status: 400 });
    }

    const body = (await request.json()) as Body;
    const status = typeof body.status === 'string' ? body.status.trim().toLowerCase() : '';
    const clearSoldFields = body.clear_sold_fields === true;
    if (!VALID_STATUSES.has(status)) {
      return NextResponse.json({ ok: false, message: 'Invalid status.' }, { status: 400 });
    }
    if (status === 'sold') {
      return NextResponse.json(
        { ok: false, message: 'Use /api/vinted/items/:id/sold to move item to sold.' },
        { status: 400 },
      );
    }

    const [result] = await pool.execute<ResultSetHeader>(
      `
      UPDATE vinted_items
      SET
        status = ?,
        sale_price = CASE WHEN ? THEN NULL ELSE sale_price END,
        platform_fee = CASE WHEN ? THEN NULL ELSE platform_fee END,
        sold_at = CASE WHEN ? THEN NULL ELSE sold_at END
      WHERE id = ?
      `,
      [status, clearSoldFields, clearSoldFields, clearSoldFields, id],
    );

    if (result.affectedRows === 0) {
      return NextResponse.json({ ok: false, message: 'Item not found.' }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false, message: 'Unable to update item status.' }, { status: 500 });
  }
}
