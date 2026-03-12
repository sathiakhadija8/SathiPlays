import { NextResponse } from 'next/server';
import { type ResultSetHeader, type RowDataPacket } from 'mysql2';
import pool from '../../../../../../lib/db';
import { isClosetState } from '../../../../../../lib/home-closet';

export const dynamic = 'force-dynamic';

type Body = { state?: unknown; notes?: unknown };
type StateRow = RowDataPacket & { state: string };

function parseId(idRaw: string) {
  const id = Number(idRaw);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export async function PATCH(request: Request, context: { params: { id: string } }) {
  const connection = await pool.getConnection();
  try {
    const id = parseId(context.params.id);
    if (!id) return NextResponse.json({ ok: false, message: 'id is invalid.' }, { status: 400 });

    const body = (await request.json()) as Body;
    if (!isClosetState(body.state)) {
      return NextResponse.json({ ok: false, message: 'state is invalid.' }, { status: 400 });
    }
    const notes = typeof body.notes === 'string' ? body.notes.trim().slice(0, 255) : null;

    await connection.beginTransaction();

    const [rows] = await connection.execute<StateRow[]>(`SELECT state FROM closet_items WHERE id = ? LIMIT 1`, [id]);
    const current = rows[0];
    if (!current) {
      await connection.rollback();
      return NextResponse.json({ ok: false, message: 'Item not found.' }, { status: 404 });
    }

    const fromState = String(current.state);
    if (fromState === body.state) {
      await connection.rollback();
      return NextResponse.json({ ok: true, unchanged: true });
    }

    const [result] = await connection.execute<ResultSetHeader>(
      `UPDATE closet_items
       SET state = ?
       WHERE id = ?`,
      [body.state, id],
    );

    if (result.affectedRows === 0) {
      await connection.rollback();
      return NextResponse.json({ ok: false, message: 'Item not found.' }, { status: 404 });
    }

    await connection.execute(
      `INSERT INTO closet_item_logs (closet_item_id, from_state, to_state, changed_at, notes)
       VALUES (?, ?, ?, NOW(), ?)`,
      [id, fromState, body.state, notes],
    );

    await connection.commit();
    return NextResponse.json({ ok: true });
  } catch {
    await connection.rollback().catch(() => undefined);
    return NextResponse.json({ ok: false, message: 'Unable to update closet item state.' }, { status: 500 });
  } finally {
    connection.release();
  }
}
