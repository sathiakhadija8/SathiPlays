import { NextResponse } from 'next/server';
import { type ResultSetHeader, type RowDataPacket } from 'mysql2';
import pool from '../../../../lib/db';
import { isValidYmd, weekStartSunday } from '../../../../lib/food-helpers';

export const dynamic = 'force-dynamic';

type PlanRow = RowDataPacket & {
  id: number;
  week_start_date: string;
};

type PlanItemRow = RowDataPacket & {
  id: number;
  weekly_plan_id: number;
  plan_date: string;
  meal_slot: 'breakfast' | 'lunch' | 'dinner' | 'snack' | 'suhoor' | 'iftar';
  recipe_id: number;
  planned_portions: number;
  recipe_title: string;
};

type Body = {
  week_start_date?: unknown;
  items?: Array<{
    plan_date?: unknown;
    meal_slot?: unknown;
    recipe_id?: unknown;
    planned_portions?: unknown;
  }>;
};

function validMealSlot(value: unknown): value is 'breakfast' | 'lunch' | 'dinner' | 'snack' | 'suhoor' | 'iftar' {
  return value === 'breakfast' || value === 'lunch' || value === 'dinner' || value === 'snack' || value === 'suhoor' || value === 'iftar';
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const weekStartParam = searchParams.get('week_start');
    if (weekStartParam && !isValidYmd(weekStartParam)) {
      return NextResponse.json({ ok: false, message: 'week_start must be YYYY-MM-DD.' }, { status: 400 });
    }
    const weekStart = weekStartSunday(weekStartParam || undefined);

    const [plans] = await pool.execute<PlanRow[]>(
      `SELECT id, week_start_date
       FROM weekly_plan
       WHERE week_start_date = ?
       LIMIT 1`,
      [weekStart],
    );
    if (plans.length === 0) {
      return NextResponse.json({ week_start_date: weekStart, items: [] });
    }

    const [items] = await pool.execute<PlanItemRow[]>(
      `SELECT wpi.id, wpi.weekly_plan_id, wpi.plan_date, wpi.meal_slot, wpi.recipe_id, wpi.planned_portions,
              r.title AS recipe_title
       FROM weekly_plan_items wpi
       JOIN recipes r ON r.id = wpi.recipe_id
       WHERE wpi.weekly_plan_id = ?
       ORDER BY wpi.plan_date ASC, wpi.meal_slot ASC`,
      [plans[0].id],
    );

    return NextResponse.json({ week_start_date: weekStart, weekly_plan_id: plans[0].id, items });
  } catch {
    return NextResponse.json({ ok: false, message: 'Unable to load weekly plan.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const connection = await pool.getConnection();
  try {
    const body = (await request.json()) as Body;
    const weekStartInput = typeof body.week_start_date === 'string' ? body.week_start_date : undefined;
    if (weekStartInput && !isValidYmd(weekStartInput)) {
      await connection.rollback();
      return NextResponse.json({ ok: false, message: 'week_start_date must be YYYY-MM-DD.' }, { status: 400 });
    }
    const weekStart = weekStartSunday(weekStartInput);
    const items = Array.isArray(body.items) ? body.items : [];

    await connection.beginTransaction();

    const [planResult] = await connection.execute<ResultSetHeader>(
      `INSERT INTO weekly_plan (week_start_date)
       VALUES (?)
       ON DUPLICATE KEY UPDATE week_start_date = VALUES(week_start_date)`,
      [weekStart],
    );

    const weeklyPlanId =
      planResult.insertId ||
      Number(
        (
          await connection.execute<RowDataPacket[]>(
            `SELECT id FROM weekly_plan WHERE week_start_date = ? LIMIT 1`,
            [weekStart],
          )
        )[0][0]?.id ?? 0,
      );

    await connection.execute<ResultSetHeader>(`DELETE FROM weekly_plan_items WHERE weekly_plan_id = ?`, [weeklyPlanId]);

    for (const item of items) {
      const planDate = typeof item.plan_date === 'string' ? item.plan_date : '';
      const mealSlot = validMealSlot(item.meal_slot) ? item.meal_slot : null;
      const recipeId = Number(item.recipe_id);
      const plannedPortionsRaw = Number(item.planned_portions ?? 1);
      if (
        !planDate ||
        !isValidYmd(planDate) ||
        !mealSlot ||
        !Number.isInteger(recipeId) ||
        recipeId <= 0 ||
        !Number.isFinite(plannedPortionsRaw) ||
        plannedPortionsRaw <= 0
      ) {
        continue;
      }
      const plannedPortions = Math.max(1, Math.floor(plannedPortionsRaw));

      await connection.execute<ResultSetHeader>(
        `INSERT INTO weekly_plan_items (weekly_plan_id, plan_date, meal_slot, recipe_id, planned_portions)
         VALUES (?, ?, ?, ?, ?)`,
        [weeklyPlanId, planDate, mealSlot, recipeId, plannedPortions],
      );
    }

    await connection.commit();
    return NextResponse.json({ ok: true, weekly_plan_id: weeklyPlanId });
  } catch {
    await connection.rollback();
    return NextResponse.json({ ok: false, message: 'Unable to save weekly plan.' }, { status: 500 });
  } finally {
    connection.release();
  }
}
