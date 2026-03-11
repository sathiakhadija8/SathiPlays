import { NextResponse } from 'next/server';
import { type ResultSetHeader } from 'mysql2';
import pool from '../../../../../lib/db';
import {
  ensureGlowActionRowSchema,
  getActionRowToday,
  normalizeIntensity,
  normalizeWorkoutType,
} from '../../../../../lib/glow-action-row';
import { localTodayYMD } from '../../../../../lib/glow-schedule';

export const dynamic = 'force-dynamic';

type Body = {
  date?: unknown;
  workout_type?: unknown;
  duration_minutes?: unknown;
  intensity?: unknown;
  notes?: unknown;
};

function normalizeDate(value: unknown) {
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  return localTodayYMD();
}

export async function POST(request: Request) {
  try {
    await ensureGlowActionRowSchema();
    const body = (await request.json().catch(() => ({}))) as Body;

    const logDate = normalizeDate(body.date);
    const workoutType = normalizeWorkoutType(body.workout_type);
    const durationMinutes = Math.round(Number(body.duration_minutes));
    const intensity = normalizeIntensity(body.intensity);
    const notes = typeof body.notes === 'string' ? body.notes.trim() : '';

    if (!Number.isFinite(durationMinutes) || durationMinutes <= 0) {
      return NextResponse.json({ ok: false, message: 'duration_minutes must be > 0.' }, { status: 400 });
    }

    await pool.execute<ResultSetHeader>(
      `
        INSERT INTO gym_logs (date, workout_type, duration_minutes, intensity, notes)
        VALUES (?, ?, ?, ?, ?)
      `,
      [logDate, workoutType, durationMinutes, intensity, notes ? notes.slice(0, 2000) : null],
    );

    return NextResponse.json({ ok: true, ...(await getActionRowToday()) });
  } catch {
    return NextResponse.json({ ok: false, message: 'Unable to save gym log.' }, { status: 500 });
  }
}
