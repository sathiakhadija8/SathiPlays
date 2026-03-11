import { NextResponse } from 'next/server';
import { type ResultSetHeader, type RowDataPacket } from 'mysql2';
import pool from '../../../../../lib/db';
import { CAREER_DOMAIN } from '../../../../../lib/career-constants';

export const dynamic = 'force-dynamic';

type Body = {
  task_id?: unknown;
  is_done?: unknown;
};

type TaskRow = RowDataPacket & {
  id: number;
  roadmap_id: number;
  is_done: number;
};

type CountRow = RowDataPacket & {
  total_count: number;
  done_count: number;
};

export async function PATCH(request: Request) {
  const connection = await pool.getConnection();
  try {
    const body = (await request.json()) as Body;
    const taskId = Number(body.task_id);
    const isDone = body.is_done === true;

    if (!Number.isInteger(taskId) || taskId <= 0) {
      return NextResponse.json({ ok: false, message: 'task_id is required.' }, { status: 400 });
    }

    await connection.beginTransaction();

    const [taskRows] = await connection.execute<TaskRow[]>(
      `SELECT id, roadmap_id, is_done
       FROM roadmap_tasks
       WHERE id = ?
       LIMIT 1`,
      [taskId],
    );

    const task = taskRows[0];
    if (!task) {
      await connection.rollback();
      return NextResponse.json({ ok: false, message: 'Task not found.' }, { status: 404 });
    }

    await connection.execute<ResultSetHeader>(
      `UPDATE roadmap_tasks
       SET is_done = ?, done_at = CASE WHEN ? = 1 THEN NOW() ELSE NULL END
       WHERE id = ?`,
      [isDone ? 1 : 0, isDone ? 1 : 0, taskId],
    );

    if (isDone && task.is_done === 0) {
      await connection.execute(
        `INSERT INTO points_logs (domain, source_type, source_id, points, reason)
         VALUES (?, 'roadmap_task', ?, 10, 'Roadmap task complete')`,
        [CAREER_DOMAIN, taskId],
      );
    }

    const [countRows] = await connection.execute<CountRow[]>(
      `SELECT COUNT(*) AS total_count, SUM(CASE WHEN is_done = 1 THEN 1 ELSE 0 END) AS done_count
       FROM roadmap_tasks
       WHERE roadmap_id = ?`,
      [task.roadmap_id],
    );

    const counts = countRows[0];
    if (counts && counts.total_count > 0 && counts.total_count === counts.done_count) {
      const [existing] = await connection.execute<RowDataPacket[]>(
        `SELECT id
         FROM points_logs
         WHERE domain = ? AND source_type = 'roadmap_complete' AND source_id = ?
         LIMIT 1`,
        [CAREER_DOMAIN, task.roadmap_id],
      );

      if (existing.length === 0) {
        await connection.execute(
          `INSERT INTO points_logs (domain, source_type, source_id, points, reason)
           VALUES (?, 'roadmap_complete', ?, 100, 'Roadmap complete')`,
          [CAREER_DOMAIN, task.roadmap_id],
        );
      }
    }

    await connection.commit();
    return NextResponse.json({ ok: true });
  } catch {
    await connection.rollback();
    return NextResponse.json({ ok: false, message: 'Unable to update roadmap task.' }, { status: 500 });
  } finally {
    connection.release();
  }
}
