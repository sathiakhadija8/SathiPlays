import { NextResponse } from 'next/server';
import { type ResultSetHeader, type RowDataPacket } from 'mysql2';
import pool from '../../../../lib/db';
import {
  FINANCE_CATEGORIES,
  ensureFinanceTables,
  formatDateOnly,
  getDemoUserId,
  isValidIsoDate,
  isValidMonth,
  monthStartEnd,
  nowMonthKey,
  parseMoney,
  toNumber,
} from '../../../../lib/finance-server';

export const dynamic = 'force-dynamic';

type TransactionRow = RowDataPacket & {
  id: number;
  amount: number | null;
  direction: 'expense' | 'income';
  category: string;
  note: string | null;
  date: string;
  created_at: string;
};

export async function GET(request: Request) {
  try {
    await ensureFinanceTables();

    const { searchParams } = new URL(request.url);
    const monthParam = searchParams.get('month') ?? nowMonthKey();
    const month = isValidMonth(monthParam) ? monthParam : nowMonthKey();
    const limitParam = Number(searchParams.get('limit') ?? 10);
    const limit = Number.isFinite(limitParam) ? Math.max(1, Math.min(100, Math.floor(limitParam))) : 10;
    const category = (searchParams.get('category') ?? '').trim();
    if (category && !FINANCE_CATEGORIES.includes(category as (typeof FINANCE_CATEGORIES)[number])) {
      return NextResponse.json({ message: 'category is invalid.' }, { status: 400 });
    }
    const { start, end } = monthStartEnd(month);

    const params: Array<string | number | Date> = [getDemoUserId(), start, end];
    let categorySql = '';
    if (category) {
      categorySql = ' AND category = ?';
      params.push(category);
    }
    params.push(limit);

    const [rows] = await pool.execute<TransactionRow[]>(
      `
      SELECT id, amount, direction, category, note, DATE_FORMAT(date, '%Y-%m-%d') AS date, created_at
      FROM finance_transactions
      WHERE user_id = ?
        AND date >= ?
        AND date < ?
        ${categorySql}
      ORDER BY date DESC, created_at DESC
      LIMIT ?
      `,
      params,
    );

    return NextResponse.json(
      rows.map((row) => ({
        id: row.id,
        amount: toNumber(row.amount),
        direction: row.direction,
        category: row.category,
        note: row.note,
        date: row.date,
        created_at: row.created_at,
      })),
    );
  } catch {
    // Graceful fallback keeps the UI usable when DB is temporarily unavailable.
    return NextResponse.json([]);
  }
}

export async function POST(request: Request) {
  try {
    await ensureFinanceTables();

    const body = (await request.json().catch(() => null)) as {
      amount?: unknown;
      direction?: string;
      category?: string;
      note?: string | null;
      date?: string;
    } | null;

    const amount = parseMoney(body?.amount);
    const direction = body?.direction === 'income' ? 'income' : body?.direction === 'expense' ? 'expense' : null;
    const category = (body?.category ?? '').trim();
    const note = (body?.note ?? '').toString().trim();
    const rawDate = (body?.date ?? '').trim();
    const date = isValidIsoDate(rawDate) ? rawDate : formatDateOnly(new Date());

    if (amount === null || amount <= 0) {
      return NextResponse.json({ message: 'amount must be greater than 0.' }, { status: 400 });
    }

    if (!direction) {
      return NextResponse.json({ message: 'direction must be expense or income.' }, { status: 400 });
    }

    if (!category) {
      return NextResponse.json({ message: 'category is required.' }, { status: 400 });
    }

    if (!FINANCE_CATEGORIES.includes(category as (typeof FINANCE_CATEGORIES)[number])) {
      return NextResponse.json({ message: 'category is invalid.' }, { status: 400 });
    }

    const [result] = await pool.execute<ResultSetHeader>(
      `
      INSERT INTO finance_transactions (user_id, amount, direction, category, note, date)
      VALUES (?, ?, ?, ?, ?, ?)
      `,
      [getDemoUserId(), amount, direction, category, note || null, date],
    );

    return NextResponse.json(
      {
        id: result.insertId,
        amount,
        direction,
        category,
        note: note || null,
        date,
      },
      { status: 201 },
    );
  } catch {
    return NextResponse.json({ message: 'Unable to create transaction.' }, { status: 500 });
  }
}
