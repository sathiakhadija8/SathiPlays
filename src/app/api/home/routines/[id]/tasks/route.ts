import { NextResponse } from 'next/server';
import { type ResultSetHeader, type RowDataPacket } from 'mysql2';
import pool from '../../../../../../lib/db';

export const dynamic = 'force-dynamic';

type Body = {
  title?: unknown;
  order_index?: unknown;
  estimated_minutes?: unknown;
};

type CountRow = RowDataPacket & { total_count: number };
type ExistsRow = RowDataPacket & { id: number };

function parseId(idRaw: string) {
  const id = Number(idRaw);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export async function POST(request: Request, context: { params: { id: string } }) {
  try {
    const routineId = parseId(context.params.id);
    if (!routineId) return NextResponse.json({ ok: false, message: 'routine id is invalid.' }, { status: 400 });

    const body = (await request.json()) as Body;
    const title = typeof body.title === 'string' ? body.title.trim() : '';
    const estimatedMinutesRaw = Number(body.estimated_minutes ?? 0);

    if (!title || title.length > 220) {
      return NextResponse.json({ ok: false, message: 'title is required (<=220).' }, { status: 400 });
    }
    if (!Number.isFinite(estimatedMinutesRaw) || estimatedMinutesRaw < 0) {
      return NextResponse.json({ ok: false, message: 'estimated_minutes must be a non-negative number.' }, { status: 400 });
    }
    const estimatedMinutes = Math.floor(estimatedMinutesRaw);

    const [routineRows] = await pool.execute<ExistsRow[]>(
      `SELECT id FROM home_routines WHERE id = ? LIMIT 1`,
      [routineId],
    );
    if (routineRows.length === 0) {
      return NextResponse.json({ ok: false, message: 'Routine not found.' }, { status: 404 });
    }

    const orderIndexRaw = Number(body.order_index);
    if (body.order_index !== undefined && (!Number.isFinite(orderIndexRaw) || orderIndexRaw < 0)) {
      return NextResponse.json({ ok: false, message: 'order_index must be a non-negative number.' }, { status: 400 });
    }
    let orderIndex = Number.isFinite(orderIndexRaw) ? Math.floor(orderIndexRaw) : -1;
    if (orderIndex < 0) {
      const [rows] = await pool.execute<CountRow[]>(
        `SELECT COUNT(*) AS total_count FROM home_tasks WHERE routine_id = ?`,
        [routineId],
      );
      orderIndex = Number(rows[0]?.total_count ?? 0);
    }

    const [result] = await pool.execute<ResultSetHeader>(
      `INSERT INTO home_tasks (routine_id, title, order_index, estimated_minutes)
       VALUES (?, ?, ?, ?)`,
      [routineId, title, orderIndex, estimatedMinutes],
    );

    return NextResponse.json({ ok: true, insertedId: result.insertId });
  } catch {
    return NextResponse.json({ ok: false, message: 'Unable to create home task.' }, { status: 500 });
  }
}
