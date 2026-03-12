import { NextResponse } from 'next/server';
import { type ResultSetHeader, type RowDataPacket } from 'mysql2';
import pool from '../../../../lib/db';
import { ensureTravelTables, getTravelUserId, parseObject } from '../../../../lib/travel-server';

type TemplateRow = RowDataPacket & {
  id: number;
  name: string;
  trip_mode: 'same_day' | 'weekend' | 'holiday' | 'custom';
  template_json: string;
};

type Body = {
  name?: unknown;
  tripMode?: unknown;
  planner?: unknown;
};

function isTripMode(value: string): value is 'same_day' | 'weekend' | 'holiday' | 'custom' {
  return value === 'same_day' || value === 'weekend' || value === 'holiday' || value === 'custom';
}

export async function GET() {
  try {
    await ensureTravelTables();
    const userId = getTravelUserId();
    const [rows] = await pool.execute<TemplateRow[]>(
      `SELECT id, name, trip_mode, template_json
       FROM travel_planner_templates
       WHERE user_id = ?
       ORDER BY updated_at DESC, id DESC`,
      [userId],
    );
    return NextResponse.json(
      rows.map((row) => ({
        id: String(row.id),
        name: row.name,
        tripMode: row.trip_mode,
        planner: parseObject(row.template_json, { itinerary: [], packingCards: [], budget: { flights: 0, hotel: 0, activities: 0, food: 0, misc: 0 } }),
      })),
    );
  } catch {
    return NextResponse.json({ ok: false, message: 'Unable to load templates.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    await ensureTravelTables();
    const userId = getTravelUserId();
    const body = (await request.json()) as Body;
    const name = String(body.name ?? '').trim();
    const tripMode = String(body.tripMode ?? 'custom').trim();
    const planner = body.planner && typeof body.planner === 'object' ? body.planner : null;

    if (!name) return NextResponse.json({ ok: false, message: 'name is required.' }, { status: 400 });
    if (!planner) return NextResponse.json({ ok: false, message: 'planner is required.' }, { status: 400 });
    if (!isTripMode(tripMode)) return NextResponse.json({ ok: false, message: 'tripMode is invalid.' }, { status: 400 });

    const [result] = await pool.execute<ResultSetHeader>(
      `INSERT INTO travel_planner_templates (user_id, name, trip_mode, template_json)
       VALUES (?, ?, ?, ?)`,
      [userId, name, tripMode, JSON.stringify(planner)],
    );
    return NextResponse.json({ ok: true, id: String(result.insertId) });
  } catch {
    return NextResponse.json({ ok: false, message: 'Unable to save template.' }, { status: 500 });
  }
}
