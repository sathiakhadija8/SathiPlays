import { NextResponse } from 'next/server';
import { type ResultSetHeader, type RowDataPacket } from 'mysql2';
import pool from '../../../../../lib/db';
import { CAREER_DOMAIN, dailyPracticeGuardKey } from '../../../../../lib/career-constants';
import { todayYMD, toSqlDateTime, touchCareerGuardActivity } from '../../../../../lib/career-helpers';
import { ensureDailyPracticeIconColumns } from '../../../../../lib/career-schema';

export const dynamic = 'force-dynamic';

type Body = {
  item_id?: unknown;
  item_key?: unknown;
};

type ItemRow = RowDataPacket & {
  id: number;
  key_name: string | null;
  display_name: string | null;
};

type LogRow = RowDataPacket & {
  id: number;
};

export async function POST(request: Request) {
  const connection = await pool.getConnection();
  try {
    await ensureDailyPracticeIconColumns();
    const body = (await request.json().catch(() => ({}))) as Body;
    const date = todayYMD();
    const itemId = Number(body.item_id);
    const itemKey = typeof body.item_key === 'string' ? body.item_key.trim() : '';

    await connection.beginTransaction();

    let item: ItemRow | undefined;
    if (Number.isInteger(itemId) && itemId > 0) {
      const [rows] = await connection.execute<ItemRow[]>(
        `SELECT CAST(legacy_id AS SIGNED) AS id, key_name, subtitle AS display_name
         FROM sp_catalog_items
         WHERE domain_key = 'career'
           AND item_type = 'daily_practice_item'
           AND is_active = 1
           AND legacy_id = ?
         LIMIT 1`,
        [itemId],
      );
      item = rows[0];
    } else if (itemKey) {
      const [rows] = await connection.execute<ItemRow[]>(
        `SELECT CAST(legacy_id AS SIGNED) AS id, key_name, subtitle AS display_name
         FROM sp_catalog_items
         WHERE domain_key = 'career'
           AND item_type = 'daily_practice_item'
           AND key_name = ?
           AND is_active = 1
           AND legacy_id IS NOT NULL
         LIMIT 1`,
        [itemKey],
      );
      item = rows[0];
    }

    if (!item) {
      await connection.rollback();
      return NextResponse.json({ ok: false, message: 'Valid daily practice item is required.' }, { status: 400 });
    }

    const [existingRows] = await connection.execute<LogRow[]>(
      `SELECT id
       FROM daily_practice_logs
       WHERE item_id = ? AND log_date = ?
       LIMIT 1`,
      [item.id, date],
    );

    if (existingRows.length > 0) {
      const existingLog = existingRows[0];
      await connection.execute(
        `DELETE FROM daily_practice_logs
         WHERE id = ?`,
        [existingLog.id],
      );
      await connection.execute(
        `DELETE FROM points_logs
         WHERE domain = ?
           AND source_type = 'daily_practice'
           AND source_id = ?`,
        [CAREER_DOMAIN, existingLog.id],
      );

      await connection.commit();
      return NextResponse.json({
        ok: true,
        item_id: item.id,
        item_key: item.key_name ?? `item_${item.id}`,
        checked_in: false,
        points_awarded: 0,
      });
    }

    const [result] = await connection.execute<ResultSetHeader>(
      `INSERT INTO daily_practice_logs (item_id, log_date)
       VALUES (?, ?)`,
      [item.id, date],
    );

    await connection.execute(
      `INSERT INTO points_logs (domain, source_type, source_id, points, reason)
       VALUES (?, 'daily_practice', ?, 10, ?)`,
      [CAREER_DOMAIN, result.insertId, `${item.display_name ?? 'Daily Practice'} check-in`],
    );

    await touchCareerGuardActivity(connection, dailyPracticeGuardKey(item.id), toSqlDateTime(new Date()));

    await connection.commit();

    return NextResponse.json({
      ok: true,
      item_id: item.id,
      item_key: item.key_name ?? `item_${item.id}`,
      checked_in: true,
      points_awarded: 10,
    });
  } catch {
    await connection.rollback();
    return NextResponse.json({ ok: false, message: 'Unable to check in.' }, { status: 500 });
  } finally {
    connection.release();
  }
}
