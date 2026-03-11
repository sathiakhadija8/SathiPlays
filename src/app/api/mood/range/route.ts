import { NextResponse } from 'next/server';
import { type RowDataPacket } from 'mysql2';
import pool from '../../../../lib/db';

type MoodMode = 'today' | '7d' | '30d';

export const dynamic = 'force-dynamic';

type TodayMoodRow = RowDataPacket & {
  mood_value: number;
  created_at: string;
};

type DailyAverageRow = RowDataPacket & {
  day: string | Date;
  avg_value: number | string;
};

type TodayStatsRow = RowDataPacket & {
  today_avg: number | string | null;
  today_min: number | null;
  today_max: number | null;
  today_count: number;
};

function parseMode(value: string | null): MoodMode {
  if (value === 'today' || value === '7d' || value === '30d') return value;
  return '7d';
}

function normalizeDay(day: string | Date): string {
  if (typeof day === 'string') return day.slice(0, 10);
  const year = day.getFullYear();
  const month = String(day.getMonth() + 1).padStart(2, '0');
  const date = String(day.getDate()).padStart(2, '0');
  return `${year}-${month}-${date}`;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const mode = parseMode(searchParams.get('mode'));

    const [statsRows] = await pool.query<TodayStatsRow[]>(
      `SELECT
        ROUND(AVG(mood_value), 2) AS today_avg,
        MIN(mood_value) AS today_min,
        MAX(mood_value) AS today_max,
        COUNT(*) AS today_count
      FROM mood_logs
      WHERE DATE(created_at) = CURDATE()`,
    );

    const stats = statsRows[0] ?? {
      today_avg: null,
      today_min: null,
      today_max: null,
      today_count: 0,
    };

    if (mode === 'today') {
      const [rows] = await pool.query<TodayMoodRow[]>(
        `SELECT mood_value, created_at
         FROM mood_logs
         WHERE DATE(created_at) = CURDATE()
         ORDER BY created_at ASC, id ASC`,
      );

      return NextResponse.json({
        mode,
        points: rows,
        today_avg: stats.today_avg == null ? null : Number(stats.today_avg),
        today_min: stats.today_min,
        today_max: stats.today_max,
        today_count: stats.today_count,
      });
    }

    const daysBack = mode === '7d' ? 6 : 29;
    const [rows] = await pool.execute<DailyAverageRow[]>(
      `SELECT
        DATE(created_at) AS day,
        ROUND(AVG(mood_value), 2) AS avg_value
      FROM mood_logs
      WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
        AND created_at < DATE_ADD(CURDATE(), INTERVAL 1 DAY)
      GROUP BY DATE(created_at)
      ORDER BY day ASC`,
      [daysBack],
    );

    return NextResponse.json({
      mode,
      points: rows.map((row) => ({
        day: normalizeDay(row.day),
        avg_value: Number(row.avg_value),
      })),
      today_avg: stats.today_avg == null ? null : Number(stats.today_avg),
      today_min: stats.today_min,
      today_max: stats.today_max,
      today_count: stats.today_count,
    });
  } catch {
    return NextResponse.json({ message: 'Unable to fetch mood range.' }, { status: 500 });
  }
}
