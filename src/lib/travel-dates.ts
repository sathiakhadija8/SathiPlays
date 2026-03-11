function extractYmd(value: string) {
  const trimmed = value.trim();
  const match = /^(\d{4}-\d{2}-\d{2})/.exec(trimmed);
  return match ? match[1] : '';
}

function dateToYmd(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function normalizeYmd(value: unknown) {
  if (value instanceof Date) return dateToYmd(value);
  if (typeof value !== 'string') return '';
  const ymd = extractYmd(value);
  return ymd || '';
}

export function parseYmdToDate(value: unknown) {
  const ymd = normalizeYmd(value);
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);
  if (
    Number.isNaN(date.getTime()) ||
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }
  return date;
}

// Inclusive duration: same-day trip = 1 day.
export function computeDurationDays(startYmd: unknown, endYmd: unknown) {
  const start = parseYmdToDate(startYmd);
  const end = parseYmdToDate(endYmd);
  if (!start || !end) return 0;
  const diffMs = end.getTime() - start.getTime();
  const diffDays = Math.floor(diffMs / 86400000);
  return diffDays >= 0 ? diffDays + 1 : 0;
}

export function toYmd(date: Date) {
  return dateToYmd(date);
}

export function enumerateYmdRange(startYmd: unknown, endYmd: unknown) {
  const start = parseYmdToDate(startYmd);
  const end = parseYmdToDate(endYmd);
  if (!start || !end || end < start) return [] as string[];
  const result: string[] = [];
  const cursor = new Date(start.getTime());
  while (cursor <= end) {
    result.push(toYmd(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return result;
}
