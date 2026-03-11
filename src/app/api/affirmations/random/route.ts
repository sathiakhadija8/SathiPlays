import { NextResponse } from 'next/server';
import { type RowDataPacket } from 'mysql2';
import pool from '../../../../lib/db';

export const dynamic = 'force-dynamic';

type AffirmationRow = RowDataPacket & {
  id: number;
  text: string;
  weight: number;
};

const fallback = { id: 0, text: "You're building quietly." };

function pickWeighted(rows: AffirmationRow[]) {
  const total = rows.reduce((sum, row) => sum + Math.max(1, row.weight), 0);
  let roll = Math.random() * total;

  for (const row of rows) {
    roll -= Math.max(1, row.weight);
    if (roll <= 0) {
      return { id: row.id, text: row.text };
    }
  }

  return { id: rows[0].id, text: rows[0].text };
}

export async function GET() {
  try {
    const [rows] = await pool.query<AffirmationRow[]>(
      'SELECT id, text, weight FROM affirmations WHERE is_active = 1',
    );

    if (!rows.length) {
      return NextResponse.json(
        { ...fallback, message: 'No active affirmations found.' },
        { status: 404 },
      );
    }

    return NextResponse.json(pickWeighted(rows));
  } catch {
    return NextResponse.json(
      { ...fallback, message: 'Unable to fetch affirmation right now.' },
      { status: 500 },
    );
  }
}
