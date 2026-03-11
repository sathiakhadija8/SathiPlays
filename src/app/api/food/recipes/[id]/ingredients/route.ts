import { NextResponse } from 'next/server';
import { type ResultSetHeader } from 'mysql2';
import pool from '../../../../../../lib/db';

export const dynamic = 'force-dynamic';

type Body = {
  ingredient_name?: unknown;
  qty_per_portion?: unknown;
  unit?: unknown;
};

export async function POST(request: Request, context: { params: { id: string } }) {
  try {
    const recipeId = Number(context.params.id);
    if (!Number.isInteger(recipeId) || recipeId <= 0) {
      return NextResponse.json({ ok: false, message: 'recipe id is invalid.' }, { status: 400 });
    }
    const body = (await request.json()) as Body;
    const ingredientName = typeof body.ingredient_name === 'string' ? body.ingredient_name.trim() : '';
    const unit = typeof body.unit === 'string' ? body.unit.trim() : '';
    const qty = Number(body.qty_per_portion ?? 0);
    if (!ingredientName || ingredientName.length > 160) {
      return NextResponse.json({ ok: false, message: 'ingredient_name is required (<=160).' }, { status: 400 });
    }
    if (!unit || unit.length > 30) {
      return NextResponse.json({ ok: false, message: 'unit is required (<=30).' }, { status: 400 });
    }
    if (!Number.isFinite(qty) || qty <= 0) {
      return NextResponse.json({ ok: false, message: 'qty_per_portion must be > 0.' }, { status: 400 });
    }

    const [result] = await pool.execute<ResultSetHeader>(
      `INSERT INTO recipe_ingredients (recipe_id, ingredient_name, qty_per_portion, unit)
       VALUES (?, ?, ?, ?)`,
      [recipeId, ingredientName, qty, unit],
    );
    return NextResponse.json({ ok: true, insertedId: result.insertId });
  } catch {
    return NextResponse.json({ ok: false, message: 'Unable to add recipe ingredient.' }, { status: 500 });
  }
}
