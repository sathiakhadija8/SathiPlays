import { NextResponse } from 'next/server';
import { type ResultSetHeader, type RowDataPacket } from 'mysql2';
import pool from '../../../../../lib/db';

export const dynamic = 'force-dynamic';

type Body = {
  routine_id?: unknown;
  title?: unknown;
  order_index?: unknown;
  task_id?: unknown;
  direction?: unknown;
};

type TaskRow = RowDataPacket & {
  id: number;
  routine_id: number;
  order_index: number;
  title: string;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Body;
    const routineId = Number(body.routine_id);
    const title = typeof body.title === 'string' ? body.title.trim() : '';
    let orderIndex = Number(body.order_index);

    if (!Number.isInteger(routineId) || routineId <= 0) {
      return NextResponse.json({ ok: false, message: 'routine_id is required.' }, { status: 400 });
    }
    if (!title || title.length > 220) {
      return NextResponse.json({ ok: false, message: 'title is required (<=220).' }, { status: 400 });
    }

    if (!Number.isInteger(orderIndex) || orderIndex < 0) {
      const [rows] = await pool.execute<RowDataPacket[]>(
        `SELECT COALESCE(MAX(order_index), -1) AS max_order
         FROM routine_tasks
         WHERE routine_id = ?`,
        [routineId],
      );
      orderIndex = Number(rows[0]?.max_order ?? -1) + 1;
    }

    const [result] = await pool.execute<ResultSetHeader>(
      `INSERT INTO routine_tasks (routine_id, title, order_index)
       VALUES (?, ?, ?)`,
      [routineId, title, orderIndex],
    );

    return NextResponse.json({ ok: true, insertedId: result.insertId });
  } catch {
    return NextResponse.json({ ok: false, message: 'Unable to add routine task.' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const connection = await pool.getConnection();
  try {
    const body = (await request.json()) as Body;
    const taskId = Number(body.task_id);
    const title = typeof body.title === 'string' ? body.title.trim() : null;
    const direction = typeof body.direction === 'string' ? body.direction.trim() : null;
    const orderIndexRaw = body.order_index;

    if (!Number.isInteger(taskId) || taskId <= 0) {
      return NextResponse.json({ ok: false, message: 'task_id is required.' }, { status: 400 });
    }

    await connection.beginTransaction();

    const [taskRows] = await connection.execute<TaskRow[]>(
      `SELECT id, routine_id, order_index, title
       FROM routine_tasks
       WHERE id = ?
       LIMIT 1`,
      [taskId],
    );

    const task = taskRows[0];
    if (!task) {
      await connection.rollback();
      return NextResponse.json({ ok: false, message: 'Task not found.' }, { status: 404 });
    }

    if (title && title.length <= 220) {
      await connection.execute(
        `UPDATE routine_tasks SET title = ? WHERE id = ?`,
        [title, taskId],
      );
    }

    if (direction === 'up' || direction === 'down') {
      const comparator = direction === 'up' ? '<' : '>';
      const ordering = direction === 'up' ? 'DESC' : 'ASC';
      const [swapRows] = await connection.execute<TaskRow[]>(
        `SELECT id, routine_id, order_index, title
         FROM routine_tasks
         WHERE routine_id = ? AND order_index ${comparator} ?
         ORDER BY order_index ${ordering}
         LIMIT 1`,
        [task.routine_id, task.order_index],
      );
      const swap = swapRows[0];
      if (swap) {
        await connection.execute(`UPDATE routine_tasks SET order_index = ? WHERE id = ?`, [swap.order_index, task.id]);
        await connection.execute(`UPDATE routine_tasks SET order_index = ? WHERE id = ?`, [task.order_index, swap.id]);
      }
    }

    if (Number.isInteger(Number(orderIndexRaw)) && Number(orderIndexRaw) >= 0) {
      await connection.execute(`UPDATE routine_tasks SET order_index = ? WHERE id = ?`, [Number(orderIndexRaw), taskId]);
    }

    await connection.commit();
    return NextResponse.json({ ok: true });
  } catch {
    await connection.rollback();
    return NextResponse.json({ ok: false, message: 'Unable to update task.' }, { status: 500 });
  } finally {
    connection.release();
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = Number(searchParams.get('id'));
    if (!Number.isInteger(id) || id <= 0) {
      return NextResponse.json({ ok: false, message: 'id is required.' }, { status: 400 });
    }

    await pool.execute(`DELETE FROM routine_tasks WHERE id = ?`, [id]);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false, message: 'Unable to delete task.' }, { status: 500 });
  }
}
