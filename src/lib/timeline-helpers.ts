import { londonNowSql, londonTodayYMD } from './events-helpers';

export type TimelineChecklistItem = {
  id: number;
  task_id: number;
  text: string;
  is_done: boolean;
  done_at: string | null;
};

export type TimelineTask = {
  id: number;
  title: string;
  task_date: string;
  start_at: string;
  end_at: string;
  category: string | null;
  completed_at: string | null;
  checklist: TimelineChecklistItem[];
};

export type TimelineStatus = 'upcoming' | 'in_progress' | 'completed' | 'missed';

export function parseHHMM(value: string): number | null {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (!match) return null;
  const h = Number(match[1]);
  const m = Number(match[2]);
  if (h < 0 || h > 23 || m < 0 || m > 59) return null;
  return h * 60 + m;
}

export function combineDateAndTime(date: string, hhmm: string): string {
  return `${date} ${hhmm}:00`;
}

export function getTaskStatus(task: TimelineTask, now: Date): TimelineStatus {
  if (task.completed_at) return 'completed';
  const start = new Date(task.start_at);
  const end = new Date(task.end_at);
  if (now < start) return 'upcoming';
  if (now >= end) return 'missed';
  return 'in_progress';
}

export function formatTime(value: string | Date): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '--:--';
  return date.toLocaleTimeString('en-GB', {
    timeZone: 'Europe/London',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

export function minutesLeft(task: TimelineTask, now: Date): number {
  const end = new Date(task.end_at).getTime();
  const diff = end - now.getTime();
  return Math.max(0, Math.ceil(diff / 60000));
}

export function timelineStatusLabel(status: TimelineStatus): string {
  if (status === 'in_progress') return 'In Progress';
  if (status === 'completed') return 'Completed';
  if (status === 'missed') return 'Missed';
  return 'Upcoming';
}

export function todayYMD() {
  return londonTodayYMD();
}

export function nowSql() {
  return londonNowSql();
}
