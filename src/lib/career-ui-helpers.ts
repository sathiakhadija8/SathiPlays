export function formatHHMM(dateTime: string | null) {
  if (!dateTime) return '--:--';
  const date = new Date(String(dateTime).replace(' ', 'T'));
  if (Number.isNaN(date.getTime())) return '--:--';
  return date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

export function minutesToClock(totalMinutes: number) {
  const safe = Math.max(0, Math.floor(totalMinutes));
  const h = Math.floor(safe / 60);
  const m = safe % 60;
  if (h === 0) return `${m}m`;
  return `${h}h ${m}m`;
}

export function nowSqlDateTime() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  const ss = String(now.getSeconds()).padStart(2, '0');
  return `${y}-${m}-${d} ${hh}:${mm}:${ss}`;
}

export function getRemainingSeconds(startedAtMs: number, plannedMinutes: number) {
  const elapsed = Math.floor((Date.now() - startedAtMs) / 1000);
  const plannedSeconds = Math.max(0, plannedMinutes * 60);
  return Math.max(0, plannedSeconds - elapsed);
}

export function toDateInputValue(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
