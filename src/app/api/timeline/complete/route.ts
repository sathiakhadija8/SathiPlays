import { NextResponse } from 'next/server';
import { type ResultSetHeader, type RowDataPacket } from 'mysql2';
import pool from '../../../../lib/db';
import { nowSql } from '../../../../lib/timeline-helpers';
import { addPointsOnceSafe } from '../../../../lib/points-helpers';

export const dynamic = 'force-dynamic';

type Body = {
  task_id?: unknown;
  completed?: unknown;
};

type TimelineTaskRow = RowDataPacket & {
  completed_at: string | null;
};

export async function PATCH(request: Request) {
  try {
    const body = (await request.json()) as Body;
    const taskId = Number(body.task_id);
    const completed = body.completed === true;

    if (!Number.isInteger(taskId) || taskId <= 0) {
      return NextResponse.json({ ok: false, message: 'task_id is invalid.' }, { status: 400 });
    }

    const [taskRows] = await pool.execute<TimelineTaskRow[]>(
      `SELECT completed_at FROM timeline_tasks WHERE id = ? LIMIT 1`,
      [taskId],
    );
    if (taskRows.length === 0) {
      return NextResponse.json({ ok: false, message: 'Task not found.' }, { status: 404 });
    }
    const wasCompleted = Boolean(taskRows[0]?.completed_at);

    const [result] = await pool.execute<ResultSetHeader>(
      `UPDATE timeline_tasks
       SET completed_at = ?
       WHERE id = ?`,
      [completed ? nowSql() : null, taskId],
    );

    if (result.affectedRows === 0) {
      return NextResponse.json({ ok: false, message: 'Task not found.' }, { status: 404 });
    }

    let pointsAwarded = 0;
    if (completed && !wasCompleted) {
      const awarded = await addPointsOnceSafe({
        domain: 'timeline',
        sourceType: 'timeline_task_complete',
        sourceId: taskId,
        points: 8,
        reason: 'Timeline task completed',
      });
      pointsAwarded = awarded ? 8 : 0;
    }

    return NextResponse.json({ ok: true, points_awarded: pointsAwarded });
  } catch {
    return NextResponse.json({ ok: false, message: 'Unable to update task completion.' }, { status: 500 });
  }
}
