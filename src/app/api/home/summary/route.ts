import { NextResponse } from 'next/server';
import { type RowDataPacket } from 'mysql2';
import pool from '../../../../lib/db';

export const dynamic = 'force-dynamic';

const ROOM_ORDER: Record<string, number> = {
  whole_home: 0,
  kitchen: 1,
  bathroom: 2,
  bedroom: 3,
  living: 4,
  balcony: 5,
  laundry: 6,
  closet: 7,
};

const WEEKDAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;
const CLOSET_STATES = ['in_closet', 'dirty', 'in_laundry', 'drying', 'folded'] as const;

type RoutineRow = RowDataPacket & {
  id: number;
  name: string;
  room: string;
  frequency: 'daily' | 'weekly' | 'monthly';
  active_days: unknown;
  time_limit_minutes: number;
  scheduled_time: string;
  is_active: number;
};

type TaskRow = RowDataPacket & {
  id: number;
  routine_id: number;
  title: string;
  order_index: number;
};

type CompletionRow = RowDataPacket & {
  task_id: number;
};

type ClosetCountRow = RowDataPacket & {
  state: (typeof CLOSET_STATES)[number];
  total_count: number;
};

type PlantRow = RowDataPacket & {
  id: number;
  name: string;
  watering_frequency_days: number;
  last_watered_at: string | null;
  next_watering_at: string;
};

function toYmd(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function parseDays(raw: unknown) {
  if (!raw) return [] as string[];
  if (Array.isArray(raw)) {
    return raw.filter((v): v is string => typeof v === 'string');
  }
  if (typeof raw !== 'string') return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : [];
  } catch {
    return [];
  }
}

function normalizeDayToken(value: string) {
  const token = value.trim().toLowerCase();
  if (!token) return '';
  if (token.length >= 3) return token.slice(0, 3);
  return token;
}

function dayMatches(activeDays: string[], weekdayShort: string) {
  const target = normalizeDayToken(weekdayShort);
  if (!target) return false;
  return activeDays.some((day) => normalizeDayToken(day) === target);
}

function routineActiveToday(routine: RoutineRow, weekdayShort: string, dayOfMonth: number) {
  const activeDays = parseDays(routine.active_days);
  const hasWeekdayMatch = dayMatches(activeDays, weekdayShort);

  if (routine.frequency === 'daily') return hasWeekdayMatch;
  if (routine.frequency === 'weekly') return hasWeekdayMatch;
  if (routine.frequency === 'monthly') return hasWeekdayMatch && dayOfMonth <= 7;
  return false;
}

function parseSqlTimeToMinutes(value: string) {
  const match = /^(\d{2}):(\d{2})(?::\d{2}(?:\.\d{1,6})?)?$/.exec(value);
  if (!match) return 0;
  const hh = Number(match[1]);
  const mm = Number(match[2]);
  if (hh < 0 || hh > 23 || mm < 0 || mm > 59) return 0;
  return hh * 60 + mm;
}

function routineDueNow(routine: RoutineRow, nowMinutes: number) {
  const start = parseSqlTimeToMinutes(routine.scheduled_time ?? '00:00:00');
  const duration = Math.max(1, Math.min(720, Number(routine.time_limit_minutes ?? 60)));
  const end = start + duration;
  if (end <= 1440) return nowMinutes >= start && nowMinutes < end;
  const wrappedEnd = end - 1440;
  return nowMinutes >= start || nowMinutes < wrappedEnd;
}

