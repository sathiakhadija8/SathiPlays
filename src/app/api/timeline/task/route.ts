import { NextResponse } from 'next/server';
import { EVENT_CATEGORIES } from '../../../../lib/events-types';
import pool from '../../../../lib/db';
import { combineDateAndTime, parseHHMM } from '../../../../lib/timeline-helpers';

export const dynamic = 'force-dynamic';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^\d{2}:\d{2}$/;

type Body = {
  title?: unknown;
  task_date?: unknown;
  start_time?: unknown;
  end_time?: unknown;
  category?: unknown;
  checklist?: unknown;
};

export async function POST(request: Request) {
  const connection = await pool.getConnection();
  try {
    const body = (await request.json()) as Body;

    const title = typeof body.title === 'string' ? body.title.trim() : '';
    const taskDate = typeof body.task_date === 'string' ? body.task_date.trim() : '';
    const startTime = typeof body.start_time === 'string' ? body.start_time.trim() : '';
    const endTime = typeof body.end_time === 'string' ? body.end_time.trim() : '';

    if (!title || title.length > 160) {
      return NextResponse.json({ ok: false, message: 'title is required and must be <= 160 chars.' }, { status: 400 });
    }
    if (!DATE_RE.test(taskDate)) {
      return NextResponse.json({ ok: false, message: 'task_date must be YYYY-MM-DD.' }, { status: 400 });
    }
    if (!TIME_RE.test(startTime) || !TIME_RE.test(endTime)) {
      return NextResponse.json({ ok: false, message: 'start_time and end_time must be HH:MM.' }, { status: 400 });
    }

    const startMinutes = parseHHMM(startTime);
    const endMinutes = parseHHMM(endTime);
    if (startMinutes == null || endMinutes == null || endMinutes <= startMinutes) {
      return NextResponse.json({ ok: false, message: 'end_time must be later than start_time.' }, { status: 400 });
    }

    const category = typeof body.category === 'string' && body.category.trim() ? body.category.trim() : null;
    if (category && !EVENT_CATEGORIES.includes(category as (typeof EVENT_CATEGORIES)[number])) {
      return NextResponse.json({ ok: false, message: 'category is invalid.' }, { status: 400 });
    }

    const checklistRaw = body.checklist;
    const checklist = Array.isArray(checklistRaw)
      ? checklistRaw.filter((item): item is string => typeof item === 'string').map((item) => item.trim()).filter(Boolean)
      : [];

    await connection.beginTransaction();

    const [taskResult] = await connection.execute<import('mysql2').ResultSetHeader>(
      `INSERT INTO timeline_tasks (title, task_date, start_at, end_at, category)
       VALUES (?, ?, ?, ?, ?)`,
      [
        title,
        taskDate,
        combineDateAndTime(taskDate, startTime),
        combineDateAndTime(taskDate, endTime),
        category,
      ],
    );

    const taskId = taskResult.insertId;

    for (const item of checklist) {
      await connection.execute(
        `INSERT INTO timeline_checklist_items (task_id, text) VALUES (?, ?)`,
        [taskId, item.slice(0, 200)],
      );
    }

    await connection.commit();
    return NextResponse.json({ ok: true, taskId });
  } catch {
    await connection.rollback();
    return NextResponse.json({ ok: false, message: 'Unable to create timeline task right now.' }, { status: 500 });
  } finally {
    connection.release();
  }
}
