import { NextResponse } from 'next/server';
import { type ResultSetHeader, type RowDataPacket } from 'mysql2';
import pool from '../../../../../lib/db';

export const dynamic = 'force-dynamic';

type TargetRow = RowDataPacket & {
  id: number;
  item_id: number;
  target_minutes: number;
  is_active: number;
  created_at: string;
};

type Body = {
  item_id?: unknown;
  target_minutes?: unknown;
};

export async function GET() {
  try {
    const [rows] = await pool.execute<TargetRow[]>(
      `SELECT id, item_id, target_minutes, is_active, created_at
       FROM daily_practice_item_targets
       WHERE is_active = 1
       ORDER BY created_at DESC`,
    );
    return NextResponse.json(rows);
  } catch {
    return NextResponse.json({ ok: false, message: 'Unable to load targets.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Body;
    const itemId = Number(body.item_id);
    const targetMinutes = Number(body.target_minutes);

    if (!Number.isInteger(itemId) || itemId <= 0) {
      return NextResponse.json({ ok: false, message: 'item_id is required.' }, { status: 400 });
    }
    if (!Number.isInteger(targetMinutes) || targetMinutes <= 0 || targetMinutes > 1440) {
      return NextResponse.json({ ok: false, message: 'target_minutes must be 1-1440.' }, { status: 400 });
    }

    await pool.execute<ResultSetHeader>(
      `INSERT INTO daily_practice_item_targets (item_id, target_minutes, is_active)
       VALUES (?, ?, 1)
       ON DUPLICATE KEY UPDATE target_minutes = VALUES(target_minutes), is_active = 1`,
      [itemId, targetMinutes],
    );

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false, message: 'Unable to save target.' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const itemId = Number(searchParams.get('item_id'));
    if (!Number.isInteger(itemId) || itemId <= 0) {
      return NextResponse.json({ ok: false, message: 'item_id is required.' }, { status: 400 });
    }

    await pool.execute(`DELETE FROM daily_practice_item_targets WHERE item_id = ?`, [itemId]);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false, message: 'Unable to delete target.' }, { status: 500 });
  }
}
