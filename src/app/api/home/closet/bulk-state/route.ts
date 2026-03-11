import { NextResponse } from 'next/server';
import { type ResultSetHeader } from 'mysql2';
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
  try {
    const body = (await request.json()) as Body;
    const itemIds = sanitizeIds(body.item_ids);
    const fromState = isClosetState(body.from_state) ? body.from_state : null;
    const toState = isClosetState(body.to_state) ? body.to_state : null;

    if (!toState) {
      return NextResponse.json({ ok: false, message: 'to_state is invalid.' }, { status: 400 });
    }

    let result: ResultSetHeader;

    if (itemIds.length > 0) {
      const placeholders = itemIds.map(() => '?').join(',');
      const [updateResult] = await pool.execute<ResultSetHeader>(
        `UPDATE closet_items
         SET state = ?
         WHERE id IN (${placeholders})`,
        [toState, ...itemIds],
      );
      result = updateResult;
    } else if (fromState) {
      const [updateResult] = await pool.execute<ResultSetHeader>(
        `UPDATE closet_items
         SET state = ?
         WHERE state = ?`,
        [toState, fromState],
      );
      result = updateResult;
    } else {
      return NextResponse.json({ ok: false, message: 'Provide item_ids or from_state.' }, { status: 400 });
    }

    return NextResponse.json({ ok: true, affectedRows: result.affectedRows });
  } catch {
    return NextResponse.json({ ok: false, message: 'Unable to bulk update closet states.' }, { status: 500 });
  }
}
