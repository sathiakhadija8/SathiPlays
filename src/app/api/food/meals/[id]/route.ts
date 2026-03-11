import { NextResponse } from 'next/server';
import { type ResultSetHeader } from 'mysql2';
import pool from '../../../../../lib/db';

export const dynamic = 'force-dynamic';

export async function DELETE(_: Request, context: { params: { id: string } }) {
  try {
    const id = Number(context.params.id);
    if (!Number.isInteger(id) || id <= 0) return NextResponse.json({ ok: false, message: 'id is invalid.' }, { status: 400 });
    await pool.execute<ResultSetHeader>(`DELETE FROM meal_logs WHERE id = ?`, [id]);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false, message: 'Unable to delete meal log.' }, { status: 500 });
  }
}
