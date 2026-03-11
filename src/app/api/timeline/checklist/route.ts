import { NextResponse } from 'next/server';
import { type ResultSetHeader } from 'mysql2';
import pool from '../../../../lib/db';
import { nowSql } from '../../../../lib/timeline-helpers';

export const dynamic = 'force-dynamic';

type Body = {
  item_id?: unknown;
  is_done?: unknown;
};

export async function PATCH(request: Request) {
  try {
    const body = (await request.json()) as Body;
    const itemId = Number(body.item_id);
    const isDone = body.is_done === true;

    if (!Number.isInteger(itemId) || itemId <= 0) {
      return NextResponse.json({ ok: false, message: 'item_id is invalid.' }, { status: 400 });
    }

    const [result] = await pool.execute<ResultSetHeader>(
      `UPDATE timeline_checklist_items
       SET is_done = ?, done_at = ?
       WHERE id = ?`,
      [isDone ? 1 : 0, isDone ? nowSql() : null, itemId],
    );

    if (result.affectedRows === 0) {
      return NextResponse.json({ ok: false, message: 'Checklist item not found.' }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false, message: 'Unable to update checklist item.' }, { status: 500 });
  }
}
