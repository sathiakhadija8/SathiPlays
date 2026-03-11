import { NextResponse } from 'next/server';
import { type ResultSetHeader, type RowDataPacket } from 'mysql2';
import pool from '../../../../../../lib/db';
import { addPointsOnceSafe } from '../../../../../../lib/points-helpers';

export const dynamic = 'force-dynamic';

type Body = {
  brand_id?: unknown;
  scheduled_at?: unknown;
};

type StatusRow = RowDataPacket & {
  status: string;
};

function parseSchedule(value: unknown) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

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
  const parsed = hasTimezone ? new Date(trimmed) : localCheck;
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

function toMysqlDateTime(date: Date) {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  try {
    const id = Number(params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return NextResponse.json({ ok: false, message: 'Invalid id.' }, { status: 400 });
    }

    const body = (await request.json()) as Body;
    const brandId = Number(body.brand_id);
    if (!Number.isInteger(brandId) || brandId <= 0) {
      return NextResponse.json({ ok: false, message: 'brand_id is required.' }, { status: 400 });
    }
    const scheduledDate = parseSchedule(body.scheduled_at);
    if (!scheduledDate) {
      return NextResponse.json({ ok: false, message: 'scheduled_at is required.' }, { status: 400 });
    }

    const [statusRows] = await pool.execute<StatusRow[]>(
      `SELECT status FROM content_items WHERE id = ? AND brand_id = ? LIMIT 1`,
      [id, brandId],
    );
    const previousStatus = statusRows[0]?.status ?? null;
    if (!previousStatus) {
      return NextResponse.json({ ok: false, message: 'Content item not found.' }, { status: 404 });
    }

    const [result] = await pool.execute<ResultSetHeader>(
      `
      UPDATE content_items
      SET status = 'scheduled', scheduled_at = ?
      WHERE id = ?
        AND brand_id = ?
      `,
      [toMysqlDateTime(scheduledDate), id, brandId],
    );

    if (result.affectedRows === 0) {
      return NextResponse.json({ ok: false, message: 'Content item not found.' }, { status: 404 });
    }

    let pointsAwarded = 0;
    if (previousStatus !== 'scheduled') {
      const awarded = await addPointsOnceSafe({
        domain: 'content',
        sourceType: 'content_status_scheduled',
        sourceId: id,
        points: 14,
        reason: 'Content scheduled',
      });
      pointsAwarded = awarded ? 14 : 0;
    }

    return NextResponse.json({ ok: true, points_awarded: pointsAwarded });
  } catch {
    return NextResponse.json({ ok: false, message: 'Unable to schedule content item.' }, { status: 500 });
  }
}
