import { type RowDataPacket } from 'mysql2';

export type TimeSlot = 'morning' | 'midday' | 'evening' | 'night';

export const WEEKDAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

export type BaseScheduleRow = RowDataPacket & {
  scheduled_id: number;
  item_id: number;
  item_name: string;
  frequency?: string | null;
  due_time: string;
  time_slot: TimeSlot;
  notes: string | null;
  day_of_week: number;
  enabled: number;
};

export type BaseLogRow = RowDataPacket & {
  id: number;
  scheduled_id: number | null;
  item_id: number;
  item_name: string;
  frequency?: string | null;
  due_time: string | null;
  time_slot: TimeSlot | null;
  taken_at: string;
};

export function localTodayYMD(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function localWeekday(date = new Date()) {
  return date.getDay();
}

export function startOfWeekYMD(date = new Date()) {
  const copy = new Date(date);
  const deltaToMonday = (copy.getDay() + 6) % 7;
  copy.setDate(copy.getDate() - deltaToMonday);
  return localTodayYMD(copy);
}

export function weekFromStartYMD(startYmd: string) {
  const result: Array<{ date: string; day_of_week: number; day_label: string }> = [];
  const start = new Date(`${startYmd}T00:00:00`);
  for (let i = 0; i < 7; i += 1) {
    const next = new Date(start);
    next.setDate(start.getDate() + i);
    result.push({
      date: localTodayYMD(next),
      day_of_week: next.getDay(),
      day_label: WEEKDAY_SHORT[next.getDay()],
    });
  }
  return result;
}

function toDueDateTime(todayYmd: string, dueTime: string) {
  const clean = dueTime.length === 5 ? `${dueTime}:00` : dueTime;
  return new Date(`${todayYmd}T${clean}`);
}

export function classifyDueNow(
  schedules: BaseScheduleRow[],
  completedToday: BaseLogRow[],
  now = new Date(),
) {
  const today = localTodayYMD(now);
  const completedMap = new Map<number, BaseLogRow>();
  for (const log of completedToday) {
    if (log.scheduled_id) completedMap.set(log.scheduled_id, log);
  }

  const dueNow: Array<{
    scheduled_id: number;
    item_id: number;
    item_name: string;
    frequency?: string | null;
    due_time: string;
    time_slot: TimeSlot;
    notes: string | null;
    day_of_week: number;
    is_missed: boolean;
  }> = [];

  for (const schedule of schedules) {
    if (completedMap.has(schedule.scheduled_id)) continue;
    const due = toDueDateTime(today, schedule.due_time);
    const windowEnd = new Date(due.getTime() + 2 * 60 * 60 * 1000);
    if (now < due) continue;

    dueNow.push({
      scheduled_id: schedule.scheduled_id,
      item_id: schedule.item_id,
      item_name: schedule.item_name,
      frequency: schedule.frequency ?? null,
      due_time: schedule.due_time,
      time_slot: schedule.time_slot,
      notes: schedule.notes,
      day_of_week: schedule.day_of_week,
      is_missed: now > windowEnd,
    });
  }

  return {
    dueNow,
    completedToday,
  };
}
