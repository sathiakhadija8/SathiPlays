import { NextResponse } from 'next/server';
import { type ResultSetHeader, type RowDataPacket } from 'mysql2';
import pool from '../../../../lib/db';
import { addPointsSafe } from '../../../../lib/points-helpers';

export const dynamic = 'force-dynamic';

type JobRow = RowDataPacket & {
  id: number;
  applied_count: number;
  work_mode: 'remote' | 'in';
  update_note: string | null;
  created_at: string;
};

type Body = {
  id?: unknown;
  applied_count?: unknown;
  work_mode?: unknown;
  update_note?: unknown;
};

function normalizeWorkMode(value: unknown): 'remote' | 'in' | null {
  if (typeof value !== 'string') return null;
  const mode = value.trim().toLowerCase();
  if (mode === 'remote' || mode === 'in') return mode;
  return null;
}

export async function GET() {
  try {
    const [rows] = await pool.execute<JobRow[]>(
      `SELECT id, applied_count, work_mode, update_note, created_at
       FROM job_hunt_logs
       ORDER BY created_at DESC`,
    );
    return NextResponse.json(rows);
  } catch {
    return NextResponse.json({ ok: false, message: 'Unable to load job logs.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Body;
    const appliedCount = Number(body.applied_count);
    const workMode = normalizeWorkMode(body.work_mode);
    const updateNote = typeof body.update_note === 'string' ? body.update_note.trim() : '';

    if (!Number.isInteger(appliedCount) || appliedCount < 0 || appliedCount > 500) {
      return NextResponse.json({ ok: false, message: 'applied_count must be an integer 0-500.' }, { status: 400 });
    }
    if (!workMode) {
      return NextResponse.json({ ok: false, message: 'work_mode must be remote or in.' }, { status: 400 });
    }

    const [result] = await pool.execute<ResultSetHeader>(
      `INSERT INTO job_hunt_logs (applied_count, work_mode, update_note)
       VALUES (?, ?, ?)`,
      [appliedCount, workMode, updateNote || null],
    );

    const pointsAwarded = appliedCount > 0 ? Math.min(40, appliedCount * 4) : 2;
    await addPointsSafe({
      domain: 'career',
      sourceType: 'job_hunt_log',
      sourceId: result.insertId || null,
      points: pointsAwarded,
      reason: `Job hunt update: ${appliedCount} applications`,
    });

    return NextResponse.json({ ok: true, insertedId: result.insertId, points_awarded: pointsAwarded });
  } catch {
    return NextResponse.json({ ok: false, message: 'Unable to create job log.' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const body = (await request.json()) as Body;
    const id = Number(body.id);
    if (!Number.isInteger(id) || id <= 0) {
      return NextResponse.json({ ok: false, message: 'id is required.' }, { status: 400 });
    }

    const appliedCount =
      typeof body.applied_count === 'number' || typeof body.applied_count === 'string'
        ? Number(body.applied_count)
        : null;
    const workMode = body.work_mode === undefined ? null : normalizeWorkMode(body.work_mode);
    const updateNote = typeof body.update_note === 'string' ? body.update_note.trim() : null;

    if (appliedCount !== null && (!Number.isInteger(appliedCount) || appliedCount < 0 || appliedCount > 500)) {
      return NextResponse.json({ ok: false, message: 'applied_count must be an integer 0-500.' }, { status: 400 });
    }
    if (body.work_mode !== undefined && !workMode) {
      return NextResponse.json({ ok: false, message: 'work_mode must be remote or in.' }, { status: 400 });
    }

    await pool.execute(
      `UPDATE job_hunt_logs
       SET applied_count = COALESCE(?, applied_count),
           work_mode = COALESCE(?, work_mode),
           update_note = COALESCE(?, update_note)
       WHERE id = ?`,
      [appliedCount, workMode, updateNote, id],
    );

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false, message: 'Unable to update job log.' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = Number(searchParams.get('id'));
    if (!Number.isInteger(id) || id <= 0) {
      return NextResponse.json({ ok: false, message: 'id is required.' }, { status: 400 });
    }

    await pool.execute(`DELETE FROM job_hunt_logs WHERE id = ?`, [id]);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false, message: 'Unable to delete job log.' }, { status: 500 });
  }
}
