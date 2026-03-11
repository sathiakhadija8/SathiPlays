import { NextResponse } from 'next/server';
import { type ResultSetHeader } from 'mysql2';
import pool from '../../../../../../lib/db';

export const dynamic = 'force-dynamic';

export async function PATCH(_: Request, context: { params: { id: string } }) {
  const connection = await pool.getConnection();
  try {
    const id = Number(context.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return NextResponse.json({ ok: false, message: 'id is invalid.' }, { status: 400 });
    }
    await connection.beginTransaction();
    await connection.execute<ResultSetHeader>(
      `UPDATE cooked_batches
       SET status = 'finished'
       WHERE id = ?`,
      [id],
    );
    await connection.execute<ResultSetHeader>(
      `UPDATE cooked_batch_recipes
       SET portions_remaining = 0
       WHERE batch_id = ?`,
      [id],
    );
    await connection.commit();
    return NextResponse.json({ ok: true });
  } catch {
    await connection.rollback();
    return NextResponse.json({ ok: false, message: 'Unable to finish batch.' }, { status: 500 });
  } finally {
    connection.release();
  }
}
