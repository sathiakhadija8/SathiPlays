import { NextResponse } from 'next/server';
import { type ResultSetHeader } from 'mysql2';
import pool from '../../../../../lib/db';

export const dynamic = 'force-dynamic';

type Body = {
  title?: unknown;
  order_index?: unknown;
  estimated_minutes?: unknown;
};

function parseId(idRaw: string) {
  const id = Number(idRaw);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export async function PATCH(request: Request, context: { params: { id: string } }) {
  try {
    const id = parseId(context.params.id);
    if (!id) return NextResponse.json({ ok: false, message: 'id is invalid.' }, { status: 400 });

    const body = (await request.json()) as Body;
    const title = typeof body.title === 'string' ? body.title.trim() : null;
    const orderIndex = body.order_index === undefined ? null : Number(body.order_index);
    const estimatedMinutes = body.estimated_minutes === undefined ? null : Number(body.estimated_minutes);

    if (title !== null && (!title || title.length > 220)) {
      return NextResponse.json({ ok: false, message: 'title must be <=220.' }, { status: 400 });
    }
    if (orderIndex !== null && (!Number.isFinite(orderIndex) || orderIndex < 0)) {
      return NextResponse.json({ ok: false, message: 'order_index must be a non-negative number.' }, { status: 400 });
    }
    if (estimatedMinutes !== null && (!Number.isFinite(estimatedMinutes) || estimatedMinutes < 0)) {
      return NextResponse.json({ ok: false, message: 'estimated_minutes must be a non-negative number.' }, { status: 400 });
    }

    const [result] = await pool.execute<ResultSetHeader>(
      `UPDATE home_tasks
       SET title = COALESCE(?, title),
           order_index = COALESCE(?, order_index),
           estimated_minutes = COALESCE(?, estimated_minutes)
       WHERE id = ?`,
      [title, orderIndex === null ? null : Math.floor(orderIndex), estimatedMinutes === null ? null : Math.floor(estimatedMinutes), id],
    );

    if (result.affectedRows === 0) {
      return NextResponse.json({ ok: false, message: 'Task not found.' }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false, message: 'Unable to update task.' }, { status: 500 });
  }
}

export async function DELETE(_: Request, context: { params: { id: string } }) {
  try {
    const id = parseId(context.params.id);
    if (!id) return NextResponse.json({ ok: false, message: 'id is invalid.' }, { status: 400 });

    const [result] = await pool.execute<ResultSetHeader>(`DELETE FROM home_tasks WHERE id = ?`, [id]);
    if (result.affectedRows === 0) {
      return NextResponse.json({ ok: false, message: 'Task not found.' }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false, message: 'Unable to delete task.' }, { status: 500 });
  }
}
