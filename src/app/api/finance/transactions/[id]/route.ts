import { NextResponse } from 'next/server';
import { type ResultSetHeader } from 'mysql2';
import pool from '../../../../../lib/db';
import { ensureFinanceTables, getDemoUserId } from '../../../../../lib/finance-server';

export const dynamic = 'force-dynamic';

export async function DELETE(_request: Request, context: { params: { id: string } }) {
  try {
    await ensureFinanceTables();
    const id = Number(context.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return NextResponse.json({ message: 'Invalid transaction id.' }, { status: 400 });
    }

    const [result] = await pool.execute<ResultSetHeader>(
      `DELETE FROM finance_transactions WHERE id = ? AND user_id = ?`,
      [id, getDemoUserId()],
    );

    return NextResponse.json({ deleted: result.affectedRows > 0 });
  } catch {
    return NextResponse.json({ message: 'Unable to delete transaction.' }, { status: 500 });
  }
}
