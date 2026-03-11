import { NextResponse } from 'next/server';
import { type ResultSetHeader, type RowDataPacket } from 'mysql2';
import pool from '../../../../lib/db';

export const dynamic = 'force-dynamic';

type BundleRow = RowDataPacket & {
  id: number;
  supplier: string;
  bundle_name: string;
  quantity_expected: number;
  total_cost: number;
  status: 'ordered' | 'shipped' | 'delivered';
  ordered_at: string | null;
  eta_date: string | null;
  delivered_at: string | null;
  created_at: string;
};

type Body = {
  id?: unknown;
  supplier?: unknown;
  bundle_name?: unknown;
  quantity_expected?: unknown;
  total_cost?: unknown;
  status?: unknown;
  ordered_at?: unknown;
  eta_date?: unknown;
  delivered_at?: unknown;
};

const VALID_STATUSES = new Set(['ordered', 'shipped', 'delivered']);

function s(value: unknown, max = 180) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, max) : null;
}

function n(value: unknown) {
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function parseOptionalYmd(value: unknown) {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  const match = /^(\d{4})-(0[1-9]|1[0-2])-([0-2]\d|3[01])$/.exec(trimmed);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const parsed = new Date(year, month - 1, day);
  if (
    Number.isNaN(parsed.getTime()) ||
    parsed.getFullYear() !== year ||
    parsed.getMonth() !== month - 1 ||
    parsed.getDate() !== day
  ) {
    return null;
  }
  return trimmed;
}

export async function GET() {
  try {
    const [rows] = await pool.execute<BundleRow[]>(
      `
      SELECT id, supplier, bundle_name, quantity_expected, total_cost, status, ordered_at, eta_date, delivered_at, created_at
      FROM vinted_bundles
      ORDER BY created_at DESC
      `,
    );
    return NextResponse.json(rows);
  } catch {
    return NextResponse.json({ ok: false, message: 'Unable to load bundles.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Body;
    const supplier = s(body.supplier, 160);
    const bundleName = s(body.bundle_name, 160);
    const qty = n(body.quantity_expected);
    const totalCost = n(body.total_cost);
    const status =
      typeof body.status === 'string' && VALID_STATUSES.has(body.status.trim().toLowerCase())
        ? body.status.trim().toLowerCase()
        : 'ordered';
    const etaDate = parseOptionalYmd(body.eta_date);

    if (!supplier || !bundleName) {
      return NextResponse.json({ ok: false, message: 'supplier and bundle_name are required.' }, { status: 400 });
    }
    if (qty === null || qty < 0 || !Number.isInteger(qty)) {
      return NextResponse.json({ ok: false, message: 'quantity_expected must be an integer >= 0.' }, { status: 400 });
    }
    if (totalCost === null || totalCost < 0) {
      return NextResponse.json({ ok: false, message: 'total_cost must be >= 0.' }, { status: 400 });
    }
    if (body.eta_date !== undefined && body.eta_date !== null && body.eta_date !== '' && !etaDate) {
      return NextResponse.json({ ok: false, message: 'eta_date must be YYYY-MM-DD.' }, { status: 400 });
    }

    const [result] = await pool.execute<ResultSetHeader>(
      `
      INSERT INTO vinted_bundles (supplier, bundle_name, quantity_expected, total_cost, status, ordered_at, eta_date, delivered_at)
      VALUES (?, ?, ?, ?, ?, NOW(), ?, ?)
      `,
      [supplier, bundleName, qty, totalCost, status, etaDate, status === 'delivered' ? new Date() : null],
    );

    return NextResponse.json({ ok: true, insertedId: result.insertId });
  } catch {
    return NextResponse.json({ ok: false, message: 'Unable to create bundle.' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const body = (await request.json()) as Body;
    const id = n(body.id);
    if (id === null || id <= 0) {
      return NextResponse.json({ ok: false, message: 'id is required.' }, { status: 400 });
    }

    const supplier = body.supplier === undefined ? undefined : s(body.supplier, 160);
    const bundleName = body.bundle_name === undefined ? undefined : s(body.bundle_name, 160);
    const qty = body.quantity_expected === undefined ? undefined : n(body.quantity_expected);
    const totalCost = body.total_cost === undefined ? undefined : n(body.total_cost);
    const status =
      body.status === undefined
        ? undefined
        : typeof body.status === 'string' && VALID_STATUSES.has(body.status.trim().toLowerCase())
          ? body.status.trim().toLowerCase()
          : null;
    const etaDate = body.eta_date === undefined ? undefined : parseOptionalYmd(body.eta_date);

    if (qty !== undefined && (qty === null || qty < 0 || !Number.isInteger(qty))) {
      return NextResponse.json({ ok: false, message: 'quantity_expected must be an integer >= 0.' }, { status: 400 });
    }
    if (totalCost !== undefined && (totalCost === null || totalCost < 0)) {
      return NextResponse.json({ ok: false, message: 'total_cost must be >= 0.' }, { status: 400 });
    }
    if (body.status !== undefined && !status) {
      return NextResponse.json({ ok: false, message: 'status is invalid.' }, { status: 400 });
    }
    if (body.eta_date !== undefined && body.eta_date !== null && body.eta_date !== '' && !etaDate) {
      return NextResponse.json({ ok: false, message: 'eta_date must be YYYY-MM-DD.' }, { status: 400 });
    }

    const [result] = await pool.execute<ResultSetHeader>(
      `
      UPDATE vinted_bundles
      SET
        supplier = COALESCE(?, supplier),
        bundle_name = COALESCE(?, bundle_name),
        quantity_expected = COALESCE(?, quantity_expected),
        total_cost = COALESCE(?, total_cost),
        status = COALESCE(?, status),
        eta_date = COALESCE(?, eta_date),
        delivered_at = CASE
          WHEN ? = 'delivered' THEN COALESCE(delivered_at, NOW())
          WHEN ? IN ('ordered', 'shipped') THEN NULL
          ELSE delivered_at
        END
      WHERE id = ?
      `,
      [
        supplier === undefined ? null : supplier,
        bundleName === undefined ? null : bundleName,
        qty === undefined ? null : qty,
        totalCost === undefined ? null : totalCost,
        status === undefined ? null : status,
        etaDate === undefined ? null : etaDate,
        status ?? null,
        status ?? null,
        id,
      ],
    );

    if (result.affectedRows === 0) {
      return NextResponse.json({ ok: false, message: 'Bundle not found.' }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false, message: 'Unable to update bundle.' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = n(searchParams.get('id'));
    if (id === null || id <= 0) {
      return NextResponse.json({ ok: false, message: 'id is required.' }, { status: 400 });
    }

    const [result] = await pool.execute<ResultSetHeader>(`DELETE FROM vinted_bundles WHERE id = ?`, [id]);
    if (result.affectedRows === 0) {
      return NextResponse.json({ ok: false, message: 'Bundle not found.' }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false, message: 'Unable to delete bundle.' }, { status: 500 });
  }
}
