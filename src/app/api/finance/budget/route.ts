import { NextResponse } from 'next/server';
import { type RowDataPacket } from 'mysql2';
import pool from '../../../../lib/db';
import { FINANCE_CATEGORIES, ensureFinanceTables, getDemoUserId, isValidMonth, nowMonthKey, parseMoney, toNumber } from '../../../../lib/finance-server';

export const dynamic = 'force-dynamic';

type BudgetRow = RowDataPacket & { month: string; total_budget: number | null };
type CategoryBudgetRow = RowDataPacket & { category: string; limit_amount: number | null };

export async function GET(request: Request) {
  try {
    await ensureFinanceTables();
    const { searchParams } = new URL(request.url);
    const monthParam = searchParams.get('month') ?? nowMonthKey();
    const month = isValidMonth(monthParam) ? monthParam : nowMonthKey();

    const [rows] = await pool.execute<BudgetRow[]>(
      `SELECT month, total_budget FROM finance_budgets WHERE user_id = ? AND month = ? LIMIT 1`,
      [getDemoUserId(), month],
    );
    const [categoryRows] = await pool.execute<CategoryBudgetRow[]>(
      `SELECT category, limit_amount FROM finance_category_budgets WHERE user_id = ? AND month = ? ORDER BY category`,
      [getDemoUserId(), month],
    );

    const category_limits = Object.fromEntries(
      categoryRows.map((row) => [row.category, toNumber(row.limit_amount ?? 0)]),
    );

    return NextResponse.json({
      month,
      total_budget: toNumber(rows[0]?.total_budget ?? 0),
      category_limits,
    });
  } catch {
    return NextResponse.json({ message: 'Unable to load budget.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    await ensureFinanceTables();
    const body = (await request.json().catch(() => null)) as {
      month?: string;
      total_budget?: unknown;
      category_limits?: Record<string, unknown>;
    } | null;
    const month = body?.month?.trim() ?? '';
    const budget = parseMoney(body?.total_budget);

    if (!isValidMonth(month)) {
      return NextResponse.json({ message: 'month must be YYYY-MM.' }, { status: 400 });
    }

    if (budget === null || budget < 0) {
      return NextResponse.json({ message: 'total_budget must be a valid non-negative number.' }, { status: 400 });
    }

    await pool.execute(
      `
      INSERT INTO finance_budgets (user_id, month, total_budget)
      VALUES (?, ?, ?)
      ON DUPLICATE KEY UPDATE total_budget = VALUES(total_budget)
      `,
      [getDemoUserId(), month, budget],
    );

    const categoryLimitsInput = body?.category_limits ?? {};
    const normalizedLimits: Array<{ category: string; limit: number }> = [];

    for (const [category, rawValue] of Object.entries(categoryLimitsInput)) {
      if (!FINANCE_CATEGORIES.includes(category as (typeof FINANCE_CATEGORIES)[number])) continue;
      const parsed = parseMoney(rawValue);
      if (parsed === null || parsed < 0) continue;
      normalizedLimits.push({ category, limit: parsed });
    }

    if (normalizedLimits.length > 0) {
      const values = normalizedLimits
        .map(() => '(?, ?, ?, ?)')
        .join(', ');
      const params: Array<string | number> = [];
      normalizedLimits.forEach((item) => {
        params.push(getDemoUserId(), month, item.category, item.limit);
      });

      await pool.execute(
        `
        INSERT INTO finance_category_budgets (user_id, month, category, limit_amount)
        VALUES ${values}
        ON DUPLICATE KEY UPDATE limit_amount = VALUES(limit_amount)
        `,
        params,
      );
    }

    const [categoryRows] = await pool.execute<CategoryBudgetRow[]>(
      `SELECT category, limit_amount FROM finance_category_budgets WHERE user_id = ? AND month = ? ORDER BY category`,
      [getDemoUserId(), month],
    );
    const category_limits = Object.fromEntries(
      categoryRows.map((row) => [row.category, toNumber(row.limit_amount ?? 0)]),
    );

    return NextResponse.json({ month, total_budget: budget, category_limits });
  } catch {
    return NextResponse.json({ message: 'Unable to save budget.' }, { status: 500 });
  }
}
