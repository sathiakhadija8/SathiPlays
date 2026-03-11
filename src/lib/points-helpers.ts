import { type Pool, type PoolConnection } from 'mysql2/promise';
import { type RowDataPacket } from 'mysql2';
import pool from './db';

export type PointsDomain =
  | 'career'
  | 'glow'
  | 'home'
  | 'deen'
  | 'wellness'
  | 'supplements'
  | 'drinks'
  | 'mood'
  | 'cycle'
  | 'food'
  | 'content'
  | 'culture'
  | 'timeline';

type SqlExecutor = Pick<Pool, 'execute'> | Pick<PoolConnection, 'execute'>;

type PointsEntry = {
  domain: PointsDomain;
  sourceType: string;
  sourceId: number | null;
  points: number;
  reason: string;
};

type ExistingRow = RowDataPacket & { id: number };

function normalizePoints(points: number) {
  if (!Number.isFinite(points)) return 0;
  return Math.round(points);
}

function normalizeSourceType(sourceType: string) {
  return sourceType.trim().slice(0, 40);
}

function normalizeReason(reason: string) {
  return reason.trim().slice(0, 200);
}

export async function addPointsLog(executor: SqlExecutor, entry: PointsEntry) {
  const points = normalizePoints(entry.points);
  const sourceType = normalizeSourceType(entry.sourceType);
  const reason = normalizeReason(entry.reason);
  if (points === 0 || !sourceType || !reason) return false;

  await executor.execute(
    `INSERT INTO points_logs (domain, source_type, source_id, points, reason)
     VALUES (?, ?, ?, ?, ?)`,
    [entry.domain, sourceType, entry.sourceId, points, reason],
  );
  return true;
}

export async function addPointsLogOnce(executor: SqlExecutor, entry: PointsEntry) {
  const sourceType = normalizeSourceType(entry.sourceType);
  const reason = normalizeReason(entry.reason);
  const points = normalizePoints(entry.points);
  if (!sourceType || !reason || points === 0) return false;

  const [existingRows] = await executor.execute<ExistingRow[]>(
    `SELECT id
     FROM points_logs
     WHERE domain = ?
       AND source_type = ?
       AND source_id <=> ?
     LIMIT 1`,
    [entry.domain, sourceType, entry.sourceId],
  );

  if (existingRows.length > 0) return false;

  await executor.execute(
    `INSERT INTO points_logs (domain, source_type, source_id, points, reason)
     VALUES (?, ?, ?, ?, ?)`,
    [entry.domain, sourceType, entry.sourceId, points, reason],
  );
  return true;
}

export async function addPointsSafe(entry: PointsEntry) {
  try {
    return await addPointsLog(pool, entry);
  } catch {
    return false;
  }
}

export async function addPointsOnceSafe(entry: PointsEntry) {
  try {
    return await addPointsLogOnce(pool, entry);
  } catch {
    return false;
  }
}
