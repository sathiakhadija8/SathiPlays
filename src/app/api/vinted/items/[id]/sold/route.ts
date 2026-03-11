import { NextResponse } from 'next/server';
import { type ResultSetHeader } from 'mysql2';
import pool from '../../../../../../lib/db';

export const dynamic = 'force-dynamic';

type Body = {
  sale_price?: unknown;
  platform_fee?: unknown;
  sold_at?: unknown;
};

function toNumber(value: unknown) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

const DATETIME_INPUT_RE =
  /^(\d{4})-(0[1-9]|1[0-2])-([0-2]\d|3[01])[T ]([01]\d|2[0-3]):([0-5]\d)(?::([0-5]\d))?(?:\.\d{1,3})?(?:Z|[+-][01]\d:[0-5]\d)?$/;

function toMysqlDateTime(date: Date) {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(
    date.getMinutes(),
  )}:${pad(date.getSeconds())}`;
}

function parseDateTimeInput(value: string): string | null {
  const trimmed = value.trim();
  const match = DATETIME_INPUT_RE.exec(trimmed);
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
  const parsed = hasTimezone ? new Date(trimmed) : localCheck;
  if (Number.isNaN(parsed.getTime())) return null;
  return toMysqlDateTime(parsed);
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  try {
    const id = Number(params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return NextResponse.json({ ok: false, message: 'Invalid id.' }, { status: 400 });
    }

    const body = (await request.json()) as Body;
    const salePrice = toNumber(body.sale_price);
    const platformFee = body.platform_fee === undefined || body.platform_fee === '' ? 0 : toNumber(body.platform_fee);
    const soldAtRaw = typeof body.sold_at === 'string' ? body.sold_at : '';

    if (salePrice === null || salePrice < 0) {
      return NextResponse.json({ ok: false, message: 'sale_price is required and must be >= 0.' }, { status: 400 });
    }
    if (platformFee === null || platformFee < 0) {
      return NextResponse.json({ ok: false, message: 'platform_fee must be >= 0.' }, { status: 400 });
    }

    const soldAt = soldAtRaw ? parseDateTimeInput(soldAtRaw) : toMysqlDateTime(new Date());
    if (!soldAt) {
      return NextResponse.json({ ok: false, message: 'sold_at is invalid.' }, { status: 400 });
    }

    const [result] = await pool.execute<ResultSetHeader>(
      `
      UPDATE vinted_items
      SET
        status = 'sold',
        sale_price = ?,
        platform_fee = ?,
        sold_at = ?
      WHERE id = ?
      `,
      [salePrice, platformFee, soldAt, id],
    );

    if (result.affectedRows === 0) {
      return NextResponse.json({ ok: false, message: 'Item not found.' }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false, message: 'Unable to set sold details.' }, { status: 500 });
  }
}
