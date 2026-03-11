import { NextResponse } from 'next/server';
import { type RowDataPacket } from 'mysql2';
import pool from '../../../../lib/db';
import {
  type CategorySpendRow,
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

type SpendRow = RowDataPacket & {
  expense_total: number | null;
  income_total: number | null;
};

type SingleSpendRow = RowDataPacket & { total: number | null };
type CategoryLimitRow = RowDataPacket & { category: string; limit_amount: number | null };

type ViewParam = 'today' | 'week' | 'month';

function asView(value: string | null): ViewParam {
  if (value === 'today' || value === 'week' || value === 'month') return value;
  return 'today';
}

export async function GET(request: Request) {
  try {
    await ensureFinanceTables();
    const { searchParams } = new URL(request.url);
    const monthParam = searchParams.get('month') ?? nowMonthKey();
    const month = isValidMonth(monthParam) ? monthParam : nowMonthKey();
    const view = asView(searchParams.get('view'));

    const { start, end } = monthStartEnd(month);

    const [monthRows] = await pool.execute<SpendRow[]>(
      `
      SELECT
        COALESCE(SUM(CASE WHEN direction='expense' THEN amount ELSE 0 END), 0) AS expense_total,
        COALESCE(SUM(CASE WHEN direction='income' THEN amount ELSE 0 END), 0) AS income_total
      FROM finance_transactions
      WHERE user_id = ? AND date >= ? AND date < ?
      `,
      [getDemoUserId(), start, end],
    );

    const monthExpense = toNumber(monthRows[0]?.expense_total ?? 0);
    const monthIncome = toNumber(monthRows[0]?.income_total ?? 0);

    const [budgetRows] = await pool.execute<RowDataPacket[]>(
      `SELECT total_budget FROM finance_budgets WHERE user_id = ? AND month = ? LIMIT 1`,
      [getDemoUserId(), month],
    );
    const totalBudget = toNumber((budgetRows[0] as { total_budget?: number } | undefined)?.total_budget ?? 0);

    const today = new Date();
    const todayDate = formatDateOnly(today);
    const tomorrowDate = formatDateOnly(addDays(today, 1));

    const weekStart = weekStartMonday(today);
    const weekEnd = addDays(weekStart, 7);
    const lastWeekStart = addDays(weekStart, -7);
    const lastWeekEnd = weekStart;

    const [todayRows] = await pool.execute<SingleSpendRow[]>(
      `
      SELECT COALESCE(SUM(amount), 0) AS total
      FROM finance_transactions
      WHERE user_id = ? AND direction='expense' AND date >= ? AND date < ?
      `,
      [getDemoUserId(), todayDate, tomorrowDate],
    );

    const [weekRows] = await pool.execute<SingleSpendRow[]>(
      `
      SELECT COALESCE(SUM(amount), 0) AS total
      FROM finance_transactions
      WHERE user_id = ? AND direction='expense' AND date >= ? AND date < ?
      `,
      [getDemoUserId(), formatDateOnly(weekStart), formatDateOnly(weekEnd)],
    );

    const [lastWeekRows] = await pool.execute<SingleSpendRow[]>(
      `
      SELECT COALESCE(SUM(amount), 0) AS total
      FROM finance_transactions
      WHERE user_id = ? AND direction='expense' AND date >= ? AND date < ?
      `,
      [getDemoUserId(), formatDateOnly(lastWeekStart), formatDateOnly(lastWeekEnd)],
    );

    const [topCategoryRows] = await pool.execute<CategorySpendRow[]>(
      `
      SELECT category, COALESCE(SUM(amount), 0) AS amount
      FROM finance_transactions
      WHERE user_id = ? AND direction='expense' AND date >= ? AND date < ?
      GROUP BY category
      ORDER BY amount DESC
      LIMIT 1
      `,
      [getDemoUserId(), start, end],
    );

    const [categorySpendRows] = await pool.execute<CategorySpendRow[]>(
      `
      SELECT category, COALESCE(SUM(amount), 0) AS amount
      FROM finance_transactions
      WHERE user_id = ? AND direction='expense' AND date >= ? AND date < ?
      GROUP BY category
      `,
      [getDemoUserId(), start, end],
    );

    const [categoryLimitRows] = await pool.execute<CategoryLimitRow[]>(
      `
      SELECT category, limit_amount
      FROM finance_category_budgets
      WHERE user_id = ? AND month = ?
      `,
      [getDemoUserId(), month],
    );

    const spentMap = new Map(categorySpendRows.map((r) => [r.category, toNumber(r.amount ?? 0)]));
    const categoryAlerts = categoryLimitRows
      .map((row) => {
        const limit = toNumber(row.limit_amount ?? 0);
        const spent = spentMap.get(row.category) ?? 0;
        const usedPct = limit > 0 ? Math.round((spent / limit) * 100) : 0;
        return {
          category: row.category,
          spent,
          limit,
          used_pct: usedPct,
          remaining: Math.max(0, Number((limit - spent).toFixed(2))),
          is_close: limit > 0 && usedPct >= 80,
          is_over: limit > 0 && spent > limit,
        };
      })
      .filter((item) => item.limit > 0)
      .sort((a, b) => b.used_pct - a.used_pct)
      .slice(0, 3);

    const spentToday = toNumber(todayRows[0]?.total ?? 0);
    const spentWeek = toNumber(weekRows[0]?.total ?? 0);
    const lastWeekSpent = toNumber(lastWeekRows[0]?.total ?? 0);

    const trendPct =
      lastWeekSpent === 0
        ? spentWeek > 0
          ? 100
          : 0
        : Math.round(((spentWeek - lastWeekSpent) / lastWeekSpent) * 100);

    const daysInMonth = new Date(start.getFullYear(), start.getMonth() + 1, 0).getDate();
    const avgPerDay = daysInMonth > 0 ? monthExpense / daysInMonth : 0;

    const budgetRemainingPct =
      totalBudget <= 0
        ? 0
        : Math.max(0, Math.round(100 * (1 - monthExpense / totalBudget)));

    return NextResponse.json({
      month,
      view,
      balance: Number((monthIncome - monthExpense).toFixed(2)),
      cards: 2,
      total_budget: totalBudget,
      spent_today: spentToday,
      spent_week: spentWeek,
      spent_month: monthExpense,
      budget_remaining_pct: budgetRemainingPct,
      avg_per_day: Number(avgPerDay.toFixed(2)),
      trend_pct: trendPct,
      top_category: topCategoryRows[0]
        ? { name: topCategoryRows[0].category, amount: toNumber(topCategoryRows[0].amount ?? 0) }
        : null,
      top_alert_categories: categoryAlerts,
    });
  } catch {
    return NextResponse.json({ message: 'Unable to load summary.' }, { status: 500 });
  }
}
