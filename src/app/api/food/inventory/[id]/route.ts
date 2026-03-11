import { NextResponse } from 'next/server';
import { type ResultSetHeader } from 'mysql2';
import pool from '../../../../../lib/db';

export const dynamic = 'force-dynamic';

type Body = {
  ingredient_name?: unknown;
  image_path?: unknown;
  quantity?: unknown;
  unit?: unknown;
  location?: unknown;
  low_stock_threshold?: unknown;
};

function validLocation(value: unknown): value is 'pantry' | 'fridge' | 'freezer' {
  return value === 'pantry' || value === 'fridge' || value === 'freezer';
}

export async function PATCH(request: Request, context: { params: { id: string } }) {
  try {
    const id = Number(context.params.id);
    if (!Number.isInteger(id) || id <= 0) return NextResponse.json({ ok: false, message: 'id is invalid.' }, { status: 400 });
    const body = (await request.json()) as Body;
    const ingredientName = typeof body.ingredient_name === 'string' ? body.ingredient_name.trim() : null;
    const imagePath = typeof body.image_path === 'string' ? body.image_path.trim() : null;
    const quantity = body.quantity === undefined ? null : Math.max(0, Number(body.quantity));
    const unit = typeof body.unit === 'string' ? body.unit.trim() : null;
    const location = body.location === undefined ? null : validLocation(body.location) ? body.location : null;
    const lowThreshold = body.low_stock_threshold === undefined ? null : Math.max(0, Number(body.low_stock_threshold));

    await pool.execute<ResultSetHeader>(
      `UPDATE inventory_items
       SET ingredient_name = COALESCE(?, ingredient_name),
           image_path = COALESCE(?, image_path),
           quantity = COALESCE(?, quantity),
           unit = COALESCE(?, unit),
           location = COALESCE(?, location),
           low_stock_threshold = COALESCE(?, low_stock_threshold)
       WHERE id = ?`,
      [ingredientName, imagePath, quantity, unit, location, lowThreshold, id],
    );
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false, message: 'Unable to update inventory item.' }, { status: 500 });
  }
}

export async function DELETE(_: Request, context: { params: { id: string } }) {
  try {
    const id = Number(context.params.id);
    if (!Number.isInteger(id) || id <= 0) return NextResponse.json({ ok: false, message: 'id is invalid.' }, { status: 400 });
    await pool.execute<ResultSetHeader>(`DELETE FROM inventory_items WHERE id = ?`, [id]);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false, message: 'Unable to delete inventory item.' }, { status: 500 });
  }
}
