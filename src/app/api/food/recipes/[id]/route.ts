import { NextResponse } from 'next/server';
import { type ResultSetHeader, type RowDataPacket } from 'mysql2';
import pool from '../../../../../lib/db';

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

type StepRow = RowDataPacket & {
  id: number;
  recipe_id: number;
  step_text: string;
  order_index: number;
};

type IngredientRow = RowDataPacket & {
  id: number;
  recipe_id: number;
  ingredient_name: string;
  qty_per_portion: number;
  unit: string;
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

function asSteps(value: unknown): StepInput[] | null {
  if (value === undefined) return null;
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

function asIngredients(value: unknown): IngredientInput[] | null {
  if (value === undefined) return null;
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

function parseId(idRaw: string) {
  const id = Number(idRaw);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export async function GET(_: Request, context: { params: { id: string } }) {
  try {
    const id = parseId(context.params.id);
    if (!id) return NextResponse.json({ ok: false, message: 'id is invalid.' }, { status: 400 });

    const [recipes] = await pool.execute<RecipeRow[]>(
      `SELECT id, title, description, image_path, pcos_tags, meal_tags, protein_g_per_portion, carbs_g_per_portion, fat_g_per_portion, created_at
       FROM recipes
       WHERE id = ?
       LIMIT 1`,
      [id],
    );
    if (recipes.length === 0) return NextResponse.json({ ok: false, message: 'Recipe not found.' }, { status: 404 });

    const [steps] = await pool.execute<StepRow[]>(
      `SELECT id, recipe_id, step_text, order_index
       FROM recipe_steps
       WHERE recipe_id = ?
       ORDER BY order_index ASC, id ASC`,
      [id],
    );

    const [ingredients] = await pool.execute<IngredientRow[]>(
      `SELECT id, recipe_id, ingredient_name, qty_per_portion, unit
       FROM recipe_ingredients
       WHERE recipe_id = ?
       ORDER BY id ASC`,
      [id],
    );

    return NextResponse.json({ ...recipes[0], steps, ingredients });
  } catch {
    return NextResponse.json({ ok: false, message: 'Unable to load recipe.' }, { status: 500 });
  }
}

export async function PATCH(request: Request, context: { params: { id: string } }) {
  const connection = await pool.getConnection();
  try {
    const id = parseId(context.params.id);
    if (!id) return NextResponse.json({ ok: false, message: 'id is invalid.' }, { status: 400 });

    const body = (await request.json()) as Body;
    const title = typeof body.title === 'string' ? body.title.trim() : null;
    const description = typeof body.description === 'string' ? body.description.trim() : null;
    const imagePath = typeof body.image_path === 'string' ? body.image_path.trim() : null;
    const pcosTags = body.pcos_tags === undefined ? null : JSON.stringify(asStringArray(body.pcos_tags));
    const mealTags = body.meal_tags === undefined ? null : JSON.stringify(asStringArray(body.meal_tags));
    const protein = body.protein_g_per_portion === undefined ? null : Number(body.protein_g_per_portion);
    const carbs = body.carbs_g_per_portion === undefined ? null : Number(body.carbs_g_per_portion);
    const fat = body.fat_g_per_portion === undefined ? null : Number(body.fat_g_per_portion);
    const steps = asSteps(body.steps);
    const ingredients = asIngredients(body.ingredients);

    await connection.beginTransaction();

    await connection.execute<ResultSetHeader>(
      `UPDATE recipes
       SET title = COALESCE(?, title),
           description = COALESCE(?, description),
           image_path = COALESCE(?, image_path),
           pcos_tags = COALESCE(?, pcos_tags),
           meal_tags = COALESCE(?, meal_tags),
           protein_g_per_portion = COALESCE(?, protein_g_per_portion),
           carbs_g_per_portion = COALESCE(?, carbs_g_per_portion),
           fat_g_per_portion = COALESCE(?, fat_g_per_portion)
       WHERE id = ?`,
      [title, description, imagePath, pcosTags, mealTags, protein, carbs, fat, id],
    );

    if (steps !== null) {
      await connection.execute<ResultSetHeader>(`DELETE FROM recipe_steps WHERE recipe_id = ?`, [id]);
      for (const step of steps) {
        await connection.execute<ResultSetHeader>(
          `INSERT INTO recipe_steps (recipe_id, step_text, order_index)
           VALUES (?, ?, ?)`,
          [id, step.step_text, step.order_index],
        );
      }
    }

    if (ingredients !== null) {
      await connection.execute<ResultSetHeader>(`DELETE FROM recipe_ingredients WHERE recipe_id = ?`, [id]);
      for (const ingredient of ingredients) {
        await connection.execute<ResultSetHeader>(
          `INSERT INTO recipe_ingredients (recipe_id, ingredient_name, qty_per_portion, unit)
           VALUES (?, ?, ?, ?)`,
          [id, ingredient.ingredient_name, ingredient.qty_per_portion, ingredient.unit],
        );
      }
    }

    await connection.commit();
    return NextResponse.json({ ok: true });
  } catch {
    await connection.rollback();
    return NextResponse.json({ ok: false, message: 'Unable to update recipe.' }, { status: 500 });
  } finally {
    connection.release();
  }
}

export async function DELETE(_: Request, context: { params: { id: string } }) {
  try {
    const id = parseId(context.params.id);
    if (!id) return NextResponse.json({ ok: false, message: 'id is invalid.' }, { status: 400 });
    await pool.execute<ResultSetHeader>(`DELETE FROM recipes WHERE id = ?`, [id]);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false, message: 'Unable to delete recipe.' }, { status: 500 });
  }
}
