import { NextResponse } from 'next/server';
import { type ResultSetHeader, type RowDataPacket } from 'mysql2';
import pool from '../../../../lib/db';

export const dynamic = 'force-dynamic';

type GroceryRow = RowDataPacket & {
  id: number;
  item_name: string;
  quantity: number | null;
  unit: string | null;
  category: string | null;
  status: 'pending' | 'bought';
  created_at: string;
};

type Body = {
  item_name?: unknown;
  quantity?: unknown;
  unit?: unknown;
  category?: unknown;
};

export async function GET() {
  try {
    const [rows] = await pool.execute<GroceryRow[]>(
      `SELECT id, item_name, quantity, unit, category, status, created_at
       FROM grocery_items
       ORDER BY status ASC, created_at DESC`,
    );
    return NextResponse.json(rows);
  } catch {
    return NextResponse.json({ ok: false, message: 'Unable to load grocery list.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Body;
    const itemName = typeof body.item_name === 'string' ? body.item_name.trim() : '';
    const quantity = body.quantity === undefined ? null : Number(body.quantity);
    const unit = typeof body.unit === 'string' ? body.unit.trim() : null;
    const category = typeof body.category === 'string' ? body.category.trim() : null;
    if (!itemName || itemName.length > 160) {
      return NextResponse.json({ ok: false, message: 'item_name is required (<=160).' }, { status: 400 });
    }
    if (body.quantity !== undefined && (quantity === null || !Number.isFinite(quantity) || quantity < 0)) {
      return NextResponse.json({ ok: false, message: 'quantity must be a non-negative number.' }, { status: 400 });
    }
    const [result] = await pool.execute<ResultSetHeader>(
      `INSERT INTO grocery_items (item_name, quantity, unit, category, status)
       VALUES (?, ?, ?, ?, 'pending')`,
      [itemName, quantity, unit || null, category || null],
    );
    return NextResponse.json({ ok: true, insertedId: result.insertId });
  } catch {
    return NextResponse.json({ ok: false, message: 'Unable to add grocery item.' }, { status: 500 });
  }
}
