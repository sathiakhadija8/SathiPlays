import { NextResponse } from 'next/server';
import { type ResultSetHeader, type RowDataPacket } from 'mysql2';
import pool from '../../../../lib/db';
import { computeFastingStatus, nowSqlDateTime, ymd } from '../../../../lib/food-helpers';

export const dynamic = 'force-dynamic';

type BatchRow = RowDataPacket & {
  id: number;
  cooked_at: string;
  expires_at: string;
  status: 'active' | 'finished' | 'expired';
};

type BatchRecipeRow = RowDataPacket & {
  id: number;
  batch_id: number;
  recipe_id: number;
  portions_cooked: number;
  portions_remaining: number;
  recipe_title: string;
};

type MealRow = RowDataPacket & {
  id: number;
  logged_at: string;
  log_type: 'cooked' | 'cheat';
  batch_id: number | null;
  batch_recipe_id: number | null;
  portions: number | null;
  cheat_title: string | null;
  cheat_notes: string | null;
  cheat_protein_g: number | null;
  cheat_carbs_g: number | null;
  cheat_fat_g: number | null;
  recipe_title: string | null;
};

type GroceryRow = RowDataPacket & {
  id: number;
  item_name: string;
  quantity: number | null;
  unit: string | null;
  category: string | null;
  status: 'pending' | 'bought';
  created_at: string;
};

type InventoryRow = RowDataPacket & {
  id: number;
  ingredient_name: string;
  quantity: number;
  unit: string;
  location: 'pantry' | 'fridge' | 'freezer';
  low_stock_threshold: number;
};

type MacroDayRow = RowDataPacket & {
  day: string;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
};

type PlannedUpcomingRow = RowDataPacket & {
  id: number;
  plan_date: string;
  meal_slot: 'breakfast' | 'lunch' | 'dinner' | 'snack' | 'suhoor' | 'iftar';
  recipe_id: number;
  planned_portions: number;
  recipe_title: string;
};

