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

type RoutineRow = RowDataPacket & {
  id: number;
  name: string;
  room: string;
  frequency: 'daily' | 'weekly' | 'monthly';
  active_days: unknown;
  time_limit_minutes: number;
  scheduled_time: string;
  is_active: number;
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

type CompletionRow = RowDataPacket & {
  task_id: number;
};

function isValidTimeZone(value: string) {
  try {
    Intl.DateTimeFormat('en-US', { timeZone: value }).format(new Date());
    return true;
  } catch {
    return false;
  }
}

function getHomeNowMeta(date: Date, timeZone: string) {
  const dateParts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const year = dateParts.find((part) => part.type === 'year')?.value ?? '1970';
  const month = dateParts.find((part) => part.type === 'month')?.value ?? '01';
  const day = dateParts.find((part) => part.type === 'day')?.value ?? '01';

  const timeParts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
  }).formatToParts(date);
  const hour = Number(timeParts.find((part) => part.type === 'hour')?.value ?? '0');
  const minute = Number(timeParts.find((part) => part.type === 'minute')?.value ?? '0');

  const weekdayRaw = new Intl.DateTimeFormat('en-US', { timeZone, weekday: 'short' }).format(date);
  const weekday = WEEKDAY_SHORT.includes(weekdayRaw as (typeof WEEKDAY_SHORT)[number]) ? weekdayRaw : 'Mon';

  return {
    today: `${year}-${month}-${day}`,
    weekday,
    dayOfMonth: Number(day),
    nowMinutes: hour * 60 + minute,
  };
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

  if (routine.frequency === 'daily') {
    // v1 rule: daily routines respect selected weekdays.
    return hasWeekdayMatch;
  }
  if (routine.frequency === 'weekly') {
    // v1 rule: weekly routines also depend on selected weekdays.
    return hasWeekdayMatch;
  }
  if (routine.frequency === 'monthly') {
    // v1 documented rule: selected weekday, first occurrence in month.
    return hasWeekdayMatch && dayOfMonth <= 7;
  }
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

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const tzParam = (searchParams.get('tz') ?? '').trim();
    const modeParam = (searchParams.get('mode') ?? '').trim().toLowerCase();
    const includeCompleted = modeParam === 'replay';
    const timeZone = tzParam && isValidTimeZone(tzParam) ? tzParam : 'UTC';
    const now = getHomeNowMeta(new Date(), timeZone);
    const weekdayShort = now.weekday;
    const dayOfMonth = now.dayOfMonth;
    const today = now.today;
    const nowMinutes = now.nowMinutes;

    const [routines] = await pool.execute<RoutineRow[]>(
      `SELECT
          CAST(sr.legacy_id AS SIGNED) AS id,
          sr.name,
          COALESCE(JSON_UNQUOTE(JSON_EXTRACT(sr.config, '$.room')), 'whole_home') AS room,
          COALESCE(JSON_UNQUOTE(JSON_EXTRACT(sr.config, '$.frequency')), 'daily') AS frequency,
          JSON_EXTRACT(sr.config, '$.active_days') AS active_days,
          CAST(COALESCE(JSON_UNQUOTE(JSON_EXTRACT(sr.config, '$.time_limit_minutes')), '60') AS UNSIGNED) AS time_limit_minutes,
          COALESCE(JSON_UNQUOTE(JSON_EXTRACT(sr.config, '$.scheduled_time')), '08:00:00') AS scheduled_time,
          sr.is_active,
          sr.created_at
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
          st.order_index,
          st.estimated_minutes,
          st.created_at
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
      .filter((task) => (includeCompleted ? true : !completedSet.has(task.id)))
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
          estimated_minutes: task.estimated_minutes,
          time_limit_minutes: Number(routine?.time_limit_minutes ?? 60),
          scheduled_time: routine?.scheduled_time ?? '00:00:00',
          is_completed: completedSet.has(task.id),
        };
      });

    return NextResponse.json({
      date: today,
      weekday: weekdayShort,
      tasks: orderedPendingTasks,
      completed_task_ids: Array.from(completedSet),
      total_pending: orderedPendingTasks.length,
      fallback_applied: pendingDueNowCount === 0 && activeTodayRoutineIds.size > 0,
      time_zone: timeZone,
      mode: includeCompleted ? 'replay' : 'default',
    });
  } catch {
    return NextResponse.json({ ok: false, message: 'Unable to load today tasks.' }, { status: 500 });
  }
}
