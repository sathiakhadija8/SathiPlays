import { NextResponse } from 'next/server';
import { type ResultSetHeader } from 'mysql2';
import pool from '../../../../lib/db';
import { CAREER_DOMAIN, INACTIVITY_GUARDS } from '../../../../lib/career-constants';
import { pomodoroPoints, touchCareerGuardActivity } from '../../../../lib/career-helpers';
import { ensureStudySessionsTable } from '../../../../lib/career-schema';

export const dynamic = 'force-dynamic';

const DATETIME_RE = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}(:\d{2})?$/;

type Body = {
  subject_id?: unknown;
  label?: unknown;
  planned_minutes?: unknown;
  actual_minutes?: unknown;
  started_at?: unknown;
  ended_at?: unknown;
};

export async function POST(request: Request) {
  const connection = await pool.getConnection();
  try {
    await ensureStudySessionsTable();
    const body = (await request.json()) as Body;

    const subjectId = Number(body.subject_id);
    const label = typeof body.label === 'string' ? body.label.trim() : '';
    const plannedMinutes = Number(body.planned_minutes);
    const actualMinutes = Number(body.actual_minutes);
    const startedAt = typeof body.started_at === 'string' ? body.started_at.trim() : '';
    const endedAt = typeof body.ended_at === 'string' ? body.ended_at.trim() : '';

    if (!Number.isInteger(subjectId) || subjectId <= 0) {
      return NextResponse.json({ ok: false, message: 'subject_id is required.' }, { status: 400 });
    }
    if (!label || label.length > 120) {
      return NextResponse.json({ ok: false, message: 'label is required (<=120).' }, { status: 400 });
    }
    if (!Number.isInteger(plannedMinutes) || plannedMinutes <= 0) {
      return NextResponse.json({ ok: false, message: 'planned_minutes must be positive integer.' }, { status: 400 });
    }
    if (!Number.isInteger(actualMinutes) || actualMinutes < 0) {
      return NextResponse.json({ ok: false, message: 'actual_minutes must be integer >= 0.' }, { status: 400 });
    }
    if (!DATETIME_RE.test(startedAt) || !DATETIME_RE.test(endedAt)) {
      return NextResponse.json({ ok: false, message: 'started_at and ended_at must be DATETIME strings.' }, { status: 400 });
    }

    const normalizedStart = startedAt.length === 16 ? `${startedAt}:00` : startedAt;
    const normalizedEnd = endedAt.length === 16 ? `${endedAt}:00` : endedAt;

    await connection.beginTransaction();

    const [result] = await connection.execute<ResultSetHeader>(
      `INSERT INTO pomodoro_sessions (subject_id, label, planned_minutes, actual_minutes, started_at, ended_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [subjectId, label, plannedMinutes, actualMinutes, normalizedStart, normalizedEnd],
    );

    await connection.execute(
      `INSERT INTO study_sessions (date, duration_minutes, subject_id)
       VALUES (DATE(?), ?, ?)`,
      [normalizedStart, actualMinutes, subjectId],
    );

    const pointsBucket = pomodoroPoints(actualMinutes);
    await connection.execute(
      `INSERT INTO points_logs (domain, source_type, source_id, points, reason)
       VALUES (?, 'pomodoro', ?, ?, ?)`,
      [CAREER_DOMAIN, result.insertId, pointsBucket.points, pointsBucket.reason],
    );

    await touchCareerGuardActivity(connection, INACTIVITY_GUARDS.pomodoro, normalizedEnd);

    await connection.commit();

    return NextResponse.json({
      ok: true,
      session_id: result.insertId,
      points_awarded: pointsBucket.points,
    });
  } catch {
    await connection.rollback();
    return NextResponse.json({ ok: false, message: 'Unable to save pomodoro session.' }, { status: 500 });
  } finally {
    connection.release();
  }
}
