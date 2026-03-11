import { NextResponse } from 'next/server';
import { type RowDataPacket } from 'mysql2';
import pool from '../../../../lib/db';
import { DEEN_ITEMS, ensureDeenTables, isValidYmd, todayYmd } from '../../../../lib/deen-server';
import { addPointsOnceSafe } from '../../../../lib/points-helpers';

export const dynamic = 'force-dynamic';

type Body = {
  date?: string;
  item_key?: string;
  done?: boolean;
};

type ExistingCheckRow = RowDataPacket & {
  is_done: number;
};

export async function POST(request: Request) {
  try {
    await ensureDeenTables();

    const body = (await request.json().catch(() => ({}))) as Body;
    const date = isValidYmd((body.date ?? '').trim()) ? (body.date as string) : todayYmd();
    const itemKey = (body.item_key ?? '').trim();
    const done = Boolean(body.done);

    if (!DEEN_ITEMS.some((item) => item.key === itemKey)) {
      return NextResponse.json({ message: 'Invalid item_key.' }, { status: 400 });
    }

    const [existingRows] = await pool.execute<ExistingCheckRow[]>(
      `
      SELECT is_done
      FROM deen_daily_checks
      WHERE log_date = ? AND item_key = ?
      LIMIT 1
      `,
      [date, itemKey],
    );
    const previousDone = Number(existingRows[0]?.is_done ?? 0) === 1;

    await pool.execute(
      `
      INSERT INTO deen_daily_checks (log_date, item_key, is_done)
      VALUES (?, ?, ?)
      ON DUPLICATE KEY UPDATE is_done = VALUES(is_done)
      `,
      [date, itemKey, done ? 1 : 0],
    );

    const pointsAwarded = done && !previousDone ? 6 : 0;
    if (pointsAwarded > 0) {
      const awarded = await addPointsOnceSafe({
        domain: 'deen',
        sourceType: `daily_check_${itemKey}_${date}`,
        sourceId: null,
        points: pointsAwarded,
        reason: `Deen checklist done: ${itemKey}`,
      });
      return NextResponse.json({ ok: true, date, item_key: itemKey, done, points_awarded: awarded ? pointsAwarded : 0 });
    }

    return NextResponse.json({ ok: true, date, item_key: itemKey, done, points_awarded: pointsAwarded });
  } catch {
    return NextResponse.json({ message: 'Unable to update Deen check.' }, { status: 500 });
  }
}
