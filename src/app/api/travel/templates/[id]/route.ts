import { NextResponse } from 'next/server';
import { type ResultSetHeader } from 'mysql2';
import pool from '../../../../../lib/db';
import { ensureTravelTables, getTravelUserId } from '../../../../../lib/travel-server';

type Body = {
  name?: unknown;
  tripMode?: unknown;
  planner?: unknown;
};

function isTripMode(value: string): value is 'same_day' | 'weekend' | 'holiday' | 'custom' {
  return value === 'same_day' || value === 'weekend' || value === 'holiday' || value === 'custom';
}

export async function PATCH(request: Request, context: { params: { id: string } }) {
  try {
    await ensureTravelTables();
    const userId = getTravelUserId();
    const id = Number(context.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return NextResponse.json({ ok: false, message: 'Invalid id.' }, { status: 400 });
    }

    const body = (await request.json()) as Body;
    const name = String(body.name ?? '').trim();
    const tripMode = String(body.tripMode ?? '').trim();
    const planner = body.planner && typeof body.planner === 'object' ? body.planner : null;

    if (!name) return NextResponse.json({ ok: false, message: 'name is required.' }, { status: 400 });
    if (!planner) return NextResponse.json({ ok: false, message: 'planner is required.' }, { status: 400 });
    if (!isTripMode(tripMode)) return NextResponse.json({ ok: false, message: 'tripMode is invalid.' }, { status: 400 });

    const [result] = await pool.execute<ResultSetHeader>(
      `UPDATE travel_planner_templates
       SET name = ?, trip_mode = ?, template_json = ?
       WHERE id = ? AND user_id = ?`,
      [name, tripMode, JSON.stringify(planner), id, userId],
    );
    if (!result.affectedRows) {
      return NextResponse.json({ ok: false, message: 'Template not found.' }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false, message: 'Unable to update template.' }, { status: 500 });
  }
}

export async function DELETE(_: Request, context: { params: { id: string } }) {
  try {
    await ensureTravelTables();
    const userId = getTravelUserId();
    const id = Number(context.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return NextResponse.json({ ok: false, message: 'Invalid id.' }, { status: 400 });
    }

    const [result] = await pool.execute<ResultSetHeader>(
      `DELETE FROM travel_planner_templates WHERE id = ? AND user_id = ?`,
      [id, userId],
    );
    if (!result.affectedRows) {
      return NextResponse.json({ ok: false, message: 'Template not found.' }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false, message: 'Unable to delete template.' }, { status: 500 });
  }
}
