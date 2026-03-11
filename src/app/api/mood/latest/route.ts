import { NextResponse } from 'next/server';
import { type RowDataPacket } from 'mysql2';
import pool from '../../../../lib/db';

export const dynamic = 'force-dynamic';

type LatestMoodRow = RowDataPacket & {
  id: number;
  mood_value: number;
  created_at: string;
};

export async function GET() {
  try {
    const [rows] = await pool.query<LatestMoodRow[]>(
      'SELECT id, mood_value, created_at FROM mood_logs ORDER BY created_at DESC, id DESC LIMIT 1',
    );

    return NextResponse.json(rows[0] ?? null);
  } catch {
    return NextResponse.json({ message: 'Unable to fetch latest mood.' }, { status: 500 });
  }
}
