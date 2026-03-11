import { NextResponse } from 'next/server';
import { type ResultSetHeader } from 'mysql2';
import pool from '../../../../../../lib/db';

export const dynamic = 'force-dynamic';

type Body = {
  step_text?: unknown;
  order_index?: unknown;
};

export async function POST(request: Request, context: { params: { id: string } }) {
  try {
    const recipeId = Number(context.params.id);
    if (!Number.isInteger(recipeId) || recipeId <= 0) {
      return NextResponse.json({ ok: false, message: 'recipe id is invalid.' }, { status: 400 });
    }
    const body = (await request.json()) as Body;
    const stepText = typeof body.step_text === 'string' ? body.step_text.trim() : '';
    const orderIndex = Number(body.order_index ?? 0);
    if (!stepText || stepText.length > 400) {
      return NextResponse.json({ ok: false, message: 'step_text is required (<=400).' }, { status: 400 });
    }

    const [result] = await pool.execute<ResultSetHeader>(
      `INSERT INTO recipe_steps (recipe_id, step_text, order_index)
       VALUES (?, ?, ?)`,
      [recipeId, stepText, Number.isFinite(orderIndex) ? orderIndex : 0],
    );
    return NextResponse.json({ ok: true, insertedId: result.insertId });
  } catch {
    return NextResponse.json({ ok: false, message: 'Unable to add recipe step.' }, { status: 500 });
  }
}
