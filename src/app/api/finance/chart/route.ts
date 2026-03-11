import { NextResponse } from 'next/server';
import { type RowDataPacket } from 'mysql2';
import pool from '../../../../lib/db';
import {
  addDays,
  ensureFinanceTables,
  formatDateOnly,
  getDemoUserId,
  isValidMonth,
  monthStartEnd,
  nowMonthKey,
  toNumber,
  weekStartMonday,
} from '../../../../lib/finance-server';

export const dynamic = 'force-dynamic';

type SpendByDayRow = RowDataPacket & {
  day: string;
  total: number | null;
};

function normalizeView(value: string | null): 'week' | 'month' {
  return value === 'month' ? 'month' : 'week';
}

export async function GET(request: Request) {
  try {
    await ensureFinanceTables();
    const { searchParams } = new URL(request.url);
    const monthParam = searchParams.get('month') ?? nowMonthKey();
    const month = isValidMonth(monthParam) ? monthParam : nowMonthKey();
    const view = normalizeView(searchParams.get('view'));

    if (view === 'week') {
      const currentMonth = nowMonthKey();
      const baseDate = currentMonth === month ? new Date() : monthStartEnd(month).start;
      const start = weekStartMonday(baseDate);
      const end = addDays(start, 7);

      const [rows] = await pool.execute<SpendByDayRow[]>(
        `
        SELECT DATE_FORMAT(date, '%Y-%m-%d') AS day, COALESCE(SUM(amount), 0) AS total
        FROM finance_transactions
        WHERE user_id = ?
          AND direction = 'expense'
          AND date >= ?
          AND date < ?
        GROUP BY DATE(date)
        ORDER BY DATE(date)
        `,
        [getDemoUserId(), formatDateOnly(start), formatDateOnly(end)],
      );

      const dayMap = new Map(rows.map((row) => [row.day, toNumber(row.total ?? 0)]));
      const labels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
      const data: number[] = [];

      for (let i = 0; i < 7; i += 1) {
        const day = formatDateOnly(addDays(start, i));
        data.push(dayMap.get(day) ?? 0);
      }

      return NextResponse.json({
        view: 'week',
        range: { start: formatDateOnly(start), end: formatDateOnly(addDays(end, -1)) },
        labels,
        series: [{ name: 'Daily Spend', data }],
      });
    }

    const { start, end } = monthStartEnd(month);
    const [rows] = await pool.execute<SpendByDayRow[]>(
      `
      SELECT DATE_FORMAT(date, '%Y-%m-%d') AS day, COALESCE(SUM(amount), 0) AS total
      FROM finance_transactions
      WHERE user_id = ?
        AND direction = 'expense'
        AND date >= ?
        AND date < ?
      GROUP BY DATE(date)
      ORDER BY DATE(date)
      `,
      [getDemoUserId(), start, end],
    );

    const buckets = [0, 0, 0, 0, 0];
    rows.forEach((row) => {
      const dayOfMonth = Number(row.day.slice(8, 10));
      if (!Number.isFinite(dayOfMonth)) return;
      const index = Math.min(4, Math.floor((dayOfMonth - 1) / 7));
      buckets[index] += toNumber(row.total ?? 0);
    });

    return NextResponse.json({
      view: 'month',
      month,
      labels: ['W1', 'W2', 'W3', 'W4', 'W5'],
      series: [{ name: 'Weekly Spend', data: buckets.map((v) => Number(v.toFixed(2))) }],
    });
  } catch {
    return NextResponse.json({ message: 'Unable to load chart.' }, { status: 500 });
  }
}
