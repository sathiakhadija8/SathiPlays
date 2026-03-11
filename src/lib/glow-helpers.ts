import { type PoolConnection, type ResultSetHeader, type RowDataPacket } from 'mysql2/promise';

export const GLOW_DOMAIN = 'glow' as const;

export const STREAK_BONUS: Record<number, number> = {
  3: 15,
  7: 40,
  14: 100,
};

export function todayYMD() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function currentWeekdayShort() {
  return new Date().toLocaleDateString('en-GB', { weekday: 'short' });
}

export function dateMinusDays(ymd: string, days: number) {
  const date = new Date(`${ymd}T00:00:00`);
  date.setDate(date.getDate() - days);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export async function addGlowPoints(
  connection: PoolConnection,
  sourceType: string,
  sourceId: number | null,
  points: number,
  reason: string,
) {
  await connection.execute<ResultSetHeader>(
    `INSERT INTO points_logs (domain, source_type, source_id, points, reason)
     VALUES (?, ?, ?, ?, ?)`,
    [GLOW_DOMAIN, sourceType, sourceId, points, reason],
  );
}

type StreakRow = RowDataPacket & {
  routine_id: number;
  current_streak: number;
  last_completed_date: string | null;
};

export async function applyRoutineCompletionAndStreak(connection: PoolConnection, routineId: number) {
  const today = todayYMD();

  const [existingRows] = await connection.execute<RowDataPacket[]>(
    `SELECT id FROM routine_completions WHERE routine_id = ? AND completed_date = ? LIMIT 1`,
    [routineId, today],
  );

  if (existingRows.length > 0) {
    const [streakRows] = await connection.execute<StreakRow[]>(
      `SELECT routine_id, current_streak, last_completed_date
       FROM routine_streaks
       WHERE routine_id = ?
       LIMIT 1`,
      [routineId],
    );

    return {
      already_completed: true,
      points_awarded: 0,
      streak_bonus: 0,
      current_streak: streakRows[0]?.current_streak ?? 0,
    };
  }

  const [completionResult] = await connection.execute<ResultSetHeader>(
    `INSERT INTO routine_completions (routine_id, completed_date, completed_at)
     VALUES (?, ?, NOW())`,
    [routineId, today],
  );

  await addGlowPoints(connection, 'routine_complete', completionResult.insertId, 25, 'Routine completed');

  const [rows] = await connection.execute<StreakRow[]>(
    `SELECT routine_id, current_streak, last_completed_date
     FROM routine_streaks
     WHERE routine_id = ?
     LIMIT 1`,
    [routineId],
  );

  const previous = rows[0];
  const yesterday = dateMinusDays(today, 1);
  const nextStreak = previous?.last_completed_date === yesterday ? (previous.current_streak + 1) : 1;

  await connection.execute<ResultSetHeader>(
    `INSERT INTO routine_streaks (routine_id, current_streak, last_completed_date)
     VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE current_streak = VALUES(current_streak), last_completed_date = VALUES(last_completed_date)`,
    [routineId, nextStreak, today],
  );

  const streakBonus = STREAK_BONUS[nextStreak] ?? 0;
  if (streakBonus > 0) {
    await addGlowPoints(connection, 'routine_streak', routineId, streakBonus, `Routine streak ${nextStreak}d`);
  }

  return {
    already_completed: false,
    points_awarded: 25,
    streak_bonus: streakBonus,
    current_streak: nextStreak,
  };
}
