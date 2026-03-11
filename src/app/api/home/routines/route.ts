import { NextResponse } from 'next/server';
import { type ResultSetHeader, type RowDataPacket } from 'mysql2';
import pool from '../../../../lib/db';

export const dynamic = 'force-dynamic';

const ROOMS = new Set(['bedroom', 'kitchen', 'living', 'bathroom', 'balcony', 'laundry', 'closet', 'whole_home']);
const FREQUENCIES = new Set(['daily', 'weekly', 'monthly']);
const DAYS = new Set(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']);
const DAY_ORDER = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;
const DAY_INDEX = new Map(DAY_ORDER.map((day, index) => [day, index]));
const DEFAULT_TIME_LIMIT_MINUTES = 60;
const DEFAULT_SCHEDULED_TIME = '08:00:00';

type RoutineRow = RowDataPacket & {
  id: number;
  name: string;
  room: string;
  frequency: string;
  active_days: string | null;
  is_active: number;
  time_limit_minutes: number;
  scheduled_time: string;
  created_at: string;
};

type TaskRow = RowDataPacket & {
  id: number;
  routine_id: number;
  title: string;
  order_index: number;
  estimated_minutes: number;
  created_at: string;
};

type Body = {
  name?: unknown;
  room?: unknown;
  frequency?: unknown;
  active_days?: unknown;
  time_limit_minutes?: unknown;
  scheduled_time?: unknown;
  is_active?: unknown;
};

function daySortIndex(day: string) {
  return DAY_INDEX.get(day as (typeof DAY_ORDER)[number]) ?? 99;
}

function sanitizeDays(value: unknown) {
  if (!Array.isArray(value)) return [] as string[];
  const unique = Array.from(
    new Set(
      value
        .filter((item): item is string => typeof item === 'string')
        .map((item) => item.trim())
        .filter((item) => DAYS.has(item)),
    ),
  );
  return unique.sort((a, b) => daySortIndex(a) - daySortIndex(b));
}

function parseTimeLimitMinutes(value: unknown) {
  if (value === undefined) return DEFAULT_TIME_LIMIT_MINUTES;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 720) return null;
  return parsed;
}

function normalizeScheduledTime(value: unknown) {
  if (value === undefined || value === null || value === '') return DEFAULT_SCHEDULED_TIME;
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  const match = /^([01]\d|2[0-3]):([0-5]\d)(?::([0-5]\d))?$/.exec(trimmed);
  if (!match) return null;
  const [, hh, mm, ss] = match;
  return `${hh}:${mm}:${ss ?? '00'}`;
}

export async function GET() {
  try {
    const [routines] = await pool.execute<RoutineRow[]>(
      `SELECT
          CAST(sr.legacy_id AS SIGNED) AS id,
          sr.name,
          COALESCE(JSON_UNQUOTE(JSON_EXTRACT(sr.config, '$.room')), 'whole_home') AS room,
          COALESCE(JSON_UNQUOTE(JSON_EXTRACT(sr.config, '$.frequency')), 'daily') AS frequency,
          JSON_EXTRACT(sr.config, '$.active_days') AS active_days,
          sr.is_active,
          CAST(COALESCE(JSON_UNQUOTE(JSON_EXTRACT(sr.config, '$.time_limit_minutes')), '60') AS UNSIGNED) AS time_limit_minutes,
          COALESCE(JSON_UNQUOTE(JSON_EXTRACT(sr.config, '$.scheduled_time')), '08:00:00') AS scheduled_time,
          sr.created_at
       FROM sp_routines sr
       WHERE sr.domain_key = 'home'
         AND sr.routine_type = 'home_routine'
         AND sr.legacy_id IS NOT NULL
       ORDER BY created_at DESC`,
    );

    const [tasks] = await pool.execute<TaskRow[]>(
      `SELECT
          CAST(st.legacy_id AS SIGNED) AS id,
          CAST(sr.legacy_id AS SIGNED) AS routine_id,
          st.title,
          st.order_index,
          st.estimated_minutes,
          st.created_at
       FROM sp_routine_tasks st
       INNER JOIN sp_routines sr ON sr.id = st.routine_id
       WHERE sr.domain_key = 'home'
         AND sr.routine_type = 'home_routine'
         AND sr.legacy_id IS NOT NULL
         AND st.legacy_id IS NOT NULL
       ORDER BY routine_id DESC, order_index ASC, id ASC`,
    );

    const taskMap = new Map<number, TaskRow[]>();
    for (const task of tasks) {
      const list = taskMap.get(task.routine_id) ?? [];
      list.push(task);
      taskMap.set(task.routine_id, list);
    }

    return NextResponse.json(
      routines.map((routine) => ({
        ...routine,
        active_days: routine.active_days,
        is_active: routine.is_active === 1,
        time_limit_minutes: Number(routine.time_limit_minutes ?? DEFAULT_TIME_LIMIT_MINUTES),
        scheduled_time: routine.scheduled_time ?? DEFAULT_SCHEDULED_TIME,
        tasks: taskMap.get(routine.id) ?? [],
      })),
    );
  } catch {
    return NextResponse.json({ ok: false, message: 'Unable to load home routines.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Body;
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    const room = typeof body.room === 'string' ? body.room.trim() : '';
    const frequency = typeof body.frequency === 'string' ? body.frequency.trim() : '';
    const activeDays = sanitizeDays(body.active_days);
    const timeLimitMinutes = parseTimeLimitMinutes(body.time_limit_minutes);
    const scheduledTime = normalizeScheduledTime(body.scheduled_time);
    const isActive = body.is_active !== false;

    if (!name || name.length > 160) {
      return NextResponse.json({ ok: false, message: 'name is required (<=160).' }, { status: 400 });
    }
    if (!ROOMS.has(room)) {
      return NextResponse.json({ ok: false, message: 'room is invalid.' }, { status: 400 });
    }
    if (!FREQUENCIES.has(frequency)) {
      return NextResponse.json({ ok: false, message: 'frequency is invalid.' }, { status: 400 });
    }
    if (activeDays.length === 0) {
      return NextResponse.json({ ok: false, message: 'active_days must include at least one weekday.' }, { status: 400 });
    }
    if (timeLimitMinutes === null) {
      return NextResponse.json({ ok: false, message: 'time_limit_minutes must be an integer between 1 and 720.' }, { status: 400 });
    }
    if (!scheduledTime) {
      return NextResponse.json({ ok: false, message: 'scheduled_time must be a valid time (HH:MM or HH:MM:SS).' }, { status: 400 });
    }

    const [result] = await pool.execute<ResultSetHeader>(
      `INSERT INTO home_routines (name, room, frequency, active_days, time_limit_minutes, scheduled_time, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [name, room, frequency, JSON.stringify(activeDays), timeLimitMinutes, scheduledTime, isActive ? 1 : 0],
    );

    return NextResponse.json({ ok: true, insertedId: result.insertId });
  } catch {
    return NextResponse.json({ ok: false, message: 'Unable to create routine.' }, { status: 500 });
  }
}
