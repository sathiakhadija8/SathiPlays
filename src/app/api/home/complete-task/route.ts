import { NextResponse } from 'next/server';
import { type ResultSetHeader, type RowDataPacket } from 'mysql2';
import pool from '../../../../lib/db';
import { addPointsLog } from '../../../../lib/points-helpers';

type Body = { task_id?: unknown; tz?: unknown };

type TaskRow = RowDataPacket & { id: number };

function isValidTimeZone(value: string) {
  try {
    Intl.DateTimeFormat('en-US', { timeZone: value }).format(new Date());
    return true;
  } catch {
    return false;
  }
}

function toYmdInTimeZone(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const y = parts.find((part) => part.type === 'year')?.value ?? '1970';
  const m = parts.find((part) => part.type === 'month')?.value ?? '01';
  const d = parts.find((part) => part.type === 'day')?.value ?? '01';
  return `${y}-${m}-${d}`;
}

function nowSqlDateTime(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  const ss = String(date.getSeconds()).padStart(2, '0');
  return `${y}-${m}-${d} ${hh}:${mm}:${ss}`;
}

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const connection = await pool.getConnection();
  try {
    const body = (await request.json()) as Body;
    const taskId = Number(body.task_id);
    const tz = typeof body.tz === 'string' && isValidTimeZone(body.tz.trim()) ? body.tz.trim() : 'UTC';

    if (!Number.isInteger(taskId) || taskId <= 0) {
      return NextResponse.json({ ok: false, message: 'task_id is required.' }, { status: 400 });
    }

    await connection.beginTransaction();

    const [taskRows] = await connection.execute<TaskRow[]>(
      `SELECT id FROM home_tasks WHERE id = ? LIMIT 1`,
      [taskId],
    );
    if (taskRows.length === 0) {
      await connection.rollback();
      return NextResponse.json({ ok: false, message: 'Task not found.' }, { status: 404 });
    }

    const now = new Date();
    const today = toYmdInTimeZone(now, tz);

    const [result] = await connection.execute<ResultSetHeader>(
      `INSERT IGNORE INTO home_task_completions (task_id, completion_date, completed_at)
       VALUES (?, ?, ?)`,
      [taskId, today, nowSqlDateTime(now)],
    );

    const alreadyCompleted = result.affectedRows === 0;
    let pointsAwarded = 0;
    if (!alreadyCompleted) {
      await addPointsLog(connection, {
        domain: 'home',
        sourceType: 'home_task_complete',
        sourceId: result.insertId || null,
        points: 12,
        reason: 'Home task completed',
      });
      pointsAwarded = 12;
    }

    await connection.commit();
    return NextResponse.json({
      ok: true,
      task_id: taskId,
      completion_date: today,
      already_completed: alreadyCompleted,
      points_awarded: pointsAwarded,
      time_zone: tz,
    });
  } catch {
    await connection.rollback().catch(() => undefined);
    return NextResponse.json({ ok: false, message: 'Unable to complete task.' }, { status: 500 });
  } finally {
    connection.release();
  }
}
