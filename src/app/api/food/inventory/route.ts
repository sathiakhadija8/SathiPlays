import { NextResponse } from 'next/server';
import { type ResultSetHeader, type RowDataPacket } from 'mysql2';
import pool from '../../../../lib/db';

export const dynamic = 'force-dynamic';

type InventoryRow = RowDataPacket & {
  id: number;
  ingredient_name: string;
  image_path: string | null;
  quantity: number;
  unit: string;
  location: 'pantry' | 'fridge' | 'freezer';
  low_stock_threshold: number;
  updated_at: string;
};

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

export async function GET() {
  try {
    const [rows] = await pool.execute<InventoryRow[]>(
      `SELECT id, ingredient_name, image_path, quantity, unit, location, low_stock_threshold, updated_at
       FROM inventory_items
       ORDER BY ingredient_name ASC`,
    );
    return NextResponse.json(rows);
  } catch {
    return NextResponse.json({ ok: false, message: 'Unable to load inventory.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Body;
    const ingredientName = typeof body.ingredient_name === 'string' ? body.ingredient_name.trim() : '';
    const imagePath = typeof body.image_path === 'string' ? body.image_path.trim() : '';
    const quantity = Number(body.quantity ?? 0);
    const unit = typeof body.unit === 'string' ? body.unit.trim() : '';
    const location = validLocation(body.location) ? body.location : 'pantry';
    const lowThreshold = Number(body.low_stock_threshold ?? 0);

    if (!ingredientName || ingredientName.length > 160) {
      return NextResponse.json({ ok: false, message: 'ingredient_name is required (<=160).' }, { status: 400 });
    }
    if (!unit || unit.length > 30) {
      return NextResponse.json({ ok: false, message: 'unit is required (<=30).' }, { status: 400 });
    }

    await pool.execute<ResultSetHeader>(
      `INSERT INTO inventory_items (ingredient_name, image_path, quantity, unit, location, low_stock_threshold)
       VALUES (?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
          image_path = VALUES(image_path),
          quantity = VALUES(quantity),
          unit = VALUES(unit),
          location = VALUES(location),
          low_stock_threshold = VALUES(low_stock_threshold)`,
      [ingredientName, imagePath || null, Math.max(0, quantity), unit, location, Math.max(0, lowThreshold)],
    );
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false, message: 'Unable to upsert inventory item.' }, { status: 500 });
  }
}