export async function GET() {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const now = nowSqlDateTime();
    const today = ymd();

    await connection.execute<ResultSetHeader>(
      `UPDATE cooked_batches cb
       JOIN cooked_batch_recipes cbr ON cbr.batch_id = cb.id
       SET cb.status = 'expired'
       WHERE cb.status = 'active'
         AND cb.expires_at < ?
         AND cbr.portions_remaining > 0`,
      [now],
    );

    const [plans] = await connection.execute<RowDataPacket[]>(
      `SELECT id, name, type, start_time, end_time, is_active
       FROM fasting_plans
       WHERE is_active = 1
       ORDER BY id DESC
       LIMIT 1`,
    );
    const [sessions] = await connection.execute<RowDataPacket[]>(
      `SELECT id, plan_id, fast_type, window_start_time, window_end_time, started_at, ended_at
       FROM fasting_sessions
       ORDER BY started_at DESC
       LIMIT 1`,
    );
    const fastingStatus = computeFastingStatus((plans[0] as never) ?? null, (sessions[0] as never) ?? null);

    const [batches] = await connection.execute<BatchRow[]>(
      `SELECT id, cooked_at, expires_at, status
       FROM cooked_batches
       WHERE status = 'active' AND expires_at >= ?
       ORDER BY cooked_at DESC`,
      [now],
    );

    const batchIds = batches.map((b) => b.id);
    let batchRecipes: BatchRecipeRow[] = [];
    if (batchIds.length > 0) {
      const placeholders = batchIds.map(() => '?').join(', ');
      const [rows] = await connection.execute<BatchRecipeRow[]>(
        `SELECT cbr.id, cbr.batch_id, cbr.recipe_id, cbr.portions_cooked, cbr.portions_remaining, r.title AS recipe_title
         FROM cooked_batch_recipes cbr
         JOIN recipes r ON r.id = cbr.recipe_id
         WHERE cbr.batch_id IN (${placeholders})
         ORDER BY cbr.id ASC`,
        batchIds,
      );
      batchRecipes = rows;
    }

    const [todayMeals] = await connection.execute<MealRow[]>(
      `SELECT ml.id, ml.logged_at, ml.log_type, ml.batch_id, ml.batch_recipe_id, ml.portions,
              ml.cheat_title, ml.cheat_notes, ml.cheat_protein_g, ml.cheat_carbs_g, ml.cheat_fat_g,
              r.title AS recipe_title
       FROM meal_logs ml
       LEFT JOIN cooked_batch_recipes cbr ON cbr.id = ml.batch_recipe_id
       LEFT JOIN recipes r ON r.id = cbr.recipe_id
       WHERE DATE(ml.logged_at) = ?
       ORDER BY ml.logged_at DESC`,
      [today],
    );

    const [groceryPending] = await connection.execute<GroceryRow[]>(
      `SELECT id, item_name, quantity, unit, category, status, created_at
       FROM grocery_items
       WHERE status = 'pending'
       ORDER BY created_at DESC`,
    );

    const [lowStock] = await connection.execute<InventoryRow[]>(
      `SELECT id, ingredient_name, quantity, unit, location, low_stock_threshold
       FROM inventory_items
       WHERE quantity <= low_stock_threshold
       ORDER BY ingredient_name ASC`,
    );

    const [macro7d] = await connection.execute<MacroDayRow[]>(
      `SELECT DATE(ml.logged_at) AS day,
              COALESCE(SUM(
                CASE
                  WHEN ml.log_type = 'cooked'
                    THEN COALESCE(r.protein_g_per_portion, 0) * COALESCE(ml.portions, 0)
                  ELSE COALESCE(ml.cheat_protein_g, 0)
                END
              ), 0) AS protein_g,
              COALESCE(SUM(
                CASE
                  WHEN ml.log_type = 'cooked'
                    THEN COALESCE(r.carbs_g_per_portion, 0) * COALESCE(ml.portions, 0)
                  ELSE COALESCE(ml.cheat_carbs_g, 0)
                END
              ), 0) AS carbs_g,
              COALESCE(SUM(
                CASE
                  WHEN ml.log_type = 'cooked'
                    THEN COALESCE(r.fat_g_per_portion, 0) * COALESCE(ml.portions, 0)
                  ELSE COALESCE(ml.cheat_fat_g, 0)
                END
              ), 0) AS fat_g
       FROM meal_logs ml
       LEFT JOIN cooked_batch_recipes cbr ON cbr.id = ml.batch_recipe_id
       LEFT JOIN recipes r ON r.id = cbr.recipe_id
       WHERE ml.logged_at >= DATE_SUB(CURDATE(), INTERVAL 6 DAY)
       GROUP BY DATE(ml.logged_at)
       ORDER BY day ASC`,
    );

    const [pcosRows] = await connection.execute<RowDataPacket[]>(
      `SELECT COUNT(*) AS aligned_count
       FROM meal_logs ml
       JOIN cooked_batch_recipes cbr ON cbr.id = ml.batch_recipe_id
       JOIN recipes r ON r.id = cbr.recipe_id
       WHERE DATE(ml.logged_at) = ?
         AND ml.log_type = 'cooked'
         AND (
           JSON_CONTAINS(r.pcos_tags, JSON_QUOTE('high_protein')) OR
           JSON_CONTAINS(r.pcos_tags, JSON_QUOTE('low_carb'))
         )`,
      [today],
    );

    const [plannedUpcoming] = await connection.execute<PlannedUpcomingRow[]>(
      `SELECT wpi.id, wpi.plan_date, wpi.meal_slot, wpi.recipe_id, wpi.planned_portions, r.title AS recipe_title
       FROM weekly_plan_items wpi
       JOIN recipes r ON r.id = wpi.recipe_id
       WHERE wpi.plan_date >= CURDATE()
       ORDER BY wpi.plan_date ASC, wpi.meal_slot ASC
       LIMIT 80`,
    );

    await connection.commit();

    const batchMap = new Map<number, BatchRecipeRow[]>();
    for (const r of batchRecipes) {
      const list = batchMap.get(r.batch_id) ?? [];
      list.push(r);
      batchMap.set(r.batch_id, list);
    }
    const activeBatches = batches
      .map((b) => ({ ...b, recipes: (batchMap.get(b.id) ?? []).filter((r) => r.portions_remaining > 0) }))
      .filter((b) => b.recipes.length > 0);

    const todayMacroSource = macro7d.find((row) => String(row.day) === today);
    const todayTotals = {
      protein_g: Number(todayMacroSource?.protein_g ?? 0),
      carbs_g: Number(todayMacroSource?.carbs_g ?? 0),
      fat_g: Number(todayMacroSource?.fat_g ?? 0),
    };

    return NextResponse.json({
      fasting_status: fastingStatus,
      today_meals: todayMeals,
      active_batches: activeBatches,
      planned_upcoming: plannedUpcoming,
      grocery_pending: groceryPending,
      low_stock_items: lowStock,
      today_macro_totals: todayTotals,
      macros_7d: macro7d,
      pcos_aligned_count: Number(pcosRows[0]?.aligned_count ?? 0),
    });
  } catch (error) {
    await connection.rollback();
    console.error('food summary error', error);
    return NextResponse.json({ ok: false, message: 'Unable to load food summary.' }, { status: 500 });
  } finally {
    connection.release();
  }
}
