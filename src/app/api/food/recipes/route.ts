import { NextResponse } from 'next/server';
import { type ResultSetHeader, type RowDataPacket } from 'mysql2';
import pool from '../../../../lib/db';

export const dynamic = 'force-dynamic';

type RecipeRow = RowDataPacket & {
  id: number;
  title: string;
  description: string | null;
  image_path: string | null;
  pcos_tags: string | null;
  meal_tags: string | null;
  protein_g_per_portion: number;
  carbs_g_per_portion: number;
  fat_g_per_portion: number;
  created_at: string;
};

type Body = {
  title?: unknown;
  description?: unknown;
  image_path?: unknown;
  pcos_tags?: unknown;
  meal_tags?: unknown;
  protein_g_per_portion?: unknown;
  carbs_g_per_portion?: unknown;
  fat_g_per_portion?: unknown;
  steps?: unknown;
  ingredients?: unknown;
};

function asStringArray(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === 'string').map((v) => v.trim()).filter(Boolean);
}

type StepInput = { step_text: string; order_index: number };
type IngredientInput = { ingredient_name: string; qty_per_portion: number; unit: string };

function asSteps(value: unknown): StepInput[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item, index) => {
      if (!item || typeof item !== 'object') return null;
      const record = item as Record<string, unknown>;
      const stepText = typeof record.step_text === 'string' ? record.step_text.trim() : '';
      const orderIndex = Number(record.order_index ?? index);
      if (!stepText || stepText.length > 400) return null;
      return {
        step_text: stepText,
        order_index: Number.isFinite(orderIndex) ? orderIndex : index,
      };
    })
    .filter((v): v is StepInput => Boolean(v));
}

function asIngredients(value: unknown): IngredientInput[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const record = item as Record<string, unknown>;
      const ingredientName = typeof record.ingredient_name === 'string' ? record.ingredient_name.trim() : '';
      const qty = Number(record.qty_per_portion ?? 0);
      const unit = typeof record.unit === 'string' ? record.unit.trim() : '';
      if (!ingredientName || ingredientName.length > 160) return null;
      if (!unit || unit.length > 30) return null;
      if (!Number.isFinite(qty) || qty <= 0) return null;
      return {
        ingredient_name: ingredientName,
        qty_per_portion: qty,
        unit,
      };
    })
    .filter((v): v is IngredientInput => Boolean(v));
}

export async function GET() {
  try {
    const [rows] = await pool.execute<RecipeRow[]>(
      `SELECT id, title, description, image_path, pcos_tags, meal_tags, protein_g_per_portion, carbs_g_per_portion, fat_g_per_portion, created_at
       FROM recipes
       ORDER BY created_at DESC`,
    );
    return NextResponse.json(rows);
  } catch {
    return NextResponse.json({ ok: false, message: 'Unable to load recipes.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const connection = await pool.getConnection();
  try {
    const body = (await request.json()) as Body;
    const title = typeof body.title === 'string' ? body.title.trim() : '';
    const description = typeof body.description === 'string' ? body.description.trim() : '';
    const imagePath = typeof body.image_path === 'string' ? body.image_path.trim() : '';
    const pcosTags = asStringArray(body.pcos_tags);
    const mealTags = asStringArray(body.meal_tags);
    const protein = Number(body.protein_g_per_portion ?? 0);
    const carbs = Number(body.carbs_g_per_portion ?? 0);
    const fat = Number(body.fat_g_per_portion ?? 0);
    const steps = asSteps(body.steps);
    const ingredients = asIngredients(body.ingredients);

    if (!title || title.length > 160) {
      return NextResponse.json({ ok: false, message: 'title is required (<=160).' }, { status: 400 });
    }

    await connection.beginTransaction();

    const [result] = await connection.execute<ResultSetHeader>(
      `INSERT INTO recipes (title, description, image_path, pcos_tags, meal_tags, protein_g_per_portion, carbs_g_per_portion, fat_g_per_portion)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [title, description || null, imagePath || null, JSON.stringify(pcosTags), JSON.stringify(mealTags), protein || 0, carbs || 0, fat || 0],
    );

    for (const step of steps) {
      await connection.execute<ResultSetHeader>(
        `INSERT INTO recipe_steps (recipe_id, step_text, order_index)
         VALUES (?, ?, ?)`,
        [result.insertId, step.step_text, step.order_index],
      );
    }

    for (const ingredient of ingredients) {
      await connection.execute<ResultSetHeader>(
        `INSERT INTO recipe_ingredients (recipe_id, ingredient_name, qty_per_portion, unit)
         VALUES (?, ?, ?, ?)`,
        [result.insertId, ingredient.ingredient_name, ingredient.qty_per_portion, ingredient.unit],
      );
    }

    await connection.commit();
    return NextResponse.json({ ok: true, insertedId: result.insertId });
  } catch {
    await connection.rollback();
    return NextResponse.json({ ok: false, message: 'Unable to create recipe.' }, { status: 500 });
  } finally {
    connection.release();
  }
}
