import { NextResponse } from 'next/server';
import { type ResultSetHeader } from 'mysql2';
import pool from '../../../lib/db';
import { addPointsSafe } from '../../../lib/points-helpers';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { mood_value?: unknown; note?: unknown };
    const moodValue = body.mood_value;
    const note = typeof body.note === 'string' ? body.note.trim() : null;

    if (typeof moodValue !== 'number' || !Number.isInteger(moodValue) || moodValue < 0 || moodValue > 100) {
      return NextResponse.json(
        { ok: false, message: 'mood_value must be an integer between 0 and 100.' },
        { status: 400 },
      );
    }

    const [result] = await pool.execute<ResultSetHeader>(
      'INSERT INTO mood_logs (mood_value, note) VALUES (?, ?)',
      [moodValue, note && note.length ? note : null],
    );

    const pointsAwarded = note && note.length > 0 ? 5 : 4;
    await addPointsSafe({
      domain: 'mood',
      sourceType: 'mood_log',
      sourceId: result.insertId || null,
      points: pointsAwarded,
      reason: 'Mood check-in logged',
    });

    return NextResponse.json({ ok: true, insertedId: result.insertId, points_awarded: pointsAwarded });
  } catch {
    return NextResponse.json(
      { ok: false, message: 'Unable to save mood right now.' },
      { status: 500 },
    );
  }
}
