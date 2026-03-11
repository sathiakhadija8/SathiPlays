import { NextResponse } from 'next/server';
import { type RowDataPacket } from 'mysql2';
import pool from '../../../../../lib/db';
import { ensureSupplementSchema, localTodayYMD, materializeSupplementLogsForRange, type FrequencyType, type TimeOfDay } from '../../../../../lib/glow-supplements';

export const dynamic = 'force-dynamic';

type TodayLogRow = RowDataPacket & {
  log_id: number;
  supplement_id: number;
  supplement_name: string;
  dosage: string | null;
  frequency_type: FrequencyType;
  times_per_day: number;
  time_of_day: TimeOfDay;
  scheduled_datetime: string;
  completed: number;
  completed_at: string | null;
};

function dueTimeValue(datetime: string) {
  return datetime.slice(11, 16);
}

function parseScheduledDateTime(value: string) {
  const [datePart, timePart = '00:00:00'] = value.split(' ');
  const [year, month, day] = datePart.split('-').map((part) => Number(part));
  const [hour, minute, second = 0] = timePart.split(':').map((part) => Number(part));
  if (
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    !Number.isInteger(day) ||
    !Number.isInteger(hour) ||
    !Number.isInteger(minute) ||
    !Number.isInteger(second)
  ) {
    return null;
  }
  return new Date(year, month - 1, day, hour, minute, second, 0);
}

function isMissed(now: Date, scheduledDateTime: string) {
  const dueAt = parseScheduledDateTime(scheduledDateTime);
  if (!dueAt) return false;
  const missedAt = new Date(dueAt.getTime() + 2 * 60 * 60 * 1000);
  return now > missedAt;
}

function isEmergency(now: Date, scheduledDateTime: string) {
  const dueAt = parseScheduledDateTime(scheduledDateTime);
  if (!dueAt) return false;
  const emergencyAt = new Date(dueAt.getTime() + 60 * 60 * 1000);
  return now >= emergencyAt;
}

export async function GET() {
  try {
    await ensureSupplementSchema();
    const today = localTodayYMD();
    await materializeSupplementLogsForRange(today, today);

    const [rows] = await pool.execute<TodayLogRow[]>(
      `
      SELECT
        sl.id AS log_id,
        sl.supplement_id,
        s.name AS supplement_name,
        COALESCE(NULLIF(s.dosage, ''), NULLIF(s.dosage_text, '')) AS dosage,
        s.frequency_type,
        s.times_per_day,
        s.time_of_day,
        DATE_FORMAT(sl.scheduled_datetime, '%Y-%m-%d %H:%i:%s') AS scheduled_datetime,
        sl.completed,
        DATE_FORMAT(sl.completed_at, '%Y-%m-%d %H:%i:%s') AS completed_at
      FROM supplement_logs sl
      INNER JOIN supplements s ON s.id = sl.supplement_id
      WHERE DATE(sl.scheduled_datetime) = ?
        AND s.is_active = 1
      ORDER BY sl.scheduled_datetime ASC, sl.id ASC
      `,
      [today],
    );

    const totalsBySupplement = new Map<number, { total: number; completed: number }>();
    for (const row of rows) {
      const current = totalsBySupplement.get(row.supplement_id) ?? { total: 0, completed: 0 };
      current.total += 1;
      if (Number(row.completed) === 1) current.completed += 1;
      totalsBySupplement.set(row.supplement_id, current);
    }

    const now = new Date();
    const pendingRows = rows.filter((row) => Number(row.completed) !== 1);
    const dueRows = pendingRows;
    const completedRows = rows.filter((row) => Number(row.completed) === 1);

    return NextResponse.json({
      date: today,
      dueNow: dueRows.map((row) => {
        const counts = totalsBySupplement.get(row.supplement_id) ?? { total: 1, completed: 0 };
        return {
          log_id: row.log_id,
          scheduled_id: row.log_id,
          supplement_id: row.supplement_id,
          supplement_name: row.supplement_name,
          dosage: row.dosage,
          frequency_type: row.frequency_type,
          times_per_day: row.times_per_day,
          time_of_day: row.time_of_day,
          due_time: dueTimeValue(row.scheduled_datetime),
          scheduled_datetime: row.scheduled_datetime,
          progress_taken: counts.completed,
          progress_total: counts.total,
          is_missed: isMissed(now, row.scheduled_datetime),
          is_emergency: isEmergency(now, row.scheduled_datetime),
        };
      }),
      completedToday: completedRows.map((row) => {
        const counts = totalsBySupplement.get(row.supplement_id) ?? { total: 1, completed: 1 };
        return {
          id: row.log_id,
          log_id: row.log_id,
          supplement_id: row.supplement_id,
          supplement_name: row.supplement_name,
          dosage: row.dosage,
          frequency_type: row.frequency_type,
          times_per_day: row.times_per_day,
          time_of_day: row.time_of_day,
          due_time: dueTimeValue(row.scheduled_datetime),
          scheduled_datetime: row.scheduled_datetime,
          completed_at: row.completed_at,
          progress_taken: counts.completed,
          progress_total: counts.total,
        };
      }),
    });
  } catch {
    return NextResponse.json({ ok: false, message: 'Unable to load supplements today.' }, { status: 500 });
  }
}
