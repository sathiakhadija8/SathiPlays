import { type PoolConnection, type RowDataPacket } from 'mysql2/promise';
import { CAREER_DOMAIN, INACTIVITY_GUARDS, dailyPracticeGuardKey } from './career-constants';

export function todayYMD() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function toSqlDateTime(value: Date) {
  const y = value.getFullYear();
  const m = String(value.getMonth() + 1).padStart(2, '0');
  const d = String(value.getDate()).padStart(2, '0');
  const hh = String(value.getHours()).padStart(2, '0');
  const mm = String(value.getMinutes()).padStart(2, '0');
  const ss = String(value.getSeconds()).padStart(2, '0');
  return `${y}-${m}-${d} ${hh}:${mm}:${ss}`;
}

export function minutesBetween(start: string | Date, end: string | Date) {
  const startDate = typeof start === 'string' ? new Date(start.replace(' ', 'T')) : start;
  const endDate = typeof end === 'string' ? new Date(end.replace(' ', 'T')) : end;
  return Math.max(0, Math.round((endDate.getTime() - startDate.getTime()) / 60000));
}

export function pomodoroPoints(actualMinutes: number) {
  if (actualMinutes < 30) {
    return { points: -5, reason: 'Pomodoro <30m' };
  }
  if (actualMinutes < 45) {
    return { points: 15, reason: 'Pomodoro 30-44m' };
  }
  return { points: 20, reason: 'Pomodoro >=45m' };
}

type GuardRow = RowDataPacket & {
  id: number;
  last_activity_at: string | null;
  last_penalty_at: string | null;
};

async function ensureGuard(connection: PoolConnection, guardKey: string) {
  await connection.execute(
    `INSERT INTO inactivity_guards (domain, guard_key, last_activity_at, last_penalty_at)
     VALUES (?, ?, ?, NULL)
     ON DUPLICATE KEY UPDATE guard_key = VALUES(guard_key)`,
    [CAREER_DOMAIN, guardKey, toSqlDateTime(new Date())],
  );
}

async function applyPenaltyForGuard(connection: PoolConnection, guardKey: string, points: number, reason: string) {
  await ensureGuard(connection, guardKey);

  const [rows] = await connection.execute<GuardRow[]>(
    `SELECT id, last_activity_at, last_penalty_at
     FROM inactivity_guards
     WHERE domain = ? AND guard_key = ?
     LIMIT 1`,
    [CAREER_DOMAIN, guardKey],
  );

  const row = rows[0];
  if (!row?.last_activity_at) return;

  const now = new Date();
  const lastActivity = new Date(String(row.last_activity_at).replace(' ', 'T'));
  const lastPenalty = row.last_penalty_at ? new Date(String(row.last_penalty_at).replace(' ', 'T')) : null;

  const elapsedMs = now.getTime() - lastActivity.getTime();
  const activityAfterPenalty = !lastPenalty || lastPenalty.getTime() < lastActivity.getTime();
  if (elapsedMs < 24 * 60 * 60 * 1000 || !activityAfterPenalty) return;

  await connection.execute(
    `INSERT INTO points_logs (domain, source_type, source_id, points, reason)
     VALUES (?, 'penalty', NULL, ?, ?)`,
    [CAREER_DOMAIN, points, reason],
  );

  await connection.execute(
    `UPDATE inactivity_guards
     SET last_penalty_at = ?
     WHERE id = ?`,
    [toSqlDateTime(now), row.id],
  );
}

export async function applyCareerInactivityPenalties(connection: PoolConnection) {
  await applyPenaltyForGuard(connection, INACTIVITY_GUARDS.pomodoro, -20, 'No pomodoro in 24h');

  const [items] = await connection.execute<RowDataPacket[]>(
    `SELECT id, key_name, display_name
     FROM daily_practice_items
     WHERE is_active = 1`,
  );

  for (const item of items) {
    await applyPenaltyForGuard(
      connection,
      dailyPracticeGuardKey(Number(item.id)),
      -10,
      `${item.display_name ?? item.key_name ?? 'Daily practice'} missed in 24h`,
    );
  }
}

export async function touchCareerGuardActivity(connection: PoolConnection, guardKey: string, at: string) {
  await connection.execute(
    `INSERT INTO inactivity_guards (domain, guard_key, last_activity_at, last_penalty_at)
     VALUES (?, ?, ?, NULL)
     ON DUPLICATE KEY UPDATE last_activity_at = VALUES(last_activity_at)`,
    [CAREER_DOMAIN, guardKey, at],
  );
}
