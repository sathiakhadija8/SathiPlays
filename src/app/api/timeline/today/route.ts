import { NextResponse } from 'next/server';
import { type RowDataPacket } from 'mysql2';
import pool from '../../../../lib/db';
import { todayYMD } from '../../../../lib/timeline-helpers';

export const dynamic = 'force-dynamic';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

type TaskRow = RowDataPacket & {
  id: number;
  title: string;
  task_date: string;
  start_at: string;
  end_at: string;
  category: string | null;
  completed_at: string | null;
};

type ItemRow = RowDataPacket & {
  id: number;
  task_id: number;
  text: string;
  is_done: number;
  done_at: string | null;
};

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const dateParam = searchParams.get('date');
    const date = dateParam && DATE_RE.test(dateParam) ? dateParam : todayYMD();

    const [tasks] = await pool.execute<TaskRow[]>(
      `SELECT id, title, task_date, start_at, end_at, category, completed_at
       FROM timeline_tasks
       WHERE task_date = ?
       ORDER BY start_at ASC, id ASC`,
      [date],
    );

    if (!tasks.length) return NextResponse.json([]);

    const ids = tasks.map((task) => task.id);
    const placeholders = ids.map(() => '?').join(',');

    const [items] = await pool.execute<ItemRow[]>(
      `SELECT id, task_id, text, is_done, done_at
       FROM timeline_checklist_items
       WHERE task_id IN (${placeholders})
       ORDER BY created_at ASC, id ASC`,
      ids,
    );

    const byTask = new Map<number, ItemRow[]>();
    for (const item of items) {
      const list = byTask.get(item.task_id) ?? [];
      list.push(item);
      byTask.set(item.task_id, list);
    }

    return NextResponse.json(
      tasks.map((task) => ({
        ...task,
        checklist: (byTask.get(task.id) ?? []).map((item) => ({
          id: item.id,
          task_id: item.task_id,
          text: item.text,
          is_done: item.is_done === 1,
          done_at: item.done_at,
        })),
      })),
    );
  } catch {
    return NextResponse.json({ message: 'Unable to fetch timeline tasks.' }, { status: 500 });
  }
}
