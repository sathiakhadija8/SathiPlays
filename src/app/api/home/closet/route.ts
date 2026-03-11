import { NextResponse } from 'next/server';
import { type RowDataPacket } from 'mysql2';
import pool from '../../../../lib/db';
import { CLOSET_STATES, type ClosetState } from '../../../../lib/home-closet';

export const dynamic = 'force-dynamic';

type ClosetItemRow = RowDataPacket & {
  id: number;
  name: string;
  size: string | null;
  category: string | null;
  image_path: string | null;
  state: ClosetState;
  updated_at: string;
};

type ClosetCountRow = RowDataPacket & {
  state: ClosetState;
  total_count: number;
};

export async function GET() {
  try {
    const [items] = await pool.execute<ClosetItemRow[]>(
      `SELECT id, name, size, category, image_path, state, updated_at
       FROM closet_items
       ORDER BY updated_at DESC, id DESC`,
    );

    const [countsRows] = await pool.execute<ClosetCountRow[]>(
      `SELECT state, COUNT(*) AS total_count
       FROM closet_items
       GROUP BY state`,
    );

    const counts = CLOSET_STATES.reduce<Record<ClosetState, number>>((acc, state) => {
      acc[state] = 0;
      return acc;
    }, {} as Record<ClosetState, number>);

    for (const row of countsRows) {
      counts[row.state] = Number(row.total_count ?? 0);
    }

    return NextResponse.json({ items, counts });
  } catch {
    return NextResponse.json({ ok: false, message: 'Unable to load closet data.' }, { status: 500 });
  }
}
