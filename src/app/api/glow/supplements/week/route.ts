import { NextResponse } from 'next/server';
import { type RowDataPacket } from 'mysql2';
import pool from '../../../../../lib/db';
import { startOfWeekYMD, weekFromStartYMD } from '../../../../../lib/glow-schedule';
import { ensureSupplementSchema, materializeSupplementLogsForRange, type FrequencyType, type TimeOfDay } from '../../../../../lib/glow-supplements';

export const dynamic = 'force-dynamic';

type WeekLogRow = RowDataPacket & {
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

function normalizeStart(input: string | null) {
  if (!input || !/^\d{4}-\d{2}-\d{2}$/.test(input)) return startOfWeekYMD();
  return input;
}

function shiftYmd(startYmd: string, days: number) {
  const date = new Date(`${startYmd}T00:00:00`);
  date.setDate(date.getDate() + days);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export async function GET(request: Request) {
  try {
    await ensureSupplementSchema();
    const { searchParams } = new URL(request.url);
    const start = normalizeStart(searchParams.get('startDate'));
    const end = shiftYmd(start, 6);
    const days = weekFromStartYMD(start);

    await materializeSupplementLogsForRange(start, end);

    const [rows] = await pool.execute<WeekLogRow[]>(
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
      WHERE DATE(sl.scheduled_datetime) BETWEEN ? AND ?
        AND s.is_active = 1
      ORDER BY sl.scheduled_datetime ASC, sl.id ASC
      `,
      [start, end],
    );

    const rowsByDate = new Map<string, WeekLogRow[]>();
    for (const row of rows) {
      const dateKey = row.scheduled_datetime.slice(0, 10);
      const list = rowsByDate.get(dateKey) ?? [];
      list.push(row);
      rowsByDate.set(dateKey, list);
    }

    return NextResponse.json({
      startDate: start,
      days: days.map((day) => ({
        ...day,
        items: (rowsByDate.get(day.date) ?? []).map((row) => ({
          log_id: row.log_id,
          supplement_id: row.supplement_id,
          supplement_name: row.supplement_name,
          dosage: row.dosage,
          frequency_type: row.frequency_type,
          times_per_day: row.times_per_day,
          time_of_day: row.time_of_day,
          due_time: row.scheduled_datetime.slice(11, 16),
          scheduled_datetime: row.scheduled_datetime,
          completed: Number(row.completed) === 1,
          completed_at: row.completed_at,
        })),
      })),
    });
  } catch {
    return NextResponse.json({ ok: false, message: 'Unable to load supplements week.' }, { status: 500 });
  }
}
