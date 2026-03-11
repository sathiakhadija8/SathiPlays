import { NextResponse } from 'next/server';
import { type ResultSetHeader, type RowDataPacket } from 'mysql2';
import pool from '../../../../../lib/db';
import { nowSqlDateTime } from '../../../../../lib/food-helpers';

export const dynamic = 'force-dynamic';

type BatchRow = RowDataPacket & {
  id: number;
  cooked_at: string;
  expires_at: string;
  status: 'active' | 'finished' | 'expired';
  created_at: string;
};

type BatchRecipeRow = RowDataPacket & {
  id: number;
  batch_id: number;
  recipe_id: number;
  portions_cooked: number;
  portions_remaining: number;
  recipe_title: string;
};

export async function GET() {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const now = nowSqlDateTime();

    await connection.execute<ResultSetHeader>(
      `UPDATE cooked_batches cb
       JOIN cooked_batch_recipes cbr ON cbr.batch_id = cb.id
       SET cb.status = 'expired'
       WHERE cb.status = 'active'
         AND cb.expires_at < ?
         AND cbr.portions_remaining > 0`,
      [now],
    );

    const [batches] = await connection.execute<BatchRow[]>(
      `SELECT id, cooked_at, expires_at, status, created_at
       FROM cooked_batches
       WHERE status = 'active' AND expires_at >= ?
       ORDER BY cooked_at DESC`,
      [now],
    );

    const batchIds = batches.map((b) => b.id);
    let recipes: BatchRecipeRow[] = [];
    if (batchIds.length > 0) {
      const placeholders = batchIds.map(() => '?').join(', ');
      const [rows] = await connection.execute<BatchRecipeRow[]>(
        `SELECT cbr.id, cbr.batch_id, cbr.recipe_id, cbr.portions_cooked, cbr.portions_remaining, r.title AS recipe_title
         FROM cooked_batch_recipes cbr
         JOIN recipes r ON r.id = cbr.recipe_id
         WHERE cbr.batch_id IN (${placeholders})
         ORDER BY cbr.id ASC`,
        batchIds,
      );
      recipes = rows;
    }

    await connection.commit();

    const map = new Map<number, BatchRecipeRow[]>();
    for (const row of recipes) {
      const list = map.get(row.batch_id) ?? [];
      list.push(row);
      map.set(row.batch_id, list);
    }

    const payload = batches
      .map((batch) => ({
        ...batch,
        recipes: (map.get(batch.id) ?? []).filter((r) => r.portions_remaining > 0),
      }))
      .filter((batch) => batch.recipes.length > 0);

    return NextResponse.json(payload);
  } catch {
    await connection.rollback();
    return NextResponse.json({ ok: false, message: 'Unable to load active batches.' }, { status: 500 });
  } finally {
    connection.release();
  }
}