export async function GET() {
  try {
    const now = new Date();
    const today = toYmd(now);
    const weekdayShort = WEEKDAY_SHORT[now.getDay()];
    const dayOfMonth = now.getDate();
    const nowMinutes = now.getHours() * 60 + now.getMinutes();

    const [routines] = await pool.execute<RoutineRow[]>(
      `SELECT
          CAST(sr.legacy_id AS SIGNED) AS id,
          sr.name,
          COALESCE(JSON_UNQUOTE(JSON_EXTRACT(sr.config, '$.room')), 'whole_home') AS room,
          COALESCE(JSON_UNQUOTE(JSON_EXTRACT(sr.config, '$.frequency')), 'daily') AS frequency,
          JSON_EXTRACT(sr.config, '$.active_days') AS active_days,
          CAST(COALESCE(JSON_UNQUOTE(JSON_EXTRACT(sr.config, '$.time_limit_minutes')), '60') AS UNSIGNED) AS time_limit_minutes,
          COALESCE(JSON_UNQUOTE(JSON_EXTRACT(sr.config, '$.scheduled_time')), '08:00:00') AS scheduled_time,
          sr.is_active
       FROM sp_routines sr
       WHERE sr.domain_key = 'home'
         AND sr.routine_type = 'home_routine'
         AND sr.is_active = 1
         AND sr.legacy_id IS NOT NULL`,
    );

    const [tasks] = await pool.execute<TaskRow[]>(
      `SELECT
          CAST(st.legacy_id AS SIGNED) AS id,
          CAST(sr.legacy_id AS SIGNED) AS routine_id,
          st.title,
          st.order_index
       FROM sp_routine_tasks st
       INNER JOIN sp_routines sr ON sr.id = st.routine_id
       WHERE sr.domain_key = 'home'
         AND sr.routine_type = 'home_routine'
         AND sr.legacy_id IS NOT NULL
         AND st.legacy_id IS NOT NULL`,
    );

    const [completions] = await pool.execute<CompletionRow[]>(
      `SELECT CAST(st.legacy_id AS SIGNED) AS task_id
       FROM sp_task_completions stc
       INNER JOIN sp_routine_tasks st ON st.id = stc.task_id
       WHERE stc.completion_date = ?
         AND st.legacy_table = 'home_tasks'
         AND st.legacy_id IS NOT NULL`,
      [today],
    );

    const completedSet = new Set(completions.map((row) => row.task_id));
    const activeTodayRoutines = routines.filter((routine) => routineActiveToday(routine, weekdayShort, dayOfMonth));
    const dueNowRoutineIds = new Set(
      activeTodayRoutines.filter((routine) => routineDueNow(routine, nowMinutes)).map((routine) => routine.id),
    );
    const activeTodayRoutineIds = new Set(activeTodayRoutines.map((routine) => routine.id));

    const routineMap = new Map<number, RoutineRow>();
    for (const routine of routines) routineMap.set(routine.id, routine);

    const pendingDueNowCount = tasks.filter((task) => dueNowRoutineIds.has(task.routine_id) && !completedSet.has(task.id)).length;
    const effectiveRoutineIds = pendingDueNowCount > 0 ? dueNowRoutineIds : activeTodayRoutineIds;

    const orderedPendingTasks = tasks
      .filter((task) => effectiveRoutineIds.has(task.routine_id))
      .filter((task) => !completedSet.has(task.id))
      .sort((a, b) => {
        const ra = routineMap.get(a.routine_id);
        const rb = routineMap.get(b.routine_id);
        const roomA = ROOM_ORDER[ra?.room ?? 'closet'] ?? 99;
        const roomB = ROOM_ORDER[rb?.room ?? 'closet'] ?? 99;
        if (roomA !== roomB) return roomA - roomB;
        if (a.order_index !== b.order_index) return a.order_index - b.order_index;
        return a.id - b.id;
      })
      .map((task) => {
        const routine = routineMap.get(task.routine_id);
        return {
          id: task.id,
          routine_id: task.routine_id,
          routine_name: routine?.name ?? 'Routine',
          room: routine?.room ?? 'whole_home',
          title: task.title,
          order_index: task.order_index,
          time_limit_minutes: Number(routine?.time_limit_minutes ?? 60),
          scheduled_time: routine?.scheduled_time ?? '00:00:00',
        };
      });

    const [closetCountsRows] = await pool.execute<ClosetCountRow[]>(
      `SELECT state, COUNT(*) AS total_count
       FROM closet_items
       GROUP BY state`,
    );

    const closetCounts = CLOSET_STATES.reduce<Record<(typeof CLOSET_STATES)[number], number>>((acc, state) => {
      acc[state] = 0;
      return acc;
    }, {} as Record<(typeof CLOSET_STATES)[number], number>);

    for (const row of closetCountsRows) {
      closetCounts[row.state] = Number(row.total_count ?? 0);
    }

    const [plantRows] = await pool.execute<PlantRow[]>(
      `SELECT id, name, watering_frequency_days, last_watered_at, next_watering_at
       FROM plants
       ORDER BY id ASC
       LIMIT 1`,
    );

    const plant = plantRows[0] ?? null;
    let plantDue = false;
    if (plant) {
      const [dueRows] = await pool.execute<RowDataPacket[]>(
        `SELECT
           CASE
             WHEN NOW() >= ? AND ( ? IS NULL OR DATE(?) <> CURDATE() ) THEN 1
             ELSE 0
           END AS is_due`,
        [plant.next_watering_at, plant.last_watered_at, plant.last_watered_at],
      );
      plantDue = Number((dueRows[0] as RowDataPacket | undefined)?.is_due ?? 0) === 1;
    }

    const roomsProgress = {
      whole_home: { total: 0, completed: 0 },
      kitchen: { total: 0, completed: 0 },
      bathroom: { total: 0, completed: 0 },
      bedroom: { total: 0, completed: 0 },
      living: { total: 0, completed: 0 },
      balcony: { total: 0, completed: 0 },
      laundry: { total: 0, completed: 0 },
      closet: { total: 0, completed: 0 },
    } as Record<string, { total: number; completed: number }>;

    for (const task of tasks) {
      const routine = routineMap.get(task.routine_id);
      if (!routine || !effectiveRoutineIds.has(routine.id)) continue;
      roomsProgress[routine.room] = roomsProgress[routine.room] ?? { total: 0, completed: 0 };
      roomsProgress[routine.room].total += 1;
      if (completedSet.has(task.id)) roomsProgress[routine.room].completed += 1;
    }

    return NextResponse.json({
      date: today,
      rooms: roomsProgress,
      next_task: orderedPendingTasks[0] ?? null,
      todayTasks: orderedPendingTasks,
      completions: Array.from(completedSet),
      closet: {
        counts: closetCounts,
        snapshot: {
          dirty: closetCounts.dirty,
          in_laundry: closetCounts.in_laundry,
          drying: closetCounts.drying,
          folded: closetCounts.folded,
        },
      },
      plant: plant
        ? {
            id: plant.id,
            name: plant.name,
            next_watering_at: plant.next_watering_at,
            due: plantDue,
          }
        : null,
    });
  } catch {
    return NextResponse.json({ ok: false, message: 'Unable to load home summary.' }, { status: 500 });
  }
}
