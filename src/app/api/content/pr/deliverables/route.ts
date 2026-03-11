import { NextResponse } from 'next/server';
import { type ResultSetHeader, type RowDataPacket } from 'mysql2';
import pool from '../../../../../lib/db';

export const dynamic = 'force-dynamic';

type DeliverableRow = RowDataPacket & {
  id: number;
  pr_brand_id: number;
  content_item_id: number | null;
  deadline: string | null;
  payment_amount: string | number | null;
  status: 'pending' | 'posted' | 'paid';
  posted_at: string | null;
  created_at: string;
};

type ExistsRow = RowDataPacket & {
  id: number;
};

type Body = {
  id?: unknown;
  brand_id?: unknown;
  pr_brand_id?: unknown;
  content_item_id?: unknown;
  deadline?: unknown;
  payment_amount?: unknown;
  status?: unknown;
  posted_at?: unknown;
};

const VALID_STATUS = new Set(['pending', 'posted', 'paid']);

function parseOptionalInt(value: unknown) {
  if (value === undefined || value === null || value === '') return null;
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : null;
}

function parseOptionalDate(value: unknown) {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  const match = /^(\d{4})-(0[1-9]|1[0-2])-([0-2]\d|3[01])$/.exec(trimmed);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);
  if (
    Number.isNaN(date.getTime()) ||
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }
  return trimmed;
}

