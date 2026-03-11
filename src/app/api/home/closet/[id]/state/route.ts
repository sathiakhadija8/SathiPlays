import { NextResponse } from 'next/server';
import { type ResultSetHeader } from 'mysql2';
import pool from '../../../../../../lib/db';
import { isClosetState } from '../../../../../../lib/home-closet';

export const dynamic = 'force-dynamic';

type Body = { state?: unknown };

function parseId(idRaw: string) {
  const id = Number(idRaw);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export async function PATCH(request: Request, context: { params: { id: string } }) {
  try {
    const id = parseId(context.params.id);
    if (!id) return NextResponse.json({ ok: false, message: 'id is invalid.' }, { status: 400 });

    const body = (await request.json()) as Body;
    if (!isClosetState(body.state)) {
      return NextResponse.json({ ok: false, message: 'state is invalid.' }, { status: 400 });
    }

    const [result] = await pool.execute<ResultSetHeader>(
      `UPDATE closet_items
       SET state = ?
       WHERE id = ?`,
      [body.state, id],
    );

    if (result.affectedRows === 0) {
      return NextResponse.json({ ok: false, message: 'Item not found.' }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false, message: 'Unable to update closet item state.' }, { status: 500 });
  }
}
