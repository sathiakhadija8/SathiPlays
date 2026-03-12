import { NextResponse } from 'next/server';
import { type ResultSetHeader, type RowDataPacket } from 'mysql2';
import pool from '../../../../../lib/db';
import { isClosetState } from '../../../../../lib/home-closet';

export const dynamic = 'force-dynamic';

type Body = {
  item_ids?: unknown;
  from_state?: unknown;
  to_state?: unknown;
};

function sanitizeIds(value: unknown) {
  if (!Array.isArray(value)) return [] as number[];
  return value
    .map((item) => Number(item))
    .filter((id) => Number.isInteger(id) && id > 0);
}

export async function POST(request: Request) {
  const connection = await pool.getConnection();
  try {
    const body = (await request.json()) as Body;
    const itemIds = sanitizeIds(body.item_ids);
    const fromState = isClosetState(body.from_state) ? body.from_state : null;
    const toState = isClosetState(body.to_state) ? body.to_state : null;

    if (!toState) {
      return NextResponse.json({ ok: false, message: 'to_state is invalid.' }, { status: 400 });
    }

    await connection.beginTransaction();
    let result: ResultSetHeader;
    let changedRows: Array<RowDataPacket & { id: number; state: string }> = [];

    if (itemIds.length > 0) {
      const placeholders = itemIds.map(() => '?').join(',');
      const [beforeRows] = await connection.execute<(RowDataPacket & { id: number; state: string })[]>(
        `SELECT id, state FROM closet_items WHERE id IN (${placeholders})`,
        itemIds,
      );
      changedRows = beforeRows.filter((row) => String(row.state) !== toState);
      const [updateResult] = await connection.execute<ResultSetHeader>(
        `UPDATE closet_items
         SET state = ?
         WHERE id IN (${placeholders})`,
        [toState, ...itemIds],
      );
      result = updateResult;
    } else if (fromState) {
      const [beforeRows] = await connection.execute<(RowDataPacket & { id: number; state: string })[]>(
        `SELECT id, state FROM closet_items WHERE state = ?`,
        [fromState],
      );
      changedRows = beforeRows.filter((row) => String(row.state) !== toState);
      const [updateResult] = await connection.execute<ResultSetHeader>(
        `UPDATE closet_items
         SET state = ?
         WHERE state = ?`,
        [toState, fromState],
      );
      result = updateResult;
    } else {
      return NextResponse.json({ ok: false, message: 'Provide item_ids or from_state.' }, { status: 400 });
    }

    if (changedRows.length > 0) {
      const valuesSql = changedRows.map(() => '(?, ?, ?, NOW(), ?)').join(',');
      const params: Array<number | string> = [];
      for (const row of changedRows) {
        params.push(Number(row.id), String(row.state), toState, 'Bulk closet state update');
      }
      await connection.execute(
        `INSERT INTO closet_item_logs (closet_item_id, from_state, to_state, changed_at, notes)
         VALUES ${valuesSql}`,
        params,
      );
    }

    await connection.commit();
    return NextResponse.json({ ok: true, affectedRows: result.affectedRows });
  } catch {
    await connection.rollback().catch(() => undefined);
    return NextResponse.json({ ok: false, message: 'Unable to bulk update closet states.' }, { status: 500 });
  } finally {
    connection.release();
  }
}
