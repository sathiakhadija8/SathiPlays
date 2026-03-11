import { NextResponse } from 'next/server';
import { type RowDataPacket } from 'mysql2';
import pool from '../../../../lib/db';
import { lastNDates, parseSymptoms } from '../../../../lib/cycle-helpers';

export const dynamic = 'force-dynamic';

type DayAggRow = RowDataPacket & {
  day: string | Date;
  has_logs: number;
  has_symptoms: number;
  has_period: number;
  has_bc: number;
  day_logs_count: number;
};

type LatestRow = RowDataPacket & {
  created_at: string;
  logged_for_date: string | Date;
  bleeding_type: 'none' | 'spotting' | 'period';
  birth_control_taken: number;
  symptoms: string | null;
};

function normalizeDay(day: string | Date): string {
  if (typeof day === 'string') return day.slice(0, 10);
  const year = day.getFullYear();
  const month = String(day.getMonth() + 1).padStart(2, '0');
  const date = String(day.getDate()).padStart(2, '0');
  return `${year}-${month}-${date}`;
}

function isValidMonth(month: string): boolean {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(month);
}

function monthBounds(month: string): { start: string; end: string } {
  const [yearRaw, monthRaw] = month.split('-');
  const year = Number(yearRaw);
  const monthIndex = Number(monthRaw) - 1;
  const lastDay = new Date(year, monthIndex + 1, 0).getDate();
  return {
    start: `${yearRaw}-${monthRaw}-01`,
    end: `${yearRaw}-${monthRaw}-${String(lastDay).padStart(2, '0')}`,
  };
}

function monthDays(month: string): string[] {
  const { start, end } = monthBounds(month);
  const output: string[] = [];
  const cursor = new Date(`${start}T00:00:00`);
  const finish = new Date(`${end}T00:00:00`);

  while (cursor <= finish) {
    output.push(normalizeDay(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }

  return output;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const month = searchParams.get('month');
    const daysParam = Number(searchParams.get('days') ?? 30);
    const days = Number.isFinite(daysParam) ? Math.max(1, Math.min(120, Math.floor(daysParam))) : 30;
    const daysBack = days - 1;
    const useMonthRange = Boolean(month && isValidMonth(month));
    const range = useMonthRange ? monthBounds(month as string) : null;

    const [aggRows] = useMonthRange
      ? await pool.execute<DayAggRow[]>(
          `SELECT
            logged_for_date AS day,
            1 AS has_logs,
            MAX(CASE WHEN JSON_LENGTH(symptoms) > 0 THEN 1 ELSE 0 END) AS has_symptoms,
            MAX(CASE WHEN bleeding_type = 'period' THEN 1 ELSE 0 END) AS has_period,
            MAX(CASE WHEN birth_control_taken = 1 THEN 1 ELSE 0 END) AS has_bc,
            COUNT(*) AS day_logs_count
          FROM cycle_logs
          WHERE logged_for_date >= ? AND logged_for_date <= ?
          GROUP BY logged_for_date
          ORDER BY logged_for_date ASC`,
          [range!.start, range!.end],
        )
      : await pool.execute<DayAggRow[]>(
          `SELECT
            logged_for_date AS day,
            1 AS has_logs,
            MAX(CASE WHEN JSON_LENGTH(symptoms) > 0 THEN 1 ELSE 0 END) AS has_symptoms,
            MAX(CASE WHEN bleeding_type = 'period' THEN 1 ELSE 0 END) AS has_period,
            MAX(CASE WHEN birth_control_taken = 1 THEN 1 ELSE 0 END) AS has_bc,
            COUNT(*) AS day_logs_count
          FROM cycle_logs
          WHERE logged_for_date >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
            AND logged_for_date <= CURDATE()
          GROUP BY logged_for_date
          ORDER BY logged_for_date ASC`,
          [daysBack],
        );

    const [latestRows] = await pool.query<LatestRow[]>(
      `SELECT created_at, logged_for_date, bleeding_type, birth_control_taken, symptoms
       FROM cycle_logs
       ORDER BY created_at DESC, id DESC
       LIMIT 1`,
    );

    const [symptomRows] = useMonthRange
      ? await pool.execute<Array<RowDataPacket & { symptoms: string | null }>>(
          `SELECT symptoms
           FROM cycle_logs
           WHERE logged_for_date >= ? AND logged_for_date <= ?`,
          [range!.start, range!.end],
        )
      : await pool.execute<Array<RowDataPacket & { symptoms: string | null }>>(
          `SELECT symptoms
           FROM cycle_logs
           WHERE logged_for_date >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
             AND logged_for_date <= CURDATE()`,
          [daysBack],
        );

    const dateMap = new Map(
      aggRows.map((row) => [
        normalizeDay(row.day),
        {
          has_logs: row.has_logs === 1,
          has_symptoms: row.has_symptoms === 1,
          has_period: row.has_period === 1,
          has_bc: row.has_bc === 1,
          day_logs_count: Number(row.day_logs_count ?? 0),
        },
      ]),
    );

    const dateRangeDays = useMonthRange ? monthDays(month as string) : lastNDates(days);
    const daysList = dateRangeDays.map((day) => {
      const found = dateMap.get(day);
      return {
        day,
        has_logs: found?.has_logs ?? false,
        has_symptoms: found?.has_symptoms ?? false,
        has_period: found?.has_period ?? false,
        has_bc: found?.has_bc ?? false,
      };
    });

    const todayKey = lastNDates(1)[0];
    const todayEntry = dateMap.get(todayKey);

    const latest = latestRows[0]
      ? {
          created_at: latestRows[0].created_at,
          logged_for_date: normalizeDay(latestRows[0].logged_for_date),
          bleeding_type: latestRows[0].bleeding_type,
          birth_control_taken: latestRows[0].birth_control_taken === 1,
          symptoms: parseSymptoms(latestRows[0].symptoms),
        }
      : null;

    const symptomCount = new Map<string, number>();
    for (const row of symptomRows) {
      for (const symptom of parseSymptoms(row.symptoms)) {
        symptomCount.set(symptom, (symptomCount.get(symptom) ?? 0) + 1);
      }
    }
    const top_symptoms_30d = Array.from(symptomCount.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([name]) => name);

    return NextResponse.json({
      days: daysList,
      latest_log: latest,
      today_has_logs: Boolean(todayEntry?.has_logs),
      today_logs_count: todayEntry?.day_logs_count ?? 0,
      top_symptoms_30d,
    });
  } catch {
    return NextResponse.json({ message: 'Unable to fetch cycle summary.' }, { status: 500 });
  }
}