function parseOptionalDateTime(value: unknown) {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  const match =
    /^(\d{4})-(0[1-9]|1[0-2])-([0-2]\d|3[01])[T ]([01]\d|2[0-3]):([0-5]\d)(?::([0-5]\d))?(?:\.\d{1,3})?(?:Z|[+-][01]\d:[0-5]\d)?$/.exec(
      trimmed,
    );
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const second = Number(match[6] ?? '0');

  const localCheck = new Date(year, month - 1, day, hour, minute, second);
  if (
    Number.isNaN(localCheck.getTime()) ||
    localCheck.getFullYear() !== year ||
    localCheck.getMonth() !== month - 1 ||
    localCheck.getDate() !== day ||
    localCheck.getHours() !== hour ||
    localCheck.getMinutes() !== minute ||
    localCheck.getSeconds() !== second
  ) {
    return null;
  }

  const hasTimezone = /(?:Z|[+-][01]\d:[0-5]\d)$/.test(trimmed);
  const dt = hasTimezone ? new Date(trimmed) : localCheck;
  if (Number.isNaN(dt.getTime())) return null;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())} ${pad(dt.getHours())}:${pad(
    dt.getMinutes(),
  )}:${pad(dt.getSeconds())}`;
}

function parseOptionalDecimal(value: unknown) {
  if (value === undefined || value === null || value === '') return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return null;
  return Number(n.toFixed(2));
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const brandId = Number(searchParams.get('brand_id'));
    if (!Number.isInteger(brandId) || brandId <= 0) {
      return NextResponse.json({ ok: false, message: 'brand_id is required.' }, { status: 400 });
    }

    const [rows] = await pool.execute<DeliverableRow[]>(
      `
      SELECT
        pd.id,
        pd.pr_brand_id,
        pd.content_item_id,
        pd.deadline,
        pd.payment_amount,
        pd.status,
        pd.posted_at,
        pd.created_at
      FROM pr_deliverables pd
      INNER JOIN pr_brands pb ON pb.id = pd.pr_brand_id
      WHERE pb.brand_id = ?
      ORDER BY COALESCE(pd.deadline, DATE(pd.created_at)) ASC, pd.created_at DESC
      `,
      [brandId],
    );

    return NextResponse.json(
      rows.map((row) => ({
        ...row,
        payment_amount: row.payment_amount === null ? null : Number(row.payment_amount),
      })),
    );
  } catch {
    return NextResponse.json({ ok: false, message: 'Unable to load PR deliverables.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Body;
    const brandId = Number(body.brand_id);
    const prBrandId = parseOptionalInt(body.pr_brand_id);
    const contentItemId = parseOptionalInt(body.content_item_id);
    const deadline = parseOptionalDate(body.deadline);
    const paymentAmount = parseOptionalDecimal(body.payment_amount);
    const statusRaw = typeof body.status === 'string' ? body.status.trim().toLowerCase() : 'pending';
    const status = VALID_STATUS.has(statusRaw) ? statusRaw : null;
    const postedAt = parseOptionalDateTime(body.posted_at);

    if (!Number.isInteger(brandId) || brandId <= 0) {
      return NextResponse.json({ ok: false, message: 'brand_id is required.' }, { status: 400 });
    }
    if (!prBrandId || !status) {
      return NextResponse.json({ ok: false, message: 'pr_brand_id and valid status are required.' }, { status: 400 });
    }
    if (body.deadline !== undefined && body.deadline !== null && body.deadline !== '' && !deadline) {
      return NextResponse.json({ ok: false, message: 'deadline must be YYYY-MM-DD.' }, { status: 400 });
    }
    if (body.payment_amount !== undefined && body.payment_amount !== null && body.payment_amount !== '' && paymentAmount === null) {
      return NextResponse.json({ ok: false, message: 'payment_amount must be a non-negative number.' }, { status: 400 });
    }
    if (body.posted_at !== undefined && body.posted_at !== null && body.posted_at !== '' && !postedAt) {
      return NextResponse.json({ ok: false, message: 'posted_at must be a valid datetime.' }, { status: 400 });
    }

    const [brandRows] = await pool.execute<ExistsRow[]>(
      `SELECT id FROM pr_brands WHERE id = ? AND brand_id = ? LIMIT 1`,
      [prBrandId, brandId],
    );
    if (brandRows.length === 0) {
      return NextResponse.json({ ok: false, message: 'pr_brand_id is invalid for this brand.' }, { status: 400 });
    }

    if (contentItemId) {
      const [contentRows] = await pool.execute<ExistsRow[]>(
        `SELECT id FROM content_items WHERE id = ? AND brand_id = ? LIMIT 1`,
        [contentItemId, brandId],
      );
      if (contentRows.length === 0) {
        return NextResponse.json({ ok: false, message: 'content_item_id is invalid for this brand.' }, { status: 400 });
      }
    }

    const [result] = await pool.execute<ResultSetHeader>(
      `
      INSERT INTO pr_deliverables (pr_brand_id, content_item_id, deadline, payment_amount, status, posted_at)
      VALUES (?, ?, ?, ?, ?, ?)
      `,
      [prBrandId, contentItemId, deadline, paymentAmount, status, postedAt],
    );

    return NextResponse.json({ ok: true, insertedId: result.insertId });
  } catch {
    return NextResponse.json({ ok: false, message: 'Unable to create PR deliverable.' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const body = (await request.json()) as Body;
    const id = Number(body.id);
    const brandId = Number(body.brand_id);
    const hasPrBrandId = body.pr_brand_id !== undefined;
    const hasContentItemId = body.content_item_id !== undefined;
    const hasDeadline = body.deadline !== undefined;
    const hasPaymentAmount = body.payment_amount !== undefined;
    const hasPostedAt = body.posted_at !== undefined;
    const prBrandId = parseOptionalInt(body.pr_brand_id);
    const contentItemId = parseOptionalInt(body.content_item_id);
    const deadline = body.deadline === undefined ? undefined : parseOptionalDate(body.deadline);
    const paymentAmount = body.payment_amount === undefined ? undefined : parseOptionalDecimal(body.payment_amount);
    const statusRaw = body.status === undefined ? undefined : typeof body.status === 'string' ? body.status.trim().toLowerCase() : '';
    const status = statusRaw === undefined ? undefined : VALID_STATUS.has(statusRaw) ? statusRaw : null;
    const postedAt = body.posted_at === undefined ? undefined : parseOptionalDateTime(body.posted_at);

    if (!Number.isInteger(id) || id <= 0) {
      return NextResponse.json({ ok: false, message: 'id is required.' }, { status: 400 });
    }
    if (!Number.isInteger(brandId) || brandId <= 0) {
      return NextResponse.json({ ok: false, message: 'brand_id is required.' }, { status: 400 });
    }
    if (
      hasPrBrandId &&
      body.pr_brand_id !== null &&
      body.pr_brand_id !== '' &&
      !prBrandId
    ) {
      return NextResponse.json({ ok: false, message: 'pr_brand_id must be a valid positive integer.' }, { status: 400 });
    }
    if (
      hasContentItemId &&
      body.content_item_id !== null &&
      body.content_item_id !== '' &&
      !contentItemId
    ) {
      return NextResponse.json({ ok: false, message: 'content_item_id must be a valid positive integer.' }, { status: 400 });
    }
    if (
      body.deadline !== undefined &&
      body.deadline !== null &&
      body.deadline !== '' &&
      !deadline
    ) {
      return NextResponse.json({ ok: false, message: 'deadline must be YYYY-MM-DD.' }, { status: 400 });
    }
    if (
      body.payment_amount !== undefined &&
      body.payment_amount !== null &&
      body.payment_amount !== '' &&
      paymentAmount === null
    ) {
      return NextResponse.json({ ok: false, message: 'payment_amount must be a non-negative number.' }, { status: 400 });
    }
    if (
      body.posted_at !== undefined &&
      body.posted_at !== null &&
      body.posted_at !== '' &&
      !postedAt
    ) {
      return NextResponse.json({ ok: false, message: 'posted_at must be a valid datetime.' }, { status: 400 });
    }
    if (status === null) {
      return NextResponse.json({ ok: false, message: 'Invalid status.' }, { status: 400 });
    }

    if (hasPrBrandId && prBrandId) {
      const [brandRows] = await pool.execute<ExistsRow[]>(
        `SELECT id FROM pr_brands WHERE id = ? AND brand_id = ? LIMIT 1`,
        [prBrandId, brandId],
      );
      if (brandRows.length === 0) {
        return NextResponse.json({ ok: false, message: 'pr_brand_id is invalid for this brand.' }, { status: 400 });
      }
    }

    if (hasContentItemId && contentItemId) {
      const [contentRows] = await pool.execute<ExistsRow[]>(
        `SELECT id FROM content_items WHERE id = ? AND brand_id = ? LIMIT 1`,
        [contentItemId, brandId],
      );
      if (contentRows.length === 0) {
        return NextResponse.json({ ok: false, message: 'content_item_id is invalid for this brand.' }, { status: 400 });
      }
    }

    const [result] = await pool.execute<ResultSetHeader>(
      `
      UPDATE pr_deliverables
      SET
        pr_brand_id = CASE WHEN ? = 1 THEN ? ELSE pr_brand_id END,
        content_item_id = CASE WHEN ? = 1 THEN ? ELSE content_item_id END,
        deadline = CASE WHEN ? = 1 THEN ? ELSE deadline END,
        payment_amount = CASE WHEN ? = 1 THEN ? ELSE payment_amount END,
        status = COALESCE(?, status),
        posted_at = CASE WHEN ? = 1 THEN ? ELSE posted_at END
      WHERE id = ?
        AND pr_brand_id IN (SELECT id FROM pr_brands WHERE brand_id = ?)
      `,
      [
        hasPrBrandId ? 1 : 0,
        prBrandId,
        hasContentItemId ? 1 : 0,
        contentItemId,
        hasDeadline ? 1 : 0,
        deadline === undefined ? null : deadline,
        hasPaymentAmount ? 1 : 0,
        paymentAmount === undefined ? null : paymentAmount,
        status === undefined ? null : status,
        hasPostedAt ? 1 : 0,
        postedAt === undefined ? null : postedAt,
        id,
        brandId,
      ],
    );

    if (result.affectedRows === 0) {
      return NextResponse.json({ ok: false, message: 'PR deliverable not found.' }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false, message: 'Unable to update PR deliverable.' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = Number(searchParams.get('id'));
    const brandId = Number(searchParams.get('brand_id'));
    if (!Number.isInteger(id) || id <= 0) {
      return NextResponse.json({ ok: false, message: 'id is required.' }, { status: 400 });
    }
    if (!Number.isInteger(brandId) || brandId <= 0) {
      return NextResponse.json({ ok: false, message: 'brand_id is required.' }, { status: 400 });
    }

    const [result] = await pool.execute<ResultSetHeader>(
      `
      DELETE FROM pr_deliverables
      WHERE id = ?
        AND pr_brand_id IN (SELECT id FROM pr_brands WHERE brand_id = ?)
      `,
      [id, brandId],
    );
    if (result.affectedRows === 0) {
      return NextResponse.json({ ok: false, message: 'PR deliverable not found.' }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false, message: 'Unable to delete PR deliverable.' }, { status: 500 });
  }
}
