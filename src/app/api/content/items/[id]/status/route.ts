import { NextResponse } from 'next/server';
import { type ResultSetHeader, type RowDataPacket } from 'mysql2';
import pool from '../../../../../../lib/db';
import { addPointsOnceSafe } from '../../../../../../lib/points-helpers';

export const dynamic = 'force-dynamic';

type Body = {
  brand_id?: unknown;
  status?: unknown;
};

const VALID_STATUSES = new Set(['idea', 'scripted', 'filmed', 'edited', 'scheduled', 'posted']);
const STATUS_POINTS: Record<string, number> = {
  scripted: 6,
  filmed: 10,
  edited: 12,
  scheduled: 14,
  posted: 25,
};

type StatusRow = RowDataPacket & {
  status: string;
};

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
    const status = typeof body.status === 'string' ? body.status.trim().toLowerCase() : '';
    if (!VALID_STATUSES.has(status)) {
      return NextResponse.json({ ok: false, message: 'Invalid status.' }, { status: 400 });
    }

    const [existingRows] = await pool.execute<StatusRow[]>(
      `SELECT status FROM content_items WHERE id = ? AND brand_id = ? LIMIT 1`,
      [id, brandId],
    );
    const previousStatus = existingRows[0]?.status ?? null;
    if (!previousStatus) {
      return NextResponse.json({ ok: false, message: 'Content item not found.' }, { status: 404 });
    }

    const [result] = await pool.execute<ResultSetHeader>(
      `UPDATE content_items SET status = ? WHERE id = ? AND brand_id = ?`,
      [status, id, brandId],
    );
    if (result.affectedRows === 0) {
      return NextResponse.json({ ok: false, message: 'Content item not found.' }, { status: 404 });
    }

    let pointsAwarded = 0;
    if (status !== previousStatus && STATUS_POINTS[status]) {
      const awarded = await addPointsOnceSafe({
        domain: 'content',
        sourceType: `content_status_${status}`,
        sourceId: id,
        points: STATUS_POINTS[status],
        reason: `Content moved to ${status}`,
      });
      pointsAwarded = awarded ? STATUS_POINTS[status] : 0;
    }

    return NextResponse.json({ ok: true, points_awarded: pointsAwarded });
  } catch {
    return NextResponse.json({ ok: false, message: 'Unable to update content status.' }, { status: 500 });
  }
}
