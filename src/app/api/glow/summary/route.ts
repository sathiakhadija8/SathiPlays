import { NextResponse } from 'next/server';
import { type RowDataPacket } from 'mysql2';
import pool from '../../../../lib/db';
import { currentWeekdayShort, todayYMD } from '../../../../lib/glow-helpers';

export const dynamic = 'force-dynamic';

type RoutineRow = RowDataPacket & {
  id: number;
  name: string;
  type: string;
  active_days: string;
};

type TaskRow = RowDataPacket & {
  id: number;
  routine_id: number;
  title: string;
  order_index: number;
};

type StreakRow = RowDataPacket & {
  routine_id: number;
  current_streak: number;
  last_completed_date: string | null;
};

type BookRow = RowDataPacket & {
  id: number;
  title: string;
  icon_path: string;
  image_count: number;
};

type ImageRow = RowDataPacket & {
  id: number;
  routine_id: number;
  book_id: number | null;
  image_path: string;
  caption: string | null;
  quote: string | null;
  created_at: string;
  routine_name: string;
  book_title: string | null;
};

type CompletionRow = RowDataPacket & {
  routine_id: number;
};

type RoutineImageTodayRow = RowDataPacket & {
  routine_id: number;
  image_count: number;
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

export async function GET() {
  try {
    const weekday = currentWeekdayShort();
    const today = todayYMD();

    const [routines] = await pool.execute<RoutineRow[]>(
      `SELECT id, name, type, active_days
       FROM routines
       WHERE JSON_CONTAINS(active_days, JSON_QUOTE(?))
       ORDER BY created_at DESC`,
      [weekday],
    );

    const routineIds = routines.map((item) => item.id);

    const [tasks] = await pool.execute<TaskRow[]>(
      `SELECT id, routine_id, title, order_index
       FROM routine_tasks
       ORDER BY routine_id, order_index ASC, id ASC`,
    );

    const [streaks] = await pool.execute<StreakRow[]>(
      `SELECT routine_id, current_streak, last_completed_date
       FROM routine_streaks`,
    );

    const [completionsToday] = await pool.execute<CompletionRow[]>(
      `SELECT routine_id
       FROM routine_completions
       WHERE completed_date = ?`,
      [today],
    );

    const [imagesToday] = await pool.execute<RoutineImageTodayRow[]>(
      `SELECT routine_id, COUNT(*) AS image_count
       FROM glow_images
       WHERE DATE(created_at) = ?
       GROUP BY routine_id`,
      [today],
    );

    const [books] = await pool.execute<BookRow[]>(
      `SELECT b.id, b.title, b.icon_path, COUNT(gi.id) AS image_count
       FROM books b
       LEFT JOIN glow_images gi ON gi.book_id = b.id
       GROUP BY b.id, b.title, b.icon_path
       ORDER BY b.created_at DESC`,
    );

    const [recentImages] = await pool.execute<ImageRow[]>(
      `SELECT gi.id, gi.routine_id, gi.book_id, gi.image_path, gi.caption, gi.quote, gi.created_at,
              r.name AS routine_name, b.title AS book_title
       FROM glow_images gi
       LEFT JOIN routines r ON r.id = gi.routine_id
       LEFT JOIN books b ON b.id = gi.book_id
       ORDER BY gi.created_at DESC
       LIMIT 18`,
    );

    const streakMap = new Map<number, StreakRow>();
    for (const item of streaks) streakMap.set(item.routine_id, item);

    const taskMap = new Map<number, TaskRow[]>();
    for (const task of tasks) {
      const list = taskMap.get(task.routine_id) ?? [];
      list.push(task);
      taskMap.set(task.routine_id, list);
    }

    const completedTodaySet = new Set(completionsToday.map((item) => item.routine_id));
    const imagesTodayMap = new Map(imagesToday.map((item) => [item.routine_id, Number(item.image_count ?? 0)]));

    const todayRoutines = routines.map((routine) => ({
      id: routine.id,
      name: routine.name,
      type: routine.type,
      active_days: parseActiveDays(routine.active_days),
      current_streak: streakMap.get(routine.id)?.current_streak ?? 0,
      last_completed_date: streakMap.get(routine.id)?.last_completed_date ?? null,
      completed_today: completedTodaySet.has(routine.id),
      polaroid_uploaded_today: Number(imagesTodayMap.get(routine.id) ?? 0) > 0,
      tasks: taskMap.get(routine.id) ?? [],
    }));

    return NextResponse.json({
      today_weekday: weekday,
      today_routines: todayRoutines,
      books,
      recent_images: recentImages,
      routine_ids_today: routineIds,
    });
  } catch {
    return NextResponse.json({ ok: false, message: 'Unable to load glow summary.' }, { status: 500 });
  }
}
