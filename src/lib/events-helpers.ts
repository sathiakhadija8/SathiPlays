import type { EventItem } from './events-types';

const LONDON_TZ = 'Europe/London';

function londonParts(date: Date) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: LONDON_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);

  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value ?? '';

  return {
    year: get('year'),
    month: get('month'),
    day: get('day'),
    hour: get('hour'),
    minute: get('minute'),
    second: get('second'),
  };
}

function formatSqlFromUTCDate(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  const hh = String(date.getUTCHours()).padStart(2, '0');
  const mm = String(date.getUTCMinutes()).padStart(2, '0');
  const ss = String(date.getUTCSeconds()).padStart(2, '0');
  return `${y}-${m}-${d} ${hh}:${mm}:${ss}`;
}

function parseSqlToUTCDate(sql: string): Date {
  const [datePart, timePart] = sql.split(' ');
  const [y, m, d] = datePart.split('-').map(Number);
  const [hh, mm, ss] = timePart.split(':').map(Number);
  return new Date(Date.UTC(y, m - 1, d, hh, mm, ss));
}

export function londonNowSql(): string {
  const p = londonParts(new Date());
  return `${p.year}-${p.month}-${p.day} ${p.hour}:${p.minute}:${p.second}`;
}

export function addDaysSql(sqlDateTime: string, days: number): string {
  const date = parseSqlToUTCDate(sqlDateTime);
  date.setUTCDate(date.getUTCDate() + days);
  return formatSqlFromUTCDate(date);
}

export function monthStartSql(month: string): string {
  return `${month}-01 00:00:00`;
}

export function nextMonthStartSql(month: string): string {
  const [y, m] = month.split('-').map(Number);
  const next = m === 12 ? new Date(Date.UTC(y + 1, 0, 1)) : new Date(Date.UTC(y, m, 1));
  const yy = next.getUTCFullYear();
  const mm = String(next.getUTCMonth() + 1).padStart(2, '0');
  return `${yy}-${mm}-01 00:00:00`;
}

export function londonTodayYMD(): string {
  const p = londonParts(new Date());
  return `${p.year}-${p.month}-${p.day}`;
}

export function formatTimeLondon(value: string | Date): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '--:--';
  return date.toLocaleTimeString('en-GB', {
    timeZone: LONDON_TZ,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

export function formatDateHeaderLondon(value: string): string {
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('en-GB', {
    timeZone: LONDON_TZ,
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function toDateInputLondon(value: string | Date): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/London',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

export function toTimeInputLondon(value: string | Date): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString('en-GB', {
    timeZone: 'Europe/London',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

export function monthKeyFromDate(date: Date): string {
  const p = londonParts(date);
  return `${p.year}-${p.month}`;
}

export function parseMonthKey(month: string): Date {
  const [y, m] = month.split('-').map(Number);
  return new Date(y, m - 1, 1);
}

export type CalendarCell = {
  date: string;
  day: number;
  inMonth: boolean;
};

export function buildMonthGrid(monthDate: Date): CalendarCell[] {
  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();
  const first = new Date(year, month, 1);
  const startOffset = first.getDay();
  const start = new Date(year, month, 1 - startOffset);

  const cells: CalendarCell[] = [];
  for (let i = 0; i < 42; i += 1) {
    const date = new Date(start);
    date.setDate(start.getDate() + i);
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    cells.push({
      date: `${y}-${m}-${d}`,
      day: date.getDate(),
      inMonth: date.getMonth() === month,
    });
  }
  return cells;
}

export function groupEventsByDate(events: EventItem[]) {
  const map = new Map<string, EventItem[]>();
  for (const event of events) {
    const key = event.start_at.slice(0, 10);
    const bucket = map.get(key) ?? [];
    bucket.push(event);
    map.set(key, bucket);
  }
  return Array.from(map.entries()).map(([date, items]) => ({ date, items }));
}
