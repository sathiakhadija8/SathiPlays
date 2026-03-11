import { NextResponse } from 'next/server';
import { type ResultSetHeader, type RowDataPacket } from 'mysql2';
import pool from '../../../../lib/db';

export const dynamic = 'force-dynamic';

type RoadmapRow = RowDataPacket & {
  id: number;
  title: string;
  created_at: string;
};

type TaskRow = RowDataPacket & {
  id: number;
  roadmap_id: number;
  text: string;
  is_done: number;
  done_at: string | null;
  order_index: number;
  created_at: string;
};

type Body = {
  title?: unknown;
  tasks?: unknown;
};

export async function GET() {
  try {
    const [roadmaps] = await pool.execute<RoadmapRow[]>(
      `SELECT id, title, created_at
       FROM roadmaps
       ORDER BY created_at DESC`,
    );

    if (roadmaps.length === 0) return NextResponse.json([]);

    const [tasks] = await pool.execute<TaskRow[]>(
      `SELECT id, roadmap_id, text, is_done, done_at, order_index, created_at
       FROM roadmap_tasks
       ORDER BY roadmap_id DESC, order_index ASC, id ASC`,
    );

    const taskMap = new Map<number, TaskRow[]>();
    for (const task of tasks) {
      const list = taskMap.get(task.roadmap_id) ?? [];
      list.push(task);
      taskMap.set(task.roadmap_id, list);
    }

    const payload = roadmaps.map((roadmap) => {
      const roadmapTasks = taskMap.get(roadmap.id) ?? [];
      const completedCount = roadmapTasks.filter((task) => task.is_done === 1).length;
      return {
        ...roadmap,
        tasks: roadmapTasks,
        completed_count: completedCount,
        total_count: roadmapTasks.length,
      };
    });

    return NextResponse.json(payload);
  } catch {
    return NextResponse.json({ ok: false, message: 'Unable to load roadmaps.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const connection = await pool.getConnection();
  try {
    const body = (await request.json()) as Body;
    const title = typeof body.title === 'string' ? body.title.trim() : '';
    const tasksRaw = Array.isArray(body.tasks) ? body.tasks : [];
    const tasks = tasksRaw
      .filter((item): item is string => typeof item === 'string')
      .map((item) => item.trim())
      .filter(Boolean)
      .slice(0, 50);

    if (!title || title.length > 160) {
      return NextResponse.json({ ok: false, message: 'title is required (<=160).' }, { status: 400 });
    }

    await connection.beginTransaction();

    const [result] = await connection.execute<ResultSetHeader>(
      `INSERT INTO roadmaps (title) VALUES (?)`,
      [title],
    );

    for (let i = 0; i < tasks.length; i += 1) {
      await connection.execute(
        `INSERT INTO roadmap_tasks (roadmap_id, text, order_index)
         VALUES (?, ?, ?)`,
        [result.insertId, tasks[i].slice(0, 220), i],
      );
    }

    await connection.commit();
    return NextResponse.json({ ok: true, insertedId: result.insertId });
  } catch {
    await connection.rollback();
    return NextResponse.json({ ok: false, message: 'Unable to create roadmap.' }, { status: 500 });
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

    await pool.execute(`DELETE FROM roadmaps WHERE id = ?`, [id]);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false, message: 'Unable to delete roadmap.' }, { status: 500 });
  }
}
