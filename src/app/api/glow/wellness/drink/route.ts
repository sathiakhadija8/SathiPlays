import { NextResponse } from 'next/server';
import { type ResultSetHeader, type RowDataPacket } from 'mysql2';
import pool from '../../../../../lib/db';
import { localTodayYMD } from '../../../../../lib/glow-supplements';
import { addPointsOnceSafe } from '../../../../../lib/points-helpers';

export const dynamic = 'force-dynamic';

type DrinkType = 'seed_water' | 'herbal_tea' | 'ispaghula';
type Body = {
  drink_type?: unknown;
  completed?: unknown;
};

type ExistingDrinkRow = RowDataPacket & {
  completed: number;
};

const VALID_DRINKS = new Set<DrinkType>(['seed_water', 'herbal_tea', 'ispaghula']);

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Body;
    const drinkType = typeof body.drink_type === 'string' ? (body.drink_type.trim().toLowerCase() as DrinkType) : null;
    if (!drinkType || !VALID_DRINKS.has(drinkType)) {
      return NextResponse.json({ ok: false, message: 'Invalid drink_type.' }, { status: 400 });
    }
    const completed = body.completed === undefined ? true : Boolean(body.completed);
    const logDate = localTodayYMD();

    const [existingRows] = await pool.execute<ExistingDrinkRow[]>(
      `
      SELECT completed
      FROM drinks_logs
      WHERE log_date = ? AND drink_type = ?
      LIMIT 1
      `,
      [logDate, drinkType],
    );
    const wasCompleted = Number(existingRows[0]?.completed ?? 0) === 1;

    await pool.execute<ResultSetHeader>(
      `
      INSERT INTO drinks_logs (log_date, drink_type, completed)
      VALUES (?, ?, ?)
      ON DUPLICATE KEY UPDATE completed = VALUES(completed)
      `,
      [logDate, drinkType, completed ? 1 : 0],
    );

    const pointsAwarded = completed && !wasCompleted ? 4 : 0;
    if (pointsAwarded > 0) {
      const awarded = await addPointsOnceSafe({
        domain: 'wellness',
        sourceType: `wellness_drink_${drinkType}_${logDate}`,
        sourceId: null,
        points: pointsAwarded,
        reason: `Wellness drink completed: ${drinkType}`,
      });
      return NextResponse.json({ ok: true, points_awarded: awarded ? pointsAwarded : 0 });
    }

    return NextResponse.json({ ok: true, points_awarded: pointsAwarded });
  } catch {
    return NextResponse.json({ ok: false, message: 'Unable to save drink log.' }, { status: 500 });
  }
}
