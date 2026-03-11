import { NextResponse } from 'next/server';
import { type ResultSetHeader, type RowDataPacket } from 'mysql2';
import pool from '../../../../lib/db';

export const dynamic = 'force-dynamic';

type Body = {
  name?: unknown;
  type?: unknown;
  active_days?: unknown;
};

type RoutineRow = RowDataPacket & {
  id: number;
  name: string;
  type: string;
  active_days: string;
  created_at: string;
};

type TaskRow = RowDataPacket & {
  id: number;
  routine_id: number;
  title: string;
  order_index: number;
};

function parseActiveDays(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === 'string');
  }
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : [];
    } catch {
      return [];
    }
  }
  return [];
}

const VALID_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export async function GET() {
  try {
    const [routines] = await pool.execute<RoutineRow[]>(
      `SELECT id, name, type, active_days, created_at
       FROM routines
       ORDER BY created_at DESC`,
    );

    const [tasks] = await pool.execute<TaskRow[]>(
      `SELECT id, routine_id, title, order_index
       FROM routine_tasks
       ORDER BY routine_id ASC, order_index ASC, id ASC`,
    );

    const taskMap = new Map<number, TaskRow[]>();
    for (const task of tasks) {
      const list = taskMap.get(task.routine_id) ?? [];
      list.push(task);
      taskMap.set(task.routine_id, list);
    }

    return NextResponse.json(
      routines.map((routine) => ({
        id: routine.id,
        name: routine.name,
        type: routine.type,
        active_days: parseActiveDays(routine.active_days),
        created_at: routine.created_at,
        tasks: taskMap.get(routine.id) ?? [],
      })),
    );
  } catch {
    return NextResponse.json({ ok: false, message: 'Unable to load routines.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Body;
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    const type = typeof body.type === 'string' ? body.type.trim() : '';
    const daysRaw = Array.isArray(body.active_days) ? body.active_days : [];
    const activeDays = daysRaw
      .filter((value): value is string => typeof value === 'string')
      .map((value) => value.trim())
      .filter((value) => VALID_DAYS.includes(value));

    if (!name || name.length > 160) {
      return NextResponse.json({ ok: false, message: 'name is required (<=160).' }, { status: 400 });
    }
    if (!type || type.length > 60) {
      return NextResponse.json({ ok: false, message: 'type is required (<=60).' }, { status: 400 });
    }

    const [result] = await pool.execute<ResultSetHeader>(
      `INSERT INTO routines (name, type, active_days)
       VALUES (?, ?, ?)`,
      [name, type, JSON.stringify(activeDays)],
    );

    return NextResponse.json({ ok: true, insertedId: result.insertId });
  } catch {
    return NextResponse.json({ ok: false, message: 'Unable to create routine.' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = Number(searchParams.get('id'));
    if (!Number.isInteger(id) || id <= 0) {
      return NextResponse.json({ ok: false, message: 'id is required.' }, { status: 400 });
    }

    await pool.execute(`DELETE FROM routines WHERE id = ?`, [id]);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false, message: 'Unable to delete routine.' }, { status: 500 });
  }
}
