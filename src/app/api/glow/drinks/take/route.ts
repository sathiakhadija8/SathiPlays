import { NextResponse } from 'next/server';
import { type ResultSetHeader } from 'mysql2';
import pool from '../../../../../lib/db';
import { ensureDrinksSchema, type DrinkCategory } from '../../../../../lib/glow-drinks';
import { addPointsSafe } from '../../../../../lib/points-helpers';

export const dynamic = 'force-dynamic';

type TakeBody = {
  log_id?: unknown;
  entry_type?: unknown;
  category?: unknown;
};

function normalizeCategory(value: unknown): DrinkCategory {
  if (value === 'beauty_drink') return 'beauty_drink';
  return 'seed_water';
}

export async function POST(request: Request) {
  try {
    await ensureDrinksSchema();
    const body = (await request.json().catch(() => ({}))) as TakeBody;
    const logId = Number(body.log_id);
    const category = normalizeCategory(body.entry_type ?? body.category);

    if (!Number.isInteger(logId) || logId <= 0) {
      return NextResponse.json({ ok: false, message: 'log_id is required.' }, { status: 400 });
    }

    const [result] = await pool.execute<ResultSetHeader>(
      category === 'seed_water'
        ? `UPDATE seed_water_logs SET completed = 1, completed_at = NOW() WHERE id = ? AND completed = 0`
        : `UPDATE beauty_drink_daily SET completed = 1, completed_at = NOW() WHERE id = ? AND completed = 0`,
      [logId],
    );

    const alreadyCompleted = result.affectedRows === 0;
    const pointsAwarded = alreadyCompleted ? 0 : 7;

    if (!alreadyCompleted) {
      await addPointsSafe({
        domain: 'drinks',
        sourceType: category === 'seed_water' ? 'seed_water_taken' : 'beauty_drink_taken',
        sourceId: logId,
        points: pointsAwarded,
        reason: category === 'seed_water' ? 'Seed water completed' : 'Beauty drink completed',
      });
    }

    return NextResponse.json({ ok: true, already_completed: alreadyCompleted, points_awarded: pointsAwarded });
  } catch {
    return NextResponse.json({ ok: false, message: 'Unable to save drink log.' }, { status: 500 });
  }
}
