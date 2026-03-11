import { NextResponse } from 'next/server';
import { type ResultSetHeader } from 'mysql2';
import pool from '../../../../../lib/db';

export const dynamic = 'force-dynamic';

type Body = {
  status?: unknown;
  item_name?: unknown;
  quantity?: unknown;
  unit?: unknown;
  category?: unknown;
};

function validStatus(value: unknown): value is 'pending' | 'bought' {
  return value === 'pending' || value === 'bought';
}

export async function PATCH(request: Request, context: { params: { id: string } }) {
  try {
    const id = Number(context.params.id);
    if (!Number.isInteger(id) || id <= 0) return NextResponse.json({ ok: false, message: 'id is invalid.' }, { status: 400 });
    const body = (await request.json()) as Body;
    const status = body.status !== undefined && validStatus(body.status) ? body.status : null;
    const itemName = typeof body.item_name === 'string' ? body.item_name.trim() : null;
    const quantity = body.quantity === undefined ? null : Number(body.quantity);
    const unit = typeof body.unit === 'string' ? body.unit.trim() : null;
    const category = typeof body.category === 'string' ? body.category.trim() : null;
    if (body.status !== undefined && !status) {
      return NextResponse.json({ ok: false, message: 'status must be pending or bought.' }, { status: 400 });
    }
    if (itemName !== null && itemName.length > 160) {
      return NextResponse.json({ ok: false, message: 'item_name must be <=160 chars.' }, { status: 400 });
    }
    if (body.quantity !== undefined && (quantity === null || !Number.isFinite(quantity) || quantity < 0)) {
      return NextResponse.json({ ok: false, message: 'quantity must be a non-negative number.' }, { status: 400 });
    }

    await pool.execute<ResultSetHeader>(
      `UPDATE grocery_items
       SET status = COALESCE(?, status),
           item_name = COALESCE(?, item_name),
           quantity = COALESCE(?, quantity),
           unit = COALESCE(?, unit),
           category = COALESCE(?, category)
       WHERE id = ?`,
      [status, itemName, quantity, unit, category, id],
    );
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false, message: 'Unable to update grocery item.' }, { status: 500 });
  }
}

export async function DELETE(_: Request, context: { params: { id: string } }) {
  try {
    const id = Number(context.params.id);
    if (!Number.isInteger(id) || id <= 0) return NextResponse.json({ ok: false, message: 'id is invalid.' }, { status: 400 });
    await pool.execute<ResultSetHeader>(`DELETE FROM grocery_items WHERE id = ?`, [id]);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false, message: 'Unable to delete grocery item.' }, { status: 500 });
  }
}
