import { NextResponse } from 'next/server';
import { type RowDataPacket } from 'mysql2';
import pool from '../../../../../lib/db';
import { localTodayYMD } from '../../../../../lib/glow-supplements';

export const dynamic = 'force-dynamic';

type NumberRow = RowDataPacket & { value: number | null };
type DrinkRow = RowDataPacket & { drink_type: 'seed_water' | 'herbal_tea' | 'ispaghula'; completed: number };

export async function GET() {
  try {
    const today = localTodayYMD();

    const [waterRes, stepsRes, drinksRes] = await Promise.all([
      pool.execute<NumberRow[]>(
        `SELECT COALESCE(SUM(amount_ml), 0) AS value FROM water_logs WHERE log_date = ?`,
        [today],
      ),
      pool.execute<NumberRow[]>(
        `SELECT COALESCE(SUM(steps), 0) AS value FROM steps_logs WHERE log_date = ?`,
        [today],
      ),
      pool.execute<DrinkRow[]>(
        `SELECT drink_type, completed FROM drinks_logs WHERE log_date = ?`,
        [today],
      ),
    ]);
    const waterRows = waterRes[0];
    const stepsRows = stepsRes[0];
    const drinkRows = drinksRes[0];

    const drinks = {
      seed_water: false,
      herbal_tea: false,
      ispaghula: false,
    };
    for (const row of drinkRows) {
      drinks[row.drink_type] = Boolean(row.completed);
    }

    return NextResponse.json({
      date: today,
      water_ml: Number(waterRows[0]?.value ?? 0),
      steps_total: Number(stepsRows[0]?.value ?? 0),
      drinks,
    });
  } catch {
    return NextResponse.json({ ok: false, message: 'Unable to load wellness summary.' }, { status: 500 });
  }
}
