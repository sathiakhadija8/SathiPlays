import { NextResponse } from 'next/server';
import { type ResultSetHeader, type RowDataPacket } from 'mysql2';
import pool from '../../../../lib/db';

export const dynamic = 'force-dynamic';

type ExpenseRow = RowDataPacket & {
  id: number;
  type: 'packaging' | 'other';
  name: string;
  quantity: number | null;
  cost: number;
  created_at: string;
};

type Body = {
  type?: unknown;
  name?: unknown;
  quantity?: unknown;
  cost?: unknown;
};

const VALID_TYPES = new Set(['packaging', 'other']);

function s(value: unknown, max = 180) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, max) : null;
}

function n(value: unknown) {
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

export async function GET() {
  try {
    const [rows] = await pool.execute<ExpenseRow[]>(
      `
      SELECT id, type, name, quantity, cost, created_at
      FROM vinted_expenses
      ORDER BY created_at DESC
      `,
    );
    return NextResponse.json(rows);
  } catch {
    return NextResponse.json({ ok: false, message: 'Unable to load expenses.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Body;
    const type =
      typeof body.type === 'string' && VALID_TYPES.has(body.type.trim().toLowerCase())
        ? body.type.trim().toLowerCase()
        : null;
    const name = s(body.name, 180);
    const quantity = body.quantity === undefined || body.quantity === '' ? null : n(body.quantity);
    const cost = n(body.cost);

    if (!type || !name) {
      return NextResponse.json({ ok: false, message: 'type and name are required.' }, { status: 400 });
    }
    if (quantity !== null && (quantity < 0 || !Number.isInteger(quantity))) {
      return NextResponse.json({ ok: false, message: 'quantity must be a positive integer.' }, { status: 400 });
    }
    if (cost === null || cost < 0) {
      return NextResponse.json({ ok: false, message: 'cost must be >= 0.' }, { status: 400 });
    }

    const [result] = await pool.execute<ResultSetHeader>(
      `
      INSERT INTO vinted_expenses (type, name, quantity, cost)
      VALUES (?, ?, ?, ?)
      `,
      [type, name, quantity, cost],
    );

    return NextResponse.json({ ok: true, insertedId: result.insertId });
  } catch {
    return NextResponse.json({ ok: false, message: 'Unable to create expense.' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = n(searchParams.get('id'));
    if (id === null || id <= 0) {
      return NextResponse.json({ ok: false, message: 'id is required.' }, { status: 400 });
    }

    const [result] = await pool.execute<ResultSetHeader>(`DELETE FROM vinted_expenses WHERE id = ?`, [id]);
    if (result.affectedRows === 0) {
      return NextResponse.json({ ok: false, message: 'Expense not found.' }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false, message: 'Unable to delete expense.' }, { status: 500 });
  }
}
